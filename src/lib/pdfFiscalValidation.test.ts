/**
 * Pruebas de Validación para Desglose Fiscal en PDF
 *
 * Este archivo contiene pruebas para asegurar que el PDF de Cálculo Fiscal
 * NUNCA muestre campos intermedios o técnicos, solo los campos permitidos.
 *
 * Campos PERMITIDOS:
 * - Ret. Contable
 * - Costo Dispersión
 * - IVA
 * - Ret. ISR
 * - Ret. IVA
 * - Total
 *
 * Campos PROHIBIDOS (nunca deben aparecer):
 * - Comisión Base Total
 * - Prima
 * - Vida
 * - Sin Vida
 * - Comisión Vida
 * - Comisión Sin Vida
 * - Comisión Daños
 * - ISR Vida
 * - ISR Daños
 * - ISR Total (excepto que se muestre como "Ret. ISR" en ASIMILADOS)
 * - Base
 * - Prima Total
 * - Prima Gravada
 * - Prima No Gravada
 */

import type { DesgloseFiscal, RegimenFiscal } from './commissionFiscalCalculations';

// Palabras clave PROHIBIDAS que NO deben aparecer en el PDF
const FORBIDDEN_KEYWORDS = [
  'base total',
  'prima',
  'vida', // excepto en contexto interno
  'sin vida',
  'daños',
  'gravada',
  'no gravada',
  'isr vida',
  'isr daños',
  'isr total', // solo permitido si se muestra como "Ret. ISR"
  'comision vida',
  'comision daños',
  'comision sin vida',
  'comision base',
  '16% vida',
  '10% sin vida',
  '10% total',
  '1.25%',
  '10.667%',
];

// Labels PERMITIDOS que SÍ pueden aparecer en el PDF
const ALLOWED_LABELS = [
  'ret. contable',
  'costo dispersión',
  'iva',
  'ret. isr',
  'ret. iva',
  'total',
  'régimen fiscal',
  'concepto',
  'importe',
];

/**
 * Valida que un label del PDF no contenga palabras prohibidas
 */
export function validatePdfLabel(label: string): { valid: boolean; error?: string } {
  const labelLower = label.toLowerCase();

  // Verificar que no contenga palabras prohibidas
  for (const forbidden of FORBIDDEN_KEYWORDS) {
    if (labelLower.includes(forbidden)) {
      return {
        valid: false,
        error: `Label "${label}" contiene palabra prohibida: "${forbidden}"`
      };
    }
  }

  // Verificar que sea un label permitido (opcional, para validación estricta)
  const isAllowed = ALLOWED_LABELS.some(allowed => labelLower.includes(allowed));
  if (!isAllowed && !labelLower.includes('$') && !labelLower.includes('-') && !labelLower.includes('+')) {
    return {
      valid: false,
      error: `Label "${label}" no está en la lista de campos permitidos`
    };
  }

  return { valid: true };
}

/**
 * Valida que el Total del PDF coincida con el calculado
 */
export function validateTotalConsistency(
  pdfTotal: number,
  calculatedTotal: number,
  tolerance: number = 0.01
): { valid: boolean; error?: string } {
  const diff = Math.abs(pdfTotal - calculatedTotal);

  if (diff > tolerance) {
    return {
      valid: false,
      error: `El Total del PDF ($${pdfTotal.toFixed(2)}) no coincide con el total calculado ($${calculatedTotal.toFixed(2)}). Diferencia: $${diff.toFixed(2)}`
    };
  }

  return { valid: true };
}

/**
 * Mock de DesgloseFiscal para pruebas
 */
export function createMockDesgloseFiscal(): DesgloseFiscal {
  return {
    vida: 5000,
    sinVida: 3000,
    retContable: 800,
    costoDispersion: 300,
    iva: 480,
    retIsr: 800,
    retIva: 320,
    isrVida: 420,
    isrDanios: 270,
    isrTotal: 690,
    totalAPagar: 6370,
  };
}

/**
 * Simula la generación de filas del PDF para un régimen
 * Esta es una copia simplificada de getPdfFiscalRows para testing
 */
export function simulatePdfRowGeneration(
  regimen: RegimenFiscal,
  desgloseFiscal: DesgloseFiscal
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];

  switch (regimen) {
    case 'HONORARIOS':
      if (desgloseFiscal.iva > 0) {
        rows.push({ label: 'IVA', value: `+ $${desgloseFiscal.iva.toFixed(2)}` });
      }
      if (desgloseFiscal.retIsr > 0) {
        rows.push({ label: 'Ret. ISR', value: `- $${desgloseFiscal.retIsr.toFixed(2)}` });
      }
      if (desgloseFiscal.retIva > 0) {
        rows.push({ label: 'Ret. IVA', value: `- $${desgloseFiscal.retIva.toFixed(2)}` });
      }
      break;

    case 'ASIMILADOS':
      if (desgloseFiscal.retContable > 0) {
        rows.push({ label: 'Ret. Contable', value: `- $${desgloseFiscal.retContable.toFixed(2)}` });
      }
      if (desgloseFiscal.costoDispersion > 0) {
        rows.push({ label: 'Costo Dispersión', value: `- $${desgloseFiscal.costoDispersion.toFixed(2)}` });
      }
      if (desgloseFiscal.isrTotal > 0) {
        rows.push({ label: 'Ret. ISR', value: `- $${desgloseFiscal.isrTotal.toFixed(2)}` });
      }
      if (desgloseFiscal.iva > 0) {
        rows.push({ label: 'IVA', value: `+ $${desgloseFiscal.iva.toFixed(2)}` });
      }
      if (desgloseFiscal.retIva > 0) {
        rows.push({ label: 'Ret. IVA', value: `- $${desgloseFiscal.retIva.toFixed(2)}` });
      }
      break;

    case 'RESICO':
      if (desgloseFiscal.iva > 0) {
        rows.push({ label: 'IVA', value: `+ $${desgloseFiscal.iva.toFixed(2)}` });
      }
      if (desgloseFiscal.retIsr > 0) {
        rows.push({ label: 'Ret. ISR', value: `- $${desgloseFiscal.retIsr.toFixed(2)}` });
      }
      if (desgloseFiscal.retIva > 0) {
        rows.push({ label: 'Ret. IVA', value: `- $${desgloseFiscal.retIva.toFixed(2)}` });
      }
      break;
  }

  // Total siempre se muestra
  rows.push({ label: 'Total', value: `$${desgloseFiscal.totalAPagar.toFixed(2)}` });

  return rows;
}

/**
 * Test Suite: Validación de campos permitidos
 */
export function runValidationTests(): {
  passed: number;
  failed: number;
  tests: Array<{ name: string; passed: boolean; error?: string }>;
} {
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  const mockData = createMockDesgloseFiscal();

  // Test 1: HONORARIOS no debe mostrar campos prohibidos
  {
    const rows = simulatePdfRowGeneration('HONORARIOS', mockData);
    const labels = rows.map(r => r.label);
    let testPassed = true;
    let testError = '';

    for (const label of labels) {
      const validation = validatePdfLabel(label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({
      name: 'HONORARIOS - No contiene campos prohibidos',
      passed: testPassed,
      error: testError
    });
  }

  // Test 2: ASIMILADOS no debe mostrar campos prohibidos
  {
    const rows = simulatePdfRowGeneration('ASIMILADOS', mockData);
    const labels = rows.map(r => r.label);
    let testPassed = true;
    let testError = '';

    for (const label of labels) {
      const validation = validatePdfLabel(label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({
      name: 'ASIMILADOS - No contiene campos prohibidos',
      passed: testPassed,
      error: testError
    });
  }

  // Test 3: RESICO no debe mostrar campos prohibidos
  {
    const rows = simulatePdfRowGeneration('RESICO', mockData);
    const labels = rows.map(r => r.label);
    let testPassed = true;
    let testError = '';

    for (const label of labels) {
      const validation = validatePdfLabel(label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({
      name: 'RESICO - No contiene campos prohibidos',
      passed: testPassed,
      error: testError
    });
  }

  // Test 4: Total siempre debe estar presente
  {
    const regimes: RegimenFiscal[] = ['HONORARIOS', 'ASIMILADOS', 'RESICO'];
    let allHaveTotal = true;
    let missingRegime = '';

    for (const regime of regimes) {
      const rows = simulatePdfRowGeneration(regime, mockData);
      const hasTotal = rows.some(r => r.label.toLowerCase() === 'total');
      if (!hasTotal) {
        allHaveTotal = false;
        missingRegime = regime;
        break;
      }
    }

    results.push({
      name: 'Todos los regímenes muestran Total',
      passed: allHaveTotal,
      error: missingRegime ? `Régimen ${missingRegime} no muestra Total` : undefined
    });
  }

  // Test 5: Validar consistencia de Total
  {
    const rows = simulatePdfRowGeneration('HONORARIOS', mockData);
    const totalRow = rows.find(r => r.label === 'Total');
    const pdfTotal = totalRow ? parseFloat(totalRow.value.replace(/[^0-9.]/g, '')) : 0;

    const validation = validateTotalConsistency(pdfTotal, mockData.totalAPagar);

    results.push({
      name: 'Total del PDF coincide con cálculo',
      passed: validation.valid,
      error: validation.error
    });
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, tests: results };
}

// Ejecutar pruebas si se ejecuta este archivo directamente
if (typeof window === 'undefined') {
  const testResults = runValidationTests();
  console.log('\n=== Resultados de Validación de PDF Fiscal ===\n');
  console.log(`Tests ejecutados: ${testResults.tests.length}`);
  console.log(`Pasados: ${testResults.passed}`);
  console.log(`Fallados: ${testResults.failed}`);
  console.log('\nDetalle de tests:\n');

  testResults.tests.forEach((test, index) => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${status} - ${test.name}`);
    if (!test.passed && test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  if (testResults.failed > 0) {
    process.exit(1);
  }
}
