import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDisplayName(user: {
  nombre_publico?: string | null;
  nombre_completo?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
} | null | undefined): string {
  if (!user) return '';
  if (user.nombre_publico?.trim()) return user.nombre_publico.trim();
  if (user.nombre_completo?.trim()) return user.nombre_completo.trim();
  const parts = [user.nombre, user.apellidos].filter(Boolean).join(' ').trim();
  return parts;
}

/**
 * Texto comparable: sin mayúsculas, sin acentos y sin espacios de sobra.
 *
 * Buscar "leon" tenía que encontrar "LEÓN", y "jose" a "José". Esta misma
 * línea está copiada en una decena de archivos del proyecto; los nuevos la
 * toman de aquí.
 */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
