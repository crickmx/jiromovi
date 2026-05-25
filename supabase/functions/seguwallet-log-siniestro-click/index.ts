import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  insurer_id?: string;
  insurer_name: string;
  claims_phone?: string | null;
  event_type: "call" | "whatsapp" | "view";
  source?: "modal" | "directory" | "dashboard";
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
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

    // Get the seguwallet customer
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

    // Log the event
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

    let notifResult: Record<string, unknown> = { bell_sent: false, whatsapp_sent: false };

    // Send notifications to the agent
    if (customer.agent_user_id) {
      const tipoContacto =
        event_type === "call" ? "Llamada telefonica"
        : event_type === "whatsapp" ? "WhatsApp"
        : "Vista";

      const variables = {
        cliente_nombre: customer.full_name || "Cliente",
        aseguradora_nombre: insurer_name,
        telefono_siniestros: claims_phone ? formatPhoneDisplay(claims_phone) : "N/A",
        tipo_contacto: tipoContacto,
        fecha_hora: formatDateTime(),
      };

      // Call notify() to create in_app + whatsapp jobs
      const { data: notifyResult, error: notifyError } = await supabase.rpc("notify", {
        p_event_code: "seguwallet_siniestro_click",
        p_user_ids: [customer.agent_user_id],
        p_payload: variables,
        p_entity_id: event?.id ?? null,
      });

      if (notifyError) {
        console.error("notify() error:", notifyError);
      } else {
        const r = notifyResult as { jobs_created?: number };
        notifResult = {
          bell_sent: (r?.jobs_created ?? 0) > 0,
          whatsapp_sent: (r?.jobs_created ?? 0) > 0,
          notify_result: notifyResult,
        };
      }

      // Fetch agent data for historial logging
      const { data: agente } = await supabase
        .from("usuarios")
        .select("nombre, nombre_completo, celular_laboral, email_laboral")
        .eq("id", customer.agent_user_id)
        .maybeSingle();

      const agenteNombre = agente?.nombre_completo || agente?.nombre || "Agente";
      const agentePhone = agente?.celular_laboral || null;
      const agenteEmail = agente?.email_laboral || null;

      const asunto = `Tu cliente ${variables.cliente_nombre} contactó siniestros de ${insurer_name}`;
      const cuerpoHtml = `<p>Tu cliente <strong>${variables.cliente_nombre}</strong> contactó a siniestros de <strong>${insurer_name}</strong> el ${variables.fecha_hora} mediante ${tipoContacto} desde SeguWallet.</p>`;
      const whatsappMsg = `Tu cliente *${variables.cliente_nombre}* contactó a siniestros de *${insurer_name}* el ${variables.fecha_hora} desde SeguWallet.`;

      // Log in-app notification to historial
      await supabase.rpc("registrar_envio_notificacion", {
        p_tipo_notificacion_codigo: "seguwallet_siniestro_click",
        p_canal_envio: "notificacion",
        p_usuario_id: customer.agent_user_id,
        p_destinatario_nombre: agenteNombre,
        p_asunto: asunto,
        p_cuerpo_html: `<p>${variables.notificacion_cuerpo || cuerpoHtml}</p>`,
        p_estado: notifResult.bell_sent ? "enviado" : "fallido",
        p_evento_id: event?.id ?? null,
        p_enviado_por: null,
      });

      // Log whatsapp notification to historial (only if phone available)
      if (agentePhone) {
        await supabase.rpc("registrar_envio_notificacion", {
          p_tipo_notificacion_codigo: "seguwallet_siniestro_click",
          p_canal_envio: "whatsapp",
          p_usuario_id: customer.agent_user_id,
          p_destinatario_nombre: agenteNombre,
          p_numero_destino: agentePhone,
          p_asunto: asunto,
          p_cuerpo_html: whatsappMsg,
          p_estado: notifResult.whatsapp_sent ? "enviado" : "fallido",
          p_evento_id: event?.id ?? null,
          p_enviado_por: null,
        });
      }

      // Update event with notification status
      if (event?.id) {
        await supabase
          .from("seguwallet_claims_events")
          .update({
            bell_notification_sent: (notifResult.bell_sent as boolean) ?? false,
            whatsapp_notification_sent: (notifResult.whatsapp_sent as boolean) ?? false,
          })
          .eq("id", event.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, event_id: event?.id, ...notifResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
