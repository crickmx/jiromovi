import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClient } from '../_shared/sicasRestClient.ts';

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
    console.log('[SICAS Basic] Iniciando sincronización básica vía REST API...');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Inicializar cliente REST de SICAS
    const sicasClient = createSicasRestClient();

    console.log('[SICAS Basic] Obteniendo pólizas vigentes...');

    // Obtener pólizas vigentes usando el reporte SICAS_PRODUCTIVIDAD_CONSULTAVENDEDOR
    // Este reporte obtiene las pólizas activas
    const response = await sicasClient.readReport({
      keyCode: 'SICAS_PRODUCTIVIDAD_CONSULTAVENDEDOR',
      pageRequested: 1,
      itemsForPage: 500,
      formatResponse: 2,
      sortFields: 'FCaptura DESC',
    });

    if (!response.Sucess) {
      throw new Error(`Error en SICAS API: ${response.Error || 'Unknown error'}`);
    }

    console.log('[SICAS Basic] Respuesta recibida, procesando datos...');

    // Extraer datos del reporte
    const tableInfo = response.Response?.[0]?.TableInfo;
    if (!tableInfo || tableInfo.length === 0) {
      console.log('[SICAS Basic] ⚠️ No se encontraron registros');
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
    const polizas: PolizaBasica[] = tableInfo.map((record: any) => ({
      id_documento: record.IdCaptura || `DOC_${Date.now()}_${Math.random()}`,
      no_poliza: record.NoPoliza || null,
      vend_id: record.IdVendedor || '0',
      vend_nombre: record.VendedorNombre || null,
      desp_id: record.IdDespacho || null,
      desp_nombre: record.DespachoNombre || null,
      aseguradora: record.AseguradoraNombre || null,
      ramo: record.RamoNombre || null,
      contratante: record.Contratante || null,
      vigencia_desde: record.VigenciaDesde || null,
      vigencia_hasta: record.VigenciaHasta || null,
      prima_total: record.Importe ? parseFloat(record.Importe) : null,
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
        message: `Sincronización básica completada. ${polizas.length} pólizas sincronizadas.`,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronización básica completada',
        polizas_sincronizadas: polizas.length,
        polizas: polizas.slice(0, 10), // Solo mostrar las primeras 10 para no saturar la respuesta
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
