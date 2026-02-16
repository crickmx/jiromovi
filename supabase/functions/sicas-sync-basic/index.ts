import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PolizaBasica {
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  contratante: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_total: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[SICAS Basic] Iniciando sincronización básica usando ProcesarWS oficial...');
    console.log(`[SICAS Basic] Usando KeyCode: ${SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar credenciales SICAS
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas (SICAS_USERNAME, SICAS_PASSWORD)');
    }

    console.log('[SICAS Basic] Credenciales configuradas, inicializando cliente SOAP...');

    // Inicializar cliente SOAP con ProcesarWS (método oficial)
    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // Construir filtros según documentación oficial
    const filters = [
      // Filtro de estatus vigente (documentos activos)
      SicasSoapReportClient.createStatusVicenteFilter(),
      // Filtro de tipo de documento (solo pólizas, no endosos)
      SicasSoapReportClient.createDocumentTypeFilter(),
    ];

    console.log(`[SICAS Basic] Obteniendo pólizas vigentes con ${filters.length} filtros...`);

    // Ejecutar reporte oficial
    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page: 1,
      itemsPerPage: 500,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters,
    });

    console.log(`[SICAS Basic] Respuesta recibida - Success: ${result.success}`);
    console.log(`[SICAS Basic] Registros encontrados: ${result.records.length}`);

    if (!result.success) {
      throw new Error(`Error en SICAS API: ${result.message}`);
    }

    if (result.records.length === 0) {
      console.log('[SICAS Basic] No se encontraron registros');
      await supabase
        .from('sicas_sync_history')
        .insert({
          sync_type: 'basic',
          status: 'success',
          records_synced: 0,
          message: 'Sincronización completada sin registros',
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No se encontraron registros',
          polizas_sincronizadas: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Convertir los datos al formato esperado
    const polizas: PolizaBasica[] = result.records.map((record: any) => ({
      id_documento: record.IdDocumento || record.IDDocto || `DOC_${Date.now()}_${Math.random()}`,
      no_poliza: record.Documento || record.NoPoliza || record.Poliza || null,
      vend_id: record.IDVend || record.IdVendedor || '0',
      vend_nombre: record.VendNombre || record.Vendedor || record.NombreVendedor || null,
      desp_id: record.IDDesp || record.IdDespacho || null,
      desp_nombre: record.DespNombre || record.Despacho || record.Oficina || null,
      aseguradora: record.CiaNombre || record.Aseguradora || record.Compania || null,
      ramo: record.RamoNombre || record.Ramo || null,
      contratante: record.Contratante || record.Cliente || null,
      vigencia_desde: record.FDesde || record.VigenciaDesde || null,
      vigencia_hasta: record.FHasta || record.VigenciaHasta || null,
      prima_total: record.Importe || record.PrimaTotal || null,
    }));

    console.log(`[SICAS Basic] Procesadas ${polizas.length} pólizas`);

    // Guardar en sicas_mirror_polizas
    if (polizas.length > 0) {
      const { error: insertError } = await supabase
        .from('sicas_mirror_polizas')
        .upsert(
          polizas.map(p => ({
            id_documento: p.id_documento,
            no_poliza: p.no_poliza,
            vend_id: p.vend_id,
            vend_nombre: p.vend_nombre,
            desp_id: p.desp_id,
            desp_nombre: p.desp_nombre,
            aseguradora: p.aseguradora,
            ramo: p.ramo,
            contratante: p.contratante,
            vigencia_desde: p.vigencia_desde,
            vigencia_hasta: p.vigencia_hasta,
            prima_total: p.prima_total,
            sincronizado_en: new Date().toISOString(),
          })),
          { onConflict: 'id_documento' }
        );

      if (insertError) {
        console.error('[SICAS Basic] Error al guardar pólizas:', insertError);
        throw insertError;
      }

      console.log(`[SICAS Basic] ✅ ${polizas.length} pólizas guardadas en sicas_mirror_polizas`);
    }

    // Registrar sincronización en historial
    await supabase
      .from('sicas_sync_history')
      .insert({
        sync_type: 'basic',
        status: 'success',
        records_synced: polizas.length,
        message: `Sincronización básica completada. ${polizas.length} pólizas sincronizadas vía ProcesarWS oficial.`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronización básica completada',
        polizas_sincronizadas: polizas.length,
        polizas: polizas.slice(0, 10), // Solo mostrar las primeras 10
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SICAS Basic] Error:', error);

    // Registrar error en historial
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('sicas_sync_history')
        .insert({
          sync_type: 'basic',
          status: 'error',
          records_synced: 0,
          error_message: (error as Error).message,
        });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
