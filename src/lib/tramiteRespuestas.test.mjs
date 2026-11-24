// Autocomprobación de en qué columna cae el valor de cada campo.
//   npx tsx src/lib/tramiteRespuestas.test.mjs
//
// Este es el error más silencioso del proyecto: si quien escribe y quien lee no
// coinciden, el campo se guarda SIN ERROR y se muestra vacío. Ya pasó —la copia
// de Marketing Premium mandaba Área, Equipo y Creado Por a valor_json mientras
// el detalle los lee de valor_texto— y nadie lo vio hasta compararlas.

import assert from 'node:assert/strict';
import { construirRespuesta, columnaDeTipo, TIPOS_TEXTO } from './tramiteRespuestas.ts';

// ── Los campos de sistema que la copia de Marketing tenía mal ───────────────
for (const tipo of ['area', 'equipo', 'creado_por', 'oficina_jiro', 'fecha_creacion', 'fecha_finalizacion', 'agente_vendedor']) {
  assert.equal(columnaDeTipo(tipo), 'valor_texto', `${tipo} debe ir a valor_texto, como lo lee el detalle`);
}

// ── Cada tipo a su columna, y solo a la suya ───────────────────────────────
const casos = [
  ['texto_corto', 'hola', 'valor_texto'],
  ['rfc', 'XAXX010101000', 'valor_texto'],
  ['numerico', 42, 'valor_numerico'],
  ['porcentaje', 15.5, 'valor_numerico'],
  ['fecha', '2026-10-02', 'valor_fecha'],
  ['booleano', true, 'valor_booleano'],
  ['dropdown', 'opcion_a', 'valor_json'],
  ['estatus', 'iniciado', 'valor_json'],
  ['prioridad', 'Alta', 'valor_json'],
  ['descripcion', 'texto largo', 'valor_json'],
  ['asignado_a', 'uuid-x', 'valor_json'],
];

for (const [tipo, valor, esperada] of casos) {
  const fila = construirRespuesta('t1', 'c1', tipo, valor);
  assert.equal(columnaDeTipo(tipo), esperada, `columna equivocada para ${tipo}`);
  assert.notEqual(fila[esperada], null, `${tipo}: la columna ${esperada} quedó vacía`);
  for (const otra of ['valor_texto', 'valor_numerico', 'valor_fecha', 'valor_booleano', 'valor_json']) {
    if (otra !== esperada) {
      assert.equal(fila[otra], null, `${tipo}: ${otra} debería quedar en null`);
    }
  }
}

// ── Un tipo desconocido cae en valor_json, no se pierde ────────────────────
assert.equal(columnaDeTipo('tipo_que_no_existe_todavia'), 'valor_json');

// ── El booleano false no se confunde con "sin dato" ────────────────────────
const falso = construirRespuesta('t1', 'c1', 'booleano', false);
assert.equal(falso.valor_booleano, false);
assert.equal(falso.valor_json, null);

// ── El cero numérico tampoco ───────────────────────────────────────────────
assert.equal(construirRespuesta('t1', 'c1', 'numerico', 0).valor_numerico, 0);

// ── Los tipos que la copia mala inventaba no existen en el proyecto ────────
for (const inventado of ['select', 'radio', 'checkbox']) {
  assert.equal(TIPOS_TEXTO.includes(inventado), false, `"${inventado}" no es un tipo real de este proyecto`);
}

console.log('✓ tramiteRespuestas: cada tipo escribe en la columna de la que el detalle lo lee');
