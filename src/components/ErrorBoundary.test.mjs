// Autocomprobación del clasificador de errores del ErrorBoundary.
//   npx tsx src/components/ErrorBoundary.test.mjs
//
// Es la decisión más delicada de todo el mecanismo: si un error de carga NO se
// reconoce, la pantalla se queda en blanco como antes; si uno cualquiera se
// reconoce de más, la página entra en recargas y es peor que el blanco.
// Los mensajes varían por navegador, así que se cubren los cuatro.

import assert from 'node:assert/strict';
import { esErrorDeCarga } from './ErrorBoundary.tsx';

// ── Sí son errores de carga de fragmento ──────────────────────────────────────
const deCarga = [
  // Chrome / Edge
  new Error('Failed to fetch dynamically imported module: https://beta.movi.digital/_static/Tramites-abc123.js'),
  // Firefox
  new Error('error loading dynamically imported module'),
  // Safari
  new Error('Importing a module script failed.'),
  // Nombre de error, no mensaje (bundlers tipo webpack)
  Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' }),
  new Error('Loading chunk 7 failed'),
];
for (const e of deCarga) {
  assert.equal(esErrorDeCarga(e), true, `debería reconocerse como error de carga: ${e.name}: ${e.message}`);
}

// ── NO son errores de carga: recargar no los arreglaría ───────────────────────
const otros = [
  new TypeError("Cannot read properties of undefined (reading 'nombre')"),
  new Error('Row level security policy violation'),
  new Error('Network request failed'),          // red, pero no de fragmento
  new Error('supabaseUrl is required'),
  new RangeError('Maximum call stack size exceeded'),
];
for (const e of otros) {
  assert.equal(esErrorDeCarga(e), false, `NO debería tratarse como error de carga: ${e.name}: ${e.message}`);
}

// ── No debe tronar con entradas que no son Error ──────────────────────────────
assert.equal(esErrorDeCarga('Failed to fetch dynamically imported module'), true, 'debe aceptar texto suelto');
assert.equal(esErrorDeCarga(undefined), false);
assert.equal(esErrorDeCarga(null), false);
assert.equal(esErrorDeCarga({}), false);

console.log('✓ ErrorBoundary: el clasificador distingue bien los errores de carga');
