// =============================================================================
// SurApícola — Consultas de Configuración General (Prompt 4)
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ConfiguracionGeneral } from '../types';

/**
 * Obtiene el valor de una configuración por clave.
 */
export async function getConfiguracion(
  db: SQLiteDatabase,
  clave: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM configuracion_app WHERE clave = ?',
    [clave]
  );
  return row?.valor ?? null;
}

/**
 * Guarda o actualiza el valor de una configuración.
 */
export async function setConfiguracion(
  db: SQLiteDatabase,
  clave: string,
  valor: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO configuracion_app (clave, valor, actualizado_en)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
    [clave, valor]
  );
}

/**
 * Obtiene el stock mínimo de miel (en gramos).
 */
export async function getStockMinimoMiel(db: SQLiteDatabase): Promise<number> {
  const val = await getConfiguracion(db, 'stock_minimo_miel_g');
  if (!val) return 0;
  const num = parseInt(val, 10);
  return isNaN(num) || num < 0 ? 0 : num;
}

/**
 * Guarda el stock mínimo de miel (en gramos).
 */
export async function setStockMinimoMiel(db: SQLiteDatabase, gramos: number): Promise<void> {
  if (gramos < 0) throw new Error('El stock mínimo no puede ser menor a 0.');
  await setConfiguracion(db, 'stock_minimo_miel_g', Math.round(gramos).toString());
}

/**
 * Obtiene el stock mínimo de panal (en unidades).
 */
export async function getStockMinimoPanal(db: SQLiteDatabase): Promise<number> {
  const val = await getConfiguracion(db, 'stock_minimo_panal_unidades');
  if (!val) return 0;
  const num = parseInt(val, 10);
  return isNaN(num) || num < 0 ? 0 : num;
}

/**
 * Guarda el stock mínimo de panal (en unidades).
 */
export async function setStockMinimoPanal(db: SQLiteDatabase, unidades: number): Promise<void> {
  if (unidades < 0) throw new Error('El stock mínimo no puede ser menor a 0.');
  await setConfiguracion(db, 'stock_minimo_panal_unidades', Math.round(unidades).toString());
}

/**
 * Obtiene todos los datos de configuración general del emprendimiento.
 */
export async function getConfiguracionGeneral(
  db: SQLiteDatabase
): Promise<ConfiguracionGeneral> {
  const nombre = await getConfiguracion(db, 'nombre_emprendimiento') ?? 'SurApícola';
  const telefono = await getConfiguracion(db, 'telefono_emprendimiento') ?? '';
  const direccion = await getConfiguracion(db, 'direccion_emprendimiento') ?? '';
  const email = await getConfiguracion(db, 'email_emprendimiento') ?? '';
  const moneda = await getConfiguracion(db, 'moneda') ?? 'ARS';
  const unidad = await getConfiguracion(db, 'unidad_miel_principal') ?? 'kg';
  const ultimoBackup = await getConfiguracion(db, 'ultimo_backup_fecha') ?? '';

  return {
    nombre_emprendimiento: nombre,
    telefono_emprendimiento: telefono,
    direccion_emprendimiento: direccion,
    email_emprendimiento: email,
    moneda,
    unidad_miel_principal: unidad,
    ultimo_backup_fecha: ultimoBackup,
  };
}

/**
 * Guarda o actualiza los datos de configuración general en una sola transacción.
 */
export async function guardarConfiguracionGeneral(
  db: SQLiteDatabase,
  data: Partial<ConfiguracionGeneral>
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (data.nombre_emprendimiento !== undefined) {
      await setConfiguracion(db, 'nombre_emprendimiento', data.nombre_emprendimiento);
    }
    if (data.telefono_emprendimiento !== undefined) {
      await setConfiguracion(db, 'telefono_emprendimiento', data.telefono_emprendimiento);
    }
    if (data.direccion_emprendimiento !== undefined) {
      await setConfiguracion(db, 'direccion_emprendimiento', data.direccion_emprendimiento);
    }
    if (data.email_emprendimiento !== undefined) {
      await setConfiguracion(db, 'email_emprendimiento', data.email_emprendimiento);
    }
    if (data.moneda !== undefined) {
      await setConfiguracion(db, 'moneda', data.moneda);
    }
    if (data.unidad_miel_principal !== undefined) {
      await setConfiguracion(db, 'unidad_miel_principal', data.unidad_miel_principal);
    }
    if (data.ultimo_backup_fecha !== undefined) {
      await setConfiguracion(db, 'ultimo_backup_fecha', data.ultimo_backup_fecha);
    }
  });
}
