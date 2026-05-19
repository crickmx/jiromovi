import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContactWhatsAppRequest {
  agentUserId?: string;
  contactPhone?: string; // for external contacts not in usuarios
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: senderUser } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id, nombre_completo")
      .eq("id", user.id)
      .maybeSingle();

    if (!senderUser || !["Administrador", "Gerente", "Empleado"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para enviar mensajes");
    }

    const { agentUserId, contactPhone, message } = await req.json() as ContactWhatsAppRequest;

    if ((!agentUserId && !contactPhone) || !message) {
      throw new Error("Faltan campos requeridos: agentUserId o contactPhone, message");
    }

    let phone: string;
    let resolvedAgentUserId: string | null = agentUserId || null;

    if (contactPhone) {
      // External contact: use the provided phone directly
      phone = contactPhone;
    } else {
      // Registered user: look up phone from usuarios
      const { data: agent } = await supabase
        .from("usuarios")
        .select("id, nombre_completo, celular_laboral, celular_personal, oficina_id, rol")
        .eq("id", agentUserId!)
        .maybeSingle();

      if (!agent) throw new Error("Agente no encontrado");

      if (senderUser.rol !== "Administrador" && agent.oficina_id !== senderUser.oficina_id) {
        throw new Error("No tienes permiso para contactar a este agente");
      }

      const agentPhone = agent.celular_laboral || agent.celular_personal;
      if (!agentPhone) {
        return new Response(
          JSON.stringify({ success: false, error: "Este agente no tiene un numero de WhatsApp registrado." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      phone = agentPhone;
    }

    const { data: config } = await supabase
      .from("whatsapp_configuracion")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    if (!config || !config.api_key || !config.channel_id_uuid) {
      throw new Error("Configuracion de WhatsApp no encontrada o incompleta");
    }

    let normalizedPhone = phone.replace(/[^0-9]/g, "");
    if (normalizedPhone.length === 10) {
      normalizedPhone = "521" + normalizedPhone;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52")) {
      normalizedPhone = "521" + normalizedPhone.substring(2);
    } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith("521")) {
      normalizedPhone = "521" + normalizedPhone.substring(3);
    }

    const truncatedMessage = message.length > 550
      ? message.substring(0, 547) + "..."
      : message;

    const wazzupPayload = {
      channelId: config.channel_id_uuid,
      chatId: normalizedPhone,
      chatType: "whatsapp",
      text: truncatedMessage,
    };

    const wazzupResponse = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wazzupPayload),
    });

    const responseText = await wazzupResponse.text();
    let wazzupData: Record<string, unknown>;
    try { wazzupData = JSON.parse(responseText); } catch { wazzupData = { raw: responseText }; }

    const success = wazzupResponse.ok;
    const status = success ? "sent" : "failed";

    await supabase.from("contact_center_messages").insert({
      agent_user_id: resolvedAgentUserId,
      contact_phone: contactPhone || null,
      sender_user_id: senderUser.id,
      sender_type: "user",
      channel: "whatsapp",
      message_type: "manual",
      direction: "outbound",
      body: truncatedMessage,
      status,
      provider: "wazzup",
      provider_message_id: wazzupData?.messageId ? String(wazzupData.messageId) : null,
      provider_response: wazzupData,
      error_message: success ? null : (wazzupData?.message ? String(wazzupData.message) : responseText),
      metadata: { normalized_phone: normalizedPhone, original_phone: phone },
    });

    return new Response(
      JSON.stringify({
        success,
        message: success ? "WhatsApp enviado correctamente" : "Error al enviar WhatsApp",
        provider_response: wazzupData,
      }),
      { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
