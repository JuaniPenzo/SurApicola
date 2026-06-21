// =============================================================================
// SurApícola — Inicialización de la base de datos
// Esta función se pasa como `onInit` al SQLiteProvider de expo-sqlite.
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { runMigrations } from './migrations';
import { runSeed } from './seed';

/**
 * Inicializa la base de datos al abrir la app.
 * Orden de ejecución:
 *   1. Activar foreign keys
 *   2. Ejecutar migraciones pendientes
 *   3. Ejecutar seed de datos iniciales
 *
 * Si cualquier paso falla, el error se propaga y la app muestra
 * una pantalla de error en lugar de datos corruptos.
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    // SQLite desactiva foreign keys por defecto; activar en cada conexión
    await db.execAsync('PRAGMA foreign_keys = ON');
    await db.execAsync('PRAGMA journal_mode = WAL'); // Mejor rendimiento en lectura concurrente

    await runMigrations(db);
    await runSeed(db);

    console.log('[DB] Base de datos inicializada correctamente.');
  } catch (error) {
    console.error('[DB] Error al inicializar la base de datos:', error);
    throw error; // Propagar para que SQLiteProvider lo capture
  }
}
