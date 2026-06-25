// =============================================================================
// SurApícola — Carga de Datos de Prueba para Desarrollo (Fase 6)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { runSeed } from './seed';

/**
 * Limpia todas las tablas transaccionales y de catálogo para reiniciar el estado.
 */
export async function limpiarDatosPrueba(db: SQLiteDatabase): Promise<void> {
  console.log('[DevSeed] Limpiando tablas...');
  await db.execAsync('PRAGMA foreign_keys = OFF');
  try {
    await db.execAsync('DELETE FROM cobros');
    await db.execAsync('DELETE FROM items_venta');
    await db.execAsync('DELETE FROM ventas');
    await db.execAsync('DELETE FROM pagos_proveedor');
    await db.execAsync('DELETE FROM compras_proveedor');
    await db.execAsync('DELETE FROM pagos_gasto');
    await db.execAsync('DELETE FROM gastos_operativos');
    await db.execAsync('DELETE FROM registros_cosecha');
    await db.execAsync('DELETE FROM registros_perdida');
    await db.execAsync('DELETE FROM movimientos_stock');
    await db.execAsync('DELETE FROM clientes');
    await db.execAsync('DELETE FROM proveedores');
    console.log('[DevSeed] Tablas limpiadas exitosamente.');
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Carga un conjunto de datos realista para pruebas en desarrollo.
 */
export async function cargarDatosPrueba(db: SQLiteDatabase): Promise<void> {
  // 1. Limpiar datos existentes
  await limpiarDatosPrueba(db);

  // 2. Ejecutar seed maestro para asegurar presentaciones y categorías de gasto
  await runSeed(db);

  console.log('[DevSeed] Cargando clientes...');
  // 3. Clientes (5)
  const clientes = [
    { nombre: 'Juan Pérez', telefono: '11-2345-6789', direccion: 'Av. Belgrano 1200', email: 'juan.perez@email.com', notas: 'Cliente minorista frecuente' },
    { nombre: 'María Rodríguez', telefono: '11-9876-5432', direccion: 'Calle Florida 450', email: 'maria.rod@email.com', notas: 'Paga siempre en efectivo' },
    { nombre: 'Cooperativa Apícola', telefono: '291-555-0192', direccion: 'Ruta 3 Km 680', email: 'contacto@coopapicola.com', notas: 'Cliente mayorista' },
    { nombre: 'Distribuidora Sur', telefono: '291-444-8833', direccion: 'Donado 300', email: 'ventas@distsur.com', notas: 'Entrega los días viernes' },
    { nombre: 'API SRL', telefono: '11-3333-2222', direccion: 'Rivadavia 4500', email: 'info@apisrl.com', notas: 'Comprador de panales' },
  ];

  const clienteIds: number[] = [];
  for (const c of clientes) {
    const res = await db.runAsync(
      `INSERT INTO clientes (nombre, telefono, direccion, email, notas, activo) VALUES (?, ?, ?, ?, ?, 1)`,
      [c.nombre, c.telefono, c.direccion, c.email, c.notas]
    );
    clienteIds.push(res.lastInsertRowId);
  }

  console.log('[DevSeed] Cargando proveedores...');
  // 4. Proveedores (3)
  const proveedores = [
    { nombre: 'Apicultura Del Norte', telefono: '381-123-4567', direccion: 'Ruta 9 Km 1200', email: 'ventas@apidelnorte.com', notas: 'Proveedor de tambores de miel y celdas' },
    { nombre: 'Envases Plásticos S.A.', telefono: '11-6666-5555', direccion: 'Parque Industrial Pilar', email: 'envases@plastico.com', notas: 'Proveedor de baldes y frascos' },
    { nombre: 'Combustibles Ruta 3', telefono: '291-777-6666', direccion: 'Ruta 3 Km 695', email: 'ruta3@combustibles.com', notas: 'Facturación mensual de gasoil' },
  ];

  const proveedorIds: number[] = [];
  for (const p of proveedores) {
    const res = await db.runAsync(
      `INSERT INTO proveedores (nombre, telefono, direccion, email, notas, activo) VALUES (?, ?, ?, ?, ?, 1)`,
      [p.nombre, p.telefono, p.direccion, p.email, p.notas]
    );
    proveedorIds.push(res.lastInsertRowId);
  }

  console.log('[DevSeed] Cargando cosechas y pérdidas...');
  // 5. Cosechas (3)
  // Cosecha 1: Miel - 500 kg (500000g) - 2026-06-01
  const cos1 = await db.runAsync(
    `INSERT INTO registros_cosecha (fecha, tipo_stock, cantidad, notas, anulado) VALUES ('2026-06-01', 'miel', 500000, 'Primera cosecha de primavera', 0)`
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-01', 'miel', 500000, 'cosecha', ?, 'Cosecha Primavera')`,
    [cos1.lastInsertRowId]
  );

  // Cosecha 2: Miel - 300 kg (300000g) - 2026-06-05
  const cos2 = await db.runAsync(
    `INSERT INTO registros_cosecha (fecha, tipo_stock, cantidad, notas, anulado) VALUES ('2026-06-05', 'miel', 300000, 'Cosecha de monte', 0)`
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-05', 'miel', 300000, 'cosecha', ?, 'Cosecha de monte')`,
    [cos2.lastInsertRowId]
  );

  // Cosecha 3: Panal - 120 unidades - 2026-06-10
  const cos3 = await db.runAsync(
    `INSERT INTO registros_cosecha (fecha, tipo_stock, cantidad, notas, anulado) VALUES ('2026-06-10', 'panal', 120, 'Extracción de panales sección A', 0)`
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-10', 'panal', 120, 'cosecha', ?, 'Extracción de panales')`,
    [cos3.lastInsertRowId]
  );

  // 6. Pérdidas (2)
  // Pérdida 1: Miel - 15 kg (15000g) - 2026-06-03
  const per1 = await db.runAsync(
    `INSERT INTO registros_perdida (fecha, tipo_stock, cantidad, motivo, notas, anulado) VALUES ('2026-06-03', 'miel', 15000, 'Rotura de balde', 'Caída al mover en depósito', 0)`
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-03', 'miel', -15000, 'perdida', ?, 'Pérdida: Rotura de balde')`,
    [per1.lastInsertRowId]
  );

  // Pérdida 2: Panal - 10 unidades - 2026-06-07
  const per2 = await db.runAsync(
    `INSERT INTO registros_perdida (fecha, tipo_stock, cantidad, motivo, notas, anulado) VALUES ('2026-06-07', 'panal', 10, 'Polilla', 'Panales inservibles por plaga', 0)`
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-07', 'panal', -10, 'perdida', ?, 'Pérdida: Daño por polilla')`,
    [per2.lastInsertRowId]
  );

  // Obtener presentaciones cargadas para registrar ventas consistentes
  const presList = await db.getAllAsync<any>('SELECT * FROM presentaciones');
  const getPresByCodigo = (codigo: string) => presList.find(p => p.codigo === codigo);

  const p1kg = getPresByCodigo('FRASCO_1KG');
  const p500g = getPresByCodigo('FRASCO_500G');
  const p30kg = getPresByCodigo('BALDE_30KG');
  const p250g = getPresByCodigo('FRASCO_250G');
  const pPanal = getPresByCodigo('PANAL_UNIDAD');

  console.log('[DevSeed] Cargando ventas...');
  // 7. Ventas (5)
  // Venta 1: Pendiente - Cliente: Juan Pérez - $80.000 - 2026-06-11
  const v1 = await db.runAsync(
    `INSERT INTO ventas (cliente_id, fecha, total_centavos, estado, notas) VALUES (?, '2026-06-11', 8000000, 'pendiente', 'Se entrega con factura en cuenta corriente')`,
    [clienteIds[0]]
  );
  if (p1kg) {
    await db.runAsync(
      `INSERT INTO items_venta (venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap)
       VALUES (?, ?, 10, 800000, 8000000, 'FRASCO_1KG', 'Frasco 1kg', 'miel', 1000, 0)`,
      [v1.lastInsertRowId, p1kg.id]
    );
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-11', 'miel', -10000, 'venta_item', ?, 'Venta de 10 Frascos 1kg')`,
      [v1.lastInsertRowId]
    );
  }

  // Venta 2: Parcial - Cliente: María Rodríguez - $90.000 - 2026-06-12 (Cobrado $40.000)
  const v2 = await db.runAsync(
    `INSERT INTO ventas (cliente_id, fecha, total_centavos, estado, notas) VALUES (?, '2026-06-12', 9000000, 'parcial', 'Entrega a domicilio')`,
    [clienteIds[1]]
  );
  if (p500g) {
    await db.runAsync(
      `INSERT INTO items_venta (venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap)
       VALUES (?, ?, 20, 450000, 9000000, 'FRASCO_500G', 'Frasco 500g', 'miel', 500, 0)`,
      [v2.lastInsertRowId, p500g.id]
    );
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-12', 'miel', -10000, 'venta_item', ?, 'Venta de 20 Frascos 500g')`,
      [v2.lastInsertRowId]
    );
  }
  await db.runAsync(
    `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas) VALUES (?, ?, '2026-06-12', 4000000, 'efectivo', 'activo', 'Cobro inicial en efectivo')`,
    [clienteIds[1], v2.lastInsertRowId]
  );

  // Venta 3: Pagada - Cliente: Distribuidora Sur - $360.000 - 2026-06-13 (Cobrado $360.000)
  const v3 = await db.runAsync(
    `INSERT INTO ventas (cliente_id, fecha, total_centavos, estado, notas) VALUES (?, '2026-06-13', 36000000, 'pagada', 'Retira por depósito')`,
    [clienteIds[3]]
  );
  if (p30kg) {
    await db.runAsync(
      `INSERT INTO items_venta (venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap)
       VALUES (?, ?, 2, 18000000, 36000000, 'BALDE_30KG', 'Balde 30kg', 'miel', 30000, 0)`,
      [v3.lastInsertRowId, p30kg.id]
    );
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-13', 'miel', -60000, 'venta_item', ?, 'Venta de 2 Baldes 30kg')`,
      [v3.lastInsertRowId]
    );
  }
  await db.runAsync(
    `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas) VALUES (?, ?, '2026-06-13', 36000000, 'transferencia', 'activo', 'Pago completo de factura')`,
    [clienteIds[3], v3.lastInsertRowId]
  );

  // Venta 4: Anulada - Cliente: API SRL - $90.000 - 2026-06-14 (Cobrado $90.000, todo anulado)
  const v4 = await db.runAsync(
    `INSERT INTO ventas (cliente_id, fecha, total_centavos, estado, notas, motivo_anulacion) VALUES (?, '2026-06-14', 9000000, 'anulada', 'Pedido cancelado por el cliente', 'Error en pedido')`,
    [clienteIds[4]]
  );
  if (pPanal) {
    await db.runAsync(
      `INSERT INTO items_venta (venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap)
       VALUES (?, ?, 30, 300000, 9000000, 'PANAL_UNIDAD', 'Panal (unidad)', 'panal', 0, 1)`,
      [v4.lastInsertRowId, pPanal.id]
    );
    // Movimiento inicial negativo
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-14', 'panal', -30, 'venta_item', ?, 'Venta de 30 Panales (Anulada)')`,
      [v4.lastInsertRowId]
    );
    // Movimiento de devolución positivo
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-14', 'panal', 30, 'anulacion_venta_item', ?, 'Devolución: Venta anulada')`,
      [v4.lastInsertRowId]
    );
  }
  await db.runAsync(
    `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas, motivo_anulacion) VALUES (?, ?, '2026-06-14', 9000000, 'transferencia', 'anulado', 'Cobro devuelto', 'Venta anulada')`,
    [clienteIds[4], v4.lastInsertRowId]
  );

  // Venta 5: Pagada (anterior) - Cliente: Cooperativa Apícola - $125.000 - 2026-06-05
  const v5 = await db.runAsync(
    `INSERT INTO ventas (cliente_id, fecha, total_centavos, estado, notas) VALUES (?, '2026-06-05', 12500000, 'pagada', 'Venta al por mayor histórica')`,
    [clienteIds[2]]
  );
  if (p250g) {
    await db.runAsync(
      `INSERT INTO items_venta (venta_id, presentacion_id, cantidad, precio_unitario_centavos, subtotal_centavos, codigo_snap, nombre_snap, tipo_snap, gramos_por_unidad_snap, unidades_panal_por_unidad_snap)
       VALUES (?, ?, 50, 250000, 12500000, 'FRASCO_250G', 'Frasco 250g', 'miel', 250, 0)`,
      [v5.lastInsertRowId, p250g.id]
    );
    await db.runAsync(
      `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-05', 'miel', -12500, 'venta_item', ?, 'Venta de 50 Frascos 250g')`,
      [v5.lastInsertRowId]
    );
  }
  await db.runAsync(
    `INSERT INTO cobros (cliente_id, venta_id, fecha, monto_centavos, medio_pago, estado, notas) VALUES (?, ?, '2026-06-05', 12500000, 'transferencia', 'activo', 'Pago completo')`,
    [clienteIds[2], v5.lastInsertRowId]
  );

  console.log('[DevSeed] Cargando compras...');
  // 8. Compras (4)
  // Compra 1: Pendiente - Proveedor: Apicultura Del Norte - 150 kg miel - $250.000 - 2026-06-02
  const cp1 = await db.runAsync(
    `INSERT INTO compras_proveedor (proveedor_id, fecha, gramos_comprados, total_centavos, tipo_stock, cantidad, estado, notas, anulada)
     VALUES (?, '2026-06-02', 150000, 25000000, 'miel', 150000, 'pendiente', 'Adquisición de tambor de miel', 0)`,
    [proveedorIds[0]]
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-02', 'miel', 150000, 'compra', ?, 'Compra de stock')`,
    [cp1.lastInsertRowId]
  );

  // Compra 2: Parcial - Proveedor: Apicultura Del Norte - 50 panales - $60.000 - 2026-06-06 (Pagado $20.000)
  const cp2 = await db.runAsync(
    `INSERT INTO compras_proveedor (proveedor_id, fecha, gramos_comprados, total_centavos, tipo_stock, cantidad, estado, notas, anulada)
     VALUES (?, '2026-06-06', 1, 6000000, 'panal', 50, 'parcial', 'Panales para reventa (gramos_comprados=1 por legacy)', 0)`,
    [proveedorIds[0]]
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-06', 'panal', 50, 'compra', ?, 'Compra de stock')`,
    [cp2.lastInsertRowId]
  );
  await db.runAsync(
    `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, ?, '2026-06-06', 2000000, 'transferencia', 'Pago parcial inicial', 0)`,
    [proveedorIds[0], cp2.lastInsertRowId]
  );

  // Compra 3: Pagada - Proveedor: Envases Plásticos S.A. - 30 kg miel (ejemplo de compra) - $45.000 - 2026-06-08 (Pagado $45.000)
  const cp3 = await db.runAsync(
    `INSERT INTO compras_proveedor (proveedor_id, fecha, gramos_comprados, total_centavos, tipo_stock, cantidad, estado, notas, anulada)
     VALUES (?, '2026-06-08', 30000, 4500000, 'miel', 30000, 'pagada', 'Envases pre-llenados', 0)`,
    [proveedorIds[1]]
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-08', 'miel', 30000, 'compra', ?, 'Compra de stock')`,
    [cp3.lastInsertRowId]
  );
  await db.runAsync(
    `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, ?, '2026-06-08', 4500000, 'transferencia', 'Pago total', 0)`,
    [proveedorIds[1], cp3.lastInsertRowId]
  );

  // Compra 4: Anulada - Proveedor: Apicultura Del Norte - 20 panales - $24.000 - 2026-06-10 (Todo anulado)
  const cp4 = await db.runAsync(
    `INSERT INTO compras_proveedor (proveedor_id, fecha, gramos_comprados, total_centavos, tipo_stock, cantidad, estado, notas, anulada, motivo_anulacion)
     VALUES (?, '2026-06-10', 1, 2400000, 'panal', 20, 'anulada', 'Compra fallida por rotura', 1, 'Mercadería defectuosa')`,
    [proveedorIds[0]]
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-10', 'panal', 20, 'compra', ?, 'Compra de stock (Anulada)')`,
    [cp4.lastInsertRowId]
  );
  await db.runAsync(
    `INSERT INTO movimientos_stock (fecha, tipo_stock, cantidad, tipo_origen, origen_id, notas) VALUES ('2026-06-10', 'panal', -20, 'anulacion_compra', ?, 'Devolución de stock por anulación')`,
    [cp4.lastInsertRowId]
  );
  await db.runAsync(
    `INSERT INTO pagos_proveedor (proveedor_id, compra_id, fecha, monto_centavos, medio_pago, notas, anulado, motivo_anulacion)
     VALUES (?, ?, '2026-06-10', 2400000, 'transferencia', 'Pago inicial anulado', 1, 'Compra anulada')`,
    [proveedorIds[0], cp4.lastInsertRowId]
  );

  const catList = await db.getAllAsync<any>('SELECT * FROM categorias_gasto');
  const getCatId = (nombre: string) => catList.find(c => c.nombre === nombre)?.id || 1;

  console.log('[DevSeed] Cargando gastos operativos...');
  // 9. Gastos Operativos (5)
  // Gasto 1: Combustible - $18.000 - 2026-06-04 (Pagado completo)
  const g1 = await db.runAsync(
    `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas)
     VALUES (NULL, ?, '2026-06-04', 'Carga nafta camioneta', 1800000, 'pagado', 'Cargado para reparto zona centro')`,
    [getCatId('Combustible')]
  );
  await db.runAsync(
    `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, '2026-06-04', 1800000, 'efectivo', 'Pago efectivo chofer', 0)`,
    [g1.lastInsertRowId]
  );

  // Gasto 2: Flete - $35.000 - 2026-06-06 (Pagado completo)
  const g2 = await db.runAsync(
    `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas)
     VALUES (NULL, ?, '2026-06-06', 'Flete traslado colmenas', 3500000, 'pagado', 'Servicio de flete contratado')`,
    [getCatId('Flete')]
  );
  await db.runAsync(
    `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, '2026-06-06', 3500000, 'transferencia', 'Pago flete transferencia', 0)`,
    [g2.lastInsertRowId]
  );

  // Gasto 3: Alquiler - $8.500 - 2026-06-09 (Pagado completo)
  const g3 = await db.runAsync(
    `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas)
     VALUES (NULL, ?, '2026-06-09', 'Alquiler del galpón de extracción', 850000, 'pagado', 'Alquiler correspondiente a junio')`,
    [getCatId('Alquiler')]
  );
  await db.runAsync(
    `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, '2026-06-09', 850000, 'transferencia', 'Pago alquiler transferencia', 0)`,
    [g3.lastInsertRowId]
  );

  // Gasto 4: Mantenimiento - $25.000 - 2026-06-11 (Pagado completo)
  const g4 = await db.runAsync(
    `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas)
     VALUES (NULL, ?, '2026-06-11', 'Arreglo motor de centrífuga', 2500000, 'pagado', 'Trabajo del taller mecánico local')`,
    [getCatId('Mantenimiento')]
  );
  await db.runAsync(
    `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado)
     VALUES (?, '2026-06-11', 2500000, 'transferencia', 'Pago total a taller', 0)`,
    [g4.lastInsertRowId]
  );

  // Gasto 5: Servicios - $12.000 - 2026-06-12 (Anulado)
  const g5 = await db.runAsync(
    `INSERT INTO gastos_operativos (proveedor_id, categoria_id, fecha, descripcion, total_centavos, estado, notas, motivo_anulacion)
     VALUES (NULL, ?, '2026-06-12', 'Boleta de electricidad local', 1200000, 'anulado', 'Se cargó dos veces por error', 'Factura duplicada')`,
    [getCatId('Servicios')]
  );
  await db.runAsync(
    `INSERT INTO pagos_gasto (gasto_id, fecha, monto_centavos, medio_pago, notas, anulado, motivo_anulacion)
     VALUES (?, '2026-06-12', 1200000, 'transferencia', 'Pago de boleta duplicada', 1, 'Gasto anulado')`,
    [g5.lastInsertRowId]
  );

  console.log('[DevSeed] Carga de datos de prueba finalizada exitosamente.');
}
