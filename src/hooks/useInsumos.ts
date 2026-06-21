// =============================================================================
// SurApícola — Hook de Insumos y Envases (Prompt 3)
// =============================================================================
import { useState, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { Insumo, MovimientoInsumo, PresentacionInsumo, AdvertenciaStockInsumo } from '../types';
import {
  getInsumos,
  crearInsumo,
  actualizarInsumo,
  archivarInsumo,
  registrarMovimientoInsumo,
  getMovimientosInsumo,
  getPresentacionInsumos,
  setPresentacionInsumos,
  checkStockInsumos,
  actualizarStockMinimoInsumo,
  type RegistrarMovimientoInsumoInput,
} from '../database/insumos';

export function useInsumos() {
  const db = useSQLiteContext();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Cargar lista ───────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInsumos(db);
      setInsumos(data);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar insumos.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleCrearInsumo = useCallback(
    async (input: { nombre: string; unidad: string; descripcion: string | null; stock_minimo?: number }): Promise<boolean> => {
      try {
        await crearInsumo(db, input);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al crear insumo.');
        return false;
      }
    },
    [db, refresh]
  );

  const handleActualizarInsumo = useCallback(
    async (
      id: number,
      input: { nombre: string; unidad: string; descripcion: string | null; stock_minimo?: number }
    ): Promise<boolean> => {
      try {
        await actualizarInsumo(db, id, input);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al actualizar insumo.');
        return false;
      }
    },
    [db, refresh]
  );

  const handleArchivarInsumo = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        await archivarInsumo(db, id);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al archivar insumo.');
        return false;
      }
    },
    [db, refresh]
  );

  // ── Movimientos ────────────────────────────────────────────────────────────

  const handleRegistrarMovimiento = useCallback(
    async (input: RegistrarMovimientoInsumoInput): Promise<boolean> => {
      try {
        await registrarMovimientoInsumo(db, input);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al registrar movimiento.');
        return false;
      }
    },
    [db, refresh]
  );

  const handleGetMovimientos = useCallback(
    async (insumoId: number): Promise<MovimientoInsumo[]> => {
      return getMovimientosInsumo(db, insumoId);
    },
    [db]
  );

  // ── Presentación → Insumos ─────────────────────────────────────────────────

  const handleGetPresentacionInsumos = useCallback(
    async (presentacionId: number): Promise<PresentacionInsumo[]> => {
      return getPresentacionInsumos(db, presentacionId);
    },
    [db]
  );

  const handleSetPresentacionInsumos = useCallback(
    async (
      presentacionId: number,
      items: Array<{ insumo_id: number; cantidad_por_unidad: number }>
    ): Promise<boolean> => {
      try {
        await setPresentacionInsumos(db, presentacionId, items);
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al guardar configuración.');
        return false;
      }
    },
    [db]
  );

  // ── Verificación de stock ──────────────────────────────────────────────────

  const handleCheckStockInsumos = useCallback(
    async (
      items: Array<{ presentacion_id: number; cantidad: number }>
    ): Promise<AdvertenciaStockInsumo[]> => {
      return checkStockInsumos(db, items);
    },
    [db]
  );

  const handleActualizarStockMinimo = useCallback(
    async (id: number, minimo: number): Promise<boolean> => {
      try {
        await actualizarStockMinimoInsumo(db, id, minimo);
        await refresh();
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Error al actualizar stock mínimo.');
        return false;
      }
    },
    [db, refresh]
  );

  return {
    insumos,
    loading,
    error,
    refresh,
    crearInsumo: handleCrearInsumo,
    actualizarInsumo: handleActualizarInsumo,
    archivarInsumo: handleArchivarInsumo,
    registrarMovimiento: handleRegistrarMovimiento,
    getMovimientos: handleGetMovimientos,
    getPresentacionInsumos: handleGetPresentacionInsumos,
    setPresentacionInsumos: handleSetPresentacionInsumos,
    checkStockInsumos: handleCheckStockInsumos,
    actualizarStockMinimo: handleActualizarStockMinimo,
  };
}
