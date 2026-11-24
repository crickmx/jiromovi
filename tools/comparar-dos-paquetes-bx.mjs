// Compara dos paquetes BX+ de la base (tabla por tabla) para ver qué cambió entre versiones.
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.log('uso: node comparar-dos-paquetes-bx.mjs paqueteA.json paqueteB.json'); process.exit(1); }
const A = JSON.parse(readFileSync(a, 'utf8'));
const B = JSON.parse(readFileSync(b, 'utf8'));
const mapB = new Map(B.map(r => [r.table_key, r.data_json]));
const mapA = new Map(A.map(r => [r.table_key, r.data_json]));

let iguales = 0, distintos = 0, faltan = 0;
for (const r of A) {
  const y = mapB.get(r.table_key);
  if (y === undefined) { faltan++; console.log('  falta en B:', r.table_key); continue; }
  const x = JSON.stringify(r.data_json);
  const z = JSON.stringify(y);
  if (x === z) { iguales++; continue; }
  distintos++;
  const arrA = Array.isArray(r.data_json) ? r.data_json : null;
  const arrB = Array.isArray(y) ? y : null;
  console.log(`  DISTINTO ${r.table_key} (${arrA?.length ?? 'valor'} vs ${arrB?.length ?? 'valor'})`);
  if (arrA && arrB) {
    let n = 0;
    for (let i = 0; i < Math.min(arrA.length, arrB.length) && n < 3; i++) {
      if (JSON.stringify(arrA[i]) !== JSON.stringify(arrB[i])) {
        console.log(`    fila ${i}: A=${JSON.stringify(arrA[i])} B=${JSON.stringify(arrB[i])}`); n++;
      }
    }
  } else {
    console.log(`    A=${x} B=${z}`);
  }
}
for (const r of B) if (!mapA.has(r.table_key)) console.log('  sólo en B:', r.table_key);
console.log(`\nresumen: ${iguales} iguales, ${distintos} distintos, ${faltan} faltantes`);
