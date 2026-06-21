import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getReporteGeneral, obtenerFechasRango, obtenerFechaLocalYMD } from '../database/reportes';
import type { ReporteGeneral, RangoReporte } from '../types';

interface UseReportesResult {
  reporte: ReporteGeneral | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  rango: RangoReporte;
  setRango: (val: RangoReporte) => void;
  fechaDesde: string;
  fechaHasta: string;
  setCustomFechas: (desde: string, hasta: string) => void;
  refresh: () => Promise<void>;
}

export function useReportes(): UseReportesResult {
  const db = useSQLiteContext();
  const [reporte, setReporte] = useState<ReporteGeneral | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rango, setRango] = useState<RangoReporte>('mes');

  const hoyStr = obtenerFechaLocalYMD(new Date());
  const [fechaDesde, setFechaDesde] = useState<string>(hoyStr);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyStr);

  const fetchReporte = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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

      const res = await getReporteGeneral(db, desde, hasta);
      setReporte(res);
    } catch (err) {
      console.error('[useReportes] Error al generar reporte:', err);
      setError('No se pudo generar el reporte. Intentá de nuevo.');
      setReporte(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, rango, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchReporte();
  }, [fetchReporte]);

  const refresh = useCallback(async () => {
    await fetchReporte(true);
  }, [fetchReporte]);

  const setCustomFechas = useCallback((desde: string, hasta: string) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, []);

  return {
    reporte,
    loading,
    refreshing,
    error,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
  };
}
