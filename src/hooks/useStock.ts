// =============================================================================
// SurApícola — Hook de Stock (Fase 2)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getStockActual, getMovimientosStock } from '../database/stock';
import type { StockActual, MovimientoStockUI } from '../types';

interface UseStockResult {
  stock: StockActual | null;
  movimientos: MovimientoStockUI[];
  loading: boolean;
  error: string | null;
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

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const stockRes = await getStockActual(db);
      const movimientosRes = await getMovimientosStock(db);
      
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
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stock, movimientos, loading, error, refresh };
}
