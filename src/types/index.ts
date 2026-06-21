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
  email: string | null;
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

export type CategoriaProveedor = 'miel_panales' | 'envases' | 'otros';

export interface Proveedor {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  categoria: CategoriaProveedor;
  activo: 0 | 1;
  creado_en: string;
}

export type EstadoCompra = 'pendiente' | 'parcial' | 'pagada' | 'anulada';

export interface CompraProveedor {
  id: number;
  proveedor_id: number;
  fecha: string;
  tipo_stock: TipoStock;
  cantidad: number;
  total_centavos: number;
  estado: EstadoCompra;
  notas: string | null;
  anulada: 0 | 1;
  motivo_anulacion: string | null;
  creado_en: string;
}

export interface PagoProveedor {
  id: number;
  proveedor_id: number;
  compra_id: number | null;
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

// ---------------------------------------------------------------------------
// Stock (Fase 2)
// ---------------------------------------------------------------------------

export type ProductoStock = 'miel' | 'panal';
export type SentidoStock = 'entrada' | 'salida';
export type EstadoOrigenStock = 'activo' | 'anulado';

export interface StockActual {
  mielGramos: number;
  panalUnidades: number;
}

export interface MovimientoStockUI {
  id: number;
  fecha: string;
  producto: ProductoStock;
  sentido: SentidoStock;
  cantidad: number;
  origen_tipo: string;
  origen_id: number | null;
  nota: string | null;
  estado_origen: EstadoOrigenStock;
  item_nombre?: string | null;
  perdida_motivo?: string | null;
}

// ---------------------------------------------------------------------------
// Reportes (Fase 5)
// ---------------------------------------------------------------------------

export type RangoReporte = 'hoy' | 'semana' | 'mes' | 'entre_fechas';

export interface ResumenFinanciero {
  ventasDevengadas: number;
  cobrosReales: number;
  comprasDevengadas: number;
  pagosProveedoresReales: number;
  gastosDevengados: number;
  pagosGastosReales: number;
  balanceCajaReal: number;
  resultadoOperativoDevengado: number;
}

export interface ResumenVentas {
  cantidad: number;
  totalVendido: number;
  totalCobrado: number;
  saldoPendiente: number;
  ticketPromedio: number;
  ventaMasReciente: string | null;
}

export interface ResumenCompras {
  cantidad: number;
  totalComprado: number;
  totalPagado: number;
  saldoPendiente: number;
  compraMasReciente: string | null;
}

export interface CategoriaGastoResumen {
  categoria: string;
  total_centavos: number;
}

export interface ResumenGastos {
  cantidad: number;
  totalDevengado: number;
  totalPagado: number;
  saldoPendiente: number;
  categorias: CategoriaGastoResumen[];
}

export interface ResumenStock {
  stockMielActual: number;
  stockPanalActual: number;
  entradasMiel: number;
  entradasPanal: number;
  salidasMiel: number;
  salidasPanal: number;
  cosechasMiel: number;
  cosechasPanal: number;
  perdidasMiel: number;
  perdidasPanal: number;
}

export interface ReporteGeneral {
  financiero: ResumenFinanciero;
  ventas: ResumenVentas;
  compras: ResumenCompras;
  gastos: ResumenGastos;
  stock: ResumenStock;
}

// ---------------------------------------------------------------------------
// Precios (Fase 8 - Prompt 2)
// ---------------------------------------------------------------------------

export interface CategoriaPrecio {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: 0 | 1;
  creado_en: string;
  actualizado_en: string | null;
}

export interface PrecioPresentacion {
  id: number;
  categoria_precio_id: number;
  presentacion_id: number;
  precio_centavos: number;
  activo: 0 | 1;
  creado_en: string;
  actualizado_en: string | null;
}

export interface PrecioPresentacionDetalle {
  presentacion_id: number;
  codigo: string;
  nombre: string;
  tipo: TipoPresentacion;
  precio_actual_centavos: number | null;
  precio_presentacion_id: number | null;
}

export interface CrearCategoriaPrecioInput {
  nombre: string;
  descripcion: string | null;
}

export interface ActualizarCategoriaPrecioInput {
  nombre: string;
  descripcion: string | null;
}

export interface GuardarPrecioPresentacionInput {
  categoria_precio_id: number;
  presentacion_id: number;
  precio_centavos: number;
}
// ---------------------------------------------------------------------------
// Insumos y Envases (Prompt 3)
// ---------------------------------------------------------------------------

export type TipoOrigenInsumo =
  | 'compra_insumo'
  | 'ajuste_entrada'
  | 'ajuste_salida'
  | 'venta_item'
  | 'anulacion_venta_item';

export interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  descripcion: string | null;
  stock_minimo: number;
  activo: 0 | 1;
  creado_en: string;
  // Calculado en runtime via SUM(movimientos_insumo)
  stock_actual?: number;
}

export interface MovimientoInsumo {
  id: number;
  insumo_id: number;
  fecha: string;
  cantidad: number; // positivo=entrada, negativo=salida
  tipo_origen: TipoOrigenInsumo;
  origen_id: number | null;
  notas: string | null;
  creado_en: string;
}

export interface PresentacionInsumo {
  id: number;
  presentacion_id: number;
  insumo_id: number;
  cantidad_por_unidad: number;
  activo: 0 | 1;
  // Joins opcionales
  insumo_nombre?: string;
  insumo_unidad?: string;
}

export interface AdvertenciaStockInsumo {
  insumo_nombre: string;
  stockActual: number;
  requerido: number;
  diferencia: number;
}

// ---------------------------------------------------------------------------
// Cuenta Corriente y Alertas de Stock (Prompt 4)
// ---------------------------------------------------------------------------

export interface CuentaClienteResumen {
  clienteId: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  totalVendido: number;  // centavos
  totalCobrado: number;  // centavos
  saldoPendiente: number; // centavos
  ultimaVentaFecha: string | null;
  ultimoCobroFecha: string | null;
}

export interface MovimientoCuentaCliente {
  id: number;
  tipo: 'venta' | 'cobro';
  fecha: string;
  descripcion: string;
  monto: number; // centavos
  referenciaId: number;
  estado: string;
}

export interface CuentaProveedorResumen {
  proveedorId: number;
  nombre: string;
  categoria: CategoriaProveedor;
  telefono: string | null;
  email: string | null;
  totalComprado: number;  // centavos
  totalPagado: number;    // centavos
  saldoPendiente: number; // centavos
  ultimaCompraFecha: string | null;
  ultimoPagoFecha: string | null;
}

export interface MovimientoCuentaProveedor {
  id: number;
  tipo: 'compra' | 'pago';
  fecha: string;
  descripcion: string;
  monto: number; // centavos
  referenciaId: number;
  estado?: string;
}

export interface AlertaStock {
  tipo: 'miel' | 'panal' | 'insumo';
  id?: number;
  nombre: string;
  disponible: number;
  minimo: number;
  unidad: string;
}

// ---------------------------------------------------------------------------
// Configuración, Exportación y Backups (Prompt 5)
// ---------------------------------------------------------------------------

export interface ConfiguracionGeneral {
  nombre_emprendimiento: string;
  telefono_emprendimiento: string;
  direccion_emprendimiento: string;
  email_emprendimiento: string;
  moneda: string;
  unidad_miel_principal: string;
  ultimo_backup_fecha?: string;
}

export interface ExportacionResultado {
  exito: boolean;
  archivoRuta?: string;
  error?: string;
}

export interface BackupResultado {
  exito: boolean;
  archivoRuta?: string;
  fecha?: string;
  error?: string;
}

export interface ResumenNegocioExportable {
  fechaExportacion: string;
  nombreEmprendimiento: string;
  stockMielKg: number;
  stockPanalUnidades: number;
  insumosBajoStockCount: number;
  totalClientes: number;
  totalProveedores: number;
  totalVendidoHistoricoCentavos: number;
  totalCobradoHistoricoCentavos: number;
  deudaClientesTotalCentavos: number;
  totalCompradoHistoricoCentavos: number;
  totalPagadoProveedoresCentavos: number;
  deudaProveedoresTotalCentavos: number;
  gastosTotalesCentavos: number;
  cajaRealAproximadaCentavos: number;
}


