// =============================================================================
// SurApícola — Consultas y Transacciones de Compras (Fase 3C)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { getStockActual } from './stock';
import type { EstadoCompra, MedioPago } from '../types';

export interface ItemCompraInput {
  tipo_stock: 'miel' | 'panal' | 'insumo';
  insumo_id?: number | null;
  cantidad: number;
  costo_unitario_centavos: number;
  subtotal_centavos: number;
}

export interface CrearCompraInput {
  proveedor_id: number;
  fecha: string;
  total_centavos: number;
  notas: string | null;
  monto_pagado: number; // Pago inicial opcional
  medio_pago: MedioPago | null;
  notas_pago: string | null;
  tipo_stock?: 'miel' | 'panal' | 'insumo'; // Legacy
  cantidad?: number; // Legacy
  insumo_id?: number | null; // Legacy
  items?: ItemCompraInput[]; // New
}

export interface RegistrarPagoInput {
  monto_centavos: number;
  medio_pago: MedioPago;
  fecha: string;
  notas: string | null;
}

/**
 * Obtiene la lista de compras recientes.
 * Permite buscar por nombre de proveedor.
 * Calcula mediante subconsulta el monto acumulado de pagos activos.
 */
export async function getComprasProveedor(
  db: SQLiteDatabase,
  search?: string
): Promise<any[]> {
  const term = search && search.trim().length > 0 ? `%${search.trim()}%` : null;

  const query = `
    SELECT 
      c.id,
      c.proveedor_id,
      p.nombre AS proveedor_nombre,
      c.fecha,
      c.tipo_stock,
      c.cantidad,
      c.total_centavos,
      c.estado,
      c.notas,
      c.anulada,
      COALESCE((
        SELECT SUM(pa.monto_centavos) 
        FROM pagos_proveedor pa 
        WHERE pa.compra_id = c.id AND pa.anulado = 0
      ), 0) AS pagado_centavos
    FROM compras_proveedor c
    JOIN proveedores p ON c.proveedor_id = p.id
    WHERE 1=1
      ${term ? 'AND p.nombre LIKE ?' : ''}
    ORDER BY c.fecha DESC, c.id DESC
    LIMIT 150
  `;

  if (term) {
    return await db.getAllAsync<any>(query, [term]);
  }
  return await db.getAllAsync<any>(query);
}

/**
 * Obtiene el detalle de una compra específica, con su proveedor y sus abonos.
 */
export async function getCompraById(
  db: SQLiteDatabase,
  id: number
): Promise<any | null> {
  const compra = await db.getFirstAsync<any>(
    `SELECT c.*, p.nombre AS proveedor_nombre 
     FROM compras_proveedor c 
     JOIN proveedores p ON c.proveedor_id = p.id 
     WHERE c.id = ?`,
    [id]
  );
  if (!compra) return null;

  const pagos = await db.getAllAsync<any>(
    `SELECT * FROM pagos_proveedor WHERE compra_id = ? AND anulado = 0`,
    [id]
  );

  let items = await db.getAllAsync<any>(
    `SELECT i.*, ins.nombre AS insumo_nombre 
     FROM items_compra_proveedor i
     LEFT JOIN insumos ins ON i.insumo_id = ins.id
     WHERE i.compra_proveedor_id = ?`,
    [id]
  );

  // Si no hay ítems en la tabla items_compra_proveedor (compra legada), generamos un ítem virtual
  if (items.length === 0 && compra.tipo_stock !== 'mixto') {
    let insumoNombre: string | null = null;
    if (compra.insumo_id) {
      const insumo = await db.getFirstAsync<{ nombre: string }>(
        'SELECT nombre FROM insumos WHERE id = ?',
        [compra.insumo_id]
      );
      insumoNombre = insumo?.nombre ?? null;
    }
    items = [{
      id: 0,
      compra_id: compra.id,
      tipo_stock: compra.tipo_stock,
      insumo_id: compra.insumo_id,
      cantidad: compra.cantidad,
      costo_unitario_centavos: compra.cantidad > 0 ? Math.round(compra.total_centavos / compra.cantidad) : 0,
      subtotal_centavos: compra.total_centavos,
      insumo_nombre: insumoNombre,
    }];
  }

  return {
    ...compra,
    pagos,
    items,
  };
}

/**
 * Crea una compra de manera transaccional:
 * 1. Valida que el proveedor exista y esté activo.
 * 2. Inserta la compra.
 * 3. Genera una entrada de stock para cada ítem.
 * 4. Inserta el pago inicial si corresponde y calcula el estado.
 */
export async function crearCompraConPago(
  db: SQLiteDatabase,
  input: CrearCompraInput
): Promise<void> {
  // Validar proveedor activo
  const proveedor = await db.getFirstAsync<any>(
    'SELECT activo FROM proveedores WHERE id = ?',
    [input.proveedor_id]
  );
  if (!proveedor) throw new Error('Proveedor no encontrado.');
  if (proveedor.activo !== 1) throw new Error('El proveedor seleccionado no está activo.');

  // Determinar los ítems a guardar
  const items: ItemCompraInput[] = input.items && input.items.length > 0 
    ? input.items 
    : [{
        tipo_stock: input.tipo_stock || 'miel',
        insumo_id: input.insumo_id ?? null,
        cantidad: input.cantidad || 0,
        costo_unitario_centavos: input.cantidad ? Math.round(input.total_centavos / input.cantidad) : 0,
        subtotal_centavos: input.total_centavos
      }];

  await db.withTransactionAsync(async () => {
    // Calcular estado inicial
    let estadoInicial: EstadoCompra = 'pendiente';
    if (input.monto_pagado > 0) {
      estadoInicial = input.monto_pagado === input.total_centavos ? 'pagada' : 'parcial';
    }

    // Determinar valores para cabecera de compra
    let mainTipoStock: string = 'mixto';
    let mainCantidad: number = 0;
    let mainInsumoId: number | null = null;

    if (items.length === 1) {
      mainTipoStock = items[0].tipo_stock;
      mainCantidad = items[0].cantidad;
      mainInsumoId = items[0].insumo_id ?? null;
    }

    // Para evitar violar la restricción CHECK(gramos_comprados > 0) al comprar panal, usamos 1 como dummy.
    const gramosComprados = mainTipoStock === 'miel' ? mainCantidad : 1;

    // 1. Insertar Compra
    const resCompra = await db.runAsync(
      `INSERT INTO compras_proveedor (proveedor_id, fecha, gramos_comprados, total_centavos, estado, tipo_stock, cantidad, notas, anulada, insumo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        input.proveedor_id,
        input.fecha,
        gramosComprados,
        input.total_centavos,
        estadoInicial,
        mainTipoStock,
        mainCantidad,
        input.notas,
        mainInsumoId,
      ]
    );
    const compraId = resCompra.lastInsertRowId;

    // 2. Registrar cada ítem de la compra
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO items_compra_proveedor (compra_proveedor_id, tipo_stock, insumo_id, cantidad, costo_unitario_centavos, subtotal_centavos)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          compraId,
          item.tipo_stock,
          item.insumo_id ?? null,
          item.cantidad,
          item.costo_unitario_centavos,
          item.subtotal_centavos
        ]
      );

      // 3. Generar entrada de stock correspondiente
      if (item.tipo_stock === 'miel' || item.tipo_stock === 'panal') {
        await db.runAsync(
          `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
           VALUES (?, ?, 'compra', ?, ?, ?)`,
          [
            item.tipo_stock,
            item.cantidad, // positivo = entrada
            compraId,
            input.fecha,
            `Compra #${compraId} de ${item.tipo_stock} a proveedor`,
          ]
        );
      } else if (item.tipo_stock === 'insumo' && item.insumo_id) {
        await db.runAsync(
          `INSERT INTO movimientos_insumo (insumo_id, fecha, cantidad, tipo_origen, origen_id, notas)
           VALUES (?, ?, ?, 'compra_insumo', ?, ?)`,
          [
            item.insumo_id,
            input.fecha,
            item.cantidad, // positivo = entrada
            compraId,
            input.notas || `Compra #${compraId} de insumos a proveedor`,
          ]
        );
      }
    }

    // 4. Registrar Pago Inicial (si corresponde)
    if (input.monto_pagado > 0 && input.medio_pago) {
      await db.runAsync(
        `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [
          input.proveedor_id,
          compraId,
          input.fecha,
          input.monto_pagado,
          input.medio_pago,
          input.notas_pago || 'Pago inicial registrado al crear compra',
        ]
      );
    }
  });
}

/**
 * Registra un pago posterior sobre una compra existente.
 * Actualiza el estado de la compra.
 */
export async function registrarPagoProveedor(
  db: SQLiteDatabase,
  compraId: number,
  input: RegistrarPagoInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    // 1. Obtener la compra y el acumulado de pagos
    const compra = await db.getFirstAsync<any>(
      'SELECT total_centavos, proveedor_id, estado, anulada FROM compras_proveedor WHERE id = ?',
      [compraId]
    );
    if (!compra) throw new Error('Compra no encontrada.');
    if (compra.anulada === 1) throw new Error('No se pueden registrar pagos en compras anuladas.');

    const activePayments = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_proveedor WHERE compra_id = ? AND anulado = 0',
      [compraId]
    );

    const saldoPendiente = compra.total_centavos - (activePayments?.total ?? 0);
    if (input.monto_centavos > saldoPendiente) {
      throw new Error(`El pago excede el saldo pendiente. Pendiente: $${saldoPendiente / 100} ARS.`);
    }

    // 2. Insertar pago
    await db.runAsync(
      `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [compra.proveedor_id, compraId, input.fecha, input.monto_centavos, input.medio_pago, input.notas]
    );

    // 3. Recalcular y actualizar estado de la compra
    const totalPagado = (activePayments?.total ?? 0) + input.monto_centavos;
    const nuevoEstado: EstadoCompra = totalPagado === compra.total_centavos ? 'pagada' : 'parcial';

    await db.runAsync(
      'UPDATE compras_proveedor SET estado = ? WHERE id = ?',
      [nuevoEstado, compraId]
    );
  });
}

/**
 * Anula una compra existente:
 * 1. Comprueba que el stock actual sea suficiente para retirar la cantidad comprada.
 * 2. Genera un movimiento compensatorio de salida en movimientos_stock.
 * 3. Marca los pagos asociados como anulados.
 * 4. Actualiza el estado de la compra a anulada.
 */
export async function anularCompraProveedor(
  db: SQLiteDatabase,
  compraId: number
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const compra = await db.getFirstAsync<any>(
      'SELECT estado, tipo_stock, cantidad, anulada, insumo_id, total_centavos FROM compras_proveedor WHERE id = ?',
      [compraId]
    );
    if (!compra) throw new Error('Compra no encontrada.');
    if (compra.anulada === 1) throw new Error('La compra ya se encuentra anulada.');

    // Obtener los ítems de esta compra
    let items = await db.getAllAsync<any>(
      `SELECT * FROM items_compra_proveedor WHERE compra_proveedor_id = ?`,
      [compraId]
    );

    // Fallback para compras legadas
    if (items.length === 0 && compra.tipo_stock !== 'mixto') {
      items = [{
        tipo_stock: compra.tipo_stock,
        insumo_id: compra.insumo_id,
        cantidad: compra.cantidad,
        costo_unitario_centavos: compra.cantidad > 0 ? Math.round(compra.total_centavos / compra.cantidad) : 0,
        subtotal_centavos: compra.total_centavos,
      }];
    }

    // 1. Validar stock para cada ítem (no puede quedar negativo)
    const currentStock = await getStockActual(db);
    
    // Para insumos, acumulamos cantidades requeridas
    const insumosADevolver: Record<number, number> = {};
    let mielADevolver = 0;
    let panalADevolver = 0;

    for (const item of items) {
      if (item.tipo_stock === 'miel') {
        mielADevolver += item.cantidad;
      } else if (item.tipo_stock === 'panal') {
        panalADevolver += item.cantidad;
      } else if (item.tipo_stock === 'insumo' && item.insumo_id) {
        insumosADevolver[item.insumo_id] = (insumosADevolver[item.insumo_id] || 0) + item.cantidad;
      }
    }

    if (mielADevolver > 0 && currentStock.mielGramos < mielADevolver) {
      const disponibleKg = currentStock.mielGramos / 1000;
      const devKg = mielADevolver / 1000;
      throw new Error(`No se puede anular la compra: el stock de miel quedaría negativo. Disponible: ${disponibleKg} kg, requerido para devolver: ${devKg} kg.`);
    }

    if (panalADevolver > 0 && currentStock.panalUnidades < panalADevolver) {
      throw new Error(`No se puede anular la compra: el stock de panal quedaría negativo. Disponible: ${currentStock.panalUnidades} unidades, requerido para devolver: ${panalADevolver} unidades.`);
    }

    for (const [insumoIdStr, cantRequerida] of Object.entries(insumosADevolver)) {
      const insumoId = parseInt(insumoIdStr, 10);
      const insumoRow = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_insumo WHERE insumo_id = ?`,
        [insumoId]
      );
      const stockInsumo = insumoRow?.total ?? 0;
      if (stockInsumo < cantRequerida) {
        const insumoInfo = await db.getFirstAsync<{ nombre: string }>(
          `SELECT nombre FROM insumos WHERE id = ?`,
          [insumoId]
        );
        throw new Error(`No se puede anular la compra: el stock del insumo "${insumoInfo?.nombre || insumoId}" quedaría negativo. Disponible: ${stockInsumo}, requerido para devolver: ${cantRequerida}.`);
      }
    }

    // 2. Insertar movimiento compensatorio de salida
    for (const item of items) {
      if (item.tipo_stock === 'miel' || item.tipo_stock === 'panal') {
        await db.runAsync(
          `INSERT INTO movimientos_stock (tipo_stock, cantidad, tipo_origen, origen_id, fecha, notas)
           VALUES (?, ?, 'anulacion_compra', ?, DATE('now', 'localtime'), ?)`,
          [
            item.tipo_stock,
            -item.cantidad, // negativo = salida
            compraId,
            `Salida por anulación de Compra #${compraId}`,
          ]
        );
      } else if (item.tipo_stock === 'insumo' && item.insumo_id) {
        await db.runAsync(
          `INSERT INTO movimientos_insumo (insumo_id, fecha, cantidad, tipo_origen, origen_id, notas)
           VALUES (?, DATE('now', 'localtime'), ?, 'ajuste_salida', ?, ?)`,
          [
            item.insumo_id,
            -item.cantidad, // negativo = salida
            compraId,
            `Salida por anulación de Compra #${compraId}`,
          ]
        );
      }
    }

    // 3. Anular pagos asociados
    await db.runAsync(
      "UPDATE pagos_proveedor SET anulado = 1, motivo_anulacion = 'Compra anulada por el usuario' WHERE compra_id = ?",
      [compraId]
    );

    // 4. Actualizar estado de la compra
    await db.runAsync(
      "UPDATE compras_proveedor SET estado = 'anulada', anulada = 1, motivo_anulacion = 'Anulación del usuario' WHERE id = ?",
      [compraId]
    );
  });
}
