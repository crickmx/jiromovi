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

// ── Derivados del acento (rediseño 2026-10) ──────────────────────────────────
// Todo se calcula a partir del ÚNICO color configurable (oficinas.accent_color o
// el color primario del agente en Seguwallet). Nada de esto se guarda en BD.

type RGB = [number, number, number];

const parseRgb = (rgb: string): RGB => rgb.split(' ').map(Number) as RGB;
const fmt = ([r, g, b]: RGB) => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;

/** Mezcla lineal en sRGB: t=0 → a, t=1 → b */
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Ajusta un color hacia `toward` (negro o blanco) en pasos hasta que alcanza
 * `target` de contraste contra `bg`. Garantiza texto AA del color de marca sobre
 * superficies claras/oscuras aunque la oficina elija un amarillo o un azul marino.
 */
function ensureContrast(color: RGB, bg: RGB, toward: RGB, target = 4.5): RGB {
  let c = color;
  for (let i = 0; i < 20 && getContrastRatio(fmt(c), fmt(bg)) < target; i++) {
    c = mix(color, toward, (i + 1) / 20);
  }
  return c;
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const LIGHT_SURFACE: RGB = [255, 255, 255];
const DARK_SURFACE: RGB = [17, 17, 20];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

/**
 * Calcula TODAS las variables CSS del tema a partir de un color HEX.
 * Las 4 originales (`--movi-accent-*-rgb`) conservan exactamente su fórmula previa.
 */
export function computeThemeVars(accentColor: string): Record<string, string> {
  const accentRgb = hexToRgb(accentColor);
  const accentForegroundRgb = getForegroundColor(accentColor);
  const base = parseRgb(accentRgb);
  const [r, g, b] = base;
  const [h, s, l] = rgbToHsl(base);

  // Segundo tono para gradientes: vecino análogo (-22°, hacia tonos más frescos/cálidos
  // según el caso: azul→cian, amarillo→ámbar, rojo→magenta) y algo más luminoso.
  const companion = hslToRgb(h - 22, Math.min(1, s * 0.95), Math.max(0.32, Math.min(0.6, l + 0.08)));

  return {
    '--movi-accent-rgb': accentRgb,
    '--movi-accent-foreground-rgb': accentForegroundRgb,
    '--movi-accent-hover-rgb': `${Math.min(r + 20, 255)} ${Math.min(g + 20, 255)} ${Math.min(b + 20, 255)}`,
    '--movi-accent-dark-rgb': `${Math.max(r - 20, 0)} ${Math.max(g - 20, 0)} ${Math.max(b - 20, 0)}`,
    // Texto/enlaces/íconos del color de marca con contraste AA garantizado
    '--movi-accent-text-rgb': fmt(ensureContrast(base, LIGHT_SURFACE, BLACK)),
    '--movi-accent-text-on-dark-rgb': fmt(ensureContrast(base, DARK_SURFACE, WHITE)),
    // Fondos tintados (chips activos, hero, halos)
    '--movi-accent-soft-rgb': fmt(mix(base, WHITE, 0.9)),
    '--movi-accent-softer-rgb': fmt(mix(base, WHITE, 0.95)),
    '--movi-accent-deep-rgb': fmt(mix(base, BLACK, 0.45)),
    '--movi-accent-2-rgb': fmt(companion),
  };
}

/**
 * Aplica el tema de la oficina actualizando las CSS variables globales.
 * También recalcula hover y dark variants automáticamente.
 */
export function applyTheme(accentColor: string): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(computeThemeVars(accentColor))) {
    root.style.setProperty(k, v);
  }
}

/** Vuelve al tema azul corporativo de JIRO */
export function resetTheme(): void {
  applyTheme('#1e40af');
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
