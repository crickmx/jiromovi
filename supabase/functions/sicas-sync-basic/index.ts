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
    console.log('========================================');
    console.log('[SICAS Basic] 🔵 INICIANDO SINCRONIZACIÓN BÁSICA');
    console.log('========================================');
    console.log(`[SICAS Basic] KeyCode: ${SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES}`);

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

    console.log('[SICAS Basic] ✅ Credenciales configuradas');
    console.log('[SICAS Basic] Endpoint:', sicasEndpoint);
    console.log('[SICAS Basic] Usuario:', sicasUsername);

    // Inicializar cliente SOAP con ProcesarWS (método oficial)
    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // 🔥 PRUEBA MÍNIMA: Rango amplio de fechas + límite de 10 registros
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const dateFrom = oneYearAgo.toISOString().split('T')[0].split('-').reverse().join('/');
    const dateTo = today.toISOString().split('T')[0].split('-').reverse().join('/');

    // Construir filtros
    const filters = [
      // Filtro de estatus vigente
      SicasSoapReportClient.createStatusVicenteFilter(),
      // Filtro de tipo de documento (solo pólizas)
      SicasSoapReportClient.createDocumentTypeFilter(),
      // Filtro de fechas amplio
      SicasSoapReportClient.createDateRangeFilter(
        dateFrom,
        dateTo,
        dateFrom,
        dateTo,
        'DatDocumentos.FDesde'
      ),
    ];

    console.log('[SICAS Basic] 📋 Filtros aplicados:');
    console.log(`  - Estatus: Vigentes`);
    console.log(`  - Tipo: Pólizas`);
    console.log(`  - Fecha desde: ${dateFrom}`);
    console.log(`  - Fecha hasta: ${dateTo}`);
    console.log('[SICAS Basic] 🔍 Solicitando máximo 10 registros para diagnóstico...');

    // Ejecutar reporte con límite de 10 para diagnóstico
    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page: 1,
      itemsPerPage: 10,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters,
    });

    console.log('========================================');
    console.log('[SICAS Basic] 📥 RESULTADO DE SICAS');
    console.log('========================================');
    console.log('[SICAS Basic] Success:', result.success);
    console.log('[SICAS Basic] ResponseNbr:', result.responseNbr);
    console.log('[SICAS Basic] Message:', result.message || '(vacío)');
    console.log('[SICAS Basic] Total Records:', result.totalRecords);
    console.log('[SICAS Basic] Registros parseados:', result.records.length);

    if (result.rawXml) {
      console.log('[SICAS Basic] Raw XML length:', result.rawXml.length, 'chars');
    }

    // 🔥 DIAGNÓSTICO: Preparar respuesta con toda la info
    const diagnosticInfo = {
      report_code: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      request_meta: {
        page: 1,
        items_per_page: 10,
        date_from: dateFrom,
        date_to: dateTo,
        filters_count: filters.length,
      },
      processdata: {
        response_txt: result.success ? 'SUCESS' : 'ERROR',
        response_nbr: result.responseNbr,
        message: result.message || '',
      },
      dataset_info: {
        raw_xml_length: result.rawXml?.length || 0,
        total_records: result.totalRecords || 0,
        parsed_records: result.records.length,
      },
      first_record_sample: result.records.length > 0 ? result.records[0] : null,
    };

    console.log('[SICAS Basic] 📊 DIAGNÓSTICO COMPLETO:');
    console.log(JSON.stringify(diagnosticInfo, null, 2));

    // 🔥 CRÍTICO: Detectar si MESSAGE tiene error
    if (result.message && (
      result.message.toLowerCase().includes('error en ejecución') ||
      result.message.toLowerCase().includes('variable de objeto') ||
      result.message.toLowerCase().includes('denied')
    )) {
      console.error('[SICAS Basic] ❌ ERROR DETECTADO EN MESSAGE');

      await supabase
        .from('sicas_sync_history')
        .insert({
          sync_type: 'basic',
          status: 'error',
          records_synced: 0,
          error_message: result.message,
        });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Error en SICAS: ${result.message}`,
          diagnostic: diagnosticInfo,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!result.success) {
      throw new Error(`Error en SICAS API: ${result.message}`);
    }

    if (result.records.length === 0) {
      console.log('[SICAS Basic] ⚠️ NO SE ENCONTRARON REGISTROS');
      console.log('[SICAS Basic] Esto puede significar:');
      console.log('  1. SICAS devolvió 0 filas reales');
      console.log('  2. El parser no encontró las tablas correctas');
      console.log('  3. Los filtros son muy restrictivos');

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
          diagnostic: diagnosticInfo,
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
