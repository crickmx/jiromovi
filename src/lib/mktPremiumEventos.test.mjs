// Autocomprobación de qué eventos de Plan Premium se disparan.
//   npx tsx src/lib/mktPremiumEventos.test.mjs
//
// Los dos errores cuestan caro y en direcciones opuestas: de más, se levantan
// trámites de cobro que nadie pidió; de menos, se activa un Premium y nunca se
// cobra. Y ninguno de los dos avisa.

import assert from 'node:assert/strict';
import { eventosDisparados } from './mktPremiumEventos.ts';

// Los cuatro de siempre, descritos con el modelo nuevo.
const EVENTOS = [
  { key: 'activacion', disparador_tipo: 'activacion', campos_observados: [] },
  { key: 'desactivacion', disparador_tipo: 'desactivacion', campos_observados: [] },
  { key: 'cambio_metodo_pago', disparador_tipo: 'cambio_campo', campos_observados: ['mkt_premium_metodo_pago'] },
  {
    key: 'actualizacion', disparador_tipo: 'cambio_campo',
    campos_observados: ['mkt_premium_plan', 'mkt_premium_fecha_inicio', 'mkt_premium_fecha_pago', 'mkt_premium_parcialidades'],
  },
];

const apagado = { plan_mkt_premium: false, mkt_premium_plan: null, mkt_premium_metodo_pago: null };
const activo = { plan_mkt_premium: true, mkt_premium_plan: 'mensual', mkt_premium_metodo_pago: 'comisiones' };

// ── Prender y apagar ────────────────────────────────────────────────────────
assert.deepEqual(eventosDisparados(EVENTOS, apagado, activo), ['activacion']);
assert.deepEqual(eventosDisparados(EVENTOS, activo, apagado), ['desactivacion']);

// Al prender NO deben salir además los de cambio_campo, aunque los datos cambien.
assert.deepEqual(
  eventosDisparados(EVENTOS, apagado, { ...activo, mkt_premium_plan: 'anual' }),
  ['activacion'],
  'activar no debe disparar también los eventos de cambio',
);

// ── Editar a alguien SIN Premium no es un evento ────────────────────────────
assert.deepEqual(
  eventosDisparados(EVENTOS, apagado, { ...apagado, mkt_premium_plan: 'anual' }),
  [],
  'tocar los datos de alguien sin Premium no debe levantar trámites',
);

// ── Cambios estando activo ──────────────────────────────────────────────────
assert.deepEqual(
  eventosDisparados(EVENTOS, activo, { ...activo, mkt_premium_metodo_pago: 'deposito_jiro' }),
  ['cambio_metodo_pago'],
);
assert.deepEqual(
  eventosDisparados(EVENTOS, activo, { ...activo, mkt_premium_plan: 'anual' }),
  ['actualizacion'],
);
// Si cambian los dos, salen los dos.
assert.deepEqual(
  eventosDisparados(EVENTOS, activo, { ...activo, mkt_premium_plan: 'anual', mkt_premium_metodo_pago: 'bono_anual' }),
  ['cambio_metodo_pago', 'actualizacion'],
);

// ── Guardar sin cambiar nada no dispara nada ────────────────────────────────
assert.deepEqual(eventosDisparados(EVENTOS, activo, { ...activo }), []);

// ── null, undefined y '' son el mismo "vacío" ───────────────────────────────
// La pantalla guarda un campo vacío a veces como null y a veces como ''; si se
// trataran distinto, se levantaría un trámite por un cambio que nadie hizo.
const conNull = { plan_mkt_premium: true, mkt_premium_plan: null };
const conVacio = { plan_mkt_premium: true, mkt_premium_plan: '' };
assert.deepEqual(eventosDisparados(EVENTOS, conNull, conVacio), []);
assert.deepEqual(eventosDisparados(EVENTOS, conVacio, { plan_mkt_premium: true, mkt_premium_plan: undefined }), []);
// Pero vacío → con valor SÍ es un cambio.
assert.deepEqual(eventosDisparados(EVENTOS, conNull, { plan_mkt_premium: true, mkt_premium_plan: 'anual' }), ['actualizacion']);

// ── Un evento nuevo creado desde la pantalla SÍ se dispara ──────────────────
// Esto es justo lo que antes no podía pasar.
const conNuevo = [...EVENTOS, {
  key: 'cambio_fecha_pago_solo', disparador_tipo: 'cambio_campo',
  campos_observados: ['mkt_premium_fecha_pago'],
}];
assert.deepEqual(
  eventosDisparados(conNuevo, activo, { ...activo, mkt_premium_fecha_pago: '2026-12-01' }),
  ['actualizacion', 'cambio_fecha_pago_solo'],
);

// ── Un evento sin columnas vigiladas no dispara nunca ───────────────────────
const inerte = [{ key: 'vacio', disparador_tipo: 'cambio_campo', campos_observados: [] }];
assert.deepEqual(eventosDisparados(inerte, activo, { ...activo, mkt_premium_plan: 'anual' }), []);
// Tampoco si la lista viene nula.
assert.deepEqual(
  eventosDisparados([{ key: 'x', disparador_tipo: 'cambio_campo', campos_observados: null }], activo, { ...activo, mkt_premium_plan: 'anual' }),
  [],
);

console.log('✓ mktPremiumEventos: solo dispara lo que de verdad cambió, y un evento nuevo ya sirve');
