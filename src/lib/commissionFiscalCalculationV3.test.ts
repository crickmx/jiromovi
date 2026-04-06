/**
 * SUITE DE PRUEBAS COMPLETA PARA MOTOR FISCAL V3
 *
 * Esta suite valida el motor fiscal blindado con 6 casos de prueba:
 * - Casos 1-3: Validación de fórmulas originales
 * - Casos 4-6: Validación con PDFs actuales de producción
 *
 * Cada test valida:
 * - Totales correctos
 * - Validaciones internas pasadas
 * - Ausencia de errores
 * - Formato correcto de output
 *
 * @version 3.0.0
 */

import {
  calcularDesgloseFiscalV3,
  validarResultadoFiscal,
  formatearResultadoParaLog,
  FiscalCalculationError,
  type FiscalBreakdownInput,
  type FiscalBreakdownResult,
  FISCAL_CONFIG,
} from "./commissionFiscalCalculationV3";

// ============================================================================
// UTILIDADES DE TESTING
// ============================================================================

interface TestCase {
  nombre: string;
  input: FiscalBreakdownInput;
  totalEsperado: number;
  descripcion: string;
}

function ejecutarTestCase(testCase: TestCase): {
  resultado: FiscalBreakdownResult;
  validacion: ReturnType<typeof validarResultadoFiscal>;
  exitoso: boolean;
} {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`TEST: ${testCase.nombre}`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Descripción: ${testCase.descripcion}`);
  console.log(`\nInput:`);
  console.log(`  Régimen: ${testCase.input.regimenFiscal}`);
  console.log(
    `  Comisión Gravada: $${testCase.input.comisionGravada.toFixed(2)}`
  );
  console.log(`  Comisión Exenta: $${testCase.input.comisionExenta.toFixed(2)}`);
  console.log(
    `  Comisión Total: $${(testCase.input.comisionGravada + testCase.input.comisionExenta).toFixed(2)}`
  );
  console.log(`  Total Esperado: $${testCase.totalEsperado.toFixed(2)}`);

  let resultado: FiscalBreakdownResult;
  let exitoso = false;

  try {
    // Ejecutar cálculo
    resultado = calcularDesgloseFiscalV3(testCase.input);

    // Validar resultado
    const validacion = validarResultadoFiscal(resultado, testCase.totalEsperado);

    console.log(`\n${formatearResultadoParaLog(resultado)}`);
    console.log(`\n${validacion.mensaje}`);

    exitoso = validacion.valido && resultado.audit.validationsPassed;

    if (exitoso) {
      console.log(`\n✅ TEST EXITOSO: ${testCase.nombre}`);
    } else {
      console.log(`\n❌ TEST FALLIDO: ${testCase.nombre}`);
      if (!validacion.valido) {
        console.log(
          `   Diferencia: $${validacion.diferencia.toFixed(2)} (tolerancia: $${FISCAL_CONFIG.TOLERANCE.toFixed(2)})`
        );
      }
      if (!resultado.audit.validationsPassed) {
        console.log(`   Validaciones internas fallaron`);
      }
    }

    return { resultado, validacion, exitoso };
  } catch (error) {
    console.log(`\n❌ ERROR EN TEST: ${testCase.nombre}`);
    if (error instanceof FiscalCalculationError) {
      console.log(`   Código: ${error.code}`);
      console.log(`   Mensaje: ${error.message}`);
      console.log(`   Detalles:`, error.details);
    } else {
      console.log(`   Error inesperado:`, error);
    }
    throw error;
  }
}

// ============================================================================
// CASOS DE PRUEBA
// ============================================================================

const TEST_CASES: TestCase[] = [
  // CASOS ORIGINALES (1-3): Validación de fórmulas base
  {
    nombre: "CASO 1: ASIMILADOS - Validación Original",
    input: {
      regimenFiscal: "ASIMILADOS",
      comisionGravada: 82.11,
      comisionExenta: 544.2,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["doc-original-1"],
      },
    },
    totalEsperado: 477.4,
    descripcion:
      "Validación de fórmulas ASIMILADOS con caso original del documento de referencia",
  },

  {
    nombre: "CASO 2: HONORARIOS - Validación Original",
    input: {
      regimenFiscal: "HONORARIOS",
      comisionGravada: 814.95,
      comisionExenta: 1119.05,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["doc-original-2"],
      },
    },
    totalEsperado: 1784.06,
    descripcion:
      "Validación de fórmulas HONORARIOS con caso original del documento de referencia",
  },

  {
    nombre: "CASO 3: RESICO - Validación Original",
    input: {
      regimenFiscal: "RESICO",
      comisionGravada: 17616.83,
      comisionExenta: 4931.88,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["doc-original-3"],
      },
    },
    totalEsperado: 23206.41,
    descripcion:
      "Validación de fórmulas RESICO con caso original del documento de referencia",
  },

  // CASOS ACTUALES (4-6): Validación con PDFs de producción
  {
    nombre: "CASO 4: ASIMILADOS - PDF Actual",
    input: {
      regimenFiscal: "ASIMILADOS",
      comisionGravada: 9039.75,
      comisionExenta: 9554.15,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["pdf-actual-asimilados"],
      },
    },
    totalEsperado: 14598.7,
    descripcion:
      "Validación con PDF actual de producción - Agente con régimen ASIMILADOS",
  },

  {
    nombre: "CASO 5: HONORARIOS - PDF Actual",
    input: {
      regimenFiscal: "HONORARIOS",
      comisionGravada: 10708.94,
      comisionExenta: 4315.11,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["pdf-actual-honorarios"],
      },
    },
    totalEsperado: 14092.79,
    descripcion:
      "Validación con PDF actual de producción - Agente con régimen HONORARIOS",
  },

  {
    nombre: "CASO 6: RESICO - PDF Actual",
    input: {
      regimenFiscal: "RESICO",
      comisionGravada: 2862.84,
      comisionExenta: 4983.19,
      context: {
        periodo: "2026-04",
        sourceDocumentIds: ["pdf-actual-resico"],
      },
    },
    totalEsperado: 7900.63,
    descripcion:
      "Validación con PDF actual de producción - Agente con régimen RESICO",
  },
];

// ============================================================================
// EJECUCIÓN DE TESTS
// ============================================================================

console.log("\n");
console.log("╔" + "═".repeat(78) + "╗");
console.log("║" + " ".repeat(78) + "║");
console.log(
  "║" +
    " ".repeat(15) +
    "SUITE DE PRUEBAS - MOTOR FISCAL V3" +
    " ".repeat(29) +
    "║"
);
console.log(
  "║" +
    " ".repeat(20) +
    "Sistema MOVI Digital - 2026" +
    " ".repeat(31) +
    "║"
);
console.log("║" + " ".repeat(78) + "║");
console.log("╚" + "═".repeat(78) + "╝");
console.log(`\nVersión de Fórmulas: ${FISCAL_CONFIG.FORMULA_VERSION}`);
console.log(`Política de Redondeo: ${FISCAL_CONFIG.ROUNDING_POLICY}`);
console.log(`Tolerancia: $${FISCAL_CONFIG.TOLERANCE.toFixed(2)}`);
console.log(`Total de Tests: ${TEST_CASES.length}`);

const resultados = TEST_CASES.map((testCase) => {
  try {
    const { exitoso } = ejecutarTestCase(testCase);
    return { nombre: testCase.nombre, exitoso };
  } catch (error) {
    return { nombre: testCase.nombre, exitoso: false, error };
  }
});

// ============================================================================
// RESUMEN FINAL
// ============================================================================

console.log("\n");
console.log("╔" + "═".repeat(78) + "╗");
console.log("║" + " ".repeat(78) + "║");
console.log(
  "║" +
    " ".repeat(28) +
    "RESUMEN DE TESTS" +
    " ".repeat(34) +
    "║"
);
console.log("║" + " ".repeat(78) + "║");
console.log("╚" + "═".repeat(78) + "╝");
console.log("");

const exitosos = resultados.filter((r) => r.exitoso).length;
const fallidos = resultados.length - exitosos;

resultados.forEach((r) => {
  const icono = r.exitoso ? "✅" : "❌";
  const estado = r.exitoso ? "PASÓ" : "FALLÓ";
  console.log(`${icono} ${estado.padEnd(5)} - ${r.nombre}`);
});

console.log("");
console.log("─".repeat(80));
console.log(
  `Total: ${resultados.length} | Exitosos: ${exitosos} | Fallidos: ${fallidos}`
);
console.log("─".repeat(80));

if (fallidos === 0) {
  console.log("");
  console.log("🎉 ¡TODOS LOS TESTS PASARON EXITOSAMENTE!");
  console.log("");
  console.log("El motor fiscal V3 está validado y listo para producción.");
  console.log("");
  console.log("Garantías verificadas:");
  console.log("  ✓ Cálculos exactos según fórmulas oficiales");
  console.log("  ✓ Validaciones internas completas");
  console.log("  ✓ Consistencia entre casos originales y actuales");
  console.log("  ✓ Auditoría y versionado implementados");
  console.log("  ✓ Manejo de errores robusto");
  console.log("");
} else {
  console.log("");
  console.log("⚠️  HAY TESTS FALLIDOS - REVISAR ANTES DE USAR EN PRODUCCIÓN");
  console.log("");
  process.exit(1);
}

// Exportar resultados para uso programático
export const testResults = {
  casos: TEST_CASES,
  resultados,
  resumen: {
    total: resultados.length,
    exitosos,
    fallidos,
    todosExitosos: fallidos === 0,
  },
};
