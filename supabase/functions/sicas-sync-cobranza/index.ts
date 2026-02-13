import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseSicasResponse, parseSoapResponse, checkSoapError } from '../_shared/sicasParser.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CobranzaRecord {
  vend_id: string;
  vend_nombre?: string;
  cliente?: string;
  no_poliza?: string;
  id_documento?: string;
  importe_pendiente?: number;
  fecha_limite?: string;
  dias_vencidos?: number;
  status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[SICAS-Cobranza] Iniciando sincronización de cobranza pendiente");

    // Usar el catálogo de Cobranza (ID 50)
    const CATALOG_ID = 50;
    const CATALOG_ENUM = "eCobranza";

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'http://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    console.log("[SICAS-Cobranza] Configuración cargada:", {
      endpoint: sicasEndpoint,
      username: sicasUsername ? "***" : "NO"
    });

    // Construir solicitud SOAP usando formato ReadInfoData
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>${CATALOG_ENUM}</tem:PropertyTypeReadData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${sicasUsername}</tem:UserName>
        <tem:Password>${sicasPassword}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

    console.log("[SICAS-Cobranza] Llamando a SICAS con ReadInfoData...");

    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ReadInfoData",
      },
      body: soapEnvelope,
    });

    const xmlText = await response.text();

    if (!response.ok) {
      console.error(`[SICAS-Cobranza] Error ${response.status}:`, xmlText);

      // Intentar extraer el mensaje de error SOAP
      const faultStringMatch = xmlText.match(/<faultstring>(.*?)<\/faultstring>/);
      const faultDetailMatch = xmlText.match(/<detail>(.*?)<\/detail>/s);

      if (faultStringMatch || faultDetailMatch) {
        const errorMsg = faultStringMatch ? faultStringMatch[1] : faultDetailMatch?.[1];
        throw new Error(`Error SOAP SICAS: ${errorMsg}`);
      }

      throw new Error(`Error en respuesta SICAS: ${response.status} ${response.statusText}`);
    }

    console.log("[SICAS-Cobranza] Respuesta recibida exitosamente");

    // Verificar errores SOAP
    const soapError = checkSoapError(xmlText);
    if (soapError) {
      throw new Error(`Error SOAP: ${soapError}`);
    }

    // Extraer el resultado del XML
    const resultMatch = xmlText.match(/<ReadInfoDataResult>([\s\S]*?)<\/ReadInfoDataResult>/);
    if (!resultMatch) {
      throw new Error('No se encontró ReadInfoDataResult en la respuesta');
    }

    let innerXml = resultMatch[1].trim();

    // Decodificar entidades HTML si están presentes
    if (innerXml.includes('&lt;')) {
      innerXml = innerXml
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
    }

    console.log("[SICAS-Cobranza] XML decodificado, parseando registros...");

    // Parsear registros de cobranza
    const parseCobranza = (xml: string): CobranzaRecord[] => {
      const records: CobranzaRecord[] = [];

      // Intentar diferentes formatos de registros
      let recordMatches = Array.from(xml.matchAll(/<Record>([\s\S]*?)<\/Record>/g));

      if (recordMatches.length === 0) {
        recordMatches = Array.from(xml.matchAll(/<Cobranza>([\s\S]*?)<\/Cobranza>/g));
      }

      if (recordMatches.length === 0) {
        recordMatches = Array.from(xml.matchAll(/<Item>([\s\S]*?)<\/Item>/g));
      }

      console.log(`[SICAS-Cobranza] Encontrados ${recordMatches.length} registros`);

      for (const match of recordMatches) {
        const recordXml = match[1];

        const getField = (fieldName: string): string | undefined => {
          const regex = new RegExp(`<${fieldName}>([^<]*)<\/${fieldName}>`, 'i');
          const fieldMatch = recordXml.match(regex);
          return fieldMatch ? fieldMatch[1].trim() : undefined;
        };

        // Extraer campos (ajustar según estructura real del XML)
        const vendId = getField("VendID") || getField("IdVendedor") || getField("vendedor_id");

        if (!vendId) {
          console.warn("[SICAS-Cobranza] Registro sin VendID, saltando:", recordXml.substring(0, 100));
          continue;
        }

        records.push({
          vend_id: vendId,
          vend_nombre: getField("VendNombre") || getField("NombreVendedor"),
          cliente: getField("Cliente") || getField("Contratante") || getField("Asegurado"),
          no_poliza: getField("NoPoliza") || getField("Poliza") || getField("NumeroPoliza"),
          id_documento: getField("IdDocumento") || getField("DocID") || getField("Recibo"),
          importe_pendiente: parseFloat(getField("ImportePendiente") || getField("Importe") || "0"),
          fecha_limite: getField("FechaLimite") || getField("FechaVencimiento"),
          dias_vencidos: parseInt(getField("DiasVencidos") || getField("Vencidos") || "0"),
          status: getField("Status") || getField("Estado") || "Pendiente",
        });
      }

      return records;
    };

    const cobranzaRecords = parseCobranza(innerXml);
    console.log(`[SICAS-Cobranza] ${cobranzaRecords.length} registros parseados correctamente`);

    if (cobranzaRecords.length === 0) {
      console.log("[SICAS-Cobranza] No se encontraron registros de cobranza");
      console.log("[SICAS-Cobranza] Muestra del XML:", innerXml.substring(0, 500));

      return new Response(
        JSON.stringify({
          success: true,
          message: "Sin registros de cobranza pendiente",
          records_count: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limpiar tabla anterior
    const { error: deleteError } = await supabase
      .from("sicas_cobranza_pendiente")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      console.error("[SICAS-Cobranza] Error limpiando tabla:", deleteError);
    }

    // Insertar nuevos registros
    const { error: insertError } = await supabase
      .from("sicas_cobranza_pendiente")
      .insert(cobranzaRecords);

    if (insertError) {
      console.error("[SICAS-Cobranza] Error insertando registros:", insertError);
      throw insertError;
    }

    console.log(`[SICAS-Cobranza] Sincronización completada: ${cobranzaRecords.length} registros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cobranza sincronizada: ${cobranzaRecords.length} registros`,
        records_count: cobranzaRecords.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[SICAS-Cobranza] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
