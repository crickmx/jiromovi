import { readFileSync } from 'fs';

// Leer variables de entorno desde .env
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

const CATALOGS_TO_TEST = [
  { id: 1, name: 'Estados' },
  { id: 2, name: 'Municipios' },
  { id: 7, name: 'Bancos' },
  { id: 8, name: 'Formas de Pago' },
  { id: 9, name: 'Ramos' },
  { id: 10, name: 'SubRamos' },
  { id: 11, name: 'Despachos' },
  { id: 12, name: 'Aseguradoras' },
  { id: 15, name: 'Agentes' },
  { id: 32, name: 'Vendedores' },
  { id: 34, name: 'Oficinas' },
];

async function testCatalog(catalogId, catalogName) {
  console.log(`\n🔍 Probando catálogo ${catalogId}: ${catalogName}...`);

  const startTime = Date.now();

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sicas-test-catalog`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ catalog_id: catalogId }),
      }
    );

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (data.available) {
      console.log(`✅ DISPONIBLE - ${data.stats?.records || 0} registros (${(duration/1000).toFixed(2)}s)`);
      if (data.sample_records?.length > 0) {
        console.log(`   📝 Ejemplo: ${JSON.stringify(data.sample_records[0]).substring(0, 100)}...`);
      }
    } else if (data.catalog_status === 'not_available') {
      console.log(`⚠️  NO DISPONIBLE (${(duration/1000).toFixed(2)}s)`);
      console.log(`   📋 Mensaje: ${data.warning || data.error || 'Sin datos'}`);
    } else {
      console.log(`❌ ERROR (${(duration/1000).toFixed(2)}s)`);
      console.log(`   ⚠️  ${data.error}`);
    }

    return {
      catalog_id: catalogId,
      catalog_name: catalogName,
      available: data.available,
      records: data.stats?.records || 0,
      duration,
      status: data.catalog_status,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ERROR DE CONEXIÓN (${(duration/1000).toFixed(2)}s)`);
    console.log(`   ⚠️  ${error.message}`);

    return {
      catalog_id: catalogId,
      catalog_name: catalogName,
      available: false,
      error: error.message,
      duration,
      status: 'error',
    };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('SICAS - Prueba de Catálogos Prioritarios');
  console.log('='.repeat(60));

  const results = [];

  for (const catalog of CATALOGS_TO_TEST) {
    const result = await testCatalog(catalog.id, catalog.name);
    results.push(result);

    // Esperar 1 segundo entre pruebas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN DE RESULTADOS');
  console.log('='.repeat(60));

  const available = results.filter(r => r.available);
  const notAvailable = results.filter(r => r.status === 'not_available');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n📊 Total probados: ${results.length}`);
  console.log(`✅ Disponibles: ${available.length}`);
  console.log(`⚠️  No disponibles: ${notAvailable.length}`);
  console.log(`❌ Errores: ${errors.length}`);

  if (available.length > 0) {
    console.log('\n✅ CATÁLOGOS DISPONIBLES:');
    available.forEach(r => {
      console.log(`   ${r.catalog_id}. ${r.catalog_name} - ${r.records} registros`);
    });
  }

  if (notAvailable.length > 0) {
    console.log('\n⚠️  CATÁLOGOS NO DISPONIBLES:');
    notAvailable.forEach(r => {
      console.log(`   ${r.catalog_id}. ${r.catalog_name}`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ CATÁLOGOS CON ERROR:');
    errors.forEach(r => {
      console.log(`   ${r.catalog_id}. ${r.catalog_name} - ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Prueba completada');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);
