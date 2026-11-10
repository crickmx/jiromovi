import { clsx, type ClassValue } from 'clsx';
import { twMerge, extendTailwindMerge } from 'tailwind-merge';

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

/**
 * Igual que `cn`, pero conoce la escala tipográfica del sistema visual
 * (`text-micro`, `text-body-sm`, `text-title`…). Con `cn`, tailwind-merge toma
 * esas clases por colores y, si van junto a un `text-<color>`, borra una de
 * las dos sin avisar. Se agregó aparte para no cambiar `cn` en toda la app.
 */
const twMergeSistema = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'body-sm', 'body', 'body-lg', 'title-sm', 'title', 'title-lg', 'display', 'metric'] }],
    },
  },
});
export function cnSistema(...inputs: ClassValue[]) {
  return twMergeSistema(clsx(inputs));
}
