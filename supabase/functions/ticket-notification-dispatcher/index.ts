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
const SIGNED_URL_DURATION_SECONDS = 3600; // 1 hour

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

interface AttachmentResult {
  fileName: string;
  channel: "email" | "whatsapp";
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

// ============================================================
// Helper: Build short ticket description
// ============================================================

function getShortTicketDescription(
  ticket: Record<string, unknown>,
  maxLength = 70
): string {
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

  if (ticket.activity_subtype_name && typeof ticket.activity_subtype_name === "string") {
    return truncateClean(ticket.activity_subtype_name, maxLength);
  }

  const tipoTramite = ticket.tipo_tramite as string;
  if (tipoTramite && tipoTramiteLabels[tipoTramite]) {
    return tipoTramiteLabels[tipoTramite];
  }

  const instrucciones = ticket.instrucciones as string;
  if (instrucciones) {
    const firstLine = instrucciones.split("\n")[0].trim();
    const cleaned = firstLine.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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

  if (subject.length > MAX_SUBJECT_LENGTH) {
    const partsWithoutDesc = [`Trámite #${context.folio}`];
    if (eventLabel) partsWithoutDesc.push(eventLabel);
    if (context.clientName) partsWithoutDesc.push(context.clientName);
    if (context.policyNumber) partsWithoutDesc.push(`Póliza ${context.policyNumber}`);
    if (context.insuranceCompany) partsWithoutDesc.push(context.insuranceCompany);

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
      agente_usuario_id, agente_id,
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
    activity_subtype_name: (ticket.activity_subtype as any)?.nombre || undefined,
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

  vars.cliente_segmento = context.clientName ? ` - ${context.clientName}` : "";
  vars.poliza_segmento = context.policyNumber ? ` - Póliza ${context.policyNumber}` : "";
  vars.aseguradora_segmento = context.insuranceCompany ? ` - ${context.insuranceCompany}` : "";

  const htmlRows: string[] = [];
  const textLines: string[] = [];

  if (context.clientName) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Cliente:</td><td style="padding:4px 8px;">${context.clientName}</td></tr>`);
    textLines.push(`Cliente: ${context.clientName}`);
  }
  if (context.policyNumber) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Póliza:</td><td style="padding:4px 8px;">${context.policyNumber}</td></tr>`);
    textLines.push(`Póliza: ${context.policyNumber}`);
  }
  if (context.insuranceCompany) {
    htmlRows.push(`<tr><td style="padding:4px 8px; color:#666;">Aseguradora:</td><td style="padding:4px 8px;">${context.insuranceCompany}</td></tr>`);
    textLines.push(`Aseguradora: ${context.insuranceCompany}`);
  }

  vars.datos_identificacion_html = htmlRows.join("\n");
  vars.datos_identificacion_texto = textLines.length > 0 ? "\n" + textLines.join("\n") + "\n" : "";
  vars.descripcion_breve = context.shortDescription || "";

  return vars;
}

// ============================================================
// Helper: Resolve downloadable URL from stored path/URL
// ============================================================

function extractStoragePath(fullUrl: string): { bucket: string; path: string } | null {
  // Pattern: .../storage/v1/object/public/<bucket>/<path>
  const publicMatch = fullUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }
  // Pattern: .../storage/v1/object/sign/<bucket>/<path>
  const signedMatch = fullUrl.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }
  return null;
}

async function resolveFileUrl(
  supabase: ReturnType<typeof createClient>,
  fileUrlOrPath: string
): Promise<{ downloadUrl: string; signedUrl: string } | null> {
  if (!fileUrlOrPath) return null;

  // For full URLs, extract the storage path and create a signed URL
  if (fileUrlOrPath.startsWith("http://") || fileUrlOrPath.startsWith("https://")) {
    const parsed = extractStoragePath(fileUrlOrPath);
    if (parsed) {
      console.log(`[resolveFileUrl] Parsed URL -> bucket: "${parsed.bucket}", path: "${parsed.path}"`);
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, SIGNED_URL_DURATION_SECONDS);
      if (error) {
        console.error(`[resolveFileUrl] createSignedUrl error for ${parsed.bucket}/${parsed.path}:`, error.message);
      }
      if (data?.signedUrl) {
        // ALWAYS use signed URL for both download and external access (bucket may be private)
        return { downloadUrl: data.signedUrl, signedUrl: data.signedUrl };
      }
    }
    // Fallback: try the original URL directly (might work for truly public buckets)
    return { downloadUrl: fileUrlOrPath, signedUrl: fileUrlOrPath };
  }

  // For relative paths, try known buckets
  const buckets = ["ticket-archivos", "lector-qualitas", "documents", "entregas"];
  for (const bucket of buckets) {
    if (fileUrlOrPath.startsWith(`${bucket}/`) || fileUrlOrPath.includes(`/${bucket}/`)) {
      const cleanPath = fileUrlOrPath.replace(new RegExp(`^${bucket}/`), "");
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath, SIGNED_URL_DURATION_SECONDS);
      if (data?.signedUrl) {
        return { downloadUrl: data.signedUrl, signedUrl: data.signedUrl };
      }
    }
  }

  // Default: try ticket-archivos
  const { data } = await supabase.storage
    .from("ticket-archivos")
    .createSignedUrl(fileUrlOrPath, SIGNED_URL_DURATION_SECONDS);

  if (data?.signedUrl) {
    return { downloadUrl: data.signedUrl, signedUrl: data.signedUrl };
  }

  return null;
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

  const { data: files, error } = await query;

  if (error) {
    console.error("[Attachments] Error querying ticket_archivos:", error.message);
    return [];
  }

  if (!files || files.length === 0) {
    console.log(`[Attachments] No files found for ticket ${ticketId}${specificFileIds ? ` (filtered to ${specificFileIds.length} IDs)` : ""}`);
    return [];
  }

  console.log(`[Attachments] Found ${files.length} files for ticket ${ticketId}`);

  // Deduplicate by url to avoid sending the same file twice
  const seen = new Set<string>();
  const deduped: AttachmentInfo[] = [];

  for (const f of files) {
    const key = f.url || f.id;
    if (seen.has(key)) continue;
    seen.add(key);

    deduped.push({
      id: f.id,
      fileName: f.nombre || "documento",
      filePath: f.url || "",
      fileUrl: f.url || undefined,
      mimeType: f.tipo || "application/octet-stream",
      size: f.tamano || 0,
      source: "ticket" as const,
    });
  }

  return deduped;
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
  attachmentDetails: AttachmentResult[];
}> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return {
      sent: false,
      error: "RESEND_API_KEY not configured",
      attachmentsSent: 0,
      failedAttachments: [],
      attachmentDetails: [],
    };
  }

  const emailAttachments: Array<{ filename: string; content: string }> = [];
  const failedAttachments: string[] = [];
  const attachmentDetails: AttachmentResult[] = [];
  let totalSize = 0;

  for (const att of attachments) {
    if (totalSize >= MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
      console.log(`[Email] Skipping ${att.fileName}: total size limit reached`);
      failedAttachments.push(att.fileName);
      attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "skipped", reason: "Total email size limit exceeded" });
      continue;
    }

    if (att.size && att.size > MAX_ATTACHMENT_SIZE_BYTES) {
      console.log(`[Email] Skipping ${att.fileName}: file too large (${att.size} bytes)`);
      failedAttachments.push(att.fileName);
      attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "skipped", reason: `File too large: ${(att.size / 1024 / 1024).toFixed(1)}MB` });
      continue;
    }

    try {
      const rawUrl = att.fileUrl || att.filePath || "";
      console.log(`[Email] Resolving URL for "${att.fileName}": ${rawUrl.substring(0, 100)}...`);

      const resolved = await resolveFileUrl(supabase, rawUrl);
      if (!resolved) {
        console.log(`[Email] Could not resolve URL for ${att.fileName}`);
        failedAttachments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "failed", reason: "Could not resolve file URL" });
        continue;
      }

      // Always use signed URL for download (bucket is private)
      const downloadUrl = resolved.signedUrl;
      console.log(`[Email] Downloading "${att.fileName}" from signed URL: ${downloadUrl.substring(0, 100)}...`);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        console.log(`[Email] Download failed for ${att.fileName}: HTTP ${response.status}`);
        failedAttachments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "failed", reason: `Download HTTP ${response.status}` });
        continue;
      }

      const buffer = await response.arrayBuffer();
      console.log(`[Email] Downloaded ${att.fileName}: ${buffer.byteLength} bytes`);

      if (buffer.byteLength === 0) {
        console.log(`[Email] Empty file: ${att.fileName}`);
        failedAttachments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "failed", reason: "Empty file (0 bytes)" });
        continue;
      }

      if (totalSize + buffer.byteLength > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) {
        console.log(`[Email] Skipping ${att.fileName}: would exceed total size limit`);
        failedAttachments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "skipped", reason: "Would exceed total size limit" });
        continue;
      }

      totalSize += buffer.byteLength;

      // Convert to base64
      const bytes = new Uint8Array(buffer);
      const chunkSize = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      emailAttachments.push({
        filename: att.fileName,
        content: base64,
      });
      attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "sent" });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Email] Error processing ${att.fileName}:`, errMsg);
      failedAttachments.push(att.fileName);
      attachmentDetails.push({ fileName: att.fileName, channel: "email", status: "failed", reason: errMsg });
    }
  }

  // Build warning message if some attachments failed
  let finalBody = htmlBody;
  if (failedAttachments.length > 0 && attachments.length > 0) {
    const warning = `<p style="margin-top:15px; padding:10px; background:#fef3c7; border:1px solid #f59e0b; border-radius:4px; font-size:12px; color:#92400e;">Algunos documentos no pudieron adjuntarse por tamaño o disponibilidad. Puedes consultarlos desde el trámite en MOVI.</p>`;
    finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", warning);
  } else {
    finalBody = finalBody.replace("{{adjuntos_advertencia_html}}", "");
  }

  // Add attachment list reference in body if attachments exist
  if (emailAttachments.length > 0) {
    const attachListHtml = `<p style="margin-top:10px; font-size:13px; color:#374151;">Se adjuntan ${emailAttachments.length} documento(s) a este correo.</p>`;
    finalBody = finalBody.replace("{{adjuntos_lista_html}}", attachListHtml);
  } else {
    finalBody = finalBody.replace("{{adjuntos_lista_html}}", "");
  }

  const emailPayload: Record<string, unknown> = {
    from: "MOVI Digital <notificaciones@movi.digital>",
    to: [to],
    subject,
    html: finalBody,
  };

  if (emailAttachments.length > 0) {
    emailPayload.attachments = emailAttachments;
    console.log(`[Email] Sending email to ${to} with ${emailAttachments.length} attachments (total: ${(totalSize / 1024).toFixed(0)}KB)`);
  } else {
    console.log(`[Email] Sending email to ${to} without attachments`);
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
      const resBody = await res.json();
      console.log(`[Email] Sent successfully. ID: ${resBody?.id || "N/A"}`);
      return { sent: true, attachmentsSent: emailAttachments.length, failedAttachments, attachmentDetails };
    } else {
      const errText = await res.text();
      console.error(`[Email] Resend error ${res.status}: ${errText}`);
      // Mark all as failed since the whole email failed
      for (const detail of attachmentDetails) {
        if (detail.status === "sent") {
          detail.status = "failed";
          detail.reason = `Email delivery failed: Resend ${res.status}`;
        }
      }
      return { sent: false, error: `Resend ${res.status}: ${errText}`, attachmentsSent: 0, failedAttachments: attachments.map(a => a.fileName), attachmentDetails };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Email send error";
    console.error("[Email] Exception:", errMsg);
    return { sent: false, error: errMsg, attachmentsSent: 0, failedAttachments: attachments.map(a => a.fileName), attachmentDetails };
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
  attachmentDetails: AttachmentResult[];
}> {
  const { data: wazzupConfig } = await supabase
    .from("whatsapp_configuracion")
    .select("api_key, channel_id_uuid, activo")
    .eq("activo", true)
    .maybeSingle();

  if (!wazzupConfig || !wazzupConfig.api_key) {
    return { messageSent: false, documentsSent: 0, error: "WhatsApp not configured", failedDocuments: [], attachmentDetails: [] };
  }

  const apiKey = wazzupConfig.api_key;
  const channelId = wazzupConfig.channel_id_uuid;
  const failedDocuments: string[] = [];
  const attachmentDetails: AttachmentResult[] = [];
  let messageSent = false;
  let documentsSent = 0;

  // Normalize phone for Mexican WhatsApp (must be 521 + 10 digits)
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  let chatId: string;
  if (cleanPhone.startsWith("521") && cleanPhone.length === 13) {
    chatId = cleanPhone;
  } else if (cleanPhone.startsWith("52") && cleanPhone.length === 12) {
    chatId = "521" + cleanPhone.substring(2);
  } else if (cleanPhone.length === 10) {
    chatId = "521" + cleanPhone;
  } else {
    chatId = "521" + cleanPhone.replace(/^(521|52)/, "");
  }

  console.log(`[WhatsApp] Sending to chatId: ${chatId} (original: ${phone})`);

  // 1. Send text message (always keep URL at the end)
  const MAX_WA_LENGTH = 4000;
  let finalMessage = message;
  if (finalMessage.length > MAX_WA_LENGTH) {
    const urlMatch = finalMessage.match(/https?:\/\/[^\s]+$/);
    const url = urlMatch ? urlMatch[0] : "";
    const maxBody = MAX_WA_LENGTH - url.length - 20;
    finalMessage = finalMessage.substring(0, maxBody) + "...\n\n" + url;
  }

  try {
    const msgPayload = {
      channelId,
      chatType: "whatsapp",
      chatId,
      text: finalMessage,
    };

    console.log(`[WhatsApp] Sending text message (${finalMessage.length} chars)`);
    const msgRes = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msgPayload),
    });

    if (msgRes.ok) {
      messageSent = true;
      console.log("[WhatsApp] Text message sent successfully");
    } else {
      const errText = await msgRes.text();
      console.error(`[WhatsApp] Text message failed ${msgRes.status}: ${errText}`);
      return {
        messageSent: false,
        documentsSent: 0,
        error: `Wazzup message ${msgRes.status}: ${errText}`,
        failedDocuments: attachments.map((a) => a.fileName),
        attachmentDetails: attachments.map(a => ({ fileName: a.fileName, channel: "whatsapp" as const, status: "failed" as const, reason: "Text message delivery failed" })),
      };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "WhatsApp error";
    console.error("[WhatsApp] Text message exception:", errMsg);
    return {
      messageSent: false,
      documentsSent: 0,
      error: errMsg,
      failedDocuments: attachments.map((a) => a.fileName),
      attachmentDetails: attachments.map(a => ({ fileName: a.fileName, channel: "whatsapp" as const, status: "failed" as const, reason: errMsg })),
    };
  }

  // 2. Send documents one by one
  if (attachments.length === 0) {
    console.log("[WhatsApp] No documents to send");
    return { messageSent, documentsSent: 0, failedDocuments: [], attachmentDetails: [] };
  }

  console.log(`[WhatsApp] Sending ${attachments.length} documents...`);

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    try {
      const rawUrl = att.fileUrl || att.filePath || "";
      if (!rawUrl) {
        console.log(`[WhatsApp] Skipping ${att.fileName}: no URL`);
        failedDocuments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "failed", reason: "No file URL available" });
        continue;
      }

      // Resolve to a signed URL that Wazzup can access
      const resolved = await resolveFileUrl(supabase, rawUrl);
      if (!resolved) {
        console.log(`[WhatsApp] Could not resolve URL for ${att.fileName}`);
        failedDocuments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "failed", reason: "Could not resolve file URL" });
        continue;
      }

      // Use signed URL for Wazzup (external service needs accessible URL)
      const accessibleUrl = resolved.signedUrl;

      // Verify the signed URL is accessible before sending to Wazzup
      console.log(`[WhatsApp] Verifying signed URL for "${att.fileName}"...`);
      const verifyRes = await fetch(accessibleUrl, { method: "HEAD" });
      if (!verifyRes.ok) {
        console.error(`[WhatsApp] Signed URL not accessible for ${att.fileName}: HTTP ${verifyRes.status}`);
        failedDocuments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "failed", reason: `Signed URL not accessible: HTTP ${verifyRes.status}` });
        continue;
      }
      console.log(`[WhatsApp] Signed URL verified OK for "${att.fileName}" (${verifyRes.headers.get("content-length") || "?"} bytes)`);

      // Sanitize fileName: remove brackets, special chars that Wazzup might reject
      const sanitizedFileName = att.fileName
        .replace(/^\[Carátula\]\s*/i, "Caratula-")
        .replace(/[^\w\s.\-()]/g, "")
        .replace(/\s+/g, " ")
        .trim() || "documento.pdf";

      // Wazzup document payload: do NOT include "text" field with contentUri
      // (sending both text and contentUri causes INVALID_MESSAGE_DATA error)
      const docPayload = {
        channelId,
        chatType: "whatsapp",
        chatId,
        contentUri: accessibleUrl,
        fileName: sanitizedFileName,
      };

      console.log(`[WhatsApp] Sending document "${sanitizedFileName}" to Wazzup...`);
      const docRes = await fetch("https://api.wazzup24.com/v3/message", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(docPayload),
      });

      if (docRes.ok) {
        documentsSent++;
        attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "sent" });
        console.log(`[WhatsApp] Document sent: ${att.fileName}`);
      } else {
        const errText = await docRes.text();
        console.error(`[WhatsApp] Document failed ${att.fileName}: ${docRes.status} ${errText}`);
        console.error(`[WhatsApp] Payload was: ${JSON.stringify({ ...docPayload, contentUri: docPayload.contentUri.substring(0, 80) + "..." })}`);
        failedDocuments.push(att.fileName);
        attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "failed", reason: `Wazzup ${docRes.status}: ${errText.substring(0, 200)}` });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[WhatsApp] Document exception ${att.fileName}:`, errMsg);
      failedDocuments.push(att.fileName);
      attachmentDetails.push({ fileName: att.fileName, channel: "whatsapp", status: "failed", reason: errMsg });
    }

    // Small delay between document sends to avoid rate limiting
    if (i < attachments.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`[WhatsApp] Documents result: ${documentsSent} sent, ${failedDocuments.length} failed`);
  return { messageSent, documentsSent, failedDocuments, attachmentDetails };
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

    const rawPayload = await req.json();

    // === TEST MODE: diagnose attachment resolution without sending ===
    if (rawPayload.testMode === true) {
      console.log("[Dispatcher] TEST MODE activated");
      const testTicketId = rawPayload.ticket_id;
      const testFileIds = rawPayload.attachment_file_ids;

      if (!testTicketId) {
        return new Response(
          JSON.stringify({ success: false, error: "ticket_id required for test mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const attachments = await getTicketNotificationAttachments(supabase, testTicketId, testFileIds);
      const results: Array<{ fileName: string; rawUrl: string; signedUrl?: string; downloadStatus?: number; contentLength?: string; error?: string }> = [];

      for (const att of attachments) {
        const rawUrl = att.fileUrl || att.filePath || "";
        const resolved = await resolveFileUrl(supabase, rawUrl);
        if (!resolved) {
          results.push({ fileName: att.fileName, rawUrl, error: "Could not resolve URL" });
          continue;
        }
        try {
          const headRes = await fetch(resolved.signedUrl, { method: "HEAD" });
          results.push({
            fileName: att.fileName,
            rawUrl: rawUrl.substring(0, 100),
            signedUrl: resolved.signedUrl.substring(0, 100) + "...",
            downloadStatus: headRes.status,
            contentLength: headRes.headers.get("content-length") || "unknown",
          });
        } catch (err) {
          results.push({ fileName: att.fileName, rawUrl: rawUrl.substring(0, 100), signedUrl: resolved.signedUrl.substring(0, 80), error: String(err) });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          ticketId: testTicketId,
          fileIdsRequested: testFileIds || "all",
          attachmentsFound: attachments.length,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: TicketNotificationPayload = rawPayload;
    const { event_key, ticket_id, triggered_by_user_id, extra_variables, attachment_file_ids, skip_email, skip_whatsapp } = payload;

    console.log(`[Dispatcher] ========== START ==========`);
    console.log(`[Dispatcher] eventType: ${event_key}`);
    console.log(`[Dispatcher] ticketId: ${ticket_id}`);
    console.log(`[Dispatcher] triggeredBy: ${triggered_by_user_id}`);
    console.log(`[Dispatcher] attachmentFileIds received: ${attachment_file_ids ? JSON.stringify(attachment_file_ids) : "none (will fetch all)"}`);
    console.log(`[Dispatcher] skip_email: ${skip_email || false}, skip_whatsapp: ${skip_whatsapp || false}`);

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

    // 6. Build subject
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

    const finalSubject = buildTicketEmailSubject(context, eventLabels[event_key]);

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

    console.log(`[Dispatcher] resolved attachments count: ${attachments.length}`);
    if (attachments.length > 0) {
      console.log(`[Dispatcher] attachment files: ${attachments.map(a => `"${a.fileName}" (${a.filePath?.substring(0, 60)}...)`).join(", ")}`);
    }
    if (attachment_file_ids && attachment_file_ids.length > 0 && attachments.length === 0) {
      console.error(`[Dispatcher] WARNING: Received ${attachment_file_ids.length} file IDs but found 0 attachments in ticket_archivos! IDs: ${JSON.stringify(attachment_file_ids)}`);
    }

    // 9. Send email
    let emailResult = {
      sent: false,
      error: undefined as string | undefined,
      attachmentsSent: 0,
      failedAttachments: [] as string[],
      attachmentDetails: [] as AttachmentResult[],
    };
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
    } else if (skip_email) {
      emailResult.error = "Email skipped by request";
    }

    // 10. Send WhatsApp
    let whatsappResult = {
      messageSent: false,
      documentsSent: 0,
      error: undefined as string | undefined,
      failedDocuments: [] as string[],
      attachmentDetails: [] as AttachmentResult[],
    };
    if (!skip_whatsapp && agentPhone) {
      whatsappResult = await sendWhatsAppWithDocuments(
        supabase,
        agentPhone,
        renderedWhatsApp,
        attachments
      );
    } else if (!agentPhone) {
      whatsappResult.error = "El usuario no tiene teléfono registrado";
    } else if (skip_whatsapp) {
      whatsappResult.error = "WhatsApp skipped by request";
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
      const allAttachmentDetails = [
        ...emailResult.attachmentDetails,
        ...whatsappResult.attachmentDetails,
      ];

      if (allAttachmentDetails.length > 0) {
        const attachLogs = allAttachmentDetails.map((detail) => {
          const att = attachments.find((a) => a.fileName === detail.fileName);
          return {
            notification_history_id: historyRecord.id,
            ticket_id,
            file_name: detail.fileName,
            file_path: att?.filePath || null,
            file_url: att?.fileUrl || null,
            mime_type: att?.mimeType || null,
            file_size: att?.size || 0,
            source: att?.source || "ticket",
            channel: detail.channel,
            sent_successfully: detail.status === "sent",
            error_message: detail.reason || null,
          };
        });

        const { error: logError } = await supabase.from("notification_attachments_log").insert(attachLogs);
        if (logError) {
          console.error("[Dispatcher] Error logging attachments:", logError.message);
        }
      }
    }

    const response = {
      success: true,
      email: {
        sent: emailResult.sent,
        subject: finalSubject,
        attachmentsSent: emailResult.attachmentsSent,
        failedAttachments: emailResult.failedAttachments,
        error: emailResult.error,
      },
      whatsapp: {
        messageSent: whatsappResult.messageSent,
        documentsSent: whatsappResult.documentsSent,
        failedDocuments: whatsappResult.failedDocuments,
        error: whatsappResult.error,
      },
      attachments: {
        total: attachments.length,
        emailSent: emailResult.attachmentsSent,
        emailFailed: emailResult.failedAttachments,
        whatsappSent: whatsappResult.documentsSent,
        whatsappFailed: whatsappResult.failedDocuments,
      },
      historyId: historyRecord?.id,
    };

    console.log(`[Dispatcher] ========== RESULT ==========`);
    console.log(`[Dispatcher] email sent: ${emailResult.sent}, attachments sent: ${emailResult.attachmentsSent}, failed: ${emailResult.failedAttachments.length}`);
    console.log(`[Dispatcher] whatsapp sent: ${whatsappResult.messageSent}, documents sent: ${whatsappResult.documentsSent}, failed: ${whatsappResult.failedDocuments.length}`);
    if (emailResult.error) console.log(`[Dispatcher] email error: ${emailResult.error}`);
    if (whatsappResult.error) console.log(`[Dispatcher] whatsapp error: ${whatsappResult.error}`);
    console.log(`[Dispatcher] ========== END ==========`);

    return new Response(
      JSON.stringify(response),
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
