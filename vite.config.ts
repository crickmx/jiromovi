import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const APP_VERSION = String(Date.now())

// Escribe dist/version.json en cada build — useAppUpdate.ts lo consulta cada 5 min
// para detectar un deploy nuevo y recargar la pestaña sola.
function versionJsonPlugin() {
  return {
    name: 'write-version-json',
    apply: 'build' as const,
    closeBundle() {
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/version.json'),
        JSON.stringify({ version: APP_VERSION, buildTimestamp: new Date().toISOString() })
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    assetsDir: '_static',
  },
})
