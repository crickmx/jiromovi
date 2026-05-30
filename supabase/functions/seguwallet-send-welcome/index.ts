import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SEGUWALLET_URL = "https://app.movi.digital/seguwallet";
const SEGUWALLET_LOGO = "https://app.movi.digital/logojiro.png";
const PRIVACY_URL = "https://app.movi.digital/aviso-privacidad";
const DEFAULT_PRIMARY = "#1C37E0";
const DEFAULT_SECONDARY = "#1228B8";

// ── Channel resolution (same as enviar-correo-transaccional) ──────────────

interface ResolvedEmailChannel {
  api_key: string;
  from_name: string;
  from_email: string;
  channel_id: string | null;
  channel_name: string | null;
}

interface ResolvedWhatsAppChannel {
  api_key: string;
  channel_id_uuid: string;
  channel_id: string | null;
  channel_name: string | null;
}

async function resolveEmailChannel(
  supabase: ReturnType<typeof createClient>,
  preferredChannelId?: string | null,
  fromNameOverride?: string,
): Promise<ResolvedEmailChannel | null> {
  if (preferredChannelId) {
    const { data } = await supabase
      .from("notification_channels")
      .select("id, name, config, is_active")
      .eq("id", preferredChannelId)
      .eq("type", "email_resend")
      .eq("is_active", true)
      .maybeSingle();
    if (data?.config?.api_key) {
      return {
        api_key: data.config.api_key,
        from_name: fromNameOverride || data.config.from_name || "Seguwallet",
        from_email: data.config.from_email || "seguwallet@movi.digital",
        channel_id: data.id,
        channel_name: data.name,
      };
    }
  }

  const { data: def } = await supabase
    .from("notification_channels")
    .select("id, name, config, is_active")
    .eq("type", "email_resend")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def?.config?.api_key) {
    return {
      api_key: def.config.api_key,
      from_name: fromNameOverride || def.config.from_name || "MOVI Digital",
      from_email: def.config.from_email || "noresponder@movi.digital",
      channel_id: def.id,
      channel_name: def.name,
    };
  }

  const envKey = Deno.env.get("RESEND_API_KEY");
  if (envKey) {
    return {
      api_key: envKey,
      from_name: fromNameOverride || "Seguwallet",
      from_email: "seguwallet@movi.digital",
      channel_id: null,
      channel_name: null,
    };
  }
  return null;
}

async function resolveWhatsAppChannel(
  supabase: ReturnType<typeof createClient>,
  preferredChannelId?: string | null,
): Promise<ResolvedWhatsAppChannel | null> {
  if (preferredChannelId) {
    const { data } = await supabase
      .from("notification_channels")
      .select("id, name, config, is_active")
      .eq("id", preferredChannelId)
      .eq("type", "whatsapp_wazzup24")
      .eq("is_active", true)
      .maybeSingle();
    if (data?.config?.api_key && data?.config?.channel_id) {
      return {
        api_key: data.config.api_key,
        channel_id_uuid: data.config.channel_id,
        channel_id: data.id,
        channel_name: data.name,
      };
    }
  }

  const { data: def } = await supabase
    .from("notification_channels")
    .select("id, name, config, is_active")
    .eq("type", "whatsapp_wazzup24")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def?.config?.api_key && def?.config?.channel_id) {
    return {
      api_key: def.config.api_key,
      channel_id_uuid: def.config.channel_id,
      channel_id: def.id,
      channel_name: def.name,
    };
  }

  // Legacy fallback
  const { data: legacy } = await supabase
    .from("whatsapp_configuracion")
    .select("api_key, channel_id_uuid, activo")
    .eq("activo", true)
    .maybeSingle();
  if (legacy?.api_key) {
    return {
      api_key: legacy.api_key,
      channel_id_uuid: legacy.channel_id_uuid || "",
      channel_id: null,
      channel_name: null,
    };
  }
  return null;
}

// ── Phone normalizer — MX format, must start with 521 ────────────────────
function normalizePhoneMX(phone: string): string {
  let p = phone.replace(/[^0-9]/g, "");
  // Remove leading + if present
  if (p.startsWith("521") && p.length === 13) return p;          // already correct
  if (p.startsWith("52") && p.length === 12) return "521" + p.substring(2); // 5212... → 5212... nope, 521+10
  if (p.length === 10) return "521" + p;                          // 10-digit MX local
  if (p.startsWith("1") && p.length === 11) return "52" + p;     // US format fallback
  return p;
}

// ── Template renderer ────────────────────────────────────────────────────
function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val ?? "");
  }
  return out;
}

// ── Main handler ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const customerId: string = body.customer_id;

    if (!customerId) {
      return new Response(JSON.stringify({ error: "customer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load customer ──────────────────────────────────────────────────
    const { data: customer, error: custErr } = await supabase
      .from("seguwallet_customers")
      .select("id, full_name, email, phone, whatsapp, agent_user_id, status")
      .eq("id", customerId)
      .maybeSingle();

    if (custErr || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found", details: custErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customer.email || customer.status !== "active") {
      return new Response(JSON.stringify({ skipped: true, reason: "no email or inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load notification type + template ─────────────────────────────
    const { data: tipoData } = await supabase
      .from("correo_tipos_notificacion")
      .select("id")
      .eq("codigo", "seguwallet_bienvenida")
      .maybeSingle();

    if (!tipoData) {
      return new Response(JSON.stringify({ error: "Notification type 'seguwallet_bienvenida' not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tplData, error: tplErr } = await supabase
      .from("correo_plantillas")
      .select("asunto, html_cuerpo, enviar_correo, enviar_whatsapp, enviar_notificacion, whatsapp_plantilla, notificacion_titulo, notificacion_cuerpo, resend_channel_id, wazzup24_channel_id")
      .eq("tipo_notificacion_id", tipoData.id)
      .eq("es_plantilla_default", true)
      .maybeSingle();

    if (tplErr) {
      return new Response(JSON.stringify({ error: "Template query error", details: tplErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tplData) {
      return new Response(JSON.stringify({ skipped: true, reason: "no default template found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load agent brand ───────────────────────────────────────────────
    let brand = {
      logo_url: null as string | null,
      primary_color: DEFAULT_PRIMARY,
      secondary_color: DEFAULT_SECONDARY,
      agent_name: "Tu Agente",
      office_name: null as string | null,
      phone: null as string | null,
      email: null as string | null,
      web_slug: null as string | null,
    };

    if (customer.agent_user_id) {
      const { data: brandData } = await supabase.rpc("get_agent_brand_for_seguwallet", {
        p_agent_id: customer.agent_user_id,
      });
      if (brandData) brand = brandData;
    }

    const urlAgente = brand.web_slug
      ? `https://agentedeseguros.website/${brand.web_slug}`
      : SEGUWALLET_URL;

    const vars: Record<string, string> = {
      nombre_cliente: customer.full_name ?? "Cliente",
      email_cliente: customer.email,
      nombre_agente: brand.agent_name,
      nombre_oficina: brand.office_name ?? "",
      telefono_agente: brand.phone ?? "",
      email_agente: brand.email ?? "",
      logo_agente: brand.logo_url ?? SEGUWALLET_LOGO,
      color_primario: brand.primary_color,
      color_secundario: brand.secondary_color,
      url_seguwallet: SEGUWALLET_URL,
      url_agente: urlAgente,
      url_aviso_privacidad: PRIVACY_URL,
      anio_actual: new Date().getFullYear().toString(),
    };

    const results: Record<string, unknown> = {};

    // ── EMAIL via resolved channel ─────────────────────────────────────
    if (tplData.enviar_correo && tplData.html_cuerpo) {
      const fromName = brand.office_name
        ? `${brand.agent_name} - ${brand.office_name}`
        : brand.agent_name !== "Tu Agente" ? brand.agent_name : "Seguwallet";

      const emailChannel = await resolveEmailChannel(supabase, tplData.resend_channel_id, fromName);

      if (!emailChannel) {
        results.email = { skipped: true, reason: "no email channel configured" };
      } else {
        const subject = renderTemplate(tplData.asunto ?? "Bienvenido a Seguwallet", vars);
        const html = renderTemplate(tplData.html_cuerpo, vars);

        const resendPayload: Record<string, unknown> = {
          from: `${emailChannel.from_name} <${emailChannel.from_email}>`,
          to: [customer.email],
          subject,
          html,
        };
        if (brand.email) resendPayload.reply_to = brand.email;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${emailChannel.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resendPayload),
        });

        const resendBody = await resendRes.json();
        const emailOk = resendRes.ok;

        await supabase.from("correo_historial_envios").insert({
          tipo_notificacion_codigo: "seguwallet_bienvenida",
          tipo_codigo: "seguwallet_bienvenida",
          destinatario_email: customer.email,
          asunto: subject,
          estado: emailOk ? "enviado" : "fallido",
          error_mensaje: emailOk ? null : JSON.stringify(resendBody),
          proveedor: "resend",
          provider_message_id: emailOk ? resendBody.id : null,
          canal_envio: "email",
          channel_id: emailChannel.channel_id,
          channel_name: emailChannel.channel_name,
          channel_type: "email_resend",
        });

        results.email = {
          success: emailOk,
          from: `${emailChannel.from_name} <${emailChannel.from_email}>`,
          channel: emailChannel.channel_name,
          resend_id: emailOk ? resendBody.id : undefined,
          error: emailOk ? undefined : resendBody,
        };
      }
    } else {
      results.email = { skipped: true, reason: "email disabled or no html in template" };
    }

    // ── WHATSAPP via resolved channel ──────────────────────────────────
    const customerPhone = customer.whatsapp || customer.phone;
    if (tplData.enviar_whatsapp && tplData.whatsapp_plantilla && customerPhone) {
      const waChannel = await resolveWhatsAppChannel(supabase, tplData.wazzup24_channel_id);

      if (!waChannel) {
        results.whatsapp = { skipped: true, reason: "no WhatsApp channel configured" };
      } else {
        const waMessage = renderTemplate(tplData.whatsapp_plantilla, vars);
        const chatId = normalizePhoneMX(customerPhone);

        const waRes = await fetch("https://api.wazzup24.com/v3/message", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waChannel.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: waChannel.channel_id_uuid,
            chatType: "whatsapp",
            chatId,
            text: waMessage,
          }),
        });

        const waOk = waRes.ok;
        const waBody = waOk ? await waRes.json() : await waRes.text();

        await supabase.from("correo_historial_envios").insert({
          tipo_notificacion_codigo: "seguwallet_bienvenida",
          tipo_codigo: "seguwallet_bienvenida",
          destinatario_email: customer.email,
          asunto: "Mensaje WhatsApp bienvenida Seguwallet",
          estado: waOk ? "enviado" : "fallido",
          error_mensaje: waOk ? null : JSON.stringify(waBody),
          proveedor: "wazzup",
          canal_envio: "whatsapp",
          numero_destino: chatId,
          channel_id: waChannel.channel_id,
          channel_name: waChannel.channel_name,
          channel_type: "whatsapp_wazzup24",
        });

        results.whatsapp = {
          success: waOk,
          chatId,
          channel: waChannel.channel_name,
          error: waOk ? undefined : waBody,
        };
      }
    } else {
      const reason = !tplData.enviar_whatsapp
        ? "whatsapp disabled in template"
        : !customerPhone
        ? "no phone on customer"
        : "no whatsapp template text";
      results.whatsapp = { skipped: true, reason };
    }

    // ── IN-APP CAMPANITA for agent ─────────────────────────────────────
    if (customer.agent_user_id && (tplData.enviar_notificacion ?? false)) {
      const bellTitle = tplData.notificacion_titulo
        ? renderTemplate(tplData.notificacion_titulo, vars)
        : `Nuevo cliente activado en SeguWallet`;
      const bellBody = tplData.notificacion_cuerpo
        ? renderTemplate(tplData.notificacion_cuerpo, vars)
        : `${customer.full_name ?? "Un cliente"} ha sido activado en SeguWallet.`;

      const { data: notifyResult, error: notifyErr } = await supabase.rpc("notify", {
        p_event_code: "seguwallet_bienvenida",
        p_user_ids: [customer.agent_user_id],
        p_payload: { ...vars, titulo: bellTitle, cuerpo: bellBody },
        p_entity_id: customer.id,
      });

      const bellOk = !notifyErr && (notifyResult as { jobs_created?: number })?.jobs_created > 0;
      if (notifyErr) console.error("[send-welcome] notify() error:", notifyErr);

      await supabase.from("correo_historial_envios").insert({
        tipo_notificacion_codigo: "seguwallet_bienvenida",
        tipo_codigo: "seguwallet_bienvenida",
        destinatario_email: null,
        usuario_id: customer.agent_user_id,
        asunto: bellTitle,
        estado: bellOk ? "enviado" : "fallido",
        error_mensaje: notifyErr ? JSON.stringify(notifyErr) : null,
        proveedor: "internal",
        canal_envio: "notificacion",
      });

      results.bell = { success: bellOk, notify_result: notifyResult };
    } else {
      results.bell = { skipped: true, reason: !customer.agent_user_id ? "no agent" : "bell disabled in template" };
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
