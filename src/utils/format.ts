// =============================================================================
// SurApícola — Utilidades de formato
// =============================================================================

/**
 * Convierte centavos (entero) a string de moneda.
 * Ej: 150000 → "$1.500,00"
 */
export function formatearDinero(centavos: number): string {
  const pesos = centavos / 100;
  return pesos.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  });
}

/**
 * Convierte gramos (entero) a string legible.
 * < 1000 g → muestra en gramos: "750 g"
 * >= 1000 g → muestra en kg con 2 decimales: "1,50 kg"
 */
export function formatearGramos(gramos: number): string {
  if (gramos === 0) return '0 g';
  if (Math.abs(gramos) < 1000) return `${gramos} g`;
  const kg = gramos / 1000;
  return `${kg.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`;
}

/**
 * Convierte gramos a kg como número (para cálculos).
 */
export function gramosAKg(gramos: number): number {
  return gramos / 1000;
}

/**
 * Formatea unidades de panal.
 * Ej: 3 → "3 unidades", 1 → "1 unidad"
 */
export function formatearUnidades(cantidad: number): string {
  if (cantidad === 1) return '1 unidad';
  return `${cantidad} unidades`;
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD o datetime) a formato legible argentino.
 * Ej: "2025-06-12" → "12/06/2025"
 */
export function formatearFecha(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

import { obtenerFechaLocalYMD } from './fechas';

/**
 * Retorna la fecha actual en formato YYYY-MM-DD (para guardar en SQLite) usando hora local.
 */
export function fechaHoy(): string {
  return obtenerFechaLocalYMD(new Date());
}
