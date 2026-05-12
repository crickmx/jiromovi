import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SUBJECT_LENGTH = 140;
const BASE_URL = "https://app.movi.digital";
const TIPO_TRAMITE_LABELS: Record<string, string> = {
  cotizacion_emision: "Cotización / Emisión",
  correccion_comisiones: "Corrección de comisiones",
  correccion_polizas: "Corrección de pólizas",
  renovacion: "Renovación",
  cobranza: "Cobranza",
  solicitud_comisiones_pendientes: "Solicitud comisiones pendientes",
  otro: "Otro",
  siniestro: "Siniestro",
  cancelacion: "Cancelación",
  endoso: "Endoso",
};

// ============================================================
// Ticket enrichment helpers
// ============================================================

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const t = text.substring(0, max);
  const sp = t.lastIndexOf(" ");
  return (sp > max * 0.7 ? t.substring(0, sp) : t) + "...";
}

function getShortDescription(ticket: Record<string, unknown>, maxLen = 70): string {
  if (ticket.activity_subtype_name && typeof ticket.activity_subtype_name === "string") {
    return truncate(ticket.activity_subtype_name, maxLen);
  }
  const tipo = ticket.tipo_tramite as string;
  if (tipo && TIPO_TRAMITE_LABELS[tipo]) return TIPO_TRAMITE_LABELS[tipo];
  const instr = ticket.instrucciones as string;
  if (instr) {
    const first = instr.split("\n")[0].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (first) return truncate(first, maxLen);
  }
  if (tipo) return tipo.replace(/_/g, " ");
  return "Actualización";
}

function buildEnhancedSubject(
  folio: string,
  eventLabel: string,
  clientName?: string,
  policyNumber?: string,
  insurerName?: string
): string {
  const parts = [`Trámite #${folio}`, eventLabel];
  if (clientName) parts.push(clientName);
  if (policyNumber) parts.push(`Póliza ${policyNumber}`);
  if (insurerName) parts.push(insurerName);
  let subject = parts.join(" - ");
  if (subject.length > MAX_SUBJECT_LENGTH) {
    subject = subject.substring(0, MAX_SUBJECT_LENGTH - 3) + "...";
  }
  return subject;
}

async function enrichTicketContext(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
  payload: Record<string, unknown>
): Promise<{ enrichedPayload: Record<string, string>; enhancedSubject: string }> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(`
      id, folio, tipo_tramite, instrucciones, poliza, prioridad,
      registro_aseguradora, registro_cliente, registro_numero_poliza,
      insurers,
      ticket_estatus:estatus_id(nombre),
      activity_subtype:activity_subtype_id(nombre),
      insurance_type:insurance_type_id(nombre)
    `)
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return { enrichedPayload: payload as Record<string, string>, enhancedSubject: "" };
  }

  let insurerName = ticket.registro_aseguradora || undefined;
  if (!insurerName && ticket.insurers && Array.isArray(ticket.insurers) && ticket.insurers.length > 0) {
    const { data: ins } = await supabase
      .from("aseguradoras")
      .select("nombre")
      .eq("id", ticket.insurers[0])
      .maybeSingle();
    if (ins?.nombre) insurerName = ins.nombre;
  }

  const clientName = ticket.registro_cliente || undefined;
  const policyNumber = ticket.registro_numero_poliza || ticket.poliza || undefined;
  const actSubtypeName = (ticket.activity_subtype as any)?.nombre || undefined;
  const desc = getShortDescription({ ...ticket, activity_subtype_name: actSubtypeName });
  const folio = ticket.folio || (payload.folio as string) || ticketId.substring(0, 8);

  const enriched: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    enriched[k] = typeof v === "string" ? v : JSON.stringify(v);
  }

  enriched.cliente_segmento = clientName ? ` - ${clientName}` : "";
  enriched.poliza_segmento = policyNumber ? ` - Póliza ${policyNumber}` : "";
  enriched.aseguradora_segmento = insurerName ? ` - ${insurerName}` : "";
  enriched.descripcion_breve = desc;

  const htmlRows: string[] = [];
  const textLines: string[] = [];
  if (clientName) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Cliente:</td><td style="padding:4px 8px;">${clientName}</td></tr>`);
    textLines.push(`Cliente: ${clientName}`);
  }
  if (policyNumber) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Póliza:</td><td style="padding:4px 8px;">${policyNumber}</td></tr>`);
    textLines.push(`Póliza: ${policyNumber}`);
  }
  if (insurerName) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Aseguradora:</td><td style="padding:4px 8px;">${insurerName}</td></tr>`);
    textLines.push(`Aseguradora: ${insurerName}`);
  }
  enriched.datos_identificacion_html = htmlRows.join("\n");
  enriched.datos_identificacion_texto = textLines.length > 0 ? "\n" + textLines.join("\n") + "\n" : "";
  enriched.adjuntos_advertencia_html = "";

  const eventLabel = (payload.estatus_nuevo as string) || desc;
  const enhancedSubject = buildEnhancedSubject(folio, eventLabel, clientName, policyNumber, insurerName);

  return { enrichedPayload: enriched, enhancedSubject };
}

// ============================================================
// Template rendering
// ============================================================

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  }
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  return out;
}

// ============================================================
// Attachment helpers
// ============================================================

async function getSignedUrl(supabase: ReturnType<typeof createClient>, filePath: string): Promise<string | null> {
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  const { data } = await supabase.storage.from("ticket-archivos").createSignedUrl(filePath, 3600);
  return data?.signedUrl || null;
}

async function getTicketAttachments(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
  attachmentData?: Array<{ fileName: string; filePath: string; mimeType?: string; size?: number }>
): Promise<Array<{ fileName: string; filePath: string; mimeType?: string; size?: number }>> {
  if (attachmentData && attachmentData.length > 0) return attachmentData;

  const { data: files } = await supabase
    .from("ticket_archivos")
    .select("nombre, url, tipo, tamano")
    .eq("ticket_id", ticketId)
    .order("fecha_subida", { ascending: false })
    .limit(10);

  if (!files) return [];
  return files.map((f) => ({
    fileName: f.nombre || "documento",
    filePath: f.url || "",
    mimeType: f.tipo || "application/octet-stream",
    size: f.tamano || 0,
  }));
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Support two modes:
    // Mode 1: Process pending jobs from notification_jobs table
    // Mode 2: Direct dispatch with event_code, user_id, payload

    if (body.process_pending_jobs) {
      // Fetch pending jobs
      const { data: pendingJobs } = await supabase
        .from("notification_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(50);

      if (!pendingJobs || pendingJobs.length === 0) {
        return new Response(
          JSON.stringify({ success: true, processed: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let processed = 0;
      let failed = 0;

      for (const job of pendingJobs) {
        try {
          // Mark as processing
          await supabase
            .from("notification_jobs")
            .update({ status: "processing", updated_at: new Date().toISOString() })
            .eq("id", job.id);

          // Resolve user contact info if not in payload
          if (job.user_id && (!job.payload?.email || !job.payload?.phone)) {
            const { data: jobUser } = await supabase
              .from("usuarios")
              .select("email_laboral, email_personal, celular_laboral, celular_personal, nombre, apellidos, nombre_completo")
              .eq("id", job.user_id)
              .maybeSingle();
            if (jobUser) {
              if (!job.payload) job.payload = {};
              if (!job.payload.email) {
                job.payload.email = jobUser.email_laboral || jobUser.email_personal || null;
              }
              if (!job.payload.phone) {
                job.payload.phone = jobUser.celular_laboral || jobUser.celular_personal || null;
              }
              if (!job.payload.nombre_usuario) {
                job.payload.nombre_usuario = jobUser.nombre_completo || `${jobUser.nombre || ""} ${jobUser.apellidos || ""}`.trim() || "Usuario";
              }
            }
          }

          const isTicketEvent = (job.event_code || "").startsWith("tramite_");
          let ticketId: string | null = null;

          // Extract ticket_id from payload URL
          if (isTicketEvent && job.payload?.url) {
            const match = (job.payload.url as string).match(/\/tramites\/([a-f0-9-]+)/);
            if (match) ticketId = match[1];
          }

          // Enrich for ticket events
          let enrichedPayload = job.payload || {};
          let enhancedSubject = "";
          if (isTicketEvent && ticketId) {
            const enrichment = await enrichTicketContext(supabase, ticketId, enrichedPayload);
            enrichedPayload = enrichment.enrichedPayload;
            enhancedSubject = enrichment.enhancedSubject;
          }

          // Get template
          const { data: template } = await supabase
            .from("transactional_notification_templates")
            .select("*")
            .eq("event_key", job.event_code)
            .eq("is_active", true)
            .maybeSingle();

          // Get event config
          const { data: eventConfig } = await supabase
            .from("notification_events_catalog")
            .select("enable_email, enable_whatsapp, enable_in_app")
            .eq("event_code", job.event_code)
            .eq("active", true)
            .maybeSingle();

          if (!template) {
            await supabase
              .from("notification_jobs")
              .update({ status: "failed", last_error: "Template not found", updated_at: new Date().toISOString() })
              .eq("id", job.id);
            failed++;
            continue;
          }

          const vars = enrichedPayload as Record<string, string>;

          // Send based on channel
          if (job.channel === "email" && eventConfig?.enable_email !== false) {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey && job.payload?.email) {
              const subject = enhancedSubject || renderTemplate(template.email_subject_template || "", vars);
              let htmlBody = renderTemplate(template.email_body_template || "", vars);
              htmlBody = htmlBody.replace("{{adjuntos_advertencia_html}}", "");

              // Get attachments for ticket events
              let emailAttachments: Array<{ filename: string; content: string }> = [];
              if (isTicketEvent && ticketId) {
                const atts = await getTicketAttachments(supabase, ticketId, job.attachments as any);
                let totalSize = 0;
                for (const att of atts) {
                  if (totalSize >= 25 * 1024 * 1024) break;
                  if ((att.size || 0) > 20 * 1024 * 1024) continue;
                  try {
                    const url = await getSignedUrl(supabase, att.filePath);
                    if (!url) continue;
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    const buf = await res.arrayBuffer();
                    if (totalSize + buf.byteLength > 25 * 1024 * 1024) continue;
                    totalSize += buf.byteLength;
                    emailAttachments.push({
                      filename: att.fileName,
                      content: btoa(String.fromCharCode(...new Uint8Array(buf))),
                    });
                  } catch { /* skip */ }
                }
              }

              const emailPayload: Record<string, unknown> = {
                from: "MOVI Digital <notificaciones@movi.digital>",
                to: [job.payload.email],
                subject,
                html: htmlBody,
              };
              if (emailAttachments.length > 0) emailPayload.attachments = emailAttachments;

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify(emailPayload),
              });

              if (res.ok) {
                await supabase
                  .from("notification_jobs")
                  .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq("id", job.id);
                processed++;
              } else {
                const errText = await res.text();
                await supabase
                  .from("notification_jobs")
                  .update({
                    status: job.attempt_count >= (job.max_attempts || 3) ? "failed" : "pending",
                    last_error: `Resend ${res.status}: ${errText}`,
                    attempt_count: (job.attempt_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id);
                failed++;
              }
            } else {
              await supabase
                .from("notification_jobs")
                .update({ status: "failed", last_error: "No RESEND_API_KEY or no email", updated_at: new Date().toISOString() })
                .eq("id", job.id);
              failed++;
            }
          } else if (job.channel === "whatsapp" && eventConfig?.enable_whatsapp !== false) {
            const { data: waConfig } = await supabase
              .from("whatsapp_configuracion")
              .select("api_key, channel_id_uuid, activo")
              .eq("activo", true)
              .maybeSingle();

            if (waConfig?.api_key && job.payload?.phone) {
              const message = renderTemplate(template.whatsapp_body_template || "", vars);
              let normalizedPhone = (job.payload.phone as string).replace(/[^0-9]/g, "");
              if (normalizedPhone.length === 10) {
                normalizedPhone = "521" + normalizedPhone;
              } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52")) {
                normalizedPhone = "521" + normalizedPhone.substring(2);
              } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith("521")) {
                normalizedPhone = "521" + normalizedPhone.substring(3);
              }
              const chatId = normalizedPhone;

              // Send text message
              const msgRes = await fetch("https://api.wazzup24.com/v3/message", {
                method: "POST",
                headers: { Authorization: `Bearer ${waConfig.api_key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: waConfig.channel_id_uuid, chatType: "whatsapp", chatId, text: message }),
              });

              if (msgRes.ok) {
                // Send documents for ticket events
                if (isTicketEvent && ticketId) {
                  const atts = await getTicketAttachments(supabase, ticketId, job.attachments as any);
                  for (const att of atts) {
                    try {
                      let url = att.filePath;
                      if (!url.startsWith("http")) {
                        const signed = await getSignedUrl(supabase, url);
                        if (!signed) continue;
                        url = signed;
                      }
                      await fetch("https://api.wazzup24.com/v3/message", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${waConfig.api_key}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ channelId: waConfig.channel_id_uuid, chatType: "whatsapp", chatId, contentUri: url, fileName: att.fileName }),
                      });
                    } catch { /* continue with next */ }
                  }
                }

                await supabase
                  .from("notification_jobs")
                  .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq("id", job.id);
                processed++;
              } else {
                const errText = await msgRes.text();
                await supabase
                  .from("notification_jobs")
                  .update({
                    status: job.attempt_count >= (job.max_attempts || 3) ? "failed" : "pending",
                    last_error: `Wazzup ${msgRes.status}: ${errText}`,
                    attempt_count: (job.attempt_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id);
                failed++;
              }
            } else {
              await supabase
                .from("notification_jobs")
                .update({ status: "failed", last_error: "WhatsApp not configured or no phone", updated_at: new Date().toISOString() })
                .eq("id", job.id);
              failed++;
            }
          } else {
            // In-app or disabled channel
            await supabase
              .from("notification_jobs")
              .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq("id", job.id);
            processed++;
          }
        } catch (err) {
          await supabase
            .from("notification_jobs")
            .update({
              status: "failed",
              last_error: err instanceof Error ? err.message : "Unknown error",
              attempt_count: (job.attempt_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          failed++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed, failed, total: pendingJobs.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Direct dispatch (create jobs)
    const { event_code, user_id, payload, channels } = body;

    if (!event_code || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "event_code and user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get event config
    const { data: eventConfig } = await supabase
      .from("notification_events_catalog")
      .select("enable_email, enable_whatsapp, enable_in_app")
      .eq("event_code", event_code)
      .eq("active", true)
      .maybeSingle();

    // Get user for contact info
    const { data: userInfo } = await supabase
      .from("usuarios")
      .select("email_laboral, celular_laboral, celular_personal")
      .eq("id", user_id)
      .maybeSingle();

    const email = userInfo?.email_laboral || payload?.email;
    const phone = userInfo?.celular_laboral || userInfo?.celular_personal || payload?.phone;

    const jobsToCreate = [];
    const idempBase = `${event_code}_${user_id}_${Date.now()}`;

    if (eventConfig?.enable_email !== false && email) {
      jobsToCreate.push({
        event_code,
        user_id,
        channel: "email",
        status: "pending",
        payload: { ...payload, email },
        idempotency_key: `${idempBase}_email`,
        attempt_count: 0,
        max_attempts: 3,
      });
    }

    if (eventConfig?.enable_whatsapp !== false && phone) {
      jobsToCreate.push({
        event_code,
        user_id,
        channel: "whatsapp",
        status: "pending",
        payload: { ...payload, phone },
        idempotency_key: `${idempBase}_whatsapp`,
        attempt_count: 0,
        max_attempts: 3,
      });
    }

    if (jobsToCreate.length > 0) {
      await supabase.from("notification_jobs").insert(jobsToCreate);
    }

    // Process immediately
    if (jobsToCreate.length > 0) {
      // Self-invoke to process
      const selfUrl = `${supabaseUrl}/functions/v1/notification-dispatcher`;
      fetch(selfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ process_pending_jobs: true }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ success: true, jobs_created: jobsToCreate.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("notification-dispatcher error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
