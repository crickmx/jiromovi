import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SUBJECT_LENGTH = 140;
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const BASE_URL = "https://app.movi.digital";

// ============================================================
// Types
// ============================================================

interface NotificationPayload {
  event_key: string;
  user_id: string;
  variables: Record<string, string>;
  ticket_id?: string;
  attachment_file_ids?: string[];
}

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

// ============================================================
// Channel resolution helpers
// ============================================================

async function resolveEmailChannel(
  supabase: ReturnType<typeof createClient>,
  preferredChannelId?: string | null
): Promise<ResolvedEmailChannel | null> {
  // 1. Try preferred channel
  if (preferredChannelId) {
    const { data } = await supabase
      .from("notification_channels")
      .select("id, name, config, branding, is_active")
      .eq("id", preferredChannelId)
      .eq("type", "email_resend")
      .eq("is_active", true)
      .maybeSingle();
    if (data?.config?.api_key) {
      return {
        api_key: data.config.api_key,
        from_name: data.config.from_name || data.branding?.sender_name || "MOVI Digital",
        from_email: data.config.from_email || "notificaciones@movi.digital",
        channel_id: data.id,
        channel_name: data.name,
      };
    }
  }

  // 2. Try default channel
  const { data: def } = await supabase
    .from("notification_channels")
    .select("id, name, config, branding, is_active")
    .eq("type", "email_resend")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def?.config?.api_key) {
    return {
      api_key: def.config.api_key,
      from_name: def.config.from_name || def.branding?.sender_name || "MOVI Digital",
      from_email: def.config.from_email || "notificaciones@movi.digital",
      channel_id: def.id,
      channel_name: def.name,
    };
  }

  // 3. Fallback to env var
  const envKey = Deno.env.get("RESEND_API_KEY");
  if (envKey) {
    return {
      api_key: envKey,
      from_name: "MOVI Digital",
      from_email: "notificaciones@movi.digital",
      channel_id: null,
      channel_name: null,
    };
  }

  return null;
}

async function resolveWhatsAppChannel(
  supabase: ReturnType<typeof createClient>,
  preferredChannelId?: string | null
): Promise<ResolvedWhatsAppChannel | null> {
  // 1. Try preferred channel
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

  // 2. Try default channel
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

  // 3. Fallback to legacy whatsapp_configuracion
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

// ============================================================
// Ticket enrichment helpers
// ============================================================

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const t = text.substring(0, max);
  const sp = t.lastIndexOf(" ");
  return (sp > max * 0.7 ? t.substring(0, sp) : t) + "...";
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
    const shorter = [`Trámite #${folio}`, eventLabel];
    if (clientName) shorter.push(clientName);
    if (policyNumber) shorter.push(`Póliza ${policyNumber}`);
    if (insurerName) shorter.push(insurerName);
    subject = shorter.join(" - ");
    if (subject.length > MAX_SUBJECT_LENGTH) {
      subject = subject.substring(0, MAX_SUBJECT_LENGTH - 3) + "...";
    }
  }
  return subject;
}

async function enrichTicketVariables(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
  existingVars: Record<string, string>
): Promise<{ enrichedVars: Record<string, string>; enhancedSubject: string; ticketFolio: string }> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(`
      id, folio, tipo_tramite, instrucciones, poliza, prioridad,
      registro_aseguradora, registro_cliente, registro_numero_poliza,
      insurers, insurance_type_id,
      ticket_estatus:estatus_id(nombre),
      activity_subtype:activity_subtype_id(nombre),
      insurance_type:insurance_type_id(nombre)
    `)
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return { enrichedVars: existingVars, enhancedSubject: "", ticketFolio: existingVars.folio || "" };
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

  const enriched = { ...existingVars };
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

  const folio = ticket.folio || existingVars.folio || ticketId.substring(0, 8);
  const eventLabel = existingVars.estatus_nuevo || desc;
  const enhancedSubject = buildEnhancedSubject(folio, eventLabel, clientName, policyNumber, insurerName);

  return { enrichedVars: enriched, enhancedSubject, ticketFolio: folio };
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
  fileIds?: string[]
): Promise<Array<{ id: string; fileName: string; filePath: string; fileUrl?: string; mimeType?: string; size?: number }>> {
  let query = supabase
    .from("ticket_archivos")
    .select("id, nombre, url, tipo, tamano")
    .eq("ticket_id", ticketId)
    .order("fecha_subida", { ascending: false });
  if (fileIds && fileIds.length > 0) query = query.in("id", fileIds);
  const { data } = await query;
  if (!data) return [];
  return data.map((f) => ({
    id: f.id,
    fileName: f.nombre || "documento",
    filePath: f.url || "",
    fileUrl: f.url || undefined,
    mimeType: f.tipo || "application/octet-stream",
    size: f.tamano || 0,
  }));
}

async function downloadAndEncodeAttachments(
  supabase: ReturnType<typeof createClient>,
  attachments: Array<{ fileName: string; filePath: string; size?: number }>
): Promise<{ encoded: Array<{ filename: string; content: string }>; failed: string[] }> {
  const encoded: Array<{ filename: string; content: string }> = [];
  const failed: string[] = [];
  let totalSize = 0;

  for (const att of attachments) {
    if (totalSize >= MAX_TOTAL_ATTACHMENT_SIZE_BYTES) { failed.push(att.fileName); continue; }
    if ((att.size || 0) > MAX_ATTACHMENT_SIZE_BYTES) { failed.push(att.fileName); continue; }
    try {
      const url = await getSignedUrl(supabase, att.filePath);
      if (!url) { failed.push(att.fileName); continue; }
      const res = await fetch(url);
      if (!res.ok) { failed.push(att.fileName); continue; }
      const buf = await res.arrayBuffer();
      if (totalSize + buf.byteLength > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) { failed.push(att.fileName); continue; }
      totalSize += buf.byteLength;
      encoded.push({ filename: att.fileName, content: btoa(String.fromCharCode(...new Uint8Array(buf))) });
    } catch { failed.push(att.fileName); }
  }
  return { encoded, failed };
}

// ============================================================
// WhatsApp sending helper
// ============================================================

async function sendWhatsApp(
  channel: ResolvedWhatsAppChannel,
  supabase: ReturnType<typeof createClient>,
  phone: string,
  message: string,
  attachments: Array<{ fileName: string; filePath: string }>
): Promise<{ sent: boolean; documentsSent: number; error?: string; failedDocs: string[] }> {
  let normalizedPhone = phone.replace(/[^0-9]/g, "");
  if (normalizedPhone.length === 10) {
    normalizedPhone = "521" + normalizedPhone;
  } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52")) {
    normalizedPhone = "521" + normalizedPhone.substring(2);
  } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith("521")) {
    normalizedPhone = "521" + normalizedPhone.substring(3);
  }
  const chatId = normalizedPhone;
  const failedDocs: string[] = [];
  let documentsSent = 0;

  try {
    const res = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.channel_id_uuid, chatType: "whatsapp", chatId, text: message }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { sent: false, documentsSent: 0, error: `Wazzup ${res.status}: ${err}`, failedDocs: attachments.map(a => a.fileName) };
    }
  } catch (err) {
    return { sent: false, documentsSent: 0, error: err instanceof Error ? err.message : "WhatsApp error", failedDocs: [] };
  }

  for (const att of attachments) {
    try {
      let url = att.filePath;
      if (!url.startsWith("http")) {
        const signed = await getSignedUrl(supabase, url);
        if (!signed) { failedDocs.push(att.fileName); continue; }
        url = signed;
      }
      const res = await fetch("https://api.wazzup24.com/v3/message", {
        method: "POST",
        headers: { Authorization: `Bearer ${channel.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.channel_id_uuid, chatType: "whatsapp", chatId, contentUri: url, fileName: att.fileName }),
      });
      if (res.ok) documentsSent++;
      else failedDocs.push(att.fileName);
    } catch { failedDocs.push(att.fileName); }
  }

  return { sent: true, documentsSent, failedDocs };
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

    const payload: NotificationPayload = await req.json();
    const { event_key, user_id, variables, ticket_id, attachment_file_ids } = payload;

    if (!event_key || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "event_key and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get template (includes channel assignments)
    const { data: template } = await supabase
      .from("transactional_notification_templates")
      .select("*")
      .eq("event_key", event_key)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: `Template not found: ${event_key}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get recipient user
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, nombre, apellidos, email_laboral, celular_laboral, celular_personal")
      .eq("id", user_id)
      .maybeSingle();

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = user.email_laboral;
    const userPhone = user.celular_laboral || user.celular_personal;

    // 3. Resolve channels
    const emailChannel = await resolveEmailChannel(supabase, null);
    const waChannel = await resolveWhatsAppChannel(supabase, null);

    // 4. Determine if this is a ticket event and enrich variables
    const isTicketEvent = event_key.startsWith("tramite_");
    let finalVars = { ...variables };
    let enhancedSubject = "";
    let resolvedTicketId = ticket_id || null;
    let ticketFolio = variables.folio || "";

    if (isTicketEvent) {
      if (!resolvedTicketId && variables.url) {
        const match = variables.url.match(/\/tramites\/([a-f0-9-]+)/);
        if (match) resolvedTicketId = match[1];
      }

      if (resolvedTicketId) {
        const enrichment = await enrichTicketVariables(supabase, resolvedTicketId, finalVars);
        finalVars = enrichment.enrichedVars;
        enhancedSubject = enrichment.enhancedSubject;
        ticketFolio = enrichment.ticketFolio;
      }
    }

    // 5. Render templates
    const renderedSubjectRaw = renderTemplate(template.email_subject_template || "", finalVars);
    const renderedSubject = isTicketEvent && enhancedSubject ? enhancedSubject : renderedSubjectRaw;
    const renderedEmailBody = renderTemplate(template.email_body_template || "", finalVars);
    const renderedWhatsApp = renderTemplate(template.whatsapp_body_template || "", finalVars);

    // 6. Get attachments for ticket events
    let attachments: Array<{ id: string; fileName: string; filePath: string; fileUrl?: string; mimeType?: string; size?: number }> = [];
    if (isTicketEvent && resolvedTicketId) {
      attachments = await getTicketAttachments(supabase, resolvedTicketId, attachment_file_ids);
    }

    // 7. Send email via resolved channel
    let emailSent = false;
    let emailError: string | null = null;
    let emailAttachmentsSent = 0;
    let emailFailedAttachments: string[] = [];

    if (userEmail && emailChannel) {
      let emailPayloadAttachments: Array<{ filename: string; content: string }> = [];
      if (attachments.length > 0) {
        const { encoded, failed } = await downloadAndEncodeAttachments(supabase, attachments);
        emailPayloadAttachments = encoded;
        emailFailedAttachments = failed;
        emailAttachmentsSent = encoded.length;
      }

      let finalBody = renderedEmailBody;
      if (emailFailedAttachments.length > 0) {
        const warning = `<p style="margin-top:15px; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:4px; font-size:12px; color:#92400e;">Algunos documentos no pudieron adjuntarse por tamaño o disponibilidad. Puedes consultarlos desde el trámite en MOVI.</p>`;
        finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", warning);
      }
      finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", "");

      const emailPayload: Record<string, unknown> = {
        from: `${emailChannel.from_name} <${emailChannel.from_email}>`,
        to: [userEmail],
        subject: renderedSubject,
        html: finalBody,
      };
      if (emailPayloadAttachments.length > 0) {
        emailPayload.attachments = emailPayloadAttachments;
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${emailChannel.api_key}`, "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        });
        emailSent = res.ok;
        if (!res.ok) {
          emailError = `Resend ${res.status}: ${await res.text()}`;
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Email error";
      }
    } else if (!emailChannel) {
      emailError = "No email channel configured";
    } else {
      emailError = "User has no email";
    }

    // 8. Send WhatsApp via resolved channel
    let whatsappSent = false;
    let whatsappError: string | null = null;
    let whatsappDocsSent = 0;
    let whatsappFailedDocs: string[] = [];

    if (userPhone && waChannel) {
      const waResult = await sendWhatsApp(waChannel, supabase, userPhone, renderedWhatsApp, attachments);
      whatsappSent = waResult.sent;
      whatsappError = waResult.error || null;
      whatsappDocsSent = waResult.documentsSent;
      whatsappFailedDocs = waResult.failedDocs;
    } else if (!waChannel) {
      whatsappError = "No WhatsApp channel configured";
    } else {
      whatsappError = "User has no phone";
    }

    // 9. Create in-app notification
    let inappNotifId: string | null = null;
    if (template.inapp_title_template || template.inapp_body_template) {
      const inappTitle = renderTemplate(template.inapp_title_template || "", finalVars);
      const inappBody = renderTemplate(template.inapp_body_template || "", finalVars);

      const { data: notif } = await supabase
        .from("notificaciones")
        .insert({
          usuario_id: user_id,
          tipo: "tramite",
          titulo: inappTitle || renderedSubject,
          mensaje: inappBody || renderedSubject,
          url: finalVars.url || null,
          leida: false,
        })
        .select("id")
        .maybeSingle();
      inappNotifId = notif?.id || null;
    }

    // 10. Log history with channel tracking
    await supabase.from("transactional_notification_history").insert({
      event_key,
      user_id,
      email_sent: emailSent,
      email_status: emailSent ? "sent" : (emailError ? "failed" : "skipped"),
      email_error: emailError,
      whatsapp_sent: whatsappSent,
      whatsapp_status: whatsappSent ? "sent" : (whatsappError ? "failed" : "skipped"),
      whatsapp_error: whatsappError,
      inapp_notification_id: inappNotifId,
      variables: finalVars,
      ticket_id: resolvedTicketId,
      ticket_folio: ticketFolio,
      email_subject_rendered: renderedSubject,
      attachments_count: attachments.length,
      attachments_sent_count: emailAttachmentsSent,
      whatsapp_documents_sent_count: whatsappDocsSent,
      failed_attachments_count: emailFailedAttachments.length + whatsappFailedDocs.length,
      recipient_email: userEmail || null,
      recipient_phone: userPhone || null,
    });

    // 11. Log attachment details
    if (attachments.length > 0 && resolvedTicketId) {
      const attLogs = attachments.flatMap((att) => {
        const logs = [];
        logs.push({
          ticket_id: resolvedTicketId,
          file_name: att.fileName,
          file_path: att.filePath,
          file_url: att.fileUrl,
          mime_type: att.mimeType,
          file_size: att.size || 0,
          source: "ticket",
          channel: "email",
          sent_successfully: !emailFailedAttachments.includes(att.fileName) && emailSent,
          error_message: emailFailedAttachments.includes(att.fileName) ? "Size/availability" : null,
        });
        if (userPhone) {
          logs.push({
            ticket_id: resolvedTicketId,
            file_name: att.fileName,
            file_path: att.filePath,
            file_url: att.fileUrl,
            mime_type: att.mimeType,
            file_size: att.size || 0,
            source: "ticket",
            channel: "whatsapp",
            sent_successfully: !whatsappFailedDocs.includes(att.fileName) && whatsappSent,
            error_message: whatsappFailedDocs.includes(att.fileName) ? "Document send failed" : null,
          });
        }
        return logs;
      });
      if (attLogs.length > 0) {
        await supabase.from("notification_attachments_log").insert(attLogs);
      }
    }

    // Also log to correo_historial_envios for email
    if (emailSent || emailError) {
      await supabase.from("correo_historial_envios").insert({
        tipo_codigo: event_key,
        canal_envio: "correo",
        destinatario_email: userEmail || null,
        destinatario_nombre: `${user.nombre || ""} ${user.apellidos || ""}`.trim() || null,
        usuario_id: user_id,
        asunto: renderedSubject,
        estado: emailSent ? "enviado" : "fallido",
        proveedor: "resend",
        channel_id: emailChannel?.channel_id || null,
        channel_name: emailChannel?.channel_name || null,
        channel_type: emailChannel ? "email_resend" : null,
        error_mensaje: emailError || null,
        fecha_envio: new Date().toISOString(),
      }).catch(() => {});
    }

    // Also log to correo_historial_envios for whatsapp
    if (whatsappSent || (whatsappError && whatsappError !== "User has no phone" && whatsappError !== "No WhatsApp channel configured")) {
      await supabase.from("correo_historial_envios").insert({
        tipo_codigo: event_key,
        canal_envio: "whatsapp",
        destinatario_email: null,
        destinatario_nombre: `${user.nombre || ""} ${user.apellidos || ""}`.trim() || null,
        numero_destino: userPhone || null,
        usuario_id: user_id,
        asunto: null,
        estado: whatsappSent ? "enviado" : "fallido",
        proveedor: "wazzup24",
        channel_id: waChannel?.channel_id || null,
        channel_name: waChannel?.channel_name || null,
        channel_type: waChannel ? "whatsapp_wazzup24" : null,
        error_mensaje: whatsappError || null,
        fecha_envio: new Date().toISOString(),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_sent: emailSent,
        email_error: emailError,
        email_channel: emailChannel?.channel_name || null,
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappError,
        whatsapp_channel: waChannel?.channel_name || null,
        subject: renderedSubject,
        attachments_count: attachments.length,
        email_attachments_sent: emailAttachmentsSent,
        whatsapp_documents_sent: whatsappDocsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("enviar-correo-transaccional error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
