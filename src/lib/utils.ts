import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * La escala tipográfica propia de `tailwind.config.js` (`fontSize`).
 *
 * tailwind-merge no lee la config de Tailwind: un `text-<algo>` que no conoce
 * lo toma por COLOR. Sin esta lista, `cn('text-body-sm', 'text-neutral-500')`
 * borraba una de las dos clases sin avisar (el 10/11 un número del dashboard
 * salió chico porque se perdió `text-metric`). Si se agrega un tamaño a la
 * config, va también aquí.
 */
export const TAMANOS_TEXTO_SISTEMA = [
  'micro', 'caption', 'body-sm', 'body', 'body-lg',
  'title-sm', 'title', 'title-lg', 'display', 'metric',
] as const;

const twMergeSistema = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TAMANOS_TEXTO_SISTEMA] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeSistema(clsx(inputs));
}

/** Alias de `cn`: nació aparte en el rediseño de Correo/WhatsApp, cuando `cn` aún no conocía la escala. */
export const cnSistema = cn;

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
