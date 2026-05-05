import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

    const { data: config } = await supabase
      .from("whatsapp_configuracion")
      .select("api_key, channel_id_uuid")
      .eq("activo", true)
      .maybeSingle();

    if (!config) {
      return new Response(
        JSON.stringify({ error: "No active WhatsApp configuration found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/wazzup-webhook`;

    // First check current webhook config
    const checkResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
    });
    const currentConfig = await checkResp.json();

    // Set webhook URL
    const setResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhooksUri: webhookUrl,
        subscriptions: {
          messagesAndStatuses: true,
        },
      }),
    });

    const setResult = await setResp.json().catch(() => null);

    // Verify again
    const verifyResp = await fetch("https://api.wazzup24.com/v3/webhooks", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
    });
    const verifyConfig = await verifyResp.json();

    return new Response(
      JSON.stringify({
        previous_config: currentConfig,
        set_result: setResult,
        set_status: setResp.status,
        current_config: verifyConfig,
        webhook_url_configured: webhookUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
