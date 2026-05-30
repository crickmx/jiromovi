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

interface CustomerRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  agent_user_id: string | null;
  status: string | null;
}

interface Template {
  asunto: string | null;
  html_cuerpo: string | null;
  enviar_correo: boolean;
  enviar_whatsapp: boolean;
  whatsapp_plantilla: string | null;
}

interface Brand {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  agent_name: string;
  office_name: string | null;
  phone: string | null;
  email: string | null;
  web_slug: string | null;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val ?? "");
  }
  return out;
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[^0-9]/g, "");
  if (p.length === 10) return "521" + p;
  if (p.length === 12 && p.startsWith("52")) return "521" + p.substring(2);
  if (p.length === 13 && !p.startsWith("521")) return "521" + p.substring(3);
  return p;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const customerId: string = body.customer_id;

    if (!customerId) {
      return new Response(JSON.stringify({ error: "customer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load customer with phone fields
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

    const c = customer as CustomerRecord;

    if (!c.email || c.status !== "active") {
      return new Response(JSON.stringify({ skipped: true, reason: "no email or inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load notification type
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

    // Load template — select the correct column name: html_cuerpo
    const { data: tplData, error: tplErr } = await supabase
      .from("correo_plantillas")
      .select("asunto, html_cuerpo, enviar_correo, enviar_whatsapp, whatsapp_plantilla")
      .eq("tipo_notificacion_id", tipoData.id)
      .eq("es_plantilla_default", true)
      .maybeSingle();

    if (tplErr) {
      return new Response(JSON.stringify({ error: "Template query error", details: tplErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = tplData as Template | null;

    if (!template) {
      return new Response(JSON.stringify({ skipped: true, reason: "no default template found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load agent brand
    let brand: Brand = {
      logo_url: null,
      primary_color: DEFAULT_PRIMARY,
      secondary_color: DEFAULT_SECONDARY,
      agent_name: "Tu Agente",
      office_name: null,
      phone: null,
      email: null,
      web_slug: null,
    };

    if (c.agent_user_id) {
      const { data: brandData } = await supabase.rpc("get_agent_brand_for_seguwallet", {
        p_agent_id: c.agent_user_id,
      });
      if (brandData) brand = brandData as Brand;
    }

    const urlAgente = brand.web_slug
      ? `https://agentedeseguros.website/${brand.web_slug}`
      : SEGUWALLET_URL;

    const vars: Record<string, string> = {
      nombre_cliente: c.full_name ?? "Cliente",
      email_cliente: c.email,
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

    // ── EMAIL ───────────────────────────────────────────────────────────────
    if (template.enviar_correo && template.html_cuerpo) {
      if (!resendApiKey) {
        results.email = { skipped: true, reason: "RESEND_API_KEY not configured" };
      } else {
        const subject = renderTemplate(template.asunto ?? "Bienvenido a Seguwallet", vars);
        const html = renderTemplate(template.html_cuerpo, vars);
        const fromName = brand.office_name
          ? `${brand.agent_name} - ${brand.office_name}`
          : brand.agent_name;

        const resendPayload: Record<string, unknown> = {
          from: `${fromName} <notificaciones@movi.digital>`,
          to: [c.email],
          subject,
          html,
        };
        if (brand.email) resendPayload.reply_to = brand.email;

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resendPayload),
        });

        const resendBody = await resendRes.json();
        const emailOk = resendRes.ok;

        await supabase.from("correo_historial_envios").insert({
          tipo_codigo: "seguwallet_bienvenida",
          destinatario_email: c.email,
          asunto: subject,
          estado: emailOk ? "enviado" : "fallido",
          error_mensaje: emailOk ? null : JSON.stringify(resendBody),
          proveedor: "resend",
          provider_message_id: emailOk ? resendBody.id : null,
        });

        results.email = { success: emailOk, resend: resendBody };
      }
    } else {
      results.email = { skipped: true, reason: "email disabled in template or no html" };
    }

    // ── WHATSAPP ────────────────────────────────────────────────────────────
    const customerPhone = c.whatsapp || c.phone;
    if (template.enviar_whatsapp && template.whatsapp_plantilla && customerPhone) {
      const waMessage = renderTemplate(template.whatsapp_plantilla, vars);

      const { data: waConfig } = await supabase
        .from("whatsapp_configuracion")
        .select("api_key, channel_id_uuid, activo")
        .eq("activo", true)
        .maybeSingle();

      if (!waConfig?.api_key) {
        results.whatsapp = { skipped: true, reason: "WhatsApp not configured" };
      } else {
        const chatId = normalizePhone(customerPhone);
        const waRes = await fetch("https://api.wazzup24.com/v3/message", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waConfig.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: waConfig.channel_id_uuid,
            chatType: "whatsapp",
            chatId,
            text: waMessage,
          }),
        });

        const waOk = waRes.ok;
        const waBody = waOk ? await waRes.json() : await waRes.text();

        await supabase.from("correo_historial_envios").insert({
          tipo_codigo: "seguwallet_bienvenida",
          destinatario_email: c.email,
          asunto: "Mensaje WhatsApp",
          estado: waOk ? "enviado" : "fallido",
          error_mensaje: waOk ? null : JSON.stringify(waBody),
          proveedor: "wazzup",
        });

        results.whatsapp = { success: waOk };
      }
    } else {
      const waPhone = customerPhone ? "has phone" : "no phone";
      results.whatsapp = { skipped: true, reason: `whatsapp disabled in template or ${waPhone}` };
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
