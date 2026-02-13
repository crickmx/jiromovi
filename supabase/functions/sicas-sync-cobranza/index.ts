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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener configuración SICAS
    const { data: config } = await supabase
      .from("sicas_config")
      .select("*")
      .single();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "Configuración SICAS no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SICAS-Cobranza] Iniciando sincronización de cobranza pendiente");

    // Usar endpoint de la configuración o de las variables de entorno
    const sicasUrl = config.endpoint || Deno.env.get("SICAS_URL");
    const sicasUsuario = config.sicas_usuario || Deno.env.get("SICAS_USUARIO");
    const sicasPassword = config.sicas_password || Deno.env.get("SICAS_PASSWORD");
    const sicasNamespace = config.sicas_namespace || Deno.env.get("SICAS_NAMESPACE") || "http://www.sicasonline.com.mx/";

    console.log("[SICAS-Cobranza] Configuración cargada:", { sicasUrl, sicasUsuario: sicasUsuario ? "***" : "NO", sicasNamespace });

    // Construir solicitud SOAP para reporte de cobranza pendiente (HAPPDATAL_D004)
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <HAPPDATAL_D004 xmlns="${sicasNamespace}">
      <vcUsuario>${sicasUsuario}</vcUsuario>
      <vcPassword>${sicasPassword}</vcPassword>
      <vcXML><![CDATA[
        <Root>
          <Data>
            <FechaInicio>${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}</FechaInicio>
            <FechaFin>${new Date().toISOString().split('T')[0]}</FechaFin>
          </Data>
        </Root>
      ]]></vcXML>
    </HAPPDATAL_D004>
  </soap:Body>
</soap:Envelope>`;

    console.log("[SICAS-Cobranza] Llamando a SICAS WS...");

    if (!sicasUrl || !sicasUsuario || !sicasPassword) {
      return new Response(
        JSON.stringify({
          error: "Configuración SICAS incompleta. Configure las credenciales en Admin > SICAS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let response;
    try {
      response = await fetch(sicasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": `${sicasNamespace}HAPPDATAL_D004`,
        },
        body: soapRequest,
      });
    } catch (fetchError: any) {
      // Si hay error SSL, intentar con HTTP en lugar de HTTPS
      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL')) {
        console.warn("[SICAS-Cobranza] Error SSL, intentando con HTTP...");
        const httpUrl = sicasUrl.replace('https://', 'http://');

        response = await fetch(httpUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": `${sicasNamespace}HAPPDATAL_D004`,
          },
          body: soapRequest,
        });
      } else {
        throw fetchError;
      }
    }

    const xmlText = await response.text();

    if (!response.ok) {
      console.error(`[SICAS-Cobranza] Error ${response.status}:`, xmlText.substring(0, 500));
      throw new Error(`Error en respuesta SICAS: ${response.status} ${response.statusText} - ${xmlText.substring(0, 200)}`);
    }

    console.log("[SICAS-Cobranza] Respuesta recibida", xmlText.substring(0, 200));

    // Parser básico de XML
    const parseCobranza = (xml: string): CobranzaRecord[] => {
      const records: CobranzaRecord[] = [];

      // Extraer registros del XML (simplificado)
      const recordMatches = xml.matchAll(/<Record>([\s\S]*?)<\/Record>/g);

      for (const match of recordMatches) {
        const recordXml = match[1];

        const getField = (fieldName: string): string | undefined => {
          const regex = new RegExp(`<${fieldName}>([^<]*)<\/${fieldName}>`);
          const fieldMatch = recordXml.match(regex);
          return fieldMatch ? fieldMatch[1].trim() : undefined;
        };

        const vendId = getField("VendID");
        if (!vendId) continue;

        records.push({
          vend_id: vendId,
          vend_nombre: getField("VendNombre"),
          cliente: getField("Cliente") || getField("Contratante"),
          no_poliza: getField("NoPoliza") || getField("Poliza"),
          id_documento: getField("IdDocumento") || getField("DocID"),
          importe_pendiente: parseFloat(getField("ImportePendiente") || "0"),
          fecha_limite: getField("FechaLimite"),
          dias_vencidos: parseInt(getField("DiasVencidos") || "0"),
          status: getField("Status") || "Pendiente",
        });
      }

      return records;
    };

    const cobranzaRecords = parseCobranza(xmlText);
    console.log(`[SICAS-Cobranza] ${cobranzaRecords.length} registros parseados`);

    // Limpiar tabla anterior (podríamos hacer upsert inteligente)
    await supabase.from("sicas_cobranza_pendiente").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insertar nuevos registros
    if (cobranzaRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("sicas_cobranza_pendiente")
        .insert(
          cobranzaRecords.map(record => ({
            ...record,
            synced_at: new Date().toISOString(),
          }))
        );

      if (insertError) {
        console.error("[SICAS-Cobranza] Error al insertar:", insertError);
        throw insertError;
      }
    }

    // Registrar en historial
    await supabase.from("sicas_sync_history").insert({
      sync_type: "cobranza_pendiente",
      status: "success",
      records_synced: cobranzaRecords.length,
      sync_date: new Date().toISOString(),
      details: { message: "Sincronización completada exitosamente" },
    });

    console.log("[SICAS-Cobranza] Sincronización completada");

    return new Response(
      JSON.stringify({
        success: true,
        records_synced: cobranzaRecords.length,
        synced_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SICAS-Cobranza] Error:", error);

    // Registrar error en historial
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await supabase.from("sicas_sync_history").insert({
        sync_type: "cobranza_pendiente",
        status: "error",
        records_synced: 0,
        sync_date: new Date().toISOString(),
        details: { error: error.message },
      });
    } catch (logError) {
      console.error("[SICAS-Cobranza] Error al registrar en historial:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
