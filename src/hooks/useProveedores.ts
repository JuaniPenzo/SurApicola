// =============================================================================
// SurApícola — Hook de Proveedores (Fase 3C)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getProveedoresActivos,
  crearProveedor as dbCrearProveedor,
  actualizarProveedor as dbActualizarProveedor,
  archivarProveedor as dbArchivarProveedor,
} from '../database/proveedores';
import type { Proveedor } from '../types';

interface UseProveedoresResult {
  proveedores: Proveedor[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
  refresh: () => Promise<void>;
  crear: (input: Omit<Proveedor, 'id' | 'activo' | 'creado_en'>) => Promise<void>;
  actualizar: (id: number, input: Partial<Omit<Proveedor, 'id' | 'creado_en'>>) => Promise<void>;
  archivar: (id: number) => Promise<void>;
}

export function useProveedores(): UseProveedoresResult {
  const db = useSQLiteContext();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Cargar Proveedores ─────────────────────────────────────────────────────
  const fetchProveedores = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getProveedoresActivos(db, search);
      setProveedores(res);
    } catch (err) {
      console.error('[useProveedores] Error al obtener proveedores:', err);
      setError('No se pudieron cargar los proveedores. Intentá de nuevo.');
      setProveedores([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const refresh = useCallback(async () => {
    await fetchProveedores(true);
  }, [fetchProveedores]);

  // ── Crear proveedor ────────────────────────────────────────────────────────
  const crear = useCallback(async (input: Omit<Proveedor, 'id' | 'activo' | 'creado_en'>) => {
    try {
      setError(null);
      await dbCrearProveedor(db, input);
      await fetchProveedores();
    } catch (err) {
      console.error('[useProveedores] Error al crear proveedor:', err);
      setError('No se pudo guardar el nuevo proveedor.');
      throw err;
    }
  }, [db, fetchProveedores]);

  // ── Actualizar proveedor ────────────────────────────────────────────────────
  const actualizar = useCallback(async (id: number, input: Partial<Omit<Proveedor, 'id' | 'creado_en'>>) => {
    try {
      setError(null);
      await dbActualizarProveedor(db, id, input);
      await fetchProveedores();
    } catch (err) {
      console.error('[useProveedores] Error al actualizar proveedor:', err);
      setError('No se pudieron guardar los cambios.');
      throw err;
    }
  }, [db, fetchProveedores]);

  // ── Archivar proveedor ──────────────────────────────────────────────────────
  const archivar = useCallback(async (id: number) => {
    try {
      setError(null);
      await dbArchivarProveedor(db, id);
      await fetchProveedores();
    } catch (err) {
      console.error('[useProveedores] Error al archivar proveedor:', err);
      setError('No se pudo archivar el proveedor.');
      throw err;
    }
  }, [db, fetchProveedores]);

  return {
    proveedores,
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
