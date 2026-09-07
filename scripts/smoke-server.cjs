const { spawn } = require('node:child_process');
const { once } = require('node:events');

const port = 43117;
const child = spawn(process.execPath, ['app.js'], {
  cwd: require('node:path').join(__dirname, '..'),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

async function waitUntilReady() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      // El proceso aún está iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`El servidor no quedó listo. ${stderr}`);
}

async function assertResponse(pathname, expectedStatus, expectedContentType) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname}: se esperaba HTTP ${expectedStatus}, se recibió ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes(expectedContentType)) {
    throw new Error(`${pathname}: Content-Type inesperado: ${contentType}`);
  }
}

(async () => {
  try {
    await Promise.race([
      waitUntilReady(),
      once(child, 'exit').then(([code]) => { throw new Error(`El servidor terminó con código ${code}. ${stderr}`); }),
    ]);
    await assertResponse('/healthz', 200, 'application/json');
    await assertResponse('/dashboard', 200, 'text/html');
    await assertResponse('/comisiones/mapeo-vendedores', 200, 'text/html');
    await assertResponse('/archivo-inexistente.js', 404, 'text/plain');
    console.log('✓ El servidor inicia y resuelve las rutas principales del SPA');
  } finally {
    child.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

