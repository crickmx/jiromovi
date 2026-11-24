import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

interface SicasDocument {
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  cliente: string | null;
  fecha_captura: string | null;
  fecha_emision: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  importe: number | null;
  prima_neta: number | null;
}

/**
 * Consulta el reporte de documentos H03117 desde SICAS usando SOAP
 */
async function consultarDocumentosSICAS(
  endpoint: string,
  username: string,
  password: string,
  page: number = 1,
  itemsPerPage: number = 100
): Promise<{
  documentos: SicasDocument[];
  sicasDetails: any;
  diagnostic: any;
}> {
  console.log(`[SICAS Documents] Consultando documentos - Página ${page}`);

  const reportCode = 'H03117';
  const infoSort = 'DatDocumentos.FCaptura DESC';

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
        <InfoSort>${infoSort}</InfoSort>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${username}</UserName>
        <Password>${password}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

  let response;
  let responseText: string = '';

  try {
    console.log(`[SICAS Documents] Enviando request SOAP a: ${endpoint}`);

    response = await fetch(endpoint, {
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
      console.warn(`[SICAS Documents] Error SSL en página ${page}, intentando con HTTP...`);
      const httpEndpoint = endpoint.replace('https://', 'http://');

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
        console.error('[SICAS Documents] Error en fallback HTTP:', httpError);
        throw new Error(`Error de conexión: ${httpError.message}`);
      }
    } else {
      console.error('[SICAS Documents] Error en fetch:', fetchError);
      throw new Error(`Error de conexión: ${fetchError.message}`);
    }
  }

  console.log(`[SICAS Documents] HTTP Status: ${response.status} ${response.statusText}`);

  try {
    responseText = await response.text();
    console.log(`[SICAS Documents] Response length: ${responseText.length} bytes`);
  } catch (textError: any) {
    console.error('[SICAS Documents] Error leyendo response body:', textError);
    throw new Error('No se pudo leer la respuesta del servidor');
  }

  if (!response.ok) {
    console.error(`[SICAS Documents] HTTP Error ${response.status}: ${response.statusText}`);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Decodificar entidades HTML
  let decoded: string;
  let resultContent: string;

  try {
    decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      console.error('[SICAS Documents] No se encontró ProcesarWSResult en el response');
      throw new Error('Respuesta SOAP inválida');
    }

    resultContent = resultMatch[1];
    console.log(`[SICAS Documents] Resultado extraído: ${resultContent.length} bytes`);
  } catch (parseError: any) {
    console.error('[SICAS Documents] Error en decode/parse inicial:', parseError);
    throw new Error(`Error parseando respuesta: ${parseError.message}`);
  }

  // Verificar estado del proceso
  const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
  const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
  const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

  const sicasDetails = {
    responsenbr: responseNbrMatch?.[1] || 'N/A',
    responsetxt: responseTxtMatch?.[1] || 'N/A',
    message: messageMatch?.[1] || 'N/A',
  };

  console.log(`[SICAS Documents] RESPONSENBR: ${sicasDetails.responsenbr}`);
  console.log(`[SICAS Documents] RESPONSETXT: ${sicasDetails.responsetxt}`);
  console.log(`[SICAS Documents] MESSAGE: ${sicasDetails.message}`);

  // Detectar errores internos de SICAS
  const hasInternalError =
    sicasDetails.message?.includes('Error en Ejecución') ||
    sicasDetails.message?.includes('Proceso Interno') ||
    sicasDetails.message?.includes('Variable de objeto') ||
    sicasDetails.message?.includes('SICASOnline') ||
    sicasDetails.message?.toLowerCase().includes('error');

  if (hasInternalError) {
    console.error('[SICAS Documents] Error interno detectado:', sicasDetails.message);
    throw new Error(`Error en SICAS: ${sicasDetails.message}`);
  }

  // Contar registros
  const docMatches = resultContent.match(/<DatDocumentos>/g);
  const recordCount = docMatches ? docMatches.length : 0;

  const diagnostic = {
    raw_result_length: resultContent.length,
    has_dataset: recordCount > 0,
    record_count: recordCount,
  };

  console.log(`[SICAS Documents] Record Count: ${recordCount}`);

  // Verificar acceso denegado
  if (responseTxtMatch && responseTxtMatch[1] === 'DENIED') {
    throw new Error('Acceso denegado - verificar credenciales');
  }

  // Parsear los registros de documentos
  const documentos: SicasDocument[] = [];
  const docRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
  let match;

  while ((match = docRegex.exec(resultContent)) !== null) {
    const docContent = match[1];

    const extractField = (fieldName: string): string | null => {
      const fieldMatch = docContent.match(new RegExp(`<${fieldName}>(.*?)<\/${fieldName}>`));
      return fieldMatch ? fieldMatch[1] : null;
    };

    const extractNumber = (fieldName: string): number | null => {
      const value = extractField(fieldName);
      return value ? parseFloat(value) : null;
    };

    const idDocumento = extractField('IdDocumento') || extractField('IdCaptura') || extractField('IDDocto');
    const vendId = extractField('IdVendedor') || extractField('VendedorId');

    if (!idDocumento) {
      console.warn('[SICAS Documents] Registro sin IdDocumento, omitiendo...');
      continue;
    }

    documentos.push({
      id_documento: idDocumento,
      no_poliza: extractField('NoPoliza') || extractField('Poliza'),
      vend_id: vendId || '',
      vend_nombre: extractField('Vendedor') || extractField('NombreVendedor') || extractField('VendNombre'),
      desp_id: extractField('IdDespacho') || extractField('DespachoId'),
      desp_nombre: extractField('Despacho') || extractField('Oficina') || extractField('DespNombre'),
      aseguradora: extractField('Aseguradora') || extractField('Compania'),
      ramo: extractField('Ramo'),
      subramo: extractField('SubRamo'),
      cliente: extractField('Cliente') || extractField('Contratante'),
      fecha_captura: extractField('FechaCaptura') || extractField('FCaptura'),
      fecha_emision: extractField('FechaEmision') || extractField('FEmision'),
      vigencia_desde: extractField('VigenciaDesde') || extractField('FDesde'),
      vigencia_hasta: extractField('VigenciaHasta') || extractField('FHasta'),
      importe: extractNumber('Importe') || extractNumber('PrimaTotal'),
      prima_neta: extractNumber('PrimaNeta') || extractNumber('ImporteNeto'),
    });
  }

  console.log(`[SICAS Documents] Parseados ${documentos.length} documentos`);

  return {
    documentos,
    sicasDetails,
    diagnostic,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startedAt = new Date();

  try {
    console.log('[Sync Documents] Inicializando...');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener configuración SICAS
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuración SICAS no encontrada');
    }

    const sicasUrl = config.endpoint || Deno.env.get("SICAS_URL") || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario || Deno.env.get("SICAS_USUARIO");
    const sicasPassword = config.sicas_password || Deno.env.get("SICAS_PASSWORD");

    if (!sicasUsuario || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    // Parámetros
    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '100');

    console.log('[Sync Documents] Parámetros:', { maxPages, itemsPerPage });

    // Consultar documentos
    const allDocumentos: SicasDocument[] = [];
    let currentPage = 1;
    let lastSicasDetails: any = null;
    let lastDiagnostic: any = null;

    while (currentPage <= maxPages) {
      try {
        console.log(`[Sync Documents] Consultando página ${currentPage}/${maxPages}...`);

        const result = await consultarDocumentosSICAS(
          sicasUrl,
          sicasUsuario,
          sicasPassword,
          currentPage,
          itemsPerPage
        );

        const { documentos: pageDocumentos, sicasDetails, diagnostic } = result;
        lastSicasDetails = sicasDetails;
        lastDiagnostic = diagnostic;

        console.log(`[Sync Documents] Página ${currentPage}: ${pageDocumentos.length} documentos obtenidos`);

        if (pageDocumentos.length === 0) {
          console.log(`[Sync Documents] Página ${currentPage} sin resultados, finalizando...`);
          break;
        }

        allDocumentos.push(...pageDocumentos);
        currentPage++;

        if (pageDocumentos.length < itemsPerPage) {
          console.log('[Sync Documents] Última página alcanzada');
          break;
        }
      } catch (error: any) {
        console.error(`[Sync Documents] Error en página ${currentPage}:`, error.message);
        throw error;
      }
    }

    console.log(`[Sync Documents] Total documentos obtenidos: ${allDocumentos.length}`);

    const duration = Date.now() - startedAt.getTime();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          records_fetched: allDocumentos.length,
          pages_processed: currentPage - 1,
        },
        documentos: allDocumentos.slice(0, 10), // Primeros 10 para preview
        metadata: {
          synced_at: new Date().toISOString(),
          duration_ms: duration,
          source: 'SICAS Web Service (SOAP)',
          sicas_response: lastSicasDetails || {},
          diagnostic: lastDiagnostic || {},
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[Sync Documents] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
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
