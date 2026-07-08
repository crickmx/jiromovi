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
    if (!webhookSecret) {
      return jsonError("Webhook secret not configured", 500);
    }

    const token = req.headers.get("X-Yeastar-Token");
    if (!token || token !== webhookSecret) {
      return jsonError("Unauthorized", 401);
    }

    const payload = await req.json();

    if (!isMissedCallEvent(payload)) {
      return jsonOk({ ignored: true, reason: "Not a missed call event" });
    }

    const extension = payload.callee?.number || payload.ext?.number || payload.extension;
    const callerNumber = payload.caller?.number || payload.from || payload.caller_number || "Desconocido";
    const timestamp = payload.timestamp || new Date().toISOString();

    if (!extension) {
      return jsonError("No extension found in payload", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: usuario } = await adminClient
      .from("usuarios")
      .select("id, nombre, apellido")
      .eq("extension_telefonica", extension)
      .maybeSingle();

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
        usuario_id: usuarioId,
        tipo: "llamada_perdida",
        modulo: "Telefonia",
        titulo: "Llamada perdida",
        mensaje: `Llamada perdida de ${callerNumber}`,
        accion_url: "/admin/telefonia",
        leida: false,
      });
    }

    return jsonOk({
      success: true,
      usuario_found: !!usuarioId,
      extension,
      caller_number: callerNumber,
    });
  } catch (err: any) {
    return jsonError(err.message || "Internal error", 500);
  }
});

function isMissedCallEvent(payload: any): boolean {
  const eventType = payload.event || payload.type || payload.action || "";
  const missedIndicators = ["missed", "missed_call", "CallMissed", "MISSED"];
  if (missedIndicators.some((i) => eventType.toLowerCase().includes(i.toLowerCase()))) {
    return true;
  }
  if (payload.status === "missed" || payload.call_status === "missed") {
    return true;
  }
  return false;
}

function jsonOk(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
