// =============================================================================
// SurApícola — Queries del Dashboard
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { DashboardData } from '../../types';

/**
 * Devuelve todos los KPIs de la pantalla de inicio en una sola función.
 * Cada query es independiente para facilitar el debugging.
 */
export async function getDashboardData(db: SQLiteDatabase): Promise<DashboardData> {
  // ── Stock de miel (gramos, firmado) ──────────────────────────────────────
  const stockMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
     FROM movimientos_stock
     WHERE tipo_stock = 'miel'`
  );

  // ── Stock de panal (unidades, firmado) ───────────────────────────────────
  const stockPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
     FROM movimientos_stock
     WHERE tipo_stock = 'panal'`
  );

  // ── Ventas del día (total en centavos, excluye anuladas) ─────────────────
  const ventasHoy = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total
     FROM ventas
     WHERE DATE(fecha) = DATE('now', 'localtime')
       AND estado != 'anulada'`
  );

  // ── Cobros del día (ingresos reales de caja) ─────────────────────────────
  const cobrosHoy = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(monto_centavos), 0) AS total
     FROM cobros
     WHERE DATE(fecha) = DATE('now', 'localtime')
       AND estado = 'activo'`
  );

  // ── Gastos del día (gastos operativos no anulados) ────────────────────────
  // NOTA IMPORTANTE: Esta métrica representa los GASTOS OPERATIVOS CARGADOS/DEVENGADOS
  // registrados el día de hoy (accrued expenses).
  // - NO representa los egresos reales de caja (dinero en efectivo/transferencia que salió hoy).
  // - NO incluye las compras de miel a proveedores (compras_proveedor) ni los pagos realizados
  //   a proveedores (pagos_proveedor).
  //
  // LÓGICA PARA FUTURA FASE (EGRESOS REALES DE CAJA):
  // Para obtener los egresos reales en caja del día en una fase posterior, se deberá calcular:
  //   SUM(monto_centavos) de pagos_gasto del día (no anulados)
  //   + SUM(monto_centavos) de pagos_proveedor del día (no anulados)
  const gastosHoy = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_centavos), 0) AS total
     FROM gastos_operativos
     WHERE DATE(fecha) = DATE('now', 'localtime')
       AND estado != 'anulado'`
  );

  return {
    stockMielGramos: stockMiel?.total ?? 0,
    stockPanalUnidades: stockPanal?.total ?? 0,
    ventasHoyCentavos: ventasHoy?.total ?? 0,
    cobrosHoyCentavos: cobrosHoy?.total ?? 0,
    gastosHoyCentavos: gastosHoy?.total ?? 0,
  };
}
