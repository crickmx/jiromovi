// Verificación de extremo a extremo del cotizador BX+ contra CUALQUIER cotizador Excel.
//
//   node src/lib/multicotizadorGmm/bxplusExcelCheck.mjs "/ruta/Cotizador_Únikuz_Bx+_....xlsm"
//
// Toma las tablas del propio archivo (mismos rangos que usa la función gmm-upload-tariff),
// lee los parámetros del plan que el archivo tiene capturados en la hoja "Cotizador" y
// compara, EDAD POR EDAD, lo que calcula el motor contra lo que el Excel ya calculó en su
// generador de tarifa (columnas CH/CI para la prima básica y BV/BW para las coberturas
// adicionales). Si además el archivo trae asegurados capturados, compara también esos.
//
// Sirve para validar la tarifa que está VIVA en beta, sin depender de valores fijos.

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { calculateBxplus, calcularAseguradoBxplus, cargarTablasBxplus, opcionesBxplus } from './bxplusEngine.ts';

const xlsm = process.argv[2] || process.env.BXPLUS_XLSM;
if (!xlsm || !existsSync(xlsm)) {
  console.log('BX+ check: sin archivo, se salta');
  process.exit(0);
}

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
  iva: ['Cotizacion', 'O69', 'formula_rate'],
};

function extraerTablas(wb) {
  const out = [];
  for (const [key, [sheetName, rango, tipo]] of Object.entries(EXCEL_RANGES)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    if (tipo === 'value') { out.push({ table_key: key, data_json: sheet[rango]?.v ?? null }); continue; }
    if (tipo === 'formula_rate') {
      const f = sheet[rango]?.f ?? '';
      const m = /(\d+(?:\.\d+)?)\s*\*/.exec(f);
      const tasa = m ? Number(m[1]) : NaN;
      out.push({ table_key: key, data_json: Number.isFinite(tasa) && tasa > 0 && tasa < 1 ? tasa : 0.16 });
      continue;
    }
    const range = XLSX.utils.decode_range(rango);
    if (tipo === 'array') {
      const arr = [];
      for (let R = range.s.r; R <= range.e.r; R++) arr.push(sheet[XLSX.utils.encode_cell({ r: R, c: range.s.c })]?.v ?? null);
      out.push({ table_key: key, data_json: arr });
      continue;
    }
    const rows = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = {};
      for (let C = range.s.c; C <= range.e.c; C++) row[`col_${C - range.s.c}`] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v ?? null;
      rows.push(row);
    }
    out.push({ table_key: key, data_json: rows });
  }
  return out;
}

const wb = XLSX.read(readFileSync(xlsm), { type: 'buffer' });
const cot = wb.Sheets['Cotizador'];
const tar = wb.Sheets['Tarifa'];
const v = (addr) => cot[addr]?.v;
const vt = (addr) => tar[addr]?.v;
const tablas = extraerTablas(wb);

const input = {
  estado: v('E13'),
  nivel_hospitalario: v('E37'),
  tabulador: v('E38'),
  suma_asegurada: String(v('E39')),
  deducible: String(v('E40')),
  coaseguro: String(v('E41')),
  forma_pago: 'Anual',
  coverages: {
    reconocimiento_antiguedad: v('J45') === true,
    medicamentos_fuera: v('J46') === true,
    complicaciones_no_amparadas: v('J47') === true,
    padecimientos_preexistentes: v('J48') === true,
    eliminacion_deducible_accidente: v('J49') === true,
    maternidad: v('J50') === true,
    multiregion: v('J51') === true,
    vip: v('J52') === true,
    emergencia_medica_extranjero: v('J53') === true,
    enfermedades_graves_extranjero: v('J54') === true,
    cobertura_internacional: v('J55') === true,
    ampliacion_servicios: v('J56') === true,
    ayuda_diaria: v('J57') === true,
    indemnizacion_eg: v('J58') === true,
    xtensuz: v('J59') === true,
  },
};

console.log(`Archivo: ${xlsm.split('/').pop()}`);
console.log(`Plan capturado: ${input.estado} · ${input.nivel_hospitalario} · ${input.tabulador} · SA ${input.suma_asegurada} · D ${input.deducible} · C ${input.coaseguro}`);
console.log(`Coberturas: ${Object.entries(input.coverages).filter(([, on]) => on).map(([k]) => k).join(', ') || '(ninguna)'}`);

const tablasCargadas = cargarTablasBxplus(tablas);
const opciones = opcionesBxplus(tablas);
console.log(`Opciones: ${opciones.estados.length} estados · ${opciones.niveles.length} niveles · ${opciones.tabuladores.length} tabuladores · ${opciones.sumas_aseguradas.length} sumas · ${opciones.deducibles.length} deducibles · ${opciones.coaseguros.length} coaseguros`);
assert.ok(opciones.estados.length > 0 && opciones.deducibles.length > 0, 'las listas de opciones deben salir del archivo');

let pruebas = 0;
let edadesComparadas = 0;
let peorBasica = 0;
let peorAdicionales = 0;

// La columna CG de la hoja Tarifa trae la edad de cada renglón del generador.
for (let fila = 6; fila <= 110; fila++) {
  const edad = vt(`CG${fila}`);
  if (edad === null || edad === undefined || typeof edad !== 'number') continue;
  for (const [sexo, colBasica, colAdic] of [['Hombre', 'CH', 'BV'], ['Mujer', 'CI', 'BW']]) {
    const basicaExcel = vt(`${colBasica}${fila}`);
    const adicExcel = vt(`${colAdic}${fila}`);
    if (typeof basicaExcel !== 'number') continue;
    const det = calcularAseguradoBxplus(edad, sexo, input, tablasCargadas);
    pruebas += 2;
    const difB = Math.abs(det.basica - basicaExcel);
    const difA = Math.abs(det.adicionales_total - (typeof adicExcel === 'number' ? adicExcel : 0));
    peorBasica = Math.max(peorBasica, difB);
    peorAdicionales = Math.max(peorAdicionales, difA);
    assert.ok(difB < 0.02, `${sexo} edad ${edad}: básica ${det.basica} vs Excel ${basicaExcel}`);
    assert.ok(difA < 0.02, `${sexo} edad ${edad}: adicionales ${det.adicionales_total} vs Excel ${adicExcel}`);
    edadesComparadas++;
  }
}
console.log(`Curva completa: ${edadesComparadas} combinaciones edad/sexo · peor diferencia básica ${peorBasica.toFixed(4)} · adicionales ${peorAdicionales.toFixed(4)}`);

// Si el archivo trae asegurados capturados, se compara también el total por asegurado.
const personas = [];
const esperado = [];
for (const r of [18, 20, 22, 24, 26, 28, 30, 32]) {
  const nombre = v(`E${r}`);
  const edad = v(`H${r}`);
  const sexo = v(`J${r}`);
  if (!nombre || edad === null || edad === undefined || !sexo) continue;
  personas.push({
    id: `p${r}`,
    name: String(nombre),
    relation: r === 18 ? 'Titular' : 'Dependiente',
    gender: String(sexo).toLowerCase().startsWith('muj') ? 'Femenino' : 'Masculino',
    age: Number(edad),
  });
  esperado.push({ basica: v(`Q${r}`), adicionales: v(`R${r}`) });
}

if (personas.length > 0) {
  const res = calculateBxplus(input, personas, tablas, 'check');
  assert.ok(!res.error, `el motor no debe fallar: ${res.error ?? ''}`);
  res.people_results.forEach((p, i) => {
    const e = esperado[i];
    if (!e || typeof e.basica !== 'number') return;
    pruebas += 2;
    assert.ok(Math.abs(p.prima_base - e.basica) < 0.02, `${p.person_name}: básica ${p.prima_base} vs Excel ${e.basica}`);
    assert.ok(Math.abs((p.prima_total - p.prima_base) - e.adicionales) < 0.02, `${p.person_name}: adicionales vs Excel`);
    console.log(`  ${p.person_name.trim().padEnd(28)} edad ${String(p.age).padStart(3)} ${p.gender.padEnd(9)} básica ${p.prima_base.toFixed(2).padStart(12)}  adicionales ${(p.prima_total - p.prima_base).toFixed(2).padStart(10)}`);
  });
  const o64 = wb.Sheets['Cotizacion']?.['O64']?.v;
  if (typeof o64 === 'number') {
    pruebas++;
    assert.ok(Math.abs(res.prima_anual_total - o64) < 0.05, `prima neta total ${res.prima_anual_total} vs Cotizacion O64 ${o64}`);
    console.log(`  Prima neta total ${res.prima_anual_total.toFixed(2)} (Excel O64 ${o64.toFixed(2)})`);
  }
} else {
  console.log('  (el archivo no trae asegurados capturados: se valida la curva completa de tarifas)');
}

console.log(`BX+ check OK — ${pruebas} comprobaciones contra el propio Excel`);
