// =============================================================================
// SurApícola — Hook de Ventas (Fase 3B)
// =============================================================================
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

interface UseVentasResult {
  ventas: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
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

  // ── Cargar Ventas ──────────────────────────────────────────────────────────
  const fetchVentas = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getVentas(db, search);
      setVentas(res);
    } catch (err) {
      console.error('[useVentas] Error al obtener ventas:', err);
      setError('No se pudieron cargar las ventas. Intentá de nuevo.');
      setVentas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  const refresh = useCallback(async () => {
    await fetchVentas(true);
  }, [fetchVentas]);

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
    refresh,
    crearVenta,
    registrarCobro,
    anularVenta,
  };
}
