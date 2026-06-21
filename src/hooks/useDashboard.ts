// =============================================================================
// SurApícola — Hook del Dashboard
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getDashboardData } from '../database/queries/dashboard';
import type { DashboardData } from '../types';

interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DATOS_VACIOS: DashboardData = {
  stockMielGramos: 0,
  stockPanalUnidades: 0,
  ventasHoyCentavos: 0,
  cobrosHoyCentavos: 0,
  gastosHoyCentavos: 0,
};

export function useDashboard(): UseDashboardResult {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getDashboardData(db);
      setData(result);
    } catch (err) {
      console.error('[Dashboard] Error al cargar datos:', err);
      setError('No se pudieron cargar los datos. Intentá de nuevo.');
      setData(DATOS_VACIOS);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
