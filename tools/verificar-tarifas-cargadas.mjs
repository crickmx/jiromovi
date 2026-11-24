// Verificación de punta a punta: lee de la BASE las tarifas que acaba de dejar el importador
// y comprueba que el motor reproduce los mismos números que el Excel.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node tools/verificar-tarifas-cargadas.mjs <id-paquete-BNV> <id-paquete-BNP>

import assert from 'node:assert/strict';
import { calculateBnv } from '../src/lib/multicotizadorGmm/bnvEngine.ts';
import { calculateBnp } from '../src/lib/multicotizadorGmm/bnpEngine.ts';

const URL_BASE = process.env.SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [idBnv, idBnp] = process.argv.slice(2);
const cabeceras = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function traer(path) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { headers: cabeceras });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function cargarPaquete(id) {
  const [pkg] = await traer(`multicotizador_gmm_packages?id=eq.${id}&select=*`);
  const rates = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = await traer(
      `multicotizador_gmm_rates?package_id=eq.${id}&select=plan_name,region,age,rate,rate_type&order=id&limit=1000&offset=${desde}`
    );
    rates.push(...lote);
    if (lote.length < 1000) break;
  }
  return { pkg, rates, meta: pkg.internal_factors ?? {} };
}

let pruebas = 0;
const casi = (a, e, msg, tol = 0.02) => { pruebas++; assert.ok(Math.abs(a - e) <= tol, `${msg}: esperado ~${e}, obtenido ${a}`); };

// ---- BNV: la cotización completa del Excel ----
if (idBnv) {
  const { pkg, rates, meta } = await cargarPaquete(idBnv);
  console.log(`BNV paquete ${pkg.version_name} · ${rates.length.toLocaleString()} tarifas en la base`);
  assert.equal(rates.length, pkg.rates_count, 'el conteo guardado debe coincidir con las filas');

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
    { region_zone: 'Zona 2', suma_asegurada: 3, deducible: 100, coaseguro: 10, tope_coaseguro: 30000,
      client_type: 'Nuevo negocio', asistencia_extranjero: true, forma_pago: 'Anual' },
    personas, rates,
    { id: pkg.id, derecho_poliza: Number(pkg.derecho_poliza), asistencia_extranjero: Number(pkg.asistencia_extranjero),
      plan_prefix: meta.plan_prefix, zonas: meta.zonas, factores_pago: meta.factores_pago }
  );
  assert.ok(!r.error, `BNV sin error: ${r.error ?? ''}`);
  casi(r.prima_anual_total, 252004, 'BNV total prima (Excel C48)');
  casi(r.totals.Anual.total, 294180.64, 'BNV costo total anual (Excel C52)');
  casi(r.totals.Semestral.primer_pago, 154595.62, 'BNV primer pago semestral (Excel D53)');
  casi(r.totals.Mensual.pagos_subsecuentes, 26552.82, 'BNV subsecuente mensual (Excel F54)');
  console.log(`  OK — total prima ${r.prima_anual_total.toFixed(2)} · anual ${r.totals.Anual.total.toFixed(2)} · semestral 1er pago ${r.totals.Semestral.primer_pago.toFixed(2)}`);
}

// ---- BNP: primas por edad/sexo y catastrófica ----
if (idBnp) {
  const { pkg, rates, meta } = await cargarPaquete(idBnp);
  console.log(`BNP paquete ${pkg.version_name} · ${rates.length.toLocaleString()} tarifas en la base`);
  assert.equal(rates.length, pkg.rates_count, 'el conteo guardado debe coincidir con las filas');

  const cfg = {
    id: pkg.id,
    derecho_poliza: Number(pkg.derecho_poliza),
    asistencia_extranjero: Number(pkg.asistencia_extranjero),
    costo_catastrofica_extranjero: Number(pkg.costo_catastrofica_extranjero),
    plan_prefix: meta.plan_prefix,
    zonas: meta.zonas,
    estados: meta.estados,
    client_types: meta.client_types,
    catastrofica: meta.catastrofica,
    factores_pago: meta.factores_pago,
  };
  const uno = (age, gender) => calculateBnp(
    { region_zone: 'Zona 2', suma_asegurada: 5, deducible: 9, coaseguro: 0, client_type: 'Nuevo negocio',
      estado: 'Aguascalientes', maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual' },
    [{ id: 'x', name: 'X', relation: 'Titular', gender, age }], rates, cfg
  );
  casi(uno(30, 'Masculino').people_results[0].annual_premium, 29695, 'BNP NPS5D9C0 R2 30M');
  casi(uno(30, 'Femenino').people_results[0].annual_premium, 35498, 'BNP NPS5D9C0 R2 30F');

  const cat = calculateBnp(
    { region_zone: 'Zona 1', suma_asegurada: 20, deducible: 55, coaseguro: 0, client_type: 'Nuevo negocio',
      estado: 'Ciudad de Mexico y área metropolitana', maternidad_titular: false, maternidad_conyuge: false,
      asistencia_extranjero: false, cobertura_catastrofica_extranjero: true, forma_pago: 'Anual' },
    [{ id: 'a', name: 'A', relation: 'Titular', gender: 'Masculino', age: 40 },
     { id: 'b', name: 'B', relation: 'Conyuge', gender: 'Femenino', age: 38 }], rates, cfg
  );
  casi(cat.totals.Anual.catastrofica_extranjero, 11600, 'BNP catastrófica 5800 x 2');
  console.log(`  OK — 30M ${uno(30, 'Masculino').people_results[0].annual_premium} · 30F ${uno(30, 'Femenino').people_results[0].annual_premium} · catastrófica ${cat.totals.Anual.catastrofica_extranjero}`);
}

console.log(`\n${pruebas} comprobaciones contra las tarifas guardadas en la base.`);
