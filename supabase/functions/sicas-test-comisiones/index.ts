import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const diagnostic: any = {
      step: 'START',
      timestamp: new Date().toISOString(),
    };

    diagnostic.step = 'ENV_CHECK';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Variables de entorno faltantes',
          diagnostic,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    diagnostic.step = 'SUPABASE_INIT';
    diagnostic.supabase_url = supabaseUrl;
    const supabase = createClient(supabaseUrl, supabaseKey);

    diagnostic.step = 'CONFIG_FETCH';
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError) {
      diagnostic.config_error = configError;
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Error obteniendo configuración SICAS',
          config_error: configError,
          diagnostic,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No hay configuración SICAS',
          diagnostic,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    diagnostic.step = 'CONFIG_LOADED';
    diagnostic.has_endpoint = !!config.endpoint;
    diagnostic.has_usuario = !!config.sicas_usuario;
    diagnostic.has_password = !!config.sicas_password;

    const sicasUrl = config.endpoint || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario;
    const sicasPassword = config.sicas_password;

    if (!sicasUsuario || !sicasPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuración SICAS incompleta (falta usuario o password)',
          diagnostic,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    diagnostic.step = 'BUILD_REQUEST';
    const reportCode = 'H03492_ALL';
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    const conditionsAdd = `DatDocumentos.FEmision|>=|${dateFrom}|AND|DatDocumentos.FEmision|<=|${dateTo}`;

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
        <ItemForPage>10</ItemForPage>
        <InfoSort>DatDocumentos.Documento DESC</InfoSort>
        <ConditionsAdd>${conditionsAdd}</ConditionsAdd>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${sicasUsuario}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    diagnostic.step = 'SICAS_REQUEST';
    diagnostic.sicas_url = sicasUrl;
    diagnostic.report_code = reportCode;
    diagnostic.date_from = dateFrom;
    diagnostic.date_to = dateTo;

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
      diagnostic.step = 'FETCH_ERROR';
      diagnostic.fetch_error = fetchError.message;

      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
        diagnostic.trying_http = true;
        const httpEndpoint = sicasUrl.replace('https://', 'http://');
        diagnostic.http_endpoint = httpEndpoint;

        try {
          response = await fetch(httpEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': 'http://tempuri.org/ProcesarWS',
            },
            body: soapEnvelope,
          });
        } catch (httpError: any) {
          diagnostic.http_error = httpError.message;
          return new Response(
            JSON.stringify({
              success: false,
              error: `Error en request a SICAS: ${httpError.message}`,
              diagnostic,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Error en request a SICAS: ${fetchError.message}`,
            diagnostic,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    diagnostic.step = 'RESPONSE_RECEIVED';
    diagnostic.http_status = response.status;
    diagnostic.http_status_text = response.statusText;

    const responseText = await response.text();
    diagnostic.response_length = responseText.length;
    diagnostic.response_preview = responseText.substring(0, 500);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          diagnostic,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    diagnostic.step = 'PARSE_XML';
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se encontró ProcesarWSResult en la respuesta',
          diagnostic,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resultContent = resultMatch[1];
    diagnostic.result_length = resultContent.length;
    diagnostic.result_preview = resultContent.substring(0, 500);

    const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
    const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
    const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

    diagnostic.sicas_response = {
      responsenbr: responseNbrMatch?.[1] || 'N/A',
      responsetxt: responseTxtMatch?.[1] || 'N/A',
      message: messageMatch?.[1] || 'N/A',
    };

    const docRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
    const matches = resultContent.match(docRegex);
    diagnostic.records_found = matches?.length || 0;

    if (matches && matches.length > 0) {
      diagnostic.first_record_sample = matches[0].substring(0, 500);
    }

    diagnostic.step = 'SUCCESS';

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Prueba completada exitosamente',
        records_found: diagnostic.records_found,
        diagnostic,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[Test] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        stack: error.stack?.substring(0, 1000),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
