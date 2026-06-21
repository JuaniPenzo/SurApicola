// =============================================================================
// SurApícola — Consultas de Stock (Fase 2)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { StockActual, MovimientoStockUI, EstadoOrigenStock, AlertaStock } from '../types';
import { getStockMinimoMiel, getStockMinimoPanal } from './configuracion';
import { getAlertasInsumos } from './insumos';

/**
 * Calcula el stock actual de miel (en gramos) y panal (en unidades) a partir
 * de la suma acumulada de movimientos de stock.
 *
 * Los movimientos anulados (como cancelaciones de venta o cosecha) ya tienen
 * movimientos compensatorios con signo opuesto en la tabla 'movimientos_stock',
 * por lo que el simple SUM de toda la tabla es matemáticamente correcto e idempotente.
 */
export async function getStockActual(db: SQLiteDatabase): Promise<StockActual> {
  const stockMiel = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
     FROM movimientos_stock
     WHERE tipo_stock = 'miel'`
  );

  const stockPanal = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
     FROM movimientos_stock
     WHERE tipo_stock = 'panal'`
  );

  return {
    mielGramos: stockMiel?.total ?? 0,
    panalUnidades: stockPanal?.total ?? 0,
  };
}

/**
 * Devuelve el historial completo de movimientos de stock ordenado de manera
 * cronológica descendente.
 *
 * Utiliza subconsultas para validar si la operación de origen fue anulada
 * (e.g. estado='anulada' en ventas, anulado=1 en cosechas/pérdidas, anulada=1 en compras).
 * También recupera metadatos adicionales como el nombre del producto vendido
 * o el motivo de pérdida para mayor descriptividad en la UI.
 */
export async function getMovimientosStock(db: SQLiteDatabase): Promise<MovimientoStockUI[]> {
  const query = `
    SELECT 
      m.id,
      m.fecha,
      m.tipo_stock AS producto,
      CASE WHEN m.cantidad > 0 THEN 'entrada' ELSE 'salida' END AS sentido,
      m.cantidad,
      m.tipo_origen AS origen_tipo,
      m.origen_id,
      m.notas AS nota,
      CASE 
        WHEN m.tipo_origen IN ('venta_item', 'anulacion_venta_item') THEN (
          SELECT CASE WHEN v.estado = 'anulada' THEN 'anulado' ELSE 'activo' END
          FROM ventas v 
          JOIN items_venta iv ON iv.venta_id = v.id 
          WHERE iv.id = m.origen_id
        )
        WHEN m.tipo_origen IN ('cosecha', 'anulacion_cosecha') THEN (
          SELECT CASE WHEN rc.anulado = 1 THEN 'anulado' ELSE 'activo' END 
          FROM registros_cosecha rc WHERE rc.id = m.origen_id
        )
        WHEN m.tipo_origen IN ('compra', 'anulacion_compra') THEN (
          SELECT CASE WHEN cp.anulada = 1 THEN 'anulado' ELSE 'activo' END 
          FROM compras_proveedor cp WHERE cp.id = m.origen_id
        )
        WHEN m.tipo_origen IN ('perdida', 'anulacion_perdida') THEN (
          SELECT CASE WHEN rp.anulado = 1 THEN 'anulado' ELSE 'activo' END 
          FROM registros_perdida rp WHERE rp.id = m.origen_id
        )
        ELSE 'activo'
      END AS estado_origen,
      CASE 
        WHEN m.tipo_origen IN ('venta_item', 'anulacion_venta_item') THEN (
          SELECT iv.nombre_snap FROM items_venta iv WHERE iv.id = m.origen_id
        )
        ELSE NULL
      END AS item_nombre,
      CASE 
        WHEN m.tipo_origen IN ('perdida', 'anulacion_perdida') THEN (
          SELECT rp.motivo FROM registros_perdida rp WHERE rp.id = m.origen_id
        )
        ELSE NULL
      END AS perdida_motivo
    FROM movimientos_stock m
    ORDER BY m.fecha DESC, m.id DESC
    LIMIT 150
  `;

  const rows = await db.getAllAsync<any>(query);

  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    producto: r.producto as 'miel' | 'panal',
    sentido: r.sentido as 'entrada' | 'salida',
    cantidad: r.cantidad,
    origen_tipo: r.origen_tipo,
    origen_id: r.origen_id,
    nota: r.nota,
    estado_origen: r.estado_origen as EstadoOrigenStock,
    item_nombre: r.item_nombre,
    perdida_motivo: r.perdida_motivo,
  }));
}

/**
 * Obtiene las alertas de stock para miel y panal basadas en la configuración.
 */
export async function getAlertasStock(db: SQLiteDatabase): Promise<AlertaStock[]> {
  const stock = await getStockActual(db);
  const minMiel = await getStockMinimoMiel(db);
  const minPanal = await getStockMinimoPanal(db);

  const alertas: AlertaStock[] = [];

  // Miel: stock en gramos, minMiel en gramos
  if (minMiel > 0 && stock.mielGramos < minMiel) {
    alertas.push({
      tipo: 'miel',
      nombre: 'Miel disponible baja',
      disponible: stock.mielGramos,
      minimo: minMiel,
      unidad: 'kg',
    });
  }

  // Panal: stock en unidades, minPanal en unidades
  if (minPanal > 0 && stock.panalUnidades < minPanal) {
    alertas.push({
      tipo: 'panal',
      nombre: 'Panal disponible bajo',
      disponible: stock.panalUnidades,
      minimo: minPanal,
      unidad: 'unidades',
    });
  }

  return alertas;
}

/**
 * Consolida todas las alertas de stock (miel, panal e insumos).
 */
export async function getResumenAlertasStock(db: SQLiteDatabase): Promise<AlertaStock[]> {
  const stockAlerts = await getAlertasStock(db);
  const insumoAlerts = await getAlertasInsumos(db);
  return [...stockAlerts, ...insumoAlerts];
}
