import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const ts = Date.now();
  const storagePath = `BNV/${ts}_Cotizador-BNV-2026-V4.xlsm`;

  const { data, error } = await supabase.storage
    .from("tariff-uploads")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return new Response(JSON.stringify({ error: error?.message || "Failed to create signed URL" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    storage_path: storagePath,
    signed_url: data.signedUrl,
    token: data.token,
    curl_command: `curl -X PUT "${data.signedUrl}" -H "Content-Type: application/octet-stream" --data-binary @Cotizador-BNV-2026-V4.xlsm`,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
