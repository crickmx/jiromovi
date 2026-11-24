// Compara las tablas que el lector saca de un Excel BX+ contra las que están vivas en la base.
//
//   node tools/comparar-tablas-bx.mjs <Excel.xlsm> <paquete.json>
//
// El JSON del paquete se obtiene con:
//   /tmp/q.sh "select table_key, data_json from tariff_tables where tariff_package_id='<uuid>'" > paquete.json
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { extraerTablasBxplus } from '../supabase/functions/_shared/bxplusTariffParser.ts';

const [archivo, rutaDb] = process.argv.slice(2);
if (!archivo || !rutaDb) {
  console.log('uso: node tools/comparar-tablas-bx.mjs <Excel.xlsm> <paquete.json>');
  process.exit(1);
}

const db = JSON.parse(readFileSync(rutaDb, 'utf8'));
const dbPorClave = new Map(db.map(r => [r.table_key, r.data_json]));

const wb = XLSX.read(readFileSync(archivo), { type: 'buffer' });
const { layout, tablas, errores } = extraerTablasBxplus(wb);
console.log('layout:', JSON.stringify(layout));
if (errores?.length) console.log('errores:', errores);

let iguales = 0, distintos = 0, faltantes = 0;
for (const t of tablas) {
  if (!dbPorClave.has(t.table_key)) { faltantes++; console.log('  (no está en la base)', t.table_key); continue; }
  const a = JSON.stringify(t.data_json);
  const b = JSON.stringify(dbPorClave.get(t.table_key));
  if (a === b) { iguales++; continue; }
  distintos++;
  const arrA = Array.isArray(t.data_json) ? t.data_json : null;
  const arrB = Array.isArray(dbPorClave.get(t.table_key)) ? dbPorClave.get(t.table_key) : null;
  console.log(`  DISTINTO ${t.table_key}: filas ${arrA?.length ?? 'valor'} vs ${arrB?.length ?? 'valor'}`);
  if (arrA && arrB) {
    for (let i = 0; i < Math.max(arrA.length, arrB.length); i++) {
      const x = JSON.stringify(arrA[i]), y = JSON.stringify(arrB[i]);
      if (x !== y) { console.log(`    fila ${i}: excel=${x} base=${y}`); break; }
    }
  } else {
    console.log(`    excel=${JSON.stringify(t.data_json)} base=${JSON.stringify(dbPorClave.get(t.table_key))}`);
  }
}
console.log(`\nresumen: ${iguales} iguales, ${distintos} distintos, ${faltantes} fuera de la base`);
