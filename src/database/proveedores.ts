// =============================================================================
// SurApícola — Consultas de Proveedores (Fase 3C + Prompt 3)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Proveedor, CategoriaProveedor } from '../types';

/**
 * Obtiene la lista de proveedores activos (activo = 1), con filtro de búsqueda opcional.
 */
export async function getProveedoresActivos(
  db: SQLiteDatabase,
  search?: string
): Promise<Proveedor[]> {
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM proveedores
       WHERE activo = 1
         AND (nombre LIKE ? OR telefono LIKE ? OR email LIKE ? OR notas LIKE ?)
       ORDER BY nombre ASC`,
      [term, term, term, term]
    );
    return rows.map(mapRowToProveedor);
  }

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM proveedores
     WHERE activo = 1
     ORDER BY nombre ASC`
  );
  return rows.map(mapRowToProveedor);
}

/**
 * Obtiene proveedores activos filtrados por categoría.
 */
export async function getProveedoresPorCategoria(
  db: SQLiteDatabase,
  categoria: CategoriaProveedor
): Promise<Proveedor[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM proveedores
     WHERE activo = 1 AND categoria = ?
     ORDER BY nombre ASC`,
    [categoria]
  );
  return rows.map(mapRowToProveedor);
}

/**
 * Obtiene un proveedor por su ID único.
 */
export async function getProveedorById(
  db: SQLiteDatabase,
  id: number
): Promise<Proveedor | null> {
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM proveedores WHERE id = ?',
    [id]
  );
  return row ? mapRowToProveedor(row) : null;
}

/**
 * Crea un nuevo proveedor en la base de datos (activo por defecto).
 */
export async function crearProveedor(
  db: SQLiteDatabase,
  input: Omit<Proveedor, 'id' | 'activo' | 'creado_en'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO proveedores (nombre, telefono, email, direccion, notas, categoria, activo)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [input.nombre, input.telefono, input.email, input.direccion, input.notas, input.categoria ?? 'otros']
  );
}

/**
 * Actualiza los datos de un proveedor existente.
 */
export async function actualizarProveedor(
  db: SQLiteDatabase,
  id: number,
  input: Partial<Omit<Proveedor, 'id' | 'creado_en'>>
): Promise<void> {
  const editableFields: Array<keyof Omit<Proveedor, 'id' | 'creado_en'>> = [
    'nombre',
    'telefono',
    'email',
    'direccion',
    'notas',
    'categoria',
    'activo',
  ];

  const fields = Object.keys(input) as Array<keyof typeof input>;
  const activeFields = fields.filter(
    (field) => editableFields.includes(field) && input[field] !== undefined
  );
  if (activeFields.length === 0) return;

  const setClause = activeFields.map((field) => `${field} = ?`).join(', ');
  const values = activeFields.map((field) => {
    const val = input[field];
    return val === undefined ? null : val;
  });

  await db.runAsync(
    `UPDATE proveedores SET ${setClause} WHERE id = ?`,
    [...values, id] as any[]
  );
}

/**
 * Archiva de forma lógica a un proveedor (activo = 0).
 */
export async function archivarProveedor(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    'UPDATE proveedores SET activo = 0 WHERE id = ?',
    [id]
  );
}

/**
 * Mapea la fila cruda de SQLite a la interfaz Proveedor.
 */
function mapRowToProveedor(r: any): Proveedor {
  return {
    id: r.id,
    nombre: r.nombre,
    telefono: r.telefono || null,
    email: r.email || null,
    direccion: r.direccion || null,
    notas: r.notas || null,
    categoria: (r.categoria as CategoriaProveedor) || 'otros',
    activo: r.activo === 1 ? 1 : 0,
    creado_en: r.creado_en,
  };
}
