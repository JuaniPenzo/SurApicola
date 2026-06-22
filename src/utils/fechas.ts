// =============================================================================
// SurApícola — Utilidades de fechas compartidas
// Usar SIEMPRE estas funciones para garantizar consistencia en hora LOCAL (GMT-3)
// =============================================================================

import type { RangoReporte } from '../types';

/** Alias reutilizable para el tipo de rango de fecha */
export type RangoFiltro = RangoReporte; // 'hoy' | 'semana' | 'mes' | 'entre_fechas'

/**
 * Retorna un string YYYY-MM-DD usando la HORA LOCAL del dispositivo (no UTC).
 * Es importante NO usar .toISOString() porque devuelve UTC y puede dar el día anterior
 * para usuarios en GMT-3 o similares.
 */
export function obtenerFechaLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD usando hora local.
 * Reemplaza a fechaHoy() de format.ts (que usaba UTC con toISOString).
 */
export function fechaHoyLocal(): string {
  return obtenerFechaLocalYMD(new Date());
}

/**
 * Calcula desde/hasta para un rango predefinido usando hora local.
 * - 'hoy': desde=hasta=hoy
 * - 'semana': desde=lunes de la semana actual, hasta=hoy
 * - 'mes': desde=día 1 del mes actual, hasta=hoy
 * - 'entre_fechas': devuelve hoy para ambos (el caller debe sobrescribirlos)
 */
export function obtenerFechasRango(rango: RangoFiltro): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = obtenerFechaLocalYMD(hoy);
  let desde = hasta;

  switch (rango) {
    case 'hoy':
      desde = hasta;
      break;
    case 'semana': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
      const day = d.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
      const diffToMonday = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diffToMonday);
      desde = obtenerFechaLocalYMD(d);
      break;
    }
    case 'mes': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      desde = obtenerFechaLocalYMD(d);
      break;
    }
    case 'entre_fechas':
      desde = hasta;
      break;
  }

  return { desde, hasta };
}

/**
 * Valida un rango de fechas personalizado.
 * @returns null si el rango es válido, o un mensaje de error si no lo es.
 */
export function validarRangoPersonalizado(desde: string, hasta: string): string | null {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!desde || !desde.trim()) return 'Falta ingresar la fecha Desde.';
  if (!hasta || !hasta.trim()) return 'Falta ingresar la fecha Hasta.';
  if (!dateRegex.test(desde)) return 'La fecha Desde debe tener el formato AAAA-MM-DD.';
  if (!dateRegex.test(hasta)) return 'La fecha Hasta debe tener el formato AAAA-MM-DD.';

  const d1 = new Date(desde + 'T00:00:00');
  const d2 = new Date(hasta + 'T00:00:00');

  if (isNaN(d1.getTime())) return 'La fecha Desde es inválida.';
  if (isNaN(d2.getTime())) return 'La fecha Hasta es inválida.';
  if (d1 > d2) return 'La fecha Desde no puede ser mayor que la fecha Hasta.';

  return null;
}
