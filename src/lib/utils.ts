import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the display name to use in user-generated outputs
 * (Mi Página Web, Publicidad, cotizaciones). Falls back to
 * nombre_completo, then "nombre apellidos", then empty string.
 * Editing nombre_publico never mutates nombre/apellidos.
 */
export function getDisplayName(usuario: {
  nombre_publico?: string | null;
  nombre_completo?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
} | null | undefined): string {
  if (!usuario) return '';
  const custom = usuario.nombre_publico?.trim();
  if (custom) return custom;
  const full = usuario.nombre_completo?.trim();
  if (full) return full;
  return [usuario.nombre, usuario.apellidos].filter(Boolean).join(' ').trim();
}
