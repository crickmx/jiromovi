const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const notFoundPath = path.join(dist, "404.html");

// ── 1. Copy index.html → 404.html for Netlify SPA fallback ──────────────────
if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log("✅ Copiado dist/index.html -> dist/404.html");

  // ── 1.0 mutuus.html: el mismo index con título, íconos e imagen social de Mutuus ─
  // WhatsApp, Facebook y Google leen el HTML sin ejecutar la app, así que el
  // <head> de MOVI es lo que verían al compartir mutuus.mx. El .htaccess sirve
  // este archivo cuando el host es mutuus.mx.
  const html = fs.readFileSync(indexPath, "utf8");
  const ini = html.indexOf("<!-- meta-sitio:inicio");
  const finMarca = "<!-- meta-sitio:fin -->";
  const fin = html.indexOf(finMarca);
  if (ini === -1 || fin === -1) {
    console.error("❌ index.html no trae las marcas meta-sitio: no se pudo generar mutuus.html");
    process.exit(1);
  }
  const titulo = "Seguro Médico Inteligente Mutuus | Sin deducible ni coaseguro";
  const descripcion = "Gastos médicos mayores y menores sin deducible ni coaseguro, con una red de más de 500 hospitales en México. Planes UNO, DOS y Plus.";
  const imagen = "https://mutuus.mx/brand/mutuus/og-mutuus.jpg?v=1";
  const metaMutuus = `<link rel="icon" type="image/png" sizes="32x32" href="/brand/mutuus/icon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/brand/mutuus/icon-192.png" />
    <link rel="apple-touch-icon" href="/brand/mutuus/icon-180.png" />
    <link rel="manifest" href="/brand/mutuus/manifest.webmanifest" />
    <meta name="theme-color" content="#003896" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <title>${titulo}</title>
    <meta name="description" content="${descripcion}" />
    <link rel="canonical" href="https://mutuus.mx/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mutuus Salud Inteligente" />
    <meta property="og:url" content="https://mutuus.mx/" />
    <meta property="og:title" content="${titulo}" />
    <meta property="og:description" content="${descripcion}" />
    <meta property="og:image" content="${imagen}" />
    <meta property="og:image:secure_url" content="${imagen}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Mutuus Salud Inteligente — Seguro Médico Inteligente sin deducible ni coaseguro" />
    <meta property="og:locale" content="es_MX" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titulo}" />
    <meta name="twitter:description" content="${descripcion}" />
    <meta name="twitter:image" content="${imagen}" />
    <meta name="twitter:image:alt" content="Mutuus Salud Inteligente — Seguro Médico Inteligente sin deducible ni coaseguro" />
    `;
  const mutuus = (html.slice(0, ini) + metaMutuus + html.slice(fin + finMarca.length))
    .replace('<html lang="es">', '<html lang="es-MX">');
  fs.writeFileSync(path.join(dist, "mutuus.html"), mutuus);
  console.log("✅ Generado dist/mutuus.html (meta de Mutuus para compartir)");

  // ── 1.1 Respaldo a dist_backup para cero downtime en deploys de Plesk ─────
  try {
    const distBackup = path.join(__dirname, "..", "dist_backup");
    fs.cpSync(dist, distBackup, { recursive: true });
    console.log("✅ Respaldo generado en dist_backup/");
  } catch (err) {
    console.warn("⚠️ No se pudo generar dist_backup:", err.message);
  }
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
