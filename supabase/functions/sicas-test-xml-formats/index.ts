import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface XmlVariant {
  name: string;
  xml: string;
  description: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SICAS_USERNAME = Deno.env.get('SICAS_USERNAME') || '';
    const SICAS_PASSWORD = Deno.env.get('SICAS_PASSWORD') || '';
    const SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    // Variantes de XML para probar
    const xmlVariants: XmlVariant[] = [
      {
        name: "Variant 1: Original completo",
        description: "Estructura actual con todos los campos",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
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
</soap:Envelope>`
      },
      {
        name: "Variant 2: Sin campos vacíos",
        description: "Eliminando ConditionsAdd, FieldsRequeried e InfoSort vacíos",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>N</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
        <RegistroInicial>0</RegistroInicial>
        <RegistrosXBloque>10</RegistrosXBloque>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`
      },
      {
        name: "Variant 3: Con FILTROS explícito",
        description: "Agregando nodo FILTROS con filtros de fecha",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>N</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
        <FILTROS>
          <FECHAINICIAL>2024-01-01</FECHAINICIAL>
          <FECHAFINAL>2024-12-31</FECHAFINAL>
        </FILTROS>
        <RegistroInicial>0</RegistroInicial>
        <RegistrosXBloque>10</RegistrosXBloque>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`
      },
      {
        name: "Variant 4: Catálogo simple",
        description: "Probando con un catálogo (EsCatalogo=S)",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>S</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`
      },
      {
        name: "Variant 5: Minimalista",
        description: "Solo credenciales y nombre de proceso",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`
      },
      {
        name: "Variant 6: Con despacho y vendedor",
        description: "Agregando filtros de DESPACHO y VENDEDOR",
        xml: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <Credentials>
        <UserName>${escapeXml(SICAS_USERNAME)}</UserName>
        <Password>${escapeXml(SICAS_PASSWORD)}</Password>
      </Credentials>
      <Proceso>
        <NombreProceso>H03400</NombreProceso>
        <Reporte>H03400</Reporte>
        <EsCatalogo>N</EsCatalogo>
        <Company>01</Company>
        <Branch>01</Branch>
        <FILTROS>
          <DESPACHO>01</DESPACHO>
          <VENDEDOR>001</VENDEDOR>
          <FECHAINICIAL>2024-01-01</FECHAINICIAL>
          <FECHAFINAL>2024-12-31</FECHAFINAL>
        </FILTROS>
        <RegistroInicial>0</RegistroInicial>
        <RegistrosXBloque>10</RegistrosXBloque>
      </Proceso>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`
      }
    ];

    const results = [];

    for (let i = 0; i < xmlVariants.length; i++) {
      const variant = xmlVariants[i];
      console.log(`\n=== Testing ${variant.name} ===`);

      const startTime = Date.now();

      try {
        const response = await fetch(SICAS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/ProcesarWS',
          },
          body: variant.xml,
        });

        const responseTime = Date.now() - startTime;
        const responseText = await response.text();

        // Parse XML básico para extraer info
        const responseTxtMatch = responseText.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
        const responseNbrMatch = responseText.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/);
        const messageMatch = responseText.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

        const recordMatches = responseText.match(/<([A-Z0-9_]+)>/g);
        const recordCount = recordMatches ? new Set(recordMatches).size - 3 : 0; // -3 para PROCESSDATA, RESPONSETXT, etc

        results.push({
          name: variant.name,
          description: variant.description,
          success: response.ok,
          httpStatus: response.status,
          responseTime,
          responseTxt: responseTxtMatch ? responseTxtMatch[1] : 'N/A',
          responseNbr: responseNbrMatch ? responseNbrMatch[1] : 'N/A',
          message: messageMatch ? messageMatch[1] : 'N/A',
          recordCount,
          hasError: messageMatch && messageMatch[1].includes('Error'),
          errorType: messageMatch && messageMatch[1].includes('Variable de objeto') ? 'VB_OBJECT_ERROR' :
                     messageMatch && messageMatch[1].includes('Error') ? 'OTHER_ERROR' : 'NONE',
          rawResponse: responseText.substring(0, 1000), // Primeros 1000 caracteres
        });

        console.log(`✅ HTTP ${response.status} - ${responseTxtMatch ? responseTxtMatch[1] : 'N/A'}`);
        console.log(`   Message: ${messageMatch ? messageMatch[1].substring(0, 100) : 'N/A'}`);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        results.push({
          name: variant.name,
          description: variant.description,
          success: false,
          httpStatus: 0,
          responseTime,
          responseTxt: 'ERROR',
          responseNbr: '-1',
          message: error.message,
          recordCount: 0,
          hasError: true,
          errorType: 'FETCH_ERROR',
          rawResponse: error.message,
        });

        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Análisis de resultados
    const workingVariants = results.filter(r => r.success && !r.hasError);
    const partialSuccess = results.filter(r => r.success && r.hasError && r.errorType === 'VB_OBJECT_ERROR');
    const otherErrors = results.filter(r => r.success && r.hasError && r.errorType === 'OTHER_ERROR');
    const fetchErrors = results.filter(r => !r.success);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: xmlVariants.length,
        working: workingVariants.length,
        partialSuccess: partialSuccess.length,
        otherErrors: otherErrors.length,
        fetchErrors: fetchErrors.length,
      },
      recommendation: workingVariants.length > 0
        ? `✅ Usar: ${workingVariants[0].name}`
        : partialSuccess.length === xmlVariants.length
          ? '⚠️ Todas las variantes dan el mismo error VB. El problema puede ser: 1) El proceso H03400 no existe, 2) Faltan permisos, 3) El formato general es correcto pero falta algún dato específico del proceso.'
          : '❌ Ninguna variante funcionó',
      results,
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error general:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
