/**
 * SUITE DE TESTS UNITARIOS — MOTOR FISCAL BLINDADO fiscal_v3_audit
 *
 * Valida los calculos por regimen con los valores exactos esperados
 * segun las formulas oficiales:
 *
 *   HONORARIOS:
 *     iva     = gravada * 0.16
 *     retIsr  = gravada * 0.14           (base: GRAVADA, no total)
 *     retIva  = iva * 2/3
 *     total   = total_comisiones + iva - retIsr - retIva
 *
 *   RESICO:
 *     iva     = gravada * 0.16
 *     retIsr  = gravada * resicoIsrRate  (base: GRAVADA, no total)
 *     retIva  = iva * 2/3
 *     total   = total_comisiones + iva - retIsr - retIva
 *
 *   ASIMILADOS:
 *     [FISCAL]    retIsr      = gravada * asimiladosIsrRate
 *     [FISCAL]    totalFiscal = total_comisiones - retIsr
 *     [OPERATIVO] retContable     = exenta * 0.16
 *     [OPERATIVO] costoDispersion = gravada * 0.09
 *     totalFinal = totalFiscal - retContable - costoDispersion
 *
 * SEPARACION OBLIGATORIA:
 *   BLOQUE FISCAL    → iva, retIsr, retIva, totalFiscal
 *   BLOQUE OPERATIVO → retContable, costoDispersion (solo ASIMILADOS)
 *   TOTAL FINAL      → totalFiscal - retContable - costoDispersion
 *
 * @version fiscal_v3_audit
 */

import {
  calcularDesgloseFiscalV3,
  validarResultadoFiscal,
  formatearResultadoParaLog,
  buildFiscalAuditSnapshot,
  roundMoney,
  FiscalCalculationError,
  FISCAL_CONFIG,
  FISCAL_FORMULA_VERSION,
  MONEY_TOLERANCE,
  type FiscalBreakdownInput,
  type FiscalBreakdownResult,
} from "./commissionFiscalCalculationV3";

// ============================================================================
// UTILIDADES DE TEST
// ============================================================================

const TOLERANCE = MONEY_TOLERANCE;

function cerca(actual: number, esperado: number, tol: number = TOLERANCE): boolean {
  return Math.abs(actual - esperado) <= tol;
}

function assertCerca(
  campo: string,
  actual: number,
  esperado: number,
  tol: number = TOLERANCE
): void {
  if (!cerca(actual, esperado, tol)) {
    throw new Error(
      `[${campo}] esperado ${esperado.toFixed(4)}, calculado ${actual.toFixed(4)}, diferencia ${Math.abs(actual - esperado).toFixed(6)}`
    );
  }
}

function correrTest(nombre: string, fn: () => void): boolean {
  try {
    fn();
    console.log(`  PASO: ${nombre}`);
    return true;
  } catch (e) {
    console.error(`  FALLO: ${nombre}`);
    console.error(`    ${(e as Error).message}`);
    return false;
  }
}

// ============================================================================
// CASO 1: ASIMILADOS — gravada=82.11, exenta=544.20, isrRate=0.10
//
// BLOQUE FISCAL:
//   retIsr      = 82.11 * 0.10 = 8.21
//   totalFiscal = (82.11 + 544.20) - 8.21 = 618.10
//
// BLOQUE OPERATIVO:
//   retContable     = 544.20 * 0.16 = 87.07
//   costoDispersion = 82.11 * 0.09  = 7.39
//
// TOTAL FINAL = 618.10 - 87.07 - 7.39 = 523.64
// ============================================================================

function testCaso1(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "ASIMILADOS",
    comisionGravada: 82.11,
    comisionExenta: 544.20,
    asimiladosIsrRate: 0.10,
    context: { periodo: "test-caso1" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;
  const o = r.operativo;

  assertCerca("iva",              f.iva,             0.00);
  assertCerca("retIsr",           f.retIsr,          8.21);
  assertCerca("retIva",           f.retIva,          0.00);
  assertCerca("totalFiscal",      f.totalFiscal,     618.10);
  assertCerca("retContable",      o.retContable,     87.07);
  assertCerca("costoDispersion",  o.costoDispersion, 7.39);
  assertCerca("totalFinal",       r.totalFinal,      523.64);

  if (!r.audit.validationsPassed) throw new Error("validationsPassed debe ser true");
  if (r.audit.formulaVersion !== FISCAL_FORMULA_VERSION) throw new Error("version incorrecta");
  if (r.pdfFiscalRows.length !== 6) throw new Error("pdfFiscalRows debe tener 6 filas");
  if (r.pdfOperativoRows.length !== 2) throw new Error("pdfOperativoRows debe tener 2 filas en ASIMILADOS");
  if (r.pdfRows.length !== 8) throw new Error("pdfRows debe tener 8 filas (compatibilidad)");
}

// ============================================================================
// CASO 2: HONORARIOS — gravada=814.95, exenta=1119.05
//
//   iva     = 814.95 * 0.16 = 130.39
//   retIsr  = 814.95 * 0.14 = 114.09
//   retIva  = 130.39 * 2/3  = 86.93
//   total   = (814.95 + 1119.05) + 130.39 - 114.09 - 86.93 = 1863.37
// ============================================================================

function testCaso2(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "HONORARIOS",
    comisionGravada: 814.95,
    comisionExenta: 1119.05,
    context: { periodo: "test-caso2" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;

  assertCerca("iva",         f.iva,          130.39);
  assertCerca("retIsr",      f.retIsr,       114.09);
  assertCerca("retIva",      f.retIva,       86.93);
  assertCerca("totalFiscal", f.totalFiscal,  1863.37);
  assertCerca("totalFinal",  r.totalFinal,   1863.37);

  // Bloque operativo debe ser 0 en HONORARIOS
  if (r.operativo.retContable !== 0) throw new Error("retContable debe ser 0 en HONORARIOS");
  if (r.operativo.costoDispersion !== 0) throw new Error("costoDispersion debe ser 0 en HONORARIOS");
  if (r.pdfOperativoRows.length !== 0) throw new Error("pdfOperativoRows debe estar vacio en HONORARIOS");
  if (r.pdfFiscalRows.length !== 6) throw new Error("pdfFiscalRows debe tener 6 filas");
}

// ============================================================================
// CASO 3: RESICO — gravada=17616.83, exenta=4931.88, isrRate=0.0125
//
//   iva     = 17616.83 * 0.16 = 2818.69
//   retIsr  = 17616.83 * 0.0125 = 220.21
//   retIva  = 2818.69 * 2/3 = 1879.13
//   total   = (17616.83 + 4931.88) + 2818.69 - 220.21 - 1879.13 = 23268.06
// ============================================================================

function testCaso3(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "RESICO",
    comisionGravada: 17616.83,
    comisionExenta: 4931.88,
    resicoIsrRate: 0.0125,
    context: { periodo: "test-caso3" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;

  assertCerca("iva",         f.iva,         2818.69);
  assertCerca("retIsr",      f.retIsr,      220.21);
  assertCerca("retIva",      f.retIva,      1879.13);

  // TOTAL = 22548.71 + 2818.69 - 220.21 - 1879.13
  const comisionTotal = roundMoney(17616.83 + 4931.88);
  const totalEsperado = roundMoney(comisionTotal + 2818.69 - 220.21 - 1879.13);
  assertCerca("totalFiscal", f.totalFiscal, totalEsperado);
  assertCerca("totalFinal",  r.totalFinal,  totalEsperado);

  if (r.operativo.retContable !== 0) throw new Error("retContable debe ser 0 en RESICO");
  if (r.operativo.costoDispersion !== 0) throw new Error("costoDispersion debe ser 0 en RESICO");
  if (r.pdfOperativoRows.length !== 0) throw new Error("pdfOperativoRows debe estar vacio en RESICO");
}

// ============================================================================
// CASO 4: ASIMILADOS (produccion) — gravada=9039.75, exenta=9554.15, isrRate=0.10
//
// BLOQUE FISCAL:
//   retIsr      = 9039.75 * 0.10 = 903.98
//   totalFiscal = (9039.75 + 9554.15) - 903.98 = 17689.92
//
// BLOQUE OPERATIVO:
//   retContable     = 9554.15 * 0.16 = 1528.66
//   costoDispersion = 9039.75 * 0.09 = 813.58
//
// TOTAL FINAL = 17689.92 - 1528.66 - 813.58 = 15347.68
// ============================================================================

function testCaso4(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "ASIMILADOS",
    comisionGravada: 9039.75,
    comisionExenta: 9554.15,
    asimiladosIsrRate: 0.10,
    context: { periodo: "test-caso4" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;
  const o = r.operativo;

  assertCerca("iva",              f.iva,             0.00);
  assertCerca("retIsr",           f.retIsr,          903.98, 0.01);
  assertCerca("retIva",           f.retIva,          0.00);
  assertCerca("retContable",      o.retContable,     1528.66);
  assertCerca("costoDispersion",  o.costoDispersion, 813.58, 0.01);

  const comisionTotal = roundMoney(9039.75 + 9554.15);
  const totalFiscalEsperado = roundMoney(comisionTotal - f.retIsr);
  assertCerca("totalFiscal", f.totalFiscal, totalFiscalEsperado);

  const totalFinalEsperado = roundMoney(f.totalFiscal - o.retContable - o.costoDispersion);
  assertCerca("totalFinal", r.totalFinal, totalFinalEsperado);
}

// ============================================================================
// CASO 5: HONORARIOS (produccion) — gravada=10708.94, exenta=4315.11
//
//   iva     = 10708.94 * 0.16 = 1713.43
//   retIsr  = 10708.94 * 0.14 = 1499.25
//   retIva  = 1713.43 * 2/3   = 1142.29
//   total   = (10708.94 + 4315.11) + 1713.43 - 1499.25 - 1142.29 = 14095.94
// ============================================================================

function testCaso5(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "HONORARIOS",
    comisionGravada: 10708.94,
    comisionExenta: 4315.11,
    context: { periodo: "test-caso5" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;

  assertCerca("iva",    f.iva,    1713.43);
  assertCerca("retIsr", f.retIsr, 1499.25, 0.01);
  assertCerca("retIva", f.retIva, 1142.29, 0.01);

  const comisionTotal = roundMoney(10708.94 + 4315.11);
  const totalEsperado = roundMoney(comisionTotal + f.iva - f.retIsr - f.retIva);
  assertCerca("totalFiscal", f.totalFiscal, totalEsperado);
  assertCerca("totalFinal",  r.totalFinal,  totalEsperado);
}

// ============================================================================
// CASO 6: RESICO (produccion) — gravada=2862.84, exenta=4983.19, isrRate=0.0125
//
//   iva     = 2862.84 * 0.16   = 458.05
//   retIsr  = 2862.84 * 0.0125 = 35.79
//   retIva  = 458.05 * 2/3     = 305.37
//   total   = (2862.84 + 4983.19) + 458.05 - 35.79 - 305.37 = 7962.92
// ============================================================================

function testCaso6(): void {
  const input: FiscalBreakdownInput = {
    regimenFiscal: "RESICO",
    comisionGravada: 2862.84,
    comisionExenta: 4983.19,
    resicoIsrRate: 0.0125,
    context: { periodo: "test-caso6" },
  };

  const r = calcularDesgloseFiscalV3(input);
  const f = r.fiscal;

  assertCerca("iva",    f.iva,    458.05);
  assertCerca("retIsr", f.retIsr, 35.79);
  assertCerca("retIva", f.retIva, 305.37, 0.01);

  const comisionTotal = roundMoney(2862.84 + 4983.19);
  const totalEsperado = roundMoney(comisionTotal + f.iva - f.retIsr - f.retIva);
  assertCerca("totalFiscal", f.totalFiscal, totalEsperado);
  assertCerca("totalFinal",  r.totalFinal,  totalEsperado);
}

// ============================================================================
// TESTS ESTRUCTURALES Y VALIDACIONES
// ============================================================================

function testEstructuraPdfRows(): void {
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "ASIMILADOS",
    comisionGravada: 1000,
    comisionExenta: 2000,
    asimiladosIsrRate: 0.10,
  });

  // pdfFiscalRows: 6 filas en orden exacto
  const fiscalKeys = r.pdfFiscalRows.map(row => row.key);
  const expectedFiscal = ["COMISION_GRAVADA", "COMISION_EXENTA", "IVA", "RET_ISR", "RET_IVA", "TOTAL_FISCAL"];
  for (let i = 0; i < expectedFiscal.length; i++) {
    if (fiscalKeys[i] !== expectedFiscal[i]) {
      throw new Error(`pdfFiscalRows[${i}]: esperado "${expectedFiscal[i]}", obtenido "${fiscalKeys[i]}"`);
    }
  }

  // pdfOperativoRows: 2 filas en ASIMILADOS
  const operativoKeys = r.pdfOperativoRows.map(row => row.key);
  const expectedOperativo = ["RET_CONTABLE", "COSTO_DISPERSION"];
  for (let i = 0; i < expectedOperativo.length; i++) {
    if (operativoKeys[i] !== expectedOperativo[i]) {
      throw new Error(`pdfOperativoRows[${i}]: esperado "${expectedOperativo[i]}", obtenido "${operativoKeys[i]}"`);
    }
  }

  // pdfRows de compatibilidad: 8 filas
  if (r.pdfRows.length !== 8) throw new Error("pdfRows debe tener 8 filas");
  const expectedLegacy = ["COMISION_GRAVADA", "COMISION_EXENTA", "RET_CONTABLE", "COSTO_DISPERSION", "IVA", "RET_ISR", "RET_IVA", "TOTAL"];
  for (let i = 0; i < expectedLegacy.length; i++) {
    if (r.pdfRows[i].key !== expectedLegacy[i]) {
      throw new Error(`pdfRows[${i}]: esperado "${expectedLegacy[i]}", obtenido "${r.pdfRows[i].key}"`);
    }
  }
}

function testSeparacionFiscalOperativo(): void {
  // HONORARIOS/RESICO no deben tener bloque operativo
  const honorarios = calcularDesgloseFiscalV3({
    regimenFiscal: "HONORARIOS",
    comisionGravada: 5000,
    comisionExenta: 3000,
  });

  if (honorarios.operativo.retContable !== 0) throw new Error("HONORARIOS: retContable debe ser 0");
  if (honorarios.operativo.costoDispersion !== 0) throw new Error("HONORARIOS: costoDispersion debe ser 0");
  if (honorarios.pdfOperativoRows.length !== 0) throw new Error("HONORARIOS: pdfOperativoRows debe estar vacio");

  const resico = calcularDesgloseFiscalV3({
    regimenFiscal: "RESICO",
    comisionGravada: 5000,
    comisionExenta: 3000,
    resicoIsrRate: 0.0125,
  });

  if (resico.operativo.retContable !== 0) throw new Error("RESICO: retContable debe ser 0");
  if (resico.operativo.costoDispersion !== 0) throw new Error("RESICO: costoDispersion debe ser 0");
  if (resico.pdfOperativoRows.length !== 0) throw new Error("RESICO: pdfOperativoRows debe estar vacio");
}

function testValidacionResicoISRFueraDeRango(): void {
  // Tasa 0% debe fallar
  try {
    calcularDesgloseFiscalV3({
      regimenFiscal: "RESICO",
      comisionGravada: 5000,
      comisionExenta: 0,
      resicoIsrRate: 0.005,
    });
    throw new Error("Debia lanzar error con tasa 0.5%");
  } catch (e) {
    if (!(e instanceof FiscalCalculationError) || e.code !== "RESICO_ISR_OUT_OF_RANGE") {
      throw new Error(`Error incorrecto: ${(e as Error).message}`);
    }
  }

  // Tasa 3% debe fallar
  try {
    calcularDesgloseFiscalV3({
      regimenFiscal: "RESICO",
      comisionGravada: 5000,
      comisionExenta: 0,
      resicoIsrRate: 0.03,
    });
    throw new Error("Debia lanzar error con tasa 3%");
  } catch (e) {
    if (!(e instanceof FiscalCalculationError) || e.code !== "RESICO_ISR_OUT_OF_RANGE") {
      throw new Error(`Error incorrecto: ${(e as Error).message}`);
    }
  }

  // Tasa 1.5% debe pasar
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "RESICO",
    comisionGravada: 5000,
    comisionExenta: 0,
    resicoIsrRate: 0.015,
  });
  if (!r.audit.validationsPassed) throw new Error("Tasa 1.5% valida debe pasar");
}

function testAsimiladosRequiereIsrRate(): void {
  try {
    calcularDesgloseFiscalV3({
      regimenFiscal: "ASIMILADOS",
      comisionGravada: 5000,
      comisionExenta: 1000,
    });
    throw new Error("Debia lanzar error por falta de asimiladosIsrRate");
  } catch (e) {
    if (!(e instanceof FiscalCalculationError) || e.code !== "MISSING_ASIMILADOS_ISR_RATE") {
      throw new Error(`Error incorrecto: ${(e as Error).message}`);
    }
  }
}

function testIVANoAplicaSobreExentos(): void {
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "HONORARIOS",
    comisionGravada: 1000,
    comisionExenta: 9000,
  });

  // IVA solo sobre los 1000 gravados
  assertCerca("iva", r.fiscal.iva, 160);

  // RetIsr solo sobre los 1000 gravados (* 0.14)
  assertCerca("retIsr", r.fiscal.retIsr, 140);
}

function testTotalFinalCuadra(): void {
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "ASIMILADOS",
    comisionGravada: 5000,
    comisionExenta: 3000,
    asimiladosIsrRate: 0.10,
  });

  const totalFinalCalculado = roundMoney(r.fiscal.totalFiscal - r.operativo.retContable - r.operativo.costoDispersion);
  assertCerca("totalFinal cuadra", r.totalFinal, totalFinalCalculado);
}

function testAislamiento(): void {
  const input1: FiscalBreakdownInput = {
    regimenFiscal: "HONORARIOS",
    comisionGravada: 1000,
    comisionExenta: 500,
  };
  const input2: FiscalBreakdownInput = {
    regimenFiscal: "HONORARIOS",
    comisionGravada: 2000,
    comisionExenta: 1000,
  };

  const r1 = calcularDesgloseFiscalV3(input1);
  const r2 = calcularDesgloseFiscalV3(input2);

  if (r1.fiscal.retIsr === r2.fiscal.retIsr) {
    throw new Error("Dos calculos con diferentes inputs produjeron el mismo retIsr — posible contaminacion de estado");
  }
  if (r1.totalFinal === r2.totalFinal) {
    throw new Error("Dos calculos con diferentes inputs produjeron el mismo totalFinal");
  }
}

function testAuditSnapshot(): void {
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "HONORARIOS",
    comisionGravada: 5000,
    comisionExenta: 3000,
    context: { agentId: "agent-123", loteId: "lote-456" },
  });

  const snapshot = buildFiscalAuditSnapshot(r, r.audit as unknown as FiscalBreakdownInput["context"]);

  if (snapshot.version_calculo !== "fiscal_v3_audit") throw new Error("version_calculo incorrecta en snapshot");
  if (!snapshot.base_calculo) throw new Error("base_calculo ausente en snapshot");
  if (!snapshot.formulas_usadas) throw new Error("formulas_usadas ausente en snapshot");
  if (typeof snapshot.iva !== "number") throw new Error("iva debe ser numero en snapshot");
  if (typeof snapshot.retIsr !== "number") throw new Error("retIsr debe ser numero en snapshot");
  if (typeof snapshot.totalFiscal !== "number") throw new Error("totalFiscal debe ser numero en snapshot");
  if (typeof snapshot.totalFinal !== "number") throw new Error("totalFinal debe ser numero en snapshot");
}

function testRoundMoney(): void {
  assertCerca("1.005", roundMoney(1.005), 1.01);
  assertCerca("1.004", roundMoney(1.004), 1.00);
  assertCerca("0.355", roundMoney(0.355), 0.36);
  assertCerca("negativo", roundMoney(-1.005), -1.00);

  try {
    roundMoney(Infinity);
    throw new Error("Debia lanzar error para Infinity");
  } catch (e) {
    if (!(e instanceof FiscalCalculationError)) throw new Error("Debia ser FiscalCalculationError");
  }
}

function testVersionCalculo(): void {
  if (FISCAL_FORMULA_VERSION !== "fiscal_v3_audit") {
    throw new Error(`FISCAL_FORMULA_VERSION debe ser "fiscal_v3_audit", obtenido "${FISCAL_FORMULA_VERSION}"`);
  }
  if (FISCAL_CONFIG.FORMULA_VERSION !== "fiscal_v3_audit") {
    throw new Error("FISCAL_CONFIG.FORMULA_VERSION incorrecta");
  }
}

function testFormatoLog(): void {
  const r = calcularDesgloseFiscalV3({
    regimenFiscal: "HONORARIOS",
    comisionGravada: 1000,
    comisionExenta: 500,
  });

  const log = formatearResultadoParaLog(r);
  if (!log.includes("HONORARIOS")) throw new Error("Log debe incluir regimen");
  if (!log.includes("BLOQUE FISCAL")) throw new Error("Log debe incluir BLOQUE FISCAL");
  if (!log.includes("BLOQUE OPERATIVO")) throw new Error("Log debe incluir BLOQUE OPERATIVO");
  if (!log.includes("TOTAL FINAL")) throw new Error("Log debe incluir TOTAL FINAL");
  if (!log.includes("fiscal_v3_audit")) throw new Error("Log debe incluir version");
}

// ============================================================================
// RUNNER
// ============================================================================

export function runFiscalTests(): { passed: number; failed: number; total: number } {
  console.log("\n========================================");
  console.log("MOTOR FISCAL — fiscal_v3_audit");
  console.log("========================================\n");

  const tests: Array<[string, () => void]> = [
    ["CASO 1: ASIMILADOS (gravada=82.11, exenta=544.20, rate=0.10)", testCaso1],
    ["CASO 2: HONORARIOS (gravada=814.95, exenta=1119.05)", testCaso2],
    ["CASO 3: RESICO (gravada=17616.83, exenta=4931.88, rate=0.0125)", testCaso3],
    ["CASO 4: ASIMILADOS produccion (gravada=9039.75, exenta=9554.15)", testCaso4],
    ["CASO 5: HONORARIOS produccion (gravada=10708.94, exenta=4315.11)", testCaso5],
    ["CASO 6: RESICO produccion (gravada=2862.84, exenta=4983.19)", testCaso6],
    ["Estructura pdfFiscalRows / pdfOperativoRows / pdfRows", testEstructuraPdfRows],
    ["Separacion FISCAL vs OPERATIVO por regimen", testSeparacionFiscalOperativo],
    ["Validacion: RESICO ISR fuera de rango es bloqueante", testValidacionResicoISRFueraDeRango],
    ["Validacion: ASIMILADOS requiere asimiladosIsrRate", testAsimiladosRequiereIsrRate],
    ["IVA y retIsr NO se aplican sobre comisiones exentas", testIVANoAplicaSobreExentos],
    ["totalFinal = totalFiscal - retContable - costoDispersion", testTotalFinalCuadra],
    ["Aislamiento: cada calculo es independiente", testAislamiento],
    ["Audit snapshot incluye version_calculo, base_calculo, formulas_usadas", testAuditSnapshot],
    ["roundMoney: politica round-half-up documentada", testRoundMoney],
    ["FISCAL_FORMULA_VERSION = 'fiscal_v3_audit'", testVersionCalculo],
    ["formatearResultadoParaLog incluye ambos bloques", testFormatoLog],
  ];

  let passed = 0;
  let failed = 0;

  for (const [nombre, fn] of tests) {
    if (correrTest(nombre, fn)) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("\n----------------------------------------");
  console.log(`Total: ${tests.length} | Pasados: ${passed} | Fallados: ${failed}`);
  console.log("----------------------------------------\n");

  return { passed, failed, total: tests.length };
}

// Ejecutar si se llama directamente
if (typeof window === "undefined") {
  const { failed } = runFiscalTests();
  if (failed > 0) process.exit(1);
}
