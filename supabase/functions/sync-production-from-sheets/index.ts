import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[sync-production] Starting production sync...');

    // 1. Obtener configuración de Google Sheets
    const { data: config, error: configError } = await supabase
      .from('production_google_sheets_config')
      .select('*')
      .eq('activo', true)
      .maybeSingle();

    if (configError) {
      throw new Error(`Error obteniendo configuración: ${configError.message}`);
    }

    if (!config) {
      throw new Error('No hay una configuración activa de Google Sheets');
    }

    // 2. Crear batch de importación
    const { data: batch, error: batchError } = await supabase
      .from('production_import_batches')
      .insert({
        source_type: 'google_sheets',
        source_identifier: config.link_url,
        sheet_id: config.sheet_id,
        sheet_name: config.sheet_name || 'Sheet1',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Error creando batch: ${batchError.message}`);
    }

    console.log('[sync-production] Batch created:', batch.id);

    let rowsTotal = 0;
    let rowsInserted = 0;
    let rowsFailed = 0;
    let lastError: string | null = null;
    const errorDetails: any[] = [];

    try {
      // 3. Llamar a fetch-production-sheets
      const fetchUrl = `${supabaseUrl}/functions/v1/fetch-production-sheets`;
      const fetchResponse = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!fetchResponse.ok) {
        throw new Error(`Error fetching sheets: ${fetchResponse.status} ${fetchResponse.statusText}`);
      }

      const fetchResult = await fetchResponse.json();

      if (!fetchResult.success) {
        throw new Error(fetchResult.error || 'Error desconocido al obtener datos');
      }

      const records = fetchResult.records || [];
      rowsTotal = records.length;

      console.log('[sync-production] Fetched', rowsTotal, 'records from sheets');

      // 4. Insertar registros en production_records con batch_id
      if (records.length > 0) {
        // Insertar en batches de 500 para evitar timeouts
        const batchSize = 500;
        for (let i = 0; i < records.length; i += batchSize) {
          const chunk = records.slice(i, i + batchSize);
          
          const recordsToInsert = chunk.map((r: any) => ({
            ...r,
            batch_id: batch.id,
            pending_assignment: !r.agente_nombre || r.agente_nombre.trim() === '',
          }));

          const { error: insertError } = await supabase
            .from('production_records')
            .insert(recordsToInsert);

          if (insertError) {
            console.error('[sync-production] Insert error:', insertError);
            rowsFailed += chunk.length;
            errorDetails.push({
              chunk_start: i,
              chunk_end: i + batchSize,
              error: insertError.message,
            });
          } else {
            rowsInserted += chunk.length;
            console.log('[sync-production] Inserted chunk', i, '-', i + batchSize);
          }
        }
      }

      // 5. Actualizar batch con resultados
      const finalStatus = rowsFailed === 0 ? 'success' : (rowsInserted > 0 ? 'partial' : 'failed');
      
      lastError = rowsFailed > 0 ? `${rowsFailed} registros fallaron al insertar` : null;

      const { error: updateError } = await supabase
        .from('production_import_batches')
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          rows_total: rowsTotal,
          rows_inserted: rowsInserted,
          rows_failed: rowsFailed,
          last_error: lastError,
          error_details: errorDetails.length > 0 ? errorDetails : null,
        })
        .eq('id', batch.id);

      if (updateError) {
        console.error('[sync-production] Error updating batch:', updateError);
      }

      const duration = Date.now() - startTime;

      console.log('[sync-production] Sync completed in', duration, 'ms');
      console.log('[sync-production] Status:', finalStatus);
      console.log('[sync-production] Total:', rowsTotal, 'Inserted:', rowsInserted, 'Failed:', rowsFailed);

      return new Response(
        JSON.stringify({
          success: finalStatus !== 'failed',
          batch_id: batch.id,
          status: finalStatus,
          rows_total: rowsTotal,
          rows_inserted: rowsInserted,
          rows_failed: rowsFailed,
          duration_ms: duration,
          last_error: lastError,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (syncError: any) {
      // Si hay error durante el sync, actualizar batch como failed
      console.error('[sync-production] Sync error:', syncError);

      lastError = syncError.message || 'Error desconocido';

      await supabase
        .from('production_import_batches')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          rows_total: rowsTotal,
          rows_inserted: rowsInserted,
          rows_failed: rowsFailed,
          last_error: lastError,
        })
        .eq('id', batch.id);

      throw syncError;
    }

  } catch (error: any) {
    console.error('[sync-production] Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido durante la sincronización',
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
