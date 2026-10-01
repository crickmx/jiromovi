// Autocomprobación del criterio de reCAPTCHA del alta pública.
//   npx tsx supabase/functions/_shared/recaptchaVeredicto.test.mjs
//
// Esto decide si una persona puede darse de alta, así que los dos errores
// cuestan distinto: bloquear de más se pierde en silencio (la persona abandona),
// dejar pasar de más deja basura visible. El criterio solo rechaza con un
// veredicto claro de Google, y esta prueba es la que lo sostiene.

import assert from 'node:assert/strict';
import { decidirRecaptcha, UMBRAL_BOT } from './recaptchaVeredicto.ts';

const base = { hayLlaves: true, hayToken: true };

// ── Lo único que se rechaza ──────────────────────────────────────────────────
assert.equal(decidirRecaptcha({ ...base, respuestas: [{ success: true, score: 0.1 }] }).permitir, false);
assert.equal(decidirRecaptcha({ ...base, respuestas: [{ success: true, score: 0 }] }).permitir, false);

// Justo en el umbral se permite: el corte es "menor que", no "menor o igual".
assert.equal(decidirRecaptcha({ ...base, respuestas: [{ success: true, score: UMBRAL_BOT }] }).permitir, true);
assert.equal(decidirRecaptcha({ ...base, respuestas: [{ success: true, score: 0.9 }] }).permitir, true);

// ── Todo lo demás pasa ───────────────────────────────────────────────────────
// Sin llaves en el backend no hay nada contra qué verificar.
assert.equal(decidirRecaptcha({ hayLlaves: false, hayToken: false, respuestas: [] }).permitir, true);

// Sin token: adblocker o ventana privada. Este era el bug del 2026-09-29.
assert.equal(decidirRecaptcha({ hayLlaves: true, hayToken: false, respuestas: [] }).permitir, true);

// Google no contestó (red caída): no se castiga a la persona por eso.
assert.equal(decidirRecaptcha({ ...base, respuestas: [null, null] }).permitir, true);

// La llave no empata: problema de configuración nuestro, no evidencia de bot.
const llaveMala = decidirRecaptcha({ ...base, respuestas: [{ success: false, 'error-codes': ['invalid-input-secret'] }] });
assert.equal(llaveMala.permitir, true);
assert.match(llaveMala.motivo, /invalid-input-secret/);

// reCAPTCHA v2 (sin score) verificado: pasa.
assert.equal(decidirRecaptcha({ ...base, respuestas: [{ success: true }] }).permitir, true);

// ── Varias llaves: manda la que SÍ verificó, no el orden ─────────────────────
// La primera llave no empata, la segunda verifica y dice bot → se rechaza.
assert.equal(
  decidirRecaptcha({ ...base, respuestas: [{ success: false, 'error-codes': ['invalid-input-secret'] }, { success: true, score: 0.1 }] }).permitir,
  false,
  'una llave que no empata no debe tapar el veredicto real de la que sí',
);
// Y al revés: la que verifica dice que es gente.
assert.equal(
  decidirRecaptcha({ ...base, respuestas: [null, { success: true, score: 0.8 }] }).permitir,
  true,
);

console.log('✓ recaptchaVeredicto: solo rechaza con veredicto de bot; adblocker, red caída y llave mala pasan');
