import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getGastosOperativos,
  crearGastoConPago,
  registrarPagoGasto,
  anularGasto as dbAnularGasto,
  CrearGastoInput,
  RegistrarPagoGastoInput,
} from '../database/gastos';
import { obtenerFechaLocalYMD, obtenerFechasRango, RangoFiltro } from '../utils/fechas';

interface UseGastosResult {
  gastos: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
  rango: RangoFiltro;
  setRango: (r: RangoFiltro) => void;
  fechaDesde: string;
  fechaHasta: string;
  setCustomFechas: (desde: string, hasta: string) => void;
  refresh: () => Promise<void>;
  crearGasto: (input: CrearGastoInput) => Promise<void>;
  registrarPago: (gastoId: number, input: RegistrarPagoGastoInput) => Promise<void>;
  anularGasto: (gastoId: number) => Promise<void>;
}

export function useGastos(): UseGastosResult {
  const db = useSQLiteContext();
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rango, setRango] = useState<RangoFiltro>('hoy');

  const hoyStr = obtenerFechaLocalYMD(new Date());
  const [fechaDesde, setFechaDesde] = useState<string>(hoyStr);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyStr);

  // ── Cargar Gastos ──────────────────────────────────────────────────────────
  const fetchGastos = useCallback(async (isRefresh = false) => {
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

      const res = await getGastosOperativos(db, search, desde, hasta);
      setGastos(res);
    } catch (err) {
      console.error('[useGastos] Error al obtener gastos:', err);
      setError('No se pudieron cargar los gastos. Intentá de nuevo.');
      setGastos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search, rango, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const refresh = useCallback(async () => {
    await fetchGastos(true);
  }, [fetchGastos]);

  const setCustomFechas = useCallback((desde: string, hasta: string) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, []);

  // ── Crear Gasto ────────────────────────────────────────────────────────────
  const crearGasto = useCallback(async (input: CrearGastoInput) => {
    try {
      setError(null);
      await crearGastoConPago(db, input);
      await fetchGastos();
    } catch (err: any) {
      console.error('[useGastos] Error al crear gasto:', err);
      setError(err.message || 'No se pudo guardar el gasto.');
      throw err;
    }
  }, [db, fetchGastos]);

  // ── Registrar Pago posterior ───────────────────────────────────────────────
  const registrarPago = useCallback(async (gastoId: number, input: RegistrarPagoGastoInput) => {
    try {
      setError(null);
      await registrarPagoGasto(db, gastoId, input);
      await fetchGastos();
    } catch (err: any) {
      console.error('[useGastos] Error al registrar pago:', err);
      setError(err.message || 'No se pudo registrar el pago.');
      throw err;
    }
  }, [db, fetchGastos]);

  // ── Anular Gasto ───────────────────────────────────────────────────────────
  const anularGasto = useCallback(async (gastoId: number) => {
    try {
      setError(null);
      await dbAnularGasto(db, gastoId);
      await fetchGastos();
    } catch (err: any) {
      console.error('[useGastos] Error al anular gasto:', err);
      setError(err.message || 'No se pudo anular el gasto.');
      throw err;
    }
  }, [db, fetchGastos]);

  return {
    gastos,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    rango,
    setRango,
    fechaDesde,
    fechaHasta,
    setCustomFechas,
    refresh,
    crearGasto,
    registrarPago,
    anularGasto,
  };
}
