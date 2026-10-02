// Autocomprobación de la validación del comprobante de pago.
//   npx tsx src/lib/comprobantePago.test.mjs
//
// Lo que se protege: que nada llegue al bucket sin revisarse. Un archivo que el
// servidor rechaza deja al usuario con un error críptico y el pago a medias; y
// un nombre de archivo mal manejado en la ruta rompe la lectura del propio
// comprobante, que es justo el dato que sostiene una revisión.

import assert from 'node:assert/strict';
import {
  validarComprobante, rutaComprobante, extensionDe,
  MAX_BYTES_COMPROBANTE, EXTENSIONES_COMPROBANTE,
} from './comprobantePago.ts';

const archivo = (name, size = 1024) => ({ name, size });

// ── Formatos aceptados, sin importar mayúsculas ────────────────────────────
for (const ext of ['pdf', 'jpg', 'jpeg', 'png', 'PDF', 'JPG', 'PNG']) {
  assert.equal(validarComprobante(archivo(`comprobante.${ext}`)), null, `.${ext} debería aceptarse`);
}

// ── Formatos rechazados ────────────────────────────────────────────────────
for (const ext of ['docx', 'xlsx', 'heic', 'zip', 'exe']) {
  const msg = validarComprobante(archivo(`x.${ext}`));
  assert.ok(msg, `.${ext} debería rechazarse`);
  assert.match(msg, /PDF, JPG o PNG/);
}
// Sin extensión tampoco pasa.
assert.ok(validarComprobante(archivo('comprobante')));

// ── Tamaño ─────────────────────────────────────────────────────────────────
assert.equal(validarComprobante(archivo('ok.pdf', MAX_BYTES_COMPROBANTE)), null, 'justo en el límite se acepta');
const grande = validarComprobante(archivo('ok.pdf', MAX_BYTES_COMPROBANTE + 1));
assert.ok(grande);
assert.match(grande, /10 MB/);

// Un archivo vacío sube sin error y después no se puede abrir.
assert.match(validarComprobante(archivo('ok.pdf', 0)), /vac[íi]o/);

// ── La ruta no arrastra el nombre original ─────────────────────────────────
// Trae acentos, espacios y a veces datos personales; se guarda aparte.
const ruta = rutaComprobante('user-1', 'pago-9', 'Comprobante Depósito Añejo (2).PDF');
assert.equal(ruta, 'user-1/pago-9.pdf');
assert.equal(ruta.includes(' '), false, 'la ruta no debe llevar espacios');

// Empieza con el id del agente: la política de lectura compara esa carpeta.
assert.equal(ruta.split('/')[0], 'user-1');

// Un nombre sin extensión no deja la ruta rota.
assert.equal(rutaComprobante('u', 'p', 'sinpunto'), 'u/p.bin');
// Un nombre con varios puntos toma la última extensión.
assert.equal(rutaComprobante('u', 'p', 'pago.2026.10.02.png'), 'u/p.png');

assert.equal(extensionDe('a.b.c.PNG'), 'png');
assert.equal(extensionDe('sinpunto'), '');
assert.deepEqual(EXTENSIONES_COMPROBANTE, ['pdf', 'jpg', 'jpeg', 'png']);

console.log('✓ comprobantePago: nada llega al bucket sin revisarse, y la ruta no arrastra el nombre original');
