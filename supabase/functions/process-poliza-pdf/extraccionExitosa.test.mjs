// npx tsx supabase/functions/process-poliza-pdf/extraccionExitosa.test.mjs
//
// Lo que se comprueba: que una fila "vacía" no se cuele como buena por culpa de
// las columnas que se llenan solas. Un fallo aquí no se ve — la fila del Excel
// se ve igual de normal.

import assert from 'node:assert/strict';
import { huboExtraccion, marcarSiNoSeExtrajo, AVISO_SIN_EXTRACCION } from './extraccionExitosa.ts';

// Mismo orden que SICAS_HEADERS, recortado a lo que hace falta para probar.
const H = ['Entidad', 'Nombre', 'Despacho', 'Tipo Documento', 'Vendedor', 'Prima Neta', 'Estatus', 'Nombre Archivo', 'Observaciones'];

/** Fila con solo lo que el sistema pone solo: despacho, tipo, vendedor, estatus y archivo. */
const soloAutomaticas = ['', '', 'LEON', 'Póliza', 'JUAN PEREZ', '', 'Vigente', 'poliza.pdf', ''];

assert.equal(huboExtraccion(H, soloAutomaticas), false,
  'una fila con solo los datos que se arman solos NO es una extracción');

// Basta UN dato real del lector para que cuente.
assert.equal(huboExtraccion(H, [...soloAutomaticas.slice(0, 5), '1500.00', 'Vigente', 'poliza.pdf', '']), true);
assert.equal(huboExtraccion(H, ['Física', ...soloAutomaticas.slice(1)]), true);

// Los espacios en blanco no son un dato.
assert.equal(huboExtraccion(H, ['   ', '', 'LEON', 'Póliza', 'JUAN PEREZ', '  ', 'Vigente', 'x.pdf', '']), false);
// Ni los nulos.
assert.equal(huboExtraccion(H, [null, undefined, 'LEON', 'Póliza', 'JUAN PEREZ', null, 'Vigente', 'x.pdf', '']), false);

// La observación es NUESTRA nota: no puede dar por buena la fila ella sola.
const conObservacion = [...soloAutomaticas];
conObservacion[8] = 'Aseguradora no reconocida';
assert.equal(huboExtraccion(H, conObservacion), false,
  'la observación no es un dato extraído');

// Marcado
const marcada = marcarSiNoSeExtrajo(H, soloAutomaticas);
assert.equal(marcada[8], AVISO_SIN_EXTRACCION);
assert.notEqual(marcada, soloAutomaticas, 'no se modifica la fila original');
assert.equal(soloAutomaticas[8], '', 'la fila original queda intacta');

// Si ya había una observación, se conserva el motivo.
assert.equal(
  marcarSiNoSeExtrajo(H, conObservacion)[8],
  `${AVISO_SIN_EXTRACCION} — Aseguradora no reconocida`,
);

// Una fila buena no se toca.
const buena = ['Física', 'JUAN', 'LEON', 'Póliza', 'JUAN PEREZ', '1500.00', 'Vigente', 'x.pdf', ''];
assert.deepEqual(marcarSiNoSeExtrajo(H, buena), buena);

// Headers y fila desparejos no deben leer una columna por otra.
assert.equal(huboExtraccion(H, ['', '', 'LEON']), false);

console.log('✓ extraccionExitosa: una póliza que no se pudo leer no pasa por buena');
