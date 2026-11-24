// Verificación de extremo a extremo del cotizador BX+ contra CUALQUIER cotizador Excel.
//
//   node src/lib/multicotizadorGmm/bxplusExcelCheck.mjs "/ruta/Cotizador_Únikuz_Bx+_....xlsm"
//
// Usa el MISMO lector que la función gmm-upload-tariff (supabase/functions/_shared/
// bxplusTariffParser.ts), así que lo que aquí se valida es exactamente lo que se cargará
// en la base. El lector detecta el layout: el archivo 2024 tiene las primas en C:E y el de
// junio 2026 en F:G con los factores +2 columnas, y ambos se leen igual.
//
// Lee los parámetros del plan capturados en la hoja "Cotizador" y compara, EDAD POR EDAD,
// lo que calcula el motor contra lo que el Excel ya calculó en su generador de tarifa
// (columnas detectadas: CG/CH/CI y BV/BW en 2024, CI/CJ/CK y BX/BY en 2026). Si el archivo
// viene vacío (plantilla sin plan capturado), el generador no tiene números y se hacen
// comprobaciones estructurales en su lugar.

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { calculateBxplus, calcularAseguradoBxplus, cargarTablasBxplus, opcionesBxplus } from './bxplusEngine.ts';
import { extraerTablasBxplus } from '../../../supabase/functions/_shared/bxplusTariffParser.ts';

const xlsm = process.argv[2] || process.env.BXPLUS_XLSM;
if (!xlsm || !existsSync(xlsm)) {
  console.log('BX+ check: sin archivo, se salta');
  process.exit(0);
}

const wb = XLSX.read(readFileSync(xlsm), { type: 'buffer' });
const { layout, tablas, errores } = extraerTablasBxplus(wb);
const cot = wb.Sheets['Cotizador'];
const tar = wb.Sheets['Tarifa'];
const v = addr => cot?.[addr]?.v;
const vt = addr => tar?.[addr]?.v;

console.log(`Archivo: ${xlsm.split('/').pop()}`);
console.log(`Layout: ${layout.etiqueta} · base en ${layout.base.colPrima} (desde ${layout.base.filaInicio})`);
if (errores.length) console.log('Errores del lector:', errores);

// Plan capturado en el archivo; si la plantilla viene vacía se usa el plan de referencia.
const planCapturado = v('E13') || v('E37');
const input = planCapturado
  ? {
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
    }
  : {
      // Plan de referencia: el mismo que trae capturado el archivo 2024.
      estado: 'JALISCO 1(GUADALAJARA Y ALEDAÑOS)',
      nivel_hospitalario: 'PLUS',
      tabulador: 'ORO-110,000',
      suma_asegurada: '50000000',
      deducible: '17000',
      coaseguro: '0.1',
      forma_pago: 'Anual',
      coverages: {
        reconocimiento_antiguedad: false,
        medicamentos_fuera: true,
        complicaciones_no_amparadas: false,
        padecimientos_preexistentes: false,
        eliminacion_deducible_accidente: true,
        maternidad: false,
        multiregion: true,
        vip: true,
        emergencia_medica_extranjero: true,
        enfermedades_graves_extranjero: false,
        cobertura_internacional: false,
        ampliacion_servicios: false,
        ayuda_diaria: false,
        indemnizacion_eg: false,
        xtensuz: false,
      },
    };

if (planCapturado) {
  console.log(`Plan capturado: ${input.estado} · ${input.nivel_hospitalario} · ${input.tabulador} · SA ${input.suma_asegurada} · D ${input.deducible} · C ${input.coaseguro}`);
} else {
  console.log('La hoja "Cotizador" viene vacía: se usa el plan de referencia del archivo 2024.');
}
console.log(`Coberturas: ${Object.entries(input.coverages).filter(([, on]) => on).map(([k]) => k).join(', ') || '(ninguna)'}`);

const tablasCargadas = cargarTablasBxplus(tablas);
const opciones = opcionesBxplus(tablas);
console.log(`Opciones: ${opciones.estados.length} estados · ${opciones.niveles.length} niveles · ${opciones.tabuladores.length} tabuladores · ${opciones.sumas_aseguradas.length} sumas · ${opciones.deducibles.length} deducibles · ${opciones.coaseguros.length} coaseguros`);
assert.ok(opciones.estados.length > 0 && opciones.deducibles.length > 0, 'las listas de opciones deben salir del archivo');

let pruebas = 0;
let edadesComparadas = 0;
let peorBasica = 0;
let peorAdicionales = 0;

const g = layout.generador;
const colsSexo = [['Hombre', g.colHombre, g.colAdicHombre], ['Mujer', g.colMujer, g.colAdicMujer]];

// El generador de tarifa arranca en la fila 6 en ambos layouts. Se exige una prima
// plausible (> 1000) para no confundir restos de la plantilla con resultados reales.
for (let fila = 6; fila <= 130; fila++) {
  const edad = vt(`${g.colEdad}${fila}`);
  if (typeof edad !== 'number') continue;
  for (const [sexo, colBasica, colAdic] of colsSexo) {
    const basicaExcel = vt(`${colBasica}${fila}`);
    if (typeof basicaExcel !== 'number' || basicaExcel < 1000) continue;
    const adicExcel = vt(`${colAdic}${fila}`);
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

if (edadesComparadas > 0) {
  console.log(`Curva completa: ${edadesComparadas} combinaciones edad/sexo · peor diferencia básica ${peorBasica.toFixed(4)} · adicionales ${peorAdicionales.toFixed(4)}`);
} else {
  // Plantilla sin generador calculado: se valida que el motor cotice con esta tarifa.
  console.log('El generador de tarifa del archivo no tiene números (plantilla sin plan capturado).');
  for (const [sexo, edad] of [['Hombre', 30], ['Mujer', 30], ['Hombre', 45], ['Mujer', 45], ['Hombre', 60], ['Mujer', 60]]) {
    const det = calcularAseguradoBxplus(edad, sexo, input, tablasCargadas);
    pruebas++;
    assert.ok(Number.isFinite(det.basica) && det.basica > 0, `${sexo} ${edad}: prima básica inválida (${det.basica})`);
    assert.ok(Number.isFinite(det.adicionales_total) && det.adicionales_total >= 0, `${sexo} ${edad}: adicionales inválidos (${det.adicionales_total})`);
    console.log(`  ${sexo.padEnd(7)} ${String(edad).padStart(2)} años · básica ${det.basica.toFixed(2).padStart(12)} · adicionales ${det.adicionales_total.toFixed(2).padStart(10)}`);
  }
}

// Asegurados capturados en el archivo (si los hay).
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
  console.log('  (el archivo no trae asegurados capturados)');
}

console.log(`BX+ check OK — ${pruebas} comprobaciones contra el propio Excel`);
