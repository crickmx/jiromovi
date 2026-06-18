import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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

interface CreateTramiteRequest {
  // Email source data
  emailAccount: string;
  emailFolder: string;
  emailUid: number;
  emailMessageId: string;
  emailFromName: string;
  emailFromEmail: string;
  emailSubject: string;
  emailDate: string;
  // Tramite fields
  agentId: string;
  assignmentMethod: "automatic" | "manual" | "suggested";
  tipoTramite: string;
  prioridad: string;
  instrucciones: string;
  // AI data
  aiSummary?: string;
  aiExtractedData?: Record<string, unknown>;
  userEditedSummary?: string;
  // Attachments to include
  attachments: EmailAttachment[];
}

// Minimal IMAP helpers (reused from ionos-webmail pattern)
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
      throw new Error("No tienes permiso para crear tramites");
    }

    const body = await req.json() as CreateTramiteRequest;

    if (!body.instrucciones) throw new Error("El tramite requiere instrucciones");
    if (!body.agentId) throw new Error("Se requiere un agente asignado");

    // Validate agent access
    const { data: agent } = await supabase
      .from("usuarios")
      .select("id, oficina_id, nombre_completo")
      .eq("id", body.agentId)
      .maybeSingle();

    if (!agent) throw new Error("Agente no encontrado");

    if (senderUser.rol !== "Administrador" && agent.oficina_id !== senderUser.oficina_id) {
      throw new Error("No tienes permiso para crear tramites para este agente");
    }

    // Check for duplicate
    if (body.emailMessageId) {
      const { data: existing } = await supabase
        .from("tickets")
        .select("id, folio")
        .eq("canal_origen", "email")
        .eq("source_email_message_id", body.emailMessageId)
        .eq("source_email_account", body.emailAccount)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "duplicate",
            existing_tramite: existing,
            message: "Ya existe un tramite creado desde este correo",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get estatus Iniciado
    const { data: estatusIniciado } = await supabase
      .from("ticket_estatus")
      .select("id")
      .eq("nombre", "Iniciado")
      .maybeSingle();

    if (!estatusIniciado) throw new Error("No se encontro el estatus Iniciado");

    // Generate folio
    const { data: folioData, error: folioError } = await supabase.rpc("generate_next_folio");
    if (folioError || !folioData) throw new Error("Error generando folio: " + (folioError?.message || "unknown"));

    // Create ticket
    const { data: createdTicket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        folio: folioData,
        tipo_tramite: body.tipoTramite || "cotizacion_emision",
        estatus_id: estatusIniciado.id,
        prioridad: body.prioridad || "Media",
        instrucciones: body.instrucciones,
        agente_id: body.agentId,
        agente_usuario_id: body.agentId,
        creado_por: senderUser.id,
        assigned_to_user_id: senderUser.id,
        cerrado: false,
        canal_origen: "email",
        source_email_account: body.emailAccount,
        source_email_folder: body.emailFolder,
        source_email_uid: body.emailUid,
        source_email_message_id: body.emailMessageId,
        source_email_from_name: body.emailFromName,
        source_email_from_email: body.emailFromEmail?.toLowerCase(),
        source_email_subject: body.emailSubject,
        source_email_date: body.emailDate || null,
        ai_summary: body.aiSummary || null,
        ai_extracted_data: body.aiExtractedData || null,
        user_edited_summary: body.userEditedSummary || null,
        assignment_method: body.assignmentMethod || "manual",
        metadata: {
          source: "email",
          email_account: body.emailAccount,
          created_from_email: true,
        },
      })
      .select("id, folio")
      .single();

    if (ticketError || !createdTicket) {
      throw new Error(`Error al crear tramite: ${ticketError?.message || "unknown"}`);
    }

    // Download and store selected attachments
    const attachmentsToInclude = body.attachments.filter(a => a.include);
    const uploadedAttachments: { nombre: string; success: boolean; error?: string }[] = [];

    if (attachmentsToInclude.length > 0) {
      // Get email credentials to download attachments
      const { data: emailConfig } = await supabase
        .from("email_configuraciones")
        .select("email, password, imap_host, imap_port")
        .eq("usuario_id", user.id)
        .eq("activo", true)
        .maybeSingle();

      if (emailConfig) {
        const host = emailConfig.imap_host || "imap.ionos.mx";
        const port = emailConfig.imap_port || 993;

        let conn: Deno.TlsConn | null = null;
        try {
          conn = await imapConnect(host, port);
          const loginOk = await imapLogin(conn, emailConfig.email, emailConfig.password);
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

              // Decode base64 to binary
              const binaryStr = atob(base64Content);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

              // Upload to storage
              const ext = att.filename.split(".").pop() || "bin";
              const storagePath = `${createdTicket.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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

              // Insert ticket_archivos record
              await supabase.from("ticket_archivos").insert({
                ticket_id: createdTicket.id,
                usuario_id: senderUser.id,
                nombre: att.filename,
                url: urlData.publicUrl || storagePath,
                tipo: att.contentType || "application/octet-stream",
                tamano: att.size || bytes.length,
                metadata: {
                  source: "email_attachment",
                  email_uid: body.emailUid,
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
        ticket_id: createdTicket.id,
        folio: createdTicket.folio,
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
