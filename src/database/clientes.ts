// =============================================================================
// SurApícola — Consultas de Clientes (Fase 3A)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Cliente } from '../types';

/**
 * Obtiene la lista de clientes activos (activo = 1), con filtro de búsqueda opcional.
 * Busca coincidencias en nombre, teléfono o notas (case-insensitive).
 */
export async function getClientesActivos(
  db: SQLiteDatabase,
  search?: string
): Promise<Cliente[]> {
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM clientes
       WHERE activo = 1
         AND (nombre LIKE ? OR telefono LIKE ? OR email LIKE ? OR notas LIKE ?)
       ORDER BY nombre ASC`,
      [term, term, term, term]
    );
    return rows.map(mapRowToCliente);
  }

  const rows = await db.getAllAsync<any>(
    `SELECT * FROM clientes
     WHERE activo = 1
     ORDER BY nombre ASC`
  );
  return rows.map(mapRowToCliente);
}

/**
 * Obtiene un cliente por su ID único.
 */
export async function getClienteById(
  db: SQLiteDatabase,
  id: number
): Promise<Cliente | null> {
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM clientes WHERE id = ?',
    [id]
  );
  return row ? mapRowToCliente(row) : null;
}

/**
 * Crea un nuevo cliente en la base de datos (activo por defecto).
 */
export async function crearCliente(
  db: SQLiteDatabase,
  input: Omit<Cliente, 'id' | 'activo' | 'creado_en'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO clientes (nombre, telefono, email, direccion, notas, activo)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [input.nombre, input.telefono, input.email, input.direccion, input.notas]
  );
}

/**
 * Actualiza los datos de un cliente existente.
 */
export async function actualizarCliente(
  db: SQLiteDatabase,
  id: number,
  input: Partial<Omit<Cliente, 'id' | 'creado_en'>>
): Promise<void> {
  // Construcción dinámica de UPDATE para soportar actualizaciones parciales
  const fields = Object.keys(input) as Array<keyof typeof input>;
  const activeFields = fields.filter((field) => input[field] !== undefined);
  if (activeFields.length === 0) return;

  const setClause = activeFields.map((field) => `${field} = ?`).join(', ');
  const values = activeFields.map((field) => {
    const val = input[field];
    return val === undefined ? null : val;
  });

  await db.runAsync(
    `UPDATE clientes SET ${setClause} WHERE id = ?`,
    [...values, id] as any[]
  );
}

/**
 * Archiva de forma lógica a un cliente (activo = 0), conservando la trazabilidad.
 */
export async function archivarCliente(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync(
    'UPDATE clientes SET activo = 0 WHERE id = ?',
    [id]
  );
}

/**
 * Mapea la fila cruda de SQLite a la interfaz Cliente.
 */
function mapRowToCliente(r: any): Cliente {
  return {
    id: r.id,
    nombre: r.nombre,
    telefono: r.telefono || null,
    email: r.email || null,
    direccion: r.direccion || null,
    notas: r.notas || null,
    activo: r.activo === 1 ? 1 : 0,
    creado_en: r.creado_en,
  };
}
