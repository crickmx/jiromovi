import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseSicasResponse, parseSoapResponse, checkSoapError } from '../_shared/sicasParser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Test SICAS Catalog - Prueba rápida de catálogos sin necesidad de registrarlos
 *
 * Catálogos sugeridos para probar (según documentación SICAS):
 * - 10: eOficias (Oficinas)
 * - 11: eDespachos (Despachos)
 * - 12: eCompanias (Compañías)
 * - 13: eAgentes (Agentes)
 * - 18: ePromotorias (Promotorías)
 * - 32: eVendedores (Vendedores)
 * - 33: eEjecutivos (Ejecutivos)
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { catalog_id } = await req.json();

    if (!catalog_id || catalog_id < 1 || catalog_id > 61) {
      throw new Error('Invalid catalog_id. Must be between 1 and 61');
    }

    console.log(`[SICAS Test] Probando catálogo ID: ${catalog_id}...`);

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured');
    }

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ReadInfoData xmlns="http://tempuri.org/">
      <wsReadData>
        <PropertyUserName>${sicasUsername}</PropertyUserName>
        <PropertyPassword>${sicasPassword}</PropertyPassword>
        <PropertyData_TypeDataReturn>2</PropertyData_TypeDataReturn>
        <PropertyTypeReadData>${catalog_id}</PropertyTypeReadData>
      </wsReadData>
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    console.log('[SICAS Test] Enviando request SOAP...');

    const response = await fetch(sicasEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ReadInfoData',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();

    console.log('[SICAS Test] HTTP Status:', response.status);
    console.log('[SICAS Test] Response Length:', responseText.length);
    console.log('[SICAS Test] Response Preview:', responseText.substring(0, 500));

    const errorCheck = checkSoapError(responseText);
    if (errorCheck.hasError) {
      return new Response(
        JSON.stringify({
          success: true,
          catalog_id,
          catalog_status: 'denied',
          available: false,
          error: errorCheck.errorMessage,
          xml_snippet: responseText.substring(0, 1000),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parsedSoapData = parseSoapResponse(responseText);
    console.log('[SICAS Test] ✅ Datos extraídos de SOAP exitosamente');

    // Verificar si parseSoapResponse ya detectó catálogo no disponible
    if (parsedSoapData?.__empty_catalog) {
      console.warn('[SICAS Test] ⚠️ Catálogo no disponible detectado en SOAP parser');
      return new Response(
        JSON.stringify({
          success: true,
          catalog_id,
          catalog_status: parsedSoapData.status ?? 'not_available',
          response_nbr: parsedSoapData.responseNbr ?? '0',
          available: false,
          warning: parsedSoapData.message ?? 'Catálogo no disponible',
          xml_snippet: responseText.substring(0, 1000),
          stats: {
            totalRows: 0,
            records: 0,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parseResult = parseSicasResponse(parsedSoapData, `Catalog_${catalog_id}`);

    // Manejar catálogo no disponible
    if (parseResult.kind === 'not_available') {
      console.log('[SICAS Test] ⚠️ Catálogo no disponible (RESPONSENBR=0)');
      return new Response(
        JSON.stringify({
          success: true,
          catalog_id,
          catalog_status: 'not_available',
          response_nbr: parseResult.responseNbr,
          available: false,
          warning: parseResult.message,
          xml_snippet: responseText.substring(0, 1000),
          stats: {
            totalRows: 0,
            records: 0,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // A partir de aquí, parseResult.kind === 'success'
    console.log('[SICAS Test] Parser universal completado:');
    console.log(`  - Total filas: ${parseResult.stats.totalRows}`);
    console.log(`  - Parseadas exitosamente: ${parseResult.stats.successfullyParsed}`);
    console.log(`  - Fallidas: ${parseResult.stats.failed}`);

    // Catálogo disponible
    return new Response(
      JSON.stringify({
        success: true,
        catalog_id,
        catalog_status: 'available',
        available: true,
        stats: {
          totalRows: parseResult.stats.totalRows,
          records: parseResult.records.length,
        },
        sample_records: parseResult.records.slice(0, 5),
        xml_snippet: responseText.substring(0, 1000),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SICAS Test] ❌ Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        catalog_status: 'error',
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
