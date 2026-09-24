import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const APP_VERSION = String(Date.now())
const BUILD_TIME = new Date().toISOString()

let COMMIT_HASH = process.env.COMMIT_HASH?.trim()
  || process.env.GITHUB_SHA?.slice(0, 7)
  || 'unknown'

if (COMMIT_HASH === 'unknown') {
  try {
    COMMIT_HASH = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    // Los builds sin metadatos de Git (por ejemplo, un ZIP) siguen siendo válidos.
  }
}

// Escribe dist/version.json en cada build — useAppUpdate.ts lo consulta cada 5 min
// para detectar un deploy nuevo y recargar la pestaña sola.
function versionJsonPlugin() {
  return {
    name: 'write-version-json',
    apply: 'build' as const,
    closeBundle() {
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/version.json'),
        JSON.stringify({
          version: APP_VERSION,
          commitHash: COMMIT_HASH,
          buildTimestamp: BUILD_TIME,
        })
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __COMMIT_HASH__: JSON.stringify(COMMIT_HASH),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
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
