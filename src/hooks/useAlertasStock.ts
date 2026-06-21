// =============================================================================
// SurApícola — Hook de Alertas de Stock (Prompt 4)
// =============================================================================
import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { getResumenAlertasStock } from '../database/stock';
import type { AlertaStock } from '../types';

export function useAlertasStock() {
  const db = useSQLiteContext();
  const [alertas, setAlertas] = useState<AlertaStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getResumenAlertasStock(db);
      setAlertas(res);
    } catch (err: any) {
      setError(err.message || 'Error al cargar alertas de stock');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      fetchAlertas();
    }, [fetchAlertas])
  );

  return { alertas, loading, error, refresh: fetchAlertas };
}
