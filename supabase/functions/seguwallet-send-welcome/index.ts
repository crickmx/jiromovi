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
  agent_user_id: string | null;
  status: string | null;
}

interface Template {
  asunto: string | null;
  cuerpo_html: string | null;
  enviar_correo: boolean;
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

    const { data: customer, error: custErr } = await supabase
      .from("seguwallet_customers")
      .select("id, full_name, email, agent_user_id, status")
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

    const { data: tipoData } = await supabase
      .from("correo_tipos_notificacion")
      .select("id")
      .eq("codigo", "seguwallet_bienvenida")
      .maybeSingle();

    if (!tipoData) {
      return new Response(JSON.stringify({ error: "Notification type not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tplData } = await supabase
      .from("correo_plantillas")
      .select("asunto, cuerpo_html, enviar_correo")
      .eq("tipo_notificacion_id", tipoData.id)
      .eq("es_plantilla_default", true)
      .maybeSingle();

    const template = tplData as Template | null;

    if (!template || !template.enviar_correo) {
      return new Response(JSON.stringify({ skipped: true, reason: "template disabled or missing" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const subject = renderTemplate(template.asunto ?? "Bienvenido a Seguwallet", vars);
    const html = renderTemplate(template.cuerpo_html ?? "", vars);

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const success = resendRes.ok;

    await supabase.from("correo_historial_envios").insert({
      tipo_codigo: "seguwallet_bienvenida",
      destinatario_email: c.email,
      asunto: subject,
      estado: success ? "enviado" : "fallido",
      error_mensaje: success ? null : JSON.stringify(resendBody),
      proveedor: "resend",
      provider_message_id: success ? resendBody.id : null,
    });

    return new Response(JSON.stringify({ success, resend: resendBody }), {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
