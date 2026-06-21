// =============================================================================
// SurApícola — Hook de Configuración General y Mínimos (Prompt 5)
// =============================================================================
import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getStockMinimoMiel,
  setStockMinimoMiel,
  getStockMinimoPanal,
  setStockMinimoPanal,
  getConfiguracionGeneral,
  guardarConfiguracionGeneral,
} from '../database/configuracion';
import type { ConfiguracionGeneral } from '../types';

export function useConfiguracion() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configGeneral, setConfigGeneral] = useState<ConfiguracionGeneral | null>(null);

  const getMielMinimo = useCallback(async () => {
    return getStockMinimoMiel(db);
  }, [db]);

  const getPanalMinimo = useCallback(async () => {
    return getStockMinimoPanal(db);
  }, [db]);

  const actualizarMielMinimo = useCallback(async (gramos: number) => {
    setLoading(true);
    setError(null);
    try {
      await setStockMinimoMiel(db, gramos);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al guardar mínimo de miel');
      return false;
    } finally {
      setLoading(false);
    }
  }, [db]);

  const actualizarPanalMinimo = useCallback(async (unidades: number) => {
    setLoading(true);
    setError(null);
    try {
      await setStockMinimoPanal(db, unidades);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al guardar mínimo de panal');
      return false;
    } finally {
      setLoading(false);
    }
  }, [db]);

  const cargarConfiguracionGeneral = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getConfiguracionGeneral(db);
      setConfigGeneral(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Error al obtener la configuración general.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [db]);

  const actualizarConfiguracionGeneral = useCallback(async (data: Partial<ConfiguracionGeneral>) => {
    setLoading(true);
    setError(null);
    try {
      await guardarConfiguracionGeneral(db, data);
      await cargarConfiguracionGeneral(); // Recargar
      return true;
    } catch (err: any) {
      setError(err.message || 'Error al guardar la configuración general.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [db, cargarConfiguracionGeneral]);

  return {
    loading,
    error,
    configGeneral,
    getMielMinimo,
    getPanalMinimo,
    actualizarMielMinimo,
    actualizarPanalMinimo,
    cargarConfiguracionGeneral,
    actualizarConfiguracionGeneral,
  };
}

