import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

interface PolizaVigente {
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  contratante: string | null;
  asegurado: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number | null;
  prima_total: number | null;
}

interface SicasQueryResult {
  polizas: PolizaVigente[];
  sicasDetails: {
    responsenbr: string;
    responsetxt: string;
    message: string;
  };
  diagnostic: {
    raw_result_length: number;
    has_dataset: boolean;
    tables_found: string[];
    first_row_sample?: any;
    raw_preview?: string;
  };
  request: {
    report_code: string;
    page: number;
    items_per_page: number;
    info_sort?: string;
    conditions_add?: string;
  };
}

/**
 * Consulta el reporte de pólizas vigentes H03117 desde SICAS
 */
async function consultarPolizasVigentesSICAS(
  endpoint: string,
  username: string,
  password: string,
  page: number = 1,
  itemsPerPage: number = 100
): Promise<SicasQueryResult> {
  console.log(`[SICAS] Consultando pólizas vigentes - Página ${page}`);

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

  // Request info (sin credenciales) para logging
  const requestInfo = {
    report_code: reportCode,
    page,
    items_per_page: itemsPerPage,
    info_sort: infoSort,
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapEnvelope,
    });
  } catch (fetchError: any) {
    // Si hay error SSL, intentar con HTTP en lugar de HTTPS
    if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
      console.warn(`[SICAS] Error SSL en página ${page}, intentando con HTTP...`);
      const httpEndpoint = endpoint.replace('https://', 'http://');

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

  if (!response.ok) {
    throw new Error(`SICAS HTTP Error: ${response.status}`);
  }

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
    throw new Error('No se pudo extraer ProcesarWSResult del response');
  }

  const resultContent = resultMatch[1];

  // Verificar estado del proceso
  const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
  const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
  const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

  const sicasDetails = {
    responsenbr: responseNbrMatch?.[1] || 'N/A',
    responsetxt: responseTxtMatch?.[1] || 'N/A',
    message: messageMatch?.[1] || 'N/A',
  };

  // Detectar todas las tablas presentes en el XML
  const tableRegex = /<(\w+)>[\s\S]*?<\/\1>/g;
  const tablesFound = new Set<string>();
  let tableMatch;
  while ((tableMatch = tableRegex.exec(resultContent)) !== null) {
    const tableName = tableMatch[1];
    // Filtrar tags de metadata
    if (!['RESPONSENBR', 'RESPONSETXT', 'MESSAGE', 'PROCESSDATA'].includes(tableName)) {
      tablesFound.add(tableName);
    }
  }

  // Verificar si hay NewDataSet (indica que hay datos tabulares)
  const hasNewDataSet = /<NewDataSet>/i.test(resultContent);
  const hasDatDocumentos = /<DatDocumentos>/i.test(resultContent);

  // Contar registros de DatDocumentos
  const docMatches = resultContent.match(/<DatDocumentos>/g);
  const recordCount = docMatches ? docMatches.length : 0;

  const diagnostic = {
    raw_result_length: resultContent.length,
    has_dataset: hasNewDataSet || hasDatDocumentos || recordCount > 0,
    tables_found: Array.from(tablesFound),
    raw_preview: resultContent.substring(0, 2000),
  };

  console.log(`[SICAS] RESPONSENBR: ${sicasDetails.responsenbr}`);
  console.log(`[SICAS] RESPONSETXT: ${sicasDetails.responsetxt}`);
  console.log(`[SICAS] MESSAGE: ${sicasDetails.message}`);
  console.log(`[SICAS] Has Dataset: ${diagnostic.has_dataset}`);
  console.log(`[SICAS] Tables Found: ${diagnostic.tables_found.join(', ')}`);
  console.log(`[SICAS] Record Count: ${recordCount}`);

  // REGLA CRÍTICA: Si el mensaje contiene "Error", es un error real, NO éxito
  const hasInternalError =
    sicasDetails.message?.includes('Error en Ejecución') ||
    sicasDetails.message?.includes('Proceso Interno') ||
    sicasDetails.message?.includes('Variable de objeto') ||
    sicasDetails.message?.includes('SICASOnline') ||
    sicasDetails.message?.toLowerCase().includes('error');

  if (hasInternalError) {
    // Error real de SICAS - lanzar excepción para que se registre como failed
    console.error('[SICAS] Error interno detectado:', sicasDetails.message);
    throw new Error(`SICAS Internal Error: ${sicasDetails.message}`);
  }

  // Si RESPONSENBR=0 pero NO hay error, verificar si hay dataset real
  if (!responseNbrMatch || responseNbrMatch[1] === '0') {
    console.warn(`[SICAS] RESPONSENBR=0: ${sicasDetails.message}`);

    // Si NO hay dataset real (tablas o registros), es un error
    if (!diagnostic.has_dataset) {
      console.error('[SICAS] No hay dataset en la respuesta');
      throw new Error(`SICAS: No hay dataset disponible. Message: ${sicasDetails.message}`);
    }

    console.log('[SICAS] RESPONSENBR=0 pero hay dataset, continuando...');
  }

  // Verificar acceso denegado
  if (responseTxtMatch && responseTxtMatch[1] === 'DENIED') {
    throw new Error('SICAS: Acceso denegado - verificar credenciales');
  }

  // Parsear los registros de pólizas
  const polizas: PolizaVigente[] = [];
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

    const idDocumento = extractField('IdDocumento') || extractField('IdCaptura');
    const vendId = extractField('IdVendedor') || extractField('VendedorId');

    if (!idDocumento || !vendId) {
      console.warn('[SICAS] Registro sin IdDocumento o VendedorId, omitiendo...');
      continue;
    }

    polizas.push({
      id_documento: idDocumento,
      no_poliza: extractField('NoPoliza') || extractField('Poliza'),
      vend_id: vendId,
      vend_nombre: extractField('Vendedor') || extractField('NombreVendedor'),
      desp_id: extractField('IdDespacho') || extractField('DespachoId'),
      desp_nombre: extractField('Despacho') || extractField('Oficina'),
      aseguradora: extractField('Aseguradora') || extractField('Compania'),
      ramo: extractField('Ramo'),
      subramo: extractField('SubRamo'),
      contratante: extractField('Contratante') || extractField('Cliente'),
      asegurado: extractField('Asegurado'),
      vigencia_desde: extractField('VigenciaDesde') || extractField('FDesde'),
      vigencia_hasta: extractField('VigenciaHasta') || extractField('FHasta'),
      prima_neta: extractNumber('PrimaNeta') || extractNumber('ImporteNeto'),
      prima_total: extractNumber('PrimaTotal') || extractNumber('Importe'),
    });
  }

  console.log(`[SICAS] Parseadas ${polizas.length} pólizas`);

  // Agregar first_row_sample para diagnóstico
  if (polizas.length > 0) {
    diagnostic.first_row_sample = polizas[0];
  }

  return {
    polizas,
    sicasDetails,
    diagnostic,
    request: requestInfo,
  };
}

/**
 * Guarda las pólizas en la tabla de caché
 */
async function guardarPolizasCache(
  supabase: any,
  polizas: PolizaVigente[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  console.log(`[Cache] Guardando ${polizas.length} pólizas...`);

  // Procesar en lotes de 100
  const batchSize = 100;
  for (let i = 0; i < polizas.length; i += batchSize) {
    const batch = polizas.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('sicas_polizas_vigentes')
        .upsert(
          batch.map(p => ({
            ...p,
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
        // Asumimos que todos se insertaron/actualizaron
        inserted += batch.length;
      }
    } catch (error: any) {
      console.error('[Cache] Error procesando lote:', error.message);
      errors += batch.length;
    }
  }

  console.log(`[Cache] Guardado completado: ${inserted} exitosos, ${errors} errores`);
  return { inserted, updated, errors };
}

/**
 * Registra el historial de sincronización
 */
async function registrarSyncLog(
  supabase: any,
  status: string,
  stats: {
    records_fetched: number;
    records_inserted: number;
    records_updated: number;
    records_errors: number;
  },
  startedAt: Date,
  errorMessage?: string,
  sicasDetails?: {
    responsenbr?: string;
    responsetxt?: string;
    message?: string;
  },
  diagnostic?: {
    raw_result_length?: number;
    has_dataset?: boolean;
    tables_found?: string[];
    first_row_sample?: any;
    raw_preview?: string;
  },
  requestInfo?: {
    report_code?: string;
    page?: number;
    items_per_page?: number;
    info_sort?: string;
  }
) {
  await supabase
    .from('sicas_production_sync_log')
    .insert({
      sync_type: 'polizas_vigentes',
      status,
      records_fetched: stats.records_fetched,
      records_inserted: stats.records_inserted,
      records_updated: stats.records_updated,
      records_errors: stats.records_errors,
      error_message: errorMessage || null,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      metadata: {
        source: 'SICAS Web Service',
        // Request info (sin credenciales)
        request: requestInfo || {
          report_code: 'H03117',
          page: 1,
          items_per_page: 200,
        },
        // Respuesta de SICAS
        sicas_response: sicasDetails || {},
        // Diagnóstico completo
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

  try {
    // Inicializar Supabase con service role
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

    // Usar credenciales de la configuración o variables de entorno
    const sicasUrl = config.endpoint || Deno.env.get("SICAS_URL") || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario || Deno.env.get("SICAS_USUARIO");
    const sicasPassword = config.sicas_password || Deno.env.get("SICAS_PASSWORD");

    if (!sicasUsuario || !sicasPassword) {
      return new Response(
        JSON.stringify({
          error: "Configuración SICAS incompleta. Configure las credenciales en Admin > SICAS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parámetros opcionales
    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '200');

    console.log('[Sync] Iniciando sincronización de pólizas vigentes...');
    console.log('[Sync] Parámetros:', { maxPages, itemsPerPage });

    const allPolizas: PolizaVigente[] = [];
    let currentPage = 1;
    let lastSicasDetails: any = null;
    let lastDiagnostic: any = null;
    let lastRequestInfo: any = null;

    // Consultar todas las páginas
    while (currentPage <= maxPages) {
      try {
        const result = await consultarPolizasVigentesSICAS(
          sicasUrl,
          sicasUsuario,
          sicasPassword,
          currentPage,
          itemsPerPage
        );

        const { polizas: pagePolizas, sicasDetails, diagnostic, request } = result;
        lastSicasDetails = sicasDetails;
        lastDiagnostic = diagnostic;
        lastRequestInfo = request;

        if (pagePolizas.length === 0) {
          console.log(`[Sync] Página ${currentPage} sin resultados, finalizando...`);
          break;
        }

        allPolizas.push(...pagePolizas);
        console.log(`[Sync] Página ${currentPage}: ${pagePolizas.length} pólizas`);

        currentPage++;

        // Si obtuvimos menos registros que el límite, ya no hay más páginas
        if (pagePolizas.length < itemsPerPage) {
          console.log('[Sync] Última página alcanzada');
          break;
        }
      } catch (error: any) {
        console.error(`[Sync] Error en página ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[Sync] Total pólizas obtenidas: ${allPolizas.length}`);

    let saveStats = { inserted: 0, updated: 0, errors: 0 };

    // Si no hay pólizas, limpiar la tabla
    if (allPolizas.length === 0) {
      console.log('[Sync] No hay pólizas, limpiando tabla...');
      const { error } = await supabase
        .from('sicas_polizas_vigentes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('[Sync] Error al limpiar tabla:', error);
      }
    } else {
      // Guardar en caché
      saveStats = await guardarPolizasCache(supabase, allPolizas);
    }

    // Determinar status final - NUNCA success sin datos reales
    const hasRealData = allPolizas.length > 0;
    const status = !hasRealData ? 'failed' :
                   saveStats.errors === 0 ? 'success' :
                   saveStats.inserted > 0 ? 'partial' : 'error';

    // Registrar en historial con diagnóstico completo
    await registrarSyncLog(
      supabase,
      status,
      {
        records_fetched: allPolizas.length,
        records_inserted: saveStats.inserted,
        records_updated: saveStats.updated,
        records_errors: saveStats.errors,
      },
      startedAt,
      !hasRealData ? 'No se obtuvieron registros de SICAS' : undefined,
      lastSicasDetails,
      lastDiagnostic,
      lastRequestInfo
    );

    const duration = Date.now() - startedAt.getTime();

    console.log(`[Sync] Completado en ${duration}ms`);

    // NUNCA devolver success: true sin datos reales
    const success = hasRealData && status === 'success';

    return new Response(
      JSON.stringify({
        success,
        status,
        stats: {
          records_fetched: allPolizas.length,
          records_inserted: saveStats.inserted,
          records_updated: saveStats.updated,
          records_errors: saveStats.errors,
          pages_processed: currentPage - 1,
        },
        metadata: {
          synced_at: new Date().toISOString(),
          duration_ms: duration,
          source: 'SICAS Web Service',
          // Request (sin credenciales)
          request: lastRequestInfo || { report_code: 'H03117' },
          // Respuesta de SICAS
          sicas_response: lastSicasDetails || {},
          // Diagnóstico completo
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
    console.error('[Sync] Error fatal:', error);

    // Registrar error en log con diagnóstico completo
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
        error.message,
        undefined,
        { raw_result_length: 0, has_dataset: false, tables_found: [], raw_preview: error.stack?.substring(0, 500) },
        { report_code: 'H03117', page: 1, items_per_page: 200 }
      );
    } catch (logError) {
      console.error('[Sync] Error al registrar log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
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
