import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_SUBJECT_LENGTH = 140;
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per file
const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB total for email
const BASE_URL = "https://app.movi.digital";

// ============================================================
// Types
// ============================================================

interface TicketNotificationPayload {
  event_key: string;
  ticket_id: string;
  triggered_by_user_id: string;
  extra_variables?: Record<string, string>;
  attachment_file_ids?: string[];
  skip_email?: boolean;
  skip_whatsapp?: boolean;
}

interface TicketNotificationContext {
  folio: string;
  shortDescription: string;
  clientName?: string;
  policyNumber?: string;
  insuranceCompany?: string;
  ticketType?: string;
  status?: string;
  ticketUrl: string;
}

interface AttachmentInfo {
  id: string;
  fileName: string;
  filePath: string;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  source: "ticket" | "comment" | "policy_delivery" | "contact_center";
}

// ============================================================
// Helper: Build short ticket description
// ============================================================

function getShortTicketDescription(
  ticket: Record<string, unknown>,
  maxLength = 70
): string {
  // Priority: activity subtype name > tipo_tramite label > instrucciones truncated
  const tipoTramiteLabels: Record<string, string> = {
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

  // Use activity subtype name if available
  if (ticket.activity_subtype_name && typeof ticket.activity_subtype_name === "string") {
    return truncateClean(ticket.activity_subtype_name, maxLength);
  }

  // Use tipo_tramite label
  const tipoTramite = ticket.tipo_tramite as string;
  if (tipoTramite && tipoTramiteLabels[tipoTramite]) {
    return tipoTramiteLabels[tipoTramite];
  }

  // Fallback to instrucciones (first line, cleaned)
  const instrucciones = ticket.instrucciones as string;
  if (instrucciones) {
    const firstLine = instrucciones.split("\n")[0].trim();
    const cleaned = firstLine
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length > 0) {
      return truncateClean(cleaned, maxLength);
    }
  }

  if (tipoTramite) {
    return tipoTramite.replace(/_/g, " ");
  }

  return "Actualización de trámite";
}

function truncateClean(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

// ============================================================
// Helper: Build email subject
// ============================================================

function buildTicketEmailSubject(
  context: TicketNotificationContext,
  eventLabel?: string
): string {
  const parts: string[] = [`Trámite #${context.folio}`];

  if (eventLabel) {
    parts.push(eventLabel);
  } else if (context.shortDescription) {
    parts.push(context.shortDescription);
  }

  if (context.clientName) {
    parts.push(context.clientName);
  }

  if (context.policyNumber) {
    parts.push(`Póliza ${context.policyNumber}`);
  }

  if (context.insuranceCompany) {
    parts.push(context.insuranceCompany);
  }

  let subject = parts.join(" - ");

  // Enforce max length: trim description first, keep folio/client/policy/insurer
  if (subject.length > MAX_SUBJECT_LENGTH) {
    // Try removing description
    const partsWithoutDesc = [`Trámite #${context.folio}`];
    if (eventLabel) partsWithoutDesc.push(eventLabel);
    if (context.clientName) partsWithoutDesc.push(context.clientName);
    if (context.policyNumber)
      partsWithoutDesc.push(`Póliza ${context.policyNumber}`);
    if (context.insuranceCompany)
      partsWithoutDesc.push(context.insuranceCompany);

    subject = partsWithoutDesc.join(" - ");
    if (subject.length > MAX_SUBJECT_LENGTH) {
      subject = subject.substring(0, MAX_SUBJECT_LENGTH - 3) + "...";
    }
  }

  return subject;
}

// ============================================================
// Helper: Build notification context from ticket
// ============================================================

async function buildTicketNotificationContext(
  supabase: ReturnType<typeof createClient>,
  ticketId: string
): Promise<TicketNotificationContext & { rawTicket: Record<string, unknown> }> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      `
      id, folio, tipo_tramite, instrucciones, poliza, prioridad,
      registro_aseguradora, registro_cliente, registro_numero_poliza,
      estatus_id, insurers, insurance_type_id,
      ticket_estatus:estatus_id(nombre),
      activity_subtype:activity_subtype_id(nombre),
      insurance_type:insurance_type_id(nombre)
    `
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (!ticket) {
    return {
      folio: "N/A",
      shortDescription: "Trámite",
      ticketUrl: `${BASE_URL}/tramites/${ticketId}`,
      rawTicket: {},
    };
  }

  // Resolve insurer name from insurers array
  let insurerName: string | undefined;
  if (ticket.registro_aseguradora) {
    insurerName = ticket.registro_aseguradora;
  } else if (ticket.insurers && Array.isArray(ticket.insurers) && ticket.insurers.length > 0) {
    const { data: insurerData } = await supabase
      .from("aseguradoras")
      .select("nombre")
      .eq("id", ticket.insurers[0])
      .maybeSingle();
    if (insurerData?.nombre) {
      insurerName = insurerData.nombre;
    }
  }

  const rawTicket = {
    ...ticket,
    activity_subtype_name:
      (ticket.activity_subtype as any)?.nombre || undefined,
  };

  return {
    folio: ticket.folio || ticketId.substring(0, 8),
    shortDescription: getShortTicketDescription(rawTicket),
    clientName: ticket.registro_cliente || undefined,
    policyNumber: ticket.registro_numero_poliza || ticket.poliza || undefined,
    insuranceCompany: insurerName || undefined,
    ticketType: (ticket.insurance_type as any)?.nombre || ticket.tipo_tramite || undefined,
    status: (ticket.ticket_estatus as any)?.nombre || undefined,
    ticketUrl: `${BASE_URL}/tramites/${ticketId}`,
    rawTicket,
  };
}

// ============================================================
// Helper: Build template variable segments
// ============================================================

function buildSegmentVariables(context: TicketNotificationContext): Record<string, string> {
  const vars: Record<string, string> = {};

  // Subject segments (empty string if not available, so template removes them)
  vars.cliente_segmento = context.clientName ? ` - ${context.clientName}` : "";
  vars.poliza_segmento = context.policyNumber
    ? ` - Póliza ${context.policyNumber}`
    : "";
  vars.aseguradora_segmento = context.insuranceCompany
    ? ` - ${context.insuranceCompany}`
    : "";

  // Body identification data
  const htmlRows: string[] = [];
  const textLines: string[] = [];

  if (context.clientName) {
    htmlRows.push(
      `<tr><td style="padding:4px 8px; color:#666;">Cliente:</td><td style="padding:4px 8px;">${context.clientName}</td></tr>`
    );
    textLines.push(`Cliente: ${context.clientName}`);
  }
  if (context.policyNumber) {
    htmlRows.push(
      `<tr><td style="padding:4px 8px; color:#666;">Póliza:</td><td style="padding:4px 8px;">${context.policyNumber}</td></tr>`
    );
    textLines.push(`Póliza: ${context.policyNumber}`);
  }
  if (context.insuranceCompany) {
    htmlRows.push(
      `<tr><td style="padding:4px 8px; color:#666;">Aseguradora:</td><td style="padding:4px 8px;">${context.insuranceCompany}</td></tr>`
    );
    textLines.push(`Aseguradora: ${context.insuranceCompany}`);
  }

  vars.datos_identificacion_html = htmlRows.join("\n");
  vars.datos_identificacion_texto =
    textLines.length > 0 ? "\n" + textLines.join("\n") + "\n" : "";
  vars.descripcion_breve = context.shortDescription || "";

  return vars;
}

// ============================================================
// Helper: Get ticket attachments
// ============================================================

async function getTicketNotificationAttachments(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
  specificFileIds?: string[]
): Promise<AttachmentInfo[]> {
  let query = supabase
    .from("ticket_archivos")
    .select("id, nombre, url, tipo, tamano")
    .eq("ticket_id", ticketId)
    .order("fecha_subida", { ascending: false });

  if (specificFileIds && specificFileIds.length > 0) {
    query = query.in("id", specificFileIds);
  }

  const { data: files } = await query;

  if (!files || files.length === 0) return [];

  return files.map((f) => ({
    id: f.id,
    fileName: f.nombre || "documento",
    filePath: f.url || "",
    fileUrl: f.url || undefined,
    mimeType: f.tipo || "application/octet-stream",
    size: f.tamano || 0,
    source: "ticket" as const,
  }));
}

// ============================================================
// Helper: Generate signed URL for private files
// ============================================================

async function getSignedUrl(
  supabase: ReturnType<typeof createClient>,
  filePath: string
): Promise<string | null> {
  // If it's already a full public URL, return as-is
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // Try to generate a signed URL from storage
  const { data } = await supabase.storage
    .from("ticket-archivos")
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}

// ============================================================
// Helper: Send email with attachments via Resend
// ============================================================

async function sendEmailWithAttachments(
  to: string,
  subject: string,
  htmlBody: string,
  attachments: AttachmentInfo[],
  supabase: ReturnType<typeof createClient>
): Promise<{
  sent: boolean;
  error?: string;
  attachmentsSent: number;
  failedAttachments: string[];
}> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return { sent: false, error: "RESEND_API_KEY not configured", attachmentsSent: 0, failedAttachments: [] };
  }

  const emailAttachments: Array<{ filename: string; content: string }> = [];
  const failedAttachments: string[] = [];
  let totalSize = 0;

  for (const att of attachments) {
    if (totalSize >= MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
      failedAttachments.push(att.fileName);
      continue;
    }

    if ((att.size || 0) > MAX_ATTACHMENT_SIZE_BYTES) {
      failedAttachments.push(att.fileName);
      continue;
    }

    try {
      const url = await getSignedUrl(supabase, att.filePath || att.fileUrl || "");
      if (!url) {
        failedAttachments.push(att.fileName);
        continue;
      }

      const response = await fetch(url);
      if (!response.ok) {
        failedAttachments.push(att.fileName);
        continue;
      }

      const buffer = await response.arrayBuffer();
      if (totalSize + buffer.byteLength > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
        failedAttachments.push(att.fileName);
        continue;
      }

      totalSize += buffer.byteLength;
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(buffer))
      );
      emailAttachments.push({
        filename: att.fileName,
        content: base64,
      });
    } catch {
      failedAttachments.push(att.fileName);
    }
  }

  // Add warning about failed attachments to body
  let finalBody = htmlBody;
  if (failedAttachments.length > 0) {
    const warning = `<p style="margin-top:15px; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:4px; font-size:12px; color:#92400e;">Algunos documentos no pudieron adjuntarse por tamaño o disponibilidad. Puedes consultarlos desde el trámite en MOVI.</p>`;
    finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", warning);
  } else {
    finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", "");
  }

  const emailPayload: Record<string, unknown> = {
    from: "MOVI Digital <notificaciones@movi.digital>",
    to: [to],
    subject,
    html: finalBody,
  };

  if (emailAttachments.length > 0) {
    emailPayload.attachments = emailAttachments;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (res.ok) {
      return {
        sent: true,
        attachmentsSent: emailAttachments.length,
        failedAttachments,
      };
    } else {
      const errText = await res.text();
      return {
        sent: false,
        error: `Resend ${res.status}: ${errText}`,
        attachmentsSent: 0,
        failedAttachments,
      };
    }
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Email send error",
      attachmentsSent: 0,
      failedAttachments,
    };
  }
}

// ============================================================
// Helper: Send WhatsApp message + documents via Wazzup
// ============================================================

async function sendWhatsAppWithDocuments(
  supabase: ReturnType<typeof createClient>,
  phone: string,
  message: string,
  attachments: AttachmentInfo[]
): Promise<{
  messageSent: boolean;
  documentsSent: number;
  error?: string;
  failedDocuments: string[];
}> {
  // Get Wazzup config
  const { data: wazzupConfig } = await supabase
    .from("whatsapp_configuracion")
    .select("api_key, channel_id_uuid, activo")
    .eq("activo", true)
    .maybeSingle();

  if (!wazzupConfig || !wazzupConfig.api_key) {
    return { messageSent: false, documentsSent: 0, error: "WhatsApp not configured", failedDocuments: [] };
  }

  const apiKey = wazzupConfig.api_key;
  const channelId = wazzupConfig.channel_id_uuid;
  const failedDocuments: string[] = [];
  let messageSent = false;
  let documentsSent = 0;

  // Normalize phone
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const chatId = cleanPhone.startsWith("52") ? cleanPhone : `52${cleanPhone}`;

  // 1. Send text message first
  try {
    const msgRes = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId,
        chatType: "whatsapp",
        chatId,
        text: message,
      }),
    });

    if (msgRes.ok) {
      messageSent = true;
    } else {
      const errText = await msgRes.text();
      return {
        messageSent: false,
        documentsSent: 0,
        error: `Wazzup message ${msgRes.status}: ${errText}`,
        failedDocuments: attachments.map((a) => a.fileName),
      };
    }
  } catch (err) {
    return {
      messageSent: false,
      documentsSent: 0,
      error: err instanceof Error ? err.message : "WhatsApp error",
      failedDocuments: attachments.map((a) => a.fileName),
    };
  }

  // 2. Send documents one by one
  for (const att of attachments) {
    try {
      const url = att.fileUrl || att.filePath;
      if (!url) {
        failedDocuments.push(att.fileName);
        continue;
      }

      // Get accessible URL
      let accessibleUrl = url;
      if (!url.startsWith("http")) {
        const signed = await getSignedUrl(supabase, url);
        if (!signed) {
          failedDocuments.push(att.fileName);
          continue;
        }
        accessibleUrl = signed;
      }

      const docRes = await fetch("https://api.wazzup24.com/v3/message", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channelId,
          chatType: "whatsapp",
          chatId,
          contentUri: accessibleUrl,
          fileName: att.fileName,
        }),
      });

      if (docRes.ok) {
        documentsSent++;
      } else {
        failedDocuments.push(att.fileName);
      }
    } catch {
      failedDocuments.push(att.fileName);
    }
  }

  return { messageSent, documentsSent, failedDocuments };
}

// ============================================================
// Helper: Render template with variables
// ============================================================

function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  // Clean remaining unreplaced vars
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");
  return rendered;
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

    const payload: TicketNotificationPayload = await req.json();
    const { event_key, ticket_id, triggered_by_user_id, extra_variables, attachment_file_ids, skip_email, skip_whatsapp } = payload;

    if (!event_key || !ticket_id) {
      return new Response(
        JSON.stringify({ success: false, error: "event_key and ticket_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Build ticket context
    const context = await buildTicketNotificationContext(supabase, ticket_id);
    const segmentVars = buildSegmentVariables(context);

    // 2. Get template
    const { data: template } = await supabase
      .from("transactional_notification_templates")
      .select("*")
      .eq("event_key", event_key)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: `Template not found for event: ${event_key}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get recipient (agent) info
    const ticket = context.rawTicket;
    const agentUserId = (ticket as any).agente_usuario_id || (ticket as any).agente_id;

    if (!agentUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "No agent assigned to ticket" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: agentUser } = await supabase
      .from("usuarios")
      .select("id, nombre, apellidos, email_laboral, celular_laboral, celular_personal")
      .eq("id", agentUserId)
      .maybeSingle();

    if (!agentUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentName = `${agentUser.nombre || ""} ${agentUser.apellidos || ""}`.trim();
    const agentEmail = agentUser.email_laboral;
    const agentPhone = agentUser.celular_laboral || agentUser.celular_personal;

    // 4. Get triggering user info
    const { data: triggerUser } = await supabase
      .from("usuarios")
      .select("nombre, apellidos, rol")
      .eq("id", triggered_by_user_id)
      .maybeSingle();

    const triggerName = triggerUser
      ? `${triggerUser.nombre || ""} ${triggerUser.apellidos || ""}`.trim()
      : "Sistema";
    const triggerRol = triggerUser?.rol || "Sistema";

    // 5. Build all variables
    const allVariables: Record<string, string> = {
      ...segmentVars,
      folio: context.folio,
      tipo_tramite: context.ticketType || context.shortDescription,
      estatus: context.status || "N/A",
      url: context.ticketUrl,
      agente_nombre: agentName,
      modificado_por: triggerName,
      rol_modificador: triggerRol,
      creado_por: triggerName,
      cerrado_por_nombre: triggerName,
      entregado_por: triggerName,
      asignado_por: triggerName,
      autor_nombre: triggerName,
      autor_rol: triggerRol,
      subido_por: triggerName,
      rol_subidor: triggerRol,
      ...(extra_variables || {}),
    };

    // 6. Render subject
    const renderedSubject = renderTemplate(
      template.email_subject_template || "",
      allVariables
    );

    // Build a clean subject using our helper (as fallback / override)
    const eventLabels: Record<string, string> = {
      tramite_creado: "Nuevo trámite",
      tramite_actualizado: context.shortDescription,
      tramite_cambio_estatus: extra_variables?.estatus_nuevo || "Cambio de estatus",
      tramite_comentario_nuevo: "Nuevo comentario",
      tramite_documento_cargado: "Nuevo documento",
      tramite_entrega_poliza: "Póliza entregada",
      tramite_cerrado: extra_variables?.resultado_texto || "Cerrado",
      tramite_asignado: "Asignado a ti",
    };

    const cleanSubject = buildTicketEmailSubject(
      context,
      eventLabels[event_key]
    );

    // Use the clean subject (it respects max length and formatting)
    const finalSubject = cleanSubject;

    // 7. Render body templates
    const renderedEmailBody = renderTemplate(
      template.email_body_template || "",
      allVariables
    );
    const renderedWhatsApp = renderTemplate(
      template.whatsapp_body_template || "",
      allVariables
    );

    // 8. Get attachments
    const attachments = await getTicketNotificationAttachments(
      supabase,
      ticket_id,
      attachment_file_ids
    );

    // 9. Send email
    let emailResult = { sent: false, error: undefined as string | undefined, attachmentsSent: 0, failedAttachments: [] as string[] };
    if (!skip_email && agentEmail) {
      emailResult = await sendEmailWithAttachments(
        agentEmail,
        finalSubject,
        renderedEmailBody,
        attachments,
        supabase
      );
    } else if (!agentEmail) {
      emailResult.error = "El usuario no tiene correo registrado";
    }

    // 10. Send WhatsApp
    let whatsappResult = { messageSent: false, documentsSent: 0, error: undefined as string | undefined, failedDocuments: [] as string[] };
    if (!skip_whatsapp && agentPhone) {
      whatsappResult = await sendWhatsAppWithDocuments(
        supabase,
        agentPhone,
        renderedWhatsApp,
        attachments
      );
    } else if (!agentPhone) {
      whatsappResult.error = "El usuario no tiene teléfono registrado";
    }

    // 11. Log to history
    const { data: historyRecord } = await supabase
      .from("transactional_notification_history")
      .insert({
        event_key,
        user_id: agentUserId,
        email_sent: emailResult.sent,
        email_status: emailResult.sent ? "sent" : "failed",
        email_error: emailResult.error || null,
        whatsapp_sent: whatsappResult.messageSent,
        whatsapp_status: whatsappResult.messageSent ? "sent" : "failed",
        whatsapp_error: whatsappResult.error || null,
        variables: allVariables,
        ticket_id,
        ticket_folio: context.folio,
        email_subject_rendered: finalSubject,
        attachments_count: attachments.length,
        attachments_sent_count: emailResult.attachmentsSent,
        whatsapp_documents_sent_count: whatsappResult.documentsSent,
        failed_attachments_count:
          emailResult.failedAttachments.length + whatsappResult.failedDocuments.length,
        recipient_email: agentEmail || null,
        recipient_phone: agentPhone || null,
      })
      .select("id")
      .maybeSingle();

    // 12. Log individual attachments
    if (historyRecord?.id && attachments.length > 0) {
      const attachLogs = [];

      for (const att of attachments) {
        const emailFailed = emailResult.failedAttachments.includes(att.fileName);
        const whatsappFailed = whatsappResult.failedDocuments.includes(att.fileName);

        if (!skip_email) {
          attachLogs.push({
            notification_history_id: historyRecord.id,
            ticket_id,
            file_name: att.fileName,
            file_path: att.filePath,
            file_url: att.fileUrl,
            mime_type: att.mimeType,
            file_size: att.size || 0,
            source: att.source,
            channel: "email",
            sent_successfully: !emailFailed && emailResult.sent,
            error_message: emailFailed ? "File too large or unavailable" : null,
          });
        }

        if (!skip_whatsapp && agentPhone) {
          attachLogs.push({
            notification_history_id: historyRecord.id,
            ticket_id,
            file_name: att.fileName,
            file_path: att.filePath,
            file_url: att.fileUrl,
            mime_type: att.mimeType,
            file_size: att.size || 0,
            source: att.source,
            channel: "whatsapp",
            sent_successfully: !whatsappFailed && whatsappResult.messageSent,
            error_message: whatsappFailed ? "Document send failed" : null,
          });
        }
      }

      if (attachLogs.length > 0) {
        await supabase.from("notification_attachments_log").insert(attachLogs);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: {
          sent: emailResult.sent,
          subject: finalSubject,
          attachmentsSent: emailResult.attachmentsSent,
          error: emailResult.error,
        },
        whatsapp: {
          messageSent: whatsappResult.messageSent,
          documentsSent: whatsappResult.documentsSent,
          error: whatsappResult.error,
        },
        attachments: {
          total: attachments.length,
          emailFailed: emailResult.failedAttachments,
          whatsappFailed: whatsappResult.failedDocuments,
        },
        historyId: historyRecord?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("ticket-notification-dispatcher error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
