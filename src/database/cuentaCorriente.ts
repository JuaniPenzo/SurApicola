// =============================================================================
// SurApícola — Consultas de Cuenta Corriente (Prompt 4)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CuentaClienteResumen,
  MovimientoCuentaCliente,
  CuentaProveedorResumen,
  MovimientoCuentaProveedor,
  MedioPago,
} from '../types';

/**
 * Obtiene el resumen de la cuenta corriente de un cliente.
 */
export async function getCuentaCliente(
  db: SQLiteDatabase,
  clienteId: number
): Promise<CuentaClienteResumen> {
  const client = await db.getFirstAsync<any>(
    'SELECT nombre, telefono, email FROM clientes WHERE id = ?',
    [clienteId]
  );
  if (!client) throw new Error('Cliente no encontrado');

  const ventas = await db.getFirstAsync<{ total: number; max_fecha: string }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total, MAX(fecha) AS max_fecha 
     FROM ventas 
     WHERE cliente_id = ? AND estado != 'anulada'`,
    [clienteId]
  );

  const cobros = await db.getFirstAsync<{ total: number; max_fecha: string }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total, MAX(fecha) AS max_fecha 
     FROM cobros 
     WHERE cliente_id = ? AND estado = 'activo'`,
    [clienteId]
  );

  const totalVendido = ventas?.total ?? 0;
  const totalCobrado = cobros?.total ?? 0;
  const saldoPendiente = totalVendido - totalCobrado;

  return {
    clienteId,
    nombre: client.nombre,
    telefono: client.telefono || null,
    email: client.email || null,
    totalVendido,
    totalCobrado,
    saldoPendiente,
    ultimaVentaFecha: ventas?.max_fecha || null,
    ultimoCobroFecha: cobros?.max_fecha || null,
  };
}

/**
 * Obtiene el listado de movimientos (ventas y cobros) de un cliente.
 */
export async function getMovimientosCuentaCliente(
  db: SQLiteDatabase,
  clienteId: number
): Promise<MovimientoCuentaCliente[]> {
  const query = `
    SELECT 
      id,
      'venta' AS tipo,
      fecha,
      'Venta #' || id AS descripcion,
      total_centavos AS monto,
      id AS referenciaId,
      estado,
      creado_en
    FROM ventas
    WHERE cliente_id = ? AND estado != 'anulada'

    UNION ALL

    SELECT 
      id,
      'cobro' AS tipo,
      fecha,
      'Cobro ' || medio_pago AS descripcion,
      monto_centavos AS monto,
      id AS referenciaId,
      estado,
      creado_en
    FROM cobros
    WHERE cliente_id = ? AND estado = 'activo'

    ORDER BY fecha DESC, creado_en DESC
  `;

  const rows = await db.getAllAsync<any>(query, [clienteId, clienteId]);
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo as 'venta' | 'cobro',
    fecha: r.fecha,
    descripcion: r.descripcion,
    monto: r.monto,
    referenciaId: r.referenciaId,
    estado: r.estado,
  }));
}

/**
 * Obtiene el resumen de la cuenta corriente de un proveedor.
 */
export async function getCuentaProveedor(
  db: SQLiteDatabase,
  proveedorId: number
): Promise<CuentaProveedorResumen> {
  const provider = await db.getFirstAsync<any>(
    'SELECT nombre, categoria, telefono, email FROM proveedores WHERE id = ?',
    [proveedorId]
  );
  if (!provider) throw new Error('Proveedor no encontrado');

  const compras = await db.getFirstAsync<{ total: number; max_fecha: string }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total, MAX(fecha) AS max_fecha 
     FROM compras_proveedor 
     WHERE proveedor_id = ? AND anulada = 0`,
    [proveedorId]
  );

  const pagos = await db.getFirstAsync<{ total: number; max_fecha: string }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total, MAX(fecha) AS max_fecha 
     FROM pagos_proveedor 
     WHERE proveedor_id = ? AND anulado = 0`,
    [proveedorId]
  );

  const totalComprado = compras?.total ?? 0;
  const totalPagado = pagos?.total ?? 0;
  const saldoPendiente = totalComprado - totalPagado;

  return {
    proveedorId,
    nombre: provider.nombre,
    categoria: provider.categoria,
    telefono: provider.telefono || null,
    email: provider.email || null,
    totalComprado,
    totalPagado,
    saldoPendiente,
    ultimaCompraFecha: compras?.max_fecha || null,
    ultimoPagoFecha: pagos?.max_fecha || null,
  };
}

/**
 * Obtiene el listado de movimientos (compras y pagos) de un proveedor.
 */
export async function getMovimientosCuentaProveedor(
  db: SQLiteDatabase,
  proveedorId: number
): Promise<MovimientoCuentaProveedor[]> {
  const query = `
    SELECT 
      c.id,
      'compra' AS tipo,
      c.fecha,
      CASE 
        WHEN c.tipo_stock = 'miel' THEN 'Compra Miel'
        WHEN c.tipo_stock = 'panal' THEN 'Compra Panal'
        WHEN c.tipo_stock = 'insumo' THEN COALESCE((
          SELECT 'Compra ' || i.nombre 
          FROM insumos i 
          WHERE i.id = c.insumo_id
        ), 'Compra Insumo')
        ELSE 'Compra Insumo'
      END AS descripcion,
      c.total_centavos AS monto,
      c.id AS referenciaId,
      c.estado,
      c.creado_en
    FROM compras_proveedor c
    WHERE c.proveedor_id = ? AND c.anulada = 0

    UNION ALL

    SELECT 
      p.id,
      'pago' AS tipo,
      p.fecha,
      'Pago ' || p.medio_pago AS descripcion,
      p.monto_centavos AS monto,
      p.id AS referenciaId,
      NULL AS estado,
      p.creado_en
    FROM pagos_proveedor p
    WHERE p.proveedor_id = ? AND p.anulado = 0

    ORDER BY fecha DESC, creado_en DESC
  `;

  const rows = await db.getAllAsync<any>(query, [proveedorId, proveedorId]);
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo as 'compra' | 'pago',
    fecha: r.fecha,
    descripcion: r.descripcion,
    monto: r.monto,
    referenciaId: r.referenciaId,
    estado: r.estado ?? undefined,
  }));
}

/**
 * Registra un cobro a cuenta de un cliente distribuyéndolo entre sus facturas pendientes más antiguas.
 */
export async function registrarCobroClienteDirecto(
  db: SQLiteDatabase,
  clienteId: number,
  montoCentavos: number,
  fecha: string,
  medioPago: MedioPago,
  notas: string | null
): Promise<void> {
  const resumen = await getCuentaCliente(db, clienteId);
  if (montoCentavos > resumen.saldoPendiente) {
    throw new Error(`El cobro excede el saldo pendiente. Pendiente: $${resumen.saldoPendiente / 100} ARS.`);
  }

  await db.withTransactionAsync(async () => {
    // Obtener las ventas pendientes y parciales ordenadas por fecha para abonarlas
    const sales = await db.getAllAsync<any>(
      `SELECT v.id, v.total_centavos, 
         COALESCE((SELECT SUM(c.monto_centavos) FROM cobros c WHERE c.venta_id = v.id AND c.estado = 'activo'), 0) AS cobrado
       FROM ventas v 
       WHERE v.cliente_id = ? AND v.estado IN ('pendiente', 'parcial') 
       ORDER BY v.fecha ASC, v.id ASC`,
      [clienteId]
    );

    let restante = montoCentavos;
    for (const sale of sales) {
      if (restante <= 0) break;
      const pendienteVenta = sale.total_centavos - sale.cobrado;
      if (pendienteVenta <= 0) continue;

      const aCobrar = Math.min(pendienteVenta, restante);

      // Registrar cobro para este item de venta
      await db.runAsync(
        `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas)
         VALUES (?, ?, ?, ?, ?, 'activo', ?)`,
        [clienteId, sale.id, fecha, aCobrar, medioPago, notas || 'Cobro registrado desde Cuenta Corriente']
      );

      // Actualizar estado de la venta
      const nuevoEstado = (sale.cobrado + aCobrar) === sale.total_centavos ? 'pagada' : 'parcial';
      await db.runAsync(
        'UPDATE ventas SET estado = ? WHERE id = ?',
        [nuevoEstado, sale.id]
      );

      restante -= aCobrar;
    }

    // Si hay un saldo residual se inserta a cuenta (venta_id = NULL)
    if (restante > 0) {
      await db.runAsync(
        `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas)
         VALUES (?, NULL, ?, ?, ?, 'activo', ?)`,
        [clienteId, fecha, restante, medioPago, notas || 'Cobro a cuenta registrado desde Cuenta Corriente']
      );
    }
  });
}

/**
 * Registra un pago a cuenta de un proveedor distribuyéndolo entre sus compras pendientes más antiguas.
 */
export async function registrarPagoProveedorDirecto(
  db: SQLiteDatabase,
  proveedorId: number,
  montoCentavos: number,
  fecha: string,
  medioPago: MedioPago,
  notas: string | null
): Promise<void> {
  const resumen = await getCuentaProveedor(db, proveedorId);
  if (montoCentavos > resumen.saldoPendiente) {
    throw new Error(`El pago excede el saldo pendiente. Pendiente: $${resumen.saldoPendiente / 100} ARS.`);
  }

  await db.withTransactionAsync(async () => {
    // Obtener las compras pendientes y parciales del proveedor
    const purchases = await db.getAllAsync<any>(
      `SELECT cp.id, cp.total_centavos, 
         COALESCE((SELECT SUM(pp.monto_centavos) FROM pagos_proveedor pp WHERE pp.compra_id = cp.id AND pp.anulado = 0), 0) AS pagado
       FROM compras_proveedor cp
       WHERE cp.proveedor_id = ? AND cp.estado IN ('pendiente', 'parcial') AND cp.anulada = 0
       ORDER BY cp.fecha ASC, cp.id ASC`,
      [proveedorId]
    );

    let restante = montoCentavos;
    for (const purchase of purchases) {
      if (restante <= 0) break;
      const pendienteCompra = purchase.total_centavos - purchase.pagado;
      if (pendienteCompra <= 0) continue;

      const aPagar = Math.min(pendienteCompra, restante);

      // Registrar pago para esta compra
      await db.runAsync(
        `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [proveedorId, purchase.id, fecha, aPagar, medioPago, notas || 'Pago registrado desde Cuenta Corriente']
      );

      // Actualizar estado de la compra
      const nuevoEstado = (purchase.pagado + aPagar) === purchase.total_centavos ? 'pagada' : 'parcial';
      await db.runAsync(
        'UPDATE compras_proveedor SET estado = ? WHERE id = ?',
        [nuevoEstado, purchase.id]
      );

      restante -= aPagar;
    }

    // Si hay un saldo residual se inserta a cuenta (compra_id = NULL)
    if (restante > 0) {
      await db.runAsync(
        `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
         VALUES (?, NULL, ?, ?, ?, ?, 0)`,
        [proveedorId, fecha, restante, medioPago, notas || 'Pago a cuenta registrado desde Cuenta Corriente']
      );
    }
  });
}
