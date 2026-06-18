import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, FilterCondition } from '../_shared/sicasSoapReportClient.ts';
import { createSicasRequestManager } from '../_shared/sicasRequestManager.ts';
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
  getPeriodKey,
} from '../_shared/sicasSyncUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncCommissionsRequest {
  source?: 'pendiente' | 'pagada';
  keyCode?: string;
  fromDate?: string;
  toDate?: string;
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
    const body: SyncCommissionsRequest = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    const source = body.source || 'pendiente';
    const keyCode = body.keyCode || (source === 'pendiente' ? 'H03492_ALL' : 'H03797');
    const itemsPerPage = body.itemsPerPage || ITEMS_PER_PAGE;

    console.log('[Sync Commissions] Iniciando sincronizacion SOAP...');
    console.log('[Sync Commissions] Source:', source);
    console.log('[Sync Commissions] KeyCode:', keyCode);

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

    const cursor = await getCursor(supabase, 'commissions', keyCode);
    console.log('[Sync Commissions] Cursor actual:', cursor);

    let fromDate: Date;
    let toDate = new Date();

    if (body.fromDate) {
      fromDate = new Date(body.fromDate);
    } else if (cursor?.last_cursor_date) {
      fromDate = new Date(cursor.last_cursor_date);
      fromDate.setDate(fromDate.getDate() - (cursor.incremental_days_buffer || 2));
    } else {
      fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 1);
    }

    if (body.toDate) {
      toDate = new Date(body.toDate);
    }

    const fromDateStr = formatDateForSicas(fromDate);
    const toDateStr = formatDateForSicas(toDate);

    console.log('[Sync Commissions] Periodo:', fromDateStr, 'a', toDateStr);

    runId = await createSyncRun(supabase, {
      module: 'commissions',
      keycode: keyCode,
      report_name: `Comisiones ${source}`,
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

    console.log('[Sync Commissions] Run ID:', runId);

    // Build date filter for SOAP
    const dateField = source === 'pendiente' ? 'DatDocumentos.FCaptura' : 'DatDocumentos.FCaptura';
    const fromFormatted = `${String(fromDate.getDate()).padStart(2, '0')}/${String(fromDate.getMonth() + 1).padStart(2, '0')}/${fromDate.getFullYear()} 00:00`;
    const toFormatted = `${String(toDate.getDate()).padStart(2, '0')}/${String(toDate.getMonth() + 1).padStart(2, '0')}/${toDate.getFullYear()} 23:59`;

    const filters: FilterCondition[] = [
      {
        name: 'Desde|Hasta|Captura',
        type: 3,
        subtype: 1,
        values: [fromFormatted, toFormatted],
        texts: [fromFormatted, toFormatted],
        flag1: 0,
        flag2: -1,
        fieldDb: dateField,
      },
    ];

    let currentPage = 1;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalFailed = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`[Sync Commissions] Procesando pagina ${currentPage}...`);

      const response = await soapClient.executeReport({
        keyCode,
        page: currentPage,
        itemsPerPage,
        sortField: 'DatDocumentos.FCaptura',
        filters,
      });

      if (!response.success) {
        throw new Error(`Error en SICAS SOAP: ${response.message || 'Error desconocido'}`);
      }

      const records = response.records || [];
      console.log(`[Sync Commissions] Registros en pagina: ${records.length}`);

      if (records.length === 0) {
        hasMorePages = false;
        break;
      }

      totalFetched += records.length;

      for (const record of records) {
        try {
          const vendNombre = record.VendNombre || record.vendnombre || '';
          const documentoPoliza = record.Documento || record.Poliza || record.documento || record.poliza || '';

          if (!vendNombre || !documentoPoliza) {
            console.warn('[Sync Commissions] Registro sin VendNombre o Documento, omitiendo');
            totalFailed++;
            continue;
          }

          const { usuario_id, oficina_id } = await mapVendorToUser(supabase, vendNombre);

          const fechaCorte = parseDate(record.FechaCorte || record.fechacorte);
          const fechaPago = parseDate(record.FechaPago || record.fechapago);

          const periodKey = record.Periodo || (fechaCorte
            ? getPeriodKey(new Date(fechaCorte))
            : (fechaPago ? getPeriodKey(new Date(fechaPago)) : 'unknown'));

          const rawHash = generateHash(record);

          const commissionData = {
            source,
            period_key: periodKey,
            vend_id: record.VendID || record.vendid || record.IDVend || '',
            vend_nombre: vendNombre,
            usuario_id,
            oficina_id,
            id_docto: record.IDDocto || record.iddocto || '',
            documento_poliza: documentoPoliza,
            importe: parseFloat(record.Importe || record.importe),
            base_comision: parseFloat(record.BaseComision || record.basecomision),
            comision: parseFloat(record.Comision || record.comision),
            isr: parseFloat(record.ISR || record.isr),
            iva: parseFloat(record.IVA || record.iva),
            retenciones: parseFloat(record.Retenciones || record.retenciones),
            neto_pagar: parseFloat(record.NetoPagar || record.netopagar),
            fecha_pago: fechaPago,
            fecha_corte: fechaCorte,
            raw_data: record,
            raw_hash: rawHash,
            synced_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('sicas_commissions')
            .upsert(commissionData, {
              onConflict: 'source,period_key,vend_nombre,documento_poliza',
            });

          if (upsertError) {
            console.error('[Sync Commissions] Error upserting commission:', upsertError);
            totalFailed++;
          } else {
            totalUpserted++;
          }
        } catch (error) {
          console.error('[Sync Commissions] Error procesando registro:', error);
          totalFailed++;
        }
      }

      // End-of-data detection: if fewer records than page size, no more pages
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

    await updateCursor(supabase, 'commissions', keyCode, {
      last_success_at: finishedAt.toISOString(),
      last_cursor_date: toDate.toISOString(),
      last_page: currentPage,
      total_synced: totalUpserted,
      last_run_id: runId,
    });

    console.log('[Sync Commissions] Sincronizacion completada');
    console.log('[Sync Commissions] Total fetched:', totalFetched);
    console.log('[Sync Commissions] Total upserted:', totalUpserted);
    console.log('[Sync Commissions] Total failed:', totalFailed);

    return new Response(
      JSON.stringify({
        success: true,
        transport: 'soap',
        run_id: runId,
        summary: {
          source,
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
    console.error('[Sync Commissions] Error:', error);

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
