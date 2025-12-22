const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const notFoundPath = path.join(dist, "404.html");

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  console.log("✅ Copiado dist/index.html -> dist/404.html");
} else {
  console.error("❌ No existe dist/index.html. ¿Corriste build?");
  process.exit(1);
}
