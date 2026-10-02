// Autocomprobación del filtro de reglas por forma de pago.
//   npx tsx src/lib/tramiteTriggerFiltro.test.mjs
//
// Es la única parte del motor con lógica propia, y falla en silencio: si el
// filtro se equivoca, la regla simplemente no dispara y nadie se entera de que
// debía hacerlo —no hay error, no hay aviso, solo un trámite que nunca se creó.

import assert from 'node:assert/strict';
import { filtrarTriggersPorPago } from './tramiteTriggerFiltro.ts';

const base = { id: 'x', nombre: 'r', descripcion_template: '', ticket_tipos: { id: 't', value: 'v', label: 'L', area: 'A' } };
const r = (extra) => ({ ...base, ...extra });

const sinFiltro = r({});
const soloComisiones = r({ metodo_pago_filtro: ['Descuento de Comisiones'] });
const dosMetodos = r({ metodo_pago_filtro: ['Descuento de Comisiones', 'Cargo a Bono de Agente'] });
const soloContado = r({ forma_pago_filtro: ['Contado'] });
const metodoYForma = r({ metodo_pago_filtro: ['Pago Directo'], forma_pago_filtro: ['Contado'] });

// ── Sin filtro aplica siempre, incluso sin datos de pago ───────────────────
assert.deepEqual(filtrarTriggersPorPago([sinFiltro], {}), [sinFiltro]);
assert.deepEqual(filtrarTriggersPorPago([sinFiltro], { metodo: 'Lo que sea' }), [sinFiltro]);
// Un arreglo vacío significa lo mismo que nulo: cualquiera.
assert.deepEqual(filtrarTriggersPorPago([r({ metodo_pago_filtro: [] })], {}).length, 1);

// ── Filtro por método ──────────────────────────────────────────────────────
assert.deepEqual(filtrarTriggersPorPago([soloComisiones], { metodo: 'Descuento de Comisiones' }), [soloComisiones]);
assert.deepEqual(filtrarTriggersPorPago([soloComisiones], { metodo: 'Pago Directo' }), []);
// Una regla puede cubrir varios métodos a la vez.
assert.equal(filtrarTriggersPorPago([dosMetodos], { metodo: 'Cargo a Bono de Agente' }).length, 1);

// ── Sin método conocido, una regla que SÍ filtra no debe aplicar ───────────
// (si no, un caso sin datos de pago dispararía todas las reglas de golpe)
assert.deepEqual(filtrarTriggersPorPago([soloComisiones], {}), []);
assert.deepEqual(filtrarTriggersPorPago([soloComisiones], { metodo: null }), []);

// ── Filtro por forma, que es lo que a Marketing le faltaba ─────────────────
assert.equal(filtrarTriggersPorPago([soloContado], { forma: 'Contado' }).length, 1);
assert.equal(filtrarTriggersPorPago([soloContado], { forma: '12 Meses' }).length, 0);

// ── Los dos filtros se exigen juntos, no alguno de los dos ─────────────────
assert.equal(filtrarTriggersPorPago([metodoYForma], { metodo: 'Pago Directo', forma: 'Contado' }).length, 1);
assert.equal(filtrarTriggersPorPago([metodoYForma], { metodo: 'Pago Directo', forma: '12 Meses' }).length, 0);
assert.equal(filtrarTriggersPorPago([metodoYForma], { metodo: 'Otro', forma: 'Contado' }).length, 0);

// ── Varias reglas a la vez: solo pasan las que corresponden ────────────────
const todas = [sinFiltro, soloComisiones, soloContado, metodoYForma];
const pasan = filtrarTriggersPorPago(todas, { metodo: 'Descuento de Comisiones', forma: 'Contado' });
assert.deepEqual(pasan, [sinFiltro, soloComisiones, soloContado]);

console.log('✓ tramiteTriggerFiltro: el filtro por método y forma de pago deja pasar justo lo que debe');
