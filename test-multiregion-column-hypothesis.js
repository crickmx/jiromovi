/**
 * PRUEBA DE HIPÓTESIS: ¿col_1 o col_2 en multiregion_carga_sistema?
 *
 * Determinar qué columna usar para que las primas coincidan con el Excel.
 */

// Datos conocidos del Excel Real
const PRIMA_BASE = 11509.57;
const PRIMA_ADICIONALES_OBJETIVO = 7094.43;
const RATIO_OBJETIVO = 0.616394;

// Valores hipotéticos de coeficientes
// (estos valores son estimaciones razonables para seguros GMM)
const ESCENARIO_1 = {
  nombre: 'Escenario 1: Coeficientes típicos de seguros',
  coef_medicamentos: 0.05,        // 5%
  coef_vip: 0.05,                 // 5%
  coef_emergencia_ext: 0.05,      // 5%
  factor_deducible_35000: 0.05,   // 5%
  // Lo que falta para llegar a 0.616394:
  factor_multiregion_needed: 0.616394 - (0.05 + 0.05 + 0.05 + 0.05)
};

const ESCENARIO_2 = {
  nombre: 'Escenario 2: Multiregión dominante (35%)',
  coef_medicamentos: 0.08,        // 8%
  coef_vip: 0.08,                 // 8%
  coef_emergencia_ext: 0.08,      // 8%
  factor_deducible_35000: 0.08,   // 8%
  // Multiregión es ~35% del total
  factor_multiregion_needed: 0.616394 - (0.08 + 0.08 + 0.08 + 0.08)
};

const ESCENARIO_3 = {
  nombre: 'Escenario 3: Distribución equitativa',
  // Si las 5 coberturas fueran iguales:
  factor_igual: 0.616394 / 5
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 PRUEBA DE HIPÓTESIS: Columna Multiregión');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📊 OBJETIVO:');
console.log(`  Prima Base:              $${PRIMA_BASE.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`  Prima Adicionales:       $${PRIMA_ADICIONALES_OBJETIVO.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`  Ratio:                   ${RATIO_OBJETIVO} (${(RATIO_OBJETIVO * 100).toFixed(2)}%)`);
console.log(`  Suma de factores:        ${RATIO_OBJETIVO}\n`);

function calcularYMostrar(escenario) {
  console.log('─'.repeat(70));
  console.log(`\n${escenario.nombre}\n`);

  if (escenario.factor_multiregion_needed !== undefined) {
    const suma = escenario.coef_medicamentos +
                 escenario.coef_vip +
                 escenario.coef_emergencia_ext +
                 escenario.factor_deducible_35000 +
                 escenario.factor_multiregion_needed;

    console.log('Factores individuales:');
    console.log(`  Medicamentos:            ${escenario.coef_medicamentos.toFixed(6)} (${(escenario.coef_medicamentos * 100).toFixed(2)}%)`);
    console.log(`  VIP:                     ${escenario.coef_vip.toFixed(6)} (${(escenario.coef_vip * 100).toFixed(2)}%)`);
    console.log(`  Emergencia Extranjero:   ${escenario.coef_emergencia_ext.toFixed(6)} (${(escenario.coef_emergencia_ext * 100).toFixed(2)}%)`);
    console.log(`  Eliminación Deducible:   ${escenario.factor_deducible_35000.toFixed(6)} (${(escenario.factor_deducible_35000 * 100).toFixed(2)}%)`);
    console.log(`  Multiregión (necesaria): ${escenario.factor_multiregion_needed.toFixed(6)} (${(escenario.factor_multiregion_needed * 100).toFixed(2)}%)`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  SUMA:                    ${suma.toFixed(6)} (${(suma * 100).toFixed(2)}%)`);

    const prima_calculada = PRIMA_BASE * suma;
    const diferencia = Math.abs(prima_calculada - PRIMA_ADICIONALES_OBJETIVO);

    console.log('\nPrima Adicionales Calculada:');
    console.log(`  $${PRIMA_BASE.toFixed(2)} × ${suma.toFixed(6)} = $${prima_calculada.toFixed(2)}`);
    console.log(`  Objetivo:                $${PRIMA_ADICIONALES_OBJETIVO.toFixed(2)}`);
    console.log(`  Diferencia:              $${diferencia.toFixed(2)}`);

    if (diferencia < 0.10) {
      console.log('  ✅ ¡COINCIDE PERFECTAMENTE!');
    } else if (diferencia < 1) {
      console.log('  ✓ Muy cerca (error < $1)');
    } else {
      console.log('  ❌ No coincide');
    }

    console.log('\n🎯 Conclusión:');
    console.log(`  Para este escenario, Multiregión debe ser: ${escenario.factor_multiregion_needed.toFixed(6)}`);
    console.log(`  Si col_1 = ${escenario.factor_multiregion_needed.toFixed(6)}, usar col_1 ✓`);
    console.log(`  Si col_2 = ${escenario.factor_multiregion_needed.toFixed(6)}, usar col_2 ✓`);

  } else if (escenario.factor_igual !== undefined) {
    console.log('Si todas las coberturas tuvieran el mismo peso:');
    console.log(`  Factor por cobertura:    ${escenario.factor_igual.toFixed(6)} (${(escenario.factor_igual * 100).toFixed(2)}%)`);
    console.log(`  SUMA (5 × ${escenario.factor_igual.toFixed(6)}): ${(escenario.factor_igual * 5).toFixed(6)}`);

    const prima_calculada = PRIMA_BASE * (escenario.factor_igual * 5);
    console.log(`\n  Prima Adicionales:       $${prima_calculada.toFixed(2)}`);
    console.log('  ✅ Por definición coincide con objetivo');
  }

  console.log('');
}

calcularYMostrar(ESCENARIO_1);
calcularYMostrar(ESCENARIO_2);
calcularYMostrar(ESCENARIO_3);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📝 PASOS SIGUIENTES');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('1. Abrir el archivo Excel de tarifas');
console.log('2. Ir a la hoja "Tarifa"');
console.log('3. Verificar las celdas:');
console.log('   AJ3  = coef_medicamentos');
console.log('   BI3  = coef_vip');
console.log('   AW3  = coef_emergencia_ext');
console.log('   AW15:AW23 = factores deducible (buscar fila para 35000)');
console.log('   AQ42:AS74 = tabla multiregión (buscar fila QUERETARO)');
console.log('');
console.log('4. Anotar los valores y calcular la suma');
console.log('5. Verificar si suma = 0.616394');
console.log('');
console.log('6. Si NO suma 0.616394:');
console.log('   a) Verificar si col_1 o col_2 de multiregión da el valor correcto');
console.log('   b) Si ninguna columna da el valor correcto, los coeficientes');
console.log('      en el Excel están incorrectos');
console.log('');
console.log('7. Si la suma SÍ es 0.616394 pero el sistema calcula mal:');
console.log('   a) El problema está en la columna usada (col_2 vs col_1)');
console.log('   b) Cambiar el código para usar la columna correcta');
console.log('');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('💡 HIPÓTESIS MÁS PROBABLE:');
console.log('\nMultiregión debería representar ~35-40% de las adicionales.');
console.log(`Esto es: $${PRIMA_ADICIONALES_OBJETIVO * 0.35} - $${PRIMA_ADICIONALES_OBJETIVO * 0.40}`);
console.log(`Factor Multiregión: ${(RATIO_OBJETIVO * 0.35).toFixed(6)} - ${(RATIO_OBJETIVO * 0.40).toFixed(6)}`);
console.log('\nSi col_2 tiene un valor mucho menor que esto, entonces');
console.log('definitivamente se debe usar col_1 en lugar de col_2.\n');

console.log('═══════════════════════════════════════════════════════════════\n');
