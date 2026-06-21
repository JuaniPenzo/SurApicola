// =============================================================================
// SurApícola — Hook de Gastos Operativos (Fase 3D)
// =============================================================================
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

interface UseGastosResult {
  gastos: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
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

  // ── Cargar Gastos ──────────────────────────────────────────────────────────
  const fetchGastos = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getGastosOperativos(db, search);
      setGastos(res);
    } catch (err) {
      console.error('[useGastos] Error al obtener gastos:', err);
      setError('No se pudieron cargar los gastos. Intentá de nuevo.');
      setGastos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  useEffect(() => {
    fetchGastos();
  }, [fetchGastos]);

  const refresh = useCallback(async () => {
    await fetchGastos(true);
  }, [fetchGastos]);

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
    refresh,
    crearGasto,
    registrarPago,
    anularGasto,
  };
}
