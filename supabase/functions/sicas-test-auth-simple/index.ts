import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TestConfig {
  endpoint: string;
  username: string;
  password: string;
  description: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SICAS_USERNAME = Deno.env.get('SICAS_USERNAME') || '';
    const SICAS_PASSWORD = Deno.env.get('SICAS_PASSWORD') || '';

    // Configuraciones de prueba
    const tests: TestConfig[] = [
      {
        endpoint: 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx',
        username: SICAS_USERNAME,
        password: SICAS_PASSWORD,
        description: 'Endpoint .com con password original'
      },
      {
        endpoint: 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx',
        username: SICAS_USERNAME,
        password: SICAS_PASSWORD,
        description: 'Endpoint .com.mx con password original'
      },
      {
        endpoint: 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx',
        username: SICAS_USERNAME,
        password: decodeURIComponent(SICAS_PASSWORD), // Decodifica %20 -> espacio
        description: 'Endpoint .com con password decodificado (URL decoded)'
      },
      {
        endpoint: 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx',
        username: SICAS_USERNAME,
        password: decodeURIComponent(SICAS_PASSWORD),
        description: 'Endpoint .com.mx con password decodificado (URL decoded)'
      },
    ];

    const results = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`\n=== Test ${i + 1}/${tests.length}: ${test.description} ===`);

      const startTime = Date.now();

      // Construir SOAP request simple de autenticación
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(test.username)}</UserName>
        <Password>${escapeXml(test.password)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>N</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
        <ConditionsAdd></ConditionsAdd>
        <FieldsRequeried></FieldsRequeried>
        <InfoSort></InfoSort>
        <RegistroInicial>0</RegistroInicial>
        <RegistrosXBloque>10</RegistrosXBloque>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

      try {
        const response = await fetch(test.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/ProcesarWS',
          },
          body: soapBody,
        });

        const responseTime = Date.now() - startTime;
        const responseText = await response.text();

        // Decodificar HTML entities
        const decoded = responseText
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");

        // Extraer resultado
        const resultMatch = decoded.match(/<ProcesarWSResult>(.*?)<\/ProcesarWSResult>/is);
        const xmlContent = resultMatch ? resultMatch[1] : '';

        // Buscar DATAINFO (error)
        const dataInfoMatch = xmlContent.match(/<DATAINFO>(.*?)<\/DATAINFO>/is);
        const isDataInfo = !!dataInfoMatch;

        let errorMsg = '';
        let success = '1';

        if (dataInfoMatch) {
          const dataInfoContent = dataInfoMatch[1];
          errorMsg = dataInfoContent.match(/<MsgError>(.*?)<\/MsgError>/i)?.[1] || '';
          success = dataInfoContent.match(/<Sucess>(.*?)<\/Sucess>/i)?.[1] || '0';
        }

        // Contar registros reales (no DATAINFO)
        const recordMatches = xmlContent.match(/<(?!DATAINFO|PROCESSDATA)[A-Z][a-zA-Z0-9_]+>/g);
        const recordCount = recordMatches ? recordMatches.length : 0;

        results.push({
          testNumber: i + 1,
          description: test.description,
          endpoint: test.endpoint,
          usernameUsed: test.username,
          passwordFormat: test.password === SICAS_PASSWORD ? 'original' : 'url-decoded',
          passwordPreview: test.password.substring(0, 10) + '...',
          httpStatus: response.status,
          responseTime: `${responseTime}ms`,
          isAuthError: isDataInfo && errorMsg.includes('Usuario o Contraseña'),
          errorMessage: errorMsg || 'Sin error',
          recordCount,
          success: success === '1',
          tlsError: false,
          rawResponsePreview: decoded.substring(0, 1000),
        });

      } catch (error: unknown) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

        results.push({
          testNumber: i + 1,
          description: test.description,
          endpoint: test.endpoint,
          usernameUsed: test.username,
          passwordFormat: test.password === SICAS_PASSWORD ? 'original' : 'url-decoded',
          passwordPreview: test.password.substring(0, 10) + '...',
          httpStatus: 0,
          responseTime: `${responseTime}ms`,
          isAuthError: false,
          errorMessage: errorMessage,
          recordCount: 0,
          success: false,
          tlsError: errorMessage.includes('certificate') || errorMessage.includes('TLS'),
          rawResponsePreview: errorMessage,
        });
      }
    }

    // Análisis final
    const successfulTests = results.filter(r => r.success && r.recordCount > 0);
    const authErrors = results.filter(r => r.isAuthError);
    const tlsErrors = results.filter(r => r.tlsError);

    const summary = {
      totalTests: tests.length,
      successful: successfulTests.length,
      authenticationErrors: authErrors.length,
      tlsErrors: tlsErrors.length,
      recommendation: successfulTests.length > 0
        ? `✅ Usar: ${successfulTests[0].endpoint} con password ${successfulTests[0].passwordFormat}`
        : authErrors.length > 0
        ? '🔐 Revisar credenciales (usuario/password incorrectos)'
        : tlsErrors.length > 0
        ? '🔒 Problema de certificado TLS en ambos endpoints'
        : '❌ Todos los tests fallaron - revisar conectividad'
    };

    return new Response(JSON.stringify({
      summary,
      results,
      credentials: {
        username: SICAS_USERNAME,
        passwordOriginal: SICAS_PASSWORD.substring(0, 15) + '...',
        passwordDecoded: decodeURIComponent(SICAS_PASSWORD).substring(0, 15) + '...',
      }
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error general:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
