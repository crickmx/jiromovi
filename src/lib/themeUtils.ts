/**
 * Sistema de theming dinámico por oficina
 * Convierte colores HEX a RGB y calcula contraste para accesibilidad
 */

export interface ThemeColors {
  accentRgb: string;
  accentForegroundRgb: string;
}

/**
 * Convierte un color HEX (#RRGGBB) a formato RGB "R G B"
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    console.warn(`Color HEX inválido: ${hex}, usando default`);
    return '14 35 226'; // Default azul MOVI
  }

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `${r} ${g} ${b}`;
}

/**
 * Calcula la luminancia relativa de un color RGB (0-255)
 * Según WCAG 2.0: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determina si debe usar texto blanco o negro sobre un color de fondo
 * para asegurar contraste adecuado (WCAG AA)
 */
export function getForegroundColor(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return '255 255 255'; // Blanco por defecto
  }

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  const luminance = getLuminance(r, g, b);

  // Si el fondo es oscuro (luminancia < 0.5), usar texto blanco
  // Si el fondo es claro, usar texto negro
  return luminance > 0.5 ? '0 0 0' : '255 255 255';
}

/**
 * Aplica el tema de la oficina actualizando las CSS variables globales
 */
export function applyTheme(accentColor: string): void {
  const root = document.documentElement;

  const accentRgb = hexToRgb(accentColor);
  const accentForegroundRgb = getForegroundColor(accentColor);

  root.style.setProperty('--movi-accent-rgb', accentRgb);
  root.style.setProperty('--movi-accent-foreground-rgb', accentForegroundRgb);

  // También establecer versiones con opacidad para estados hover/active
  const [r, g, b] = accentRgb.split(' ').map(Number);
  root.style.setProperty('--movi-accent-hover-rgb', `${Math.min(r + 20, 255)} ${Math.min(g + 20, 255)} ${Math.min(b + 20, 255)}`);
  root.style.setProperty('--movi-accent-dark-rgb', `${Math.max(r - 20, 0)} ${Math.max(g - 20, 0)} ${Math.max(b - 20, 0)}`);
}

/**
 * Remueve el tema personalizado y vuelve al default
 */
export function resetTheme(): void {
  applyTheme('#0E23E2'); // Azul MOVI default
}

/**
 * Obtiene los colores del tema actual
 */
export function getCurrentTheme(): ThemeColors {
  const root = document.documentElement;
  const accentRgb = getComputedStyle(root).getPropertyValue('--movi-accent-rgb').trim() || '14 35 226';
  const accentForegroundRgb = getComputedStyle(root).getPropertyValue('--movi-accent-foreground-rgb').trim() || '255 255 255';

  return {
    accentRgb,
    accentForegroundRgb,
  };
}
