import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST_ROOT = resolve(APP_ROOT, process.env.MOVI_DIST_DIR || 'dist');
const INDEX_FILE = join(DIST_ROOT, 'index.html');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendText(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendFile(request, response, filePath) {
  const extension = extname(filePath).toLowerCase();
  const isHtml = extension === '.html';
  const isVersionFile = filePath.endsWith(`${sep}version.json`);
  const cacheControl = isHtml || isVersionFile
    ? 'no-cache, no-store, must-revalidate'
    : filePath.includes(`${sep}_static${sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=604800';

  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream',
    'Content-Length': statSync(filePath).size,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

function maintenancePage() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MOVI Digital — Actualización en curso</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #172033; }
      main { width: min(560px, calc(100% - 48px)); padding: 40px; border-radius: 24px; background: white; box-shadow: 0 20px 60px rgba(15,23,42,.10); text-align: center; }
      .mark { width: 54px; height: 54px; margin: 0 auto 22px; border-radius: 18px; display: grid; place-items: center; background: #ede9fe; color: #6d28d9; font-size: 28px; }
      h1 { margin: 0 0 12px; font-size: clamp(24px, 5vw, 34px); }
      p { margin: 0; color: #64748b; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">M</div>
      <h1>Estamos actualizando MOVI Digital</h1>
      <p>La plataforma estará disponible nuevamente en unos momentos. Intenta recargar la página.</p>
    </main>
  </body>
</html>`;
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Método no permitido');
    return;
  }

  if (request.url === '/healthz' || request.url?.startsWith('/healthz?')) {
    const ready = existsSync(INDEX_FILE);
    sendText(
      response,
      ready ? 200 : 503,
      JSON.stringify({ status: ready ? 'ok' : 'deploy_incomplete' }),
      'application/json; charset=utf-8',
    );
    return;
  }

  if (!existsSync(INDEX_FILE)) {
    sendText(response, 503, maintenancePage(), 'text/html; charset=utf-8');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    sendText(response, 400, 'Solicitud inválida');
    return;
  }

  const relativePath = normalize(pathname).replace(/^[/\\]+/, '');
  const requestedPath = resolve(DIST_ROOT, relativePath);
  const insideDist = requestedPath === DIST_ROOT || requestedPath.startsWith(`${DIST_ROOT}${sep}`);

  if (!insideDist) {
    sendText(response, 400, 'Ruta inválida');
    return;
  }

  if (relativePath && existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    sendFile(request, response, requestedPath);
    return;
  }

  // Los archivos inexistentes deben devolver 404; solo las rutas de React
  // reciben index.html para que React Router resuelva la pantalla solicitada.
  if (extname(relativePath)) {
    sendText(response, 404, 'Archivo no encontrado');
    return;
  }

  sendFile(request, response, INDEX_FILE);
});

server.on('error', (error) => {
  console.error('[movi-server] No fue posible iniciar el servidor:', error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`[movi-server] MOVI Digital disponible en ${HOST}:${PORT}`);
  console.log(`[movi-server] Sirviendo archivos desde ${DIST_ROOT}`);
});

