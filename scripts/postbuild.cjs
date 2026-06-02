const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const notFoundPath = path.join(dist, "404.html");
const versionPath = path.join(dist, "version.json");

// ── 1. Copy index.html → 404.html for Netlify SPA fallback ──────────────────
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log("✅ Copiado dist/index.html -> dist/404.html");
} else {
  console.error("❌ No existe dist/index.html. ¿Corriste build?");
  process.exit(1);
}

// ── 2. Write version.json for remote version polling ─────────────────────────
// Format: YYYY.MM.DD.NNN  (date + milliseconds base-36 for uniqueness)
const now = new Date();
const datePart = now.toISOString().slice(0, 10).replace(/-/g, ".");
const timePart = now.getTime().toString(36);
const version = `${datePart}.${timePart}`;
const buildTimestamp = now.toISOString();

fs.writeFileSync(
  versionPath,
  JSON.stringify({ version, buildTimestamp }, null, 2),
  "utf8"
);
console.log(`✅ Escrito dist/version.json: ${version}`);
