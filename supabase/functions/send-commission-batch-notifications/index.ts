import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  batchId: string;
}

interface CommissionAgent {
  agent_id: string;
  agent_name: string;
  agent_email: string;
  agent_phone: string | null;
  agent_usuario_id: string | null;
  office_name: string | null;
  total_commission: number;
}

function renderTemplate(template: string | null, context: Record<string, string | number>): string {
  if (!template) return "";
  let result = template;
  for (const key in context) {
    const token = `{{${key}}}`;
    result = result.split(token).join(String(context[key] ?? ""));
  }
  return result;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { batchId }: RequestBody = await req.json();

    if (!batchId) {
      throw new Error("batchId is required");
    }

    const { data: batch, error: batchError } = await supabase
      .from("commission_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      throw new Error("Batch not found");
    }

    const { data: details, error: detailsError } = await supabase
      .from("commission_details")
      .select(`
        *,
        agent:agent_id(
          id,
          name,
          email,
          phone_number,
          usuario_id,
          office:office_id(name)
        )
      `)
      .eq("batch_id", batchId);

    if (detailsError) {
      throw new Error("Error fetching commission details");
    }

    const agentMap = new Map<string, CommissionAgent>();

    for (const detail of details || []) {
      const agentId = detail.agent_id;
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agent_id: agentId,
          agent_name: detail.agent?.name || "Agente",
          agent_email: detail.agent?.email || "",
          agent_phone: detail.agent?.phone_number || null,
          agent_usuario_id: detail.agent?.usuario_id || null,
          office_name: detail.agent?.office?.name || "Sin oficina",
          total_commission: 0,
        });
      }

      const agentData = agentMap.get(agentId)!;
      const commission = detail.is_manual_adjusted
        ? (detail.adjusted_commission_neta || 0)
        : detail.commission_neta;
      agentData.total_commission += commission;
    }

    const { data: template, error: templateError } = await supabase
      .from("transactional_notification_templates")
      .select("*")
      .eq("event_key", "commission_batch_closed_agent")
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !template) {
      throw new Error("Template not found or inactive");
    }

    const weekNumber = Math.ceil(
      (new Date(batch.date_from).getTime() - new Date(new Date(batch.date_from).getFullYear(), 0, 1).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
    );

    const results = [];

    for (const [agentId, agentData] of agentMap.entries()) {
      const ordenDePagoUrl = `${supabaseUrl.replace('/v1', '')}/comisiones/lote/${batchId}`;

      const context = {
        agent_name: agentData.agent_name,
        office_name: agentData.office_name || "Sin oficina",
        week_number: weekNumber,
        period_start: formatDate(batch.date_from),
        period_end: formatDate(batch.date_to),
        net_commission_total: formatCurrency(agentData.total_commission),
        orden_de_pago_url: ordenDePagoUrl,
      };

      const emailSubject = renderTemplate(template.email_subject_template, context);
      const emailBody = renderTemplate(template.email_body_template, context);
      const whatsappBody = renderTemplate(template.whatsapp_body_template, context);
      const inappTitle = renderTemplate(template.inapp_title_template, context);
      const inappBody = renderTemplate(template.inapp_body_template, context);

      if (agentData.agent_usuario_id) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: agentData.agent_usuario_id,
            title: inappTitle,
            body: inappBody,
            link_url: ordenDePagoUrl,
            is_read: false,
          });

        if (notifError) {
          console.error(`Error creating in-app notification for ${agentData.agent_name}:`, notifError);
        }
      }

      if (agentData.agent_email && emailSubject && emailBody) {
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-correo-transaccional`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              to: agentData.agent_email,
              subject: emailSubject,
              html: emailBody,
            }),
          });

          if (!emailResponse.ok) {
            console.error(`Error sending email to ${agentData.agent_email}`);
          }
        } catch (emailErr) {
          console.error(`Exception sending email to ${agentData.agent_email}:`, emailErr);
        }
      }

      if (agentData.agent_phone && whatsappBody) {
        try {
          const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              phone: agentData.agent_phone,
              message: whatsappBody,
            }),
          });

          if (!whatsappResponse.ok) {
            console.error(`Error sending WhatsApp to ${agentData.agent_phone}`);
          }
        } catch (whatsappErr) {
          console.error(`Exception sending WhatsApp to ${agentData.agent_phone}:`, whatsappErr);
        }
      }

      results.push({
        agent_id: agentId,
        agent_name: agentData.agent_name,
        notifications_sent: {
          in_app: !!agentData.agent_usuario_id,
          email: !!agentData.agent_email,
          whatsapp: !!agentData.agent_phone,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        agents_notified: results.length,
        results,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing commission batch notifications:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
