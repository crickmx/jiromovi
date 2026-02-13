import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

interface ErrorResponse {
  success: false;
  error: string;
  stage: 'AUTH' | 'CONFIG' | 'FETCH_SICAS' | 'PARSE_XML' | 'DB_SAVE' | 'UNKNOWN';
  http_status?: number;
  http_body?: string;
  details?: string;
  timestamp: string;
}

interface ComisionPagada {
  id_documento: string;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  no_poliza: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  contratante: string | null;
  asegurado: string | null;
  prima_neta: number | null;
  prima_total: number | null;
  comision: number | null;
  porcentaje_comision: number | null;
  fecha_emision: string | null;
  fecha_captura: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  fecha_pago: string | null;
  forma_pago: string | null;
  referencia_pago: string | null;
  banco: string | null;
  estado: string | null;
}

async function consultarComisionesPagadas(
  endpoint: string,
  username: string,
  password: string,
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
  itemsPerPage: number = 100
): Promise<{
  comisiones: ComisionPagada[];
  sicasDetails: any;
  diagnostic: any;
  request: any;
}> {
  console.log(`[SICAS] Consultando comisiones pagadas - Página ${page}`);

  const reportCode = 'H03797';
  const infoSort = 'DatDocumentos.Documento DESC';

  let conditionsAdd = '';
  if (dateFrom && dateTo) {
    conditionsAdd = `DatDocumentos.FPago|>=|${dateFrom}|AND|DatDocumentos.FPago|<=|${dateTo}`;
  }

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
        <InfoSort>${infoSort}</InfoSort>${conditionsAdd ? `
        <ConditionsAdd>${conditionsAdd}</ConditionsAdd>` : ''}
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${username}</UserName>
        <Password>${password}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

  const requestInfo = {
    report_code: reportCode,
    page,
    items_per_page: itemsPerPage,
    info_sort: infoSort,
    conditions_add: conditionsAdd || null,
    date_from: dateFrom || null,
    date_to: dateTo || null,
  };

  let response;
  let responseText: string = '';

  try {
    console.log(`[SICAS] Enviando request a: ${endpoint}`);
    if (conditionsAdd) {
      console.log(`[SICAS] Filtro de fechas de pago: ${dateFrom} a ${dateTo}`);
    }

    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapEnvelope,
    });
  } catch (fetchError: any) {
    if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
      console.warn(`[SICAS] Error SSL, intentando con HTTP...`);
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
        console.error('[SICAS] Error en fallback HTTP:', httpError);
        throw new Error(`FETCH_SICAS: ${httpError.message}`);
      }
    } else {
      console.error('[SICAS] Error en fetch:', fetchError);
      throw new Error(`FETCH_SICAS: ${fetchError.message}`);
    }
  }

  console.log(`[SICAS] HTTP Status: ${response.status} ${response.statusText}`);

  try {
    responseText = await response.text();
    console.log(`[SICAS] Response length: ${responseText.length} bytes`);
  } catch (textError: any) {
    console.error('[SICAS] Error leyendo response body:', textError);
    throw new Error(`FETCH_SICAS: No se pudo leer el body de la respuesta`);
  }

  if (!response.ok) {
    console.error(`[SICAS] HTTP Error ${response.status}: ${response.statusText}`);
    throw new Error(
      `HTTP ${response.status}: ${response.statusText} | Body: ${responseText.substring(0, 200)}`
    );
  }

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
      console.error('[SICAS] No se encontró ProcesarWSResult');
      throw new Error('PARSE_XML: No se encontró ProcesarWSResult en la respuesta de SICAS');
    }

    resultContent = resultMatch[1];
    console.log(`[SICAS] Resultado extraído: ${resultContent.length} bytes`);
  } catch (parseError: any) {
    console.error('[SICAS] Error en decode/parse inicial:', parseError);
    throw new Error(`PARSE_XML: ${parseError.message}`);
  }

  const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
  const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
  const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

  const sicasDetails = {
    responsenbr: responseNbrMatch?.[1] || 'N/A',
    responsetxt: responseTxtMatch?.[1] || 'N/A',
    message: messageMatch?.[1] || 'N/A',
  };

  console.log(`[SICAS] RESPONSENBR: ${sicasDetails.responsenbr}`);
  console.log(`[SICAS] RESPONSETXT: ${sicasDetails.responsetxt}`);
  console.log(`[SICAS] MESSAGE: ${sicasDetails.message}`);

  const hasInternalError =
    sicasDetails.message?.includes('Error en Ejecución') ||
    sicasDetails.message?.includes('Proceso Interno') ||
    sicasDetails.message?.includes('Variable de objeto') ||
    sicasDetails.message?.toLowerCase().includes('error');

  if (hasInternalError) {
    console.error('[SICAS] Error interno detectado:', sicasDetails.message);
    throw new Error(`SICAS Internal Error: ${sicasDetails.message}`);
  }

  if (responseTxtMatch && responseTxtMatch[1] === 'DENIED') {
    throw new Error('SICAS: Acceso denegado - verificar credenciales');
  }

  const comisiones: ComisionPagada[] = [];
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

    const idDocumento = extractField('IdDocumento') || extractField('Documento');
    const vendId = extractField('IdVendedor') || extractField('VendedorId');

    if (!idDocumento || !vendId) {
      console.warn('[SICAS] Registro sin IdDocumento o VendedorId, omitiendo...');
      continue;
    }

    comisiones.push({
      id_documento: idDocumento,
      vend_id: vendId,
      vend_nombre: extractField('Vendedor') || extractField('NombreVendedor'),
      desp_id: extractField('IdDespacho') || extractField('DespachoId'),
      desp_nombre: extractField('Despacho') || extractField('Oficina'),
      no_poliza: extractField('NoPoliza') || extractField('Poliza'),
      aseguradora: extractField('Aseguradora') || extractField('Compania'),
      ramo: extractField('Ramo'),
      subramo: extractField('SubRamo'),
      contratante: extractField('Contratante') || extractField('Cliente'),
      asegurado: extractField('Asegurado'),
      prima_neta: extractNumber('PrimaNeta') || extractNumber('ImporteNeto'),
      prima_total: extractNumber('PrimaTotal') || extractNumber('Importe'),
      comision: extractNumber('Comision') || extractNumber('ImporteComision'),
      porcentaje_comision: extractNumber('PorcentajeComision') || extractNumber('PorcComision'),
      fecha_emision: extractField('FEmision') || extractField('FechaEmision'),
      fecha_captura: extractField('FCaptura') || extractField('FechaCaptura'),
      vigencia_desde: extractField('VigenciaDesde') || extractField('FDesde'),
      vigencia_hasta: extractField('VigenciaHasta') || extractField('FHasta'),
      fecha_pago: extractField('FPago') || extractField('FechaPago'),
      forma_pago: extractField('FormaPago') || extractField('TipoPago'),
      referencia_pago: extractField('ReferenciaPago') || extractField('Referencia'),
      banco: extractField('Banco') || extractField('InstitucionBancaria'),
      estado: extractField('Estado') || extractField('Estatus'),
    });
  }

  console.log(`[SICAS] Parseadas ${comisiones.length} comisiones pagadas`);

  const diagnostic = {
    raw_result_length: resultContent.length,
    has_dataset: comisiones.length > 0,
    first_row_sample: comisiones.length > 0 ? comisiones[0] : null,
  };

  return {
    comisiones,
    sicasDetails,
    diagnostic,
    request: requestInfo,
  };
}

async function guardarComisionesCache(
  supabase: any,
  comisiones: ComisionPagada[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let errors = 0;

  console.log(`[Cache] Guardando ${comisiones.length} comisiones pagadas...`);

  const batchSize = 100;
  for (let i = 0; i < comisiones.length; i += batchSize) {
    const batch = comisiones.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('sicas_comisiones_pagadas')
        .upsert(
          batch.map(c => ({
            ...c,
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
          {
            onConflict: 'id_documento',
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.error('[Cache] Error en lote:', error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    } catch (error: any) {
      console.error('[Cache] Error procesando lote:', error.message);
      errors += batch.length;
    }
  }

  try {
    await supabase.rpc('apply_vendor_mapping_to_commissions');
    console.log('[Cache] Mapeo de vendedores aplicado');
  } catch (error: any) {
    console.error('[Cache] Error aplicando mapeo:', error.message);
  }

  console.log(`[Cache] Guardado completado: ${inserted} exitosos, ${errors} errores`);
  return { inserted, updated: 0, errors };
}

async function registrarSyncLog(
  supabase: any,
  status: string,
  stats: any,
  startedAt: Date,
  dateFrom?: string,
  dateTo?: string,
  errorMessage?: string,
  sicasDetails?: any,
  diagnostic?: any,
  requestInfo?: any
) {
  await supabase
    .from('sicas_comisiones_sync_log')
    .insert({
      report_code: 'H03797',
      report_name: 'Comisiones Pagadas',
      status,
      records_fetched: stats.records_fetched,
      records_inserted: stats.records_inserted,
      records_updated: stats.records_updated,
      records_errors: stats.records_errors,
      pages_processed: stats.pages_processed || 0,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      date_from: dateFrom || null,
      date_to: dateTo || null,
      error_message: errorMessage || null,
      metadata: {
        source: 'SICAS Web Service',
        request: requestInfo || {},
        sicas_response: sicasDetails || {},
        diagnostic: diagnostic || {},
      },
    });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startedAt = new Date();
  let currentStage: ErrorResponse['stage'] = 'UNKNOWN';

  try {
    currentStage = 'CONFIG';
    console.log('[Sync] STAGE: CONFIG - Inicializando configuración...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      const error: ErrorResponse = {
        success: false,
        error: 'Variables de entorno de Supabase no configuradas',
        stage: 'CONFIG',
        details: 'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes',
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      const error: ErrorResponse = {
        success: false,
        error: 'Configuración SICAS no encontrada',
        stage: 'CONFIG',
        details: 'Configure las credenciales en Admin > SICAS',
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(error), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sicasUrl = config.endpoint || Deno.env.get("SICAS_URL") || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario || Deno.env.get("SICAS_USUARIO");
    const sicasPassword = config.sicas_password || Deno.env.get("SICAS_PASSWORD");

    if (!sicasUsuario || !sicasPassword) {
      const error: ErrorResponse = {
        success: false,
        error: 'Configuración SICAS incompleta',
        stage: 'CONFIG',
        details: 'Usuario o password no configurados',
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '100');
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;

    console.log('[Sync] Parámetros:', { maxPages, itemsPerPage, dateFrom, dateTo });

    currentStage = 'FETCH_SICAS';
    console.log('[Sync] STAGE: FETCH_SICAS - Consultando comisiones pagadas...');

    const allComisiones: ComisionPagada[] = [];
    let currentPage = 1;
    let lastSicasDetails: any = null;
    let lastDiagnostic: any = null;
    let lastRequestInfo: any = null;

    while (currentPage <= maxPages) {
      try {
        console.log(`[Sync] Consultando página ${currentPage}/${maxPages}...`);

        const result = await consultarComisionesPagadas(
          sicasUrl,
          sicasUsuario,
          sicasPassword,
          dateFrom,
          dateTo,
          currentPage,
          itemsPerPage
        );

        const { comisiones, sicasDetails, diagnostic, request } = result;
        lastSicasDetails = sicasDetails;
        lastDiagnostic = diagnostic;
        lastRequestInfo = request;

        console.log(`[Sync] Página ${currentPage}: ${comisiones.length} comisiones`);

        if (comisiones.length === 0) {
          console.log(`[Sync] Página ${currentPage} sin resultados, finalizando...`);
          break;
        }

        allComisiones.push(...comisiones);
        currentPage++;

        if (comisiones.length < itemsPerPage) {
          console.log('[Sync] Última página alcanzada');
          break;
        }
      } catch (error: any) {
        console.error(`[Sync] Error en página ${currentPage}:`, error.message);
        throw error;
      }
    }

    console.log(`[Sync] Total comisiones obtenidas: ${allComisiones.length}`);

    currentStage = 'DB_SAVE';
    console.log('[Sync] STAGE: DB_SAVE - Guardando en base de datos...');

    const saveStats = await guardarComisionesCache(supabase, allComisiones);

    const hasRealData = allComisiones.length > 0;
    const status = !hasRealData ? 'failed' :
                   saveStats.errors === 0 ? 'success' :
                   saveStats.inserted > 0 ? 'partial' : 'error';

    await registrarSyncLog(
      supabase,
      status,
      {
        records_fetched: allComisiones.length,
        records_inserted: saveStats.inserted,
        records_updated: saveStats.updated,
        records_errors: saveStats.errors,
        pages_processed: currentPage - 1,
      },
      startedAt,
      dateFrom,
      dateTo,
      !hasRealData ? 'No se obtuvieron comisiones pagadas de SICAS' : undefined,
      lastSicasDetails,
      lastDiagnostic,
      lastRequestInfo
    );

    const duration = Date.now() - startedAt.getTime();
    const success = hasRealData && status === 'success';

    return new Response(
      JSON.stringify({
        success,
        status,
        stats: {
          records_fetched: allComisiones.length,
          records_inserted: saveStats.inserted,
          records_updated: saveStats.updated,
          records_errors: saveStats.errors,
          pages_processed: currentPage - 1,
        },
        metadata: {
          synced_at: new Date().toISOString(),
          duration_ms: duration,
          source: 'SICAS Web Service',
          report_code: 'H03797',
          report_name: 'Comisiones Pagadas',
          date_from: dateFrom || null,
          date_to: dateTo || null,
          request: lastRequestInfo || {},
          sicas_response: lastSicasDetails || {},
          diagnostic: lastDiagnostic || {},
        },
      }),
      {
        status: success ? 200 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error(`[Sync] Error fatal en STAGE: ${currentStage}`, error);

    const errorMessage = error.message || 'Error desconocido';
    let httpStatus: number | undefined;
    let httpBody: string | undefined;

    const httpMatch = errorMessage.match(/HTTP (\d+):/);
    if (httpMatch) {
      httpStatus = parseInt(httpMatch[1]);
      const bodyMatch = errorMessage.match(/Body: (.*)/);
      if (bodyMatch) {
        httpBody = bodyMatch[1];
      }
    }

    let responseStatusCode = 500;
    if (currentStage === 'CONFIG') responseStatusCode = 400;
    if (currentStage === 'AUTH') responseStatusCode = 401;
    if (httpStatus) responseStatusCode = httpStatus;

    const errorResponse: ErrorResponse = {
      success: false,
      error: errorMessage,
      stage: currentStage,
      http_status: httpStatus,
      http_body: httpBody,
      details: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
    };

    console.error('[Sync] Error Response:', JSON.stringify(errorResponse, null, 2));

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await registrarSyncLog(
        supabase,
        'failed',
        {
          records_fetched: 0,
          records_inserted: 0,
          records_updated: 0,
          records_errors: 1,
        },
        startedAt,
        undefined,
        undefined,
        errorMessage
      );
    } catch (logError) {
      console.error('[Sync] Error al registrar log:', logError);
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: responseStatusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
