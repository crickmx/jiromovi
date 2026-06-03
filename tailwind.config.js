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
        brand: {
          50: '#e8f4fd',
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
          50: '#f8fafc',
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
    },
  },
  plugins: [],
}

