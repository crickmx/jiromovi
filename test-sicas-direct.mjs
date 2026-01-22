/**
 * Test directo de SICAS - Conexión y Catálogos
 *
 * Este script prueba:
 * 1. Autenticación con el webservice SICAS
 * 2. Consulta de catálogos específicos
 *
 * Ejecutar: node test-sicas-direct.mjs
 */

import 'dotenv/config';

// Credenciales SICAS (deben estar en .env o en variables de entorno de Supabase)
const SICAS_USERNAME = process.env.SICAS_USERNAME;
const SICAS_PASSWORD = process.env.SICAS_PASSWORD;
const SICAS_ENDPOINT = process.env.SICAS_ENDPOINT || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

console.log('🔌 Test de Conexión SICAS');
console.log('═══════════════════════════════════════');
console.log(`📡 Endpoint: ${SICAS_ENDPOINT}`);
console.log(`👤 Usuario: ${SICAS_USERNAME || '(NO CONFIGURADO)'}`);
console.log(`🔑 Password: ${SICAS_PASSWORD ? '***' : '(NO CONFIGURADO)'}`);
console.log('');

if (!SICAS_USERNAME || !SICAS_PASSWORD) {
  console.error('❌ ERROR: Las credenciales SICAS no están configuradas');
  console.error('');
  console.error('Configura las siguientes variables de entorno:');
  console.error('  - SICAS_USERNAME');
  console.error('  - SICAS_PASSWORD');
  console.error('  - SICAS_ENDPOINT (opcional)');
  console.error('');
  process.exit(1);
}

// Función para probar autenticación
async function testAuthentication() {
  console.log('1️⃣  Probando Autenticación...');
  console.log('───────────────────────────────────────');

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <AutentificarWS xmlns="http://tempuri.org/">
      <wsAuthConfig>
        <UserName>${SICAS_USERNAME}</UserName>
        <Password>${SICAS_PASSWORD}</Password>
      </wsAuthConfig>
    </AutentificarWS>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(SICAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/AutentificarWS',
      },
      body: soapEnvelope,
    });

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📏 Response Length: ${responseText.length} bytes`);

    // Verificar si hay error SOAP
    const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
    if (faultMatch) {
      console.error(`❌ SOAP Fault: ${faultMatch[1]}`);
      return false;
    }

    // Extraer resultado
    const authResultMatch = responseText.match(/<AutentificarWSResult>(.*?)<\/AutentificarWSResult>/is);
    if (!authResultMatch) {
      console.error('❌ No se encontró AutentificarWSResult en la respuesta');
      console.log('\n📄 Response Preview:');
      console.log(responseText.substring(0, 500));
      return false;
    }

    let authResult = authResultMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    const responseMatch = authResult.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
    const messageMatch = authResult.match(/<MESSAGE>(.*?)<\/MESSAGE>/i);

    const responseTxt = responseMatch ? responseMatch[1].toUpperCase() : 'N/A';
    const message = messageMatch ? messageMatch[1] : 'Sin mensaje';

    console.log(`📝 RESPONSETXT: ${responseTxt}`);
    console.log(`💬 MESSAGE: ${message}`);

    if (responseTxt === 'SUCESS' || responseTxt === 'SUCCESS' || responseTxt === 'OK') {
      console.log('✅ AUTENTICACIÓN EXITOSA');

      // Nota: SICAS puede devolver mensajes de error internos incluso cuando la autenticación es exitosa
      if (message.toLowerCase().includes('error') || message.toLowerCase().includes('proceso interno')) {
        console.log('⚠️  Nota: El servidor reporta un mensaje informativo:');
        console.log(`    "${message}"`);
        console.log('    Esto es normal y no afecta la conectividad.');
      }

      return true;
    } else {
      console.error(`❌ AUTENTICACIÓN FALLIDA: ${responseTxt}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
    return false;
  }
}

// Función para probar un catálogo
async function testCatalog(catalogId, catalogName) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyUserName>${SICAS_USERNAME}</PropertyUserName>
        <PropertyPassword>${SICAS_PASSWORD}</PropertyPassword>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>${catalogId}</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${SICAS_USERNAME}</UserName>
        <Password>${SICAS_PASSWORD}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(SICAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const responseText = await response.text();

    // Verificar errores SOAP
    const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
    if (faultMatch) {
      return { success: false, error: `SOAP Fault: ${faultMatch[1]}` };
    }

    // Extraer resultado
    const resultMatch = responseText.match(/<ReadInfoDataResult>(.*?)<\/ReadInfoDataResult>/is);
    if (!resultMatch) {
      return { success: false, error: 'No se encontró ReadInfoDataResult' };
    }

    let result = resultMatch[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');

    // Verificar RESPONSETXT
    const responseMatch = result.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i);
    const responseNbrMatch = result.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/i);
    const messageMatch = result.match(/<MESSAGE>(.*?)<\/MESSAGE>/i);

    const responseTxt = responseMatch ? responseMatch[1].toUpperCase() : 'N/A';
    const responseNbr = responseNbrMatch ? responseNbrMatch[1] : '0';
    const message = messageMatch ? messageMatch[1] : '';

    if (responseTxt === 'SUCESS' || responseTxt === 'SUCCESS') {
      if (responseNbr === '0') {
        return {
          success: true,
          available: false,
          records: 0,
          message: 'Catálogo no disponible en tu plan SICAS',
        };
      }

      // Contar registros (rows)
      const rowMatches = result.match(/<ROW>/g);
      const recordCount = rowMatches ? rowMatches.length : 0;

      return {
        success: true,
        available: true,
        records: recordCount,
        responseNbr: parseInt(responseNbr),
      };
    } else {
      return {
        success: false,
        error: `${responseTxt}: ${message}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Función principal
async function main() {
  // Paso 1: Autenticación
  const authSuccess = await testAuthentication();
  console.log('');

  if (!authSuccess) {
    console.error('❌ La autenticación falló. No se pueden probar los catálogos.');
    process.exit(1);
  }

  // Paso 2: Probar catálogos críticos
  console.log('2️⃣  Probando Catálogos Críticos...');
  console.log('───────────────────────────────────────');

  const criticalCatalogs = [
    { id: 11, name: 'Despachos' },
    { id: 15, name: 'Agentes' },
    { id: 32, name: 'Vendedores' },
    { id: 34, name: 'Oficinas' },
    { id: 12, name: 'Aseguradoras' },
    { id: 9, name: 'Ramos' },
  ];

  const results = [];

  for (const catalog of criticalCatalogs) {
    process.stdout.write(`   Probando ${catalog.name} (ID ${catalog.id})... `);

    const result = await testCatalog(catalog.id, catalog.name);

    if (result.success) {
      if (result.available) {
        console.log(`✅ ${result.records} registros`);
        results.push({ ...catalog, status: 'available', records: result.records });
      } else {
        console.log(`⚠️  No disponible`);
        results.push({ ...catalog, status: 'not_available', records: 0 });
      }
    } else {
      console.log(`❌ ${result.error}`);
      results.push({ ...catalog, status: 'error', error: result.error });
    }

    // Delay entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('');
  console.log('📊 Resumen de Resultados');
  console.log('═══════════════════════════════════════');

  const available = results.filter(r => r.status === 'available');
  const notAvailable = results.filter(r => r.status === 'not_available');
  const errors = results.filter(r => r.status === 'error');

  console.log(`✅ Catálogos disponibles: ${available.length}`);
  available.forEach(cat => {
    console.log(`   - ${cat.name}: ${cat.records} registros`);
  });

  if (notAvailable.length > 0) {
    console.log(`\n⚠️  Catálogos no disponibles: ${notAvailable.length}`);
    notAvailable.forEach(cat => {
      console.log(`   - ${cat.name}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ Catálogos con error: ${errors.length}`);
    errors.forEach(cat => {
      console.log(`   - ${cat.name}: ${cat.error}`);
    });
  }

  console.log('');
  console.log('✅ Verificación completa');
}

// Ejecutar
main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
