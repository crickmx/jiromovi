import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

/**
 * Función de prueba simple para SICAS
 * Ejecuta el reporte sin filtros para diagnosticar problemas
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener configuración SICAS
    const { data: config } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuración SICAS no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sicasUrl = config.endpoint || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario;
    const sicasPassword = config.sicas_password;

    if (!sicasUsuario || !sicasPassword) {
      return new Response(
        JSON.stringify({
          error: "Configuración SICAS incompleta. Configure las credenciales en Admin > SICAS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parámetros de prueba - mínimos para diagnóstico
    const body = await req.json().catch(() => ({}));
    const reportCode = body.reportCode || 'H03117';
    const page = body.page || 1;
    const itemsPerPage = body.itemsPerPage || 1;

    console.log(`[SICAS-Test] Prueba simple - Reporte: ${reportCode}, Página: ${page}, Items: ${itemsPerPage}`);

    // SOAP sin filtros complejos
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>${reportCode}</KeyCode>
        <Page>${page}</Page>
        <ItemForPage>${itemsPerPage}</ItemForPage>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${sicasUsuario}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    const startTime = Date.now();

    let response;
    try {
      response = await fetch(sicasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://tempuri.org/ProcesarWS',
        },
        body: soapEnvelope,
      });
    } catch (fetchError: any) {
      // Si hay error SSL, intentar con HTTP
      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
        console.warn(`[SICAS-Test] Error SSL, intentando con HTTP...`);
        const httpEndpoint = sicasUrl.replace('https://', 'http://');

        response = await fetch(httpEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://tempuri.org/ProcesarWS',
          },
          body: soapEnvelope,
        });
      } else {
        throw fetchError;
      }
    }

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    // Decodificar entidades HTML
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Extraer el contenido del resultado
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo extraer ProcesarWSResult del response',
          raw_response: responseText.substring(0, 1000),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultContent = resultMatch[1];

    // Extraer detalles de SICAS
    const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
    const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
    const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

    const sicasDetails = {
      responsenbr: responseNbrMatch?.[1] || 'N/A',
      responsetxt: responseTxtMatch?.[1] || 'N/A',
      message: messageMatch?.[1] || 'N/A',
    };

    console.log(`[SICAS-Test] RESPONSENBR: ${sicasDetails.responsenbr}`);
    console.log(`[SICAS-Test] RESPONSETXT: ${sicasDetails.responsetxt}`);
    console.log(`[SICAS-Test] MESSAGE: ${sicasDetails.message}`);

    // Contar registros
    const docRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
    const matches = resultContent.match(docRegex);
    const recordCount = matches ? matches.length : 0;

    // Determinar si es un error interno
    const hasInternalError =
      sicasDetails.message?.includes('Error en Ejecución') ||
      sicasDetails.message?.includes('Proceso Interno') ||
      sicasDetails.message?.includes('Variable de objeto') ||
      sicasDetails.message?.includes('SICASOnline');

    // Guardar en log
    await supabase
      .from('sicas_production_sync_log')
      .insert({
        sync_type: 'test_simple',
        status: hasInternalError ? 'failed' : recordCount > 0 ? 'success' : 'no_data',
        records_fetched: recordCount,
        records_inserted: 0,
        records_updated: 0,
        records_errors: hasInternalError ? 1 : 0,
        error_message: hasInternalError ? sicasDetails.message : null,
        started_at: new Date(Date.now() - duration).toISOString(),
        completed_at: new Date().toISOString(),
        metadata: {
          test_type: 'simple_without_filters',
          report_code: reportCode,
          page,
          itemsPerPage,
          duration_ms: duration,
          ...sicasDetails,
        },
      });

    return new Response(
      JSON.stringify({
        success: !hasInternalError,
        test_type: 'simple_without_filters',
        report_code: reportCode,
        sicas_response: sicasDetails,
        records_found: recordCount,
        duration_ms: duration,
        http_status: response.status,
        diagnosis: {
          has_internal_error: hasInternalError,
          is_access_denied: sicasDetails.responsetxt === 'DENIED',
          has_data: recordCount > 0,
          recommendation: hasInternalError
            ? 'El reporte tiene un error interno en SICAS. Contacta al proveedor con el código de reporte y mensaje de error.'
            : recordCount === 0
            ? 'El reporte no devolvió datos. Verifica que existan registros en SICAS o prueba con otro código de reporte.'
            : 'El reporte funciona correctamente.',
        },
        raw_preview: resultContent.substring(0, 2000),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[SICAS-Test] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
