/**
 * Pruebas de Validación para Desglose Fiscal en PDF
 *
 * Valida que el PDF de Cálculo Fiscal genere correctamente:
 * - SECCION 3: DESGLOSE FISCAL — 6 filas via pdfFiscalRows
 * - SECCION 4: AJUSTES OPERATIVOS — 2 filas via pdfOperativoRows (solo ASIMILADOS)
 * - SECCION 5: TOTAL FINAL — totalFinal
 *
 * Motor: fiscal_v3_audit (FISCAL_FORMULA_VERSION)
 *
 * BLOQUE FISCAL (6 filas exactas en orden):
 *   1. COMISION_GRAVADA  (positive)
 *   2. COMISION_EXENTA   (positive)
 *   3. IVA               (positive)
 *   4. RET_ISR           (negative)
 *   5. RET_IVA           (negative)
 *   6. TOTAL_FISCAL      (neutral)
 *
 * BLOQUE OPERATIVO (2 filas, solo ASIMILADOS):
 *   1. RET_CONTABLE      (negative)
 *   2. COSTO_DISPERSION  (negative)
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

// Labels PERMITIDOS en BLOQUE FISCAL
const ALLOWED_FISCAL_LABELS = [
  'comision gravada',
  'comision exenta',
  'iva',
  'ret isr',
  'ret iva',
  'total fiscal',
  'régimen fiscal',
  'concepto',
  'importe',
];

// Labels PERMITIDOS en BLOQUE OPERATIVO
const ALLOWED_OPERATIVO_LABELS = [
  'ret contable',
  'costo dispersion',
];

// Orden esperado de las 6 filas del BLOQUE FISCAL
const EXPECTED_FISCAL_ROW_ORDER = [
  'COMISION_GRAVADA',
  'COMISION_EXENTA',
  'IVA',
  'RET_ISR',
  'RET_IVA',
  'TOTAL_FISCAL',
] as const;

// Orden esperado de las 2 filas del BLOQUE OPERATIVO (ASIMILADOS)
const EXPECTED_OPERATIVO_ROW_ORDER = [
  'RET_CONTABLE',
  'COSTO_DISPERSION',
] as const;

type ExpectedFiscalRowKey = typeof EXPECTED_FISCAL_ROW_ORDER[number];
type ExpectedOperativoRowKey = typeof EXPECTED_OPERATIVO_ROW_ORDER[number];

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

  const isAllowedFiscal = ALLOWED_FISCAL_LABELS.some(allowed => labelLower.includes(allowed));
  const isAllowedOperativo = ALLOWED_OPERATIVO_LABELS.some(allowed => labelLower.includes(allowed));

  if (!isAllowedFiscal && !isAllowedOperativo && !labelLower.includes('$') && !labelLower.includes('-') && !labelLower.includes('+')) {
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
 * Simula las 6 filas del BLOQUE FISCAL del PDF desde un FiscalBreakdownResult.
 */
export function simulateFiscalRowGeneration(
  resultado: FiscalBreakdownResult
): Array<{ key: ExpectedFiscalRowKey; label: string; value: string; sign: string }> {
  return resultado.pdfFiscalRows.map(row => ({
    key: row.key as ExpectedFiscalRowKey,
    label: row.label,
    value: row.formattedValue,
    sign: row.sign,
  }));
}

/**
 * Simula las filas del BLOQUE OPERATIVO del PDF desde un FiscalBreakdownResult.
 * Solo ASIMILADOS tendrá filas; HONORARIOS y RESICO retornan array vacío.
 */
export function simulateOperativoRowGeneration(
  resultado: FiscalBreakdownResult
): Array<{ key: ExpectedOperativoRowKey; label: string; value: string; sign: string }> {
  return resultado.pdfOperativoRows.map(row => ({
    key: row.key as ExpectedOperativoRowKey,
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
  comisionExenta: number,
  asimiladosIsrRate?: number,
  resicoIsrRate?: number
): FiscalBreakdownResult {
  return calcularDesgloseFiscalV3({
    regimenFiscal,
    comisionGravada,
    comisionExenta,
    ...(regimenFiscal === 'ASIMILADOS' && { asimiladosIsrRate: asimiladosIsrRate ?? 0.10 }),
    ...(regimenFiscal === 'RESICO' && resicoIsrRate !== undefined && { resicoIsrRate }),
    context: { agentId: 'test-agent', batchId: 'test-batch' },
  });
}

/**
 * Test Suite: Validación de campos del PDF — motor fiscal_v3_audit
 */
export function runValidationTests(): {
  passed: number;
  failed: number;
  tests: Array<{ name: string; passed: boolean; error?: string }>;
} {
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  const asimiladosResult = buildTestResult('ASIMILADOS', 3000, 5000, 0.10);
  const honorariosResult = buildTestResult('HONORARIOS', 814.95, 1119.05);
  const resicoResult     = buildTestResult('RESICO', 2862.84, 4983.19, undefined, 0.0125);

  // Test 1: BLOQUE FISCAL siempre genera exactamente 6 filas
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['ASIMILADOS', asimiladosResult],
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rows = simulateFiscalRowGeneration(res);
      if (rows.length !== 6) {
        testPassed = false;
        testError = `${name} generó ${rows.length} filas fiscales, se esperaban 6`;
        break;
      }
    }

    results.push({ name: 'Todos los regímenes generan exactamente 6 filas en pdfFiscalRows', passed: testPassed, error: testError });
  }

  // Test 2: BLOQUE OPERATIVO — ASIMILADOS tiene 2 filas, HONORARIOS/RESICO tienen 0
  {
    let testPassed = true;
    let testError = '';

    const asimRows = simulateOperativoRowGeneration(asimiladosResult);
    if (asimRows.length !== 2) {
      testPassed = false;
      testError = `ASIMILADOS tiene ${asimRows.length} filas operativas, se esperaban 2`;
    }

    if (testPassed) {
      const honRows = simulateOperativoRowGeneration(honorariosResult);
      if (honRows.length !== 0) {
        testPassed = false;
        testError = `HONORARIOS tiene ${honRows.length} filas operativas, se esperaban 0`;
      }
    }

    if (testPassed) {
      const resRows = simulateOperativoRowGeneration(resicoResult);
      if (resRows.length !== 0) {
        testPassed = false;
        testError = `RESICO tiene ${resRows.length} filas operativas, se esperaban 0`;
      }
    }

    results.push({ name: 'ASIMILADOS tiene 2 filas operativas; HONORARIOS/RESICO tienen 0', passed: testPassed, error: testError });
  }

  // Test 3: Orden correcto de las 6 filas fiscales (por key)
  {
    const rows = simulateFiscalRowGeneration(asimiladosResult);
    const keys = rows.map(r => r.key);
    let testPassed = true;
    let testError = '';

    for (let i = 0; i < EXPECTED_FISCAL_ROW_ORDER.length; i++) {
      if (keys[i] !== EXPECTED_FISCAL_ROW_ORDER[i]) {
        testPassed = false;
        testError = `Posición ${i}: se esperaba "${EXPECTED_FISCAL_ROW_ORDER[i]}", se obtuvo "${keys[i]}"`;
        break;
      }
    }

    results.push({ name: 'Orden correcto de las 6 filas fiscales (keys)', passed: testPassed, error: testError });
  }

  // Test 4: Orden correcto de las 2 filas operativas (ASIMILADOS)
  {
    const rows = simulateOperativoRowGeneration(asimiladosResult);
    const keys = rows.map(r => r.key);
    let testPassed = true;
    let testError = '';

    for (let i = 0; i < EXPECTED_OPERATIVO_ROW_ORDER.length; i++) {
      if (keys[i] !== EXPECTED_OPERATIVO_ROW_ORDER[i]) {
        testPassed = false;
        testError = `Posición ${i}: se esperaba "${EXPECTED_OPERATIVO_ROW_ORDER[i]}", se obtuvo "${keys[i]}"`;
        break;
      }
    }

    results.push({ name: 'Orden correcto de las 2 filas operativas ASIMILADOS (keys)', passed: testPassed, error: testError });
  }

  // Test 5: HONORARIOS — no contiene labels prohibidos en bloque fiscal
  {
    const rows = simulateFiscalRowGeneration(honorariosResult);
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

    results.push({ name: 'HONORARIOS - No contiene labels prohibidos en bloque fiscal', passed: testPassed, error: testError });
  }

  // Test 6: ASIMILADOS — no contiene labels prohibidos en bloque fiscal
  {
    const rows = simulateFiscalRowGeneration(asimiladosResult);
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

    results.push({ name: 'ASIMILADOS - No contiene labels prohibidos en bloque fiscal', passed: testPassed, error: testError });
  }

  // Test 7: ASIMILADOS — no contiene labels prohibidos en bloque operativo
  {
    const rows = simulateOperativoRowGeneration(asimiladosResult);
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

    results.push({ name: 'ASIMILADOS - No contiene labels prohibidos en bloque operativo', passed: testPassed, error: testError });
  }

  // Test 8: RESICO — no contiene labels prohibidos en bloque fiscal
  {
    const rows = simulateFiscalRowGeneration(resicoResult);
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

    results.push({ name: 'RESICO - No contiene labels prohibidos en bloque fiscal', passed: testPassed, error: testError });
  }

  // Test 9: La fila TOTAL_FISCAL siempre tiene sign = "neutral"
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['ASIMILADOS', asimiladosResult],
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rows = simulateFiscalRowGeneration(res);
      const totalRow = rows.find(r => r.key === 'TOTAL_FISCAL');
      if (!totalRow || totalRow.sign !== 'neutral') {
        testPassed = false;
        testError = `${name}: TOTAL_FISCAL sign es "${totalRow?.sign}", se esperaba "neutral"`;
        break;
      }
    }

    results.push({ name: 'Fila TOTAL_FISCAL siempre tiene sign = neutral', passed: testPassed, error: testError });
  }

  // Test 10: Las filas de BLOQUE OPERATIVO siempre tienen sign = "negative"
  {
    const rows = simulateOperativoRowGeneration(asimiladosResult);
    let testPassed = true;
    let testError = '';

    for (const row of rows) {
      if (row.sign !== 'negative') {
        testPassed = false;
        testError = `${row.key}: sign es "${row.sign}", se esperaba "negative"`;
        break;
      }
    }

    results.push({ name: 'Filas BLOQUE OPERATIVO siempre tienen sign = negative', passed: testPassed, error: testError });
  }

  // Test 11: ASIMILADOS — IVA = 0, RET_IVA = 0 en bloque fiscal
  {
    const ivaValue = asimiladosResult.pdfFiscalRows.find(r => r.key === 'IVA')?.value ?? -1;
    const retIvaValue = asimiladosResult.pdfFiscalRows.find(r => r.key === 'RET_IVA')?.value ?? -1;

    const testPassed = ivaValue === 0 && retIvaValue === 0;
    const testError = testPassed
      ? undefined
      : `IVA=${ivaValue}, RET_IVA=${retIvaValue} — ambos deben ser 0 en ASIMILADOS`;

    results.push({ name: 'ASIMILADOS: IVA y RET_IVA son 0 en bloque fiscal', passed: testPassed, error: testError });
  }

  // Test 12: HONORARIOS/RESICO — pdfOperativoRows está vacío (RET_CONTABLE y COSTO_DISPERSION = 0)
  {
    const regs: Array<[string, FiscalBreakdownResult]> = [
      ['HONORARIOS', honorariosResult],
      ['RESICO', resicoResult],
    ];
    let testPassed = true;
    let testError = '';

    for (const [name, res] of regs) {
      const rcValue = res.operativo.retContable;
      const cdValue = res.operativo.costoDispersion;
      if (rcValue !== 0 || cdValue !== 0) {
        testPassed = false;
        testError = `${name}: retContable=${rcValue}, costoDispersion=${cdValue} — ambos deben ser 0`;
        break;
      }
      if (res.pdfOperativoRows.length !== 0) {
        testPassed = false;
        testError = `${name}: pdfOperativoRows tiene ${res.pdfOperativoRows.length} filas, se esperaban 0`;
        break;
      }
    }

    results.push({ name: 'HONORARIOS/RESICO: pdfOperativoRows vacío y operativo en cero', passed: testPassed, error: testError });
  }

  // Test 13: TOTAL FINAL — consistencia entre totalFinal y cálculo manual
  {
    // ASIMILADOS: totalFinal = totalFiscal - retContable - costoDispersion
    const tf = asimiladosResult.fiscal.totalFiscal;
    const rc = asimiladosResult.operativo.retContable;
    const cd = asimiladosResult.operativo.costoDispersion;
    const expectedFinal = Math.round((tf - rc - cd + Number.EPSILON) * 100) / 100;
    const actualFinal = asimiladosResult.totalFinal;
    const diff = Math.abs(expectedFinal - actualFinal);

    const testPassed = diff <= MONEY_TOLERANCE;
    const testError = testPassed
      ? undefined
      : `ASIMILADOS totalFinal=${actualFinal}, esperado=${expectedFinal}, diff=${diff}`;

    results.push({ name: 'ASIMILADOS: totalFinal es consistente (totalFiscal - retContable - costoDispersion)', passed: testPassed, error: testError });
  }

  // Test 14: Consistencia del Total Fiscal — HONORARIOS
  {
    const totalRow = honorariosResult.pdfFiscalRows.find(r => r.key === 'TOTAL_FISCAL');
    const pdfTotal = totalRow?.value ?? 0;
    const calcTotal = honorariosResult.fiscal.totalFiscal;

    const validation = validateTotalConsistency(pdfTotal, calcTotal);

    results.push({
      name: 'Total Fiscal del PDF (HONORARIOS) coincide con fiscal.totalFiscal',
      passed: validation.valid,
      error: validation.error,
    });
  }

  // Test 15: FISCAL_FORMULA_VERSION es "fiscal_v3_audit"
  {
    const testPassed = FISCAL_FORMULA_VERSION === 'fiscal_v3_audit';
    results.push({
      name: `FISCAL_FORMULA_VERSION es "fiscal_v3_audit"`,
      passed: testPassed,
      error: testPassed ? undefined : `Se obtuvo "${FISCAL_FORMULA_VERSION}"`,
    });
  }

  // Test 16: audit.baseCalculo contiene campos requeridos de trazabilidad
  {
    const bc = asimiladosResult.audit.baseCalculo;
    const testPassed = typeof bc === 'string' && bc.includes('comision_gravada') && bc.includes('comision_exenta');
    results.push({
      name: 'audit.baseCalculo contiene comision_gravada y comision_exenta',
      passed: testPassed,
      error: testPassed ? undefined : `baseCalculo="${bc}" no contiene los campos requeridos`,
    });
  }

  // Test 17: audit.formulasUsadas existe y no es vacío
  {
    const fu = asimiladosResult.audit.formulasUsadas;
    const testPassed = typeof fu === 'object' && fu !== null && Object.keys(fu).length > 0;
    results.push({
      name: 'audit.formulasUsadas existe y contiene entradas',
      passed: testPassed,
      error: testPassed ? undefined : 'audit.formulasUsadas está vacío o no es un objeto',
    });
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, tests: results };
}

// Ejecutar pruebas si se ejecuta este archivo directamente
if (typeof window === 'undefined') {
  const testResults = runValidationTests();
  console.log('\n=== Resultados de Validación de PDF Fiscal (fiscal_v3_audit) ===\n');
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
