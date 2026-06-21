// =============================================================================
// SurApícola — Hook de Compras (Fase 3C)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getComprasProveedor,
  crearCompraConPago,
  registrarPagoProveedor,
  anularCompraProveedor,
  CrearCompraInput,
  RegistrarPagoInput,
} from '../database/compras';

interface UseComprasResult {
  compras: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  search: string;
  setSearch: (text: string) => void;
  refresh: () => Promise<void>;
  crearCompra: (input: CrearCompraInput) => Promise<void>;
  registrarPago: (compraId: number, input: RegistrarPagoInput) => Promise<void>;
  anularCompra: (compraId: number) => Promise<void>;
}

export function useCompras(): UseComprasResult {
  const db = useSQLiteContext();
  const [compras, setCompras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Cargar Compras ─────────────────────────────────────────────────────────
  const fetchCompras = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getComprasProveedor(db, search);
      setCompras(res);
    } catch (err) {
      console.error('[useCompras] Error al obtener compras:', err);
      setError('No se pudieron cargar las compras. Intentá de nuevo.');
      setCompras([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, search]);

  useEffect(() => {
    fetchCompras();
  }, [fetchCompras]);

  const refresh = useCallback(async () => {
    await fetchCompras(true);
  }, [fetchCompras]);

  // ── Crear Compra ───────────────────────────────────────────────────────────
  const crearCompra = useCallback(async (input: CrearCompraInput) => {
    try {
      setError(null);
      await crearCompraConPago(db, input);
      await fetchCompras();
    } catch (err: any) {
      console.error('[useCompras] Error al crear compra:', err);
      setError(err.message || 'No se pudo guardar la compra.');
      throw err;
    }
  }, [db, fetchCompras]);

  // ── Registrar Pago posterior ───────────────────────────────────────────────
  const registrarPago = useCallback(async (compraId: number, input: RegistrarPagoInput) => {
    try {
      setError(null);
      await registrarPagoProveedor(db, compraId, input);
      await fetchCompras();
    } catch (err: any) {
      console.error('[useCompras] Error al registrar pago:', err);
      setError(err.message || 'No se pudo guardar el pago.');
      throw err;
    }
  }, [db, fetchCompras]);

  // ── Anular Compra ──────────────────────────────────────────────────────────
  const anularCompra = useCallback(async (compraId: number) => {
    try {
      setError(null);
      await anularCompraProveedor(db, compraId);
      await fetchCompras();
    } catch (err: any) {
      console.error('[useCompras] Error al anular compra:', err);
      setError(err.message || 'No se pudo anular la compra.');
      throw err;
    }
  }, [db, fetchCompras]);

  return {
    compras,
    loading,
    refreshing,
    error,
    search,
    setSearch,
    refresh,
    crearCompra,
    registrarPago,
    anularCompra,
  };
}
