// Autocomprobación del selector de aseguradoras.
//   npx tsx src/lib/aseguradorasSeleccion.test.mjs
//
// Lo que se protege: que un nombre con coma propia ("ANA COMPAÑIA DE SEGUROS,
// S.A.") se lea como UNO solo. Si se parte, la casilla sale sin palomear y cada
// clic vuelve a agregar el nombre — que es el bug que esto arregla.

import assert from 'node:assert/strict';
import { parseAseguradoras, etiquetaAseguradoras } from './aseguradorasSeleccion.ts';

const CAT = ['ANA COMPAÑIA DE SEGUROS, S.A.', 'BANORTE GENERALI SEGUROS', 'GNP SEGUROS, S.A. DE C.V.'];

// Nombre con coma: una sola aseguradora, no dos pedazos.
assert.deepEqual(parseAseguradoras('ANA COMPAÑIA DE SEGUROS, S.A.', CAT), ['ANA COMPAÑIA DE SEGUROS, S.A.']);

// Mezcla de nombres con y sin coma.
assert.deepEqual(
  parseAseguradoras('ANA COMPAÑIA DE SEGUROS, S.A., BANORTE GENERALI SEGUROS', CAT),
  ['ANA COMPAÑIA DE SEGUROS, S.A.', 'BANORTE GENERALI SEGUROS'],
);

// Lo que ya se guardó duplicado se limpia al leerlo.
assert.deepEqual(
  parseAseguradoras('ANA COMPAÑIA DE SEGUROS, S.A., BANORTE GENERALI SEGUROS, ANA COMPAÑIA DE SEGUROS, S.A.', CAT),
  ['ANA COMPAÑIA DE SEGUROS, S.A.', 'BANORTE GENERALI SEGUROS'],
);

// Tres comas en el mismo nombre.
assert.deepEqual(parseAseguradoras('GNP SEGUROS, S.A. DE C.V.', CAT), ['GNP SEGUROS, S.A. DE C.V.']);

// Una aseguradora que ya no está en el catálogo no se pierde.
assert.deepEqual(parseAseguradoras('ASEGURADORA VIEJA', CAT), ['ASEGURADORA VIEJA']);

// Vacío.
assert.deepEqual(parseAseguradoras('', CAT), []);
assert.deepEqual(parseAseguradoras(null, CAT), []);

// Etiqueta del campo cerrado.
assert.equal(etiquetaAseguradoras([]), '');
assert.equal(etiquetaAseguradoras(['BANORTE GENERALI SEGUROS']), 'BANORTE GENERALI SEGUROS');
assert.equal(etiquetaAseguradoras(CAT), 'ANA COMPAÑIA DE SEGUROS, S.A. + otras 2');

console.log('✓ aseguradorasSeleccion: un nombre con coma se lee como uno solo y no se duplica');
