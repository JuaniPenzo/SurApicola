// =============================================================================
// SurApícola — Consultas y Transacciones de Cosechas y Pérdidas (Fase 4)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStockActual } from './stock';
import type { TipoStock } from '../types';

export interface RegistrarCosechaInput {
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number; // en gramos para miel, unidades para panal
  notas: string | null;
}

export interface RegistrarPerdidaInput {
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number; // en gramos para miel, unidades para panal
  motivo: string;
  notas: string | null;
}

/**
 * Obtiene el listado unificado de cosechas y pérdidas ordenado cronológicamente.
 * Permite filtrar por tipo de stock, notas, motivo o tipo de operación.
 */
export async function getCosechasYPerdidas(
  db: SQLiteDatabase,
  search?: string
): Promise<any[]> {
  const term = search && search.trim().length > 0 ? `%${search.trim()}%` : null;

  const query = `
    SELECT * FROM (
      SELECT 
        'cosecha' AS tipo_operacion,
        id,
        fecha,
        tipo_stock,
        cantidad,
        notas,
        anulado,
        motivo_anulacion,
        NULL AS motivo,
        creado_en
      FROM registros_cosecha
      
      UNION ALL
      
      SELECT 
        'perdida' AS tipo_operacion,
        id,
        fecha,
        tipo_stock,
        cantidad,
        notas,
        anulado,
        motivo_anulacion,
        motivo,
        creado_en
      FROM registros_perdida
    )
    WHERE 1=1
      ${term ? 'AND (notas LIKE ? OR motivo LIKE ? OR tipo_stock LIKE ? OR tipo_operacion LIKE ?)' : ''}
    ORDER BY fecha DESC, id DESC
  `;

  if (term) {
    return await db.getAllAsync<any>(query, [term, term, term, term]);
  }
  return await db.getAllAsync<any>(query);
}

/**
 * Registra una cosecha propia de miel o panal.
 * 1. Inserta la cosecha en registros_cosecha.
 * 2. Inserta la entrada de stock positiva en movimientos_stock.
 */
export async function registrarCosecha(
  db: SQLiteDatabase,
  input: RegistrarCosechaInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Insertar Cosecha
    const res = await db.runAsync(
      `INSERT INTO registros_cosecha (fecha, tipo_stock, cantidad, notas, anulado)
       VALUES (?, ?, ?, ?, 0)`,
      [input.fecha, input.tipo_stock, input.cantidad, input.notas]
    );
    const cosechaId = res.lastInsertRowId;

    // 2. Insertar Movimiento de Stock
    await db.runAsync(
      `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
       VALUES (?, ?, 'cosecha', ?, ?, ?)`,
      [
        input.tipo_stock,
        input.cantidad, // positivo = entrada
        cosechaId,
        input.fecha,
        `Cosecha propia #${cosechaId}`,
      ]
    );
  });
}

/**
 * Registra una pérdida o merma física de miel o panal.
 * 1. Valida que haya stock suficiente para retirar la cantidad perdida (evita stock negativo).
 * 2. Inserta la pérdida en registros_perdida.
 * 3. Inserta la salida de stock negativa en movimientos_stock.
 */
export async function registrarPerdida(
  db: SQLiteDatabase,
  input: RegistrarPerdidaInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Validar stock suficiente
    const currentStock = await getStockActual(db);
    if (input.tipo_stock === 'miel') {
      if (currentStock.mielGramos < input.cantidad) {
        const disponibleKg = currentStock.mielGramos / 1000;
        const perdidaKg = input.cantidad / 1000;
        throw new Error(`Stock insuficiente para registrar pérdida de miel. Disponible: ${disponibleKg} kg, requerido: ${perdidaKg} kg.`);
      }
    } else if (input.tipo_stock === 'panal') {
      if (currentStock.panalUnidades < input.cantidad) {
        throw new Error(`Stock insuficiente para registrar pérdida de panal. Disponible: ${currentStock.panalUnidades} unidades, requerido: ${input.cantidad} unidades.`);
      }
    }

    // 2. Insertar Pérdida
    const res = await db.runAsync(
      `INSERT INTO registros_perdida (fecha, tipo_stock, cantidad, motivo, notas, anulado)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [input.fecha, input.tipo_stock, input.cantidad, input.motivo, input.notas]
    );
    const perdidaId = res.lastInsertRowId;

    // 3. Insertar Movimiento de Stock (salida = valor negativo)
    await db.runAsync(
      `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
       VALUES (?, ?, 'perdida', ?, ?, ?)`,
      [
        input.tipo_stock,
        -input.cantidad, // negativo = salida
        perdidaId,
        input.fecha,
        `Pérdida/Merma #${perdidaId}: ${input.motivo}`,
      ]
    );
  });
}

/**
 * Anula una cosecha propia registrada:
 * 1. Valida que no esté ya anulada.
 * 2. Valida que el stock disponible actual permita retirar los gramos/unidades cosechados originalmente.
 * 3. Marca la cosecha como anulada.
 * 4. Inserta un movimiento compensatorio de salida (negativo) en movimientos_stock.
 */
export async function anularCosecha(
  db: SQLiteDatabase,
  cosechaId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const cosecha = await db.getFirstAsync<any>(
      'SELECT tipo_stock, cantidad, anulado FROM registros_cosecha WHERE id = ?',
      [cosechaId]
    );
    if (!cosecha) throw new Error('Registro de cosecha no encontrado.');
    if (cosecha.anulado === 1) throw new Error('Esta cosecha ya se encuentra anulada.');

    // 2. Validar que al retirar esta cosecha el stock no quede negativo
    const currentStock = await getStockActual(db);
    if (cosecha.tipo_stock === 'miel') {
      if (currentStock.mielGramos < cosecha.cantidad) {
        const disponibleKg = currentStock.mielGramos / 1000;
        const cosechaKg = cosecha.cantidad / 1000;
        throw new Error(`No se puede anular la cosecha: el stock de miel quedaría negativo. Disponible: ${disponibleKg} kg, requerido para retirar: ${cosechaKg} kg.`);
      }
    } else if (cosecha.tipo_stock === 'panal') {
      if (currentStock.panalUnidades < cosecha.cantidad) {
        throw new Error(`No se puede anular la cosecha: el stock de panal quedaría negativo. Disponible: ${currentStock.panalUnidades} unidades, requerido para retirar: ${cosecha.cantidad} unidades.`);
      }
    }

    // 3. Marcar Cosecha como anulada
    await db.runAsync(
      `UPDATE registros_cosecha 
       SET anulado = 1, motivo_anulacion = 'Anulado por usuario' 
       WHERE id = ?`,
      [cosechaId]
    );

    // 4. Insertar Movimiento compensatorio de salida
    await db.runAsync(
      `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
       VALUES (?, ?, 'anulacion_cosecha', ?, DATE('now', 'localtime'), ?)`,
      [
        cosecha.tipo_stock,
        -cosecha.cantidad, // salida
        cosechaId,
        `Salida compensatoria por anulación de Cosecha #${cosechaId}`,
      ]
    );
  });
}

/**
 * Anula una pérdida registrada:
 * 1. Valida que no esté ya anulada.
 * 2. Marca la pérdida como anulada.
 * 3. Inserta un movimiento compensatorio de entrada (positivo) en movimientos_stock.
 */
export async function anularPerdida(
  db: SQLiteDatabase,
  perdidaId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const perdida = await db.getFirstAsync<any>(
      'SELECT tipo_stock, cantidad, anulado FROM registros_perdida WHERE id = ?',
      [perdidaId]
    );
    if (!perdida) throw new Error('Registro de pérdida no encontrado.');
    if (perdida.anulado === 1) throw new Error('Esta pérdida ya se encuentra anulada.');

    // 2. Marcar pérdida como anulada
    await db.runAsync(
      `UPDATE registros_perdida 
       SET anulado = 1, motivo_anulacion = 'Anulado por usuario' 
       WHERE id = ?`,
      [perdidaId]
    );

    // 3. Insertar Movimiento compensatorio de entrada (positivo para devolver el stock)
    await db.runAsync(
      `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
       VALUES (?, ?, 'anulacion_perdida', ?, DATE('now', 'localtime'), ?)`,
      [
        perdida.tipo_stock,
        perdida.cantidad, // entrada
        perdidaId,
        `Entrada compensatoria por anulación de Pérdida #${perdidaId}`,
      ]
    );
  });
}
