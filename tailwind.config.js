import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Rediseño 2026-10: Manrope = interfaz/contenido (sobrescribe `sans`, así el preflight
        // y cualquier `font-sans` la usan en TODA la app); Sora = display (títulos, métricas,
        // navegación, botones). Ambas auto-hospedadas vía @fontsource-variable (main.tsx).
        // Gotham sigue cargada en index.css solo para firmas de e-mail / plecas / logos.
        sans: [
          'Manrope Variable',
          'Manrope',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'Sora Variable',
          'Sora',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        gotham: ['Gotham', 'Arial', 'Helvetica', 'sans-serif'],
      },
      fontSize: {
        // Escala reutilizable (además de la de Tailwind). Mínimo legible: 11px.
        'micro':     ['0.6875rem', { lineHeight: '1rem' }],      // 11px — overlines, badges
        'caption':   ['0.75rem',   { lineHeight: '1.1rem' }],    // 12px — ayudas
        'body-sm':   ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px — tablas densas
        'body':      ['0.875rem',  { lineHeight: '1.4rem' }],    // 14px — interfaz
        'body-lg':   ['1rem',      { lineHeight: '1.6rem' }],    // 16px — lectura
        'title-sm':  ['1.0625rem', { lineHeight: '1.4rem', letterSpacing: '-0.01em' }],
        'title':     ['1.25rem',   { lineHeight: '1.6rem', letterSpacing: '-0.015em' }],
        'title-lg':  ['1.625rem',  { lineHeight: '2rem',   letterSpacing: '-0.02em' }],
        'display':   ['2.25rem',   { lineHeight: '2.6rem', letterSpacing: '-0.025em' }],
        'metric':    ['1.75rem',   { lineHeight: '2rem',   letterSpacing: '-0.025em' }],
      },
      colors: {
        // Dynamic office accent – driven by CSS variables set in themeUtils.ts
        accent: {
          DEFAULT:    'rgb(var(--movi-accent-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--movi-accent-foreground-rgb) / <alpha-value>)',
          hover:      'rgb(var(--movi-accent-hover-rgb) / <alpha-value>)',
          dark:       'rgb(var(--movi-accent-dark-rgb) / <alpha-value>)',
          // Derivados (themeUtils.computeThemeVars) — `ink` = acento legible AA según tema
          ink:        'rgb(var(--accent-ink-rgb) / <alpha-value>)',
          soft:       'rgb(var(--movi-accent-soft-rgb) / <alpha-value>)',
          softer:     'rgb(var(--movi-accent-softer-rgb) / <alpha-value>)',
          deep:       'rgb(var(--movi-accent-deep-rgb) / <alpha-value>)',
          2:          'rgb(var(--movi-accent-2-rgb) / <alpha-value>)',
        },
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#090f1a',
          // Superficies del sistema (cambian solas con modo oscuro vía variables)
          canvas: 'rgb(var(--surface-canvas-rgb) / <alpha-value>)',
          card:   'rgb(var(--surface-card-rgb) / <alpha-value>)',
          muted:  'rgb(var(--surface-muted-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken-rgb) / <alpha-value>)',
        },
        // Alias heredados `ios-*` (usados en Seguros Education, exámenes, tienda y
        // Cédula A pero nunca definidos → antes no pintaban nada). Mapeados al sistema.
        ios: {
          gray: {
            50:  '#f7f6f3',
            100: '#efede8',
            200: '#e4e1db',
            300: '#d3cfc7',
            400: '#a19d95',
            500: '#78746c',
            600: '#57544e',
            900: '#1c1a17',
          },
          green:  '#059669',
          red:    '#dc2626',
          orange: '#d97706',
        },
      },
      borderRadius: {
        'ios':     '12px',
        'ios-lg':  '16px',
        'ios-xl':  '20px',
        'ios-2xl': '28px',
        'r-xs': 'var(--radius-xs)',
        'r-sm': 'var(--radius-sm)',
        'r-md': 'var(--radius-md)',
        'r-lg': 'var(--radius-lg)',
        'r-xl': 'var(--radius-xl)',
      },
      borderColor: {
        soft:   'var(--border-soft)',
        strong: 'var(--border-strong)',
      },
      boxShadow: {
        'e1':     'var(--shadow-1)',
        'e2':     'var(--shadow-2)',
        'e3':     'var(--shadow-3)',
        'e4':     'var(--shadow-4)',
        'accent': 'var(--shadow-accent)',
        'ios':        'var(--shadow-2)',
        'ios-xl':     'var(--shadow-4)',
        'card':       'var(--shadow-2)',
        'card-hover': 'var(--shadow-3)',
        'ios-sm':     '0 2px 8px rgba(0,0,0,0.08)',
        'ios-md':     '0 4px 16px rgba(0,0,0,0.10)',
        'ios-lg':     '0 8px 32px rgba(0,0,0,0.14)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16,1,0.3,1)',
        spring: 'cubic-bezier(0.34,1.36,0.64,1)',
      },
      // Opacidades usadas en todo el código (bg-white/6, /8, /12…) que no existen en la
      // escala por defecto → antes esas clases no se generaban (sobre todo en modo oscuro).
      opacity: {
        '3': '0.03', '6': '0.06', '8': '0.08', '12': '0.12',
        '14': '0.14', '18': '0.18', '22': '0.22', '97': '0.97',
      },
      backdropBlur: {
        ios: '12px',
      },
      transitionDuration: {
        fast: '180ms',
        base: '240ms',
        slow: '350ms',
      },
      animation: {
        'fade-in':    'fade-in 0.2s ease-out both',
        'slide-up':   'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'shimmer':    'shimmer 1.6s infinite',
        'alerta-pulso': 'alerta-pulso 0.9s ease-in-out infinite',
        'bug-btn-idle': 'bug-btn-idle 3s ease-in-out infinite',
        'rise':       'movi-rise 0.32s cubic-bezier(0.16,1,0.3,1) both',
        'pop':        'movi-pop 0.35s cubic-bezier(0.34,1.36,0.64,1) both',
        'scale-in':   'scale-in 0.22s cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'alerta-pulso': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(220,38,38,0.55)' },
          '50%':      { boxShadow: '0 0 0 9px rgba(220,38,38,0)' },
        },
        'bug-btn-idle': {
          '0%, 100%': { backgroundPosition: '0% 50%', transform: 'scale(1)' },
          '50%':      { backgroundPosition: '100% 50%', transform: 'scale(1.04)' },
        },
      },
    },
  },
  plugins: [
    typography,
  ],
}
// Forzar redeploy después de cambios visuales en dashboard-editor
