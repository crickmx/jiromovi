// Autocomprobación del encuadre del fondo del encabezado.
//   npx tsx src/lib/imagenHeader.test.mjs
//
// Lo que se protege: que el marco nunca quede con un hueco (la imagen siempre lo
// tapa) y que el pedazo recortado caiga dentro de la imagen original — si esto
// falla, el canvas dibuja bandas transparentes y nadie lo nota hasta producción.

import assert from 'node:assert/strict';
import { escalaCover, limitarOffset, rectFuente } from './imagenHeader.ts';

const marco = { ancho: 480, alto: 120 };

// Imagen más "alta" que el marco: cubre por ancho.
const vertical = { ancho: 1000, alto: 2000 };
const eV = escalaCover(vertical, marco);
assert.equal(eV, 0.48);
assert.ok(vertical.ancho * eV >= marco.ancho && vertical.alto * eV >= marco.alto);

// Imagen más "ancha": cubre por alto.
const panoramica = { ancho: 4000, alto: 500 };
const eP = escalaCover(panoramica, marco);
assert.equal(eP, 0.24);
assert.ok(panoramica.ancho * eP >= marco.ancho && panoramica.alto * eP >= marco.alto);

// El offset se acota a [visible - dibujado, 0]: nunca se ve fuera de la imagen.
const dibujo = { ancho: 960, alto: 240 };
assert.deepEqual(limitarOffset({ x: 50, y: 10 }, dibujo, marco), { x: 0, y: 0 });
assert.deepEqual(limitarOffset({ x: -9999, y: -9999 }, dibujo, marco), { x: -480, y: -120 });
assert.deepEqual(limitarOffset({ x: -100, y: -60 }, dibujo, marco), { x: -100, y: -60 });

// Con la imagen justo del tamaño del marco, el único offset válido es 0.
assert.deepEqual(limitarOffset({ x: -5, y: -5 }, marco, marco), { x: 0, y: 0 });

// El rectángulo recortado siempre cae dentro de la imagen original.
const escala = eV;
const dib = { ancho: vertical.ancho * escala, alto: vertical.alto * escala };
for (const bruto of [{ x: 0, y: 0 }, { x: -1e6, y: -1e6 }, { x: -20, y: -333 }]) {
  const off = limitarOffset(bruto, dib, marco);
  const r = rectFuente(off, escala, marco);
  assert.ok(r.x >= -1e-9 && r.y >= -1e-9, `recorte fuera por arriba/izquierda: ${JSON.stringify(r)}`);
  assert.ok(r.x + r.ancho <= vertical.ancho + 1e-9, 'recorte se sale por la derecha');
  assert.ok(r.y + r.alto <= vertical.alto + 1e-9, 'recorte se sale por abajo');
}

console.log('✓ imagenHeader: el encuadre siempre tapa el marco y no se sale de la imagen');
