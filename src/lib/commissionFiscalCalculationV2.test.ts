/**
 * PRUEBAS DE VALIDACIÓN PARA CÁLCULOS FISCALES V2
 *
 * Este archivo contiene las pruebas con los valores exactos de los documentos
 * de referencia para validar que las fórmulas son correctas.
 */

import {
  calcularDesgloseFiscalV2,
  validarResultadoFiscal,
  formatCurrency,
  type FiscalCalculationInput
} from './commissionFiscalCalculationV2';

// ============================================================================
// CASO 1: ASIMILADOS
// ============================================================================
console.log('\n========================================');
console.log('CASO 1: ASIMILADOS');
console.log('========================================\n');

const inputAsimilados: FiscalCalculationInput = {
  regimenFiscal: 'ASIMILADOS',
  comisionGravada: 82.11,
  comisionExenta: 544.20
};

const resultadoAsimilados = calcularDesgloseFiscalV2(inputAsimilados);

console.log('Input:');
console.log(`  Comisión Gravada (NO VIDA): ${formatCurrency(inputAsimilados.comisionGravada)}`);
console.log(`  Comisión Exenta (VIDA): ${formatCurrency(inputAsimilados.comisionExenta)}`);
console.log(`  Comisión Total: ${formatCurrency(inputAsimilados.comisionGravada + inputAsimilados.comisionExenta)}`);

console.log('\nResultado:');
console.log(`  Ret. Contable: ${formatCurrency(resultadoAsimilados.retContable)}`);
console.log(`  Costo Dispersión: ${formatCurrency(resultadoAsimilados.costoDispersion)}`);
console.log(`  IVA: ${formatCurrency(resultadoAsimilados.iva)}`);
console.log(`  Ret. ISR: ${formatCurrency(resultadoAsimilados.retIsr)}`);
console.log(`  Ret. IVA: ${formatCurrency(resultadoAsimilados.retIva)}`);
console.log(`  TOTAL: ${formatCurrency(resultadoAsimilados.total)}`);

const totalEsperadoAsimilados = 477.40;
const validacionAsimilados = validarResultadoFiscal(resultadoAsimilados, totalEsperadoAsimilados, 0.02);

console.log('\nValidación:');
console.log(`  Total Esperado: ${formatCurrency(totalEsperadoAsimilados)}`);
console.log(`  Total Calculado: ${formatCurrency(resultadoAsimilados.total)}`);
console.log(`  Diferencia: ${formatCurrency(validacionAsimilados.diferencia)}`);
console.log(`  ✅ VÁLIDO: ${validacionAsimilados.valido ? 'SÍ' : 'NO'}`);

// Validación detallada
const expectedAsimilados = {
  retContable: 87.07,
  costoDispersion: 7.39,
  retIsr: 54.45,
  total: 477.40
};

console.log('\nComparación Detallada:');
console.log(`  Ret. Contable: Esperado ${formatCurrency(expectedAsimilados.retContable)}, Calculado ${formatCurrency(resultadoAsimilados.retContable)}`);
console.log(`  Costo Dispersión: Esperado ${formatCurrency(expectedAsimilados.costoDispersion)}, Calculado ${formatCurrency(resultadoAsimilados.costoDispersion)}`);
console.log(`  Ret. ISR: Esperado ${formatCurrency(expectedAsimilados.retIsr)}, Calculado ${formatCurrency(resultadoAsimilados.retIsr)}`);

// ============================================================================
// CASO 2: HONORARIOS
// ============================================================================
console.log('\n========================================');
console.log('CASO 2: HONORARIOS');
console.log('========================================\n');

const inputHonorarios: FiscalCalculationInput = {
  regimenFiscal: 'HONORARIOS',
  comisionGravada: 814.95,
  comisionExenta: 1119.05
};

const resultadoHonorarios = calcularDesgloseFiscalV2(inputHonorarios);

console.log('Input:');
console.log(`  Comisión Gravada (NO VIDA): ${formatCurrency(inputHonorarios.comisionGravada)}`);
console.log(`  Comisión Exenta (VIDA): ${formatCurrency(inputHonorarios.comisionExenta)}`);
console.log(`  Comisión Total: ${formatCurrency(inputHonorarios.comisionGravada + inputHonorarios.comisionExenta)}`);

console.log('\nResultado:');
console.log(`  Ret. Contable: ${formatCurrency(resultadoHonorarios.retContable)}`);
console.log(`  Costo Dispersión: ${formatCurrency(resultadoHonorarios.costoDispersion)}`);
console.log(`  IVA: ${formatCurrency(resultadoHonorarios.iva)}`);
console.log(`  Ret. ISR: ${formatCurrency(resultadoHonorarios.retIsr)}`);
console.log(`  Ret. IVA: ${formatCurrency(resultadoHonorarios.retIva)}`);
console.log(`  TOTAL: ${formatCurrency(resultadoHonorarios.total)}`);

const totalEsperadoHonorarios = 1784.06;
const validacionHonorarios = validarResultadoFiscal(resultadoHonorarios, totalEsperadoHonorarios, 0.02);

console.log('\nValidación:');
console.log(`  Total Esperado: ${formatCurrency(totalEsperadoHonorarios)}`);
console.log(`  Total Calculado: ${formatCurrency(resultadoHonorarios.total)}`);
console.log(`  Diferencia: ${formatCurrency(validacionHonorarios.diferencia)}`);
console.log(`  ✅ VÁLIDO: ${validacionHonorarios.valido ? 'SÍ' : 'NO'}`);

// Validación detallada
const expectedHonorarios = {
  iva: 130.39,
  retIsr: 193.40,
  retIva: 86.93,
  total: 1784.06
};

console.log('\nComparación Detallada:');
console.log(`  IVA: Esperado ${formatCurrency(expectedHonorarios.iva)}, Calculado ${formatCurrency(resultadoHonorarios.iva)}`);
console.log(`  Ret. ISR: Esperado ${formatCurrency(expectedHonorarios.retIsr)}, Calculado ${formatCurrency(resultadoHonorarios.retIsr)}`);
console.log(`  Ret. IVA: Esperado ${formatCurrency(expectedHonorarios.retIva)}, Calculado ${formatCurrency(resultadoHonorarios.retIva)}`);

// ============================================================================
// CASO 3: RESICO
// ============================================================================
console.log('\n========================================');
console.log('CASO 3: RESICO');
console.log('========================================\n');

const inputResico: FiscalCalculationInput = {
  regimenFiscal: 'RESICO',
  comisionGravada: 17616.83,
  comisionExenta: 4931.88
};

const resultadoResico = calcularDesgloseFiscalV2(inputResico);

console.log('Input:');
console.log(`  Comisión Gravada (NO VIDA): ${formatCurrency(inputResico.comisionGravada)}`);
console.log(`  Comisión Exenta (VIDA): ${formatCurrency(inputResico.comisionExenta)}`);
console.log(`  Comisión Total: ${formatCurrency(inputResico.comisionGravada + inputResico.comisionExenta)}`);

console.log('\nResultado:');
console.log(`  Ret. Contable: ${formatCurrency(resultadoResico.retContable)}`);
console.log(`  Costo Dispersión: ${formatCurrency(resultadoResico.costoDispersion)}`);
console.log(`  IVA: ${formatCurrency(resultadoResico.iva)}`);
console.log(`  Ret. ISR: ${formatCurrency(resultadoResico.retIsr)}`);
console.log(`  Ret. IVA: ${formatCurrency(resultadoResico.retIva)}`);
console.log(`  TOTAL: ${formatCurrency(resultadoResico.total)}`);

const totalEsperadoResico = 23206.41;
const validacionResico = validarResultadoFiscal(resultadoResico, totalEsperadoResico, 0.02);

console.log('\nValidación:');
console.log(`  Total Esperado: ${formatCurrency(totalEsperadoResico)}`);
console.log(`  Total Calculado: ${formatCurrency(resultadoResico.total)}`);
console.log(`  Diferencia: ${formatCurrency(validacionResico.diferencia)}`);
console.log(`  ✅ VÁLIDO: ${validacionResico.valido ? 'SÍ' : 'NO'}`);

// Validación detallada
const expectedResico = {
  iva: 2818.69,
  retIsr: 281.86,
  retIva: 1879.13,
  total: 23206.41
};

console.log('\nComparación Detallada:');
console.log(`  IVA: Esperado ${formatCurrency(expectedResico.iva)}, Calculado ${formatCurrency(resultadoResico.iva)}`);
console.log(`  Ret. ISR: Esperado ${formatCurrency(expectedResico.retIsr)}, Calculado ${formatCurrency(resultadoResico.retIsr)}`);
console.log(`  Ret. IVA: Esperado ${formatCurrency(expectedResico.retIva)}, Calculado ${formatCurrency(resultadoResico.retIva)}`);

// ============================================================================
// RESUMEN FINAL
// ============================================================================
console.log('\n========================================');
console.log('RESUMEN DE VALIDACIÓN');
console.log('========================================\n');

const todosValidos = validacionAsimilados.valido && validacionHonorarios.valido && validacionResico.valido;

console.log(`✅ ASIMILADOS: ${validacionAsimilados.valido ? 'VÁLIDO' : 'INVÁLIDO'}`);
console.log(`✅ HONORARIOS: ${validacionHonorarios.valido ? 'VÁLIDO' : 'INVÁLIDO'}`);
console.log(`✅ RESICO: ${validacionResico.valido ? 'VÁLIDO' : 'INVÁLIDO'}`);

console.log(`\n${todosValidos ? '🎉 TODOS LOS CASOS SON VÁLIDOS' : '❌ HAY CASOS INVÁLIDOS'}\n`);

// Exportar para uso en otros archivos si es necesario
export const testResults = {
  asimilados: {
    input: inputAsimilados,
    resultado: resultadoAsimilados,
    validacion: validacionAsimilados
  },
  honorarios: {
    input: inputHonorarios,
    resultado: resultadoHonorarios,
    validacion: validacionHonorarios
  },
  resico: {
    input: inputResico,
    resultado: resultadoResico,
    validacion: validacionResico
  }
};
