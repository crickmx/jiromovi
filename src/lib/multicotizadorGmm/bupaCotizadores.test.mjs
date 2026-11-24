// Comprobación de los cotizadores de Bupa (BNV y BNP) contra los Excel oficiales.
//
//   node src/lib/multicotizadorGmm/bupaCotizadores.test.mjs \
//     "/ruta/Cotizador-BNV-2026-V4-1.xlsm" "/ruta/Cotizador-BNP-2026-V3-Nuevos-Negocios-2.xlsm"
//
// (o exporta BNV_XLSM / BNP_XLSM). Sin archivos el test se salta: no se versionan los Excel.
//
// Los números esperados NO salen de este código: salen del propio Excel.
//  - BNV: celdas ya calculadas de "Datos Asegurado" (C43:C54 y D/E/F 43-54) para la
//    cotización que trae el archivo (titular 74 F, Zona 2, 8 integrantes, SA 3 MDP,
//    deducible 100,000, coaseguro 10%, tope 30,000, asistencia Sí).
//  - BNV/BNP: valores de la tabla MasterBase leídos por separado (otra librería, openpyxl)
//    para comprobar que la búsqueda por llave devuelve exactamente la misma prima.

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseBupaWorkbook } from './bupaTariffParser.ts';
import { calculateBnv } from './bnvEngine.ts';
import { calculateBnp } from './bnpEngine.ts';

const bnvPath = process.argv[2] || process.env.BNV_XLSM;
const bnpPath = process.argv[3] || process.env.BNP_XLSM;

let pruebas = 0;
const ok = (cond, msg) => { pruebas++; assert.ok(cond, msg); };
const casi = (actual, esperado, msg, tol = 0.02) => {
  pruebas++;
  assert.ok(Math.abs(actual - esperado) <= tol, `${msg}: se esperaba ~${esperado}, se obtuvo ${actual}`);
};

function leerWorkbook(path) {
  return XLSX.read(readFileSync(path), { type: 'buffer' });
}

// ---------------------------------------------------------------------------
// BNV — Bupa Nacional Vital
// ---------------------------------------------------------------------------
if (bnvPath && existsSync(bnvPath)) {
  const wb = leerWorkbook(bnvPath);
  const { meta, rates, errors } = parseBupaWorkbook(wb, 'BNV');

  ok(errors.length === 0, `BNV: el parser no debe reportar errores: ${errors.join(' | ')}`);
  ok(meta.plan_prefix === 'NVFS', `BNV: prefijo de plan ${meta.plan_prefix}`);
  assert.deepEqual(meta.sumas_aseguradas, [1, 2, 3, 4, 5, 10], 'BNV: sumas aseguradas');
  assert.deepEqual(meta.deducibles, [0, 10, 15, 20, 30, 50, 100], 'BNV: deducibles');
  assert.deepEqual(meta.coaseguros, [0, 5, 10, 20], 'BNV: coaseguros');
  assert.deepEqual(meta.topes_coaseguro, [20000, 30000, 40000], 'BNV: topes de coaseguro');
  casi(meta.derecho_poliza, 1600, 'BNV: derecho de póliza', 0);
  casi(meta.asistencia_extranjero, 1632, 'BNV: asistencia en el extranjero', 0);
  ok(rates.length === 91280, `BNV: filas de tarifa ${rates.length}`);

  const cfg = {
    id: 'test-bnv',
    derecho_poliza: meta.derecho_poliza,
    asistencia_extranjero: meta.asistencia_extranjero,
    plan_prefix: meta.plan_prefix,
    zonas: meta.zonas,
  };

  // Cotización que trae el propio Excel.
  const personas = [
    { id: 'p1', name: 'TITULAR', relation: 'Titular', gender: 'Femenino', age: 74 },
    { id: 'p2', name: 'CONYUGE', relation: 'Conyuge', gender: 'Masculino', age: 45 },
    { id: 'p3', name: 'DEP1', relation: 'Dependiente', gender: 'Masculino', age: 75 },
    { id: 'p4', name: 'HIJO1', relation: 'Hijo', gender: 'Masculino', age: 0 },
    { id: 'p5', name: 'HIJO2', relation: 'Hijo', gender: 'Masculino', age: 0 },
    { id: 'p6', name: 'HIJO3', relation: 'Hijo', gender: 'Masculino', age: 1 },
    { id: 'p7', name: 'HIJO4', relation: 'Hijo', gender: 'Masculino', age: 8 },
    { id: 'p8', name: 'HIJO5', relation: 'Hijo', gender: 'Masculino', age: 10 },
    { id: 'p9', name: 'HIJO6', relation: 'Hijo', gender: 'Masculino', age: 72 },
  ];

  const r = calculateBnv(
    {
      region_zone: 'Zona 2',
      suma_asegurada: 3,
      deducible: 100,
      coaseguro: 10,
      tope_coaseguro: 30000,
      client_type: 'Nuevo negocio',
      asistencia_extranjero: true,
      forma_pago: 'Anual',
    },
    personas,
    rates,
    cfg
  );

  ok(!r.error, `BNV: sin error de cálculo (${r.error ?? ''})`);
  ok((r.warnings ?? []).length === 0, `BNV: sin avisos de tarifa faltante (${(r.warnings ?? []).join(' | ')})`);

  // Primas por persona tal como las resuelve el Excel.
  casi(r.people_results[0].discounted_rate, 73307, 'BNV titular 74F');
  casi(r.people_results[1].discounted_rate, 12189, 'BNV cónyuge 45M');
  casi(r.people_results[2].discounted_rate, 78805, 'BNV dependiente 75M');
  casi(r.people_results[3].discounted_rate, 5032, 'BNV hijo 0');
  casi(r.people_results[6].discounted_rate, 3821, 'BNV hijo 8');
  casi(r.people_results[7].discounted_rate, 4072, 'BNV hijo 10');
  casi(r.people_results[8].discounted_rate, 63435, 'BNV hijo 72');

  // Totales del Excel: C48 (total prima) y D/E/F 48.
  casi(r.prima_anual_total, 252004, 'BNV total prima anual');
  casi(r.totals.Anual.prima_neta, 252004, 'BNV prima neta anual');
  casi(r.totals.Semestral.prima_neta, 263344.18, 'BNV prima neta semestral (x1.045)');
  casi(r.totals.Trimestral.prima_neta, 270904.30, 'BNV prima neta trimestral (x1.075)');
  casi(r.totals.Mensual.prima_neta, 274684.36, 'BNV prima neta mensual (x1.09)');

  casi(r.totals.Anual.iva, 40576.64, 'BNV IVA anual');
  casi(r.totals.Anual.total, 294180.64, 'BNV costo total anual');
  casi(r.totals.Anual.primer_pago, 294180.64, 'BNV primer pago anual');
  casi(r.totals.Anual.pagos_subsecuentes, 0, 'BNV sin pagos subsecuentes en anual');

  casi(r.totals.Semestral.iva, 42391.07, 'BNV IVA semestral');
  casi(r.totals.Semestral.total, 307335.25, 'BNV costo total semestral');
  casi(r.totals.Semestral.primer_pago, 154595.62, 'BNV primer pago semestral (derecho completo)');
  casi(r.totals.Semestral.pagos_subsecuentes, 152739.62, 'BNV subsecuente semestral');

  casi(r.totals.Trimestral.primer_pago, 80418.25, 'BNV primer pago trimestral');
  casi(r.totals.Trimestral.pagos_subsecuentes, 78562.25, 'BNV subsecuente trimestral');
  casi(r.totals.Mensual.primer_pago, 28408.82, 'BNV primer pago mensual');
  casi(r.totals.Mensual.pagos_subsecuentes, 26552.82, 'BNV subsecuente mensual');

  // Zona 1 / otro plan: valores de la tabla leídos aparte.
  const r2 = calculateBnv(
    {
      region_zone: 'Zona 1', suma_asegurada: 10, deducible: 0, coaseguro: 0,
      tope_coaseguro: 0, client_type: 'Nuevo negocio', asistencia_extranjero: false, forma_pago: 'Anual',
    },
    [{ id: 'x', name: 'X', relation: 'Titular', gender: 'Masculino', age: 30 }],
    rates,
    cfg
  );
  casi(r2.people_results[0].discounted_rate, 24837, 'BNV NVFS10D0C0 zona 1 edad 30');

  const r3 = calculateBnv(
    {
      region_zone: 'Zona 1', suma_asegurada: 1, deducible: 15, coaseguro: 5,
      tope_coaseguro: 40000, client_type: 'Nuevo negocio', asistencia_extranjero: false, forma_pago: 'Anual',
    },
    [{ id: 'x', name: 'X', relation: 'Titular', gender: 'Femenino', age: 45 }],
    rates,
    cfg
  );
  casi(r3.people_results[0].discounted_rate, 22519, 'BNV NVFS1D15C5TC40 zona 1 edad 45');

  // Una edad fuera de la tabla no debe inventar prima (el Excel devuelve 0).
  const r4 = calculateBnv(
    {
      region_zone: 'Zona 2', suma_asegurada: 3, deducible: 100, coaseguro: 10,
      tope_coaseguro: 30000, client_type: 'Nuevo negocio', asistencia_extranjero: false, forma_pago: 'Anual',
    },
    [{ id: 'x', name: 'X', relation: 'Titular', gender: 'Masculino', age: 99 }],
    rates,
    cfg
  );
  casi(r4.people_results[0].discounted_rate, 0, 'BNV edad 99 sin tarifa');
  ok((r4.warnings ?? []).length === 1, 'BNV avisa cuando falta la tarifa de una edad');

  console.log(`BNV OK — ${rates.length.toLocaleString()} tarifas, cotización del Excel reproducida al centavo`);
} else {
  console.log('BNV: sin archivo (BNV_XLSM), se salta');
}

// ---------------------------------------------------------------------------
// BNP — Bupa Nacional Plus
// ---------------------------------------------------------------------------
if (bnpPath && existsSync(bnpPath)) {
  const wb = leerWorkbook(bnpPath);
  const { meta, rates, errors } = parseBupaWorkbook(wb, 'BNP');

  ok(errors.length === 0, `BNP: el parser no debe reportar errores: ${errors.join(' | ')}`);
  ok(meta.plan_prefix === 'NPS', `BNP: prefijo de plan ${meta.plan_prefix}`);
  assert.deepEqual(meta.sumas_aseguradas, [5, 10, 20, 50], 'BNP: sumas aseguradas');
  assert.deepEqual(meta.deducibles, [9, 14, 17, 35, 55, 75, 115, 200], 'BNP: deducibles');
  assert.deepEqual(meta.coaseguros, [0, 10, 20], 'BNP: coaseguros');
  casi(meta.derecho_poliza, 1600, 'BNP: derecho de póliza', 0);
  ok(meta.estados.length >= 30, `BNP: estados para derivar la zona (${meta.estados.length})`);
  ok(rates.length === 62560, `BNP: filas de tarifa ${rates.length}`);

  const cfg = {
    id: 'test-bnp',
    derecho_poliza: meta.derecho_poliza,
    asistencia_extranjero: meta.asistencia_extranjero,
    costo_catastrofica_extranjero: meta.catastrofica.costo_por_integrante,
    plan_prefix: meta.plan_prefix,
    zonas: meta.zonas,
    estados: meta.estados,
    client_types: meta.client_types,
    catastrofica: meta.catastrofica,
  };

  // Zona por estado: Aguascalientes es Zona 2 en el Excel.
  const aguas = meta.estados.find(e => e.estado.toLowerCase().startsWith('aguascalientes'));
  ok(aguas && aguas.zona === 'Zona 2', 'BNP: Aguascalientes debe ser Zona 2');

  const uno = (age, gender, extra = {}) => calculateBnp(
    {
      region_zone: 'Zona 2', suma_asegurada: 5, deducible: 9, coaseguro: 0,
      client_type: 'Nuevo negocio', estado: 'Aguascalientes',
      maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual',
      ...extra,
    },
    [{ id: 'x', name: 'X', relation: 'Titular', gender, age }],
    rates,
    cfg
  );

  // Valores de MasterBase leídos por separado (openpyxl) para la misma llave.
  casi(uno(30, 'Masculino').people_results[0].annual_premium, 29695, 'BNP NPS5D9C0 R2 30M');
  casi(uno(30, 'Femenino').people_results[0].annual_premium, 35498, 'BNP NPS5D9C0 R2 30F');

  const dos = calculateBnp(
    {
      region_zone: 'Zona 1', suma_asegurada: 10, deducible: 35, coaseguro: 10,
      client_type: 'Nuevo negocio', estado: 'Ciudad de Mexico y área metropolitana',
      maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual',
    },
    [{ id: 'x', name: 'X', relation: 'Titular', gender: 'Femenino', age: 45 }],
    rates,
    cfg
  );
  casi(dos.people_results[0].annual_premium, 42425, 'BNP NPS10D35C10 R1 45F');

  // La prima por sexo es distinta: es la razón de que la llave lleve el sexo.
  ok(
    uno(30, 'Masculino').people_results[0].annual_premium !== uno(30, 'Femenino').people_results[0].annual_premium,
    'BNP: la tarifa depende del sexo'
  );

  // Catastrófica en el extranjero: 5800 por integrante cuando aplica.
  const cat = calculateBnp(
    {
      region_zone: 'Zona 1', suma_asegurada: 20, deducible: 55, coaseguro: 0,
      client_type: 'Nuevo negocio', estado: 'Ciudad de Mexico y área metropolitana',
      maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: true, forma_pago: 'Anual',
    },
    [
      { id: 'a', name: 'A', relation: 'Titular', gender: 'Masculino', age: 40 },
      { id: 'b', name: 'B', relation: 'Conyuge', gender: 'Femenino', age: 38 },
    ],
    rates,
    cfg
  );
  casi(cat.totals.Anual.catastrofica_extranjero, 11600, 'BNP catastrófica = 5800 x 2 integrantes');

  // Fuera de la regla de elegibilidad no se cobra.
  const sinCat = calculateBnp(
    {
      region_zone: 'Zona 1', suma_asegurada: 5, deducible: 55, coaseguro: 0,
      client_type: 'Nuevo negocio', estado: 'Ciudad de Mexico y área metropolitana',
      maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: true, forma_pago: 'Anual',
    },
    [{ id: 'a', name: 'A', relation: 'Titular', gender: 'Masculino', age: 40 }],
    rates,
    cfg
  );
  casi(sinCat.totals.Anual.catastrofica_extranjero, 0, 'BNP catastrófica no aplica con suma de 5 MDP');

  console.log(`BNP OK — ${rates.length.toLocaleString()} tarifas, primas y catastrofica verificadas`);
} else {
  console.log('BNP: sin archivo (BNP_XLSM), se salta');
}

console.log(`\n${pruebas} comprobaciones pasaron.`);
