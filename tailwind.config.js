/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic office accent – driven by CSS variables set in themeUtils.ts
        accent: {
          DEFAULT:    'rgb(var(--movi-accent-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--movi-accent-foreground-rgb) / <alpha-value>)',
          hover:      'rgb(var(--movi-accent-hover-rgb) / <alpha-value>)',
          dark:       'rgb(var(--movi-accent-dark-rgb) / <alpha-value>)',
        },
        brand: {
          50:  '#e8f4fd',
          100: '#c5e4fa',
          200: '#9dcef5',
          300: '#70b5ef',
          400: '#4a9fe8',
          500: '#2285de',
          600: '#1a6bbf',
          700: '#1354a0',
          800: '#0d3e80',
          900: '#082b5e',
        },
        primary: {
          50:  '#e8f4fd',
          100: '#c5e4fa',
          200: '#9dcef5',
          300: '#70b5ef',
          400: '#4a9fe8',
          500: '#2285de',
          600: '#1a6bbf',
          700: '#1354a0',
          800: '#0d3e80',
          900: '#082b5e',
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
        },
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 8px 24px -4px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.03)',
        'ios-sm':     '0 2px 8px rgba(0,0,0,0.08)',
        'ios-md':     '0 4px 16px rgba(0,0,0,0.10)',
        'ios-lg':     '0 8px 32px rgba(0,0,0,0.14)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.16,1,0.3,1)',
      },
      animation: {
        'fade-in':    'fade-in 0.2s ease-out both',
        'slide-up':   'slide-up 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'shimmer':    'shimmer 1.6s infinite',
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
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
