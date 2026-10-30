// Maneja la ventana de Chrome que abrió `abrir.cmd`, desde Claude Code.
//
// No lanza navegador: se CONECTA por CDP al que ya está abierto con la sesión
// iniciada. Así la sesión la inicia Ricardo a mano y la contraseña nunca pasa
// por aquí ni queda en ningún archivo.
//
//   node conducir.mjs --puerto 9222 --resumen
//   node conducir.mjs --pasos '[["ir","https://beta.movi.digital/tramites"],["foto"]]'
//   node conducir.mjs --pasos-archivo pasos.json
//
// Imprime un reporte COMPACTO a propósito: un screenshot en base64 no cabe en
// el contexto de una conversación, y lo que hace falta para decidir el
// siguiente clic es la estructura de la pantalla, no su imagen. La foto se
// guarda en disco y se mira solo cuando algo no cuadra.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, def = null) => {
  const i = argv.indexOf('--' + n);
  return i === -1 ? def : (argv[i + 1] ?? true);
};
const tiene = (n) => argv.includes('--' + n);

const PUERTO = arg('puerto', '9222');
const DIR_FOTOS = path.resolve(process.cwd(), 'capturas');
mkdirSync(DIR_FOTOS, { recursive: true });

const sello = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// --- sensores -------------------------------------------------------------
// Lo que un usuario real nota pero no sabe nombrar: errores en consola,
// peticiones que fallan, y promesas que truenan sin que nadie las atrape.
const consola = [];
const fallos = [];
const errores = [];

function escuchar(page) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      consola.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (e) => errores.push(String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || 'falló';
    fallos.push(`${r.method()} ${r.url().slice(0, 160)} — ${f}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) fallos.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`);
  });
}

// --- el resumen de pantalla ----------------------------------------------
// Esto ES la rúbrica: un botón sin nombre accesible, un link que no va a
// ningún lado y un campo requerido deshabilitado son hallazgos por sí solos.
const RESUMEN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nombre = (el) =>
    (el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.innerText ||
      el.getAttribute('alt') ||
      '').replace(/\s+/g, ' ').trim();

  const encabezados = [...document.querySelectorAll('h1,h2,h3')]
    .filter(vis).map((h) => `${h.tagName} ${nombre(h).slice(0, 90)}`).slice(0, 25);

  const botones = [...document.querySelectorAll('button,[role="button"],input[type=submit]')]
    .filter(vis).map((b) => {
      const n = nombre(b);
      return {
        t: n.slice(0, 60) || '(SIN NOMBRE)',
        off: b.disabled || b.getAttribute('aria-disabled') === 'true' || undefined,
      };
    }).slice(0, 60);

  const links = [...document.querySelectorAll('a')]
    .filter(vis).map((a) => {
      const href = a.getAttribute('href') || '';
      return { t: nombre(a).slice(0, 50) || '(SIN TEXTO)', h: href.slice(0, 90) || '(SIN HREF)' };
    }).slice(0, 60);

  const campos = [...document.querySelectorAll('input,textarea,select')]
    .filter(vis).map((c) => {
      let et = c.getAttribute('aria-label') || c.getAttribute('placeholder') || '';
      if (!et && c.id) {
        const l = document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
        if (l) et = l.innerText;
      }
      if (!et) et = c.closest('label')?.innerText || '';
      return {
        t: (et || '').replace(/\s+/g, ' ').trim().slice(0, 55) || '(SIN ETIQUETA)',
        tipo: c.tagName === 'SELECT' ? 'select' : (c.type || c.tagName.toLowerCase()),
        req: c.required || c.getAttribute('aria-required') === 'true' || undefined,
        off: c.disabled || c.readOnly || undefined,
        val: c.value ? String(c.value).slice(0, 40) : undefined,
      };
    }).slice(0, 80);

  const dialogo = [...document.querySelectorAll('[role="dialog"],.fixed.inset-0')].some(vis) || undefined;

  return { titulo: document.title, encabezados, botones, links, campos, dialogo };
};

// --- pasos ----------------------------------------------------------------
// Vocabulario corto a propósito: ir, clic, escribir, elegir, tecla, esperar,
// foto, texto. Lo que no se puede expresar con eso probablemente no es lo que
// haría un usuario.
async function ejecutar(page, pasos, bitacora) {
  for (const paso of pasos) {
    const [verbo, a, b] = paso;
    const t0 = Date.now();
    try {
      if (verbo === 'ir') {
        await page.goto(a, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
      } else if (verbo === 'clic') {
        await loc(page, a).first().click({ timeout: 10000 });
        await page.waitForTimeout(900);
      } else if (verbo === 'escribir') {
        await loc(page, a).first().fill(String(b), { timeout: 10000 });
      } else if (verbo === 'elegir') {
        await loc(page, a).first().selectOption(String(b), { timeout: 10000 });
      } else if (verbo === 'tecla') {
        await page.keyboard.press(String(a));
        await page.waitForTimeout(600);
      } else if (verbo === 'esperar') {
        if (typeof a === 'number') await page.waitForTimeout(a);
        else await loc(page, a).first().waitFor({ timeout: 15000 });
      } else if (verbo === 'texto') {
        const txt = (await loc(page, a).first().innerText({ timeout: 8000 })).slice(0, 1500);
        bitacora.push({ paso, ok: true, ms: Date.now() - t0, texto: txt });
        continue;
      } else if (verbo === 'foto') {
        const f = path.join(DIR_FOTOS, `${sello()}-${a || 'vista'}.png`);
        await page.screenshot({ path: f });
        bitacora.push({ paso, ok: true, ms: Date.now() - t0, foto: f });
        continue;
      } else {
        throw new Error(`verbo desconocido: ${verbo}`);
      }
      bitacora.push({ paso, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      // Un paso que falla NO corta la corrida: que un botón no responda es
      // justo un hallazgo, y lo que pasa después del intento importa.
      bitacora.push({ paso, ok: false, ms: Date.now() - t0, error: String(e.message).split('\n')[0].slice(0, 200) });
    }
  }
}

/** Un selector puede ser CSS, o `texto=...` / `rol=boton:Nombre` para lo que ve el usuario. */
function loc(page, sel) {
  const s = String(sel);
  if (s.startsWith('texto=')) return page.getByText(s.slice(6), { exact: false });
  if (s.startsWith('boton=')) return page.getByRole('button', { name: s.slice(6) });
  if (s.startsWith('link=')) return page.getByRole('link', { name: s.slice(5) });
  if (s.startsWith('campo=')) return page.getByLabel(s.slice(6));
  return page.locator(s);
}

// --- main -----------------------------------------------------------------
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PUERTO}`);
const ctx = browser.contexts()[0];
const paginas = ctx.pages();
const page = paginas[Number(arg('pagina', 0))] || paginas[0];
if (!page) { console.log(JSON.stringify({ error: 'No hay pestañas abiertas en ese puerto' })); process.exit(1); }

escuchar(page);

const bitacora = [];
let pasos = [];
if (arg('pasos')) pasos = JSON.parse(arg('pasos'));
else if (arg('pasos-archivo')) pasos = JSON.parse(readFileSync(arg('pasos-archivo'), 'utf8'));
if (pasos.length) await ejecutar(page, pasos, bitacora);

const salida = { url: page.url(), pasos: bitacora };
if (tiene('resumen') || !pasos.length) {
  salida.pantalla = await page.evaluate(RESUMEN);
}
if (consola.length) salida.consola = consola.slice(-25);
if (errores.length) salida.errores_pagina = errores.slice(-10);
if (fallos.length) salida.peticiones_fallidas = [...new Set(fallos)].slice(-25);

const json = JSON.stringify(salida, null, 1);
if (tiene('guardar')) {
  const f = path.join(DIR_FOTOS, `${sello()}-reporte.json`);
  writeFileSync(f, json);
  console.log(f);
} else {
  console.log(json);
}
await browser.close(); // solo cierra la conexión CDP, no el navegador
