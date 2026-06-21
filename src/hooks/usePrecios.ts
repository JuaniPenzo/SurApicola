// =============================================================================
// SurApícola — Hook de Gestión de Precios (Fase 8 - Prompt 2)
// =============================================================================
import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  getCategoriasPrecio,
  getPreciosPorCategoria,
  crearCategoriaPrecio,
  actualizarCategoriaPrecio,
  archivarCategoriaPrecio,
  guardarPrecioPresentacion,
  getPrecioSugerido,
} from '../database/precios';
import type { CategoriaPrecio, PrecioPresentacionDetalle } from '../types';

interface UsePreciosResult {
  categorias: CategoriaPrecio[];
  precios: PrecioPresentacionDetalle[];
  loading: boolean;
  error: string | null;
  selectedCategoriaId: number | null;
  setSelectedCategoriaId: (id: number | null) => void;
  refresh: () => Promise<void>;
  crearCategoria: (nombre: string, descripcion: string | null) => Promise<void>;
  actualizarCategoria: (id: number, nombre: string, descripcion: string | null) => Promise<void>;
  archivarCategoria: (id: number) => Promise<void>;
  guardarPrecio: (presentacionId: number, precioCentavos: number) => Promise<void>;
  obtenerPrecioSugerido: (categoriaId: number, presentacionId: number) => Promise<number | null>;
}

export function usePrecios(): UsePreciosResult {
  const db = useSQLiteContext();
  const [categorias, setCategorias] = useState<CategoriaPrecio[]>([]);
  const [precios, setPrecios] = useState<PrecioPresentacionDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cats = await getCategoriasPrecio(db);
      setCategorias(cats);

      // Si no hay categoría seleccionada pero hay categorías, seleccionamos la primera
      let currentCatId = selectedCategoriaId;
      if (currentCatId === null && cats.length > 0) {
        currentCatId = cats[0].id;
        setSelectedCategoriaId(currentCatId);
      }

      if (currentCatId !== null) {
        const prs = await getPreciosPorCategoria(db, currentCatId);
        setPrecios(prs);
      } else {
        setPrecios([]);
      }
    } catch (err: any) {
      console.error('[usePrecios] Error al recargar precios:', err);
      setError(err.message || 'No se pudieron cargar las listas de precios.');
    } finally {
      setLoading(false);
    }
  }, [db, selectedCategoriaId]);

  // Cargar precios de la categoría seleccionada
  useEffect(() => {
    let active = true;
    const loadPrecios = async () => {
      if (selectedCategoriaId === null) {
        setPrecios([]);
        return;
      }
      try {
        setError(null);
        const prs = await getPreciosPorCategoria(db, selectedCategoriaId);
        if (active) {
          setPrecios(prs);
        }
      } catch (err: any) {
        console.error('[usePrecios] Error al cargar precios de categoría:', err);
        setError(err.message || 'No se pudieron cargar los precios de la categoría.');
      }
    };
    loadPrecios();
    return () => {
      active = false;
    };
  }, [db, selectedCategoriaId]);

  // Carga inicial
  useEffect(() => {
    refresh();
  }, []);

  const crearCategoria = useCallback(async (nombre: string, descripcion: string | null) => {
    try {
      setError(null);
      const newId = await crearCategoriaPrecio(db, { nombre, descripcion });
      setSelectedCategoriaId(newId);
      await refresh();
    } catch (err: any) {
      console.error('[usePrecios] Error al crear categoría:', err);
      throw err;
    }
  }, [db, refresh]);

  const actualizarCategoria = useCallback(async (id: number, nombre: string, descripcion: string | null) => {
    try {
      setError(null);
      await actualizarCategoriaPrecio(db, id, { nombre, descripcion });
      await refresh();
    } catch (err: any) {
      console.error('[usePrecios] Error al actualizar categoría:', err);
      throw err;
    }
  }, [db, refresh]);

  const archivarCategoria = useCallback(async (id: number) => {
    try {
      setError(null);
      await archivarCategoriaPrecio(db, id);
      if (selectedCategoriaId === id) {
        setSelectedCategoriaId(null);
      }
      await refresh();
    } catch (err: any) {
      console.error('[usePrecios] Error al archivar categoría:', err);
      throw err;
    }
  }, [db, selectedCategoriaId, refresh]);

  const guardarPrecio = useCallback(async (presentacionId: number, precioCentavos: number) => {
    if (selectedCategoriaId === null) {
      throw new Error('Debe seleccionar una lista de precios antes de guardar.');
    }
    try {
      setError(null);
      await guardarPrecioPresentacion(db, selectedCategoriaId, presentacionId, precioCentavos);
      // Refrescar los precios de esta lista
      const prs = await getPreciosPorCategoria(db, selectedCategoriaId);
      setPrecios(prs);
    } catch (err: any) {
      console.error('[usePrecios] Error al guardar precio:', err);
      throw err;
    }
  }, [db, selectedCategoriaId]);

  const obtenerPrecioSugerido = useCallback(async (categoriaId: number, presentacionId: number) => {
    try {
      return await getPrecioSugerido(db, categoriaId, presentacionId);
    } catch (err) {
      console.error('[usePrecios] Error al obtener precio sugerido:', err);
      return null;
    }
  }, [db]);

  return {
    categorias,
    precios,
    loading,
    error,
    selectedCategoriaId,
    setSelectedCategoriaId,
    refresh,
    crearCategoria,
    actualizarCategoria,
    archivarCategoria,
    guardarPrecio,
    obtenerPrecioSugerido,
  };
}
