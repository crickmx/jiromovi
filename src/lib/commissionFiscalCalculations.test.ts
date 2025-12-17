/**
 * Tests para validar cálculos fiscales de HONORARIOS
 * Basado en formulas_imp (sección por ramos)
 */

import {
  calcularDesgloseFiscal,
  agruparComisionesPorRamo,
  type CalculoFiscalParams,
  type RamoResumen,
} from './commissionFiscalCalculations';

/**
 * Test Case 1: HONORARIOS - Solo Vida
 *
 * Prima Vida = 10,000
 * Prima Sin Vida = 0
 *
 * Esperado:
 * - Retención Contable = 10,000 × 0.16 = 1,600
 * - Costo Dispersión = 0
 * - ISR Vida = (10,000 / 1.16) × 0.10 = 862.07
 * - ISR Daños = 0
 * - ISR Total = 862.07
 * - Total Final = 10,000 - 1,600 - 0 - 862.07 = 7,537.93
 */
export function testHonorariosSoloVida() {
  const resumenPorRamo: RamoResumen[] = [
    { ramo: 'Vida', comisionNeta: 10000, primaTotal: 10000 }
  ];

  const params: CalculoFiscalParams = {
    regimenFiscal: 'HONORARIOS',
    resumenPorRamo,
    totalComisionNeta: 10000,
    usePrimaTotal: true,
  };

  const resultado = calcularDesgloseFiscal(params);

  const expected = {
    vida: 10000,
    sinVida: 0,
    retContable: 1600,
    costoDispersion: 0,
    isrVida: 862.07,
    isrDanios: 0,
    isrTotal: 862.07,
    totalAPagar: 7537.93,
  };

  console.log('Test 1: HONORARIOS Solo Vida');
  console.log('Resultado:', resultado);
  console.log('Esperado:', expected);
  console.log('✓ Retención Contable:', resultado.retContable === expected.retContable);
  console.log('✓ Costo Dispersión:', resultado.costoDispersion === expected.costoDispersion);
  console.log('✓ ISR Vida:', resultado.isrVida === expected.isrVida);
  console.log('✓ ISR Daños:', resultado.isrDanios === expected.isrDanios);
  console.log('✓ ISR Total:', resultado.isrTotal === expected.isrTotal);
  console.log('✓ Total Final:', resultado.totalAPagar === expected.totalAPagar);

  return resultado;
}

/**
 * Test Case 2: HONORARIOS - Solo Sin Vida (Daños)
 *
 * Prima Vida = 0
 * Prima Sin Vida = 10,000
 *
 * Esperado:
 * - Retención Contable = 0
 * - Costo Dispersión = 10,000 × 0.09 = 900
 * - ISR Vida = 0
 * - ISR Daños = (10,000 / 1.09) × 0.10 = 917.43
 * - ISR Total = 917.43
 * - Total Final = 10,000 - 0 - 900 - 917.43 = 8,182.57
 */
export function testHonorariosSoloSinVida() {
  const resumenPorRamo: RamoResumen[] = [
    { ramo: 'Daños', comisionNeta: 10000, primaTotal: 10000 }
  ];

  const params: CalculoFiscalParams = {
    regimenFiscal: 'HONORARIOS',
    resumenPorRamo,
    totalComisionNeta: 10000,
    usePrimaTotal: true,
  };

  const resultado = calcularDesgloseFiscal(params);

  const expected = {
    vida: 0,
    sinVida: 10000,
    retContable: 0,
    costoDispersion: 900,
    isrVida: 0,
    isrDanios: 917.43,
    isrTotal: 917.43,
    totalAPagar: 8182.57,
  };

  console.log('\nTest 2: HONORARIOS Solo Sin Vida');
  console.log('Resultado:', resultado);
  console.log('Esperado:', expected);
  console.log('✓ Retención Contable:', resultado.retContable === expected.retContable);
  console.log('✓ Costo Dispersión:', resultado.costoDispersion === expected.costoDispersion);
  console.log('✓ ISR Vida:', resultado.isrVida === expected.isrVida);
  console.log('✓ ISR Daños:', resultado.isrDanios === expected.isrDanios);
  console.log('✓ ISR Total:', resultado.isrTotal === expected.isrTotal);
  console.log('✓ Total Final:', resultado.totalAPagar === expected.totalAPagar);

  return resultado;
}

/**
 * Test Case 3: HONORARIOS - Mixto (Vida + Sin Vida)
 *
 * Prima Vida = 5,000
 * Prima Sin Vida = 7,000
 * Prima Total = 12,000
 *
 * Esperado:
 * - Retención Contable = 5,000 × 0.16 = 800
 * - Costo Dispersión = 7,000 × 0.09 = 630
 * - ISR Vida = (5,000 / 1.16) × 0.10 = 431.03
 * - ISR Daños = (7,000 / 1.09) × 0.10 = 642.20
 * - ISR Total = 431.03 + 642.20 = 1,073.23
 * - Total Final = 12,000 - 800 - 630 - 1,073.23 = 9,496.77
 */
export function testHonorariosMixto() {
  const resumenPorRamo: RamoResumen[] = [
    { ramo: 'Vida', comisionNeta: 5000, primaTotal: 5000 },
    { ramo: 'Daños', comisionNeta: 7000, primaTotal: 7000 }
  ];

  const params: CalculoFiscalParams = {
    regimenFiscal: 'HONORARIOS',
    resumenPorRamo,
    totalComisionNeta: 12000,
    usePrimaTotal: true,
  };

  const resultado = calcularDesgloseFiscal(params);

  const expected = {
    vida: 5000,
    sinVida: 7000,
    retContable: 800,
    costoDispersion: 630,
    isrVida: 431.03,
    isrDanios: 642.20,
    isrTotal: 1073.23,
    totalAPagar: 9496.77,
  };

  console.log('\nTest 3: HONORARIOS Mixto (Vida + Sin Vida)');
  console.log('Resultado:', resultado);
  console.log('Esperado:', expected);
  console.log('✓ Retención Contable:', resultado.retContable === expected.retContable);
  console.log('✓ Costo Dispersión:', resultado.costoDispersion === expected.costoDispersion);
  console.log('✓ ISR Vida:', resultado.isrVida === expected.isrVida);
  console.log('✓ ISR Daños:', resultado.isrDanios === expected.isrDanios);
  console.log('✓ ISR Total:', resultado.isrTotal === expected.isrTotal);
  console.log('✓ Total Final:', resultado.totalAPagar === expected.totalAPagar);

  return resultado;
}

/**
 * Test Case 4: Validar que ISR Vida NO resta la retención contable
 *
 * Este es el cambio clave según formulas_imp:
 * - ANTES: ISR Vida = (Vida - RetContable) × 0.10
 * - AHORA: ISR Vida = (Vida / 1.16) × 0.10
 */
export function testIsrVidaNoRestaRetencion() {
  const primaVida = 10000;
  const retContable = primaVida * 0.16; // 1600

  // Fórmula INCORRECTA (anterior)
  const isrVidaIncorrecto = (primaVida - retContable) * 0.10; // 840

  // Fórmula CORRECTA (nueva)
  const isrVidaCorrecto = (primaVida / 1.16) * 0.10; // 862.07

  console.log('\nTest 4: ISR Vida NO resta retención contable');
  console.log('Prima Vida:', primaVida);
  console.log('Retención Contable:', retContable);
  console.log('ISR Vida INCORRECTO (Vida - RetContable) × 0.10:', isrVidaIncorrecto);
  console.log('ISR Vida CORRECTO (Vida / 1.16) × 0.10:', isrVidaCorrecto);
  console.log('Diferencia:', Math.abs(isrVidaCorrecto - isrVidaIncorrecto).toFixed(2));

  return {
    isrVidaIncorrecto,
    isrVidaCorrecto,
    diferencia: Math.abs(isrVidaCorrecto - isrVidaIncorrecto),
  };
}

/**
 * Test Case 5: Validar costo de dispersión es 9% (no 10%)
 */
export function testCostoDispersion9Porciento() {
  const primaSinVida = 10000;

  // INCORRECTO: 10%
  const costoDispersionIncorrecto = primaSinVida * 0.10; // 1000

  // CORRECTO: 9%
  const costoDispersionCorrecto = primaSinVida * 0.09; // 900

  console.log('\nTest 5: Costo dispersión es 9% (no 10%)');
  console.log('Prima Sin Vida:', primaSinVida);
  console.log('Costo Dispersión INCORRECTO (10%):', costoDispersionIncorrecto);
  console.log('Costo Dispersión CORRECTO (9%):', costoDispersionCorrecto);
  console.log('Diferencia:', Math.abs(costoDispersionCorrecto - costoDispersionIncorrecto));

  return {
    costoDispersionIncorrecto,
    costoDispersionCorrecto,
    diferencia: Math.abs(costoDispersionCorrecto - costoDispersionIncorrecto),
  };
}

/**
 * Test Case 6: Validar agrupación por Prima Total para HONORARIOS
 */
export function testAgrupacionPorPrimaTotal() {
  const detalles = [
    { ramo: 'Vida', commission_neta: 1000, importe_base: 5000 },
    { ramo: 'Vida', commission_neta: 800, importe_base: 3000 },
    { ramo: 'Daños', commission_neta: 500, importe_base: 2000 },
  ];

  // Agrupar por commission_neta (INCORRECTO para HONORARIOS)
  const agrupacionIncorrecta = agruparComisionesPorRamo(detalles, false);

  // Agrupar por importe_base / Prima Total (CORRECTO para HONORARIOS)
  const agrupacionCorrecta = agruparComisionesPorRamo(detalles, true);

  console.log('\nTest 6: Agrupación por Prima Total');
  console.log('Detalles:', detalles);
  console.log('Agrupación INCORRECTA (por commission_neta):', agrupacionIncorrecta);
  console.log('Agrupación CORRECTA (por importe_base):', agrupacionCorrecta);

  return {
    agrupacionIncorrecta,
    agrupacionCorrecta,
  };
}

/**
 * Ejecutar todos los tests
 */
export function runAllHonorariosTests() {
  console.log('='.repeat(60));
  console.log('TESTS DE CÁLCULO FISCAL PARA HONORARIOS');
  console.log('Basado en formulas_imp (sección por ramos)');
  console.log('='.repeat(60));

  testHonorariosSoloVida();
  testHonorariosSoloSinVida();
  testHonorariosMixto();
  testIsrVidaNoRestaRetencion();
  testCostoDispersion9Porciento();
  testAgrupacionPorPrimaTotal();

  console.log('\n' + '='.repeat(60));
  console.log('TESTS COMPLETADOS');
  console.log('='.repeat(60));
}
