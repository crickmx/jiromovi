import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

interface ReportTestResult {
  reportCode: string;
  status: 'success' | 'error' | 'no_data';
  message: string;
  recordCount?: number;
  responseNbr?: string;
  responseTxt?: string;
  duration?: number;
}

async function testSingleReport(
  sicasUrl: string,
  sicasUsuario: string,
  sicasPassword: string,
  reportCode: string,
  vendedorId?: string
): Promise<ReportTestResult> {
  const startTime = Date.now();

  try {
    // Construir filtros opcionales
    const filterSection = vendedorId ? `<VendID>${vendedorId}</VendID>` : '';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>${reportCode}</KeyCode>
        <Page>1</Page>
        <ItemForPage>5</ItemForPage>
        ${filterSection}
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${sicasUsuario}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(sicasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapEnvelope,
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      return {
        reportCode,
        status: 'error',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration,
      };
    }

    const responseText = await response.text();

    // HTML decode
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Extraer ProcesarWSResult
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      return {
        reportCode,
        status: 'error',
        message: 'No se encontró ProcesarWSResult en el response',
        duration,
      };
    }

    const resultContent = resultMatch[1];

    // Extraer metadatos
    const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
    const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
    const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

    const sicasRaw = {
      responseNbr: responseNbrMatch?.[1] || 'N/A',
      responseTxt: responseTxtMatch?.[1] || 'N/A',
      message: messageMatch?.[1] || 'N/A',
    };

    // Verificar errores internos
    const hasInternalError =
      sicasRaw.message.includes('Error en Ejecución') ||
      sicasRaw.message.includes('Proceso Interno') ||
      sicasRaw.message.includes('Variable de objeto') ||
      sicasRaw.message.toLowerCase().includes('error');

    if (hasInternalError) {
      return {
        reportCode,
        status: 'error',
        message: sicasRaw.message,
        responseNbr: sicasRaw.responseNbr,
        responseTxt: sicasRaw.responseTxt,
        duration,
      };
    }

    // Contar registros
    const recordRegex = /<DatDocumentos>[\s\S]*?<\/DatDocumentos>/g;
    const records = resultContent.match(recordRegex);
    const recordCount = records ? records.length : 0;

    return {
      reportCode,
      status: recordCount > 0 ? 'success' : 'no_data',
      message: recordCount > 0 ? `✅ ${recordCount} registros encontrados` : '⚠️ Sin datos (pero el reporte funciona)',
      recordCount,
      responseNbr: sicasRaw.responseNbr,
      responseTxt: sicasRaw.responseTxt,
      duration,
    };

  } catch (error: any) {
    return {
      reportCode,
      status: 'error',
      message: error.message || 'Error desconocido',
      duration: Date.now() - startTime,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('[SICAS Test SOAP] Iniciando prueba de reportes...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leer parámetros opcionales
    const body = await req.json().catch(() => ({}));
    const vendedorId = body.vendedorId; // Opcional: filtrar por vendedor
    const customCodes = body.reportCodes; // Opcional: códigos personalizados

    // Obtener configuración SICAS
    const { data: config } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (!config || !config.sicas_usuario || !config.sicas_password) {
      throw new Error('Configuración SICAS no encontrada o incompleta');
    }

    const sicasUrl = config.endpoint || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario;
    const sicasPassword = config.sicas_password;

    // Reportes a probar (códigos oficiales del manual)
    const reportCodesToTest = customCodes || [
      // Producción / Pólizas
      'H03117',          // Pólizas Vigentes
      'H03117_001',
      'H03117_ALL',

      // Comisiones
      'H03492_ALL',      // Comisiones Pendientes
      'H03492',
      'H03797',          // Comisiones Pagadas
      'H03797_001',

      // Cobranza
      'HAPPDATAL_D004',  // Cobranza Pendiente
      'H03120_001',      // Cobranza Pagada
      'H03846_Cob',      // Toda la Cobranza

      // Otros reportes comunes
      'H05106',          // Pólizas (alternativo)
      'H05107',
      'H05105',
    ];

    console.log(`[SICAS Test SOAP] Probando ${reportCodesToTest.length} códigos...`);

    // Probar todos los reportes secuencialmente (para no sobrecargar SICAS)
    const results: ReportTestResult[] = [];

    for (const reportCode of reportCodesToTest) {
      console.log(`[SICAS Test SOAP] Probando ${reportCode}...`);
      const result = await testSingleReport(
        sicasUrl,
        sicasUsuario,
        sicasPassword,
        reportCode,
        vendedorId
      );
      results.push(result);

      // Log resultado
      const statusIcon = result.status === 'success' ? '✅' : result.status === 'no_data' ? '⚠️' : '❌';
      console.log(`[SICAS Test SOAP] ${statusIcon} ${reportCode}: ${result.message} (${result.duration}ms)`);
    }

    // Resumen
    const successful = results.filter(r => r.status === 'success');
    const noData = results.filter(r => r.status === 'no_data');
    const errors = results.filter(r => r.status === 'error');

    console.log(`[SICAS Test SOAP] Resumen:`);
    console.log(`  - Con datos: ${successful.length}`);
    console.log(`  - Sin datos: ${noData.length}`);
    console.log(`  - Errores: ${errors.length}`);

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          total_tested: reportCodesToTest.length,
          with_data: successful.length,
          no_data: noData.length,
          errors: errors.length,
        },
        results,
        recommendations: successful.map(r => r.reportCode),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[SICAS Test SOAP] Error:', error);

    return new Response(
      JSON.stringify({
        ok: false,
        message: error.message || 'Error desconocido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
