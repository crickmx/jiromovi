// Compara el bloque de pagos del motor BX+ contra los números que calcula el Excel
// recalculado (hoja Cotizacion, O64..O75) para cada forma de pago.
//
//   node tools/verificar-pagos-bx.mjs <paquete.json> <carpeta_recalc>
//
// La carpeta debe traer pagos_ANUAL.json, pagos_SEMESTRAL.json, ... con las celdas
// D66/O64..O75 que produce recalc_pagos.py al recalcular la plantilla con LibreOffice.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { calculateBxplus } from '../src/lib/multicotizadorGmm/bxplusEngine.ts';

const [rutaDb, carpeta] = process.argv.slice(2);
if (!rutaDb || !carpeta) {
  console.log('uso: node tools/verificar-pagos-bx.mjs <paquete.json> <carpeta_recalc>');
  process.exit(1);
}
const leer = f => JSON.parse(readFileSync(join(carpeta, f), 'utf8'));

const tablas = JSON.parse(readFileSync(rutaDb, 'utf8'));

// El Excel recalculado sólo se compara en las formas que el motor ya soporta; BIMESTRAL
// se compara aparte cuando el motor la implemente (ver pagos_BIMESTRAL.json).
const casos = [
  ['ANUAL', 'Anual'],
  ['SEMESTRAL', 'Semestral'],
  ['TRIMESTRAL', 'Trimestral'],
  ['BIMESTRAL', 'Bimestral'],
  ['MENSUAL*', 'Mensual'],
].map(([archivo, forma]) => ({ forma, excel: leer(`pagos_${archivo}.json`) }));

const input = {
  estado: 'JALISCO 1(GUADALAJARA Y ALEDAÑOS)',
  nivel_hospitalario: 'PLUS',
  tabulador: 'ORO-110,000',
  suma_asegurada: '50000000',
  deducible: '17000',
  coaseguro: '0.1',
  coverages: {
    medicamentos_fuera: true, eliminacion_deducible_accidente: true,
    multiregion: true, vip: true, emergencia_medica_extranjero: true,
  },
};

const persona = { id: 'p1', name: 'Prueba', relation: 'Titular', age: 30, gender: 'Masculino' };
let fallos = 0;
const cerca = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

for (const { forma, excel } of casos) {
  const res = calculateBxplus({ ...input, forma_pago: forma }, [persona], tablas, 'pkg');
  if (res.error) { console.log(`ERROR ${forma}: ${res.error}`); fallos++; continue; }
  const t = res.totals[forma];
  const filas = [];
  const chequeo = (etiqueta, motor, ex) => {
    const ok = typeof motor === 'number' && typeof ex === 'number' && cerca(motor, ex);
    if (!ok) fallos++;
    filas.push(`${ok ? 'OK ' : 'DIF'} ${etiqueta}: motor ${motor} vs excel ${ex}`);
  };
  chequeo('prima neta', t.prima_neta, excel.O64);
  chequeo('recargo', t.recargo, excel.O66);
  chequeo('derecho de póliza', t.gastos_expedicion, excel.O67);
  chequeo('subtotal', t.subtotal, excel.O68);
  chequeo('iva', t.iva, excel.O69);
  chequeo('total', t.total, excel.O70);
  chequeo('primer recibo', t.primer_pago, excel.O74);
  chequeo('recibos', t.num_recibos, excel.D66);
  console.log(`\n=== ${forma} (excel: ${excel.D66} recibos · motor: ${t.num_recibos})`);
  for (const f of filas) console.log('  ' + f);
}
console.log(`\n${fallos === 0 ? 'TODO OK' : fallos + ' diferencias'}`);
process.exit(fallos === 0 ? 0 : 1);
