import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

// Tipos de error estructurado
interface ErrorResponse {
  success: false;
  error: string;
  stage: 'AUTH' | 'CONFIG' | 'FETCH_SICAS' | 'PARSE_XML' | 'DB_SAVE' | 'UNKNOWN';
  http_status?: number;
  http_body?: string;
  details?: string;
  timestamp: string;
}

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
 * Consulta el reporte de pólizas vigentes usando el método oficial ProcesarWS con filtros
 * Basado en la documentación oficial de SICAS (páginas 27+)
 * Usa el KeyCode H03400 con filtros para pólizas vigentes
 */
async function consultarPolizasVigentesSICAS(
  endpoint: string,
  username: string,
  password: string,
  page: number = 1,
  itemsPerPage: number = 100
): Promise<SicasQueryResult> {
  console.log(`[SICAS] Consultando pólizas vigentes - Página ${page}`);
  console.log(`[SICAS] Usando KeyCode: ${SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES}`);

  // Inicializar cliente SOAP con ProcesarWS
  const client = new SicasSoapReportClient({
    endpoint,
    username,
    password,
  });

  // Construir filtros según documentación oficial
  const filters = [
    // Filtro de estatus vigente (documentos activos)
    SicasSoapReportClient.createStatusVicenteFilter(),

    // Filtro de tipo de documento (solo pólizas, no endosos)
    SicasSoapReportClient.createDocumentTypeFilter(),
  ];

  const requestInfo = {
    report_code: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
    page,
    items_per_page: itemsPerPage,
    info_sort: 'DatDocumentos.FCaptura DESC',
    filters_applied: filters.length,
  };

  console.log(`[SICAS] Filtros aplicados: ${filters.length}`);

  try {
    // Ejecutar reporte con el cliente oficial
    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page,
      itemsPerPage,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters,
    });

    console.log(`[SICAS] Respuesta recibida - Success: ${result.success}`);
    console.log(`[SICAS] Registros encontrados: ${result.records.length}`);

    if (!result.success) {
      throw new Error(`SICAS Error: ${result.message}`);
    }

    // Convertir los registros al formato esperado
    const polizas: PolizaVigente[] = result.records.map((record: any) => {
      // Mapear los campos del reporte H03400 al formato de PolizaVigente
      return {
        id_documento: record.IdDocumento || record.IDDocto || `DOC_${Date.now()}_${Math.random()}`,
        no_poliza: record.Documento || record.NoPoliza || record.Poliza,
        vend_id: record.IDVend || record.IdVendedor || '0',
        vend_nombre: record.VendNombre || record.Vendedor || record.NombreVendedor,
        desp_id: record.IDDesp || record.IdDespacho || null,
        desp_nombre: record.DespNombre || record.Despacho || record.Oficina || null,
        aseguradora: record.CiaNombre || record.Aseguradora || record.Compania || null,
        ramo: record.RamoNombre || record.Ramo || null,
        subramo: record.SubRamoNombre || record.SubRamo || null,
        contratante: record.Contratante || record.Cliente || null,
        asegurado: record.Asegurado || null,
        vigencia_desde: record.FDesde || record.VigenciaDesde || null,
        vigencia_hasta: record.FHasta || record.VigenciaHasta || null,
        prima_neta: record.ImporteNeto || record.PrimaNeta || null,
        prima_total: record.Importe || record.PrimaTotal || null,
      };
    });

    const sicasDetails = {
      responsenbr: result.responseNbr,
      responsetxt: result.success ? 'SUCESS' : 'ERROR',
      message: result.message,
    };

    const diagnostic = {
      raw_result_length: result.rawXml?.length || 0,
      has_dataset: result.records.length > 0,
      tables_found: ['RECORD'],
      raw_preview: result.rawXml?.substring(0, 2000) || '',
      first_row_sample: polizas.length > 0 ? polizas[0] : undefined,
    };

    console.log(`[SICAS] Parseadas ${polizas.length} pólizas`);

    return {
      polizas,
      sicasDetails,
      diagnostic,
      request: requestInfo,
    };
  } catch (error: any) {
    console.error('[SICAS] Error en consulta:', error.message);

    // Si el error es de código de reporte no encontrado
    if (error.message?.includes('Codigo de reporte no encontrado') ||
        error.message?.includes('not found')) {
      throw new Error(
        `SICAS Error: El código de reporte ${SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES} no está disponible. ` +
        `Verifica con el proveedor de SICAS que tu usuario tenga acceso a este reporte.`
      );
    }

    throw new Error(`FETCH_SICAS: ${error.message}`);
  }
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
      // Mapear al esquema de sicas_documents
      const documentsToUpsert = batch.map(p => ({
        id_docto: p.id_documento,
        poliza: p.no_poliza,
        vend_id: p.vend_id,
        vend_nombre: p.vend_nombre,
        desp_nombre: p.desp_nombre,
        compania: p.aseguradora,
        ramo: p.ramo,
        subramo: p.subramo,
        cliente: p.contratante || p.asegurado,
        vigencia_desde: p.vigencia_desde,
        vigencia_hasta: p.vigencia_hasta,
        prima_neta: p.prima_neta,
        importe: p.prima_total,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('sicas_documents')
        .upsert(documentsToUpsert, {
          onConflict: 'id_docto',
          ignoreDuplicates: false,
        });

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
  let currentStage: ErrorResponse['stage'] = 'UNKNOWN';

  try {
    // STAGE: CONFIG
    currentStage = 'CONFIG';
    console.log('[Sync] STAGE: CONFIG - Inicializando configuración...');

    // Inicializar Supabase con service role
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

    // Obtener configuración SICAS
    console.log('[Sync] Obteniendo configuración SICAS de base de datos...');
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError) {
      console.error('[Sync] Error obteniendo config:', configError);
      const error: ErrorResponse = {
        success: false,
        error: 'Error al obtener configuración SICAS',
        stage: 'CONFIG',
        details: configError.message,
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config) {
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

    // Usar credenciales de la configuración o variables de entorno
    const sicasUrl = config.endpoint || Deno.env.get("SICAS_URL") || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario || Deno.env.get("SICAS_USUARIO");
    const sicasPassword = config.sicas_password || Deno.env.get("SICAS_PASSWORD");

    console.log('[Sync] Endpoint SICAS:', sicasUrl);
    console.log('[Sync] Usuario configurado:', sicasUsuario ? 'SÍ' : 'NO');
    console.log('[Sync] Password configurado:', sicasPassword ? 'SÍ' : 'NO');

    if (!sicasUsuario || !sicasPassword) {
      const error: ErrorResponse = {
        success: false,
        error: 'Configuración SICAS incompleta',
        stage: 'CONFIG',
        details: 'Usuario o password no configurados. Configure las credenciales en Admin > SICAS',
        timestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parámetros opcionales
    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '200');

    console.log('[Sync] Parámetros:', { maxPages, itemsPerPage });

    // STAGE: FETCH_SICAS
    currentStage = 'FETCH_SICAS';
    console.log('[Sync] STAGE: FETCH_SICAS - Consultando datos de SICAS...');

    const allPolizas: PolizaVigente[] = [];
    let currentPage = 1;
    let lastSicasDetails: any = null;
    let lastDiagnostic: any = null;
    let lastRequestInfo: any = null;

    // Consultar todas las páginas
    while (currentPage <= maxPages) {
      try {
        console.log(`[Sync] Consultando página ${currentPage}/${maxPages}...`);

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

        console.log(`[Sync] Página ${currentPage}: ${pagePolizas.length} pólizas obtenidas`);

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

        // Determinar el stage del error
        if (error.message?.includes('FETCH_SICAS')) {
          currentStage = 'FETCH_SICAS';
        } else if (error.message?.includes('PARSE_XML')) {
          currentStage = 'PARSE_XML';
        }

        // Si es error fatal, re-lanzar para catch principal
        throw error;
      }
    }

    console.log(`[Sync] Total pólizas obtenidas: ${allPolizas.length}`);

    // STAGE: DB_SAVE
    currentStage = 'DB_SAVE';
    console.log('[Sync] STAGE: DB_SAVE - Guardando en base de datos...');

    let saveStats = { inserted: 0, updated: 0, errors: 0 };

    // Si no hay pólizas, limpiar la tabla base
    if (allPolizas.length === 0) {
      console.log('[Sync] No hay pólizas, limpiando tabla...');
      try {
        const { error } = await supabase
          .from('sicas_documents')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          console.error('[Sync] Error al limpiar tabla:', error);
          throw new Error(`DB_SAVE: Error al limpiar tabla - ${error.message}`);
        }
      } catch (dbError: any) {
        throw new Error(`DB_SAVE: ${dbError.message}`);
      }
    } else {
      // Guardar en caché
      try {
        saveStats = await guardarPolizasCache(supabase, allPolizas);
        console.log(`[Sync] Guardado: ${saveStats.inserted} insertados, ${saveStats.updated} actualizados, ${saveStats.errors} errores`);
      } catch (saveError: any) {
        console.error('[Sync] Error al guardar en caché:', saveError);
        throw new Error(`DB_SAVE: Error al guardar pólizas - ${saveError.message}`);
      }
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
    console.error(`[Sync] Error fatal en STAGE: ${currentStage}`, error);

    // Extraer información del error
    const errorMessage = error.message || 'Error desconocido';
    let httpStatus: number | undefined;
    let httpBody: string | undefined;

    // Detectar HTTP errors
    const httpMatch = errorMessage.match(/HTTP (\d+):/);
    if (httpMatch) {
      httpStatus = parseInt(httpMatch[1]);
      const bodyMatch = errorMessage.match(/Body: (.*)/);
      if (bodyMatch) {
        httpBody = bodyMatch[1];
      }
    }

    // Determinar status code de respuesta basado en stage
    let responseStatusCode = 500;
    if (currentStage === 'CONFIG') responseStatusCode = 400;
    if (currentStage === 'AUTH') responseStatusCode = 401;
    if (httpStatus) responseStatusCode = httpStatus;

    // Construir respuesta de error estructurada
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
        errorMessage,
        undefined,
        {
          raw_result_length: 0,
          has_dataset: false,
          tables_found: [],
          raw_preview: error.stack?.substring(0, 500),
        },
        {
          report_code: 'H03117',
          page: 1,
          items_per_page: 200,
        }
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
