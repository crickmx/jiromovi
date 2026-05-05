import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ContactEmailRequest {
  agentUserId: string;
  subject: string;
  body: string;
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
      throw new Error("No tienes permiso para enviar correos");
    }

    const { agentUserId, subject, body } = await req.json() as ContactEmailRequest;

    if (!agentUserId || !subject || !body) {
      throw new Error("Faltan campos requeridos: agentUserId, subject, body");
    }

    const { data: agent } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, email_laboral, email_personal, oficina_id, rol")
      .eq("id", agentUserId)
      .maybeSingle();

    if (!agent) throw new Error("Agente no encontrado");

    if (senderUser.rol !== "Administrador" && agent.oficina_id !== senderUser.oficina_id) {
      throw new Error("No tienes permiso para contactar a este agente");
    }

    const toEmail = agent.email_laboral || agent.email_personal;
    if (!toEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Este agente no tiene un correo electronico registrado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config } = await supabase
      .from("correo_configuracion")
      .select("*")
      .eq("activo", true)
      .eq("tipo_integracion", "resend")
      .limit(1)
      .maybeSingle();

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || config?.resend_api_key;
    if (!resendApiKey) {
      throw new Error("Configuracion de Resend no encontrada");
    }

    const fromEmail = config?.remitente_email || "notificaciones@movi.digital";
    const fromName = config?.remitente_nombre || "MOVI Digital";

    let globalHeader = "";
    let globalFooter = "";
    try {
      const { data: layout } = await supabase
        .from("email_global_settings")
        .select("header_html, footer_html")
        .eq("activo", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (layout) {
        globalHeader = layout.header_html || "";
        globalFooter = layout.footer_html || "";
      }
    } catch { /* use empty layout */ }

    const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden;">
        ${globalHeader ? `<tr><td>${globalHeader}</td></tr>` : ""}
        <tr><td style="padding:32px;">${body}</td></tr>
        ${globalFooter ? `<tr><td>${globalFooter}</td></tr>` : ""}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resend = new Resend(resendApiKey);
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      html: htmlBody,
    });

    const success = !emailError;
    const status = success ? "sent" : "failed";

    await supabase.from("contact_center_messages").insert({
      agent_user_id: agentUserId,
      sender_user_id: senderUser.id,
      sender_type: "user",
      channel: "email",
      message_type: "manual",
      direction: "outbound",
      subject,
      body,
      html_body: htmlBody,
      status,
      provider: "resend",
      provider_message_id: emailResult?.id || null,
      provider_response: emailResult || emailError,
      error_message: success ? null : (emailError?.message || "Error de envio"),
      metadata: { to_email: toEmail, from_email: fromEmail },
    });

    return new Response(
      JSON.stringify({
        success,
        message: success ? "Correo enviado correctamente" : "Error al enviar correo",
        provider_response: emailResult || emailError,
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
