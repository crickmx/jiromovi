/**
 * Pruebas de Validación para Desglose Fiscal en PDF
 *
 * Este archivo valida que el PDF de Cálculo Fiscal muestre
 * exactamente las 8 filas requeridas, en el orden correcto,
 * con los labels exactos del motor V3 (FISCAL_FORMULA_VERSION = "v2.0.0").
 *
 * Filas OBLIGATORIAS (exactamente en este orden):
 * 1. COMISION GRAVADA  (positive)
 * 2. COMISION EXENTA   (positive)
 * 3. RET CONTABLE      (negative)
 * 4. COSTO DISPERSION  (negative)
 * 5. IVA               (positive)
 * 6. RET ISR           (negative)
 * 7. RET IVA           (negative)
 * 8. TOTAL             (neutral)
 *
 * Palabras PROHIBIDAS en cualquier label del PDF:
 * - prima, base total, isr vida, isr daños, comision base
 * - porcentajes intermedios directos: 16% vida, 10% sin vida, etc.
 */

import {
  calcularDesgloseFiscalV3,
  FISCAL_FORMULA_VERSION,
  MONEY_TOLERANCE,
  type FiscalBreakdownInput,
  type FiscalBreakdownResult,
} from './commissionFiscalCalculationV3';

// Palabras clave PROHIBIDAS — no pueden aparecer en ningún label del PDF
const FORBIDDEN_KEYWORDS = [
  'base total',
  'prima',
  'isr vida',
  'isr daños',
  'isr total',
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

// Labels PERMITIDOS (los 8 del nuevo estándar V3 + metadatos del encabezado)
const ALLOWED_LABELS = [
  'comision gravada',
  'comision exenta',
  'ret contable',
  'costo dispersion',
  'iva',
  'ret isr',
  'ret iva',
  'total',
  'régimen fiscal',
  'concepto',
  'importe',
];

// Orden esperado de las 8 filas
const EXPECTED_ROW_ORDER = [
  'COMISION_GRAVADA',
  'COMISION_EXENTA',
  'RET_CONTABLE',
  'COSTO_DISPERSION',
  'IVA',
  'RET_ISR',
  'RET_IVA',
  'TOTAL',
] as const;

type ExpectedRowKey = typeof EXPECTED_ROW_ORDER[number];

/**
 * Valida que un label del PDF no contenga palabras prohibidas
 */
export function validatePdfLabel(label: string): { valid: boolean; error?: string } {
  const labelLower = label.toLowerCase();

  for (const forbidden of FORBIDDEN_KEYWORDS) {
    if (labelLower.includes(forbidden)) {
      return {
        valid: false,
        error: `Label "${label}" contiene palabra prohibida: "${forbidden}"`
      };
    }
  }

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
  tolerance: number = MONEY_TOLERANCE
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
 * Simula la generación de las 8 filas del PDF a partir de un FiscalBreakdownResult.
 * Refleja exactamente la estructura del motor V3 (FISCAL_FORMULA_VERSION = "v2.0.0").
 */
export function simulatePdfRowGeneration(
  resultado: FiscalBreakdownResult
): Array<{ key: ExpectedRowKey; label: string; value: string; sign: string }> {
  return resultado.pdfRows.map(row => ({
    key: row.key as ExpectedRowKey,
    label: row.label,
    value: row.formattedValue,
    sign: row.sign,
  }));
}

/**
 * Genera un FiscalBreakdownResult de prueba para un régimen dado
 */
function buildTestResult(
  regimenFiscal: FiscalBreakdownInput['regimenFiscal'],
  comisionGravada: number,
  comisionExenta: number
): FiscalBreakdownResult {
  return calcularDesgloseFiscalV3({
    regimenFiscal,
    comisionGravada,
    comisionExenta,
    context: { agentId: 'test-agent', batchId: 'test-batch' },
  });
}

/**
 * Test Suite: Validación de campos del PDF — motor V3
 */
export function runValidationTests(): {
  passed: number;
  failed: number;
  tests: Array<{ name: string; passed: boolean; error?: string }>;
} {
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  const asimiladosResult = buildTestResult('ASIMILADOS', 3000, 5000);
  const honorariosResult = buildTestResult('HONORARIOS', 814.95, 1119.05);
  const resicoResult    = buildTestResult('RESICO', 2862.84, 4983.19);

  // Test 1: Siempre se generan exactamente 8 filas
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['ASIMILADOS', asimiladosResult],
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rows = simulatePdfRowGeneration(res);
      if (rows.length !== 8) {
        testPassed = false;
        testError = `${name} generó ${rows.length} filas, se esperaban 8`;
        break;
      }
    }

    results.push({ name: 'Todos los regímenes generan exactamente 8 filas', passed: testPassed, error: testError });
  }

  // Test 2: Las 8 filas están en el orden correcto (por key)
  {
    const rows = simulatePdfRowGeneration(asimiladosResult);
    const keys = rows.map(r => r.key);
    let testPassed = true;
    let testError = '';

    for (let i = 0; i < EXPECTED_ROW_ORDER.length; i++) {
      if (keys[i] !== EXPECTED_ROW_ORDER[i]) {
        testPassed = false;
        testError = `Posición ${i}: se esperaba "${EXPECTED_ROW_ORDER[i]}", se obtuvo "${keys[i]}"`;
        break;
      }
    }

    results.push({ name: 'Orden correcto de las 8 filas (keys)', passed: testPassed, error: testError });
  }

  // Test 3: HONORARIOS — no contiene labels prohibidos
  {
    const rows = simulatePdfRowGeneration(honorariosResult);
    let testPassed = true;
    let testError = '';

    for (const row of rows) {
      const validation = validatePdfLabel(row.label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({ name: 'HONORARIOS - No contiene labels prohibidos', passed: testPassed, error: testError });
  }

  // Test 4: ASIMILADOS — no contiene labels prohibidos
  {
    const rows = simulatePdfRowGeneration(asimiladosResult);
    let testPassed = true;
    let testError = '';

    for (const row of rows) {
      const validation = validatePdfLabel(row.label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({ name: 'ASIMILADOS - No contiene labels prohibidos', passed: testPassed, error: testError });
  }

  // Test 5: RESICO — no contiene labels prohibidos
  {
    const rows = simulatePdfRowGeneration(resicoResult);
    let testPassed = true;
    let testError = '';

    for (const row of rows) {
      const validation = validatePdfLabel(row.label);
      if (!validation.valid) {
        testPassed = false;
        testError = validation.error || '';
        break;
      }
    }

    results.push({ name: 'RESICO - No contiene labels prohibidos', passed: testPassed, error: testError });
  }

  // Test 6: La fila TOTAL siempre tiene sign = "neutral"
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['ASIMILADOS', asimiladosResult],
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rows = simulatePdfRowGeneration(res);
      const totalRow = rows.find(r => r.key === 'TOTAL');
      if (!totalRow || totalRow.sign !== 'neutral') {
        testPassed = false;
        testError = `${name}: TOTAL sign es "${totalRow?.sign}", se esperaba "neutral"`;
        break;
      }
    }

    results.push({ name: 'Fila TOTAL siempre tiene sign = neutral', passed: testPassed, error: testError });
  }

  // Test 7: ASIMILADOS — IVA = 0, RET_IVA = 0
  {
    const rows = simulatePdfRowGeneration(asimiladosResult);
    const ivaRow = rows.find(r => r.key === 'IVA');
    const retIvaRow = rows.find(r => r.key === 'RET_IVA');
    const ivaValue = asimiladosResult.pdfRows.find(r => r.key === 'IVA')?.value ?? -1;
    const retIvaValue = asimiladosResult.pdfRows.find(r => r.key === 'RET_IVA')?.value ?? -1;

    const testPassed = ivaRow !== undefined && retIvaRow !== undefined && ivaValue === 0 && retIvaValue === 0;
    const testError = testPassed
      ? undefined
      : `IVA=${ivaValue}, RET_IVA=${retIvaValue} — ambos deben ser 0 en ASIMILADOS`;

    results.push({ name: 'ASIMILADOS: IVA y RET_IVA son 0', passed: testPassed, error: testError });
  }

  // Test 8: HONORARIOS/RESICO — RET_CONTABLE = 0, COSTO_DISPERSION = 0
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rcValue = res.pdfRows.find(r => r.key === 'RET_CONTABLE')?.value ?? -1;
      const cdValue = res.pdfRows.find(r => r.key === 'COSTO_DISPERSION')?.value ?? -1;
      if (rcValue !== 0 || cdValue !== 0) {
        testPassed = false;
        testError = `${name}: RET_CONTABLE=${rcValue}, COSTO_DISPERSION=${cdValue} — ambos deben ser 0`;
        break;
      }
    }

    results.push({ name: 'HONORARIOS/RESICO: RET_CONTABLE y COSTO_DISPERSION son 0', passed: testPassed, error: testError });
  }

  // Test 9: Consistencia del Total — HONORARIOS
  {
    const totalRow = honorariosResult.pdfRows.find(r => r.key === 'TOTAL');
    const pdfTotal = totalRow?.value ?? 0;
    const calcTotal = honorariosResult.calculos.total;

    const validation = validateTotalConsistency(pdfTotal, calcTotal);

    results.push({
      name: 'Total del PDF (HONORARIOS) coincide con cálculo interno',
      passed: validation.valid,
      error: validation.error,
    });
  }

  // Test 10: FISCAL_FORMULA_VERSION es "v2.0.0"
  {
    const testPassed = FISCAL_FORMULA_VERSION === 'v2.0.0';
    results.push({
      name: `FISCAL_FORMULA_VERSION es "v2.0.0"`,
      passed: testPassed,
      error: testPassed ? undefined : `Se obtuvo "${FISCAL_FORMULA_VERSION}"`,
    });
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, tests: results };
}

// Ejecutar pruebas si se ejecuta este archivo directamente
if (typeof window === 'undefined') {
  const testResults = runValidationTests();
  console.log('\n=== Resultados de Validación de PDF Fiscal (V3) ===\n');
  console.log(`Motor: FISCAL_FORMULA_VERSION = "${FISCAL_FORMULA_VERSION}"`);
  console.log(`MONEY_TOLERANCE = ${MONEY_TOLERANCE}\n`);
  console.log(`Tests ejecutados: ${testResults.tests.length}`);
  console.log(`Pasados: ${testResults.passed}`);
  console.log(`Fallados: ${testResults.failed}`);
  console.log('\nDetalle de tests:\n');

  testResults.tests.forEach((test, index) => {
    const status = test.passed ? 'PASS' : 'FAIL';
    console.log(`${index + 1}. [${status}] ${test.name}`);
    if (!test.passed && test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  if (testResults.failed > 0) {
    process.exit(1);
  }
}
