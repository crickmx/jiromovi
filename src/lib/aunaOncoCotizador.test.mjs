// Autocomprobación del cotizador Auna Oncosalud Plus.
//   npx tsx src/lib/aunaOncoCotizador.test.mjs
//
// Los números de referencia salen de la cotización real de Auna
// (09-030-2607/01554, 28/07/2026) y del Excel "Cotizador Oncosalud 2026".

import assert from 'node:assert/strict';
import { cotizar, edadCumplida, quinquenioDe, pctExtraprima, sugiereObesidadIII } from './aunaOncoCotizador.ts';

const dia = new Date(2026, 6, 28);
const base = (o) => ({ id: o.nombre, respuestas: {}, extraprimas: [], ...o });
const pareja = [
  base({ nombre: 'RONALD', sexo: 'M', fechaNacimiento: '1969-12-17' }),
  base({ nombre: 'LILIA', sexo: 'F', fechaNacimiento: '1965-06-08' }),
];

// Edad cumplida y quinquenio
assert.equal(edadCumplida('1969-12-17', dia), 56);
assert.equal(edadCumplida('1965-06-08', dia), 61);
assert.equal(edadCumplida('2000-07-28', dia), 26, 'el día del cumpleaños ya cuenta');
assert.equal(edadCumplida('2000-07-29', dia), 25);
assert.equal(quinquenioDe(70).etiqueta, '70');
assert.equal(quinquenioDe(71), null);

// Pago anual: idéntico a la cotización de Auna
const a = cotizar(pareja, 'anual', 0, dia);
assert.equal(a.lineas[0].primaNeta, 17267.62);
assert.equal(a.lineas[1].primaNeta, 27123.22);
assert.equal(a.primaNetaTotal, 44390.84);
assert.equal(a.subtotal, 44640.84);
assert.equal(a.iva, 7142.53);
assert.equal(a.primaTotal, 51783.37);
assert.equal(a.primerRecibo, 51783.37);
assert.equal(a.reciboSubsecuente, null);

// Pago mensual: recargo 9.5%, idéntico a la cotización mensual de Auna
const m = cotizar(pareja, 'mensual', 0, dia);
assert.equal(m.recargoFraccionado, 4217.13);
assert.equal(m.subtotal, 48857.97);
assert.equal(m.iva, 7817.28);
assert.equal(m.primaTotal, 56675.25);
assert.equal(m.reciboSubsecuente, 4698.77);
assert.equal(m.primerRecibo, 4988.78, 'el 1er recibo lleva los derechos y absorbe el centavo, como Auna');
assert.equal(Math.round((m.primerRecibo + m.reciboSubsecuente * 11) * 100) / 100, m.primaTotal, 'los recibos suman el total');

// Extraprimas
assert.equal(pctExtraprima(['tab_intenso', 'lupus']), 0.8);
const fum = cotizar([base({ nombre: 'X', sexo: 'M', fechaNacimiento: '1969-12-17', extraprimas: ['tab_moderado'] })], 'anual', 0, dia);
assert.equal(fum.lineas[0].extraprima, 5180.29);
assert.equal(fum.lineas[0].primaNeta, 22447.91);

// Descuento se aplica sobre la prima neta
const desc = cotizar(pareja, 'anual', 10, dia);
assert.equal(desc.descuento, 4439.08);

// Edad fuera de rango invalida la cotización
const viejo = cotizar([base({ nombre: 'Y', sexo: 'F', fechaNacimiento: '1950-01-01' })], 'anual', 0, dia);
assert.equal(viejo.valido, false);
assert.match(viejo.lineas[0].error, /70 años 11 meses/);

// Cuestionario: un sí de suscripción marca la cotización; fumar pide nivel
const susc = cotizar([base({ nombre: 'Z', sexo: 'F', fechaNacimiento: '1980-01-01', respuestas: { p5: true, p16: true } })], 'anual', 0, dia);
assert.equal(susc.requiereSuscripcion, true);
assert.equal(susc.lineas[0].alertas.length, 2);
// Pregunta de próstata no cuenta para una mujer
const prost = cotizar([base({ nombre: 'W', sexo: 'F', fechaNacimiento: '1980-01-01', respuestas: { p8: true } })], 'anual', 0, dia);
assert.equal(prost.requiereSuscripcion, false);

assert.equal(sugiereObesidadIII({ estatura: 1.6, peso: 103 }), true);
assert.equal(sugiereObesidadIII({ estatura: 1.6, peso: 100 }), false);

console.log('✓ aunaOncoCotizador: todo bien');
