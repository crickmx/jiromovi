import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-yeastar-token",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("YEASTAR_WEBHOOK_SECRET");
    const tokenHeader = req.headers.get("X-Yeastar-Token");

    if (webhookSecret && tokenHeader !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Yeastar webhook received:", JSON.stringify(body));

    const extension = body.extension || body.callee || body.to;
    const callerNumber = body.caller || body.from || body.callernum || "Desconocido";
    const timestamp = body.timestamp ? new Date(body.timestamp * 1000).toISOString() : new Date().toISOString();

    if (!extension) {
      return new Response(JSON.stringify({ error: "No extension in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: usuario } = await adminClient
      .from("usuarios")
      .select("id, nombre")
      .eq("extension_telefonica", extension)
      .single();

    const usuarioId = usuario?.id || null;

    await adminClient.from("llamadas_perdidas").insert({
      extension,
      caller_number: callerNumber,
      timestamp,
      usuario_id: usuarioId,
      estado: "pendiente",
    });

    if (usuarioId) {
      await adminClient.from("notificaciones").insert({
        tipo: "llamada_perdida",
        modulo: "telefonia",
        titulo: "Llamada perdida",
        cuerpo: `Llamada perdida de ${callerNumber}`,
        accion_url: "/admin/telefonia",
        leida: false,
        usuario_id: usuarioId,
      });
    }

    return new Response(JSON.stringify({ success: true, extension, caller: callerNumber }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
