// Herramienta de carga: parsea un Excel de Bupa con el lector nuevo y lo deja como
// paquete DRAFT en multicotizador_gmm_packages (lo mismo que hace la pestaña Tarifas del
// Multicotizador, pero desde línea de comandos para verificar la carga).
//
//   SUPABASE_SERVICE_ROLE_KEY=... node tools/importar-tarifa-bupa.mjs <BNV|BNP> "<archivo.xlsm>" "<nombre version>"
//
// No activa nada: deja el paquete en borrador para revisarlo en la pantalla.

import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseBupaWorkbook } from '../src/lib/multicotizadorGmm/bupaTariffParser.ts';

const [producto, archivo, version] = process.argv.slice(2);
if (!producto || !archivo || !version) {
  console.error('uso: node tools/importar-tarifa-bupa.mjs <BNV|BNP> "<archivo.xlsm>" "<nombre version>"');
  process.exit(1);
}

const URL_BASE = process.env.SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('falta SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const cabeceras = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...cabeceras, ...(init.headers || {}) } });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

const wb = XLSX.read(readFileSync(archivo), { type: 'buffer' });
const { meta, rates, errors, warnings } = parseBupaWorkbook(wb, producto);
if (errors.length) console.error('avisos del lector:', errors.join(' | '));
if (warnings.length) console.error('notas:', warnings.join(' | '));

console.log(`Leídas ${rates.length.toLocaleString()} tarifas · ${meta.sumas_aseguradas.length} sumas · ${meta.deducibles.length} deducibles · ${meta.coaseguros.length} coaseguros · ${meta.topes_coaseguro?.length ?? 0} topes`);

const [pkg] = await rest('multicotizador_gmm_packages', {
  method: 'POST',
  headers: { Prefer: 'return=representation' },
  body: JSON.stringify({
    product: meta.product,
    version_name: version,
    source_filename: archivo.split('/').pop(),
    status: 'draft',
    derecho_poliza: meta.derecho_poliza,
    asistencia_extranjero: meta.asistencia_extranjero,
    costo_catastrofica_extranjero: meta.catastrofica?.costo_por_integrante ?? 0,
    sumas_aseguradas: meta.sumas_aseguradas,
    deducibles: meta.deducibles,
    coaseguros: meta.coaseguros,
    topes_coaseguro: meta.topes_coaseguro ?? [],
    client_types: meta.client_types ?? [],
    internal_factors: meta,
    rates_count: rates.length,
  }),
});
console.log('paquete', pkg.id, pkg.version_name);

const lote = 1000;
for (let i = 0; i < rates.length; i += lote) {
  const filas = rates.slice(i, i + lote).map(r => ({
    package_id: pkg.id,
    lookup_key: `${r.plan_name}|${r.region}|${r.age}|${r.rate_type}`,
    plan_name: r.plan_name,
    region: r.region,
    age: r.age,
    rate: r.rate,
    rate_type: r.rate_type,
  }));
  await rest('multicotizador_gmm_rates', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(filas) });
  process.stdout.write(`\rinsertadas ${Math.min(i + lote, rates.length).toLocaleString()} / ${rates.length.toLocaleString()}`);
}
console.log('\nlisto');
