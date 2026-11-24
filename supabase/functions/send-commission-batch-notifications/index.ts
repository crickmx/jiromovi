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

interface CommissionUsuario {
  usuario_id: string;
  usuario_name: string;
  usuario_email: string;
  usuario_phone: string | null;
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

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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

    console.log("=== START: Commission Batch Notifications ===");

    const { batchId }: RequestBody = await req.json();
    console.log("Batch ID:", batchId);

    if (!batchId) {
      throw new Error("batchId is required");
    }

    const { data: batch, error: batchError } = await supabase
      .from("commission_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      console.error("Batch error:", batchError);
      throw new Error("Batch not found");
    }

    console.log("Batch found:", batch.name);

    const { data: details, error: detailsError } = await supabase
      .from("commission_details")
      .select(`
        *,
        usuario:usuario_id(
          id,
          nombre_completo,
          nombre_publico,
          nombre,
          email_laboral,
          email_personal,
          celular_laboral,
          celular_personal,
          oficina:oficina_id(nombre)
        )
      `)
      .eq("batch_id", batchId);

    if (detailsError) {
      console.error("Details error:", detailsError);
      throw new Error("Error fetching commission details");
    }

    console.log(`Found ${details?.length || 0} commission details`);

    const usuarioMap = new Map<string, CommissionUsuario>();

    for (const detail of details || []) {
      const usuarioId = detail.usuario_id;
      if (!usuarioId) continue;

      if (!usuarioMap.has(usuarioId)) {
        const usuario = detail.usuario;
        const email = usuario?.email_laboral || usuario?.email_personal || "";
        const phone = usuario?.celular_laboral || usuario?.celular_personal || null;

        usuarioMap.set(usuarioId, {
          usuario_id: usuarioId,
          usuario_name: (usuario as any)?.nombre_publico?.trim() || usuario?.nombre_completo || usuario?.nombre || "Usuario",
          usuario_email: email,
          usuario_phone: phone,
          office_name: usuario?.oficina?.nombre || "Sin oficina",
          total_commission: 0,
        });
      }

      const usuarioData = usuarioMap.get(usuarioId)!;
      const commission = detail.is_manual_adjusted
        ? (detail.adjusted_commission_neta || 0)
        : detail.commission_neta;
      usuarioData.total_commission += commission;
    }

    console.log(`Processing ${usuarioMap.size} unique usuarios`);

    const { data: template, error: templateError } = await supabase
      .from("transactional_notification_templates")
      .select("*")
      .eq("event_key", "commission_batch_closed_agent")
      .eq("is_active", true)
      .maybeSingle();

    if (templateError || !template) {
      console.error("Template error:", templateError);
      console.log("Available templates check...");
      const { data: allTemplates } = await supabase
        .from("transactional_notification_templates")
        .select("event_key, name, is_active");
      console.log("All templates:", allTemplates);
      throw new Error("Template not found or inactive");
    }

    console.log("Template found:", template.name, "Active:", template.is_active);

    const weekNumber = getWeekNumber(new Date(batch.date_from));

    const results = [];

    console.log(`\n=== Starting notifications for ${usuarioMap.size} usuarios ===\n`);

    for (const [usuarioId, usuarioData] of usuarioMap.entries()) {
      console.log(`\nProcessing usuario: ${usuarioData.usuario_name}`);
      console.log(`  Email: ${usuarioData.usuario_email}`);
      console.log(`  Phone: ${usuarioData.usuario_phone}`);
      console.log(`  Usuario ID: ${usuarioId}`);
      console.log(`  Total commission: ${usuarioData.total_commission}`);

      const ordenDePagoUrl = `/mis-comisiones`;

      const context = {
        agent_name: usuarioData.usuario_name,
        office_name: usuarioData.office_name || "Sin oficina",
        week_number: weekNumber,
        period_start: formatDate(batch.date_from),
        period_end: formatDate(batch.date_to),
        net_commission_total: formatCurrency(usuarioData.total_commission),
        orden_de_pago_url: ordenDePagoUrl,
      };

      const emailSubject = renderTemplate(template.email_subject_template, context);
      const emailBody = renderTemplate(template.email_body_template, context);
      const whatsappBody = renderTemplate(template.whatsapp_body_template, context);
      const inappTitle = renderTemplate(template.inapp_title_template, context);
      const inappBody = renderTemplate(template.inapp_body_template, context);

      console.log(`  Templates rendered:`);
      console.log(`    - Email subject: ${emailSubject?.substring(0, 50)}...`);
      console.log(`    - WhatsApp: ${whatsappBody?.substring(0, 50)}...`);
      console.log(`    - InApp title: ${inappTitle}`);

      console.log(`  → Sending in-app notification...`);
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: usuarioId,
          title: inappTitle,
          body: inappBody,
          link_url: ordenDePagoUrl,
          is_read: false,
        });

      if (notifError) {
        console.error(`  ✗ In-app notification failed:`, notifError);
      } else {
        console.log(`  ✓ In-app notification sent`);
      }

      if (usuarioData.usuario_email && emailSubject && emailBody) {
        console.log(`  → Sending email to ${usuarioData.usuario_email}...`);
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-direct-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              to: usuarioData.usuario_email,
              subject: emailSubject,
              html: emailBody,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`  ✗ Email failed (${emailResponse.status}):`, errorText);
          } else {
            const emailResult = await emailResponse.json();
            console.log(`  ✓ Email sent. Resend ID: ${emailResult.resend_id}`);
          }
        } catch (emailErr) {
          console.error(`  ✗ Email exception:`, emailErr);
        }
      } else {
        console.log(`  ⊘ No email or missing template, skipping email`);
      }

      if (usuarioData.usuario_phone && whatsappBody) {
        console.log(`  → Sending WhatsApp to ${usuarioData.usuario_phone}...`);
        try {
          const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-direct-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              phone: usuarioData.usuario_phone,
              message: whatsappBody,
            }),
          });

          if (!whatsappResponse.ok) {
            const errorText = await whatsappResponse.text();
            console.error(`  ✗ WhatsApp failed (${whatsappResponse.status}):`, errorText);
          } else {
            const whatsappResult = await whatsappResponse.json();
            console.log(`  ✓ WhatsApp sent to ${whatsappResult.normalized_phone}`);
          }
        } catch (whatsappErr) {
          console.error(`  ✗ WhatsApp exception:`, whatsappErr);
        }
      } else {
        console.log(`  ⊘ No phone or missing template, skipping WhatsApp`);
      }

      results.push({
        usuario_id: usuarioId,
        usuario_name: usuarioData.usuario_name,
        notifications_sent: {
          in_app: true,
          email: !!usuarioData.usuario_email,
          whatsapp: !!usuarioData.usuario_phone,
        },
      });
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total agents processed: ${results.length}`);
    console.log(`Batch ID: ${batchId}`);
    console.log(`=== END ===\n`);

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