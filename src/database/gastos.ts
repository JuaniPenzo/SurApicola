// =============================================================================
// SurApícola — Consultas y Transacciones de Gastos Operativos (Fase 3D)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { GastoOperativo, PagoGasto, CategoriaGasto, EstadoGasto, MedioPago } from '../types';

export interface CrearGastoInput {
  categoria_id: number;
  proveedor_id: number | null;
  fecha: string;
  descripcion: string;
  total_centavos: number;
  notas: string | null;
  monto_pagado: number; // Pago inicial opcional
  medio_pago: MedioPago | null;
  notas_pago: string | null;
}

export interface RegistrarPagoGastoInput {
  monto_centavos: number;
  medio_pago: MedioPago;
  fecha: string;
  notas: string | null;
}

/**
 * Obtiene la lista de categorías de gasto activas para el formulario.
 */
export async function getCategoriasGasto(db: SQLiteDatabase): Promise<CategoriaGasto[]> {
  return await db.getAllAsync<CategoriaGasto>(
    'SELECT * FROM categorias_gasto WHERE activa = 1 ORDER BY nombre ASC'
  );
}

/**
 * Obtiene la lista de gastos operativos.
 * Permite buscar por descripción, notas de gasto, nombre de proveedor o nombre de categoría.
 * Calculates via subquery the sum of active payments.
 */
export async function getGastosOperativos(
  db: SQLiteDatabase,
  search?: string
): Promise<any[]> {
  const term = search && search.trim().length > 0 ? `%${search.trim()}%` : null;

  const query = `
    SELECT 
      g.id,
      g.categoria_id,
      g.proveedor_id,
      c.nombre AS categoria_nombre,
      p.nombre AS proveedor_nombre,
      g.fecha,
      g.descripcion,
      g.total_centavos,
      g.estado,
      g.notas,
      COALESCE((
        SELECT SUM(pg.monto_centavos) 
        FROM pagos_gasto pg 
        WHERE pg.gasto_id = g.id AND pg.anulado = 0
      ), 0) AS pagado_centavos
    FROM gastos_operativos g
    JOIN categorias_gasto c ON g.categoria_id = c.id
    LEFT JOIN proveedores p ON g.proveedor_id = p.id
    WHERE 1=1
      ${term ? 'AND (g.descripcion LIKE ? OR g.notas LIKE ? OR c.nombre LIKE ? OR p.nombre LIKE ?)' : ''}
    ORDER BY g.fecha DESC, g.id DESC
    LIMIT 150
  `;

  if (term) {
    return await db.getAllAsync<any>(query, [term, term, term, term]);
  }
  return await db.getAllAsync<any>(query);
}

/**
 * Obtiene el detalle de un gasto específico con su categoría, proveedor y abonos.
 */
export async function getGastoById(
  db: SQLiteDatabase,
  id: number
): Promise<any | null> {
  const gasto = await db.getFirstAsync<any>(
    `SELECT g.*, c.nombre AS categoria_nombre, p.nombre AS proveedor_nombre 
     FROM gastos_operativos g 
     JOIN categorias_gasto c ON g.categoria_id = c.id 
     LEFT JOIN proveedores p ON g.proveedor_id = p.id 
     WHERE g.id = ?`,
    [id]
  );
  if (!gasto) return null;

  const pagos = await db.getAllAsync<any>(
    `SELECT * FROM pagos_gasto WHERE gasto_id = ? AND anulado = 0 ORDER BY fecha DESC, id DESC`,
    [id]
  );

  return {
    ...gasto,
    pagos,
  };
}

/**
 * Crea un gasto operativo de manera transaccional:
 * 1. Valida que la categoría exista y esté activa.
 * 2. Valida que el proveedor exista (si se proporciona).
 * 3. Inserta el gasto.
 * 4. Inserta el pago inicial si corresponde y calcula el estado.
 */
export async function crearGastoConPago(
  db: SQLiteDatabase,
  input: CrearGastoInput
): Promise<void> {
  // Validar categoría activa
  const categoria = await db.getFirstAsync<any>(
    'SELECT activa FROM categorias_gasto WHERE id = ?',
    [input.categoria_id]
  );
  if (!categoria) throw new Error('Categoría de gasto no encontrada.');
  if (categoria.activa !== 1) throw new Error('La categoría seleccionada no está activa.');

  // Validar proveedor si se proporciona
  if (input.proveedor_id !== null) {
    const proveedor = await db.getFirstAsync<any>(
      'SELECT activo FROM proveedores WHERE id = ?',
      [input.proveedor_id]
    );
    if (!proveedor) throw new Error('Proveedor no encontrado.');
  }

  await db.withTransactionAsync(async () => {
    // Calcular estado inicial
    let estadoInicial: EstadoGasto = 'pendiente';
    if (input.monto_pagado > 0) {
      estadoInicial = input.monto_pagado === input.total_centavos ? 'pagado' : 'parcial';
    }

    // 1. Insertar Gasto
    const resGasto = await db.runAsync(
      `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.proveedor_id,
        input.categoria_id,
        input.fecha,
        input.descripcion,
        input.total_centavos,
        estadoInicial,
        input.notas,
      ]
    );
    const gastoId = resGasto.lastInsertRowId;

    // 2. Registrar Pago Inicial (si corresponde)
    if (input.monto_pagado > 0 && input.medio_pago) {
      await db.runAsync(
        `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [
          gastoId,
          input.fecha,
          input.monto_pagado,
          input.medio_pago,
          input.notas_pago || 'Pago inicial registrado al crear gasto',
        ]
      );
    }
  });
}

/**
 * Registra un pago posterior sobre un gasto existente.
 * Actualiza el estado del gasto.
 */
export async function registrarPagoGasto(
  db: SQLiteDatabase,
  gastoId: number,
  input: RegistrarPagoGastoInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Obtener el gasto y el acumulado de pagos
    const gasto = await db.getFirstAsync<any>(
      'SELECT total_centavos, estado FROM gastos_operativos WHERE id = ?',
      [gastoId]
    );
    if (!gasto) throw new Error('Gasto no encontrado.');
    if (gasto.estado === 'anulado') throw new Error('No se pueden registrar pagos en gastos anulados.');

    const activePayments = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_gasto WHERE gasto_id = ? AND anulado = 0',
      [gastoId]
    );

    const saldoPendiente = gasto.total_centavos - (activePayments?.total ?? 0);
    if (input.monto_centavos > saldoPendiente) {
      throw new Error(`El pago excede el saldo pendiente. Pendiente: $${saldoPendiente / 100} ARS.`);
    }

    // 2. Insertar pago
    await db.runAsync(
      `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [gastoId, input.fecha, input.monto_centavos, input.medio_pago, input.notas]
    );

    // 3. Recalcular y actualizar estado del gasto
    const totalPagado = (activePayments?.total ?? 0) + input.monto_centavos;
    const nuevoEstado: EstadoGasto = totalPagado === gasto.total_centavos ? 'pagado' : 'parcial';

    await db.runAsync(
      'UPDATE gastos_operativos SET estado = ? WHERE id = ?',
      [nuevoEstado, gastoId]
    );
  });
}

/**
 * Anula un gasto existente:
 * 1. Valida que no esté ya anulado.
 * 2. Marca los pagos asociados como anulados.
 * 3. Actualiza el estado del gasto a anulado.
 */
export async function anularGasto(
  db: SQLiteDatabase,
  gastoId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const gasto = await db.getFirstAsync<any>(
      'SELECT estado FROM gastos_operativos WHERE id = ?',
      [gastoId]
    );
    if (!gasto) throw new Error('Gasto no encontrado.');
    if (gasto.estado === 'anulado') throw new Error('El gasto ya se encuentra anulado.');

    // 1. Anular pagos asociados
    await db.runAsync(
      "UPDATE pagos_gasto SET anulado = 1, motivo_anulacion = 'Gasto anulado por el usuario' WHERE gasto_id = ?",
      [gastoId]
    );

    // 2. Actualizar estado del gasto
    await db.runAsync(
      "UPDATE gastos_operativos SET estado = 'anulado', motivo_anulacion = 'Anulación del usuario' WHERE id = ?",
      [gastoId]
    );
  });
}

/**
 * Obtiene todas las categorías de gasto (activas e inactivas).
 */
export async function getAllCategoriasGasto(db: SQLiteDatabase): Promise<CategoriaGasto[]> {
  return await db.getAllAsync<CategoriaGasto>(
    'SELECT * FROM categorias_gasto ORDER BY activa DESC, nombre ASC'
  );
}

/**
 * Crea una nueva categoría de gasto. Reactiva una existente si estaba inactiva.
 */
export async function crearCategoriaGasto(db: SQLiteDatabase, nombre: string): Promise<void> {
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error('El nombre de la categoría no puede estar vacío.');

  // Verificar si ya existe (activa o inactiva)
  const existe = await db.getFirstAsync<{ id: number; activa: number }>(
    'SELECT id, activa FROM categorias_gasto WHERE LOWER(nombre) = LOWER(?)',
    [trimmed]
  );

  if (existe) {
    if (existe.activa === 1) {
      throw new Error('Ya existe una categoría de gasto con ese nombre.');
    } else {
      // Si existía inactiva, la reactivamos
      await db.runAsync(
        'UPDATE categorias_gasto SET activa = 1 WHERE id = ?',
        [existe.id]
      );
      return;
    }
  }

  await db.runAsync(
    'INSERT INTO categorias_gasto (nombre, activa) VALUES (?, 1)',
    [trimmed]
  );
}

/**
 * Actualiza el nombre de una categoría de gasto existente.
 */
export async function actualizarCategoriaGasto(db: SQLiteDatabase, id: number, nombre: string): Promise<void> {
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error('El nombre de la categoría no puede estar vacío.');

  // Verificar si otra categoría ya tiene ese nombre
  const existe = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categorias_gasto WHERE LOWER(nombre) = LOWER(?) AND id != ?',
    [trimmed, id]
  );

  if (existe) {
    throw new Error('Ya existe otra categoría de gasto con ese nombre.');
  }

  await db.runAsync(
    'UPDATE categorias_gasto SET nombre = ? WHERE id = ?',
    [trimmed, id]
  );
}

/**
 * Activa o desactiva una categoría de gasto.
 */
export async function setCategoriaGastoActiva(db: SQLiteDatabase, id: number, activa: number): Promise<void> {
  await db.runAsync(
    'UPDATE categorias_gasto SET activa = ? WHERE id = ?',
    [activa, id]
  );
}

/**
 * Elimina o desactiva una categoría de gasto.
 * - Si la categoría nunca fue usada en gastos: la elimina físicamente.
 * - Si ya tiene gastos asociados: la desactiva (baja lógica) para proteger el histórico.
 * @returns 'eliminada' si fue borrada físicamente, 'desactivada' si fue dada de baja lógica.
 */
export async function eliminarODesactivarCategoriaGasto(
  db: SQLiteDatabase,
  id: number
): Promise<'eliminada' | 'desactivada'> {
  // Verificar si tiene gastos asociados
  const usoRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM gastos_operativos WHERE categoria_id = ?',
    [id]
  );
  const count = usoRow?.count ?? 0;

  if (count === 0) {
    // Sin uso histórico → borrado físico seguro
    await db.runAsync('DELETE FROM categorias_gasto WHERE id = ?', [id]);
    return 'eliminada';
  } else {
    // Con uso histórico → baja lógica para no romper reportes
    await db.runAsync('UPDATE categorias_gasto SET activa = 0 WHERE id = ?', [id]);
    return 'desactivada';
  }
}

