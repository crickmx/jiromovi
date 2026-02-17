import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[SICAS Sync] 🔵 Iniciando sincronización de pólizas vigentes');

    // Inicializar Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Crear run de sincronización
    const { data: run, error: runError } = await supabase
      .from('sicas_sync_runs')
      .insert({
        module: 'documents',
        keycode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
        report_name: 'Pólizas Vigentes',
        items_per_page: 50,
      })
      .select()
      .single();

    if (runError) throw runError;

    console.log('[SICAS Sync] ✅ Run creado:', run.run_id);

    // Verificar credenciales SICAS
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_SOAP_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    console.log('[SICAS Sync] ✅ Credenciales configuradas');

    // Inicializar cliente SOAP
    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // Calcular rango de fechas (últimos 6 meses hasta hoy + 6 meses adelante)
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const sixMonthsAhead = new Date(today);
    sixMonthsAhead.setMonth(today.getMonth() + 6);

    const dateFrom = sixMonthsAgo.toISOString().split('T')[0].split('-').reverse().join('/');
    const dateTo = sixMonthsAhead.toISOString().split('T')[0].split('-').reverse().join('/');

    // Construir filtros para pólizas vigentes
    const filters = [
      SicasSoapReportClient.createStatusVicenteFilter(),
      SicasSoapReportClient.createDocumentTypeFilter(),
      SicasSoapReportClient.createDateRangeFilter(
        dateFrom,
        dateTo,
        dateFrom,
        dateTo,
        'DatDocumentos.FDesde'
      ),
    ];

    console.log('[SICAS Sync] 📋 Filtros:');
    console.log(`  - Fecha desde: ${dateFrom}`);
    console.log(`  - Fecha hasta: ${dateTo}`);
    console.log(`  - Solo vigentes, solo pólizas`);

    // Ejecutar reporte (solo primera página para empezar)
    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page: 1,
      itemsPerPage: 50,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters,
    });

    console.log('[SICAS Sync] 📥 Respuesta de SICAS:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Total records: ${result.totalRecords}`);
    console.log(`  - Registros parseados: ${result.records.length}`);

    if (!result.success) {
      throw new Error(`Error en SICAS: ${result.message}`);
    }

    let insertedCount = 0;
    let updatedCount = 0;

    if (result.records.length > 0) {
      // Mapear vendedores a usuarios
      const { data: vendorMappings } = await supabase
        .from('sicas_mapeo_vendedores')
        .select('vend_nombre, usuario_id, usuarios(oficina_id)');

      const vendorMap = new Map(
        vendorMappings?.map(v => [
          v.vend_nombre?.toLowerCase().trim(),
          { usuario_id: v.usuario_id, oficina_id: v.usuarios?.oficina_id }
        ])
      );

      // Preparar datos para insertar
      const documents = result.records.map((record: any) => {
        const vendNombre = (record.VendNombre || record.Vendedor || '').trim();
        const mapping = vendorMap.get(vendNombre.toLowerCase());

        return {
          id_docto: record.IdDocumento || record.IDDocto || `DOC_${Date.now()}_${Math.random()}`,
          vend_id: record.IDVend || record.IdVendedor || null,
          vend_nombre: vendNombre || null,
          usuario_id: mapping?.usuario_id || null,
          oficina_id: mapping?.oficina_id || null,
          desp_nombre: record.DespNombre || record.Despacho || null,
          ramo: record.RamoNombre || record.Ramo || null,
          subramo: record.SubramoNombre || record.Subramo || null,
          compania: record.CiaNombre || record.Aseguradora || null,
          poliza: record.Documento || record.NoPoliza || null,
          cliente: record.Contratante || record.Cliente || null,
          fecha_captura: record.FCaptura || null,
          fecha_emision: record.FEmision || null,
          vigencia_desde: record.FDesde || null,
          vigencia_hasta: record.FHasta || null,
          importe: parseFloat(record.Importe) || 0,
          prima_neta: parseFloat(record.PrimaNeta) || 0,
          raw_data: record,
          raw_hash: JSON.stringify(record),
          synced_at: new Date().toISOString(),
        };
      });

      // Insertar o actualizar en DB
      const { data: upserted, error: upsertError } = await supabase
        .from('sicas_documents')
        .upsert(documents, {
          onConflict: 'id_docto',
          ignoreDuplicates: false
        })
        .select('id');

      if (upsertError) {
        console.error('[SICAS Sync] Error al guardar:', upsertError);
        throw upsertError;
      }

      insertedCount = upserted?.length || 0;
      console.log(`[SICAS Sync] ✅ Guardados ${insertedCount} documentos`);
    }

    // Actualizar run como exitoso
    await supabase
      .from('sicas_sync_runs')
      .update({
        status: 'success',
        records_fetched: result.records.length,
        records_upserted: insertedCount,
        finished_at: new Date().toISOString(),
      })
      .eq('run_id', run.run_id);

    // Actualizar cursor
    await supabase
      .from('sicas_sync_cursors')
      .upsert({
        module: 'documents',
        keycode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
        last_success_at: new Date().toISOString(),
        last_cursor_date: new Date().toISOString(),
        total_synced: insertedCount,
        last_run_id: run.run_id,
      }, {
        onConflict: 'module,keycode'
      });

    console.log('[SICAS Sync] ✅ Sincronización completada');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sincronización completada exitosamente',
        stats: {
          total_fetched: result.totalRecords,
          records_synced: insertedCount,
          run_id: run.run_id,
        },
        first_record_sample: result.records.length > 0 ? result.records[0] : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[SICAS Sync] Error:', error);

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
