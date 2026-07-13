import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Yeastar-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    const extension =
      body.extension || body.callee || body.to;
    const callerNumber =
      body.caller || body.from || body.callernum || "Desconocido";
    const timestamp = body.timestamp
      ? new Date(body.timestamp * 1000).toISOString()
      : new Date().toISOString();

    if (!extension) {
      return new Response(
        JSON.stringify({ error: "No extension in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: usuarioRows } = await adminClient
      .from("usuarios")
      .select("id, nombre")
      .eq("extension_telefonica", extension)
      .limit(1);

    const usuarioId = usuarioRows?.[0]?.id || null;

    await adminClient.from("llamadas_perdidas").insert({
      extension,
      caller_number: callerNumber,
      timestamp,
      usuario_id: usuarioId,
      estado: "pendiente",
    });

    if (usuarioId) {
      const { error: notifError } = await adminClient.from("notificaciones").insert({
        tipo: "llamada_perdida",
        modulo: "telefonia",
        titulo: "Llamada perdida",
        mensaje: `Llamada perdida de ${callerNumber}`,
        accion_url: "/admin/telefonia",
        leida: false,
        usuario_id: usuarioId,
      });

      if (notifError) {
        console.error("Error insertando notificacion:", notifError.message);
      }

      // Send Web Push notification
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            usuario_id: usuarioId,
            title: "Llamada perdida",
            body: `Llamada perdida de ${callerNumber}`,
            url: "/admin/telefonia",
            tag: "missed-call",
          }),
        });
      } catch (pushErr: any) {
        console.error("Push notification error:", pushErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, extension, caller: callerNumber }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
