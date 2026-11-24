import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClientWithDbAuth } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SicasTableInfo {
  [key: string]: any;
}

interface SicasTableControl {
  MaxRecords: number;
  Pages: number;
  Page: number;
  ItemForPage: number;
}

interface SicasReportResponse {
  Response: Array<{
    TableInfo?: SicasTableInfo[];
    TableControl?: SicasTableControl[];
  }>;
  Sucess: boolean;
  Error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const syncStartedAt = new Date().toISOString();
  let syncHistoryId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { catalog_type_id, page_requested = 1, items_per_page = -1 } = body;

    if (!catalog_type_id || catalog_type_id < 1 || catalog_type_id > 96) {
      throw new Error('Invalid catalog_type_id. Must be between 1 and 96');
    }

    const dryRun = body?.dryRun === true;
    const debug = body?.debug === true;

    // Obtener información del catálogo
    const { data: catalogType, error: catalogError } = await supabase
      .from('sicas_catalog_types')
      .select('*')
      .eq('id', catalog_type_id)
      .single();

    if (catalogError || !catalogType) {
      throw new Error(`Catálogo tipo ${catalog_type_id} no encontrado en base de datos`);
    }

    // Validar que el catálogo tenga rest_keycode configurado
    if (!catalogType.rest_keycode) {
      throw new Error(`El catálogo "${catalogType.name}" no tiene rest_keycode configurado. Configure el KeyCode REST API primero.`);
    }

    console.log(`[SICAS REST Sync] Sincronizando: ${catalogType.name} (ID ${catalog_type_id})`);
    console.log(`[SICAS REST Sync] REST KeyCode: ${catalogType.rest_keycode}`);

    // Crear registro de historial
    const { data: historyRecord, error: historyError } = await supabase
      .from('sicas_sync_history')
      .insert({
        catalog_type_id,
        sync_started_at: syncStartedAt,
        status: 'running',
        request_payload: {
          catalog_type_id,
          catalog_name: catalogType.name,
          rest_keycode: catalogType.rest_keycode,
          method: 'REST',
        },
      })
      .select()
      .single();

    if (!historyError && historyRecord) {
      syncHistoryId = historyRecord.id;
    }

    // Inicializar cliente REST
    const restClient = await createSicasRestClientWithDbAuth();

    console.log('[SICAS REST Sync] Iniciando petición REST API...');

    // Realizar petición REST API según documentación oficial (páginas 27-31)
    const reportResponse = await restClient.readReport({
      keyCode: catalogType.rest_keycode,
      pageRequested: page_requested,
      itemsForPage: items_per_page,
      formatResponse: 0, // 0 = JSON (según PDF)
    });

    console.log('[SICAS REST Sync] Respuesta recibida');
    console.log('[SICAS REST Sync] Success:', reportResponse.Sucess);

    // Verificar si hay error en la respuesta
    if (reportResponse.Error) {
      throw new Error(`SICAS API Error: ${reportResponse.Error}`);
    }

    if (!reportResponse.Sucess) {
      throw new Error('La petición REST API no fue exitosa');
    }

    // Extraer TableInfo y TableControl de la respuesta
    let tableInfo: SicasTableInfo[] = [];
    let tableControl: SicasTableControl | null = null;

    if (reportResponse.Response && reportResponse.Response.length > 0) {
      for (const responseItem of reportResponse.Response) {
        if (responseItem.TableInfo) {
          tableInfo = responseItem.TableInfo;
        }
        if (responseItem.TableControl && responseItem.TableControl.length > 0) {
          tableControl = responseItem.TableControl[0];
        }
      }
    }

    console.log(`[SICAS REST Sync] Registros encontrados: ${tableInfo.length}`);
    if (tableControl) {
      console.log(`[SICAS REST Sync] Total en servidor: ${tableControl.MaxRecords}, Página: ${tableControl.Page}/${tableControl.Pages}`);
    }

    // Si no hay datos, marcar como catálogo vacío
    if (tableInfo.length === 0) {
      console.log('[SICAS REST Sync] Catálogo vacío o sin datos disponibles');

      if (syncHistoryId) {
        await supabase
          .from('sicas_sync_history')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            catalog_status: 'not_available',
            records_found: 0,
            records_inserted: 0,
            records_updated: 0,
            records_failed: 0,
            error_message: 'Catálogo sin datos disponibles',
          })
          .eq('id', syncHistoryId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          catalog_type_id,
          catalog_name: catalogType.name,
          catalog_status: 'not_available',
          method: 'REST',
          warning: 'Catálogo sin datos disponibles',
          stats: {
            totalRows: 0,
            inserted: 0,
            updated: 0,
            failed: 0,
          },
          pagination: tableControl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parsear registros
    const records = tableInfo.map((record: any) => {
      // Buscar un campo ID adecuado
      const id_sicas =
        record.ID ||
        record.Id ||
        record.IDDespacho ||
        record.IDAgente ||
        record.IDVendedor ||
        record.IDOficina ||
        record.IDContacto ||
        Object.values(record)[0]; // Usar el primer campo como fallback

      // Buscar un campo nombre adecuado
      const nombre =
        record.Nombre ||
        record.Name ||
        record.NombreCompleto ||
        record.Descripcion ||
        record.Description ||
        record.nombre ||
        String(id_sicas);

      return {
        id_sicas: String(id_sicas),
        nombre: String(nombre),
        raw: record,
        metadata: {
          sync_method: 'rest',
          rest_keycode: catalogType.rest_keycode,
        },
      };
    });

    console.log(`[SICAS REST Sync] Registros parseados: ${records.length}`);

    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    if (dryRun) {
      console.log('[SICAS REST Sync] DRY RUN: omitiendo upsert');
    } else {
      console.log(`[SICAS REST Sync] Procesando ${records.length} registros en lote...`);

      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[SICAS REST Sync] Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} registros)`);

        const existingIds = new Set<string>();

        const { data: existingRecords } = await supabase
          .from('sicas_catalogos')
          .select('id, id_sicas')
          .eq('catalog_type_id', catalog_type_id)
          .in('id_sicas', batch.map(r => r.id_sicas));

        if (existingRecords) {
          existingRecords.forEach(r => existingIds.add(r.id_sicas));
        }

        const toUpdate = batch.filter(r => existingIds.has(r.id_sicas));
        const toInsert = batch.filter(r => !existingIds.has(r.id_sicas));

        if (toUpdate.length > 0) {
          const existingMap = new Map(existingRecords?.map(r => [r.id_sicas, r.id]) || []);

          for (const record of toUpdate) {
            const id = existingMap.get(record.id_sicas);
            if (id) {
              const { error } = await supabase
                .from('sicas_catalogos')
                .update({
                  nombre: record.nombre,
                  raw: record.raw,
                  metadata: record.metadata,
                  last_sync_at: new Date().toISOString(),
                })
                .eq('id', id);

              if (error) {
                console.error('[SICAS REST Sync] Error actualizando:', error);
                recordsFailed++;
              } else {
                recordsUpdated++;
              }
            }
          }
        }

        if (toInsert.length > 0) {
          const { error, count } = await supabase
            .from('sicas_catalogos')
            .insert(
              toInsert.map(record => ({
                catalog_type_id,
                id_sicas: record.id_sicas,
                nombre: record.nombre,
                raw: record.raw,
                metadata: record.metadata,
                last_sync_at: new Date().toISOString(),
              }))
            )
            .select('id', { count: 'exact' });

          if (error) {
            console.error('[SICAS REST Sync] Error en inserción batch:', error);
            recordsFailed += toInsert.length;
          } else {
            recordsInserted += count || toInsert.length;
          }
        }
      }
    }

    console.log(`[SICAS REST Sync] ${dryRun ? 'DRY RUN - ' : ''}Completado: ${recordsInserted} nuevos, ${recordsUpdated} actualizados`);

    if (syncHistoryId) {
      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          catalog_status: 'available',
          records_found: records.length,
          records_inserted: recordsInserted,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
        })
        .eq('id', syncHistoryId);
    }

    const responseData: any = {
      success: true,
      catalog_type_id,
      catalog_name: catalogType.name,
      catalog_status: 'available',
      method: 'REST',
      rest_keycode: catalogType.rest_keycode,
      dryRun,
      stats: {
        totalRows: records.length,
        inserted: recordsInserted,
        updated: recordsUpdated,
        failed: recordsFailed,
      },
      pagination: tableControl,
    };

    if (debug) {
      responseData.debug = {
        recordsPreview: records.slice(0, 3),
        tableControl,
      };
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    const errMsg = String(error?.message ?? error ?? 'Unknown error');
    const errStack = error?.stack;

    console.error('[SICAS REST Sync] Error:', errMsg);

    let catalogStatus = 'error';
    if (errMsg.includes('DENIED') || errMsg.toLowerCase().includes('denegad')) {
      catalogStatus = 'denied';
    } else if (errMsg.includes('not configured') || errMsg.includes('no tiene rest_keycode')) {
      catalogStatus = 'not_configured';
    } else if (errMsg.includes('Codigo de reporte no encontrado') || errMsg.includes('not found')) {
      catalogStatus = 'invalid_keycode';
    }

    if (syncHistoryId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'failed',
          catalog_status: catalogStatus,
          error_message: errMsg,
        })
        .eq('id', syncHistoryId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        method: 'REST',
        catalog_status: catalogStatus,
        error: errMsg,
        stack: errStack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
