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

    const { catalog_type_id } = await req.json();

    if (!catalog_type_id || catalog_type_id < 1 || catalog_type_id > 61) {
      throw new Error('Invalid catalog_type_id. Must be between 1 and 61');
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
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

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

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyUserName>${sicasUsername}</PropertyUserName>
        <PropertyPassword>${sicasPassword}</PropertyPassword>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>${catalog_type_id}</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(sicasEndpoint, {
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

        return new Response(
          JSON.stringify({
            success: true,
            catalog_type_id,
            catalog_name: catalogType.name,
            catalog_status: 'not_available',
            warning: cleanMessage,
            stats: {
              totalRows: 0,
              inserted: 0,
              updated: 0,
              failed: 0,
            },
          }),
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

      return new Response(
        JSON.stringify({
          success: true,
          catalog_type_id,
          catalog_name: catalogType.name,
          catalog_status: parsedSoapData.status ?? 'not_available',
          warning: parsedSoapData.message ?? 'Catálogo no disponible',
          stats: {
            totalRows: 0,
            inserted: 0,
            updated: 0,
            failed: 0,
          },
        }),
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

      return new Response(
        JSON.stringify({
          success: true,
          catalog_type_id,
          catalog_name: catalogType.name,
          catalog_status: 'not_available',
          warning: parseResult.message,
          stats: {
            totalRows: 0,
            inserted: 0,
            updated: 0,
            failed: 0,
          },
        }),
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

    for (const record of parseResult.records) {
      try {
        const { data: existingRecord } = await supabase
          .from('sicas_catalogos')
          .select('id')
          .eq('catalog_type_id', catalog_type_id)
          .eq('id_sicas', record.id_sicas)
          .maybeSingle();

        if (existingRecord) {
          const { error: updateError } = await supabase
            .from('sicas_catalogos')
            .update({
              nombre: record.nombre,
              raw: record.raw,
              metadata: record.metadata,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', existingRecord.id);

          if (updateError) {
            console.error('[SICAS Sync] Error actualizando registro:', updateError);
            recordsFailed++;
          } else {
            recordsUpdated++;
          }
        } else {
          const { error: insertError } = await supabase
            .from('sicas_catalogos')
            .insert({
              catalog_type_id,
              id_sicas: record.id_sicas,
              nombre: record.nombre,
              raw: record.raw,
              metadata: record.metadata,
              last_sync_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('[SICAS Sync] Error insertando registro:', insertError);
            recordsFailed++;
          } else {
            recordsInserted++;
          }
        }
      } catch (error) {
        console.error('[SICAS Sync] Exception procesando registro:', error);
        recordsFailed++;
      }
    }

    console.log(`[SICAS Sync] Completado: ${recordsInserted} nuevos, ${recordsUpdated} actualizados`);

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

    return new Response(
      JSON.stringify({
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
        catalog_status: 'available',
        stats: {
          totalRows: parseResult.stats.totalRows,
          inserted: recordsInserted,
          updated: recordsUpdated,
          failed: recordsFailed,
        },
        errors: parseResult.errors.slice(0, 10),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SICAS Sync] Error:', error.message);

    // Detectar el tipo de error
    let catalogStatus = 'error';
    if (error.message.includes('DENIED') || error.message.includes('denegada')) {
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
          error_message: error.message,
        })
        .eq('id', syncHistoryId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});