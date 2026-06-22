import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getVentas,
  crearVentaConItemsYCobro,
  registrarCobro as dbRegistrarCobro,
  anularVenta as dbAnularVenta,
  CrearVentaInput,
  RegistrarCobroInput,
} from '../database/ventas';
import { obtenerFechaLocalYMD, obtenerFechasRango, RangoFiltro } from '../utils/fechas';

interface UseVentasResult {
  ventas: any[];
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
  crearVenta: (input: CrearVentaInput) => Promise<void>;
  registrarCobro: (ventaId: number, input: RegistrarCobroInput) => Promise<void>;
  anularVenta: (ventaId: number) => Promise<void>;
}

export function useVentas(): UseVentasResult {
  const db = useSQLiteContext();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rango, setRango] = useState<RangoFiltro>('mes');

  const hoyStr = obtenerFechaLocalYMD(new Date());
  const [fechaDesde, setFechaDesde] = useState<string>(hoyStr);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyStr);

  // ── Cargar Ventas ──────────────────────────────────────────────────────────
  const fetchVentas = useCallback(async (isRefresh = false) => {
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

      const res = await getVentas(db, search, desde, hasta);
      setVentas(res);
    } catch (err) {
      console.error('[useVentas] Error al obtener ventas:', err);
      setError('No se pudieron cargar las ventas. Intentá de nuevo.');
      setVentas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search, rango, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  const refresh = useCallback(async () => {
    await fetchVentas(true);
  }, [fetchVentas]);

  const setCustomFechas = useCallback((desde: string, hasta: string) => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, []);

  // ── Crear Venta ────────────────────────────────────────────────────────────
  const crearVenta = useCallback(async (input: CrearVentaInput) => {
    try {
      setError(null);
      await crearVentaConItemsYCobro(db, input);
      await fetchVentas();
    } catch (err: any) {
      console.error('[useVentas] Error al crear venta:', err);
      setError(err.message || 'No se pudo registrar la venta.');
      throw err;
    }
  }, [db, fetchVentas]);

  // ── Registrar Cobro ────────────────────────────────────────────────────────
  const registrarCobro = useCallback(async (ventaId: number, input: RegistrarCobroInput) => {
    try {
      setError(null);
      await dbRegistrarCobro(db, ventaId, input);
      await fetchVentas();
    } catch (err: any) {
      console.error('[useVentas] Error al registrar cobro:', err);
      setError(err.message || 'No se pudo registrar el cobro.');
      throw err;
    }
  }, [db, fetchVentas]);

  // ── Anular Venta ───────────────────────────────────────────────────────────
  const anularVenta = useCallback(async (ventaId: number) => {
    try {
      setError(null);
      await dbAnularVenta(db, ventaId);
      await fetchVentas();
    } catch (err: any) {
      console.error('[useVentas] Error al anular venta:', err);
      setError(err.message || 'No se pudo anular la venta.');
      throw err;
    }
  }, [db, fetchVentas]);

  return {
    ventas,
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
    crearVenta,
    registrarCobro,
    anularVenta,
  };
}
