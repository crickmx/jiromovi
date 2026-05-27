import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { channel_id, target } = await req.json();

    if (!channel_id || !target) {
      return new Response(
        JSON.stringify({ success: false, error: "channel_id and target are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the channel
    const { data: channel, error: channelErr } = await supabase
      .from("notification_channels")
      .select("*")
      .eq("id", channel_id)
      .maybeSingle();

    if (channelErr || !channel) {
      return new Response(
        JSON.stringify({ success: false, error: "Channel not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!channel.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Channel is inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (channel.type === "email_resend") {
      const apiKey = channel.config?.api_key;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Channel has no API key configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fromName = channel.config?.from_name || channel.branding?.sender_name || "MOVI Digital";
      const fromEmail = channel.config?.from_email || "notificaciones@movi.digital";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [target],
          subject: `Prueba de canal: ${channel.name}`,
          html: `
            <div style="font-family:sans-serif; max-width:520px; margin:0 auto; padding:32px;">
              <h2 style="color:#1a1a2e; margin-bottom:8px;">Prueba de canal exitosa</h2>
              <p style="color:#555; margin-bottom:24px;">Este correo confirma que el canal <strong>${channel.name}</strong> está correctamente configurado y puede enviar mensajes.</p>
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px; margin-bottom:24px;">
                <p style="margin:0; color:#166534; font-size:14px;">
                  Canal: <strong>${channel.name}</strong><br>
                  Tipo: <strong>Correo (Resend)</strong><br>
                  Remitente: <strong>${fromName} &lt;${fromEmail}&gt;</strong>
                </p>
              </div>
              <p style="color:#999; font-size:12px;">Este es un mensaje de prueba generado desde el panel de administración de MOVI.</p>
            </div>
          `,
        }),
      });

      if (res.ok) {
        return new Response(
          JSON.stringify({ success: true, message: `Correo de prueba enviado a ${target}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const err = await res.text();
        return new Response(
          JSON.stringify({ success: false, error: `Resend ${res.status}: ${err}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (channel.type === "whatsapp_wazzup24") {
      const apiKey = channel.config?.api_key;
      const channelIdUuid = channel.config?.channel_id;

      if (!apiKey || !channelIdUuid) {
        return new Response(
          JSON.stringify({ success: false, error: "Channel missing api_key or channel_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let normalizedPhone = target.replace(/[^0-9]/g, "");
      if (normalizedPhone.length === 10) {
        normalizedPhone = "521" + normalizedPhone;
      } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52")) {
        normalizedPhone = "521" + normalizedPhone.substring(2);
      } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith("521")) {
        normalizedPhone = "521" + normalizedPhone.substring(3);
      }

      const res = await fetch("https://api.wazzup24.com/v3/message", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelIdUuid,
          chatType: "whatsapp",
          chatId: normalizedPhone,
          text: `✅ *Prueba de canal exitosa*\n\nEste mensaje confirma que el canal *${channel.name}* está correctamente configurado y puede enviar mensajes de WhatsApp.\n\n_Mensaje generado desde el panel de administración de MOVI._`,
        }),
      });

      if (res.ok) {
        return new Response(
          JSON.stringify({ success: true, message: `Mensaje de prueba enviado a ${target}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const err = await res.text();
        return new Response(
          JSON.stringify({ success: false, error: `Wazzup ${res.status}: ${err}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown channel type: ${channel.type}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("test-notification-channel error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
