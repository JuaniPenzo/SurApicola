// =============================================================================
// SurApícola — Consultas de Insumos y Envases (Prompt 3)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Insumo,
  MovimientoInsumo,
  PresentacionInsumo,
  AdvertenciaStockInsumo,
  TipoOrigenInsumo,
  AlertaStock,
} from '../types';

// ---------------------------------------------------------------------------
// CRUD Insumos
// ---------------------------------------------------------------------------

/**
 * Obtiene todos los insumos activos con su stock actual calculado.
 * El stock es la suma firmada de movimientos_insumo (positivo=entrada, negativo=salida).
 */
export async function getInsumos(db: SQLiteDatabase): Promise<Insumo[]> {
  const rows = await db.getAllAsync<any>(`
    SELECT
      i.*,
      COALESCE((
        SELECT SUM(m.cantidad)
        FROM movimientos_insumo m
        WHERE m.insumo_id = i.id
      ), 0) AS stock_actual
    FROM insumos i
    WHERE i.activo = 1
    ORDER BY i.nombre ASC
  `);
  return rows.map(mapRowToInsumo);
}

/**
 * Obtiene todos los insumos (activos e inactivos) con su stock actual.
 */
export async function getTodosLosInsumos(db: SQLiteDatabase): Promise<Insumo[]> {
  const rows = await db.getAllAsync<any>(`
    SELECT
      i.*,
      COALESCE((
        SELECT SUM(m.cantidad)
        FROM movimientos_insumo m
        WHERE m.insumo_id = i.id
      ), 0) AS stock_actual
    FROM insumos i
    ORDER BY i.activo DESC, i.nombre ASC
  `);
  return rows.map(mapRowToInsumo);
}

/**
 * Obtiene un insumo por ID con su stock actual.
 */
export async function getInsumoPorId(
  db: SQLiteDatabase,
  id: number
): Promise<Insumo | null> {
  const row = await db.getFirstAsync<any>(`
    SELECT
      i.*,
      COALESCE((
        SELECT SUM(m.cantidad)
        FROM movimientos_insumo m
        WHERE m.insumo_id = i.id
      ), 0) AS stock_actual
    FROM insumos i
    WHERE i.id = ?
  `, [id]);
  return row ? mapRowToInsumo(row) : null;
}

/**
 * Crea un nuevo insumo.
 */
export async function crearInsumo(
  db: SQLiteDatabase,
  input: { nombre: string; unidad: string; descripcion: string | null; stock_minimo?: number }
): Promise<number> {
  const min = input.stock_minimo ?? 0;
  const result = await db.runAsync(
    `INSERT INTO insumos (nombre, unidad, descripcion, stock_minimo, activo) VALUES (?, ?, ?, ?, 1)`,
    [input.nombre, input.unidad, input.descripcion, min]
  );
  return result.lastInsertRowId;
}

/**
 * Actualiza nombre, unidad y descripción de un insumo.
 */
export async function actualizarInsumo(
  db: SQLiteDatabase,
  id: number,
  input: { nombre: string; unidad: string; descripcion: string | null; stock_minimo?: number }
): Promise<void> {
  const min = input.stock_minimo ?? 0;
  await db.runAsync(
    `UPDATE insumos SET nombre = ?, unidad = ?, descripcion = ?, stock_minimo = ? WHERE id = ?`,
    [input.nombre, input.unidad, input.descripcion, min, id]
  );
}

/**
 * Archiva lógicamente un insumo (activo = 0).
 */
export async function archivarInsumo(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(`UPDATE insumos SET activo = 0 WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Movimientos de Insumo
// ---------------------------------------------------------------------------

export interface RegistrarMovimientoInsumoInput {
  insumo_id: number;
  fecha: string;
  cantidad: number; // positivo=entrada, negativo=salida
  tipo_origen: TipoOrigenInsumo;
  origen_id?: number | null;
  notas?: string | null;
}

/**
 * Registra un movimiento de insumo (compra, ajuste, etc.).
 */
export async function registrarMovimientoInsumo(
  db: SQLiteDatabase,
  input: RegistrarMovimientoInsumoInput
): Promise<void> {
  if (input.cantidad === 0) throw new Error('La cantidad no puede ser 0.');
  await db.runAsync(
    `INSERT INTO movimientos_insumo (insumo_id, fecha, cantidad, tipo_origen, origen_id, notas)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.insumo_id,
      input.fecha,
      input.cantidad,
      input.tipo_origen,
      input.origen_id ?? null,
      input.notas ?? null,
    ]
  );
}

/**
 * Obtiene el historial de movimientos de un insumo, del más reciente al más antiguo.
 */
export async function getMovimientosInsumo(
  db: SQLiteDatabase,
  insumoId: number
): Promise<MovimientoInsumo[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM movimientos_insumo WHERE insumo_id = ? ORDER BY fecha DESC, id DESC LIMIT 100`,
    [insumoId]
  );
  return rows.map(mapRowToMovimiento);
}

// ---------------------------------------------------------------------------
// Relación Presentación → Insumos
// ---------------------------------------------------------------------------

/**
 * Obtiene los insumos configurados para una presentación (activos únicamente).
 */
export async function getPresentacionInsumos(
  db: SQLiteDatabase,
  presentacionId: number
): Promise<PresentacionInsumo[]> {
  const rows = await db.getAllAsync<any>(`
    SELECT
      pi.id,
      pi.presentacion_id,
      pi.insumo_id,
      pi.cantidad_por_unidad,
      pi.activo,
      i.nombre AS insumo_nombre,
      i.unidad AS insumo_unidad
    FROM presentacion_insumos pi
    JOIN insumos i ON pi.insumo_id = i.id
    WHERE pi.presentacion_id = ? AND pi.activo = 1
    ORDER BY i.nombre ASC
  `, [presentacionId]);
  return rows.map(mapRowToPresentacionInsumo);
}

/**
 * Establece la lista de insumos para una presentación.
 * Usa baja lógica para eliminar las relaciones que ya no se necesitan.
 */
export async function setPresentacionInsumos(
  db: SQLiteDatabase,
  presentacionId: number,
  items: Array<{ insumo_id: number; cantidad_por_unidad: number }>
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Dar de baja todas las relaciones actuales
    await db.runAsync(
      `UPDATE presentacion_insumos SET activo = 0 WHERE presentacion_id = ?`,
      [presentacionId]
    );

    // Insertar o reactivar cada relación
    for (const item of items) {
      if (item.cantidad_por_unidad <= 0) continue;

      const existing = await db.getFirstAsync<any>(
        `SELECT id FROM presentacion_insumos WHERE presentacion_id = ? AND insumo_id = ?`,
        [presentacionId, item.insumo_id]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE presentacion_insumos SET activo = 1, cantidad_por_unidad = ? WHERE id = ?`,
          [item.cantidad_por_unidad, existing.id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO presentacion_insumos (presentacion_id, insumo_id, cantidad_por_unidad, activo)
           VALUES (?, ?, ?, 1)`,
          [presentacionId, item.insumo_id, item.cantidad_por_unidad]
        );
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Integración con Ventas
// ---------------------------------------------------------------------------

/**
 * Verifica el stock de insumos requerido para una lista de ítems de venta.
 * Retorna advertencias (NO lanza error): opción B — se puede vender igual.
 */
export async function checkStockInsumos(
  db: SQLiteDatabase,
  items: Array<{
    presentacion_id: number;
    cantidad: number;
  }>
): Promise<AdvertenciaStockInsumo[]> {
  const advertencias: AdvertenciaStockInsumo[] = [];
  const demandaPorInsumo = new Map<number, { nombre: string; unidad: string; requerido: number }>();

  for (const item of items) {
    const relaciones = await db.getAllAsync<any>(`
      SELECT
        pi.insumo_id,
        pi.cantidad_por_unidad,
        i.nombre,
        i.unidad
      FROM presentacion_insumos pi
      JOIN insumos i ON pi.insumo_id = i.id
      WHERE pi.presentacion_id = ? AND pi.activo = 1 AND i.activo = 1
    `, [item.presentacion_id]);

    for (const rel of relaciones) {
      const requerido = rel.cantidad_por_unidad * item.cantidad;
      const existing = demandaPorInsumo.get(rel.insumo_id);
      if (existing) {
        existing.requerido += requerido;
      } else {
        demandaPorInsumo.set(rel.insumo_id, {
          nombre: rel.nombre,
          unidad: rel.unidad,
          requerido,
        });
      }
    }
  }

  for (const [insumoId, demanda] of demandaPorInsumo) {
    const stockRow = await db.getFirstAsync<{ stock: number }>(
      `SELECT COALESCE(SUM(cantidad), 0) AS stock FROM movimientos_insumo WHERE insumo_id = ?`,
      [insumoId]
    );
    const stockActual = stockRow?.stock ?? 0;

    if (demanda.requerido > stockActual) {
      advertencias.push({
        insumo_nombre: `${demanda.nombre} (${demanda.unidad})`,
        stockActual,
        requerido: demanda.requerido,
        diferencia: demanda.requerido - stockActual,
      });
    }
  }

  return advertencias;
}

/**
 * Valida el stock de insumos para una lista de ítems y LANZA ERROR si alguno es insuficiente.
 * Diseñada para correr DENTRO de withTransactionAsync: si lanza, hace rollback automático.
 *
 * Acumula TODOS los insumos faltantes en un único mensaje antes de lanzar,
 * para que el usuario vea de golpe qué falta (no solo el primer faltante).
 *
 * Si una presentación no tiene insumos configurados, se omite silenciosamente.
 * (Panal u otras presentaciones sin relaciones en presentacion_insumos no bloquean.)
 */
export async function validarStockInsumosOThrow(
  db: SQLiteDatabase,
  items: Array<{
    presentacion_id: number;
    cantidad: number;
  }>
): Promise<void> {
  // Acumular demanda total por insumo_id en toda la venta
  const demandaPorInsumo = new Map<number, { nombre: string; unidad: string; requerido: number }>();

  for (const item of items) {
    const relaciones = await db.getAllAsync<any>(`
      SELECT
        pi.insumo_id,
        pi.cantidad_por_unidad,
        i.nombre,
        i.unidad
      FROM presentacion_insumos pi
      JOIN insumos i ON pi.insumo_id = i.id
      WHERE pi.presentacion_id = ? AND pi.activo = 1 AND i.activo = 1
    `, [item.presentacion_id]);

    for (const rel of relaciones) {
      const requerido = rel.cantidad_por_unidad * item.cantidad;
      const existing = demandaPorInsumo.get(rel.insumo_id);
      if (existing) {
        existing.requerido += requerido;
      } else {
        demandaPorInsumo.set(rel.insumo_id, {
          nombre: rel.nombre,
          unidad: rel.unidad,
          requerido,
        });
      }
    }
  }

  // Verificar stock real vs demanda y acumular faltantes
  const faltantes: string[] = [];

  for (const [insumoId, demanda] of demandaPorInsumo) {
    const stockRow = await db.getFirstAsync<{ stock: number }>(
      `SELECT COALESCE(SUM(cantidad), 0) AS stock FROM movimientos_insumo WHERE insumo_id = ?`,
      [insumoId]
    );
    const stockActual = stockRow?.stock ?? 0;

    if (demanda.requerido > stockActual) {
      faltantes.push(
        `• ${demanda.nombre}: disponible ${stockActual} ${demanda.unidad}, requerido ${demanda.requerido} ${demanda.unidad}`
      );
    }
  }

  // Si hay faltantes, lanzar un único error con todos listados
  if (faltantes.length > 0) {
    throw new Error(
      `Stock insuficiente de envases/insumos:\n${faltantes.join('\n')}`
    );
  }
}

/**
 * Descuenta los insumos necesarios al registrar ítems de una venta.
 * Debe llamarse DENTRO de withTransactionAsync.
 * Si una presentación no tiene insumos configurados, se omite silenciosamente.
 */
export async function descontarInsumosVenta(
  db: SQLiteDatabase,
  ventaId: number,
  items: Array<{
    presentacion_id: number;
    cantidad: number;
  }>,
  fecha: string
): Promise<void> {
  for (const item of items) {
    const relaciones = await db.getAllAsync<any>(`
      SELECT pi.insumo_id, pi.cantidad_por_unidad
      FROM presentacion_insumos pi
      WHERE pi.presentacion_id = ? AND pi.activo = 1
    `, [item.presentacion_id]);

    for (const rel of relaciones) {
      const cantidadDescontar = -(rel.cantidad_por_unidad * item.cantidad);
      await db.runAsync(
        `INSERT INTO movimientos_insumo (insumo_id, fecha, cantidad, tipo_origen, origen_id, notas)
         VALUES (?, ?, ?, 'venta_item', ?, ?)`,
        [rel.insumo_id, fecha, cantidadDescontar, ventaId, `Descuento por Venta #${ventaId}`]
      );
    }
  }
}

/**
 * Repone los insumos descontados al anular una venta.
 * Debe llamarse DENTRO de withTransactionAsync.
 */
export async function reponerInsumosAnulacion(
  db: SQLiteDatabase,
  ventaId: number,
  fecha: string
): Promise<void> {
  const movimientos = await db.getAllAsync<any>(
    `SELECT insumo_id, SUM(cantidad) AS total
     FROM movimientos_insumo
     WHERE tipo_origen = 'venta_item' AND origen_id = ?
     GROUP BY insumo_id`,
    [ventaId]
  );

  for (const mov of movimientos) {
    if (!mov.total || mov.total === 0) continue;
    const cantidadReponer = -mov.total; // total es negativo, lo positivizamos
    if (cantidadReponer <= 0) continue;

    await db.runAsync(
      `INSERT INTO movimientos_insumo (insumo_id, fecha, cantidad, tipo_origen, origen_id, notas)
       VALUES (?, ?, ?, 'anulacion_venta_item', ?, ?)`,
      [mov.insumo_id, fecha, cantidadReponer, ventaId, `Reposición por anulación de Venta #${ventaId}`]
    );
  }
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapRowToInsumo(r: any): Insumo {
  return {
    id: r.id,
    nombre: r.nombre,
    unidad: r.unidad,
    descripcion: r.descripcion ?? null,
    stock_minimo: r.stock_minimo ?? 0,
    activo: r.activo === 1 ? 1 : 0,
    creado_en: r.creado_en,
    stock_actual: r.stock_actual ?? 0,
  };
}

/**
 * Actualiza únicamente el stock mínimo de un insumo.
 */
export async function actualizarStockMinimoInsumo(
  db: SQLiteDatabase,
  id: number,
  minimo: number
): Promise<void> {
  if (minimo < 0) throw new Error('El stock mínimo no puede ser menor a 0.');
  await db.runAsync(
    `UPDATE insumos SET stock_minimo = ? WHERE id = ?`,
    [minimo, id]
  );
}

/**
 * Obtiene las alertas de stock para los insumos activos.
 */
export async function getAlertasInsumos(db: SQLiteDatabase): Promise<AlertaStock[]> {
  const insumos = await getInsumos(db);
  const alertas: AlertaStock[] = [];

  for (const insumo of insumos) {
    const min = insumo.stock_minimo ?? 0;
    const actual = insumo.stock_actual ?? 0;
    if (min > 0 && actual < min) {
      alertas.push({
        tipo: 'insumo',
        id: insumo.id,
        nombre: `${insumo.nombre} bajo`,
        disponible: actual,
        minimo: min,
        unidad: insumo.unidad,
      });
    }
  }

  return alertas;
}

function mapRowToMovimiento(r: any): MovimientoInsumo {
  return {
    id: r.id,
    insumo_id: r.insumo_id,
    fecha: r.fecha,
    cantidad: r.cantidad,
    tipo_origen: r.tipo_origen,
    origen_id: r.origen_id ?? null,
    notas: r.notas ?? null,
    creado_en: r.creado_en,
  };
}

function mapRowToPresentacionInsumo(r: any): PresentacionInsumo {
  return {
    id: r.id,
    presentacion_id: r.presentacion_id,
    insumo_id: r.insumo_id,
    cantidad_por_unidad: r.cantidad_por_unidad,
    activo: r.activo === 1 ? 1 : 0,
    insumo_nombre: r.insumo_nombre ?? undefined,
    insumo_unidad: r.insumo_unidad ?? undefined,
  };
}
