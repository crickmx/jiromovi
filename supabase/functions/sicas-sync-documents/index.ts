import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClient } from '../_shared/sicasRestClient.ts';
import {
  getCursor,
  updateCursor,
  createSyncRun,
  updateSyncRun,
  mapVendorToUser,
  formatDateForSicas,
  parseFloat,
  parseDate,
  generateHash,
} from '../_shared/sicasSyncUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncDocumentsRequest {
  keyCode?: string;
  fromDate?: string;
  toDate?: string;
  itemsPerPage?: number;
  fieldsRequested?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let runId: string | null = null;

  try {
    const body: SyncDocumentsRequest = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    const keyCode = body.keyCode || 'H03117';
    const itemsPerPage = body.itemsPerPage || 100;

    const fieldsRequested = body.fieldsRequested || [
      'IDDocto',
      'VendNombre',
      'DespNombre',
      'Ramo',
      'SubRamo',
      'Compania',
      'Poliza',
      'Cliente',
      'FechaCaptura',
      'FechaEmision',
      'VigenciaDesde',
      'VigenciaHasta',
      'Importe',
      'PrimaNeta',
    ].join(',');

    console.log('[Sync Documents] Iniciando sincronización...');
    console.log('[Sync Documents] KeyCode:', keyCode);

    const cursor = await getCursor(supabase, 'documents', keyCode);
    console.log('[Sync Documents] Cursor actual:', cursor);

    let fromDate: Date;
    let toDate = new Date();

    if (body.fromDate) {
      fromDate = new Date(body.fromDate);
    } else if (cursor?.last_cursor_date) {
      fromDate = new Date(cursor.last_cursor_date);
      fromDate.setDate(fromDate.getDate() - (cursor.incremental_days_buffer || 2));
    } else {
      fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
    }

    if (body.toDate) {
      toDate = new Date(body.toDate);
    }

    const fromDateStr = formatDateForSicas(fromDate);
    const toDateStr = formatDateForSicas(toDate);

    console.log('[Sync Documents] Periodo:', fromDateStr, 'a', toDateStr);

    runId = await createSyncRun(supabase, {
      module: 'documents',
      keycode: keyCode,
      report_name: 'Documentos/Producción',
      from_date: fromDate.toISOString(),
      to_date: toDate.toISOString(),
      pages_requested: 0,
      items_per_page: itemsPerPage,
      records_fetched: 0,
      records_upserted: 0,
      records_failed: 0,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    console.log('[Sync Documents] Run ID:', runId);

    const client = createSicasRestClient();

    let currentPage = 1;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalFailed = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`[Sync Documents] Procesando página ${currentPage}...`);

      const conditionsDirect = `FechaCaptura >= '${fromDateStr}' AND FechaCaptura <= '${toDateStr}'`;

      const response = await client.readReport({
        keyCode,
        pageRequested: currentPage,
        itemsForPage: itemsPerPage,
        fieldsRequested,
        formatResponse: 2,
        conditionsDirect,
        sortFields: 'FechaCaptura DESC',
      });

      console.log('[Sync Documents] Response Success:', response.Sucess);
      console.log('[Sync Documents] Response Error:', response.Error);

      if (!response.Sucess) {
        const errorMsg = response.Error || 'Error desconocido';
        console.error('[Sync Documents] ❌ Error de SICAS:', errorMsg);
        console.error('[Sync Documents] Detalles de la solicitud:', {
          keyCode,
          pageRequested: currentPage,
          conditionsDirect,
          fieldsRequested: fieldsRequested.substring(0, 100) + '...'
        });
        throw new Error(`Error en SICAS: ${errorMsg}`);
      }

      if (!response.Response || !Array.isArray(response.Response) || response.Response.length === 0) {
        console.warn('[Sync Documents] ⚠️ Respuesta vacía de SICAS');
        hasMorePages = false;
        break;
      }

      const tableInfo = response.Response[0]?.TableInfo || [];
      const tableControl = response.Response[0]?.TableControl?.[0];

      console.log(`[Sync Documents] Registros en página: ${tableInfo.length}`);
      console.log(`[Sync Documents] Control:`, tableControl);

      if (tableInfo.length === 0) {
        hasMorePages = false;
        break;
      }

      totalFetched += tableInfo.length;

      for (const record of tableInfo) {
        try {
          const idDocto = record.IDDocto || record.iddocto;
          if (!idDocto) {
            console.warn('[Sync Documents] Registro sin IDDocto, omitiendo:', record);
            totalFailed++;
            continue;
          }

          const vendNombre = record.VendNombre || record.vendnombre || '';
          const { usuario_id, oficina_id } = await mapVendorToUser(supabase, vendNombre);

          const rawHash = generateHash(record);

          const documentData = {
            id_docto: idDocto,
            vend_id: record.VendID || record.vendid,
            vend_nombre: vendNombre,
            usuario_id,
            oficina_id,
            desp_nombre: record.DespNombre || record.despnombre,
            ramo: record.Ramo || record.ramo,
            subramo: record.SubRamo || record.subramo,
            compania: record.Compania || record.compania,
            poliza: record.Poliza || record.poliza,
            cliente: record.Cliente || record.cliente,
            fecha_captura: parseDate(record.FechaCaptura || record.fechacaptura),
            fecha_emision: parseDate(record.FechaEmision || record.fechaemision),
            vigencia_desde: parseDate(record.VigenciaDesde || record.vigenciadesde),
            vigencia_hasta: parseDate(record.VigenciaHasta || record.vigenciahasta),
            importe: parseFloat(record.Importe || record.importe),
            prima_neta: parseFloat(record.PrimaNeta || record.primaneta),
            raw_data: record,
            raw_hash: rawHash,
            synced_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('sicas_documents')
            .upsert(documentData, {
              onConflict: 'id_docto',
            });

          if (upsertError) {
            console.error('[Sync Documents] Error upserting document:', upsertError);
            totalFailed++;
          } else {
            totalUpserted++;
          }
        } catch (error) {
          console.error('[Sync Documents] Error procesando registro:', error);
          totalFailed++;
        }
      }

      if (!tableControl || currentPage >= tableControl.Pages) {
        hasMorePages = false;
      } else {
        currentPage++;
      }

      await updateSyncRun(supabase, runId, {
        pages_requested: currentPage,
        records_fetched: totalFetched,
        records_upserted: totalUpserted,
        records_failed: totalFailed,
      });
    }

    const finishedAt = new Date();
    const startedAt = new Date((await supabase
      .from('sicas_sync_runs')
      .select('started_at')
      .eq('run_id', runId)
      .single()).data?.started_at || finishedAt);

    const durationSeconds = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000);

    await updateSyncRun(supabase, runId, {
      status: totalFailed > 0 ? 'partial' : 'success',
      finished_at: finishedAt.toISOString(),
      duration_seconds: durationSeconds,
    });

    await updateCursor(supabase, 'documents', keyCode, {
      last_success_at: finishedAt.toISOString(),
      last_cursor_date: toDate.toISOString(),
      last_page: currentPage,
      total_synced: totalUpserted,
      last_run_id: runId,
    });

    console.log('[Sync Documents] ✅ Sincronización completada');
    console.log('[Sync Documents] Total fetched:', totalFetched);
    console.log('[Sync Documents] Total upserted:', totalUpserted);
    console.log('[Sync Documents] Total failed:', totalFailed);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        summary: {
          pages_processed: currentPage,
          records_fetched: totalFetched,
          records_upserted: totalUpserted,
          records_failed: totalFailed,
          duration_seconds: durationSeconds,
          from_date: fromDateStr,
          to_date: toDateStr,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Sync Documents] ❌ Error:', error);

    if (runId) {
      const finishedAt = new Date();
      const startedAt = new Date((await supabase
        .from('sicas_sync_runs')
        .select('started_at')
        .eq('run_id', runId)
        .single()).data?.started_at || finishedAt);

      const durationSeconds = Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000);

      await updateSyncRun(supabase, runId, {
        status: 'failed',
        error_message: (error as Error).message,
        finished_at: finishedAt.toISOString(),
        duration_seconds: durationSeconds,
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        stack: (error as Error).stack,
        run_id: runId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
