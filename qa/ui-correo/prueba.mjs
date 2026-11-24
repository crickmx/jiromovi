// Prueba del correo con datos simulados: que "Crear trámite" y "Agregar a
// trámite" sigan llamando a las MISMAS funciones del servidor con los MISMOS
// datos del correo, también en lote, y que el remitente se identifique.
//
//   node qa/ui-correo/prueba.mjs
//
// Levanta Vite con qa/ui-correo/vite.config.ts (Supabase y la sesión se
// sustituyen por simulaciones) y maneja la pantalla con Playwright.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
// Playwright: el de qa/ (npm install en esa carpeta) o el instalado globalmente.
let chromium;
try { ({ chromium } = createRequire(path.join(aqui, '..', 'package.json'))('playwright')); }
catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
const server = await createServer({ configFile: path.join(aqui, 'vite.config.ts'), server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
let fallas = 0;
const paso = async (nombre, fn) => {
  try { await fn(); console.log(`✓ ${nombre}`); }
  catch (e) { fallas++; console.log(`✗ ${nombre}\n  ${e.message.split('\n').slice(0, 6).join('\n  ')}`); }
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('http://localhost:5198/qa/ui-correo/correo.html');
  const llamadas = () => page.evaluate(() => window.__llamadas);
  const limpiar = () => page.evaluate(() => { window.__llamadas.length = 0; });

  await page.getByRole('button', { name: 'Recibidos' }).first().click();
  await page.getByText('Cotización de seguro de auto', { exact: false }).first().click();
  await page.getByRole('heading', { name: /Cotización de seguro de auto/ }).waitFor();

  await paso('el remitente se identifica con su tarjeta (CRM)', async () => {
    await page.getByText('Contacto del CRM', { exact: false }).waitFor({ timeout: 3000 });
  });

  await paso('el remitente de MOVI se marca en la lista (Agente)', async () => {
    await page.getByText('Agente', { exact: true }).first().waitFor({ timeout: 3000 });
  });

  await paso('"Agregar a trámite" llama a add-email-to-tramite con los datos del correo', async () => {
    await limpiar();
    await page.getByRole('button', { name: 'Agregar a trámite' }).first().click();
    await page.getByRole('button', { name: /Agregar a este trámite/ }).first().click();
    await page.waitForTimeout(400);
    const c = (await llamadas()).find(l => l.fn === 'add-email-to-tramite');
    assert.ok(c, 'no se llamó a add-email-to-tramite');
    assert.equal(c.body.emailUid, 5);
    assert.equal(c.body.emailFolder, 'INBOX');
    assert.equal(c.body.emailMessageId, '<m5@x>');
    assert.equal(c.body.emailFromEmail, 'cliente@empresa.com');
    assert.equal(c.body.emailAccount, 'ricardo@movi-demo.mx');
    assert.equal(c.body.ticketId, 't1');
    assert.deepEqual(c.body.attachments.map(a => a.partId), ['2', '3']);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2300);
  });

  await paso('"Crear trámite" analiza el correo y crea con create-tramite-from-email', async () => {
    // El correo de ejemplo ya está ligado en la simulación; se abre otro.
    await page.getByRole('button', { name: 'Volver a la lista' }).click().catch(() => {});
    await page.getByText('Verifica tu cuenta', { exact: false }).first().click();
    await page.getByRole('heading', { name: 'Verifica tu cuenta' }).waitFor();
    await limpiar();
    await page.evaluate(() => { /* sin trámite ligado para este correo */ });
    const crear = page.getByRole('button', { name: /^Crear( trámite)?$/ }).first();
    if (await crear.count() === 0) throw new Error('no aparece el botón Crear trámite');
    await crear.click();
    await page.waitForTimeout(600);
    const a = (await llamadas()).find(l => l.fn === 'analyze-email-for-tramite');
    assert.ok(a, 'no se llamó a analyze-email-for-tramite');
    assert.equal(a.body.fromEmail, 'avisos@jiro-seguridad.com');
    assert.equal(a.body.subject, 'Verifica tu cuenta');
    await page.getByRole('button', { name: /Crear tr[aá]mite/i }).last().click();
    await page.waitForTimeout(600);
    const c = (await llamadas()).find(l => l.fn === 'create-tramite-from-email');
    assert.ok(c, 'no se llamó a create-tramite-from-email');
    assert.equal(c.body.emailUid, 3);
    assert.equal(c.body.emailFolder, 'INBOX');
    assert.equal(c.body.emailFromEmail, 'avisos@jiro-seguridad.com');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await paso('"Agregar a trámite" en lote abre el modal una vez por correo', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Recibidos' }).first().click();
    await page.getByRole('checkbox', { name: 'Seleccionar correo de Boletín' }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar correo de MATEO PRUEBAS' }).check();
    await limpiar();
    await page.getByRole('button', { name: 'Agregar los seleccionados a un trámite' }).click();
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /Agregar a este trámite/ }).first().click();
      await page.waitForTimeout(2500); // el modal se cierra solo al terminar
    }
    const uids = (await llamadas()).filter(l => l.fn === 'add-email-to-tramite').map(l => l.body.emailUid).sort();
    assert.deepEqual(uids, [2, 4]);
  });

  await paso('sin errores de JavaScript en la página', async () => {
    assert.deepEqual(errores, []);
  });
} finally {
  await browser.close();
  await server.close();
}
if (fallas) { console.log(`\n${fallas} prueba(s) fallaron`); process.exit(1); }
console.log('\ncorreo/trámites: OK');
