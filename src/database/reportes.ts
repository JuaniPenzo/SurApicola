// =============================================================================
// SurApícola — Consultas de Reportes y Balances (Fase 5)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ReporteGeneral, RangoReporte } from '../types';

/**
 * Retorna un string YYYY-MM-DD en hora local de un objeto Date.
 */
export function obtenerFechaLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
}

/**
 * Calcula las fechas de inicio (desde) y fin (hasta) correspondientes a un rango predefinido.
 * Retorna strings en formato YYYY-MM-DD para usar como parámetros SQL (zona horaria local).
 */
export function obtenerFechasRango(rango: RangoReporte): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = obtenerFechaLocalYMD(hoy);
  let desde = hasta;

  switch (rango) {
    case 'hoy':
      desde = hasta;
      break;
    case 'semana': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const day = d.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
      const diffToMonday = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diffToMonday);
      desde = obtenerFechaLocalYMD(d);
      break;
    }
    case 'mes': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      desde = obtenerFechaLocalYMD(d);
      break;
    }
    case 'entre_fechas':
      desde = hasta;
      break;
  }

  return { desde, hasta };
}

/**
 * Recupera el reporte general unificado del negocio en base a un rango de fechas.
 * Ejecuta de forma segura todas las consultas requeridas sobre SQLite.
 */
export async function getReporteGeneral(
  db: SQLiteDatabase,
  desde: string,
  hasta: string
): Promise<ReporteGeneral> {
  // ── 1. Resumen Financiero ──
  const resVentasDev = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM ventas WHERE estado != 'anulada' AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const resCobrosReal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM cobros WHERE estado = 'activo' AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const resComprasDev = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM compras_proveedor WHERE anulada = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const resPagosProv = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_proveedor WHERE anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const resGastosDev = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total FROM gastos_operativos WHERE estado != 'anulado' AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const resPagosGasto = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total FROM pagos_gasto WHERE anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const ventasDevengadas = resVentasDev?.total ?? 0;
  const cobrosReales = resCobrosReal?.total ?? 0;
  const comprasDevengadas = resComprasDev?.total ?? 0;
  const pagosProveedoresReales = resPagosProv?.total ?? 0;
  const gastosDevengados = resGastosDev?.total ?? 0;
  const pagosGastosReales = resPagosGasto?.total ?? 0;

  const balanceCajaReal = cobrosReales - pagosProveedoresReales - pagosGastosReales;
  const resultadoOperativoDevengado = ventasDevengadas - comprasDevengadas - gastosDevengados;

  // ── 2. Resumen Ventas ──
  // SEMÁNTICA: 'total_cobrado' representa los cobros activos asociados a ventas creadas en el rango,
  // permitiendo calcular el saldo pendiente comercial específico de la facturación del período.
  const ventasStats = await db.getFirstAsync<any>(
    `SELECT 
       COUNT(DISTINCT v.id) AS cantidad,
       COALESCE(SUM(v.total_centavos), 0) AS total_vendido,
       COALESCE((
         SELECT SUM(c.monto_centavos) 
         FROM cobros c 
         JOIN ventas ve ON c.venta_id = ve.id 
         WHERE ve.estado != 'anulada' AND c.estado = 'activo' AND ve.fecha BETWEEN ? AND ?
       ), 0) AS total_cobrado
     FROM ventas v
     WHERE v.estado != 'anulada' AND v.fecha BETWEEN ? AND ?`,
    [desde, hasta, desde, hasta]
  );

  const cantVentas = ventasStats?.cantidad ?? 0;
  const totalVendido = ventasStats?.total_vendido ?? 0;
  const totalCobrado = ventasStats?.total_cobrado ?? 0;
  const ticketPromedio = cantVentas > 0 ? Math.round(totalVendido / cantVentas) : 0;

  const ultimaVenta = await db.getFirstAsync<{ fecha: string }>(
    `SELECT fecha FROM ventas WHERE estado != 'anulada' AND fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC LIMIT 1`,
    [desde, hasta]
  );

  // ── 3. Resumen Compras ──
  // SEMÁNTICA: 'total_pagado' representa los pagos activos asociados a compras creadas en el rango,
  // permitiendo calcular el saldo comercial adeudado específico de las compras del período.
  const comprasStats = await db.getFirstAsync<any>(
    `SELECT 
       COUNT(DISTINCT c.id) AS cantidad,
       COALESCE(SUM(c.total_centavos), 0) AS total_comprado,
       COALESCE((
         SELECT SUM(p.monto_centavos) 
         FROM pagos_proveedor p 
         JOIN compras_proveedor cp ON p.compra_id = cp.id 
         WHERE cp.anulada = 0 AND p.anulado = 0 AND cp.fecha BETWEEN ? AND ?
       ), 0) AS total_pagado
     FROM compras_proveedor c
     WHERE c.anulada = 0 AND c.fecha BETWEEN ? AND ?`,
    [desde, hasta, desde, hasta]
  );

  const cantCompras = comprasStats?.cantidad ?? 0;
  const totalComprado = comprasStats?.total_comprado ?? 0;
  const totalPagadoProv = comprasStats?.total_pagado ?? 0;

  const ultimaCompra = await db.getFirstAsync<{ fecha: string }>(
    `SELECT fecha FROM compras_proveedor WHERE anulada = 0 AND fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC LIMIT 1`,
    [desde, hasta]
  );

  // ── 4. Resumen Gastos ──
  // SEMÁNTICA: 'total_pagado' representa los abonos activos asociados a gastos creados en el rango,
  // permitiendo calcular el saldo adeudado de los gastos del período.
  const gastosStats = await db.getFirstAsync<any>(
    `SELECT 
       COUNT(DISTINCT g.id) AS cantidad,
       COALESCE(SUM(g.total_centavos), 0) AS total_devengado,
       COALESCE((
         SELECT SUM(pg.monto_centavos) 
         FROM pagos_gasto pg 
         JOIN gastos_operativos go ON pg.gasto_id = go.id 
         WHERE go.estado != 'anulado' AND pg.anulado = 0 AND go.fecha BETWEEN ? AND ?
       ), 0) AS total_pagado
     FROM gastos_operativos g
     WHERE g.estado != 'anulado' AND g.fecha BETWEEN ? AND ?`,
    [desde, hasta, desde, hasta]
  );

  const cantGastos = gastosStats?.cantidad ?? 0;
  const totalGastoDev = gastosStats?.total_devengado ?? 0;
  const totalGastoPag = gastosStats?.total_pagado ?? 0;

  const categoriasResumen = await db.getAllAsync<any>(
    `SELECT 
       c.nombre AS categoria,
       COALESCE(SUM(g.total_centavos), 0) AS total_centavos
     FROM gastos_operativos g
     JOIN categorias_gasto c ON g.categoria_id = c.id
     WHERE g.estado != 'anulado' AND g.fecha BETWEEN ? AND ?
     GROUP BY g.categoria_id
     ORDER BY total_centavos DESC
     LIMIT 5`,
    [desde, hasta]
  );

  // ── 5. Resumen Stock ──
  const stockMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'miel'`
  );
  const stockPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'panal'`
  );

  const entMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'miel' AND cantidad > 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const entPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'panal' AND cantidad > 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const salMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ABS(cantidad)), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'miel' AND cantidad < 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const salPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ABS(cantidad)), 0) AS total FROM movimientos_stock WHERE tipo_stock = 'panal' AND cantidad < 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const cosMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM registros_cosecha WHERE tipo_stock = 'miel' AND anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const cosPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM registros_cosecha WHERE tipo_stock = 'panal' AND anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );

  const perMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM registros_perdida WHERE tipo_stock = 'miel' AND anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );
  const perPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total FROM registros_perdida WHERE tipo_stock = 'panal' AND anulado = 0 AND fecha BETWEEN ? AND ?`,
    [desde, hasta]
  );

  return {
    financiero: {
      ventasDevengadas,
      cobrosReales,
      comprasDevengadas,
      pagosProveedoresReales,
      gastosDevengados,
      pagosGastosReales,
      balanceCajaReal,
      resultadoOperativoDevengado,
    },
    ventas: {
      cantidad: cantVentas,
      totalVendido,
      totalCobrado,
      saldoPendiente: totalVendido - totalCobrado,
      ticketPromedio,
      ventaMasReciente: ultimaVenta?.fecha || null,
    },
    compras: {
      cantidad: cantCompras,
      totalComprado,
      totalPagado: totalPagadoProv,
      saldoPendiente: totalComprado - totalPagadoProv,
      compraMasReciente: ultimaCompra?.fecha || null,
    },
    gastos: {
      cantidad: cantGastos,
      totalDevengado: totalGastoDev,
      totalPagado: totalGastoPag,
      saldoPendiente: totalGastoDev - totalGastoPag,
      categorias: categoriasResumen.map((c: any) => ({
        categoria: c.categoria,
        total_centavos: c.total_centavos,
      })),
    },
    stock: {
      stockMielActual: stockMiel?.total ?? 0,
      stockPanalActual: stockPanal?.total ?? 0,
      entradasMiel: entMiel?.total ?? 0,
      entradasPanal: entPanal?.total ?? 0,
      salidasMiel: salMiel?.total ?? 0,
      salidasPanal: salPanal?.total ?? 0,
      cosechasMiel: cosMiel?.total ?? 0,
      cosechasPanal: cosPanal?.total ?? 0,
      perdidasMiel: perMiel?.total ?? 0,
      perdidasPanal: perPanal?.total ?? 0,
    },
  };
}
