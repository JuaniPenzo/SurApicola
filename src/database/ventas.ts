// =============================================================================
// SurApícola — Consultas y Transacciones de Ventas (Fase 3B)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStockActual } from './stock';
import { descontarInsumosVenta, reponerInsumosAnulacion, validarStockInsumosOThrow } from './insumos';
import type { EstadoVenta, MedioPago } from '../types';

export interface CrearVentaInput {
  cliente_id: number;
  categoria_precio_id: number | null;
  fecha: string;
  total_centavos: number;
  notas: string | null;
  items: Array<{
    presentacion_id: number;
    cantidad: number;
    precio_unitario_centavos: number;
    subtotal_centavos: number;
    codigo_snap: string;
    nombre_snap: string;
    tipo_snap: 'miel' | 'panal';
    gramos_por_unidad_snap: number;
    unidades_panal_por_unidad_snap: number;
  }>;
  monto_cobrado: number; // Cobro inicial opcional
  medio_cobro: MedioPago | null;
  notas_cobro: string | null;
}

export interface RegistrarCobroInput {
  monto_centavos: number;
  medio_pago: MedioPago;
  fecha: string;
  notas: string | null;
}

/**
 * Obtiene la lista de ventas recientes.
 * Permite buscar por nombre de cliente.
 * Retorna además el total cobrado acumulado para calcular saldo.
 */
export async function getVentas(
  db: SQLiteDatabase,
  search?: string
): Promise<any[]> {
  const term = search && search.trim().length > 0 ? `%${search.trim()}%` : null;

  const query = `
    SELECT 
      v.id,
      v.fecha,
      v.cliente_id,
      c.nombre AS cliente_nombre,
      v.total_centavos,
      v.estado,
      v.notas,
      v.creado_en,
      COALESCE((
        SELECT SUM(co.monto_centavos) 
        FROM cobros co 
        WHERE co.venta_id = v.id AND co.estado = 'activo'
      ), 0) AS cobrado_centavos
    FROM ventas v
    JOIN clientes c ON v.cliente_id = c.id
    WHERE 1=1
      ${term ? 'AND c.nombre LIKE ?' : ''}
    ORDER BY v.fecha DESC, v.id DESC
    LIMIT 150
  `;

  if (term) {
    return await db.getAllAsync<any>(query, [term]);
  }
  return await db.getAllAsync<any>(query);
}

/**
 * Obtiene el detalle completo de una venta, sus ítems y cobros asociados.
 */
export async function getVentaById(
  db: SQLiteDatabase,
  id: number
): Promise<any | null> {
  const venta = await db.getFirstAsync<any>(
    `SELECT v.*, c.nombre AS cliente_nombre 
     FROM ventas v 
     JOIN clientes c ON v.cliente_id = c.id 
     WHERE v.id = ?`,
    [id]
  );
  if (!venta) return null;

  const items = await db.getAllAsync<any>(
    `SELECT * FROM items_venta WHERE venta_id = ?`,
    [id]
  );

  const cobros = await db.getAllAsync<any>(
    `SELECT * FROM cobros WHERE venta_id = ? AND estado = 'activo'`,
    [id]
  );

  return {
    ...venta,
    items,
    cobros,
  };
}

/**
 * Crea una venta de manera transaccional y atómica en SQLite:
 * 1. Valida que el stock disponible sea suficiente.
 * 2. Inserta el registro principal de la venta.
 * 3. Inserta los ítems de venta.
 * 4. Genera salidas firmadas en movimientos_stock vinculadas a los ítems.
 * 5. Registra el cobro inicial si corresponde y calcula el estado final de la venta.
 */
export async function crearVentaConItemsYCobro(
  db: SQLiteDatabase,
  input: CrearVentaInput
): Promise<void> {
  // Validar campos obligatorios
  if (input.items.length === 0) {
    throw new Error('La venta debe tener al menos un ítem.');
  }

  // ── INICIO DE LA TRANSACCIÓN ───────────────────────────────────────────────
  await db.withTransactionAsync(async () => {
    // 1. Validar Stock Disponible
    const currentStock = await getStockActual(db);
    let mielDemandada = 0;
    let panalDemandado = 0;

    for (const item of input.items) {
      if (item.tipo_snap === 'miel') {
        mielDemandada += item.cantidad * item.gramos_por_unidad_snap;
      } else if (item.tipo_snap === 'panal') {
        panalDemandado += item.cantidad * item.unidades_panal_por_unidad_snap;
      }
    }

    if (mielDemandada > currentStock.mielGramos) {
      throw new Error(`Stock insuficiente de miel. Requerido: ${mielDemandada / 1000} kg. Disponible: ${currentStock.mielGramos / 1000} kg.`);
    }

    if (panalDemandado > currentStock.panalUnidades) {
      throw new Error(`Stock insuficiente de panal. Requerido: ${panalDemandado} unidades. Disponible: ${currentStock.panalUnidades} unidades.`);
    }

    // 1b. Validar stock de insumos/envases (HARD: bloquea y hace rollback si falta stock)
    // Si una presentación no tiene insumos configurados se omite silenciosamente.
    await validarStockInsumosOThrow(
      db,
      input.items.map((it) => ({ presentacion_id: it.presentacion_id, cantidad: it.cantidad }))
    );

    // Calcular estado inicial
    let estadoInicial: EstadoVenta = 'pendiente';
    if (input.monto_cobrado > 0) {
      estadoInicial = input.monto_cobrado === input.total_centavos ? 'pagada' : 'parcial';
    }

    // 2. Insertar Venta
    const resVenta = await db.runAsync(
      `INSERT INTO ventas (cliente_id, categoria_precio_id, fecha, total_centavos, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.cliente_id, input.categoria_precio_id, input.fecha, input.total_centavos, estadoInicial, input.notas]
    );
    const ventaId = resVenta.lastInsertRowId;

    // 3. Insertar Ítems y movimientos_stock
    for (const item of input.items) {
      const resItem = await db.runAsync(
        `INSERT INTO items_venta (
          venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, 
          codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          item.presentacion_id,
          item.cantidad,
          item.precio_unitario_centavos,
          item.subtotal_centavos,
          item.codigo_snap,
          item.nombre_snap,
          item.tipo_snap,
          item.gramos_por_unidad_snap,
          item.unidades_panal_por_unidad_snap,
        ]
      );
      const itemId = resItem.lastInsertRowId;

      // Calcular cantidad para el ledger (- cantidad * gramos/unidades)
      const cantMov =
        item.tipo_snap === 'miel'
          ? -(item.cantidad * item.gramos_por_unidad_snap)
          : -(item.cantidad * item.unidades_panal_por_unidad_snap);

      await db.runAsync(
        `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
         VALUES (?, ?, 'venta_item', ?, ?, ?)`,
        [item.tipo_snap, cantMov, itemId, input.fecha, `Venta #${ventaId} - Renglón #${itemId}`]
      );
    }

    // 4. Descuento de insumos/envases (stock ya validado en paso 1b — no puede haber negativos)
    await descontarInsumosVenta(
      db,
      ventaId,
      input.items.map((it) => ({ presentacion_id: it.presentacion_id, cantidad: it.cantidad })),
      input.fecha
    );

    // 5. Insertar Cobro Inicial (si corresponde)
    if (input.monto_cobrado > 0 && input.medio_cobro) {
      await db.runAsync(
        `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas)
         VALUES (?, ?, ?, ?, ?, 'activo', ?)`,
        [
          input.cliente_id,
          ventaId,
          input.fecha,
          input.monto_cobrado,
          input.medio_cobro,
          input.notas_cobro || 'Cobro inicial registrado al crear venta',
        ]
      );
    }
  });
}

/**
 * Registra un cobro a una venta existente.
 * Actualiza el estado de la venta transaccionalmente.
 */
export async function registrarCobro(
  db: SQLiteDatabase,
  ventaId: number,
  input: RegistrarCobroInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Obtener datos de la venta y cobros anteriores
    const venta = await db.getFirstAsync<any>(
      'SELECT total_centavos, cliente_id, estado FROM ventas WHERE id = ?',
      [ventaId]
    );
    if (!venta) throw new Error('Venta no encontrada.');
    if (venta.estado === 'anulada') throw new Error('No se pueden registrar cobros en ventas anuladas.');

    const activePayments = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM cobros WHERE venta_id = ? AND estado = "activo"',
      [ventaId]
    );

    const saldoPendiente = venta.total_centavos - (activePayments?.total ?? 0);
    if (input.monto_centavos > saldoPendiente) {
      throw new Error(`El monto excede el saldo pendiente. Pendiente: $${saldoPendiente / 100} ARS.`);
    }

    // 2. Insertar el cobro
    await db.runAsync(
      `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas)
       VALUES (?, ?, ?, ?, ?, 'activo', ?)`,
      [venta.cliente_id, ventaId, input.fecha, input.monto_centavos, input.medio_pago, input.notas]
    );

    // 3. Recalcular y actualizar estado de la venta
    const totalCobrado = (activePayments?.total ?? 0) + input.monto_centavos;
    const nuevoEstado: EstadoVenta = totalCobrado === venta.total_centavos ? 'pagada' : 'parcial';

    await db.runAsync(
      'UPDATE ventas SET estado = ? WHERE id = ?',
      [nuevoEstado, ventaId]
    );
  });
}

/**
 * Anula una venta de manera transaccional:
 * 1. Cambia el estado de la venta a 'anulada'.
 * 2. Genera ingresos de stock compensatorios (anulacion_venta_item) en movimientos_stock.
 * 3. Anula lógicamente todos los cobros activos vinculados a la venta.
 */
export async function anularVenta(
  db: SQLiteDatabase,
  ventaId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const venta = await db.getFirstAsync<any>(
      'SELECT estado, fecha FROM ventas WHERE id = ?',
      [ventaId]
    );
    if (!venta) throw new Error('Venta no encontrada.');
    if (venta.estado === 'anulada') return; // Ya anulada, omitir

    // 1. Obtener ítems para reponer stock
    const items = await db.getAllAsync<any>(
      'SELECT * FROM items_venta WHERE venta_id = ?',
      [ventaId]
    );

    for (const item of items) {
      const cantCompensar =
        item.tipo_snap === 'miel'
          ? (item.cantidad * item.gramos_por_unidad_snap)
          : (item.cantidad * item.unidades_panal_por_unidad_snap);

      await db.runAsync(
        `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
         VALUES (?, ?, 'anulacion_venta_item', ?, DATE('now', 'localtime'), ?)`,
        [item.tipo_snap, cantCompensar, item.id, `Devolución por anulación de Venta #${ventaId}`]
      );
    }

    // 3. Reponer insumos/envases descontados (reposición dentro de la misma transacción)
    const fechaHoy = new Date();
    const fechaLocal = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}-${String(fechaHoy.getDate()).padStart(2, '0')}`;
    await reponerInsumosAnulacion(db, ventaId, fechaLocal);

    // 4. Anular cobros asociados
    await db.runAsync(
      "UPDATE cobros SET estado = 'anulado', motivo_anulacion = 'Venta anulada por el usuario' WHERE venta_id = ?",
      [ventaId]
    );

    // 5. Anular venta
    await db.runAsync(
      "UPDATE ventas SET estado = 'anulada', motivo_anulacion = 'Anulación solicitada por el usuario' WHERE id = ?",
      [ventaId]
    );
  });
}
