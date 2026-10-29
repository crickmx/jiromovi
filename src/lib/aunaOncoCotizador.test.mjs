// Autocomprobación del cotizador Auna Oncosalud Plus.
//   npx tsx src/lib/aunaOncoCotizador.test.mjs
//
// Los números de referencia salen de la cotización real de Auna
// (09-030-2607/01554, 28/07/2026) y del Excel "Cotizador Oncosalud 2026".

import assert from 'node:assert/strict';
import { cotizar, edadCumplida, quinquenioDe, pctExtraprima, sugiereObesidadIII, parentescoDe } from './aunaOncoCotizador.ts';

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
assert.equal(sugiereObesidadIII({ estatura: 160, peso: 103 }), true, 'estatura en centímetros');

// PDF oficial de Auna del 27/10 (JUANITA PEREZ LOPEZ, 12/10/1966, mensual):
// recargo 2,576.71 · total 34,741.92 · 1er recibo 3,161.03 · 11 de 2,870.99
const juanita = [base({ nombre: 'JUANITA', sexo: 'F', fechaNacimiento: '1966-10-12' })];
const jm = cotizar(juanita, 'mensual', 0, new Date(2026, 9, 27));
assert.equal(jm.recargoFraccionado, 2576.71);
assert.equal(jm.primaTotal, 34741.92);
assert.equal(jm.primerRecibo, 3161.03);
assert.equal(jm.reciboSubsecuente, 2870.99);
assert.equal(jm.lineas[0].primaConRecargo, 29699.93, 'prima + 9.5% de esa persona');
assert.equal(cotizar(juanita, 'anual', 0, new Date(2026, 9, 27)).primaTotal, 31752.94);

// Parentescos: el primero es titular; los viejos sin parentesco, cónyuge
assert.equal(parentescoDe({}, 0), 'Titular');
assert.equal(parentescoDe({}, 1), 'Cónyuge');
assert.equal(parentescoDe({ parentesco: 'Hijo/a' }, 2), 'Hijo/a');

// Hijo/a de 25 años o más: fuera de la póliza
const hijo25 = cotizar([pareja[0], base({ nombre: 'Hijo', sexo: 'M', fechaNacimiento: '2001-01-01', parentesco: 'Hijo/a' })], 'anual', 0, dia);
assert.equal(hijo25.valido, false);
assert.match(hijo25.lineas[1].error, /24 años 11 meses/);
const hijo24 = cotizar([pareja[0], base({ nombre: 'Hijo', sexo: 'M', fechaNacimiento: '2002-01-01', parentesco: 'Hijo/a' })], 'anual', 0, dia);
assert.equal(hijo24.valido, true);

// Máximo 6 asegurados
const siete = Array.from({ length: 7 }, (_, i) => base({ nombre: `P${i}`, sexo: 'F', fechaNacimiento: '1990-01-01', parentesco: i ? 'Hijo/a' : undefined }));
assert.equal(cotizar(siete.map(p => ({ ...p, fechaNacimiento: '2010-01-01' })), 'anual', 0, dia).valido, false);

console.log('✓ aunaOncoCotizador: todo bien');
