import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, FilterCondition } from '../_shared/sicasSoapReportClient.ts';
import { createSicasRequestManager } from '../_shared/sicasRequestManager.ts';
import {
  getCursor,
  updateCursor,
  createSyncRun,
  updateSyncRun,
  mapVendorToUser,
  parseFloat,
  parseDate,
  generateHash,
} from '../_shared/sicasSyncUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncReceivablesRequest {
  keyCode?: string;
  itemsPerPage?: number;
}

const ITEMS_PER_PAGE = 100;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let runId: string | null = null;

  try {
    const body: SyncReceivablesRequest = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    const keyCode = body.keyCode || 'HAPPDATAL_D004';
    const itemsPerPage = body.itemsPerPage || ITEMS_PER_PAGE;

    console.log('[Sync Receivables] Iniciando sincronizacion SOAP...');
    console.log('[Sync Receivables] KeyCode:', keyCode);

    // Check circuit breaker
    const requestManager = createSicasRequestManager(supabase);
    const cbState = await requestManager.checkCircuitBreaker();
    if (cbState.is_open) {
      return new Response(
        JSON.stringify({
          success: false,
          transport: 'soap',
          error: 'SICAS esta respondiendo con errores o lentitud. Proceso pausado temporalmente.',
          circuit_breaker: cbState,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get SOAP credentials from sicas_config
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('soap_endpoint, soap_username, soap_password')
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      throw new Error('No se encontro configuracion SICAS. Configure las credenciales SOAP en sicas_config.');
    }

    const soapClient = new SicasSoapReportClient({
      // Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
      endpoint: config.soap_endpoint || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx',
      username: config.soap_username,
      password: config.soap_password,
    });

    const cursor = await getCursor(supabase, 'receivables', keyCode);
    console.log('[Sync Receivables] Cursor actual:', cursor);

    runId = await createSyncRun(supabase, {
      module: 'receivables',
      keycode: keyCode,
      report_name: 'Cobranza Pendiente',
      pages_requested: 0,
      items_per_page: itemsPerPage,
      records_fetched: 0,
      records_upserted: 0,
      records_failed: 0,
      status: 'running',
      started_at: new Date().toISOString(),
    });

    console.log('[Sync Receivables] Run ID:', runId);

    let currentPage = 1;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalFailed = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`[Sync Receivables] Procesando pagina ${currentPage}...`);

      const response = await soapClient.executeReport({
        keyCode,
        page: currentPage,
        itemsPerPage,
        sortField: 'DatDocumentos.FCaptura',
      });

      if (!response.success) {
        throw new Error(`Error en SICAS SOAP: ${response.message || 'Error desconocido'}`);
      }

      const records = response.records || [];
      console.log(`[Sync Receivables] Registros en pagina: ${records.length}`);

      if (records.length === 0) {
        hasMorePages = false;
        break;
      }

      totalFetched += records.length;

      for (const record of records) {
        try {
          const idDocto = record.IDDocto || record.iddocto || '';
          const poliza = record.Poliza || record.poliza || '';
          const vendNombre = record.VendNombre || record.vendnombre || '';

          if (!idDocto && !poliza) {
            console.warn('[Sync Receivables] Registro sin IDDocto ni Poliza, omitiendo');
            totalFailed++;
            continue;
          }

          const { usuario_id, oficina_id } = await mapVendorToUser(supabase, vendNombre);

          const rawHash = generateHash(record);

          const importePendiente = parseFloat(record.ImportePendiente || record.importependiente);
          const diasVencido = parseInt(record.DiasVencido || record.diasvencido || '0', 10);

          const receivableData = {
            vend_id: record.VendID || record.vendid || record.IDVend || '',
            vend_nombre: vendNombre,
            usuario_id,
            oficina_id,
            id_docto: idDocto,
            poliza,
            cliente: record.Cliente || record.cliente || '',
            importe_pendiente: importePendiente,
            importe_original: parseFloat(record.ImporteOriginal || record.importeoriginal),
            fecha_limite: parseDate(record.FechaLimite || record.fechalimite),
            fecha_vencimiento: parseDate(record.FechaVencimiento || record.fechavencimiento),
            estatus: record.Estatus || record.estatus || (importePendiente && importePendiente > 0 ? 'pendiente' : 'pagado'),
            dias_vencido: diasVencido || null,
            raw_data: record,
            raw_hash: rawHash,
            synced_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('sicas_receivables')
            .upsert(receivableData, {
              onConflict: 'id_docto,poliza,vend_nombre',
            });

          if (upsertError) {
            console.error('[Sync Receivables] Error upserting receivable:', upsertError);
            totalFailed++;
          } else {
            totalUpserted++;
          }
        } catch (error) {
          console.error('[Sync Receivables] Error procesando registro:', error);
          totalFailed++;
        }
      }

      // End-of-data detection
      if (records.length < itemsPerPage) {
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

    await updateCursor(supabase, 'receivables', keyCode, {
      last_success_at: finishedAt.toISOString(),
      last_cursor_date: new Date().toISOString(),
      last_page: currentPage,
      total_synced: totalUpserted,
      last_run_id: runId,
    });

    console.log('[Sync Receivables] Sincronizacion completada');
    console.log('[Sync Receivables] Total fetched:', totalFetched);
    console.log('[Sync Receivables] Total upserted:', totalUpserted);
    console.log('[Sync Receivables] Total failed:', totalFailed);

    return new Response(
      JSON.stringify({
        success: true,
        transport: 'soap',
        run_id: runId,
        summary: {
          pages_processed: currentPage,
          records_fetched: totalFetched,
          records_upserted: totalUpserted,
          records_failed: totalFailed,
          duration_seconds: durationSeconds,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Sync Receivables] Error:', error);

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
        transport: 'soap',
        error: (error as Error).message,
        run_id: runId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
