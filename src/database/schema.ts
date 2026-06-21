// =============================================================================
// SurApícola — Schema SQL completo
// Todas las tablas y triggers de la base de datos.
// =============================================================================

/**
 * SQL para crear todas las tablas y triggers.
 * Se ejecuta dentro de la migración v1.
 * El orden importa: las tablas referenciadas deben existir antes.
 */
export const SCHEMA_V1: string[] = [
  // ── PRAGMA ──────────────────────────────────────────────────────────────
  `PRAGMA foreign_keys = ON`,

  // ── 1. PRESENTACIONES ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS presentaciones (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo                    TEXT    NOT NULL UNIQUE,
    nombre                    TEXT    NOT NULL,
    tipo                      TEXT    NOT NULL
                                CHECK(tipo IN ('miel', 'panal')),
    gramos_por_unidad         INTEGER NOT NULL DEFAULT 0
                                CHECK(gramos_por_unidad >= 0),
    unidades_panal_por_unidad INTEGER NOT NULL DEFAULT 0
                                CHECK(unidades_panal_por_unidad >= 0),
    precio_centavos           INTEGER NOT NULL DEFAULT 0
                                CHECK(precio_centavos >= 0),
    activa                    INTEGER NOT NULL DEFAULT 1
                                CHECK(activa IN (0, 1)),
    creado_en                 TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK(
      (tipo = 'miel'  AND gramos_por_unidad > 0  AND unidades_panal_por_unidad = 0) OR
      (tipo = 'panal' AND gramos_por_unidad = 0  AND unidades_panal_por_unidad > 0)
    )
  )`,

  /**
   * Trigger: bloquea cambios en campos inmutables de presentaciones.
   * Solo nombre, precio_centavos y activa son editables.
   *
   * Nota: SQLite sí soporta "CREATE TRIGGER IF NOT EXISTS" desde la versión 3.21.0.
   * Usamos esta cláusula para garantizar la idempotencia de la migración.
   */
  `CREATE TRIGGER IF NOT EXISTS trg_presentaciones_immutable
   BEFORE UPDATE ON presentaciones
   FOR EACH ROW
   WHEN OLD.codigo                    != NEW.codigo
     OR OLD.tipo                      != NEW.tipo
     OR OLD.gramos_por_unidad         != NEW.gramos_por_unidad
     OR OLD.unidades_panal_por_unidad != NEW.unidades_panal_por_unidad
   BEGIN
     SELECT RAISE(ABORT,
       'Los campos codigo, tipo, gramos_por_unidad y unidades_panal_por_unidad son inmutables en presentaciones'
     );
   END`,

  // ── 2. CLIENTES ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS clientes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    telefono    TEXT,
    direccion   TEXT,
    notas       TEXT,
    activo      INTEGER NOT NULL DEFAULT 1
                  CHECK(activo IN (0, 1)),
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 2B. CATEGORIAS_PRECIO ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS categorias_precio (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT    NOT NULL,
    descripcion     TEXT,
    activo          INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
    creado_en       TEXT    NOT NULL DEFAULT (datetime('now')),
    actualizado_en  TEXT
  )`,

  // ── 2C. PRECIOS_PRESENTACION ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS precios_presentacion (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_precio_id INTEGER NOT NULL REFERENCES categorias_precio(id),
    presentacion_id     INTEGER NOT NULL REFERENCES presentaciones(id),
    precio_centavos     INTEGER NOT NULL CHECK (precio_centavos >= 0),
    activo              INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now')),
    actualizado_en      TEXT
  )`,

  // ── 3. VENTAS ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ventas (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    categoria_precio_id INTEGER REFERENCES categorias_precio(id),
    fecha               TEXT    NOT NULL,
    total_centavos      INTEGER NOT NULL
                          CHECK(total_centavos >= 0),
    estado              TEXT    NOT NULL DEFAULT 'pendiente'
                          CHECK(estado IN ('pendiente', 'parcial', 'pagada', 'anulada')),
    motivo_anulacion    TEXT
                          CHECK(
                            (estado  = 'anulada' AND motivo_anulacion IS NOT NULL) OR
                            (estado != 'anulada')
                          ),
    notas               TEXT,
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 4. ITEMS_VENTA ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS items_venta (
    id                              INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id                        INTEGER NOT NULL REFERENCES ventas(id),
    presentacion_id                 INTEGER NOT NULL REFERENCES presentaciones(id),
    cantidad                        INTEGER NOT NULL CHECK(cantidad > 0),
    precio_unitario_centavos        INTEGER NOT NULL CHECK(precio_unitario_centavos >= 0),
    subtotal_centavos               INTEGER NOT NULL CHECK(subtotal_centavos >= 0),
    codigo_snap                     TEXT    NOT NULL,
    nombre_snap                     TEXT    NOT NULL,
    tipo_snap                       TEXT    NOT NULL
                                      CHECK(tipo_snap IN ('miel', 'panal')),
    gramos_por_unidad_snap          INTEGER NOT NULL DEFAULT 0
                                      CHECK(gramos_por_unidad_snap >= 0),
    unidades_panal_por_unidad_snap  INTEGER NOT NULL DEFAULT 0
                                      CHECK(unidades_panal_por_unidad_snap >= 0),
    CHECK(
      (tipo_snap = 'miel'  AND gramos_por_unidad_snap > 0  AND unidades_panal_por_unidad_snap = 0) OR
      (tipo_snap = 'panal' AND gramos_por_unidad_snap = 0  AND unidades_panal_por_unidad_snap > 0)
    )
  )`,

  // ── 5. COBROS ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS cobros (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id          INTEGER NOT NULL REFERENCES clientes(id),
    venta_id            INTEGER REFERENCES ventas(id),
    fecha               TEXT    NOT NULL,
    monto_centavos      INTEGER NOT NULL CHECK(monto_centavos > 0),
    medio_pago          TEXT    NOT NULL
                          CHECK(medio_pago IN ('efectivo', 'transferencia', 'otro')),
    estado              TEXT    NOT NULL DEFAULT 'activo'
                          CHECK(estado IN ('activo', 'anulado')),
    motivo_anulacion    TEXT
                          CHECK(
                            (estado  = 'anulado' AND motivo_anulacion IS NOT NULL) OR
                            (estado != 'anulado')
                          ),
    notas               TEXT,
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 6. MOVIMIENTOS_STOCK ─────────────────────────────────────────────────
  // Fuente única de verdad. cantidad: positivo=entrada, negativo=salida.
  `CREATE TABLE IF NOT EXISTS movimientos_stock (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha         TEXT    NOT NULL,
    tipo_stock    TEXT    NOT NULL CHECK(tipo_stock IN ('miel', 'panal')),
    cantidad      INTEGER NOT NULL CHECK(cantidad != 0),
    tipo_origen   TEXT    NOT NULL CHECK(tipo_origen IN (
                    'cosecha', 'compra', 'venta_item', 'perdida',
                    'anulacion_cosecha', 'anulacion_compra',
                    'anulacion_venta_item', 'anulacion_perdida'
                  )),
    origen_id     INTEGER NOT NULL,
    notas         TEXT,
    creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 7. REGISTROS_COSECHA ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS registros_cosecha (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha               TEXT    NOT NULL,
    tipo_stock          TEXT    NOT NULL CHECK(tipo_stock IN ('miel', 'panal')),
    cantidad            INTEGER NOT NULL CHECK(cantidad > 0),
    notas               TEXT,
    anulado             INTEGER NOT NULL DEFAULT 0 CHECK(anulado IN (0, 1)),
    motivo_anulacion    TEXT
                          CHECK(
                            (anulado = 1 AND motivo_anulacion IS NOT NULL) OR
                            anulado = 0
                          ),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 8. REGISTROS_PERDIDA ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS registros_perdida (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha               TEXT    NOT NULL,
    tipo_stock          TEXT    NOT NULL CHECK(tipo_stock IN ('miel', 'panal')),
    cantidad            INTEGER NOT NULL CHECK(cantidad > 0),
    motivo              TEXT    NOT NULL,
    notas               TEXT,
    anulado             INTEGER NOT NULL DEFAULT 0 CHECK(anulado IN (0, 1)),
    motivo_anulacion    TEXT
                          CHECK(
                            (anulado = 1 AND motivo_anulacion IS NOT NULL) OR
                            anulado = 0
                          ),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 9. PROVEEDORES ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS proveedores (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    telefono    TEXT,
    direccion   TEXT,
    notas       TEXT,
    categoria   TEXT    NOT NULL DEFAULT 'otros'
                          CHECK(categoria IN ('miel_panales', 'envases', 'otros')),
    activo      INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0, 1)),
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 10. COMPRAS_PROVEEDOR ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS compras_proveedor (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
    fecha               TEXT    NOT NULL,
    gramos_comprados    INTEGER NOT NULL CHECK(gramos_comprados > 0),
    total_centavos      INTEGER NOT NULL CHECK(total_centavos >= 0),
    notas               TEXT,
    anulada             INTEGER NOT NULL DEFAULT 0 CHECK(anulada IN (0, 1)),
    motivo_anulacion    TEXT
                          CHECK(
                            (anulada = 1 AND motivo_anulacion IS NOT NULL) OR
                            anulada = 0
                          ),
    insumo_id           INTEGER REFERENCES insumos(id),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 11. PAGOS_PROVEEDOR ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS pagos_proveedor (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
    compra_id           INTEGER REFERENCES compras_proveedor(id),
    fecha               TEXT    NOT NULL,
    monto_centavos      INTEGER NOT NULL CHECK(monto_centavos > 0),
    medio_pago          TEXT    NOT NULL
                          CHECK(medio_pago IN ('efectivo', 'transferencia', 'otro')),
    notas               TEXT,
    anulado             INTEGER NOT NULL DEFAULT 0 CHECK(anulado IN (0, 1)),
    motivo_anulacion    TEXT
                          CHECK(
                            (anulado = 1 AND motivo_anulacion IS NOT NULL) OR
                            anulado = 0
                          ),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 12. CATEGORIAS_GASTO ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS categorias_gasto (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT    NOT NULL UNIQUE,
    activa  INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0, 1))
  )`,

  // ── 13. GASTOS_OPERATIVOS ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS gastos_operativos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id        INTEGER REFERENCES proveedores(id),
    categoria_id        INTEGER NOT NULL REFERENCES categorias_gasto(id),
    fecha               TEXT    NOT NULL,
    descripcion         TEXT,
    total_centavos      INTEGER NOT NULL CHECK(total_centavos > 0),
    estado              TEXT    NOT NULL DEFAULT 'pendiente'
                          CHECK(estado IN ('pendiente', 'parcial', 'pagado', 'anulado')),
    motivo_anulacion    TEXT
                          CHECK(
                            (estado  = 'anulado' AND motivo_anulacion IS NOT NULL) OR
                            (estado != 'anulado')
                          ),
    notas               TEXT,
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 14. PAGOS_GASTO ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS pagos_gasto (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    gasto_id            INTEGER NOT NULL REFERENCES gastos_operativos(id),
    fecha               TEXT    NOT NULL,
    monto_centavos      INTEGER NOT NULL CHECK(monto_centavos > 0),
    medio_pago          TEXT    NOT NULL
                          CHECK(medio_pago IN ('efectivo', 'transferencia', 'otro')),
    notas               TEXT,
    anulado             INTEGER NOT NULL DEFAULT 0 CHECK(anulado IN (0, 1)),
    motivo_anulacion    TEXT
                          CHECK(
                            (anulado = 1 AND motivo_anulacion IS NOT NULL) OR
                            anulado = 0
                          ),
    creado_en           TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 15. INSUMOS (Envases y materiales) ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS insumos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT    NOT NULL,
    unidad      TEXT    NOT NULL DEFAULT 'unidad',
    descripcion TEXT,
    stock_minimo INTEGER NOT NULL DEFAULT 0,
    activo      INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)),
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,

  // ── 16. MOVIMIENTOS_INSUMO ────────────────────────────────────────────────
  // Ledger firmado: positivo=entrada, negativo=salida. Fuente única de stock de insumos.
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

  // ── 17. PRESENTACION_INSUMOS ─────────────────────────────────────────────
  // Relación entre presentaciones y los insumos que consume cada unidad vendida.
  `CREATE TABLE IF NOT EXISTS presentacion_insumos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    presentacion_id     INTEGER NOT NULL REFERENCES presentaciones(id),
    insumo_id           INTEGER NOT NULL REFERENCES insumos(id),
    cantidad_por_unidad INTEGER NOT NULL DEFAULT 1 CHECK(cantidad_por_unidad > 0),
    activo              INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
  )`,

  // ── ÍNDICES ───────────────────────────────────────────────────────────────
  // ventas
  `CREATE INDEX IF NOT EXISTS idx_ventas_cliente  ON ventas(cliente_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_fecha    ON ventas(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_estado   ON ventas(estado)`,
  // items_venta
  `CREATE INDEX IF NOT EXISTS idx_items_venta     ON items_venta(venta_id)`,
  // cobros
  `CREATE INDEX IF NOT EXISTS idx_cobros_cliente  ON cobros(cliente_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cobros_venta    ON cobros(venta_id)`,
  `CREATE INDEX IF NOT EXISTS idx_cobros_fecha    ON cobros(fecha)`,
  // movimientos_stock
  `CREATE INDEX IF NOT EXISTS idx_mov_tipo_stock  ON movimientos_stock(tipo_stock)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_fecha       ON movimientos_stock(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_origen      ON movimientos_stock(tipo_origen, origen_id)`,
  // compras / pagos proveedores
  `CREATE INDEX IF NOT EXISTS idx_compras_prov    ON compras_proveedor(proveedor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_compras_fecha   ON compras_proveedor(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_prov      ON pagos_proveedor(proveedor_id)`,
  // gastos
  `CREATE INDEX IF NOT EXISTS idx_gastos_fecha    ON gastos_operativos(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_gastos_prov     ON gastos_operativos(proveedor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_gasto     ON pagos_gasto(gasto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_prov_compra ON pagos_proveedor(compra_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos_operativos(categoria_id)`,
  `CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos_operativos(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_gasto_anulado ON pagos_gasto(anulado)`,
  `CREATE INDEX IF NOT EXISTS idx_pagos_prov_anulado ON pagos_proveedor(anulado)`,
  // precios
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_precios_presentacion_uq ON precios_presentacion(categoria_precio_id, presentacion_id) WHERE activo = 1`,
  `CREATE INDEX IF NOT EXISTS idx_categorias_precio_activo ON categorias_precio(activo)`,
  `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_categoria ON precios_presentacion(categoria_precio_id)`,
  `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_presentacion ON precios_presentacion(presentacion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_precios_presentacion_activo ON precios_presentacion(activo)`,
  // insumos
  `CREATE INDEX IF NOT EXISTS idx_insumos_activo ON insumos(activo)`,
  // movimientos_insumo
  `CREATE INDEX IF NOT EXISTS idx_mov_insumo_insumo_id ON movimientos_insumo(insumo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_insumo_fecha ON movimientos_insumo(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_mov_insumo_tipo_origen ON movimientos_insumo(tipo_origen, origen_id)`,
  // presentacion_insumos
  `CREATE INDEX IF NOT EXISTS idx_pres_insumos_presentacion ON presentacion_insumos(presentacion_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pres_insumos_insumo ON presentacion_insumos(insumo_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pres_insumos_uq ON presentacion_insumos(presentacion_id, insumo_id) WHERE activo = 1`,
  // proveedores
  `CREATE INDEX IF NOT EXISTS idx_proveedores_categoria ON proveedores(categoria)`,

  // ── 18. CONFIGURACION_APP ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS configuracion_app (
    clave          TEXT PRIMARY KEY,
    valor          TEXT NOT NULL,
    actualizado_en TEXT
  )`,

  // ── 19. ITEMS_COMPRA_PROVEEDOR ──────────────────────────────────────────
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
];
