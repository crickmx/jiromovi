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
assert.equal(datosUtilesExtraidos({ ramo: 'Autos', aseguradora: 'GNP', moneda: 'PESOS', forma_pago: 'ANUAL' }), false);
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
assert.equal(datosUtilesExtraidos({ placas: 'GVC677C' }), true);
// Una póliza de vida no trae placas ni serie, pero sí vigencia.
assert.equal(datosUtilesExtraidos({ desde: '2026-01-13', hasta: '2027-01-13' }), true);

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
