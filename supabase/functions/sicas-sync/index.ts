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

    // Leer body con catalog_type_id (1-61)
    const { catalog_type_id } = await req.json();

    if (!catalog_type_id || catalog_type_id < 1 || catalog_type_id > 61) {
      throw new Error('Invalid catalog_type_id. Must be between 1 and 61');
    }

    console.log(`[SICAS Sync] Iniciando sincronización del catálogo tipo ${catalog_type_id}...`);

    // Obtener información del catálogo
    const { data: catalogType, error: catalogError } = await supabase
      .from('sicas_catalog_types')
      .select('*')
      .eq('id', catalog_type_id)
      .single();

    if (catalogError || !catalogType) {
      throw new Error(`Catálogo tipo ${catalog_type_id} no encontrado en base de datos`);
    }

    console.log(`[SICAS Sync] Catálogo: ${catalogType.name} (${catalogType.enum_name})`);

    // Obtener credenciales
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured');
    }

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
        },
      })
      .select()
      .single();

    if (!historyError && historyRecord) {
      syncHistoryId = historyRecord.id;
    }

    // Construir request SOAP usando ReadInfoData
    // IMPORTANTE: Las credenciales deben ir en wsReadData también
    // PropertyData_TypeDataReturn = 2 (JSON preferido)
    // PropertyTypeReadData = catalog_type_id
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

    console.log('[SICAS Sync] Enviando request SOAP...');

    // Llamar a SICAS
    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    console.log('[SICAS Sync] HTTP Status:', response.status);
    console.log('[SICAS Sync] Response Headers:', Object.fromEntries(response.headers));
    console.log('[SICAS Sync] Response Length:', responseText.length);

    // Buscar tags importantes para debug
    const hasReadInfoDataResult = responseText.includes('ReadInfoDataResult');
    const hasResponseTxt = responseText.includes('RESPONSETXT');
    const hasFault = responseText.includes('faultstring');

    console.log('[SICAS Sync] Análisis de respuesta:');
    console.log('  - Contiene ReadInfoDataResult:', hasReadInfoDataResult);
    console.log('  - Contiene RESPONSETXT:', hasResponseTxt);
    console.log('  - Contiene faultstring:', hasFault);

    // Mostrar preview completo si hay error
    if (!hasReadInfoDataResult || hasFault) {
      console.log('[SICAS Sync] ⚠️ Respuesta completa (primeros 2000 chars):');
      console.log(responseText.substring(0, 2000));
    } else {
      console.log('[SICAS Sync] Response Preview:', responseText.substring(0, 500));
    }

    // Verificar errores SOAP
    const errorCheck = checkSoapError(responseText);
    if (errorCheck.hasError) {
      throw new Error(errorCheck.errorMessage);
    }

    // Parsear respuesta SOAP
    const parsedSoapData = parseSoapResponse(responseText);
    console.log('[SICAS Sync] ✅ Datos extraídos de SOAP exitosamente');

    // Parsear catálogo usando parser universal
    const parseResult = parseSicasResponse(parsedSoapData, catalogType.name);

    console.log('[SICAS Sync] Parser universal completado:');
    console.log(`  - Total filas: ${parseResult.stats.totalRows}`);
    console.log(`  - Parseadas exitosamente: ${parseResult.stats.successfullyParsed}`);
    console.log(`  - Fallidas: ${parseResult.stats.failed}`);

    if (parseResult.errors.length > 0) {
      console.log('[SICAS Sync] Errores de parseo:', parseResult.errors.slice(0, 5));
    }

    if (!parseResult.success || parseResult.records.length === 0) {
      throw new Error(`No se pudieron parsear registros del catálogo ${catalogType.name}`);
    }

    // Insertar/actualizar registros en sicas_catalogos
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
          // Update
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
          // Insert
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

    console.log(`[SICAS Sync] ✅ Sincronización completada:`);
    console.log(`  - Insertados: ${recordsInserted}`);
    console.log(`  - Actualizados: ${recordsUpdated}`);
    console.log(`  - Fallidos: ${recordsFailed}`);

    // Actualizar historial
    if (syncHistoryId) {
      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          records_found: parseResult.stats.totalRows,
          records_inserted: recordsInserted,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
          response_preview: responseText.substring(0, 1000),
        })
        .eq('id', syncHistoryId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        catalog_type_id,
        catalog_name: catalogType.name,
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
    console.error('[SICAS Sync] ❌ Error fatal:', error);

    // Actualizar historial con error
    if (syncHistoryId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('sicas_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'failed',
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
