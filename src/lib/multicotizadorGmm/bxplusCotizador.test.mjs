// Comprobación del cotizador BX+ Unikuz contra su Excel oficial.
//
//   node src/lib/multicotizadorGmm/bxplusCotizador.test.mjs "/ruta/Cotizador_Únikuz_Bx+_2024_v1_Windows_ok.xlsm"
//   (o exporta BXPLUS_XLSM)
//
// Los números esperados salen del propio Excel:
//  - Caso 1: la cotización que trae el archivo (ALISSON ROMERO, 29, Mujer, PLUS,
//    ORO-110,000, SA 50 MDP, deducible 17,000, coaseguro 10% con Medicamentos fuera del
//    hospital, Eliminación de deducible por accidente, Multiregión, VIP y Emergencia
//    médica en el extranjero): Cotizador Q18/R18/S18 y Cotizacion O64-O75.
//  - Caso 2: prima básica de la edad 0 hombre (Tarifa CH6) con los totales de
//    "Cotizacion" recalculados a mano con las fórmulas del Excel.

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { calculateBxplus, cargarTablasBxplus, topeDeCoaseguro } from './bxplusEngine.ts';

const xlsm = process.argv[2] || process.env.BXPLUS_XLSM;

if (!xlsm || !existsSync(xlsm)) {
  console.log('BX+: sin archivo (BXPLUS_XLSM), se salta');
  process.exit(0);
}

// --- Réplica de la extracción de rangos que hace la función gmm-upload-tariff ---
const EXCEL_RANGES = {
  factor_estado: ['Tarifa', 'W4:Z38', 'table'],
  factor_nivel_hospitalario: ['Tarifa', 'AA4:AB6', 'table'],
  factor_tabulador: ['Tarifa', 'AA11:AB16', 'table'],
  factor_suma_asegurada: ['Tarifa', 'N4:O9', 'table'],
  factor_deducible: ['Tarifa', 'Q4:R14', 'table'],
  factor_coaseguro: ['Tarifa', 'T4:U8', 'table'],
  tope_coaseguro: ['Tarifa', 'T13:U17', 'table'],
  forma_pago: ['Tarifa', 'BL31:BN35', 'table'],
  base_intermedia_edad_sexo: ['Tarifa', 'C3:E110', 'table'],
  coef_medicamentos: ['Tarifa', 'AJ3', 'value'],
  coef_preexistentes: ['Tarifa', 'AJ7', 'value'],
  coef_complicaciones: ['Tarifa', 'AJ11', 'value'],
  coef_vip: ['Tarifa', 'BI3', 'value'],
  coef_antiguedad: ['Tarifa', 'BI7', 'value'],
  coef_emergencia_ext: ['Tarifa', 'AW3', 'value'],
  coef_enf_graves_ext: ['Tarifa', 'AW7', 'value'],
  coef_ayuda_diaria: ['Tarifa', 'BC3', 'value'],
  coef_ampliacion_servicios: ['Tarifa', 'BC7', 'value'],
  denominador_cargas: ['Tarifa', 'L4:L6', 'array'],
  deducible_accidente_keys: ['Tarifa', 'AU15:AU23', 'array'],
  deducible_accidente_factors: ['Tarifa', 'AW15:AW23', 'array'],
  multiregion_carga_sistema: ['Tarifa', 'AQ42:AS74', 'table'],
  cobertura_internacional_carga_sistema: ['Tarifa', 'AY42:BA76', 'table'],
  gastos_expedicion: ['Cotizacion', 'O67', 'value'],
  iva: ['Cotizacion', 'O69', 'value'],
};

function extraerTablas(wb) {
  const out = [];
  for (const [key, [sheetName, rango, tipo]] of Object.entries(EXCEL_RANGES)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    if (tipo === 'value') {
      out.push({ table_key: key, data_json: sheet[rango]?.v ?? null });
      continue;
    }
    const range = XLSX.utils.decode_range(rango);
    if (tipo === 'array') {
      const arr = [];
      for (let R = range.s.r; R <= range.e.r; R++) {
        arr.push(sheet[XLSX.utils.encode_cell({ r: R, c: range.s.c })]?.v ?? null);
      }
      out.push({ table_key: key, data_json: arr });
      continue;
    }
    const rows = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = {};
      for (let C = range.s.c; C <= range.e.c; C++) {
        row[`col_${C - range.s.c}`] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v ?? null;
      }
      rows.push(row);
    }
    out.push({ table_key: key, data_json: rows });
  }
  return out;
}

const wb = XLSX.read(readFileSync(xlsm), { type: 'buffer' });
const tablas = extraerTablas(wb);

let pruebas = 0;
const casi = (actual, esperado, msg, tol = 0.02) => {
  pruebas++;
  assert.ok(Math.abs(actual - esperado) <= tol, `${msg}: se esperaba ~${esperado}, se obtuvo ${actual}`);
};

const coberturasCaso1 = {
  reconocimiento_antiguedad: false,
  medicamentos_fuera: true,
  complicaciones_no_amparadas: false,
  padecimientos_preexistentes: false,
  eliminacion_deducible_accidente: true,
  multiregion: true,
  vip: true,
  emergencia_medica_extranjero: true,
  enfermedades_graves_extranjero: false,
  cobertura_internacional: false,
  ampliacion_servicios: false,
  ayuda_diaria: false,
  indemnizacion_eg: false,
  maternidad: false,
  xtensuz: false,
};

// ---------------- Caso 1: la cotización del Excel ----------------
const caso1 = calculateBxplus(
  {
    estado: 'JALISCO 1(GUADALAJARA Y ALEDAÑOS)',
    nivel_hospitalario: 'PLUS',
    tabulador: 'ORO-110,000',
    suma_asegurada: '50000000',
    deducible: '17000',
    coaseguro: '0.1',
    forma_pago: 'Anual',
    coverages: coberturasCaso1,
  },
  [{ id: 'p1', name: 'ALISSON ROMERO CALDERON', relation: 'Titular', gender: 'Femenino', age: 29 }],
  tablas,
  'test-bxplus'
);

assert.ok(!caso1.error, `BX+ caso 1 sin error: ${caso1.error ?? ''}`);
const p1 = caso1.people_results[0];
casi(p1.prima_base, 17510.6491, 'BX+ prima básica (Cotizador Q18)');
casi(p1.prima_total - p1.prima_base, 7025.806, 'BX+ coberturas adicionales (Cotizador R18)');
casi(p1.prima_total, 24536.4551, 'BX+ prima neta del asegurado (Cotizador S18)');
casi(caso1.prima_anual_total, 24536.4551, 'BX+ prima neta total (Cotizacion O64)');

// Cotizacion: O65 descuentos, O66 recargo, O67 derecho, O68 subtotal, O69 IVA, O70 total.
const anual1 = caso1.totals.Anual;
casi(anual1.recargo, 0, 'BX+ recargo anual (Cotizacion O66)');
casi(anual1.gastos_expedicion, 900, 'BX+ derecho de póliza (Cotizacion O67)');
casi(anual1.subtotal, 25436.4551, 'BX+ subtotal (Cotizacion O68)');
casi(anual1.iva, 4069.832816, 'BX+ IVA (Cotizacion O69)');
casi(anual1.total, 29506.287916, 'BX+ prima total (Cotizacion O70)');
casi(anual1.primer_pago, 29506.287916, 'BX+ primer recibo anual (Cotizacion O74)');
casi(anual1.pagos_subsecuentes, 0, 'BX+ sin recibos subsecuentes en anual');
casi(anual1.num_recibos, 1, 'BX+ número de recibos anual (Cotizacion D66)');

// ---------------- Caso 2: edad 0 hombre, sin coberturas ----------------
const caso2 = calculateBxplus(
  {
    estado: 'JALISCO 1(GUADALAJARA Y ALEDAÑOS)',
    nivel_hospitalario: 'PLUS',
    tabulador: 'ORO-110,000',
    suma_asegurada: '50000000',
    deducible: '17000',
    coaseguro: '0.1',
    forma_pago: 'Anual',
    coverages: {},
  },
  [{ id: 'p1', name: 'BEBE', relation: 'Hijo', gender: 'Masculino', age: 0 }],
  tablas,
  'test-bxplus'
);

assert.ok(!caso2.error, `BX+ caso 2 sin error: ${caso2.error ?? ''}`);
casi(caso2.people_results[0].prima_base, 10051.5929, 'BX+ prima básica edad 0 hombre (Tarifa CH6)');
casi(caso2.people_results[0].prima_total, 10051.5929, 'BX+ sin coberturas = solo la básica');
casi(caso2.totals.Anual.total, 12703.847764, 'BX+ total anual edad 0 (10051.5929 + 900) × 1.16');
casi(caso2.totals.Semestral.recargo, 452.3217, 'BX+ recargo semestral 4.5%');
casi(caso2.totals.Semestral.subtotal, 11403.9146, 'BX+ subtotal semestral');
casi(caso2.totals.Semestral.primer_pago, 7136.27, 'BX+ primer recibo semestral (derecho completo)');
casi(caso2.totals.Semestral.pagos_subsecuentes, 6092.27, 'BX+ recibo subsecuente semestral');
casi(caso2.totals.Mensual.recargo, 753.8695, 'BX+ recargo mensual 7.5%');
casi(caso2.totals.Mensual.num_recibos, 12, 'BX+ recibos mensuales');

// ---------------- Tablas auxiliares ----------------
const t = cargarTablasBxplus(tablas);
casi(topeDeCoaseguro(t.tope_coaseguro, '0.1'), 48000, 'BX+ tope de coaseguro 10%');
casi(topeDeCoaseguro(t.tope_coaseguro, 0.3), 96000, 'BX+ tope de coaseguro 30%');
assert.deepEqual(
  t.denominador_cargas.map(Number),
  [0.1, 0.27, 0.07],
  'BX+ cargas de la tarifa (hoja Tarifa L4:L6)'
);

console.log(`BX+ OK — cotización del Excel reproducida al centavo (${pruebas} comprobaciones)`);
