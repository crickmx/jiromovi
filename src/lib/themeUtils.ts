/**
 * Sistema de theming dinámico por oficina
 * Convierte colores HEX a RGB y calcula contraste WCAG para accesibilidad
 */

export interface ThemeColors {
  accentRgb: string;
  accentForegroundRgb: string;
}

/** Convierte HEX (#RRGGBB) a formato RGB "R G B" */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    console.warn(`Color HEX inválido: ${hex}, usando default`);
    return '22 66 129'; // #164281
  }
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

/**
 * Luminancia relativa WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Ratio de contraste WCAG entre dos colores RGB.
 * Retorna un valor entre 1 y 21.
 */
export function getContrastRatio(rgb1: string, rgb2: string): number {
  const parse = (rgb: string) => rgb.split(' ').map(Number) as [number, number, number];
  const [r1, g1, b1] = parse(rgb1);
  const [r2, g2, b2] = parse(rgb2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determina si usar texto blanco o negro sobre un fondo HEX
 * para garantizar contraste WCAG AA (≥ 4.5:1 para texto normal).
 * Retorna RGB string "R G B".
 */
export function getForegroundColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255 255 255';

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const bgRgb  = `${r} ${g} ${b}`;

  const whiteContrast = getContrastRatio(bgRgb, '255 255 255');
  const blackContrast = getContrastRatio(bgRgb, '0 0 0');

  // Pick whichever is higher — must be ≥ 4.5:1 for WCAG AA
  return whiteContrast >= blackContrast ? '255 255 255' : '0 0 0';
}

/**
 * getAccessibleColor — retorna un color de texto que garantiza
 * contraste WCAG AA mínimo sobre el fondo dado (HEX o "R G B").
 *
 * @param background  Color de fondo en HEX (#rrggbb) o RGB "R G B"
 * @param preferDark  Si true, prefiere negro cuando ambos pasan AA
 * @returns CSS color string: 'rgb(255 255 255)' | 'rgb(0 0 0)'
 */
export function getAccessibleColor(background: string, preferDark = false): string {
  let bgRgb: string;

  if (background.startsWith('#')) {
    bgRgb = hexToRgb(background);
  } else {
    bgRgb = background.trim();
  }

  const whiteContrast = getContrastRatio(bgRgb, '255 255 255');
  const blackContrast = getContrastRatio(bgRgb, '0 0 0');

  if (preferDark) {
    return blackContrast >= 4.5 ? 'rgb(0 0 0)' : 'rgb(255 255 255)';
  }
  return whiteContrast >= blackContrast ? 'rgb(255 255 255)' : 'rgb(0 0 0)';
}

/**
 * Aplica el tema de la oficina actualizando las CSS variables globales.
 * También recalcula hover y dark variants automáticamente.
 */
export function applyTheme(accentColor: string): void {
  const root = document.documentElement;

  const accentRgb = hexToRgb(accentColor);
  const accentForegroundRgb = getForegroundColor(accentColor);

  root.style.setProperty('--movi-accent-rgb', accentRgb);
  root.style.setProperty('--movi-accent-foreground-rgb', accentForegroundRgb);

  // Hover = slightly lighter, dark = slightly darker
  const [r, g, b] = accentRgb.split(' ').map(Number);
  root.style.setProperty(
    '--movi-accent-hover-rgb',
    `${Math.min(r + 20, 255)} ${Math.min(g + 20, 255)} ${Math.min(b + 20, 255)}`
  );
  root.style.setProperty(
    '--movi-accent-dark-rgb',
    `${Math.max(r - 20, 0)} ${Math.max(g - 20, 0)} ${Math.max(b - 20, 0)}`
  );
}

/** Vuelve al tema azul corporativo de MOVI */
export function resetTheme(): void {
  applyTheme('#164281');
}

/** Obtiene los colores del tema activo */
export function getCurrentTheme(): ThemeColors {
  const root = document.documentElement;
  const accentRgb = getComputedStyle(root).getPropertyValue('--movi-accent-rgb').trim() || '22 66 129';
  const accentForegroundRgb = getComputedStyle(root).getPropertyValue('--movi-accent-foreground-rgb').trim() || '255 255 255';
  return { accentRgb, accentForegroundRgb };
}

/**
 * Verifica si un par de colores pasa WCAG AA.
 * @param foregroundRgb  "R G B"
 * @param backgroundRgb  "R G B"
 * @param isLargeText    true = umbral 3:1, false = umbral 4.5:1
 */
export function passesWCAG_AA(
  foregroundRgb: string,
  backgroundRgb: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foregroundRgb, backgroundRgb);
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}
