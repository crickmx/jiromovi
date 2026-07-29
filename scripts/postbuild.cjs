const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const notFoundPath = path.join(dist, "404.html");

// ── 1. Copy index.html → 404.html for Netlify SPA fallback ──────────────────
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log("✅ Copiado dist/index.html -> dist/404.html");
} else {
  console.error("❌ No existe dist/index.html. ¿Corriste build?");
  process.exit(1);
}

// ── 2. version.json ──────────────────────────────────────────────────────────
// NO se escribe aquí a propósito. La ÚNICA fuente de verdad es el plugin
// `write-version-json` de vite.config.ts, que usa exactamente el mismo valor que
// se hornea en el bundle como `__APP_VERSION__`. Cuando este script lo
// sobrescribía con otro formato (YYYY.MM.DD.xxx), el version.json servido nunca
// coincidía con el bundle y `useAppUpdate.ts` recargaba la pestaña en bucle.
