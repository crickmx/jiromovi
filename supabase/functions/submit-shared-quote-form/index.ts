import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET") {
      const slug = pathParts[pathParts.length - 1];
      if (!slug) {
        return new Response(JSON.stringify({ error: "Slug requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: link, error } = await supabase
        .from("shared_quote_form_links")
        .select("id, form_type, form_slug, form_title, agent_slug, brand_config_json, status, agent_id, office_id, quote_form_template_id")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;

      if (!link) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.status !== "active") {
        return new Response(JSON.stringify({ error: "inactive" }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.agent_id) {
        const { data: freshBrand } = await supabase.rpc("get_agent_brand_config", { p_agent_id: link.agent_id });
        if (freshBrand) {
          link.brand_config_json = freshBrand;
        }
      }

      let template = null;
      if (link.quote_form_template_id) {
        const { data: tpl } = await supabase
          .from("quote_form_templates")
          .select("*")
          .eq("id", link.quote_form_template_id)
          .maybeSingle();
        template = tpl;
      } else {
        const { data: tpl } = await supabase
          .from("quote_form_templates")
          .select("*")
          .eq("form_type", link.form_type)
          .eq("is_active", true)
          .maybeSingle();
        template = tpl;
      }

      return new Response(JSON.stringify({ link, template }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const slug = pathParts[pathParts.length - 1];
      if (!slug) {
        return new Response(JSON.stringify({ error: "Slug requerido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const {
        client_name, client_phone, client_whatsapp, client_email,
        client_type, client_rfc, client_address_compact, risk_location_compact,
        currency, payment_frequency, start_date, end_date, notes,
        data_json = {},
      } = body;

      if (!client_phone && !client_whatsapp && !client_email) {
        return new Response(JSON.stringify({ error: "contact_required", message: "Se requiere al menos un medio de contacto: telefono, WhatsApp o correo." }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!client_name?.trim()) {
        return new Response(JSON.stringify({ error: "client_name_required" }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: link, error: linkErr } = await supabase
        .from("shared_quote_form_links")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (linkErr) throw linkErr;
      if (!link) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (link.status !== "active") {
        return new Response(JSON.stringify({ error: "inactive" }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const agentId = link.agent_id;
      const officeId = link.office_id;

      // ── Step 1: Create quote_form record ──
      const { data: qForm, error: qErr } = await supabase
        .from("quote_forms")
        .insert({
          created_by: agentId,
          agent_id: agentId,
          office_id: officeId,
          form_type: link.form_type,
          form_title: link.form_title,
          status: "enviado",
          priority: "normal",
          client_name: client_name.trim(),
          client_type: client_type || "no_especificado",
          client_phone: client_phone || null,
          client_email: client_email || null,
          client_whatsapp: client_whatsapp || null,
          client_rfc: client_rfc || null,
          client_address_compact: client_address_compact || null,
          risk_location_compact: risk_location_compact || null,
          currency: currency || null,
          payment_frequency: payment_frequency || null,
          start_date: start_date || null,
          end_date: end_date || null,
          notes: notes || null,
          data_json,
          submitted_at: new Date().toISOString(),
          source: "formulario_compartido",
          channel: "link_publico",
          shared_link_id: link.id,
        })
        .select("id, folio")
        .single();

      if (qErr) throw qErr;

      // ── Step 2: Create submission record ──
      const ipHash = req.headers.get("x-forwarded-for")
        ? btoa(req.headers.get("x-forwarded-for")!).substring(0, 32)
        : null;

      const { data: submission, error: subErr } = await supabase
        .from("shared_quote_form_submissions")
        .insert({
          shared_link_id: link.id,
          quote_form_id: qForm.id,
          agent_id: agentId,
          agent_slug: link.agent_slug,
          office_id: officeId,
          form_type: link.form_type,
          form_slug: link.form_slug,
          client_name: client_name.trim(),
          client_phone: client_phone || null,
          client_whatsapp: client_whatsapp || null,
          client_email: client_email || null,
          data_json,
          ip_address_hash: ipHash,
          user_agent: req.headers.get("user-agent") || null,
          status: "submitted",
        })
        .select("id")
        .single();

      if (subErr) throw subErr;

      await supabase
        .from("quote_forms")
        .update({ public_submission_id: submission.id })
        .eq("id", qForm.id);

      // ── Step 3: Create ticket (commercial process) ──
      const { data: estatusData } = await supabase
        .from("ticket_estatus")
        .select("id")
        .eq("nombre", "Iniciado")
        .eq("activo", true)
        .maybeSingle();

      let ticketId: string | null = null;
      if (estatusData) {
        const instrucciones = buildInstrucciones(link.form_title, {
          client_name, client_phone, client_whatsapp, client_email,
          client_type, client_rfc, client_address_compact, risk_location_compact,
          currency, payment_frequency, notes, ...data_json,
        });

        const { data: ticket } = await supabase
          .from("tickets")
          .insert({
            folio: "",
            tipo_tramite: "formulario_cotizacion",
            estatus_id: estatusData.id,
            prioridad: "Media",
            instrucciones,
            creado_por: agentId,
            modificado_por: agentId,
            agente_id: agentId,
            agente_usuario_id: agentId,
            assigned_to_user_id: agentId,
            quote_form_id: qForm.id,
          })
          .select("id")
          .single();

        if (ticket) {
          ticketId = ticket.id;
          await supabase
            .from("quote_forms")
            .update({ ticket_id: ticketId })
            .eq("id", qForm.id);

          await supabase
            .from("shared_quote_form_submissions")
            .update({ commercial_process_id: ticketId, status: "converted_to_process" })
            .eq("id", submission.id);
        }
      }

      // ── Step 4: Create CRM lead and follow-up task ──
      let leadId: string | null = null;
      let taskId: string | null = null;
      let isNewLead = true;

      try {
        const { data: crmResult, error: crmErr } = await supabase.rpc(
          "create_crm_lead_and_task_from_public_form",
          {
            p_agent_id: agentId,
            p_office_id: officeId,
            p_client_name: client_name.trim(),
            p_client_phone: client_phone || null,
            p_client_whatsapp: client_whatsapp || null,
            p_client_email: client_email || null,
            p_form_type: link.form_type,
            p_form_title: link.form_title,
            p_quote_form_id: qForm.id,
            p_ticket_id: ticketId,
            p_shared_link_id: link.id,
            p_public_submission_id: submission.id,
            p_notes: notes || null,
          }
        );

        if (crmErr) {
          console.error("CRM creation error (non-critical):", crmErr);
        } else if (crmResult) {
          leadId = crmResult.lead_id;
          taskId = crmResult.task_id;
          isNewLead = crmResult.is_new_lead;
        }
      } catch (crmError) {
        console.error("CRM creation exception (non-critical):", crmError);
      }

      // ── Step 5: Increment submissions counter ──
      await supabase
        .from("shared_quote_form_links")
        .update({
          submissions_count: link.submissions_count + 1,
          last_submission_at: new Date().toISOString(),
        })
        .eq("id", link.id);

      // ── Step 6: Send in-app notification to agent ──
      try {
        const notifMensaje = leadId
          ? `Nueva solicitud de cotizacion de ${link.form_title} recibida desde tu formulario compartido. Cliente: ${client_name.trim()}. Se creo un lead en Mi CRM y una tarea de seguimiento.`
          : `Nueva solicitud de cotizacion de ${link.form_title} recibida desde tu formulario compartido. Cliente: ${client_name.trim()}.`;

        await supabase.from("notificaciones").insert({
          usuario_id: agentId,
          tipo: "tramite",
          titulo: "Nueva solicitud de cotizacion recibida",
          mensaje: notifMensaje,
          url: ticketId ? `/tramites/${ticketId}` : `/tramites/formularios`,
          leida: false,
        });
      } catch (_) {
        // Notification failure is non-critical
      }

      return new Response(JSON.stringify({
        ok: true,
        quote_form_id: qForm.id,
        ticket_id: ticketId,
        lead_id: leadId,
        task_id: taskId,
        is_new_lead: isNewLead,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("submit-shared-quote-form error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Error interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildInstrucciones(formTitle: string, data: Record<string, any>): string {
  const parts: string[] = [];
  parts.push(`[FORMULARIO PÚBLICO] ${formTitle} - ${data.client_name || ""}`);
  parts.push(`Origen: Formulario compartido (link público)`);
  parts.push("");
  if (data.client_name) parts.push(`Cliente: ${data.client_name}`);
  if (data.client_type && data.client_type !== "no_especificado") parts.push(`Tipo: ${data.client_type}`);
  if (data.client_phone) parts.push(`Teléfono: ${data.client_phone}`);
  if (data.client_whatsapp) parts.push(`WhatsApp: ${data.client_whatsapp}`);
  if (data.client_email) parts.push(`Correo: ${data.client_email}`);
  if (data.client_rfc) parts.push(`RFC: ${data.client_rfc}`);
  if (data.client_address_compact) parts.push(`Domicilio: ${data.client_address_compact}`);
  if (data.risk_location_compact) parts.push(`Ubicación riesgo: ${data.risk_location_compact}`);
  if (data.currency) parts.push(`Moneda: ${data.currency}`);
  if (data.payment_frequency) parts.push(`Frecuencia pago: ${data.payment_frequency}`);
  if (data.notes) parts.push(`Notas: ${data.notes}`);

  const skip = new Set(["client_name","client_type","client_phone","client_whatsapp","client_email","client_rfc","client_address_compact","risk_location_compact","currency","payment_frequency","notes"]);
  const extras = Object.entries(data).filter(([k, v]) => !skip.has(k) && v && typeof v === "string" && v.trim());
  if (extras.length) {
    parts.push(""); parts.push("--- Datos adicionales ---");
    for (const [k, v] of extras) parts.push(`${k.replace(/_/g, " ")}: ${v}`);
  }
  return parts.join("\n");
}
