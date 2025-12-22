const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const publicDir = path.join(__dirname, "..", "public");
const indexPath = path.join(dist, "index.html");
const notFoundPath = path.join(dist, "404.html");
const redirectsSource = path.join(publicDir, "_redirects");
const redirectsDest = path.join(dist, "_redirects");

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log("✅ Copiado dist/index.html -> dist/404.html");
} else {
  console.error("❌ No existe dist/index.html. ¿Corriste build?");
  process.exit(1);
}

if (fs.existsSync(redirectsSource)) {
  fs.copyFileSync(redirectsSource, redirectsDest);
  console.log("✅ Copiado public/_redirects -> dist/_redirects");
} else {
  console.error("⚠️  No existe public/_redirects");
}
