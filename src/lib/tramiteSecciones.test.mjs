// Autocomprobación de cuándo un campo requerido se puede exigir.
//   npx tsx src/lib/tramiteSecciones.test.mjs
//
// El error que esto evita es el peor de un formulario: pedir un campo que la
// persona NO PUEDE VER —porque su sección no aplica— y dejarla atorada sin
// forma de saber qué falta. Pasaba al marcar "requerido" dentro de una sección
// condicionada.

import assert from 'node:assert/strict';
import { campoExigible, campoCumpleSuCondicion, seccionDesbloqueada } from './tramiteSecciones.ts';

const seccionBase = { descripcion: null, opcional: false, depende_de_seccion_id: null };

// Ramo (sin sección) decide si aplica la sección "Datos del auto".
const ramo = { id: 'f-ramo', key: 'ramo', requerido: true, seccion_id: null };
const placas = { id: 'f-placas', key: 'placas', requerido: true, seccion_id: 's-auto' };
const secciones = [
  {
    ...seccionBase, id: 's-auto', nombre: 'Datos del auto', orden: 1,
    condicion_campo_id: 'f-ramo', condicion_operador: 'igual_a', condicion_valor: 'Autos',
  },
];
const campos = [ramo, placas];

// ── Ramo = Daños: la sección no aplica, no se pide nada de ella ──────────────
{
  const r = { 'f-ramo': 'Daños' };
  assert.equal(seccionDesbloqueada(secciones[0], secciones, campos, r), false);
  assert.equal(campoExigible(placas, secciones, campos, r), false, 'no se debe exigir un campo de una sección que no aplica');
  assert.equal(campoExigible(ramo, secciones, campos, r), true, 'el campo de fuera sí se sigue exigiendo');
}

// ── Ramo = Autos: la sección aplica y sí se exige ────────────────────────────
assert.equal(campoExigible(placas, secciones, campos, { 'f-ramo': 'Autos' }), true);

// ── Sin responder el ramo todavía: tampoco se exige lo del auto ──────────────
assert.equal(campoExigible(placas, secciones, campos, {}), false);

// ── Un campo no requerido nunca es exigible ──────────────────────────────────
assert.equal(campoExigible({ ...placas, requerido: false }, secciones, campos, { 'f-ramo': 'Autos' }), false);

// ── Sección opcional: en blanco no estorba; tocada, se completa ──────────────
{
  const secOpc = [{ ...seccionBase, id: 's-extra', nombre: 'Extras', orden: 2, opcional: true }];
  const a = { id: 'x1', key: 'x1', requerido: true, seccion_id: 's-extra' };
  const b = { id: 'x2', key: 'x2', requerido: true, seccion_id: 's-extra' };
  assert.equal(campoExigible(a, secOpc, [a, b], {}), false, 'una sección opcional intacta no debe bloquear');
  assert.equal(campoExigible(a, secOpc, [a, b], { x2: 'algo' }), true, 'si ya la empezaron, se completa');
}

// ── Sección que depende de otra: hasta que la anterior esté completa ─────────
{
  const s1 = { ...seccionBase, id: 's1', nombre: 'Uno', orden: 1 };
  const s2 = { ...seccionBase, id: 's2', nombre: 'Dos', orden: 2, depende_de_seccion_id: 's1' };
  const c1 = { id: 'c1', key: 'c1', requerido: true, seccion_id: 's1' };
  const c2 = { id: 'c2', key: 'c2', requerido: true, seccion_id: 's2' };
  assert.equal(campoExigible(c2, [s1, s2], [c1, c2], {}), false);
  assert.equal(campoExigible(c2, [s1, s2], [c1, c2], { c1: 'listo' }), true);
}

// ── La condición PROPIA del campo también manda ──────────────────────────────
{
  const fuente = { id: 'src', key: 'tipo_persona', requerido: false, seccion_id: null };
  const razon = {
    id: 'rz', key: 'razon_social', requerido: true, seccion_id: null,
    config: { condicion_activa: true, campo_fuente: 'tipo_persona', condicion_operador: 'igual_a', condicion_valor: 'Moral' },
  };
  const lista = [fuente, razon];
  assert.equal(campoCumpleSuCondicion(razon, lista, { src: 'Fisica' }), false);
  assert.equal(campoExigible(razon, [], lista, { src: 'Fisica' }), false, 'un campo oculto por su condición no se exige');
  assert.equal(campoExigible(razon, [], lista, { src: 'Moral' }), true);
  // Referencia rota: no se esconde ni se deja de pedir, para no perder el campo.
  assert.equal(campoCumpleSuCondicion({ ...razon, config: { ...razon.config, campo_fuente: 'no_existe' } }, lista, {}), true);
}

// ── Una sección referenciada que ya no existe no debe tragarse el requerido ──
assert.equal(campoExigible({ id: 'z', requerido: true, seccion_id: 'borrada' }, [], [], {}), true);

console.log('✓ tramiteSecciones: un requerido dentro de una sección que no aplica deja de pedirse');
