/**
 * INGENIERÍA INVERSA - GMM BX+ COBERTURAS ADICIONALES
 *
 * Usando los datos reales del Excel, calcular qué valores necesitan
 * los coeficientes para que las primas coincidan.
 */

// Datos del Excel Real
const EXCEL_DATA = {
  asegurados: [
    {
      nombre: 'RICARDO CASTRO GOMEZ (Hombre 40)',
      prima_base: 11509.57,
      prima_adicionales: 7094.43,
      prima_total: 18604.00
    },
    {
      nombre: 'JULIANA CEBALLOS GONZALEZ (Mujer 39)',
      prima_base: 14595.59,
      prima_adicionales: 8996.64,
      prima_total: 23592.23
    },
    {
      nombre: 'EMMA CASTRO CEBALLOS (Mujer 1)',
      prima_base: 6043.98,
      prima_adicionales: 3725.47,
      prima_total: 9769.45
    }
  ],
  coberturas_activas: [
    'medicamentos_fuera',
    'eliminacion_deducible_accidente',
    'multiregion',
    'vip',
    'emergencia_medica_extranjero'
  ],
  plan: {
    estado: 'QUERETARO',
    nivel: 'PLUS',
    tabulador: 'ORO-110,000',
    suma_asegurada: 50000000,
    deducible: 35000,
    coaseguro: 0.15,
    tope_coaseguro: 60000
  }
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔄 INGENIERÍA INVERSA - GMM BX+ COBERTURAS ADICIONALES');
console.log('═══════════════════════════════════════════════════════════════\n');

// Análisis por asegurado
EXCEL_DATA.asegurados.forEach(aseg => {
  console.log(`\n📊 ${aseg.nombre}`);
  console.log('─'.repeat(70));
  console.log(`Prima Base (con cargas):      $${aseg.prima_base.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
  console.log(`Prima Adicionales:            $${aseg.prima_adicionales.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
  console.log(`Prima Total:                  $${aseg.prima_total.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);

  const ratio = aseg.prima_adicionales / aseg.prima_base;
  console.log(`\n🎯 Ratio Adicionales/Base:     ${ratio.toFixed(6)} (${(ratio * 100).toFixed(2)}%)`);

  console.log('\n💡 Esto significa que la SUMA de todos los factores de coberturas debe ser:');
  console.log(`   ${ratio.toFixed(6)}`);
});

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('🔍 ANÁLISIS DE CONSISTENCIA');
console.log('═══════════════════════════════════════════════════════════════\n');

// Verificar si los ratios son consistentes
const ratios = EXCEL_DATA.asegurados.map(a => a.prima_adicionales / a.prima_base);
const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
const minRatio = Math.min(...ratios);
const maxRatio = Math.max(...ratios);

console.log('Ratios por asegurado:');
ratios.forEach((r, idx) => {
  console.log(`  Asegurado ${idx + 1}: ${r.toFixed(6)} (${(r * 100).toFixed(2)}%)`);
});

console.log(`\nPromedio: ${avgRatio.toFixed(6)}`);
console.log(`Rango: ${minRatio.toFixed(6)} - ${maxRatio.toFixed(6)}`);
console.log(`Variación: ${((maxRatio - minRatio) / avgRatio * 100).toFixed(2)}%`);

if ((maxRatio - minRatio) / avgRatio < 0.01) {
  console.log('\n✅ Los ratios son MUY CONSISTENTES (< 1% variación)');
  console.log('   Esto indica que todas las coberturas usan el MISMO factor');
  console.log('   independiente de edad/sexo.');
} else {
  console.log('\n⚠️  Los ratios varían significativamente');
  console.log('   Esto indica que algunas coberturas dependen de edad/sexo.');
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('🧮 DISTRIBUCIÓN ESTIMADA DE COBERTURAS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Estimación de factores individuales
console.log('Usando el ratio promedio de', avgRatio.toFixed(6));
console.log('\nSi las 5 coberturas tienen pesos iguales:');
console.log(`  Factor por cobertura: ${(avgRatio / 5).toFixed(6)} (${(avgRatio / 5 * 100).toFixed(2)}%)`);

console.log('\nSi Multiregión es la más grande (típicamente 30-40% del total):');
const multiregionEstimate = avgRatio * 0.35;
const othersEstimate = (avgRatio - multiregionEstimate) / 4;
console.log(`  Multiregión: ${multiregionEstimate.toFixed(6)} (${(multiregionEstimate * 100).toFixed(2)}%)`);
console.log(`  Otras 4: ${othersEstimate.toFixed(6)} cada una (${(othersEstimate * 100).toFixed(2)}%)`);

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('🎯 VALORES OBJETIVO PARA EL EXCEL');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Para que el cálculo sea correcto, la suma de estos coeficientes debe ser:');
console.log(`\n  coef_medicamentos +`);
console.log(`  coef_vip +`);
console.log(`  coef_emergencia_ext +`);
console.log(`  factor_eliminacion_deducible_35000 +`);
console.log(`  factor_multiregion_QUERETARO`);
console.log(`\n  = ${avgRatio.toFixed(6)}`);

console.log('\n💡 RECOMENDACIÓN:');
console.log('   Ejecutar el diagnóstico HTML para ver los valores actuales en la BD');
console.log('   Comparar con esta suma objetivo');
console.log('   Ajustar los valores en el Excel de tarifas');

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('📝 VALIDACIÓN DE GASTOS EXPEDICIÓN');
console.log('═══════════════════════════════════════════════════════════════\n');

const totalExcelPrimaNeta = EXCEL_DATA.asegurados.reduce((sum, a) => sum + a.prima_total, 0);
const gastos_expedicion_excel = 900;
const subtotal_excel = totalExcelPrimaNeta + gastos_expedicion_excel;
const iva_excel = 8458.51;
const total_pagar_excel = 61324.20;

console.log(`Prima Neta Total: $${totalExcelPrimaNeta.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`Gastos Expedición: $${gastos_expedicion_excel.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`Subtotal: $${subtotal_excel.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`IVA: $${iva_excel.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`Total a Pagar: $${total_pagar_excel.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);

const gastos_por_asegurado = gastos_expedicion_excel / EXCEL_DATA.asegurados.length;
console.log(`\n📊 Gastos por asegurado: $${gastos_por_asegurado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);

const iva_calculado = subtotal_excel * 0.16;
console.log(`\n🔢 IVA calculado (16%): $${iva_calculado.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`   IVA del Excel: $${iva_excel.toLocaleString('es-MX', {minimumFractionDigits: 2})}`);
console.log(`   Diferencia: $${Math.abs(iva_calculado - iva_excel).toLocaleString('es-MX', {minimumFractionDigits: 2})}`);

if (Math.abs(iva_calculado - iva_excel) < 0.01) {
  console.log('   ✅ IVA correcto');
} else {
  console.log('   ⚠️  IVA tiene diferencia');
}

console.log('\n═══════════════════════════════════════════════════════════════\n');
