import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'http://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    console.log("[SICAS-Cobranza] Configuración cargada, consultando reporte D004...");

    // Construir solicitud SOAP usando ProcesarWS con reporte D004 (HAPPDATAL_D004)
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>D004</KeyCode>
        <Page>1</Page>
        <ItemForPage>1000</ItemForPage>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${sicasUsername}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    let response;
    try {
      response = await fetch(sicasEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/ProcesarWS",
        },
        body: soapEnvelope,
      });
    } catch (fetchError: any) {
      console.error("[SICAS-Cobranza] Error en fetch:", fetchError);

      // Si hay error SSL/certificado, intentar con HTTP
      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
        console.warn("[SICAS-Cobranza] Error SSL detectado, intentando con HTTP...");
        const httpEndpoint = sicasEndpoint.replace('https://', 'http://');

        response = await fetch(httpEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "http://tempuri.org/ProcesarWS",
          },
          body: soapEnvelope,
        });
      } else {
        throw fetchError;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SICAS-Cobranza] Error HTTP ${response.status}:`, errorText);
      throw new Error(`SICAS HTTP Error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const responseText = await response.text();
    console.log(`[SICAS-Cobranza] Respuesta recibida (${responseText.length} caracteres), parseando...`);

    // Decodificar entidades HTML
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Extraer el contenido del resultado
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      console.error("[SICAS-Cobranza] No se encontró ProcesarWSResult");
      throw new Error('No se pudo extraer ProcesarWSResult del response');
    }

    const resultContent = resultMatch[1];

    // Verificar estado del proceso
    const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
    const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);

    console.log("[SICAS-Cobranza] RESPONSENBR:", responseNbrMatch?.[1]);
    console.log("[SICAS-Cobranza] RESPONSETXT:", responseTxtMatch?.[1]);

    if (!responseNbrMatch || responseNbrMatch[1] === '0') {
      const message = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/)?.[1] || 'Sin mensaje';
      throw new Error(`SICAS RESPONSENBR=0: ${message}`);
    }

    if (responseTxtMatch && responseTxtMatch[1] === 'DENIED') {
      throw new Error('SICAS: Acceso denegado - verificar credenciales');
    }

    // Parsear los registros de cobranza
    const parseCobranza = (xml: string): CobranzaRecord[] => {
      const records: CobranzaRecord[] = [];

      // Los registros pueden venir en diferentes formatos
      const patterns = [
        /<DatCobranza>([\s\S]*?)<\/DatCobranza>/g,
        /<Record>([\s\S]*?)<\/Record>/g,
        /<Item>([\s\S]*?)<\/Item>/g,
      ];

      let recordMatches: RegExpMatchArray[] = [];
      for (const pattern of patterns) {
        const matches = Array.from(xml.matchAll(pattern));
        if (matches.length > 0) {
          recordMatches = matches;
          console.log(`[SICAS-Cobranza] Usando patrón ${pattern}, encontrados ${matches.length} registros`);
          break;
        }
      }

      if (recordMatches.length === 0) {
        console.warn("[SICAS-Cobranza] No se encontraron registros en ningún formato");
        console.log("[SICAS-Cobranza] Muestra XML:", xml.substring(0, 1000));
        return records;
      }

      for (const match of recordMatches) {
        const recordXml = match[1];

        const extractField = (fieldName: string): string => {
          const regex = new RegExp(`<${fieldName}>(.*?)<\/${fieldName}>`, 'i');
          const fieldMatch = recordXml.match(regex);
          return fieldMatch ? fieldMatch[1].trim() : '';
        };

        const extractNumber = (fieldName: string): number => {
          const value = extractField(fieldName);
          return value ? parseFloat(value) : 0;
        };

        // Extraer campos (ajustar según estructura real)
        const vendId = extractField("VendID") || extractField("IdVendedor") || extractField("Vendedor");

        if (!vendId) {
          continue;
        }

        records.push({
          vend_id: vendId,
          vend_nombre: extractField("VendNombre") || extractField("NombreVendedor") || extractField("Agente"),
          cliente: extractField("Cliente") || extractField("Contratante") || extractField("Asegurado"),
          no_poliza: extractField("NoPoliza") || extractField("Poliza") || extractField("NumeroPoliza"),
          id_documento: extractField("IdDocumento") || extractField("DocID") || extractField("Recibo"),
          importe_pendiente: extractNumber("ImportePendiente") || extractNumber("Importe") || extractNumber("ImporteTotal"),
          fecha_limite: extractField("FechaLimite") || extractField("FechaVencimiento") || extractField("FVencimiento"),
          dias_vencidos: parseInt(extractField("DiasVencidos") || extractField("Vencidos") || "0"),
          status: extractField("Status") || extractField("Estado") || "Pendiente",
        });
      }

      return records;
    };

    const cobranzaRecords = parseCobranza(resultContent);
    console.log(`[SICAS-Cobranza] ${cobranzaRecords.length} registros parseados`);

    if (cobranzaRecords.length === 0) {
      console.log("[SICAS-Cobranza] No se encontraron registros de cobranza");

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
