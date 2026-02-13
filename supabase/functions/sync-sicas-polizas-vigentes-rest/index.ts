import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClient } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startedAt = new Date();

  try {
    console.log('[Sync REST] Inicializando sincronización usando API REST...');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parámetros opcionales
    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '200');

    console.log('[Sync REST] Parámetros:', { maxPages, itemsPerPage });

    // Crear cliente REST
    const sicasClient = createSicasRestClient();

    console.log('[Sync REST] Testing conexión REST...');
    const testResult = await sicasClient.testConnection();
    if (!testResult.success) {
      throw new Error(`Fallo test de conexión: ${testResult.message}`);
    }

    console.log('[Sync REST] ✅ Conexión REST exitosa');

    // Consultar pólizas usando el keyCode H05106 (Pólizas Vigentes)
    // Reportes alternativos: H05106, H05107, H03117
    const allPolizas: PolizaVigente[] = [];

    // Intentar con diferentes reportes
    const reportCodes = ['H05106', 'H05107', 'H05105', 'H03117'];
    let successfulReport: string | null = null;
    let lastError: string = '';

    for (const keyCode of reportCodes) {
      try {
        console.log(`[Sync REST] Intentando reporte ${keyCode}...`);

        for (let page = 1; page <= maxPages; page++) {
          console.log(`[Sync REST] Consultando página ${page}/${maxPages} con ${keyCode}...`);

          const response = await sicasClient.readReport({
            keyCode,
            pageRequested: page,
            itemsForPage: itemsPerPage,
            sortFields: 'FCaptura DESC',
            formatResponse: 2,
          });

          if (!response.Sucess) {
            console.error(`[Sync REST] Error en ${keyCode}:`, response.Error);
            throw new Error(response.Error || 'Error desconocido');
          }

          if (!response.Response || response.Response.length === 0) {
            console.log(`[Sync REST] ${keyCode} - No hay datos`);
            break;
          }

          const tableInfo = response.Response[0]?.TableInfo;
          if (!tableInfo || tableInfo.length === 0) {
            console.log(`[Sync REST] ${keyCode} - Página ${page} sin registros, finalizando...`);
            break;
          }

          console.log(`[Sync REST] ${keyCode} - Página ${page}: ${tableInfo.length} registros`);

          // Procesar registros
          for (const record of tableInfo) {
            const poliza: PolizaVigente = {
              id_documento: record.IdDocumento || record.IdCaptura || `${record.IdVendedor}_${record.NoPoliza}_${Date.now()}`,
              no_poliza: record.NoPoliza || record.Poliza || null,
              vend_id: String(record.IdVendedor || record.VendedorId || '0'),
              vend_nombre: record.Vendedor || record.NombreVendedor || null,
              desp_id: String(record.IdDespacho || record.DespachoId || '0'),
              desp_nombre: record.Despacho || record.Oficina || null,
              aseguradora: record.Aseguradora || record.Compania || null,
              ramo: record.Ramo || null,
              subramo: record.SubRamo || null,
              contratante: record.Contratante || record.Cliente || null,
              asegurado: record.Asegurado || null,
              vigencia_desde: record.VigenciaDesde || record.FDesde || null,
              vigencia_hasta: record.VigenciaHasta || record.FHasta || null,
              prima_neta: record.PrimaNeta || record.ImporteNeto || null,
              prima_total: record.PrimaTotal || record.Importe || null,
            };

            allPolizas.push(poliza);
          }

          // Si obtuvimos menos registros que el límite, no hay más páginas
          if (tableInfo.length < itemsPerPage) {
            console.log(`[Sync REST] ${keyCode} - Última página alcanzada`);
            break;
          }
        }

        // Si llegamos aquí y tenemos datos, este reporte funcionó
        if (allPolizas.length > 0) {
          successfulReport = keyCode;
          console.log(`[Sync REST] ✅ Reporte ${keyCode} exitoso con ${allPolizas.length} pólizas`);
          break;
        } else {
          console.log(`[Sync REST] ${keyCode} no retornó datos, probando siguiente...`);
        }

      } catch (error: any) {
        lastError = error.message;
        console.error(`[Sync REST] Error con ${keyCode}:`, error.message);
        // Continuar con el siguiente reporte
        continue;
      }
    }

    // Si no se obtuvo ningún dato de ningún reporte
    if (allPolizas.length === 0) {
      throw new Error(`Ningún reporte funcionó. Último error: ${lastError}. Reportes intentados: ${reportCodes.join(', ')}`);
    }

    console.log(`[Sync REST] Total pólizas obtenidas: ${allPolizas.length}`);

    // Guardar en base de datos
    console.log('[Sync REST] Guardando en base de datos...');

    let inserted = 0;
    let errors = 0;

    // Procesar en lotes de 100
    const batchSize = 100;
    for (let i = 0; i < allPolizas.length; i += batchSize) {
      const batch = allPolizas.slice(i, i + batchSize);

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
          console.error('[Sync REST] Error en lote:', error);
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
      } catch (error: any) {
        console.error('[Sync REST] Error procesando lote:', error.message);
        errors += batch.length;
      }
    }

    console.log(`[Sync REST] Guardado: ${inserted} exitosos, ${errors} errores`);

    // Registrar en historial
    await supabase
      .from('sicas_production_sync_log')
      .insert({
        sync_type: 'polizas_vigentes_rest',
        status: errors === 0 ? 'success' : 'partial',
        records_fetched: allPolizas.length,
        records_inserted: inserted,
        records_updated: 0,
        records_errors: errors,
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        metadata: {
          source: 'SICAS REST API',
          successful_report: successfulReport,
          reports_attempted: reportCodes,
        },
      });

    const duration = Date.now() - startedAt.getTime();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          records_fetched: allPolizas.length,
          records_inserted: inserted,
          records_updated: 0,
          records_errors: errors,
          successful_report: successfulReport,
        },
        metadata: {
          synced_at: new Date().toISOString(),
          duration_ms: duration,
          source: 'SICAS REST API',
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
    console.error('[Sync REST] Error fatal:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
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
