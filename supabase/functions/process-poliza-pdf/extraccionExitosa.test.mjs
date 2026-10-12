// npx tsx supabase/functions/process-poliza-pdf/extraccionExitosa.test.mjs
//
// Un error aquí no da ningún síntoma visible: la fila del Excel se ve normal,
// el archivo dice "Datos extraídos" y el PDF no se manda a entrenamiento.

import assert from 'node:assert/strict';
import { datosUtilesExtraidos, marcarSiNoSeExtrajo, AVISO_SIN_EXTRACCION } from './extraccionExitosa.ts';

// ── Lo que el extractor devuelve cuando NO leyó la póliza ──────────────────
// Caso real (TK0F7A2-A): respondió estado "ok" con solo la clasificación.
assert.equal(datosUtilesExtraidos({ sub_ramo: 'Automóviles' }), false,
  'el sub ramo lo acierta cualquiera por el formato, no prueba que se leyó');
assert.equal(datosUtilesExtraidos({ ramo: 'Autos', aseguradora: 'GNP' }), false);
assert.equal(datosUtilesExtraidos({}), false);
assert.equal(datosUtilesExtraidos(null), false);
assert.equal(datosUtilesExtraidos(undefined), false);

// Vacíos y espacios no son datos.
assert.equal(datosUtilesExtraidos({ documento: '', rfc: '   ', nombre_cliente: null }), false);

// ── Basta UN identificador para que cuente ────────────────────────────────
assert.equal(datosUtilesExtraidos({ documento: 'AUIN-049998-37' }), true);
assert.equal(datosUtilesExtraidos({ rfc: 'RORJ800505N19' }), true);
assert.equal(datosUtilesExtraidos({ nombre_cliente: 'MARIA DE JESUS RODRIGUEZ' }), true);
assert.equal(datosUtilesExtraidos({ prima_total: 8844.74 }), true, 'un número tambien cuenta');
assert.equal(datosUtilesExtraidos({ serie: '3VW1M1AJ2GM269028' }), true);
assert.equal(datosUtilesExtraidos({ agente_clave: '370551' }), true);
// Una póliza de vida no trae placas ni serie, pero sí vigencia.
assert.equal(datosUtilesExtraidos({ desde: '2026-01-13', hasta: '2027-01-13' }), true);

// ── Que falte un campo opcional NO es una falla ───────────────────────────
// Lo que decide es que llegue AL MENOS UNO de los identificadores, no que
// esten todos. Una poliza bien leida sin placas, motor ni renovacion pasa.
assert.equal(
  datosUtilesExtraidos({ documento: 'VI-998', nombre_cliente: 'GABRIELA DOMINGUEZ', desde: '2019-12-27' }),
  true,
  'sin placas, motor, renovacion ni ejecutivo de cuenta, pero leida',
);
// Y los campos que NO toda poliza tiene no alcanzan solos.
assert.equal(datosUtilesExtraidos({ placas: 'GVC677C' }), false);
assert.equal(datosUtilesExtraidos({ motor: 'CBP713281', renovacion: '0' }), false);
assert.equal(datosUtilesExtraidos({ ejecutivo_cuenta: 'JUAN', grupo: 'X' }), false);
assert.equal(datosUtilesExtraidos({ fecha_antiguedad: '2019-01-01' }), false);

// ── Todo lo demas SI cuenta ───────────────────────────────────────────────
for (const campo of ['forma_pago', 'moneda', 'concepto', 'descripcion_veh', 'modelo']) {
  assert.equal(datosUtilesExtraidos({ [campo]: 'algo' }), true, `${campo} deberia contar`);
}
// Los importes cuentan aunque valgan cero: un cero extraido es un dato.
assert.equal(datosUtilesExtraidos({ recargos: 0 }), true);
assert.equal(datosUtilesExtraidos({ iva: 1204.45 }), true);

// ── Marcado de la fila del Excel ──────────────────────────────────────────
const H = ['Documento', 'Prima Neta', 'Nombre Archivo', 'Observaciones'];
const filaVacia = ['', '', 'poliza.pdf', ''];

assert.equal(marcarSiNoSeExtrajo(H, filaVacia, false)[3], AVISO_SIN_EXTRACCION);
assert.equal(filaVacia[3], '', 'la fila original no se toca');

// Si ya había una observación, se conserva el motivo.
assert.equal(
  marcarSiNoSeExtrajo(H, ['', '', 'x.pdf', 'Aseguradora no reconocida'], false)[3],
  `${AVISO_SIN_EXTRACCION} — Aseguradora no reconocida`,
);

// Una extracción buena no se marca.
const buena = ['AUIN-049998-37', '6790.29', 'x.pdf', ''];
assert.deepEqual(marcarSiNoSeExtrajo(H, buena, true), buena);

// Sin columna de observaciones no truena, solo no marca.
assert.deepEqual(marcarSiNoSeExtrajo(['Documento'], ['x'], false), ['x']);

console.log('✓ extraccionExitosa: una póliza que solo trajo su clasificación no pasa por extraída');
