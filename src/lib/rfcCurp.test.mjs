// Autocomprobación de src/lib/rfcCurp.ts — sin framework, corre con:
//   npx tsx src/lib/rfcCurp.test.mjs
// (o compila el .ts y ejecuta este archivo con node)
//
// Cubre lo que se rompe en silencio: fechas inexistentes, el siglo, la
// diferencia física/moral, y que el RFC NO invente sexo ni entidad.

import assert from 'node:assert/strict';
import { analizarRFC, analizarCURP, RFC_GENERICO_NACIONAL } from './rfcCurp.ts';

// ── RFC: persona física ───────────────────────────────────────────────────────
const fisica = analizarRFC('MAGJ850315H21');
assert.equal(fisica.valido, true, 'una física bien formada debe ser válida');
assert.equal(fisica.tipoPersona, 'fisica');
assert.equal(fisica.fecha, '1985-03-15');
assert.equal(fisica.tieneHomoclave, true);

// ── RFC: persona moral (3 letras) ─────────────────────────────────────────────
const moral = analizarRFC('ABC950620XY1');
assert.equal(moral.valido, true, 'una moral bien formada debe ser válida');
assert.equal(moral.tipoPersona, 'moral');
assert.equal(moral.fecha, '1995-06-20');

// ── RFC: sin homoclave, se acepta pero se marca ───────────────────────────────
const sinHomo = analizarRFC('MAGJ850315');
assert.equal(sinHomo.valido, true, 'sin homoclave sigue siendo analizable');
assert.equal(sinHomo.tieneHomoclave, false, 'debe avisar que le falta la homoclave');
assert.equal(sinHomo.tipoPersona, 'fisica');

// ── RFC: genérico del SAT ─────────────────────────────────────────────────────
const generico = analizarRFC(RFC_GENERICO_NACIONAL);
assert.equal(generico.valido, true);
assert.equal(generico.esGenerico, true, 'el genérico debe reconocerse como tal');

// ── RFC: fechas que no existen ────────────────────────────────────────────────
assert.equal(analizarRFC('MAGJ850230H21').valido, false, '30 de febrero no existe');
assert.equal(analizarRFC('MAGJ851315H21').valido, false, 'el mes 13 no existe');

// ── RFC: basura ───────────────────────────────────────────────────────────────
assert.equal(analizarRFC('HOLA').valido, false);
assert.equal(analizarRFC('').valido, false);
assert.equal(analizarRFC('MAGJ8503150').valido, false, '11 caracteres no es un RFC válido');

// ── RFC: no inventa sexo ni entidad ───────────────────────────────────────────
assert.equal('sexo' in fisica, false, 'el RFC no contiene sexo');
assert.equal('entidadClave' in fisica, false, 'el RFC no contiene entidad');

// ── CURP: completo ────────────────────────────────────────────────────────────
const curp = analizarCURP('MAGJ850315HDFRRN08');
assert.equal(curp.valido, true, 'un CURP bien formado debe ser válido');
assert.equal(curp.fecha, '1985-03-15');
assert.equal(curp.sexo, 'H');
assert.equal(curp.entidadClave, 'DF');
assert.equal(curp.entidadNombre, 'Ciudad de México');

const curpM = analizarCURP('MAGJ850315MJCRRN02');
assert.equal(curpM.sexo, 'M', 'debe leer el sexo femenino');
assert.equal(curpM.entidadNombre, 'Jalisco');

// ── CURP: inválidos ───────────────────────────────────────────────────────────
assert.equal(analizarCURP('MAGJ850315HDFRRN0').valido, false, '17 caracteres');
assert.equal(analizarCURP('MAGJ850315XDFRRN08').valido, false, 'sexo inválido');
assert.equal(analizarCURP('MAGJ850315HZZRRN08').valido, false, 'entidad inexistente');

// ── El siglo se decide por el año en curso ────────────────────────────────────
const futuro = String(new Date().getFullYear() + 5).slice(2);
const ambiguo = analizarRFC(`MAGJ${futuro}0315H21`);
assert.ok(ambiguo.fecha?.startsWith('19'), 'un año posterior al actual es del siglo pasado');

console.log('✓ rfcCurp: todas las comprobaciones pasaron');
