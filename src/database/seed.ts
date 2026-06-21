// =============================================================================
// SurApícola — Datos iniciales (seed)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';

// ---------------------------------------------------------------------------
// Presentaciones precargadas
// ---------------------------------------------------------------------------

const PRESENTACIONES_SEED = [
  {
    codigo: 'FRASCO_250G',
    nombre: 'Frasco 250g',
    tipo: 'miel',
    gramos_por_unidad: 250,
    unidades_panal_por_unidad: 0,
  },
  {
    codigo: 'FRASCO_500G',
    nombre: 'Frasco 500g',
    tipo: 'miel',
    gramos_por_unidad: 500,
    unidades_panal_por_unidad: 0,
  },
  {
    codigo: 'FRASCO_1KG',
    nombre: 'Frasco 1kg',
    tipo: 'miel',
    gramos_por_unidad: 1000,
    unidades_panal_por_unidad: 0,
  },
  {
    codigo: 'BALDE_15KG',
    nombre: 'Balde 15kg',
    tipo: 'miel',
    gramos_por_unidad: 15000,
    unidades_panal_por_unidad: 0,
  },
  {
    codigo: 'BALDE_30KG',
    nombre: 'Balde 30kg',
    tipo: 'miel',
    gramos_por_unidad: 30000,
    unidades_panal_por_unidad: 0,
  },
  {
    codigo: 'PANAL_UNIDAD',
    nombre: 'Panal (unidad)',
    tipo: 'panal',
    gramos_por_unidad: 0,
    unidades_panal_por_unidad: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// Categorías de gasto precargadas
// ---------------------------------------------------------------------------

const CATEGORIAS_GASTO_SEED = [
  'Nafta / Combustible',
  'Envases',
  'Etiquetas',
  'Reparaciones',
  'Servicios',
  'Otros',
] as const;

// ---------------------------------------------------------------------------
// Insumos precargados (Prompt 3)
// ---------------------------------------------------------------------------

const INSUMOS_SEED = [
  { codigo: 'FRASCO_250ML', nombre: 'Frasco 250ml', unidad: 'unidad', descripcion: 'Frasco de vidrio 250ml' },
  { codigo: 'FRASCO_500ML', nombre: 'Frasco 500ml', unidad: 'unidad', descripcion: 'Frasco de vidrio 500ml' },
  { codigo: 'FRASCO_1L',    nombre: 'Frasco 1 litro', unidad: 'unidad', descripcion: 'Frasco de vidrio 1L' },
  { codigo: 'BALDE_15KG',   nombre: 'Balde 15kg', unidad: 'unidad', descripcion: 'Balde plástico 15kg' },
  { codigo: 'BALDE_30KG',   nombre: 'Balde 30kg', unidad: 'unidad', descripcion: 'Balde plástico 30kg' },
  { codigo: 'ETIQUETA',     nombre: 'Etiqueta estándar', unidad: 'unidad', descripcion: 'Etiqueta adhesiva para frascos' },
  { codigo: 'TAPA_METALICA',nombre: 'Tapa metálica', unidad: 'unidad', descripcion: 'Tapa metálica para frascos' },
] as const;

/**
 * Mapa de código_presentacion → lista de insumos consumidos por unidad vendida.
 * Editable por el usuario desde la pantalla de Envases.
 */
const PRESENTACION_INSUMOS_DEFAULTS: Record<string, Array<{ insumo_codigo: string; cantidad: number }>> = {
  FRASCO_250G: [
    { insumo_codigo: 'FRASCO_250ML', cantidad: 1 },
    { insumo_codigo: 'ETIQUETA', cantidad: 1 },
  ],
  FRASCO_500G: [
    { insumo_codigo: 'FRASCO_500ML', cantidad: 1 },
    { insumo_codigo: 'ETIQUETA', cantidad: 1 },
  ],
  FRASCO_1KG: [
    { insumo_codigo: 'FRASCO_1L', cantidad: 1 },
    { insumo_codigo: 'ETIQUETA', cantidad: 1 },
  ],
  BALDE_15KG: [
    { insumo_codigo: 'BALDE_15KG', cantidad: 1 },
  ],
  BALDE_30KG: [
    { insumo_codigo: 'BALDE_30KG', cantidad: 1 },
  ],
  // PANAL_UNIDAD no tiene insumos por defecto
};

// ---------------------------------------------------------------------------
// Función principal de seed
// ---------------------------------------------------------------------------

/**
 * Inserta los datos iniciales si aún no existen.
 * Usa INSERT OR IGNORE para ser idempotente (seguro de re-ejecutar).
 */
export async function runSeed(db: SQLiteDatabase): Promise<void> {
  // Presentaciones
  for (const p of PRESENTACIONES_SEED) {
    await db.runAsync(
      `INSERT OR IGNORE INTO presentaciones
         (codigo, nombre, tipo, gramos_por_unidad, unidades_panal_por_unidad, precio_centavos, activa)
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [p.codigo, p.nombre, p.tipo, p.gramos_por_unidad, p.unidades_panal_por_unidad]
    );
  }
  console.log('[DB] Seed de presentaciones aplicado.');

  // Categorías de gasto
  for (const nombre of CATEGORIAS_GASTO_SEED) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categorias_gasto (nombre, activa) VALUES (?, 1)`,
      [nombre]
    );
  }
  console.log('[DB] Seed de categorías de gasto aplicado.');

  // Insumos (Prompt 3)
  // Verificar si la tabla insumos ya fue migrada antes de intentar insertar
  try {
    for (const ins of INSUMOS_SEED) {
      // Insertar si no existe un insumo con ese nombre exacto
      await db.runAsync(
        `INSERT INTO insumos (nombre, unidad, descripcion, activo)
         SELECT ?, ?, ?, 1
         WHERE NOT EXISTS (SELECT 1 FROM insumos WHERE nombre = ?)`,
        [ins.nombre, ins.unidad, ins.descripcion, ins.nombre]
      );
    }
    console.log('[DB] Seed de insumos aplicado.');

    // Relaciones presentacion → insumos por defecto
    // Solo insertar si la presentacion_insumos está vacía para esa presentación
    for (const [codigoPresentacion, insumos] of Object.entries(PRESENTACION_INSUMOS_DEFAULTS)) {
      const pres = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM presentaciones WHERE codigo = ?`,
        [codigoPresentacion]
      );
      if (!pres) continue;

      // Solo seedear si no hay ninguna relación para esta presentación
      const existeRelacion = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM presentacion_insumos WHERE presentacion_id = ?`,
        [pres.id]
      );
      if (existeRelacion && existeRelacion.cnt > 0) continue;

      for (const rel of insumos) {
        const insumo = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM insumos WHERE nombre = ?`,
          [rel.insumo_codigo === 'FRASCO_250ML' ? 'Frasco 250ml' :
           rel.insumo_codigo === 'FRASCO_500ML' ? 'Frasco 500ml' :
           rel.insumo_codigo === 'FRASCO_1L'    ? 'Frasco 1 litro' :
           rel.insumo_codigo === 'BALDE_15KG'   ? 'Balde 15kg' :
           rel.insumo_codigo === 'BALDE_30KG'   ? 'Balde 30kg' :
           rel.insumo_codigo === 'ETIQUETA'      ? 'Etiqueta estándar' :
           rel.insumo_codigo === 'TAPA_METALICA' ? 'Tapa metálica' : '']
        );
        if (!insumo) continue;

        await db.runAsync(
          `INSERT OR IGNORE INTO presentacion_insumos (presentacion_id, insumo_id, cantidad_por_unidad, activo)
           VALUES (?, ?, ?, 1)`,
          [pres.id, insumo.id, rel.cantidad]
        );
      }
    }
    console.log('[DB] Seed de relaciones presentacion-insumos aplicado.');
  } catch (e: any) {
    // La tabla insumos puede no existir aún en DB muy antiguas antes de la migración v6
    console.log('[DB] Seed de insumos omitido (tabla no disponible aún):', e.message);
  }
}
