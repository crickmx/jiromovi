import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ypsrdzqcgjyuxwmxhxzv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwc3JkenFjZ2p5dXh3bXhoeHp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk2NDIyMzcsImV4cCI6MjA0NTIxODIzN30.TlihgKe7fZKP6LIbIvqE6yb-3XBalLFu9Qe3SOXmh70'
);

async function main() {
  console.log('🔍 Consultando tarifas activas...\n');

  const { data: pkg, error: pkgError } = await supabase
    .from('tariff_packages')
    .select('id, name')
    .eq('status', 'active')
    .single();

  if (pkgError || !pkg) {
    console.error('❌ No hay paquete activo:', pkgError);
    return;
  }

  console.log(`📦 Paquete activo: ${pkg.name} (${pkg.id})\n`);

  const { data: tables, error: tablesError } = await supabase
    .from('tariff_tables')
    .select('*')
    .eq('tariff_package_id', pkg.id);

  if (tablesError) {
    console.error('❌ Error consultando tablas:', tablesError);
    return;
  }

  const get = (key) => tables.find(t => t.table_key === key)?.data_json;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 COEFICIENTES ACTUALES EN LA BASE DE DATOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const coef_medicamentos = get('coef_medicamentos')?.[0]?.col_0 || 0;
  const coef_vip = get('coef_vip')?.[0]?.col_0 || 0;
  const coef_emergencia_ext = get('coef_emergencia_ext')?.[0]?.col_0 || 0;

  console.log(`coef_medicamentos (AJ3):           ${coef_medicamentos}`);
  console.log(`coef_vip (BI3):                    ${coef_vip}`);
  console.log(`coef_emergencia_ext (AW3):         ${coef_emergencia_ext}`);

  console.log('\n📊 ELIMINACIÓN DEDUCIBLE POR ACCIDENTE:');
  const deducibleKeys = get('deducible_accidente_keys') || [];
  const deducibleFactors = get('deducible_accidente_factors') || [];

  const idx35000 = deducibleKeys.findIndex(k => k === 35000);
  const factor_deducible_35000 = idx35000 >= 0 ? deducibleFactors[idx35000] : 0;
  console.log(`factor_deducible_35000 (AW15:AW23): ${factor_deducible_35000}`);

  console.log('\n📊 MULTIREGIÓN - QUERÉTARO:');
  const multiregionData = get('multiregion_carga_sistema') || [];
  const qroRow = multiregionData.find(r => r.col_0 === 'QUERETARO');

  if (qroRow) {
    console.log(`Estado: ${qroRow.col_0}`);
    console.log(`  col_1: ${qroRow.col_1 || 'null'}`);
    console.log(`  col_2 (usado actualmente): ${qroRow.col_2 || 'null'}`);
  } else {
    console.log('❌ No se encontró QUERETARO en multiregion_carga_sistema');
  }

  const factor_multiregion = qroRow?.col_2 || 0;

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🧮 SUMA DE FACTORES ACTUALES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const suma_actual = coef_medicamentos + coef_vip + coef_emergencia_ext + factor_deducible_35000 + factor_multiregion;

  console.log(`  coef_medicamentos:           ${coef_medicamentos.toFixed(6)}`);
  console.log(`  coef_vip:                    ${coef_vip.toFixed(6)}`);
  console.log(`  coef_emergencia_ext:         ${coef_emergencia_ext.toFixed(6)}`);
  console.log(`  factor_deducible_35000:      ${factor_deducible_35000.toFixed(6)}`);
  console.log(`  factor_multiregion_QRO:      ${factor_multiregion.toFixed(6)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  SUMA ACTUAL:                 ${suma_actual.toFixed(6)}`);
  console.log(`  SUMA OBJETIVO:               0.616394`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  DIFERENCIA:                  ${(0.616394 - suma_actual).toFixed(6)}`);

  const porcentaje_actual = (suma_actual * 100).toFixed(2);
  const porcentaje_objetivo = 61.64;
  const diff_porcentaje = (porcentaje_objetivo - parseFloat(porcentaje_actual)).toFixed(2);

  console.log(`\n📊 En porcentaje:`);
  console.log(`  Actual:   ${porcentaje_actual}%`);
  console.log(`  Objetivo: ${porcentaje_objetivo}%`);
  console.log(`  Faltan:   ${diff_porcentaje}%`);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('💰 GASTOS DE EXPEDICIÓN');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const gastos_expedicion = get('gastos_expedicion')?.[0]?.col_0 || 0;
  console.log(`Gastos expedición (O67):       $${gastos_expedicion}`);
  console.log(`Objetivo:                      $300`);
  console.log(`Diferencia:                    $${300 - gastos_expedicion}`);

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🎯 ACCIONES REQUERIDAS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (Math.abs(0.616394 - suma_actual) > 0.001) {
    console.log('❌ Los factores de coberturas NO coinciden con el Excel real');
    console.log('\n🔧 SOLUCIONES POSIBLES:');

    if (qroRow && qroRow.col_1) {
      console.log('\n1. Usar col_1 en lugar de col_2 para Multiregión:');
      const suma_con_col1 = coef_medicamentos + coef_vip + coef_emergencia_ext + factor_deducible_35000 + (qroRow.col_1 || 0);
      console.log(`   Nueva suma: ${suma_con_col1.toFixed(6)}`);
      if (Math.abs(0.616394 - suma_con_col1) < 0.001) {
        console.log('   ✅ ¡Esto resolvería el problema!');
      } else {
        console.log(`   ❌ Aún faltarían: ${(0.616394 - suma_con_col1).toFixed(6)}`);
      }
    }

    console.log('\n2. Verificar valores en el Excel original:');
    console.log('   - Celda AJ3: coef_medicamentos');
    console.log('   - Celda BI3: coef_vip');
    console.log('   - Celda AW3: coef_emergencia_ext');
    console.log('   - Rango AW15:AW23: factores deducible');
    console.log('   - Rango AQ42:AS74: factores multiregión');

    console.log('\n3. Re-subir el Excel de tarifas correctamente');
  } else {
    console.log('✅ Los factores coinciden con el Excel');
  }

  if (gastos_expedicion !== 300) {
    console.log(`\n❌ Gastos de expedición incorrectos: $${gastos_expedicion} (debería ser $300)`);
  } else {
    console.log('\n✅ Gastos de expedición correctos');
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
