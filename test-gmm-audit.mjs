/**
 * PRUEBA DE COTIZACIÓN GMM BX+ - RICARDO CASTRO GOMEZ
 * Compara resultado del sistema vs valores del PDF/Excel
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jdvwabcamdbwsuyemzlb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdndhYmNhbWRid3N1eWVtemxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk1NTQ2NTQsImV4cCI6MjA0NTEzMDY1NH0.3E7RbfOJ6mEGI0bXVTvPkfA-TXuYh94YqF5zHFtbKhA';
const supabase = createClient(supabaseUrl, supabaseKey);

const EXPECTED = {
  asegurados: [
    { nombre: 'RICARDO CASTRO GOMEZ', edad: 40, sexo: 'Hombre', prima_base: 11509.57, prima_adicionales: 7094.43, prima_total: 18604.00 },
    { nombre: 'JULIANA CEBALLOS GONZALEZ', edad: 39, sexo: 'Mujer', prima_base: 14595.59, prima_adicionales: 8996.64, prima_total: 23592.23 },
    { nombre: 'EMMA CASTRO CEBALLOS', edad: 1, sexo: 'Mujer', prima_base: 6043.98, prima_adicionales: 3725.47, prima_total: 9769.45 }
  ],
  totales: { prima_neta_total: 51965.69, gastos_expedicion: 900.00, subtotal: 52865.69, iva: 8458.51, total: 61324.20 }
};

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  PRUEBA GMM BX+ - CASO: RICARDO CASTRO GOMEZ                 ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('📦 Verificando tarifas activas...');
const { data: packages, error: pkgError } = await supabase.from('tariff_packages').select('id, name, status, created_at').order('created_at', { ascending: false });

if (pkgError) { console.error('❌ Error:', pkgError.message); process.exit(1); }
if (!packages || packages.length === 0) { console.error('❌ No hay tarifas cargadas'); process.exit(1); }

console.log(`\n✅ Tarifas encontradas: ${packages.length}`);
packages.forEach((pkg, i) => {
  console.log(`   ${i + 1}. ${pkg.status === 'active' ? '🟢 ACTIVA' : '⚪ Inactiva'} - ${pkg.name}`);
});

const activePkg = packages.find(p => p.status === 'active');
if (!activePkg) { console.error('\n❌ No hay ninguna tarifa ACTIVA'); process.exit(1); }

console.log(`\n✅ Tarifa activa: ${activePkg.name}`);
console.log('\n📊 Cargando tablas...');

const { data: tables, error: tablesError } = await supabase.from('tariff_tables').select('*').eq('package_id', activePkg.id);
if (tablesError || !tables || tables.length === 0) { console.error('❌ Error al cargar tablas'); process.exit(1); }

console.log(`✅ ${tables.length} tablas cargadas`);

const tariffTables = {};
tables.forEach(t => { tariffTables[t.table_name] = t.table_data; });

console.log('\n🔍 Verificando tablas críticas...');
['base_age_gender', 'estados', 'nivel_hospitalario', 'tabulador', 'suma_asegurada', 'deducible', 'coaseguro', 'tops_coaseguro'].forEach(name => {
  console.log(`   ${tariffTables[name] ? '✅' : '❌'} ${name}`);
});

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 VALORES ESPERADOS DEL PDF');
console.log('═══════════════════════════════════════════════════════════════\n');

EXPECTED.asegurados.forEach((a, i) => {
  console.log(`${i + 1}. ${a.nombre} (${a.edad} años, ${a.sexo})`);
  console.log(`   Prima Base:    $${a.prima_base.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(`   Adicionales:   $${a.prima_adicionales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log(`   Total:         $${a.prima_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n`);
});

console.log('TOTALES:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Prima Neta Total:     $${EXPECTED.totales.prima_neta_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
console.log(`Gastos Expedición:    $${EXPECTED.totales.gastos_expedicion.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
console.log(`Subtotal:             $${EXPECTED.totales.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
console.log(`IVA (16%):            $${EXPECTED.totales.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
console.log('─────────────────────────────────────────────────────────────');
console.log(`TOTAL A PAGAR:        $${EXPECTED.totales.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);

console.log('\n\n🎯 EJECUTAR PRUEBA EN EL FRONTEND:\n');
console.log('1. Ve a "GMM BX+ Cotizador"');
console.log('2. Estado: QUERETARO | Nivel: PLUS | Tabulador: ORO-110,000');
console.log('3. SA: 50M | Ded: 35k | Coaseg: 15% | Tope: 60k');
console.log('4. Agrega: Ricardo (40,H), Juliana (39,M), Emma (1,M)');
console.log('5. Coberturas: Med.Fuera, Elim.Ded, Multiregion, VIP, Emerg.Ext, Recon.Ant');
console.log('6. Forma de Pago: ANUAL');
console.log('7. Calcular y comparar\n');
