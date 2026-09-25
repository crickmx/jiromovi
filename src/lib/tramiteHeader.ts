// Fondo configurable del encabezado de un trámite.
// Lo usan el detalle (donde se ve de verdad) y el FormBuilder (donde se edita),
// para que la vista previa y el resultado no se puedan desincronizar.

import type { CSSProperties } from 'react';

export type TipoFondo = 'color' | 'degradado' | 'imagen';

export interface FondoHeader {
  tipo?: TipoFondo;
  color?: string;
  color2?: string;
  /** Grados de la línea del degradado. 135 = diagonal de arriba-izquierda a abajo-derecha. */
  angulo?: number;
  imagen_url?: string;
}

export const FONDO_POR_DEFECTO = '#6B7280';

/**
 * Texto negro o blanco según qué tan claro sea el fondo, por luminancia relativa
 * (WCAG). Es el criterio que el encabezado ya usaba para el color sólido.
 */
export function colorTextoSobre(hex: string): string {
  const limpio = hex.replace('#', '');
  if (limpio.length !== 6) return '#FFFFFF';
  const canal = (i: number) => parseInt(limpio.slice(i, i + 2), 16) / 255;
  const lineal = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lineal(canal(0)) + 0.7152 * lineal(canal(2)) + 0.0722 * lineal(canal(4));
  return L > 0.179 ? '#111827' : '#FFFFFF';
}

export interface EstiloHeader {
  /** Va en el contenedor del encabezado. */
  style: CSSProperties;
  /** Color de texto que garantiza contraste sobre ese fondo. */
  textColor: string;
  /**
   * Si el fondo necesita un velo oscuro encima para que el texto se lea. Con una
   * imagen o un degradado la luminancia no alcanza —puede haber zonas claras y
   * oscuras a la vez— así que se oscurece parejo y el texto va en blanco.
   */
  conVelo: boolean;
}

export function estiloHeader(fondo: FondoHeader | undefined, colorTipo?: string | null): EstiloHeader {
  const base = colorTipo || FONDO_POR_DEFECTO;

  if (fondo?.tipo === 'imagen' && fondo.imagen_url) {
    return {
      style: {
        backgroundImage: `url(${fondo.imagen_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      textColor: '#FFFFFF',
      conVelo: true,
    };
  }

  if (fondo?.tipo === 'degradado') {
    const a = fondo.color || base;
    const b = fondo.color2 || base;
    return {
      style: { backgroundImage: `linear-gradient(${fondo.angulo ?? 135}deg, ${a}, ${b})` },
      textColor: '#FFFFFF',
      conVelo: true,
    };
  }

  // Color sólido: se conserva el comportamiento anterior, sin velo, para que los
  // tipos que nadie ha editado se vean exactamente igual que antes.
  const color = fondo?.color || base;
  return {
    style: { backgroundColor: color },
    textColor: colorTextoSobre(color),
    conVelo: false,
  };
}

/** Capa del velo. Se pinta entre el fondo y el contenido. */
export const CLASE_VELO = 'absolute inset-0 bg-black/45 pointer-events-none';
