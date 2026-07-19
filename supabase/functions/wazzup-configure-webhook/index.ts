import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getWhatsappApiKey } from "../_shared/emailCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhookSecret = Deno.env.get("WAZZUP_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("WAZZUP_WEBHOOK_SECRET no esta configurado");
    }

    const { data: config } = await supabase
      .from("whatsapp_configuracion")
      .select("id, channel_id_uuid")
      .eq("activo", true)
      .maybeSingle();
    const apiKey = config ? await getWhatsappApiKey(supabase, config.id) : null;

    if (!config || !apiKey) {
      return new Response(
        JSON.stringify({ error: "No active WhatsApp configuration found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = new URL(`${supabaseUrl}/functions/v1/wazzup-webhook`);
    webhookUrl.searchParams.set("secret", webhookSecret);
    const webhookUrlString = webhookUrl.toString();

    // Check current webhook config from Wazzup
    let currentConfig: Record<string, unknown> = {};
    try {
      const checkResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      currentConfig = await checkResp.json().catch(() => ({}));
    } catch {
      // ignore — proceed to set
    }

    // Set webhook URL with all relevant subscriptions enabled
    const setResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhooksUri: webhookUrlString,
        subscriptions: {
          messagesAndStatuses: true,
        },
      }),
    });

    let setResult: unknown = null;
    try {
      const setText = await setResp.text();
      setResult = setText ? JSON.parse(setText) : { status: setResp.status };
    } catch {
      setResult = { status: setResp.status };
    }

    // Verify final state
    let verifyConfig: Record<string, unknown> = {};
    try {
      const verifyResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      verifyConfig = await verifyResp.json().catch(() => ({}));
    } catch {
      // ignore
    }

    const configuredUrl: string =
      (verifyConfig?.webhooksUri as string) ||
      (verifyConfig?.url as string) ||
      (verifyConfig?.webhookUrl as string) ||
      "";

    const isConfigured = configuredUrl === webhookUrlString;
    const redactWebhookUrl = (value: unknown) => {
      if (!value || typeof value !== "object") return value;
      const copy = { ...(value as Record<string, unknown>) };
      for (const key of ["webhooksUri", "url", "webhookUrl"]) {
        if (typeof copy[key] === "string") {
          try {
            const redacted = new URL(copy[key] as string);
            if (redacted.searchParams.has("secret")) {
              redacted.searchParams.set("secret", "[REDACTED]");
            }
            copy[key] = redacted.toString();
          } catch {
            copy[key] = "[REDACTED]";
          }
        }
      }
      return copy;
    };
    const publicWebhookUrl = `${supabaseUrl}/functions/v1/wazzup-webhook?secret=[REDACTED]`;

    return new Response(
      JSON.stringify({
        success: true,
        is_configured: isConfigured,
        previous_config: redactWebhookUrl(currentConfig),
        set_result: setResult,
        set_status: setResp.status,
        current_config: redactWebhookUrl(verifyConfig),
        webhook_url_configured: publicWebhookUrl,
        configured_url_in_wazzup: isConfigured ? publicWebhookUrl : "[REDACTED]",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errMsg, success: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
