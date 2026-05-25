import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  insurer_id: string;
  insurer_name: string;
  claims_phone: string | null;
  event_type: "call" | "whatsapp" | "view";
  source: "modal" | "directory" | "dashboard";
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

    // Verify the JWT and get the user
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
    const { insurer_id, insurer_name, claims_phone, event_type, source } = body;

    if (!insurer_name || !event_type) {
      return new Response(JSON.stringify({ error: "insurer_name and event_type are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the seguwallet customer for this auth user
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
    const { data: event, error: insertError } = await supabase
      .from("seguwallet_claims_events")
      .insert({
        seguwallet_customer_id: customer.id,
        agent_user_id: customer.agent_user_id,
        insurer_id: insurer_id || null,
        insurer_name,
        claims_phone: claims_phone || null,
        event_type,
        source: source || "modal",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to log claims event:", insertError);
      // Don't fail the request if logging fails
    }

    // Send notifications to the agent if we have one
    let bellSent = false;
    let whatsappSent = false;

    if (customer.agent_user_id) {
      const now = new Date();
      const fechaHora = now.toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      const tipoContacto = event_type === "call" ? "Llamada telefonica" : event_type === "whatsapp" ? "WhatsApp" : "Vista";

      const variables = {
        cliente_nombre: customer.full_name || "Cliente",
        aseguradora_nombre: insurer_name,
        telefono_siniestros: claims_phone ? formatPhoneDisplay(claims_phone) : "N/A",
        tipo_contacto: tipoContacto,
        fecha_hora: fechaHora,
      };

      // Send bell notification
      try {
        const { error: notifError } = await supabase
          .from("notificaciones")
          .insert({
            usuario_id: customer.agent_user_id,
            tipo: "seguwallet_siniestro_click",
            titulo: `Alerta de siniestro - SeguWallet`,
            cuerpo: `Tu cliente ${variables.cliente_nombre} contacto siniestros de ${insurer_name} (${tipoContacto})`,
            leida: false,
            metadata: { ...variables, insurer_id, event_id: event?.id },
          });

        if (!notifError) bellSent = true;
      } catch (e) {
        console.error("Bell notification failed:", e);
      }

      // Send WhatsApp notification via the existing notification system
      try {
        const { error: waError } = await supabase.rpc("enviar_notificacion_completa", {
          p_tipo_codigo: "seguwallet_siniestro_click",
          p_usuario_id: customer.agent_user_id,
          p_variables: variables,
          p_solo_canales: ["whatsapp"],
        });

        if (!waError) whatsappSent = true;
      } catch (e) {
        console.error("WhatsApp notification failed:", e);
      }

      // Update event with notification status
      if (event?.id) {
        await supabase
          .from("seguwallet_claims_events")
          .update({
            bell_notification_sent: bellSent,
            whatsapp_notification_sent: whatsappSent,
          })
          .eq("id", event.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event?.id,
        bell_sent: bellSent,
        whatsapp_sent: whatsappSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
