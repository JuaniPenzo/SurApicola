// =============================================================================
// SurApícola — Hook de Cosechas y Pérdidas de Stock (Fase 4)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getCosechasYPerdidas,
  registrarCosecha,
  registrarPerdida,
  anularCosecha as dbAnularCosecha,
  anularPerdida as dbAnularPerdida,
  RegistrarCosechaInput,
  RegistrarPerdidaInput,
} from '../database/stockOperaciones';

interface UseCosechasPerdidasResult {
  operaciones: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
  refresh: () => Promise<void>;
  crearCosecha: (input: RegistrarCosechaInput) => Promise<void>;
  crearPerdida: (input: RegistrarPerdidaInput) => Promise<void>;
  anularCosecha: (cosechaId: number) => Promise<void>;
  anularPerdida: (perdidaId: number) => Promise<void>;
}

export function useCosechasPerdidas(): UseCosechasPerdidasResult {
  const db = useSQLiteContext();
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Cargar Operaciones ─────────────────────────────────────────────────────
  const fetchOperaciones = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getCosechasYPerdidas(db, search);
      setOperaciones(res);
    } catch (err) {
      console.error('[useCosechasPerdidas] Error al obtener operaciones:', err);
      setError('No se pudieron cargar las operaciones de stock. Intentá de nuevo.');
      setOperaciones([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  useEffect(() => {
    fetchOperaciones();
  }, [fetchOperaciones]);

  const refresh = useCallback(async () => {
    await fetchOperaciones(true);
  }, [fetchOperaciones]);

  // ── Registrar Cosecha ──────────────────────────────────────────────────────
  const crearCosecha = useCallback(async (input: RegistrarCosechaInput) => {
    try {
      setError(null);
      await registrarCosecha(db, input);
      await fetchOperaciones();
    } catch (err: any) {
      console.error('[useCosechasPerdidas] Error al registrar cosecha:', err);
      setError(err.message || 'No se pudo registrar la cosecha.');
      throw err;
    }
  }, [db, fetchOperaciones]);

  // ── Registrar Pérdida ──────────────────────────────────────────────────────
  const crearPerdida = useCallback(async (input: RegistrarPerdidaInput) => {
    try {
      setError(null);
      await registrarPerdida(db, input);
      await fetchOperaciones();
    } catch (err: any) {
      console.error('[useCosechasPerdidas] Error al registrar pérdida:', err);
      setError(err.message || 'No se pudo registrar la pérdida.');
      throw err;
    }
  }, [db, fetchOperaciones]);

  // ── Anular Cosecha ─────────────────────────────────────────────────────────
  const anularCosecha = useCallback(async (cosechaId: number) => {
    try {
      setError(null);
      await dbAnularCosecha(db, cosechaId);
      await fetchOperaciones();
    } catch (err: any) {
      console.error('[useCosechasPerdidas] Error al anular cosecha:', err);
      setError(err.message || 'No se pudo anular la cosecha.');
      throw err;
    }
  }, [db, fetchOperaciones]);

  // ── Anular Pérdida ─────────────────────────────────────────────────────────
  const anularPerdida = useCallback(async (perdidaId: number) => {
    try {
      setError(null);
      await dbAnularPerdida(db, perdidaId);
      await fetchOperaciones();
    } catch (err: any) {
      console.error('[useCosechasPerdidas] Error al anular pérdida:', err);
      setError(err.message || 'No se pudo anular la pérdida.');
      throw err;
    }
  }, [db, fetchOperaciones]);

  return {
    operaciones,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    crearCosecha,
    crearPerdida,
    anularCosecha,
    anularPerdida,
  };
}
