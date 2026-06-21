import type { SQLiteDatabase } from 'expo-sqlite';
import type { ResumenNegocioExportable } from '../types';
import { getConfiguracion } from './configuracion';

/**
 * Escapa un campo individual para formato CSV.
 * Rodea el campo con comillas dobles y duplica las comillas dobles internas.
 */
function escapeCSVField(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Duplicar comillas internas
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exporta una tabla completa a formato CSV dinámicamente.
 * Usa el separador punto y coma (;) para mayor compatibilidad con Excel en español.
 * Detecta columnas de centavos y agrega automáticamente una columna de pesos al lado.
 */
export async function exportTableToCSV(
  db: SQLiteDatabase,
  tableName: string
): Promise<string> {
  // 1. Obtener la lista de columnas usando PRAGMA
  const columnsInfo = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`
  );
  const headers = columnsInfo.map((col) => col.name);

  if (headers.length === 0) {
    throw new Error(`La tabla '${tableName}' no existe o no tiene columnas.`);
  }

  // 2. Mapear columnas para detectar campos de tipo dinero
  const finalHeaders: string[] = [];
  const colMappings: { name: string; isMoney: boolean }[] = [];

  for (const h of headers) {
    finalHeaders.push(h);
    colMappings.push({ name: h, isMoney: false });

    // Si termina en _centavos o es monto/total de dinero, agregar columna equivalente en pesos
    if (
      h.endsWith('_centavos') ||
      h === 'monto_centavos' ||
      h === 'total_centavos' ||
      h === 'precio_unitario_centavos' ||
      h === 'subtotal_centavos'
    ) {
      const pesosName = h.replace('_centavos', '_pesos');
      finalHeaders.push(pesosName);
      colMappings.push({ name: h, isMoney: true });
    }
  }

  // 3. Consultar todas las filas
  const rows = await db.getAllAsync<Record<string, any>>(`SELECT * FROM ${tableName}`);

  // 4. Formatear
  const csvRows: string[] = [];
  // Encabezados
  csvRows.push(finalHeaders.map((h) => escapeCSVField(h)).join(';'));

  // Datos
  for (const row of rows) {
    const lineFields: string[] = [];
    for (const mapping of colMappings) {
      if (mapping.isMoney) {
        const centavos = row[mapping.name] ?? 0;
        const pesos = (centavos / 100).toFixed(2);
        lineFields.push(escapeCSVField(pesos));
      } else {
        lineFields.push(escapeCSVField(row[mapping.name]));
      }
    }
    csvRows.push(lineFields.join(';'));
  }

  return csvRows.join('\r\n');
}

/**
 * Obtiene los KPIs actuales del negocio para el resumen de exportación.
 */
export async function getResumenNegocioData(
  db: SQLiteDatabase
): Promise<ResumenNegocioExportable> {
  const nombre = await getConfiguracion(db, 'nombre_emprendimiento') ?? 'SurApícola';

  // Stock
  const stockMielRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'miel'`
  );
  const stockPanalRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'panal'`
  );
  const stockMielGramos = stockMielRow?.total ?? 0;
  const stockMielKg = stockMielGramos / 1000;
  const stockPanalUnidades = stockPanalRow?.total ?? 0;

  // Insumos bajo stock
  const bajoStockRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt 
     FROM insumos i 
     WHERE i.activo = 1 
       AND i.stock_minimo > 0 
       AND (SELECT COALESCE(SUM(cantidad), 0) FROM movimientos_insumo WHERE insumo_id = i.id) < i.stock_minimo`
  );
  const insumosBajoStockCount = bajoStockRow?.cnt ?? 0;

  // Clientes y Proveedores
  const clientesRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM clientes WHERE activo = 1`
  );
  const proveedoresRow = await db.getFirstAsync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM proveedores WHERE activo = 1`
  );
  const totalClientes = clientesRow?.cnt ?? 0;
  const totalProveedores = proveedoresRow?.cnt ?? 0;

  // Finanzas Ventas y Cobros
  const ventasRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM ventas WHERE estado != 'anulada'`
  );
  const cobrosRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM cobros WHERE estado = 'activo'`
  );
  const totalVendidoHistoricoCentavos = ventasRow?.total ?? 0;
  const totalCobradoHistoricoCentavos = cobrosRow?.total ?? 0;
  const deudaClientesTotalCentavos = Math.max(0, totalVendidoHistoricoCentavos - totalCobradoHistoricoCentavos);

  // Finanzas Compras y Pagos Proveedores
  const comprasRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM compras_proveedor WHERE anulada = 0`
  );
  const pagosProvRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_proveedor WHERE anulado = 0`
  );
  const totalCompradoHistoricoCentavos = comprasRow?.total ?? 0;
  const totalPagadoProveedoresCentavos = pagosProvRow?.total ?? 0;
  const deudaProveedoresTotalCentavos = Math.max(0, totalCompradoHistoricoCentavos - totalPagadoProveedoresCentavos);

  // Gastos
  const gastosRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM gastos_operativos WHERE estado != 'anulado'`
  );
  const pagosGastoRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_gasto WHERE anulado = 0`
  );
  const gastosTotalesCentavos = gastosRow?.total ?? 0;
  const totalPagadoGastosCentavos = pagosGastoRow?.total ?? 0;

  // Caja real: cobros - pagos a proveedores - pagos de gastos
  const cajaRealAproximadaCentavos = totalCobradoHistoricoCentavos - totalPagadoProveedoresCentavos - totalPagadoGastosCentavos;

  return {
    fechaExportacion: new Date().toISOString(),
    nombreEmprendimiento: nombre,
    stockMielKg,
    stockPanalUnidades,
    insumosBajoStockCount,
    totalClientes,
    totalProveedores,
    totalVendidoHistoricoCentavos,
    totalCobradoHistoricoCentavos,
    deudaClientesTotalCentavos,
    totalCompradoHistoricoCentavos,
    totalPagadoProveedoresCentavos,
    deudaProveedoresTotalCentavos,
    gastosTotalesCentavos,
    cajaRealAproximadaCentavos,
  };
}

/**
 * Genera el resumen general del negocio formateado como texto para ser exportado.
 */
export async function generarResumenNegocioTexto(db: SQLiteDatabase): Promise<string> {
  const data = await getResumenNegocioData(db);
  const fechaStr = new Date(data.fechaExportacion).toLocaleString('es-AR');

  const fmtMoneda = (centavos: number) => {
    const pesos = centavos / 100;
    return `$ ${pesos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return `==================================================
RESUMEN GENERAL DE NEGOCIO — SURAPÍCOLA
==================================================
Fecha de exportación : ${fechaStr}
Emprendimiento       : ${data.nombreEmprendimiento}

--------------------------------------------------
STOCK Y OPERACIONES
--------------------------------------------------
Stock actual de Miel  : ${data.stockMielKg.toFixed(2)} kg
Stock actual de Panal : ${data.stockPanalUnidades} unidades
Insumos con bajo stock: ${data.insumosBajoStockCount} insumo(s)

--------------------------------------------------
CLIENTES Y PROVEEDORES
--------------------------------------------------
Total clientes activos   : ${data.totalClientes}
Total proveedores activos: ${data.totalProveedores}

--------------------------------------------------
SITUACIÓN COMERCIAL Y FINANCIERA (HISTÓRICO)
--------------------------------------------------
Ventas totales (facturado): ${fmtMoneda(data.totalVendidoHistoricoCentavos)}
Cobros totales (ingresado): ${fmtMoneda(data.totalCobradoHistoricoCentavos)}
Saldo pendiente clientes  : ${fmtMoneda(data.deudaClientesTotalCentavos)}

Compras totales           : ${fmtMoneda(data.totalCompradoHistoricoCentavos)}
Pagos a proveedores       : ${fmtMoneda(data.totalPagadoProveedoresCentavos)}
Saldo pendiente proveed.  : ${fmtMoneda(data.deudaProveedoresTotalCentavos)}

Gastos operativos totales : ${fmtMoneda(data.gastosTotalesCentavos)}

--------------------------------------------------
CAJA Y BALANCES
--------------------------------------------------
Caja real aproximada      : ${fmtMoneda(data.cajaRealAproximadaCentavos)}
(Caja = Cobros - Pagos Proveedores - Pagos Gastos)
==================================================
`;
}
