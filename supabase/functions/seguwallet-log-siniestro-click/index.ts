import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EVENT_CODE = "seguwallet_siniestro_click";

interface RequestBody {
  insurer_id?: string;
  insurer_name: string;
  claims_phone?: string | null;
  event_type: "call" | "whatsapp" | "view";
  source?: "modal" | "directory" | "dashboard";
}

interface ResolvedWhatsAppChannel {
  api_key: string;
  channel_id_uuid: string;
  channel_id: string | null;
  channel_name: string | null;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v ?? "");
  }
  return out;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDateTime(): string {
  return new Date().toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function normalizePhoneMX(phone: string): string {
  const p = phone.replace(/[^0-9]/g, "");
  if (p.startsWith("521") && p.length === 13) return p;
  if (p.startsWith("52") && p.length === 12) return "521" + p.substring(2);
  if (p.length === 10) return "521" + p;
  if (p.startsWith("1") && p.length === 11) return "52" + p;
  return p;
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

async function logHistorial(
  supabase: ReturnType<typeof createClient>,
  opts: {
    canal_envio: string;
    usuario_id: string | null;
    destinatario_email: string | null;
    destinatario_nombre: string | null;
    numero_destino: string | null;
    asunto: string;
    estado: string;
    error_mensaje?: string | null;
    provider_message_id?: string | null;
    proveedor?: string | null;
    channel_id?: string | null;
    channel_name?: string | null;
    channel_type?: string | null;
    evento_id?: string | null;
  },
) {
  await supabase.from("correo_historial_envios").insert({
    tipo_notificacion_codigo: EVENT_CODE,
    tipo_codigo: EVENT_CODE,
    canal_envio: opts.canal_envio,
    usuario_id: opts.usuario_id,
    destinatario_email: opts.destinatario_email,
    destinatario_nombre: opts.destinatario_nombre,
    numero_destino: opts.numero_destino,
    asunto: opts.asunto,
    estado: opts.estado,
    error_mensaje: opts.error_mensaje ?? null,
    proveedor: opts.proveedor ?? null,
    provider_message_id: opts.provider_message_id ?? null,
    channel_id: opts.channel_id ?? null,
    channel_name: opts.channel_name ?? null,
    channel_type: opts.channel_type ?? null,
    evento_id: opts.evento_id ?? null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { insurer_id, insurer_name, claims_phone, event_type, source = "modal" } = body;

    if (!insurer_name || !event_type) {
      return new Response(JSON.stringify({ error: "insurer_name and event_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load customer ──────────────────────────────────────────────────────
    const { data: customer } = await supabase
      .from("seguwallet_customers")
      .select("id, full_name, agent_user_id")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Log the click event ────────────────────────────────────────────────
    const { data: event } = await supabase
      .from("seguwallet_claims_events")
      .insert({
        seguwallet_customer_id: customer.id,
        agent_user_id: customer.agent_user_id,
        insurer_id: insurer_id || null,
        insurer_name,
        claims_phone: claims_phone || null,
        event_type,
        source,
      })
      .select("id")
      .maybeSingle();

    const results: Record<string, unknown> = {
      event_id: event?.id,
      bell_sent: false,
      whatsapp_sent: false,
    };

    if (!customer.agent_user_id) {
      return new Response(JSON.stringify({ success: true, ...results, note: "no agent_user_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load template from correo_plantillas ───────────────────────────────
    const { data: tipoData } = await supabase
      .from("correo_tipos_notificacion")
      .select("id")
      .eq("codigo", EVENT_CODE)
      .maybeSingle();

    const { data: tpl } = tipoData
      ? await supabase
        .from("correo_plantillas")
        .select(
          "notificacion_titulo, notificacion_cuerpo, whatsapp_plantilla, " +
          "enviar_notificacion, enviar_whatsapp, wazzup24_channel_id",
        )
        .eq("tipo_notificacion_id", tipoData.id)
        .eq("es_plantilla_default", true)
        .maybeSingle()
      : { data: null };

    console.log("[siniestro-click] event_code:", EVENT_CODE, "template_found:", !!tpl);

    // ── Load agent data ────────────────────────────────────────────────────
    const { data: agente } = await supabase
      .from("usuarios")
      .select("nombre, nombre_completo, celular_laboral, email_laboral")
      .eq("id", customer.agent_user_id)
      .maybeSingle();

    const agenteNombre = agente?.nombre_completo || agente?.nombre || "Agente";
    const agentePhone = agente?.celular_laboral || null;
    const agenteEmail = agente?.email_laboral || null;

    const tipoContacto =
      event_type === "call" ? "Llamada telefónica"
      : event_type === "whatsapp" ? "WhatsApp"
      : "Vista";

    const vars: Record<string, string> = {
      cliente_nombre: customer.full_name || "Cliente",
      aseguradora_nombre: insurer_name,
      tipo_contacto: tipoContacto,
      telefono_siniestros: claims_phone ? formatPhoneDisplay(claims_phone) : "N/A",
      fecha_hora: formatDateTime(),
    };

    const asunto = `Tu cliente ${vars.cliente_nombre} contactó siniestros de ${insurer_name}`;

    // ── IN-APP / CAMPANITA ─────────────────────────────────────────────────
    const enviarNotificacion = tpl?.enviar_notificacion ?? true;
    if (enviarNotificacion) {
      const bellTitle = tpl?.notificacion_titulo
        ? renderTemplate(tpl.notificacion_titulo, vars)
        : `Alerta siniestro - ${insurer_name}`;
      const bellBody = tpl?.notificacion_cuerpo
        ? renderTemplate(tpl.notificacion_cuerpo, vars)
        : `${vars.cliente_nombre} contactó siniestros de ${insurer_name} (${tipoContacto})`;

      const { data: notifyResult, error: notifyErr } = await supabase.rpc("notify", {
        p_event_code: EVENT_CODE,
        p_user_ids: [customer.agent_user_id],
        p_payload: { ...vars, titulo: bellTitle, cuerpo: bellBody },
        p_entity_id: event?.id ?? null,
      });

      const bellOk = !notifyErr && (notifyResult as { jobs_created?: number })?.jobs_created > 0;
      results.bell_sent = bellOk;
      results.notify_result = notifyResult;

      if (notifyErr) console.error("[siniestro-click] notify() error:", notifyErr);

      await logHistorial(supabase, {
        canal_envio: "notificacion",
        usuario_id: customer.agent_user_id,
        destinatario_email: agenteEmail,
        destinatario_nombre: agenteNombre,
        numero_destino: null,
        asunto,
        estado: bellOk ? "enviado" : "fallido",
        error_mensaje: notifyErr ? JSON.stringify(notifyErr) : null,
        proveedor: "internal",
        evento_id: event?.id ?? null,
      });
    }

    // ── WHATSAPP ───────────────────────────────────────────────────────────
    const enviarWhatsapp = tpl?.enviar_whatsapp ?? true;
    const whatsappTpl = tpl?.whatsapp_plantilla
      ?? `Tu cliente *{{cliente_nombre}}* contactó a siniestros de *{{aseguradora_nombre}}* el {{fecha_hora}} desde SeguWallet.`;

    if (enviarWhatsapp && agentePhone) {
      const waChannel = await resolveWhatsAppChannel(supabase, tpl?.wazzup24_channel_id ?? null);
      const waText = renderTemplate(whatsappTpl, vars);
      const chatId = normalizePhoneMX(agentePhone);

      console.log("[siniestro-click] whatsapp channel:", waChannel?.channel_name ?? "none", "chatId:", chatId);

      if (!waChannel) {
        results.whatsapp_sent = false;
        results.whatsapp_error = "no_channel_configured";
        await logHistorial(supabase, {
          canal_envio: "whatsapp",
          usuario_id: customer.agent_user_id,
          destinatario_email: agenteEmail,
          destinatario_nombre: agenteNombre,
          numero_destino: chatId,
          asunto,
          estado: "fallido",
          error_mensaje: "channel_not_found",
          evento_id: event?.id ?? null,
        });
      } else {
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
            text: waText,
          }),
        });

        const waOk = waRes.ok;
        const waBody = waOk ? await waRes.json() : await waRes.text();
        results.whatsapp_sent = waOk;

        console.log("[siniestro-click] whatsapp send ok:", waOk);

        await logHistorial(supabase, {
          canal_envio: "whatsapp",
          usuario_id: customer.agent_user_id,
          destinatario_email: agenteEmail,
          destinatario_nombre: agenteNombre,
          numero_destino: chatId,
          asunto,
          estado: waOk ? "enviado" : "fallido",
          error_mensaje: waOk ? null : JSON.stringify(waBody),
          provider_message_id: waOk ? (waBody as { messageId?: string })?.messageId ?? null : null,
          proveedor: "wazzup",
          channel_id: waChannel.channel_id,
          channel_name: waChannel.channel_name,
          channel_type: "whatsapp_wazzup24",
          evento_id: event?.id ?? null,
        });
      }
    } else if (enviarWhatsapp && !agentePhone) {
      results.whatsapp_sent = false;
      results.whatsapp_error = "recipient_missing_phone";
      console.warn("[siniestro-click] agent has no phone, skipping WhatsApp");
    }

    // ── Update event with notification status ──────────────────────────────
    if (event?.id) {
      await supabase
        .from("seguwallet_claims_events")
        .update({
          bell_notification_sent: results.bell_sent as boolean,
          whatsapp_notification_sent: results.whatsapp_sent as boolean,
        })
        .eq("id", event.id);
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[siniestro-click] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
