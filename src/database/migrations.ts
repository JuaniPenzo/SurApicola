// =============================================================================
// SurApícola — Sistema de migraciones
// =============================================================================
import type { SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';

interface Migration {
  version: number;
  /** Array de sentencias SQL a ejecutar en orden */
  statements: string[];
}

/**
 * Lista de migraciones en orden ascendente.
 * Para agregar una nueva versión: añadir un objeto al final del array.
 * NUNCA modificar una migración ya aplicada en producción.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: SCHEMA_V1,
  },
  {
    version: 2,
    statements: [
      `ALTER TABLE clientes ADD COLUMN email TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo)`,
      `CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre)`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE proveedores ADD COLUMN email TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo)`,
      `CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre)`,
      `ALTER TABLE compras_proveedor ADD COLUMN tipo_stock TEXT NOT NULL DEFAULT 'miel'`,
      `ALTER TABLE compras_proveedor ADD COLUMN cantidad INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE compras_proveedor ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente'`,
      `ALTER TABLE pagos_proveedor ADD COLUMN compra_id INTEGER REFERENCES compras_proveedor(id)`,
    ],
  },
  {
    version: 4,
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_pagos_prov_compra ON pagos_proveedor(compra_id)`,
      `CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos_operativos(categoria_id)`,
      `CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos_operativos(estado)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_gasto_anulado ON pagos_gasto(anulado)`,
      `CREATE INDEX IF NOT EXISTS idx_pagos_prov_anulado ON pagos_proveedor(anulado)`,
    ],
  },
  {
    version: 5,
    statements: [
      `CREATE TABLE IF NOT EXISTS categorias_precio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
        creado_en TEXT NOT NULL DEFAULT (datetime('now')),
        actualizado_en TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS precios_presentacion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoria_precio_id INTEGER NOT NULL REFERENCES categorias_precio(id),
        presentacion_id INTEGER NOT NULL REFERENCES presentaciones(id),
        precio_centavos INTEGER NOT NULL CHECK (precio_centavos >= 0),
        activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
        creado_en TEXT NOT NULL DEFAULT (datetime('now')),
        actualizado_en TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_precios_presentacion_uq 
       ON precios_presentacion(categoria_precio_id, presentacion_id) 
       WHERE activo = 1`,
      `CREATE INDEX IF NOT EXISTS idx_categorias_precio_activo ON categorias_precio(activo)`,
      `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_categoria ON precios_presentacion(categoria_precio_id)`,
      `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_presentacion ON precios_presentacion(presentacion_id)`,
      `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_activo ON precios_presentacion(activo)`,
      `ALTER TABLE ventas ADD COLUMN categoria_precio_id INTEGER REFERENCES categorias_precio(id)`
    ],
  },
  {
    // v6: Módulo de Envases e Insumos + categorización de proveedores
    version: 6,
    statements: [
      // Columna categoria en proveedores (idempotente via try/catch)
      `ALTER TABLE proveedores ADD COLUMN categoria TEXT NOT NULL DEFAULT 'otros'
        CHECK(categoria IN ('miel_panales', 'envases', 'otros'))`,

      // Tabla insumos
      `CREATE TABLE IF NOT EXISTS insumos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre      TEXT    NOT NULL,
        unidad      TEXT    NOT NULL DEFAULT 'unidad',
        descripcion TEXT,
        activo      INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),
        creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,

      // Ledger de movimientos de insumo
      `CREATE TABLE IF NOT EXISTS movimientos_insumo (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        insumo_id   INTEGER NOT NULL REFERENCES insumos(id),
        fecha       TEXT    NOT NULL,
        cantidad    INTEGER NOT NULL CHECK(cantidad != 0),
        tipo_origen TEXT    NOT NULL CHECK(tipo_origen IN (
                      'compra_insumo', 'ajuste_entrada', 'ajuste_salida',
                      'venta_item', 'anulacion_venta_item'
                    )),
        origen_id   INTEGER,
        notas       TEXT,
        creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,

      // Relación presentacion → insumos consumidos
      `CREATE TABLE IF NOT EXISTS presentacion_insumos (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        presentacion_id     INTEGER NOT NULL REFERENCES presentaciones(id),
        insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
        cantidad_por_unidad INTEGER NOT NULL DEFAULT 1 CHECK(cantidad_por_unidad > 0),
        activo              INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
      )`,

      // Índices
      `CREATE INDEX IF NOT EXISTS idx_insumos_activo ON insumos(activo)`,
      `CREATE INDEX IF NOT EXISTS idx_mov_insumo_insumo_id ON movimientos_insumo(insumo_id)`,
      `CREATE INDEX IF NOT EXISTS idx_mov_insumo_fecha ON movimientos_insumo(fecha)`,
      `CREATE INDEX IF NOT EXISTS idx_mov_insumo_tipo_origen ON movimientos_insumo(tipo_origen, origen_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pres_insumos_presentacion ON presentacion_insumos(presentacion_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pres_insumos_insumo ON presentacion_insumos(insumo_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_pres_insumos_uq ON presentacion_insumos(presentacion_id, insumo_id) WHERE activo = 1`,
      `CREATE INDEX IF NOT EXISTS idx_proveedores_categoria ON proveedores(categoria)`,
    ],
  },
  {
    // v7: Cuenta Corriente y Alertas de Stock Mínimo
    version: 7,
    statements: [
      `CREATE TABLE IF NOT EXISTS configuracion_app (
        clave          TEXT PRIMARY KEY,
        valor          TEXT NOT NULL,
        actualizado_en TEXT
      )`,
      `ALTER TABLE insumos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('stock_minimo_miel_g', '0', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('stock_minimo_panal_unidades', '0', datetime('now'))`,
      `ALTER TABLE compras_proveedor ADD COLUMN insumo_id INTEGER REFERENCES insumos(id)`
    ],
  },
  {
    // v8: Configuración General del Emprendimiento (Prompt 5)
    version: 8,
    statements: [
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('nombre_emprendimiento', 'SurApícola', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('telefono_emprendimiento', '', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('direccion_emprendimiento', '', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('email_emprendimiento', '', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('moneda', 'ARS', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('unidad_miel_principal', 'kg', datetime('now'))`,
      `INSERT OR IGNORE INTO configuracion_app (clave, valor, actualizado_en) VALUES ('ultimo_backup_fecha', '', datetime('now'))`
    ],
  },
  {
    // v9: Compras multi-ítem, desactivación de Tapa metálica y gastos de stock
    version: 9,
    statements: [
      `CREATE TABLE IF NOT EXISTS items_compra_proveedor (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        compra_proveedor_id     INTEGER NOT NULL REFERENCES compras_proveedor(id),
        tipo_stock              TEXT    NOT NULL CHECK(tipo_stock IN ('miel', 'panal', 'insumo')),
        insumo_id               INTEGER REFERENCES insumos(id),
        cantidad                INTEGER NOT NULL CHECK(cantidad > 0),
        costo_unitario_centavos INTEGER NOT NULL CHECK(costo_unitario_centavos >= 0),
        subtotal_centavos       INTEGER NOT NULL CHECK(subtotal_centavos >= 0)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_items_compra ON items_compra_proveedor(compra_proveedor_id)`,
      `UPDATE categorias_gasto SET activa = 0 WHERE nombre IN ('Envases', 'Etiquetas')`,
      `UPDATE presentacion_insumos SET activo = 0 WHERE insumo_id = (SELECT id FROM insumos WHERE nombre = 'Tapa metálica')`
    ],
  },
];

/** Tabla interna que registra qué migraciones fueron aplicadas */
const CREATE_DB_VERSION = `
  CREATE TABLE IF NOT EXISTS db_version (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`;

/**
 * Obtiene la versión actual de la base de datos.
 * Retorna 0 si nunca se aplicó ninguna migración.
 */
async function getCurrentVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) AS version FROM db_version'
  );
  return row?.version ?? 0;
}

/**
 * Valida de forma dinámica e idempotente si pagos_proveedor tiene la columna compra_id.
 * Si no la tiene (caso de base de datos existente previa a la migración v3), la agrega.
 */
async function asegurarColumnaCompraId(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(pagos_proveedor)"
  );
  const tieneCompraId = columns.some((col) => col.name === 'compra_id');
  if (!tieneCompraId) {
    console.log('[DB] Columna compra_id no encontrada en pagos_proveedor. Agregándola...');
    await db.execAsync(
      `ALTER TABLE pagos_proveedor ADD COLUMN compra_id INTEGER REFERENCES compras_proveedor(id)`
    );
    console.log('[DB] Columna compra_id agregada con éxito.');
  }
}

/**
 * Aplica todas las migraciones pendientes en orden.
 * Cada migración se ejecuta en su propia transacción.
 * Si una migración falla, el error se propaga y la app no arranca.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Crear tabla de versiones si no existe
  await db.execAsync(CREATE_DB_VERSION);

  const currentVersion = await getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pending.length > 0) {
    for (const migration of pending) {
      console.log(`[DB] Aplicando migración v${migration.version}...`);

      await db.withTransactionAsync(async () => {
        for (const sql of migration.statements) {
          try {
            await db.execAsync(sql);
          } catch (err: any) {
            const msg = err.message || '';
            if (
              msg.includes('duplicate column name') || 
              msg.includes('already exists') || 
              msg.includes('duplicate column')
            ) {
              console.log(`[DB] Ignorando error esperado en migración (ya existe): ${msg}`);
            } else {
              throw err;
            }
          }
        }
        await db.runAsync(
          'INSERT INTO db_version (version) VALUES (?)',
          [migration.version]
        );
      });

      console.log(`[DB] Migración v${migration.version} aplicada correctamente.`);
    }
  } else {
    console.log(`[DB] Schema actualizado (v${currentVersion}). Sin migraciones pendientes.`);
  }

  // VALIDACIÓN DINÁMICA DE SEGURIDAD: asegurar que compra_id existe
  await asegurarColumnaCompraId(db);
}
