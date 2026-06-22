import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getStockActual, getMovimientosStock } from '../database/stock';
import type { StockActual, MovimientoStockUI } from '../types';
import { obtenerFechaLocalYMD, obtenerFechasRango, RangoFiltro } from '../utils/fechas';

interface UseStockResult {
  stock: StockActual | null;
  movimientos: MovimientoStockUI[];
  loading: boolean;
  error: string | null;
  rango: RangoFiltro;
  setRango: (r: RangoFiltro) => void;
  fechaDesde: string;
  fechaHasta: string;
  setCustomFechas: (desde: string, hasta: string) => void;
  refresh: () => Promise<void>;
}

const STOCK_VACIO: StockActual = {
  mielGramos: 0,
  panalUnidades: 0,
};

export function useStock(): UseStockResult {
  const db = useSQLiteContext();
  const [stock, setStock] = useState<StockActual | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoStockUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rango, setRango] = useState<RangoFiltro>('hoy');

  const hoyStr = obtenerFechaLocalYMD(new Date());
  const [fechaDesde, setFechaDesde] = useState<string>(hoyStr);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyStr);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let desde = '';
      let hasta = '';

      if (rango === 'entre_fechas') {
        desde = fechaDesde;
        hasta = fechaHasta;
      } else {
        const fechas = obtenerFechasRango(rango);
        desde = fechas.desde;
        hasta = fechas.hasta;
      }

      const stockRes = await getStockActual(db);
      const movimientosRes = await getMovimientosStock(db, desde, hasta);
      
      setStock(stockRes);
      setMovimientos(movimientosRes);
    } catch (err) {
      console.error('[useStock] Error al cargar stock:', err);
      setError('No se pudieron obtener los datos de stock. Intentá de nuevo.');
      setStock(STOCK_VACIO);
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  }, [db, rango, fechaDesde, fechaHasta]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setCustomFechas = useCallback((desde: string, hasta: string) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, []);

  return {
    stock,
    movimientos,
    loading,
    error,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
  };
}
