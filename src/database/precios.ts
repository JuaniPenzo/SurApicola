// =============================================================================
// SurApícola — Consultas y Transacciones de Precios (Fase 8 - Prompt 2)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  CategoriaPrecio,
  PrecioPresentacionDetalle,
  CrearCategoriaPrecioInput,
  ActualizarCategoriaPrecioInput,
} from '../types';

// ---------------------------------------------------------------------------
// CATEGORÍAS DE PRECIO
// ---------------------------------------------------------------------------

export async function getCategoriasPrecio(db: SQLiteDatabase): Promise<CategoriaPrecio[]> {
  return await db.getAllAsync<CategoriaPrecio>(
    `SELECT * FROM categorias_precio WHERE activo = 1 ORDER BY nombre ASC`
  );
}

export async function crearCategoriaPrecio(
  db: SQLiteDatabase,
  input: CrearCategoriaPrecioInput
): Promise<number> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    throw new Error('El nombre de la categoría es obligatorio.');
  }

  // Verificar si ya existe una categoría activa con el mismo nombre
  const existe = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM categorias_precio WHERE nombre = ? AND activo = 1`,
    [nombre]
  );
  if (existe) {
    throw new Error(`Ya existe una lista de precios activa con el nombre "${nombre}".`);
  }

  const result = await db.runAsync(
    `INSERT INTO categorias_precio (nombre, descripcion) VALUES (?, ?)`,
    [nombre, input.descripcion ? input.descripcion.trim() : null]
  );

  return result.lastInsertRowId;
}

export async function actualizarCategoriaPrecio(
  db: SQLiteDatabase,
  id: number,
  input: ActualizarCategoriaPrecioInput
): Promise<void> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    throw new Error('El nombre de la categoría es obligatorio.');
  }

  // Verificar duplicados (excluyendo la actual)
  const existe = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM categorias_precio WHERE nombre = ? AND activo = 1 AND id != ?`,
    [nombre, id]
  );
  if (existe) {
    throw new Error(`Ya existe otra lista de precios activa con el nombre "${nombre}".`);
  }

  await db.runAsync(
    `UPDATE categorias_precio 
     SET nombre = ?, descripcion = ?, actualizado_en = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [nombre, input.descripcion ? input.descripcion.trim() : null, id]
  );
}

export async function archivarCategoriaPrecio(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Baja lógica de la categoría
    await db.runAsync(
      `UPDATE categorias_precio 
       SET activo = 0, actualizado_en = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    // Archivar también los precios correspondientes a esta categoría
    await db.runAsync(
      `UPDATE precios_presentacion 
       SET activo = 0, actualizado_en = CURRENT_TIMESTAMP 
       WHERE categoria_precio_id = ?`,
      [id]
    );
  });
}

// ---------------------------------------------------------------------------
// PRECIOS POR PRESENTACIÓN
// ---------------------------------------------------------------------------

/**
 * Obtiene las presentaciones con sus respectivos precios configurados para la categoría dada.
 * Retorna la lista completa de presentaciones indicando el precio configurado (si existe).
 */
export async function getPreciosPorCategoria(
  db: SQLiteDatabase,
  categoriaPrecioId: number
): Promise<PrecioPresentacionDetalle[]> {
  const query = `
    SELECT 
      p.id AS presentacion_id,
      p.codigo,
      p.nombre,
      p.tipo,
      pr.precio_centavos AS precio_actual_centavos,
      pr.id AS precio_presentacion_id
    FROM presentaciones p
    LEFT JOIN precios_presentacion pr 
      ON p.id = pr.presentacion_id 
      AND pr.categoria_precio_id = ? 
      AND pr.activo = 1
    WHERE p.activa = 1
    ORDER BY p.tipo DESC, p.gramos_por_unidad ASC, p.nombre ASC
  `;
  return await db.getAllAsync<PrecioPresentacionDetalle>(query, [categoriaPrecioId]);
}

/**
 * Guarda o actualiza el precio para una combinación de categoría y presentación.
 * De forma transaccional e idempotente.
 */
export async function guardarPrecioPresentacion(
  db: SQLiteDatabase,
  categoriaPrecioId: number,
  presentacionId: number,
  precioCentavos: number
): Promise<void> {
  if (precioCentavos < 0) {
    throw new Error('El precio no puede ser negativo.');
  }

  await db.withTransactionAsync(async () => {
    // Buscar si ya existe un precio activo
    const anterior = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM precios_presentacion 
       WHERE categoria_precio_id = ? AND presentacion_id = ? AND activo = 1`,
      [categoriaPrecioId, presentacionId]
    );

    if (anterior) {
      // Actualizar
      await db.runAsync(
        `UPDATE precios_presentacion 
         SET precio_centavos = ?, actualizado_en = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [precioCentavos, anterior.id]
      );
    } else {
      // Insertar
      await db.runAsync(
        `INSERT INTO precios_presentacion (categoria_precio_id, presentacion_id, precio_centavos) 
         VALUES (?, ?, ?)`,
        [categoriaPrecioId, presentacionId, precioCentavos]
      );
    }
  });
}

/**
 * Obtiene el precio sugerido para una presentación bajo una categoría de precios dada.
 * Retorna null si no se encuentra.
 */
export async function getPrecioSugerido(
  db: SQLiteDatabase,
  categoriaPrecioId: number,
  presentacionId: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{ precio_centavos: number }>(
    `SELECT precio_centavos FROM precios_presentacion 
     WHERE categoria_precio_id = ? AND presentacion_id = ? AND activo = 1`,
    [categoriaPrecioId, presentacionId]
  );
  return row ? row.precio_centavos : null;
}
