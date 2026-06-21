// =============================================================================
// SurApícola — Hook de Clientes (Fase 3A)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getClientesActivos,
  crearCliente as dbCrearCliente,
  actualizarCliente as dbActualizarCliente,
  archivarCliente as dbArchivarCliente,
} from '../database/clientes';
import type { Cliente } from '../types';

interface UseClientesResult {
  clientes: Cliente[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
  refresh: () => Promise<void>;
  crear: (input: Omit<Cliente, 'id' | 'activo' | 'creado_en'>) => Promise<void>;
  actualizar: (id: number, input: Partial<Omit<Cliente, 'id' | 'creado_en'>>) => Promise<void>;
  archivar: (id: number) => Promise<void>;
}

export function useClientes(): UseClientesResult {
  const db = useSQLiteContext();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Función principal para cargar clientes ─────────────────────────────────
  const fetchClientes = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getClientesActivos(db, search);
      setClientes(res);
    } catch (err) {
      console.error('[useClientes] Error al obtener clientes:', err);
      setError('No se pudieron cargar los clientes. Intentá de nuevo.');
      setClientes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  // Recargar al cambiar el término de búsqueda
  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const refresh = useCallback(async () => {
    await fetchClientes(true);
  }, [fetchClientes]);

  // ── Crear cliente ──────────────────────────────────────────────────────────
  const crear = useCallback(async (input: Omit<Cliente, 'id' | 'activo' | 'creado_en'>) => {
    try {
      setError(null);
      await dbCrearCliente(db, input);
      await fetchClientes();
    } catch (err) {
      console.error('[useClientes] Error al crear cliente:', err);
      setError('No se pudo guardar el nuevo cliente.');
      throw err;
    }
  }, [db, fetchClientes]);

  // ── Actualizar cliente ──────────────────────────────────────────────────────
  const actualizar = useCallback(async (id: number, input: Partial<Omit<Cliente, 'id' | 'creado_en'>>) => {
    try {
      setError(null);
      await dbActualizarCliente(db, id, input);
      await fetchClientes();
    } catch (err) {
      console.error('[useClientes] Error al actualizar cliente:', err);
      setError('No se pudieron guardar los cambios.');
      throw err;
    }
  }, [db, fetchClientes]);

  // ── Archivar cliente ────────────────────────────────────────────────────────
  const archivar = useCallback(async (id: number) => {
    try {
      setError(null);
      await dbArchivarCliente(db, id);
      await fetchClientes();
    } catch (err) {
      console.error('[useClientes] Error al archivar cliente:', err);
      setError('No se pudo archivar el cliente.');
      throw err;
    }
  }, [db, fetchClientes]);

  return {
    clientes,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    crear,
    actualizar,
    archivar,
  };
}
