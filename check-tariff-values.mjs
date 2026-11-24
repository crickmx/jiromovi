import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ypsrdzqcgjyuxwmxhxzv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwc3JkenFjZ2p5dXh3bXhoeHp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTY0MjIzNywiZXhwIjoyMDQ1MjE4MjM3fQ.YkuKj5efhsVmcQDmcd0ktCa-9dt-mGnS3vC8DJlcYbY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Consultando paquete activo...\n');

  const { data: pkg } = await supabase
    .from('tariff_packages')
    .select('id, name')
    .eq('status', 'active')
    .maybeSingle();

  if (!pkg) {
    console.log('❌ No hay paquete activo');
    return;
  }

  console.log(`✓ Paquete: ${pkg.name}\n`);

  const { data: tables } = await supabase
    .from('tariff_tables')
    .select('table_key, data_json')
    .eq('tariff_package_id', pkg.id);

  const get = (key) => tables && tables.find(t => t.table_key === key) ? tables.find(t => t.table_key === key).data_json : null;

  console.log('═══════════════════════════════════════════════════════');
  console.log('COEFICIENTES SIMPLES');
  console.log('═══════════════════════════════════════════════════════\n');

  const coefMed = get('coef_medicamentos');
  const coefVip = get('coef_vip');
  const coefEmerg = get('coef_emergencia_ext');

  const coefs = {
    medicamentos: coefMed && coefMed[0] ? coefMed[0].col_0 : 0,
    vip: coefVip && coefVip[0] ? coefVip[0].col_0 : 0,
    emergencia_ext: coefEmerg && coefEmerg[0] ? coefEmerg[0].col_0 : 0,
  };

  console.log(`Medicamentos (AJ3):      ${coefs.medicamentos}`);
  console.log(`VIP (BI3):               ${coefs.vip}`);
  console.log(`Emergencia Ext (AW3):    ${coefs.emergencia_ext}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ELIMINACIÓN DEDUCIBLE (deducible 35000)');
  console.log('═══════════════════════════════════════════════════════\n');

  const dedKeys = get('deducible_accidente_keys') || [];
  const dedFactors = get('deducible_accidente_factors') || [];
  const idx = dedKeys.findIndex(k => k === 35000);
  const factorDed = idx >= 0 ? dedFactors[idx] : 0;

  console.log(`Factor para 35000:       ${factorDed}`);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('MULTIREGIÓN - QUERÉTARO');
  console.log('═══════════════════════════════════════════════════════\n');

  const multiData = get('multiregion_carga_sistema') || [];
  const qro = multiData.find(r => r.col_0 === 'QUERETARO');

  if (qro) {
    console.log(`col_0 (Estado):          ${qro.col_0}`);
    console.log(`col_1:                   ${qro.col_1}`);
    console.log(`col_2 (actual):          ${qro.col_2}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ANÁLISIS DE SUMA');
  console.log('═══════════════════════════════════════════════════════\n');

  const col1Val = qro ? qro.col_1 : 0;
  const col2Val = qro ? qro.col_2 : 0;

  const sumaCon_col1 = coefs.medicamentos + coefs.vip + coefs.emergencia_ext + factorDed + col1Val;
  const sumaCon_col2 = coefs.medicamentos + coefs.vip + coefs.emergencia_ext + factorDed + col2Val;

  console.log('Si usamos col_1 de Multiregión:');
  console.log(`  ${coefs.medicamentos} + ${coefs.vip} + ${coefs.emergencia_ext} + ${factorDed} + ${col1Val} = ${sumaCon_col1}`);
  console.log(`  Objetivo: 0.616394`);
  console.log(`  Diferencia: ${(sumaCon_col1 - 0.616394).toFixed(6)}`);
  if (Math.abs(sumaCon_col1 - 0.616394) < 0.001) {
    console.log('  ✅ ¡CORRECTO! Usar col_1');
  }

  console.log('\nSi usamos col_2 de Multiregión (ACTUAL):');
  console.log(`  ${coefs.medicamentos} + ${coefs.vip} + ${coefs.emergencia_ext} + ${factorDed} + ${col2Val} = ${sumaCon_col2}`);
  console.log(`  Objetivo: 0.616394`);
  console.log(`  Diferencia: ${(sumaCon_col2 - 0.616394).toFixed(6)}`);
  if (Math.abs(sumaCon_col2 - 0.616394) < 0.001) {
    console.log('  ✅ ¡CORRECTO! Usar col_2');
  } else {
    console.log('  ❌ INCORRECTO - Falta mucho');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('GASTOS DE EXPEDICIÓN');
  console.log('═══════════════════════════════════════════════════════\n');

  const gastosData = get('gastos_expedicion');
  const gastos = gastosData && gastosData[0] ? gastosData[0].col_0 : 0;
  console.log(`Valor actual (O67):       ${gastos}`);
  console.log(`Objetivo:                 300`);
  if (gastos === 300) {
    console.log('✅ Correcto');
  } else {
    console.log(`❌ Incorrecto - Debe ser 300`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('DECISIÓN');
  console.log('═══════════════════════════════════════════════════════\n');

  if (Math.abs(sumaCon_col1 - 0.616394) < 0.001) {
    console.log('✅ USAR col_1 para multiregión');
    console.log('   Cambiar línea 371 en gmmCalculationEngineV2.ts:');
    console.log('   return roundTo5Decimals(Number(row.col_1 || 0));');
  } else if (Math.abs(sumaCon_col2 - 0.616394) < 0.001) {
    console.log('✅ col_2 ya es correcto - problema en otro lugar');
  } else {
    console.log('⚠️  Ninguna columna da el valor correcto');
    console.log('   Verificar valores en Excel original');
  }
}

main().catch(console.error);
