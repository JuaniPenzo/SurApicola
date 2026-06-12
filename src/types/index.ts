// =============================================================================
// SurApícola — Tipos TypeScript globales
// =============================================================================

// ---------------------------------------------------------------------------
// Presentaciones
// ---------------------------------------------------------------------------

export type TipoPresentacion = 'miel' | 'panal';

export interface Presentacion {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoPresentacion;
  gramos_por_unidad: number;      // 0 para panal
  unidades_panal_por_unidad: number; // 0 para miel
  precio_centavos: number;
  activa: 0 | 1;
  creado_en: string;
}

/** Códigos fijos de las presentaciones precargadas */
export const CODIGOS_PRESENTACION = {
  FRASCO_250G: 'FRASCO_250G',
  FRASCO_500G: 'FRASCO_500G',
  FRASCO_1KG: 'FRASCO_1KG',
  BALDE_15KG: 'BALDE_15KG',
  BALDE_30KG: 'BALDE_30KG',
  PANAL_UNIDAD: 'PANAL_UNIDAD',
} as const;

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  activo: 0 | 1;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export type EstadoVenta = 'pendiente' | 'parcial' | 'pagada' | 'anulada';

export interface Venta {
  id: number;
  cliente_id: number;
  fecha: string;
  total_centavos: number;
  estado: EstadoVenta;
  motivo_anulacion: string | null;
  notas: string | null;
  creado_en: string;
}

export interface ItemVenta {
  id: number;
  venta_id: number;
  presentacion_id: number;
  cantidad: number;
  precio_unitario_centavos: number;
  subtotal_centavos: number;
  // Snapshots
  codigo_snap: string;
  nombre_snap: string;
  tipo_snap: TipoPresentacion;
  gramos_por_unidad_snap: number;
  unidades_panal_por_unidad_snap: number;
}

// ---------------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------------

export type MedioPago = 'efectivo' | 'transferencia' | 'otro';
export type EstadoCobro = 'activo' | 'anulado';

export interface Cobro {
  id: number;
  cliente_id: number;
  venta_id: number | null;
  fecha: string;
  monto_centavos: number;
  medio_pago: MedioPago;
  estado: EstadoCobro;
  motivo_anulacion: string | null;
  notas: string | null;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Movimientos de stock
// ---------------------------------------------------------------------------

export type TipoStock = 'miel' | 'panal';

export type TipoOrigenMovimiento =
  | 'cosecha'
  | 'compra'
  | 'venta_item'
  | 'perdida'
  | 'anulacion_cosecha'
  | 'anulacion_compra'
  | 'anulacion_venta_item'
  | 'anulacion_perdida';

export interface MovimientoStock {
  id: number;
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number; // positivo = entrada, negativo = salida
  tipo_origen: TipoOrigenMovimiento;
  origen_id: number;
  notas: string | null;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Cosechas y Pérdidas
// ---------------------------------------------------------------------------

export interface RegistroCosecha {
  id: number;
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number;
  notas: string | null;
  anulado: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

export interface RegistroPerdida {
  id: number;
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number;
  motivo: string;
  notas: string | null;
  anulado: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  notas: string | null;
  activo: 0 | 1;
  creado_en: string;
}

export interface CompraProveedor {
  id: number;
  proveedor_id: number;
  fecha: string;
  gramos_comprados: number;
  total_centavos: number;
  notas: string | null;
  anulada: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

export interface PagoProveedor {
  id: number;
  proveedor_id: number;
  fecha: string;
  monto_centavos: number;
  medio_pago: MedioPago;
  notas: string | null;
  anulado: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Gastos operativos
// ---------------------------------------------------------------------------

export type EstadoGasto = 'pendiente' | 'parcial' | 'pagado' | 'anulado';

export interface CategoriaGasto {
  id: number;
  nombre: string;
  activa: 0 | 1;
}

export interface GastoOperativo {
  id: number;
  proveedor_id: number | null;
  categoria_id: number;
  fecha: string;
  descripcion: string | null;
  total_centavos: number;
  estado: EstadoGasto;
  motivo_anulacion: string | null;
  notas: string | null;
  creado_en: string;
}

export interface PagoGasto {
  id: number;
  gasto_id: number;
  fecha: string;
  monto_centavos: number;
  medio_pago: MedioPago;
  notas: string | null;
  anulado: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  stockMielGramos: number;    // Mostrar como kg en UI: / 1000
  stockPanalUnidades: number;
  ventasHoyCentavos: number;
  cobrosHoyCentavos: number;
  gastosHoyCentavos: number;
}
