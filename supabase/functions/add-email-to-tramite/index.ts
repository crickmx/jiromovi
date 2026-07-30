import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getMailboxPassword } from "../_shared/emailCredentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  partId: string;
  include: boolean;
}

interface AddEmailToTramiteRequest {
  ticketId: string;
  // Email source data
  emailAccount: string;
  emailFolder: string;
  emailUid: number;
  emailMessageId: string;
  emailFromName: string;
  emailFromEmail: string;
  emailSubject: string;
  emailDate: string;
  emailBodyText?: string | null;
  // Attachments to include
  attachments: EmailAttachment[];
}

// Minimal IMAP helpers (reused from create-tramite-from-email pattern)
let tagCounter = 0;

async function imapRead(conn: Deno.TlsConn): Promise<string> {
  const buf = new Uint8Array(32768);
  let result = "";
  const timeout = 8000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      conn.setKeepAlive(true);
      const n = await conn.read(buf);
      if (n === null) break;
      result += new TextDecoder().decode(buf.subarray(0, n));
      if (result.includes("\r\n") && (result.match(/^[A-Z]\d+ (OK|NO|BAD)/m) || result.startsWith("* "))) {
        await new Promise(r => setTimeout(r, 50));
        try {
          const n2 = await Promise.race([
            conn.read(buf),
            new Promise<null>(r => setTimeout(() => r(null), 100)),
          ]);
          if (n2 && typeof n2 === "number") result += new TextDecoder().decode(buf.subarray(0, n2));
        } catch { /* ok */ }
        break;
      }
    } catch { break; }
  }
  return result;
}

async function imapCommand(conn: Deno.TlsConn, cmd: string): Promise<string> {
  const tag = `A${++tagCounter}`;
  const full = `${tag} ${cmd}\r\n`;
  await conn.write(new TextEncoder().encode(full));
  let response = "";
  const timeout = 15000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const buf = new Uint8Array(65536);
    const n = await Promise.race([
      conn.read(buf),
      new Promise<null>(r => setTimeout(() => r(null), timeout)),
    ]);
    if (n === null || typeof n !== "number") break;
    response += new TextDecoder().decode(buf.subarray(0, n));
    if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) break;
  }
  return response;
}

async function imapLogin(conn: Deno.TlsConn, user: string, pass: string): Promise<boolean> {
  const resp = await imapCommand(conn, `LOGIN "${user}" "${pass.replace(/"/g, '\\"')}"`);
  return resp.includes("OK");
}

async function imapLogout(conn: Deno.TlsConn) {
  try { await imapCommand(conn, "LOGOUT"); } catch { /* ok */ }
  try { conn.close(); } catch { /* ok */ }
}

async function imapConnect(host: string, port: number): Promise<Deno.TlsConn> {
  const rawConn = await Deno.connect({ hostname: host, port, transport: "tcp" });
  const conn = await Deno.startTls(rawConn, { hostname: host });
  await imapRead(conn);
  return conn;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: senderUser } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id, nombre_completo")
      .eq("id", user.id)
      .maybeSingle();

    if (!senderUser || !["Administrador", "Gerente", "Empleado", "Ejecutivo"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para modificar tramites");
    }

    const body = await req.json() as AddEmailToTramiteRequest;

    if (!body.ticketId) throw new Error("Falta el trámite destino");

    // Validate ticket exists + access (same criteria as add-contact-messages-to-task)
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, folio, creado_por, agente_usuario_id, assigned_to_user_id")
      .eq("id", body.ticketId)
      .maybeSingle();

    if (!ticket) throw new Error("Trámite no encontrado");

    if (senderUser.rol !== "Administrador") {
      const isCreator = ticket.creado_por === senderUser.id;
      const isAssigned = ticket.assigned_to_user_id === senderUser.id;
      if (!isCreator && !isAssigned) {
        const { data: agentData } = await supabase
          .from("usuarios")
          .select("oficina_id")
          .eq("id", ticket.agente_usuario_id)
          .maybeSingle();

        if (!agentData || agentData.oficina_id !== senderUser.oficina_id) {
          throw new Error("No tienes permiso para modificar este trámite");
        }
      }
    }

    // ── 1) Insert the email content as a comment ──────────────────────────────
    const parts: string[] = ["📧 Correo agregado al trámite"];
    if (body.emailFromName || body.emailFromEmail) {
      const fromLine = body.emailFromName
        ? `${body.emailFromName}${body.emailFromEmail ? ` <${body.emailFromEmail}>` : ""}`
        : body.emailFromEmail;
      parts.push(`De: ${fromLine}`);
    }
    if (body.emailSubject) parts.push(`Asunto: ${body.emailSubject}`);
    if (body.emailDate) {
      let fecha = body.emailDate;
      try {
        fecha = new Date(body.emailDate).toLocaleString("es-MX", {
          day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      } catch { /* keep raw */ }
      parts.push(`Fecha: ${fecha}`);
    }
    const bodyText = (body.emailBodyText || "").trim();
    if (bodyText) {
      parts.push("");
      parts.push(bodyText.slice(0, 4000));
    }
    const commentText = parts.join("\n");

    const { error: commentError } = await supabase.from("ticket_comentarios").insert({
      ticket_id: body.ticketId,
      usuario_id: senderUser.id,
      mensaje: commentText,
    });
    if (commentError) throw new Error(`Error al agregar comentario: ${commentError.message}`);

    // ── 2) Download and store selected attachments ────────────────────────────
    const attachmentsToInclude = (body.attachments || []).filter(a => a.include);
    const uploadedAttachments: { nombre: string; success: boolean; error?: string }[] = [];

    if (attachmentsToInclude.length > 0) {
      const { data: emailConfig } = await supabase
        .from("email_configuraciones")
        .select("email, servidor_entrada, puerto_entrada")
        .eq("usuario_id", user.id)
        .eq("activa", true)
        .maybeSingle();

      if (emailConfig) {
        const host = emailConfig.servidor_entrada || "imap.ionos.mx";
        const port = emailConfig.puerto_entrada || 993;
        const mailboxPassword = await getMailboxPassword(supabase, user.id);

        let conn: Deno.TlsConn | null = null;
        try {
          if (!mailboxPassword) throw new Error("No hay credencial de correo almacenada");
          conn = await imapConnect(host, port);
          const loginOk = await imapLogin(conn, emailConfig.email, mailboxPassword);
          if (!loginOk) throw new Error("No se pudo autenticar con el servidor de correo");

          await imapCommand(conn, `SELECT "${body.emailFolder}"`);

          for (const att of attachmentsToInclude) {
            try {
              const resp = await imapCommand(conn, `UID FETCH ${body.emailUid} (BODY.PEEK[${att.partId}])`);
              const dataMatch = resp.match(/\{(\d+)\}\r\n([\s\S]*)/);
              if (!dataMatch) {
                uploadedAttachments.push({ nombre: att.filename, success: false, error: "No se pudo descargar" });
                continue;
              }

              const rawData = dataMatch[2].substring(0, parseInt(dataMatch[1]));
              const base64Content = rawData.replace(/\s/g, "");

              const binaryStr = atob(base64Content);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

              const ext = att.filename.split(".").pop() || "bin";
              const storagePath = `${body.ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

              const { error: uploadError } = await supabase.storage
                .from("ticket-archivos")
                .upload(storagePath, bytes, {
                  contentType: att.contentType || "application/octet-stream",
                  upsert: false,
                });

              if (uploadError) {
                uploadedAttachments.push({ nombre: att.filename, success: false, error: uploadError.message });
                continue;
              }

              const { data: urlData } = supabase.storage.from("ticket-archivos").getPublicUrl(storagePath);

              await supabase.from("ticket_archivos").insert({
                ticket_id: body.ticketId,
                usuario_id: senderUser.id,
                nombre: att.filename,
                url: urlData.publicUrl || storagePath,
                tipo: att.contentType || "application/octet-stream",
                tamano: att.size || bytes.length,
                metadata: {
                  source: "email_attachment",
                  email_uid: body.emailUid,
                  email_message_id: body.emailMessageId,
                  part_id: att.partId,
                  original_content_type: att.contentType,
                },
              });

              uploadedAttachments.push({ nombre: att.filename, success: true });
            } catch (attErr: unknown) {
              const msg = attErr instanceof Error ? attErr.message : "Error desconocido";
              uploadedAttachments.push({ nombre: att.filename, success: false, error: msg });
            }
          }

          await imapLogout(conn);
        } catch (connErr: unknown) {
          if (conn) try { conn.close(); } catch { /* ok */ }
          const msg = connErr instanceof Error ? connErr.message : "Error de conexion";
          for (const att of attachmentsToInclude) {
            if (!uploadedAttachments.find(u => u.nombre === att.filename)) {
              uploadedAttachments.push({ nombre: att.filename, success: false, error: msg });
            }
          }
        }
      } else {
        for (const att of attachmentsToInclude) {
          uploadedAttachments.push({ nombre: att.filename, success: false, error: "Sin configuracion de correo" });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket.id,
        folio: ticket.folio,
        comment_added: true,
        attachments_result: uploadedAttachments,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
