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

      // Check by RFC first
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

      // Check by name
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

    // === Step 2: Create client in SICAS via SOAP ===
    const contactData: string[] = [];
    contactData.push(`CliNombre|${client_name.trim()}`);
    if (client_rfc) contactData.push(`CliRFC|${client_rfc.trim().toUpperCase()}`);
    if (client_email) contactData.push(`CliEmail|${client_email.trim()}`);
    if (client_phone) contactData.push(`CliTelefono|${client_phone.trim()}`);
    if (client_address) contactData.push(`CliDomicilio|${client_address.trim()}`);
    if (client_cp) contactData.push(`CliCP|${client_cp.trim()}`);

    // Detect persona type
    const isEmpresa = /^(S\.?A\.?|S\.?C\.?|S\.? DE R\.?L\.?|SOCIEDAD|EMPRESA|CORPORAT|CIA|COMPAÑIA)/i.test(client_name.trim());
    contactData.push(`CliTipoPersona|${isEmpresa ? "M" : "F"}`);

    const dataString = contactData.join("\n");

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:Procesar_String>
      <tem:oConfigAuth>
        <tem:UserName>${sicasUsername}</tem:UserName>
        <tem:Password>${sicasPassword}</tem:Password>
      </tem:oConfigAuth>
      <tem:oConfigData>
        <tem:PropertyNameTransaction>WS_SaveData</tem:PropertyNameTransaction>
        <tem:PropertyTypeData>Contacto</tem:PropertyTypeData>
        <tem:PropertyData>${dataString}</tem:PropertyData>
      </tem:oConfigData>
    </tem:Procesar_String>
  </soap:Body>
</soap:Envelope>`;

    console.log(`[sicas-create-client] Sending SOAP request to ${sicasEndpoint}`);
    console.log(`[sicas-create-client] Data fields: ${contactData.join(", ")}`);

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
    console.log(`[sicas-create-client] Response (first 800 chars):`, responseText.substring(0, 800));

    // Decode SOAP response
    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // Extract client ID from response
    const idMatch = decoded.match(/<IDContacto>(\d+)<\/IDContacto>/i) ||
                    decoded.match(/<IDCli>(\d+)<\/IDCli>/i) ||
                    decoded.match(/<ID>(\d+)<\/ID>/i) ||
                    decoded.match(/<RESPONSENBR>\s*(\d+)\s*<\/RESPONSENBR>/i);

    const hasSuccess = /SUCESS|SUCCESS|OK|GUARDADO|CREADO/i.test(decoded);
    const hasError = /ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded);

    if (hasError) {
      const errorMsg = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] ||
                       decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       "Error desconocido de SICAS al crear cliente";

      // Save failure to delivery
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_client_create_response_raw: { error: errorMsg, raw: responseText.substring(0, 2000) },
          sicas_client_match_method: "create_failed",
        })
        .eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMsg,
          logs: { request_payload: contactData, response_raw: responseText.substring(0, 2000) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let newClientId: string | null = null;
    let newClientName = client_name.trim();

    if (idMatch && idMatch[1] && parseInt(idMatch[1]) > 0) {
      newClientId = idMatch[1];
    }

    if (!newClientId && hasSuccess) {
      // Success but no ID - might need alternative extraction
      console.log("[sicas-create-client] Success indicated but no ID. Response might have different format.");
    }

    if (!newClientId && !hasSuccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SICAS no devolvio un ID de cliente ni confirmo la creacion.",
          logs: { response_raw: responseText.substring(0, 2000) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Step 3: Save result to policy_deliveries ===
    const updatePayload: Record<string, any> = {
      sicas_client_name: newClientName,
      sicas_client_auto_created: true,
      sicas_client_created_at: new Date().toISOString(),
      sicas_client_create_response_raw: { raw: responseText.substring(0, 2000) },
      sicas_client_match_method: "auto_created",
      sicas_client_match_confidence: "high",
    };

    if (newClientId) {
      updatePayload.sicas_client_id = newClientId;
      updatePayload.sicas_override_cliente = newClientId;
    }

    await supabase
      .from("policy_deliveries")
      .update(updatePayload)
      .eq("id", delivery_id);

    console.log(`[sicas-create-client] Client created successfully. ID=${newClientId || "unknown"}`);

    const warningMsg = !client_rfc ? "Cliente creado sin RFC porque la poliza no lo contenia." : undefined;

    return new Response(
      JSON.stringify({
        success: true,
        client_id: newClientId,
        client_name: newClientName,
        auto_created: true,
        warning: warningMsg,
        logs: {
          create_client_request_payload: contactData,
          create_client_response_raw: responseText.substring(0, 2000),
          client_creation_error: null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[sicas-create-client] Fatal error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
