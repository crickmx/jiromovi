import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateClientRequest {
  delivery_id: string;
  client_name: string;
  client_rfc?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  client_cp?: string;
  force_create?: boolean;
}

function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || "";

    if (!sicasUsername || !sicasPassword || !sicasEndpoint) {
      throw new Error("SICAS credentials or endpoint not configured");
    }

    const body: CreateClientRequest = await req.json();
    const delivery_id = (body as any).delivery_id || (body as any).policy_delivery_id || (body as any).policyDeliveryId || (body as any).deliveryId || (body as any).id;
    const { client_name, client_rfc, client_email, client_phone, client_address, client_cp, force_create } = body;

    console.log(`[sicas-create-client] Received body keys: ${Object.keys(body).join(", ")}`);
    console.log(`[sicas-create-client] Resolved delivery_id: ${delivery_id}`);

    if (!delivery_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "delivery_id is required. Send delivery_id, policy_delivery_id, policyDeliveryId, deliveryId, or id in the request body.",
          debug_received_keys: Object.keys(body),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client_name || !client_name.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "client_name is required. Cannot create client without a name." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sicas-create-client] Creating client: name="${client_name}", rfc="${client_rfc || "N/A"}", delivery=${delivery_id}`);

    // === Step 1: Check for duplicates before creating ===
    if (!force_create) {
      const rfcNormalized = client_rfc ? client_rfc.trim().toUpperCase().replace(/[-\s]/g, "") : null;

      if (rfcNormalized) {
        const { data: byRfc } = await supabase
          .from("sicas_catalogos")
          .select("id_sicas, nombre, raw")
          .eq("catalog_type_id", 17)
          .ilike("raw->>RFC", rfcNormalized)
          .limit(5);

        if (byRfc && byRfc.length > 0) {
          console.log(`[sicas-create-client] Duplicate check: Found ${byRfc.length} client(s) with RFC ${rfcNormalized}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: "duplicate_found",
              message: `Ya existe(n) ${byRfc.length} cliente(s) con RFC "${rfcNormalized}" en SICAS.`,
              candidates: byRfc.map(c => ({ id_sicas: c.id_sicas, nombre: c.nombre, rfc: c.raw?.RFC })),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const normalizedName = normalizeText(client_name);
      const { data: byName } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .limit(500);

      if (byName && byName.length > 0) {
        const nameMatches = byName.filter((r: any) => {
          const n = normalizeText(r.nombre);
          return n === normalizedName || n.includes(normalizedName) || normalizedName.includes(n);
        });

        if (nameMatches.length > 0) {
          console.log(`[sicas-create-client] Duplicate check: Found ${nameMatches.length} client(s) with similar name`);
          return new Response(
            JSON.stringify({
              success: false,
              error: "probable_duplicate",
              message: `Se encontro(n) ${nameMatches.length} cliente(s) con nombre similar en SICAS. Use force_create=true para crear de todas formas.`,
              candidates: nameMatches.slice(0, 5).map((c: any) => ({ id_sicas: c.id_sicas, nombre: c.nombre, rfc: c.raw?.RFC })),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // === Step 2: Build Procesar_String SOAP for WS_Contactos ===
    // Per SICAS WS 2.0 documentation:
    // - Method: Procesar_String
    // - PropertyTypeProcess: WS_SaveData
    // - PropertyTypeData: WS_Contactos (the SICAS entity type, NOT a format)
    // - PropertyWhatMakeExist: WS_UsarloNoUpdate (use existing if found, don't update)
    // - PropertyVerifyContact: WS_NombreCompleto (verify by full name)
    // - oDataString: pipe-delimited field|value pairs separated by commas

    // Parse name into parts for CatContactos fields
    const nameParts = client_name.trim().toUpperCase().split(/\s+/);
    let apellidoP = "";
    let apellidoM = "";
    let nombre = "";

    if (nameParts.length === 1) {
      nombre = nameParts[0];
    } else if (nameParts.length === 2) {
      nombre = nameParts[0];
      apellidoP = nameParts[1];
    } else if (nameParts.length === 3) {
      nombre = nameParts[0];
      apellidoP = nameParts[1];
      apellidoM = nameParts[2];
    } else {
      // 4+ words: assume last two are surnames
      apellidoM = nameParts[nameParts.length - 1];
      apellidoP = nameParts[nameParts.length - 2];
      nombre = nameParts.slice(0, nameParts.length - 2).join(" ");
    }

    // Detect entity type: 0 = Persona Fisica, 1 = Persona Moral
    const isEmpresa = /^(S\.?A\.?|S\.?C\.?|S\.? DE R\.?L\.?|SOCIEDAD|EMPRESA|CORPORAT|CIA|COMPAÑIA)/i.test(client_name.trim());
    const tipoEnt = isEmpresa ? "1" : "0";

    // Build CatContactos field|value pairs
    const dataFields: string[] = [];
    dataFields.push(`CatContactos.TipoEnt|${tipoEnt}`);
    dataFields.push(`CatContactos.ApellidoP|${apellidoP}`);
    if (apellidoM) dataFields.push(`CatContactos.ApellidoM|${apellidoM}`);
    dataFields.push(`CatContactos.Nombre|${nombre}`);

    const rfcValue = client_rfc ? client_rfc.trim().toUpperCase() : "XXXX000000XXX";
    dataFields.push(`CatContactos.RFC|${rfcValue}`);

    if (client_phone) {
      dataFields.push(`CatContactos.Telefono3|Celular|${client_phone.trim()}`);
    }
    if (client_email) {
      dataFields.push(`CatContactos.EMail1|${client_email.trim()}`);
    }

    const oDataString = dataFields.join(",");

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Procesar_String>
      <tem:oDataString><![CDATA[${oDataString}]]></tem:oDataString>
      <tem:oConfigData>
        <tem:PropertyTypeProcess>WS_SaveData</tem:PropertyTypeProcess>
        <tem:PropertyTypeData>WS_Contactos</tem:PropertyTypeData>
        <tem:PropertyWhatMakeExist>WS_UsarloNoUpdate</tem:PropertyWhatMakeExist>
        <tem:PropertyVerifyContact>WS_NombreCompleto</tem:PropertyVerifyContact>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(sicasUsername)}</tem:UserName>
        <tem:Password>${escapeXml(sicasPassword)}</tem:Password>
      </tem:oConfigAuth>
    </tem:Procesar_String>
  </soapenv:Body>
</soapenv:Envelope>`;

    console.log(`[sicas-create-client] Sending Procesar_String to ${sicasEndpoint}`);
    console.log(`[sicas-create-client] oDataString: ${oDataString}`);
    console.log(`[sicas-create-client] SOAP Request:`, soapEnvelope);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(sicasEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "http://tempuri.org/Procesar_String",
        },
        body: soapEnvelope,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log(`[sicas-create-client] Raw response (first 1200 chars):`, responseText.substring(0, 1200));

    // Decode HTML-encoded XML within SOAP response
    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // === Step 3: Parse Procesar_String response ===
    // Expected success: <RESPONSETXT>SUCESS</RESPONSETXT> <RESPONSENBR>12345</RESPONSENBR>
    // Expected rejection: <RESPONSETXT>REJECTED</RESPONSETXT> <MESSAGE>reason</MESSAGE>
    // RESPONSENBR contains the ID of the created/found contact, or -1 on failure

    const responseTxt = decoded.match(/<RESPONSETXT>([\s\S]*?)<\/RESPONSETXT>/i)?.[1]?.trim() || "";
    const responseNbr = decoded.match(/<RESPONSENBR>([\s\S]*?)<\/RESPONSENBR>/i)?.[1]?.trim() || "";
    const responseMsg = decoded.match(/<MESSAGE>([\s\S]*?)<\/MESSAGE>/i)?.[1]?.trim() || "";

    console.log(`[sicas-create-client] Parsed: RESPONSETXT="${responseTxt}", RESPONSENBR="${responseNbr}", MESSAGE="${responseMsg}"`);

    const isSuccess = /SUCESS|SUCCESS/i.test(responseTxt);
    const isRejected = /REJECTED|REJECT/i.test(responseTxt);
    const contactId = responseNbr && parseInt(responseNbr) > 0 ? responseNbr : null;

    // Check for SOAP Fault
    const soapFault = decoded.match(/<faultstring>([\s\S]*?)<\/faultstring>/i)?.[1]?.trim();
    if (soapFault) {
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_client_create_response_raw: { soap_fault: soapFault, raw: responseText.substring(0, 3000) },
          sicas_client_match_method: "create_failed",
          sicas_error_step: "create_client_soap_fault",
        })
        .eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `SOAP Fault: ${soapFault}`,
          stage: "soap_call",
          logs: { oDataString, response_raw: responseText.substring(0, 3000) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isRejected || (!isSuccess && !contactId)) {
      const errorDetail = responseMsg || responseTxt || "SICAS no confirmo la creacion del contacto";

      // "Already exists" is a controlled flow, not a fatal error
      const isAlreadyExists = /existe|already|duplica/i.test(responseMsg);

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_client_create_response_raw: {
            responsetxt: responseTxt,
            responsenbr: responseNbr,
            message: responseMsg,
            raw: responseText.substring(0, 3000),
          },
          sicas_client_match_method: isAlreadyExists ? "existing_contact_found" : "create_failed",
          sicas_error_step: isAlreadyExists ? null : "create_client_rejected",
        })
        .eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: isAlreadyExists ? "contact_already_exists" : errorDetail,
          message: errorDetail,
          contact_id: contactId,
          is_duplicate: isAlreadyExists,
          logs: { oDataString, responsetxt: responseTxt, responsenbr: responseNbr, message: responseMsg },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Step 4: Success - save contact ID to policy_deliveries ===
    const updatePayload: Record<string, any> = {
      sicas_client_name: client_name.trim().toUpperCase(),
      sicas_client_auto_created: true,
      sicas_client_created_at: new Date().toISOString(),
      sicas_client_create_response_raw: {
        responsetxt: responseTxt,
        responsenbr: responseNbr,
        message: responseMsg,
        raw: responseText.substring(0, 3000),
      },
      sicas_client_match_method: "auto_created_procesar_string",
      sicas_client_match_confidence: "high",
      sicas_error_step: null,
    };

    if (contactId) {
      updatePayload.sicas_client_id = contactId;
      updatePayload.sicas_override_cliente = contactId;
    }

    await supabase
      .from("policy_deliveries")
      .update(updatePayload)
      .eq("id", delivery_id);

    console.log(`[sicas-create-client] Contact created/found. IDCont=${contactId || "unknown"}`);

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contactId,
        client_name: client_name.trim().toUpperCase(),
        auto_created: true,
        responsetxt: responseTxt,
        responsenbr: responseNbr,
        warning: !client_rfc ? "Contacto creado sin RFC (se uso XXXX000000XXX como generico)." : undefined,
        logs: {
          oDataString,
          responsetxt: responseTxt,
          responsenbr: responseNbr,
          message: responseMsg,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sicas-create-client] Fatal error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, stage: "fatal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
