// =============================================================================
// SurApícola — Consultas de Presentaciones (Fase 3B)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Presentacion } from '../types';

/**
 * Obtiene la lista de presentaciones activas (activa = 1).
 * Ordena por tipo ('miel' primero, luego 'panal') y por tamaño/unidades.
 */
export async function getPresentacionesActivas(
  db: SQLiteDatabase
): Promise<Presentacion[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM presentaciones
     WHERE activa = 1
     ORDER BY tipo ASC, gramos_por_unidad ASC, unidades_panal_por_unidad ASC`
  );

  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    tipo: r.tipo as 'miel' | 'panal',
    gramos_por_unidad: r.gramos_por_unidad,
    unidades_panal_por_unidad: r.unidades_panal_por_unidad,
    precio_centavos: r.precio_centavos,
    activa: r.activa === 1 ? 1 : 0,
    creado_en: r.creado_en,
  }));
}
