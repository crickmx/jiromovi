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

    // Reconocer al que llama contra usuarios MOVI y contactos del CRM
    // (mismo criterio de match que wazzup-webhook: ultimos 10 digitos)
    const last10 = callerNumber.replace(/\D/g, "").slice(-10);
    let callerName: string | null = null;

    if (last10.length === 10) {
      const { data: usuarioMatch } = await adminClient
        .from("usuarios")
        .select("nombre_completo")
        .or(`celular_laboral.ilike.%${last10},celular_personal.ilike.%${last10}`)
        .limit(1);
      callerName = usuarioMatch?.[0]?.nombre_completo || null;

      if (!callerName) {
        const { data: crmMatch } = await adminClient
          .from("crm_contactos")
          .select("nombre_completo")
          .ilike("celular", `%${last10}`)
          .limit(1);
        callerName = crmMatch?.[0]?.nombre_completo || null;
      }

      if (!callerName) {
        const { data: contactoMatch } = await adminClient
          .from("contactos")
          .select("nombre, apellido")
          .ilike("celular", `%${last10}`)
          .limit(1);
        if (contactoMatch?.[0]) {
          callerName = [contactoMatch[0].nombre, contactoMatch[0].apellido]
            .filter(Boolean)
            .join(" ") || null;
        }
      }
    }

    const callerLabel = callerName ? `${callerName} (${callerNumber})` : callerNumber;

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
        mensaje: `Llamada perdida de ${callerLabel}`,
        accion_url: "/admin/telefonia",
        leida: false,
        usuario_id: usuarioId,
        metadata: { caller_number: callerNumber, caller_name: callerName },
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
            body: `Llamada perdida de ${callerLabel}`,
            url: "/admin/telefonia",
            tag: "missed-call",
          }),
        });
      } catch (pushErr: any) {
        console.error("Push notification error:", pushErr.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, extension, caller: callerNumber, caller_name: callerName }),
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
