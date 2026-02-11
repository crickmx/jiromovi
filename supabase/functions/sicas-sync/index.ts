import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseSicasResponse, parseSoapResponse, checkSoapError } from '../_shared/sicasParser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const { catalog_type_id } = body;

    if (!catalog_type_id || catalog_type_id < 1 || catalog_type_id > 96) {
      throw new Error('Invalid catalog_type_id. Must be between 1 and 96');
    }

    const typeReturn = Number(body?.typeReturn ?? 1);
    const dryRun = body?.dryRun === true;
    const debug = body?.debug === true;

    // ✅ Validar typeReturn: 0=DataSet, 1=XML, 2=JSON
    if (![0, 1, 2].includes(typeReturn)) {
      throw new Error('Invalid typeReturn. Must be 0 (DataSet), 1 (XML), or 2 (JSON)');
    }

    const { data: catalogType, error: catalogError } = await supabase
      .from('sicas_catalog_types')
      .select('*')
      .eq('id', catalog_type_id)
      .single();

    if (catalogError || !catalogType) {
      throw new Error(`Catálogo tipo ${catalog_type_id} no encontrado en base de datos`);
    }

    console.log(`[SICAS Sync] Sincronizando: ${catalogType.name} (ID ${catalog_type_id})`);

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured');
    }

    const { data: historyRecord, error: historyError } = await supabase
      .from('sicas_sync_history')
      .insert({
        catalog_type_id,
        sync_started_at: syncStartedAt,
        status: 'running',
        request_payload: {
          catalog_type_id,
          catalog_name: catalogType.name,
        },
      })
      .select()
      .single();

    if (!historyError && historyRecord) {
      syncHistoryId = historyRecord.id;
    }

    // ✅ SOAP según documentación SICAS oficial
    // PropertyTypeReadData: enum_name del catálogo (ej: eOficias, eDespachos, eAgentes)
    // PropertyData_TypeDataReturn: Data_XML (siempre XML según SICAS)
    const typeDataReturnValue = typeReturn === 2 ? 'Data_JSON' : typeReturn === 1 ? 'Data_XML' : 'Data_XML';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>${catalogType.enum_name}</tem:PropertyTypeReadData>
        <tem:PropertyData_TypeDataReturn>${typeDataReturnValue}</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${sicasUsername}</tem:UserName>
        <tem:Password>${sicasPassword}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    // Función helper para hacer fetch con timeout y reintentos
    async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
      const timeout = 45000; // 45 segundos

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[SICAS Sync] Intento ${attempt}/${maxRetries} - Conectando a SICAS...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          return response;
        } catch (error: any) {
          console.error(`[SICAS Sync] Error en intento ${attempt}:`, error.message);

          if (attempt === maxRetries) {
            throw new Error(`Timeout o error de conexión después de ${maxRetries} intentos: ${error.message}`);
          }

          // Esperar antes del siguiente intento (backoff exponencial)
          const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[SICAS Sync] Esperando ${waitTime}ms antes del siguiente intento...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      throw new Error('No se pudo completar la solicitud después de todos los reintentos');
    }

    const response = await fetchWithRetry(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();

    const errorCheck = checkSoapError(responseText);
    if (errorCheck.hasError) {
      throw new Error(errorCheck.errorMessage);
    }

    // ✅ PATCH 1: Detectar PROCESSDATA antes de parsear (100% confiable, no depende del parser)
    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const isProcessDataNotAvailable =
      /<PROCESSDATA>/i.test(decoded) &&
      /<RESPONSETXT>\s*SUCESS\s*<\/RESPONSETXT>/i.test(decoded) &&
      /<RESPONSENBR>\s*0\s*<\/RESPONSENBR>/i.test(decoded);

    if (isProcessDataNotAvailable) {
      const msg = (decoded.match(/<MESSAGE>\s*([\s\S]*?)\s*<\/MESSAGE>/i)?.[1] ?? "").trim();

      console.log('[SICAS Sync] Catálogo no disponible (PROCESSDATA detectado)');

      if (syncHistoryId) {
        await supabase
          .from('sicas_sync_history')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            catalog_status: 'not_available',
            response_nbr: '0',
            records_found: 0,
            records_inserted: 0,
            records_updated: 0,
            records_failed: 0,
            response_preview: responseText.substring(0, 1000),
            xml_snippet: responseText.substring(0, 1000),
            error_message: msg || 'Catálogo no disponible',
          })
          .eq('id', syncHistoryId);
      }

      const resp: any = {
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
        catalog_status: 'not_available',
        typeReturn,
        dryRun,
        warning: msg || 'Catálogo no disponible',
        stats: { totalRows: 0, inserted: 0, updated: 0, failed: 0 },
      };

      if (debug) {
        resp.debug = {
          soapHttpStatus: response.status,
          responseBodyLength: responseText.length,
          preview: responseText.substring(0, 500),
        };
      }

      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ Try/catch a prueba de todo: convierte errores de "catálogo no disponible" en HTTP 200
    let parsedSoapData: any;
    try {
      parsedSoapData = parseSoapResponse(responseText);
    } catch (e: any) {
      const errorMsg = String(e?.message ?? e ?? '');

      // Caso especial: SUCESS + RESPONSENBR=0 con "Error en Ejecución..."
      if (/Error en Ejecución|Proceso Interno|SICASOnline/i.test(errorMsg)) {
        console.log('[SICAS Sync] Catálogo no disponible');

        const cleanMessage = errorMsg.replace(/^(Error parseando respuesta SOAP:\s*)?SICAS:\s*/i, '');

        if (syncHistoryId) {
          await supabase
            .from('sicas_sync_history')
            .update({
              sync_completed_at: new Date().toISOString(),
              status: 'completed',
              catalog_status: 'not_available',
              response_nbr: '0',
              records_found: 0,
              records_inserted: 0,
              records_updated: 0,
              records_failed: 0,
              response_preview: responseText.substring(0, 1000),
              xml_snippet: responseText.substring(0, 1000),
              error_message: cleanMessage,
            })
            .eq('id', syncHistoryId);
        }

        const notAvailableResponse: any = {
          success: true,
          catalog_type_id,
          catalog_name: catalogType.name,
          catalog_status: 'not_available',
          typeReturn,
          dryRun,
          warning: cleanMessage,
          stats: {
            totalRows: 0,
            inserted: 0,
            updated: 0,
            failed: 0,
          },
        };

        if (debug) {
          notAvailableResponse.debug = {
            soapHttpStatus: response.status,
            responseBodyLength: responseText.length,
            preview: responseText.substring(0, 500),
          };
        }

        return new Response(
          JSON.stringify(notAvailableResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // ❌ Cualquier otro error: sí es fatal (DENIED, timeout, etc)
      throw e;
    }

    // Verificar si parseSoapResponse ya detectó catálogo no disponible
    if (parsedSoapData?.__empty_catalog) {
      console.log('[SICAS Sync] Catálogo no disponible:', parsedSoapData.message);

      if (syncHistoryId) {
        await supabase
          .from('sicas_sync_history')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            catalog_status: parsedSoapData.status ?? 'not_available',
            response_nbr: parsedSoapData.responseNbr ?? '0',
            records_found: 0,
            records_inserted: 0,
            records_updated: 0,
            records_failed: 0,
            response_preview: responseText.substring(0, 1000),
            xml_snippet: responseText.substring(0, 1000),
            error_message: parsedSoapData.message,
          })
          .eq('id', syncHistoryId);
      }

      const notAvailableResponse2: any = {
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
        catalog_status: parsedSoapData.status ?? 'not_available',
        typeReturn,
        dryRun,
        warning: parsedSoapData.message ?? 'Catálogo no disponible',
        stats: {
          totalRows: 0,
          inserted: 0,
          updated: 0,
          failed: 0,
        },
      };

      if (debug) {
        notAvailableResponse2.debug = {
          soapHttpStatus: response.status,
          responseBodyLength: responseText.length,
          preview: responseText.substring(0, 500),
        };
      }

      return new Response(
        JSON.stringify(notAvailableResponse2),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parseResult = parseSicasResponse(parsedSoapData, catalogType.name);

    // Manejar catálogo no disponible
    if (parseResult.kind === 'not_available') {
      console.log('[SICAS Sync] Catálogo no disponible:', parseResult.message);

      if (syncHistoryId) {
        await supabase
          .from('sicas_sync_history')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            catalog_status: 'not_available',
            response_nbr: parseResult.responseNbr,
            records_found: 0,
            records_inserted: 0,
            records_updated: 0,
            records_failed: 0,
            response_preview: responseText.substring(0, 1000),
            xml_snippet: responseText.substring(0, 1000),
            error_message: parseResult.message,
          })
          .eq('id', syncHistoryId);
      }

      const notAvailableResponse3: any = {
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
        catalog_status: 'not_available',
        typeReturn,
        dryRun,
        warning: parseResult.message,
        stats: {
          totalRows: 0,
          inserted: 0,
          updated: 0,
          failed: 0,
        },
      };

      if (debug) {
        notAvailableResponse3.debug = {
          soapHttpStatus: response.status,
          responseBodyLength: responseText.length,
          preview: responseText.substring(0, 500),
        };
      }

      return new Response(
        JSON.stringify(notAvailableResponse3),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // A partir de aquí, parseResult.kind === 'success'
    console.log(`[SICAS Sync] Parseados: ${parseResult.stats.successfullyParsed} registros`);

    if (!parseResult.success || parseResult.records.length === 0) {
      throw new Error(`No se pudieron parsear registros del catálogo ${catalogType.name}`);
    }

    let recordsInserted = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    if (dryRun) {
      console.log('[SICAS Sync] DRY RUN: omitiendo upsert');
    } else {
      console.log(`[SICAS Sync] Procesando ${parseResult.records.length} registros en lote...`);

      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < parseResult.records.length; i += batchSize) {
        batches.push(parseResult.records.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[SICAS Sync] Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} registros)`);

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
                console.error('[SICAS Sync] Error actualizando:', error);
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
            console.error('[SICAS Sync] Error en inserción batch:', error);
            recordsFailed += toInsert.length;
          } else {
            recordsInserted += count || toInsert.length;
          }
        }
      }
    }

    console.log(`[SICAS Sync] ${dryRun ? 'DRY RUN - ' : ''}Completado: ${recordsInserted} nuevos, ${recordsUpdated} actualizados`);

    if (syncHistoryId) {
      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          catalog_status: 'available',
          records_found: parseResult.stats.totalRows,
          records_inserted: recordsInserted,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
          response_preview: responseText.substring(0, 1000),
          xml_snippet: responseText.substring(0, 1000),
        })
        .eq('id', syncHistoryId);
    }

    const responseData: any = {
      success: true,
      catalog_type_id,
      catalog_name: catalogType.name,
      catalog_status: 'available',
      typeReturn,
      dryRun,
      stats: {
        totalRows: parseResult.stats.totalRows,
        inserted: recordsInserted,
        updated: recordsUpdated,
        failed: recordsFailed,
      },
      errors: parseResult.errors.slice(0, 10),
    };

    if (debug) {
      responseData.debug = {
        soapHttpStatus: response.status,
        responseBodyLength: responseText.length,
        preview: responseText.substring(0, 500),
        parsedRecordsPreview: parseResult.records.slice(0, 3),
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
    // ✅ PATCH 3: Manejo seguro de error.message (puede ser undefined o no existir)
    const errMsg = String(error?.message ?? error ?? 'Unknown error');
    const errStack = error?.stack;

    console.error('[SICAS Sync] Error:', errMsg);

    // Detectar el tipo de error
    let catalogStatus = 'error';
    if (errMsg.includes('DENIED') || errMsg.toLowerCase().includes('denegad')) {
      catalogStatus = 'denied';
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