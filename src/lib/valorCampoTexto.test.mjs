// Autocomprobación del texto de solo lectura.
//   npx tsx src/lib/valorCampoTexto.test.mjs
//
// Esto es lo que ve quien CONSULTA un trámite, que es la mayoría. Un valor mal
// formateado aquí no rompe nada visible: simplemente se lee un dato equivocado
// y nadie lo nota, que es peor.

import assert from 'node:assert/strict';
import { textoDeValor, SIN_DATO } from './valorCampoTexto.ts';

const texto = { tipo: 'texto_corto' };

// ── Vacío siempre se ve igual, nunca una línea en blanco ────────────────────
for (const v of [undefined, null, '', []]) {
  assert.equal(textoDeValor(texto, v), SIN_DATO, `vacío mal formateado: ${JSON.stringify(v)}`);
}
// Un cero sí es un dato.
assert.equal(textoDeValor({ tipo: 'numerico' }, 0), '0');

// ── Booleano ────────────────────────────────────────────────────────────────
assert.equal(textoDeValor({ tipo: 'booleano' }, true), 'Sí');
assert.equal(textoDeValor({ tipo: 'booleano' }, 'true'), 'Sí');
assert.equal(textoDeValor({ tipo: 'booleano' }, false), 'No');

// ── Fecha: el bug clásico es que se corra un día ────────────────────────────
assert.equal(textoDeValor({ tipo: 'fecha' }, '2026-01-31'), '31/01/2026');
assert.equal(textoDeValor({ tipo: 'fecha' }, '2026-01-01T06:00:00Z'), '01/01/2026');
assert.equal(textoDeValor({ tipo: 'fecha' }, 'no es fecha'), 'no es fecha');

assert.equal(textoDeValor({ tipo: 'porcentaje' }, 12.5), '12.5%');

// ── Las opciones se muestran por su etiqueta, no por su slug ────────────────
const dd = { tipo: 'dropdown', config: { opciones: [{ slug: 'se_emite', label: 'Se Emite' }] } };
assert.equal(textoDeValor(dd, 'se_emite'), 'Se Emite');
// Un slug que ya no existe se muestra crudo, no se pierde el dato.
assert.equal(textoDeValor(dd, 'borrado'), 'borrado');

// ── Selección múltiple: se guarda como texto con comas en varias pantallas ──
const sm = {
  tipo: 'seleccion_multiple',
  config: { opciones: [{ slug: 'a', label: 'Alfa' }, { slug: 'b', label: 'Beta' }] },
};
assert.equal(textoDeValor(sm, 'a,b'), 'Alfa, Beta');
assert.equal(textoDeValor(sm, 'a, b'), 'Alfa, Beta', 'debe tolerar el espacio tras la coma');
assert.equal(textoDeValor(sm, ['a', 'b']), 'Alfa, Beta', 'y también el arreglo');
assert.equal(textoDeValor(sm, ','), SIN_DATO, 'una cadena de puras comas no es un dato');

console.log('✓ valorCampoTexto: los valores se leen bien en solo lectura, incluidas las fechas');
