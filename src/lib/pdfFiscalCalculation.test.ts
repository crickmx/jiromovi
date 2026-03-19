/**
 * PRUEBAS DE VALIDACIÓN PARA CÁLCULO FISCAL DE PDFs
 *
 * Este archivo contiene pruebas unitarias que validan que los cálculos fiscales
 * sean correctos y deterministas para cada régimen fiscal.
 */

import { calcularPdfFiscalComisiones } from './pdfFiscalCalculation';

// Helper para redondear a 2 decimales
const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

// Helper para comparar números con tolerancia
const aproximado = (actual: number, esperado: number, tolerancia: number = 0.01): boolean => {
  return Math.abs(actual - esperado) <= tolerancia;
};

console.log('============================================');
console.log('PRUEBAS DE CÁLCULO FISCAL DE PDFs');
console.log('============================================\n');

// ============================================================================
// PRUEBA A: ASIMILADOS
// ============================================================================
console.log('PRUEBA A: ASIMILADOS');
console.log('Comisión Bruta = 18,593.90');
console.log('Ret. ISR (ejemplo) = 1,317.43\n');

const pruebaA = calcularPdfFiscalComisiones({
  regimenFiscal: 'ASIMILADOS',
  comisionBruta: 18593.90,
  retIsrAsimilados: 1317.43,
});

console.log('Resultado:');
console.log(`  Base Interna: ${pruebaA.baseInterna}`);
console.log(`  Ret. ISR: ${pruebaA.calculos.retIsr}`);
console.log(`  Total: ${pruebaA.calculos.total}`);
console.log(`  Campos visibles: ${pruebaA.visibleFields.length}`);
pruebaA.visibleFields.forEach(field => {
  console.log(`    - ${field.label}: ${field.displayValue}`);
});

// Validaciones
const totalEsperadoA = round2(18593.90 - 1317.43);
const pasaA = aproximado(pruebaA.calculos.total, totalEsperadoA);
console.log(`\n✓ Total esperado: ${totalEsperadoA}`);
console.log(`✓ Total calculado: ${pruebaA.calculos.total}`);
console.log(`${pasaA ? '✅ PRUEBA A PASÓ' : '❌ PRUEBA A FALLÓ'}\n`);

// ============================================================================
// PRUEBA B: HONORARIOS
// ============================================================================
console.log('============================================');
console.log('PRUEBA B: HONORARIOS');
console.log('Comisión Bruta = 15,024.05\n');

const pruebaB = calcularPdfFiscalComisiones({
  regimenFiscal: 'HONORARIOS',
  comisionBruta: 15024.05,
});

console.log('Resultado:');
console.log(`  Base Interna: ${pruebaB.baseInterna}`);
console.log(`  IVA: ${pruebaB.calculos.iva}`);
console.log(`  Ret. ISR: ${pruebaB.calculos.retIsr}`);
console.log(`  Ret. IVA: ${pruebaB.calculos.retIva}`);
console.log(`  Total: ${pruebaB.calculos.total}`);
console.log(`  Campos visibles: ${pruebaB.visibleFields.length}`);
pruebaB.visibleFields.forEach(field => {
  console.log(`    - ${field.label}: ${field.displayValue}`);
});

// Validaciones
const ivaEsperadoB = round2(15024.05 * 0.16); // 2,403.85
const retIsrEsperadoB = round2(15024.05 * 0.10); // 1,502.40 (ajustado por redondeo)
const retIvaEsperadoB = round2(ivaEsperadoB * (2 / 3)); // 1,602.57
const totalEsperadoB = round2(15024.05 + ivaEsperadoB - retIsrEsperadoB - retIvaEsperadoB);

console.log(`\n✓ IVA esperado: ${ivaEsperadoB}`);
console.log(`✓ IVA calculado: ${pruebaB.calculos.iva}`);
console.log(`✓ Ret. ISR esperado: ${retIsrEsperadoB}`);
console.log(`✓ Ret. ISR calculado: ${pruebaB.calculos.retIsr}`);
console.log(`✓ Ret. IVA esperado: ${retIvaEsperadoB}`);
console.log(`✓ Ret. IVA calculado: ${pruebaB.calculos.retIva}`);
console.log(`✓ Total esperado: ${totalEsperadoB}`);
console.log(`✓ Total calculado: ${pruebaB.calculos.total}`);

const pasaB =
  aproximado(pruebaB.calculos.iva, ivaEsperadoB) &&
  aproximado(pruebaB.calculos.retIsr, retIsrEsperadoB) &&
  aproximado(pruebaB.calculos.retIva, retIvaEsperadoB) &&
  aproximado(pruebaB.calculos.total, totalEsperadoB);

console.log(`${pasaB ? '✅ PRUEBA B PASÓ' : '❌ PRUEBA B FALLÓ'}\n`);

// ============================================================================
// PRUEBA C: RESICO
// ============================================================================
console.log('============================================');
console.log('PRUEBA C: RESICO');
console.log('Comisión Bruta = 7,846.03\n');

const pruebaC = calcularPdfFiscalComisiones({
  regimenFiscal: 'RESICO',
  comisionBruta: 7846.03,
});

console.log('Resultado:');
console.log(`  Base Interna: ${pruebaC.baseInterna}`);
console.log(`  IVA: ${pruebaC.calculos.iva}`);
console.log(`  Ret. ISR: ${pruebaC.calculos.retIsr}`);
console.log(`  Ret. IVA: ${pruebaC.calculos.retIva}`);
console.log(`  Total: ${pruebaC.calculos.total}`);
console.log(`  Campos visibles: ${pruebaC.visibleFields.length}`);
pruebaC.visibleFields.forEach(field => {
  console.log(`    - ${field.label}: ${field.displayValue}`);
});

// Validaciones
const ivaEsperadoC = round2(7846.03 * 0.16); // 1,255.36
const retIsrEsperadoC = round2(7846.03 * 0.0125); // 98.08
const retIvaEsperadoC = round2(ivaEsperadoC * (2 / 3)); // 836.91
const totalEsperadoC = round2(7846.03 + ivaEsperadoC - retIsrEsperadoC - retIvaEsperadoC);

console.log(`\n✓ IVA esperado: ${ivaEsperadoC}`);
console.log(`✓ IVA calculado: ${pruebaC.calculos.iva}`);
console.log(`✓ Ret. ISR esperado: ${retIsrEsperadoC}`);
console.log(`✓ Ret. ISR calculado: ${pruebaC.calculos.retIsr}`);
console.log(`✓ Ret. IVA esperado: ${retIvaEsperadoC}`);
console.log(`✓ Ret. IVA calculado: ${pruebaC.calculos.retIva}`);
console.log(`✓ Total esperado: ${totalEsperadoC}`);
console.log(`✓ Total calculado: ${pruebaC.calculos.total}`);

const pasaC =
  aproximado(pruebaC.calculos.iva, ivaEsperadoC) &&
  aproximado(pruebaC.calculos.retIsr, retIsrEsperadoC) &&
  aproximado(pruebaC.calculos.retIva, retIvaEsperadoC) &&
  aproximado(pruebaC.calculos.total, totalEsperadoC);

console.log(`${pasaC ? '✅ PRUEBA C PASÓ' : '❌ PRUEBA C FALLÓ'}\n`);

// ============================================================================
// RESUMEN
// ============================================================================
console.log('============================================');
console.log('RESUMEN DE PRUEBAS');
console.log('============================================');
console.log(`Prueba A (ASIMILADOS): ${pasaA ? '✅ PASÓ' : '❌ FALLÓ'}`);
console.log(`Prueba B (HONORARIOS): ${pasaB ? '✅ PASÓ' : '❌ FALLÓ'}`);
console.log(`Prueba C (RESICO): ${pasaC ? '✅ PASÓ' : '❌ FALLÓ'}`);

const todasPasaron = pasaA && pasaB && pasaC;
console.log(`\n${todasPasaron ? '✅ TODAS LAS PRUEBAS PASARON' : '❌ HAY PRUEBAS FALLIDAS'}\n`);

// ============================================================================
// VALIDACIÓN DE NO REUTILIZACIÓN DE VALORES
// ============================================================================
console.log('============================================');
console.log('VALIDACIÓN DE AISLAMIENTO');
console.log('============================================');
console.log('Verificando que cada cálculo es independiente...\n');

const test1 = calcularPdfFiscalComisiones({
  regimenFiscal: 'HONORARIOS',
  comisionBruta: 1000,
});

const test2 = calcularPdfFiscalComisiones({
  regimenFiscal: 'HONORARIOS',
  comisionBruta: 2000,
});

const iva1 = test1.calculos.iva;
const iva2 = test2.calculos.iva;

console.log(`IVA con base 1000: ${iva1}`);
console.log(`IVA con base 2000: ${iva2}`);
console.log(`Relación: ${iva2 / iva1} (debe ser ~2.0)`);

const aislado = aproximado(iva2 / iva1, 2.0, 0.01);
console.log(`${aislado ? '✅ LOS CÁLCULOS SON INDEPENDIENTES' : '❌ HAY REUTILIZACIÓN DE VALORES'}\n`);

console.log('============================================');
console.log('FIN DE PRUEBAS');
console.log('============================================\n');
