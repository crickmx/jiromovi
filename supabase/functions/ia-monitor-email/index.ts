import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({})) as {
      cuenta_id?: string;
      folder?: string;
      limit?: number;
    };

    const folder = body.folder || "INBOX";
    const limit = Math.min(body.limit || 20, 50);

    // Get active accounts to monitor
    let query = supabase
      .from("ia_cuentas_correo")
      .select("*")
      .eq("estado", "activo");

    if (body.cuenta_id) {
      query = query.eq("id", body.cuenta_id);
    }

    const { data: cuentas, error: cuentasErr } = await query;
    if (cuentasErr) {
      return new Response(JSON.stringify({ error: "Error al obtener cuentas.", detail: cuentasErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cuentas || cuentas.length === 0) {
      return new Response(JSON.stringify({ message: "No hay cuentas activas para monitorear.", processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { email: string; new_messages: number; error?: string }[] = [];

    for (const cuenta of cuentas) {
      try {
        const newMessages = await fetchNewEmails(supabase, cuenta, folder, limit);
        results.push({ email: cuenta.email, new_messages: newMessages });

        // Update last check timestamp
        await supabase
          .from("ia_cuentas_correo")
          .update({ ultima_sincronizacion: new Date().toISOString() })
          .eq("id", cuenta.id);
      } catch (err: any) {
        console.error(`Error monitoring ${cuenta.email}:`, err.message);
        results.push({ email: cuenta.email, new_messages: 0, error: err.message });

        await supabase
          .from("ia_cuentas_correo")
          .update({ estado: "error", ultima_sincronizacion: new Date().toISOString(), ultimo_error: err.message })
          .eq("id", cuenta.id);
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.new_messages, 0);

    return new Response(JSON.stringify({
      success: true,
      accounts_checked: results.length,
      total_new_messages: totalNew,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("ia-monitor-email error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchNewEmails(
  supabase: any,
  cuenta: any,
  folder: string,
  limit: number,
): Promise<number> {
  const host = cuenta.imap_host || "imap.ionos.mx";
  const port = cuenta.imap_port || 993;
  const email = cuenta.email;
  const password = cuenta.password_encrypted;

  const conn = await Deno.connectTls({ hostname: host, port });
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  try {
    // Read greeting
    const greeting = await readResponse(conn, decoder);
    if (!greeting.includes("OK")) {
      throw new Error(`Servidor IMAP no disponible: ${greeting.trim()}`);
    }

    // Login
    await sendCommand(conn, encoder, `A1 LOGIN "${email}" "${password.replace(/"/g, '\\"')}"`);
    const loginResp = await readResponse(conn, decoder);
    if (!loginResp.includes("A1 OK")) {
      throw new Error("Autenticación fallida");
    }

    // Select folder
    await sendCommand(conn, encoder, `A2 SELECT "${folder}"`);
    const selectResp = await readResponseFull(conn, decoder, "A2");
    if (!selectResp.includes("A2 OK")) {
      throw new Error(`No se pudo abrir carpeta ${folder}`);
    }

    // Get message count from EXISTS
    const existsMatch = selectResp.match(/\* (\d+) EXISTS/);
    const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;

    if (totalMessages === 0) {
      await logout(conn, encoder);
      return 0;
    }

    // Fetch recent unseen messages
    await sendCommand(conn, encoder, `A3 SEARCH UNSEEN`);
    const searchResp = await readResponseFull(conn, decoder, "A3");

    const searchLine = searchResp.split("\r\n").find(l => l.startsWith("* SEARCH"));
    if (!searchLine || searchLine.trim() === "* SEARCH") {
      await logout(conn, encoder);
      return 0;
    }

    const messageNums = searchLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean);
    const toFetch = messageNums.slice(-limit);

    if (toFetch.length === 0) {
      await logout(conn, encoder);
      return 0;
    }

    // Fetch headers and body preview for each message
    let newCount = 0;
    const fetchRange = toFetch.join(",");
    await sendCommand(conn, encoder, `A4 FETCH ${fetchRange} (UID FLAGS ENVELOPE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT]<0.2000>)`);
    const fetchResp = await readResponseFull(conn, decoder, "A4", 15000);

    // Parse fetched messages
    const messages = parseImapFetchResponse(fetchResp);

    for (const msg of messages) {
      if (!msg.messageId) continue;

      // Check if message already exists in bandeja
      const { data: existing } = await supabase
        .from("ia_bandeja")
        .select("id")
        .eq("cuenta_correo_id", cuenta.id)
        .eq("message_id", msg.messageId)
        .maybeSingle();

      if (existing) continue;

      // Insert into ia_bandeja
      const { error: insertErr } = await supabase
        .from("ia_bandeja")
        .insert({
          cuenta_correo_id: cuenta.id,
          message_id: msg.messageId,
          remitente: msg.from || "",
          destinatario: msg.to || email,
          asunto: msg.subject || "(Sin asunto)",
          cuerpo_texto: msg.bodyPreview || "",
          fecha_correo: msg.date || new Date().toISOString(),
          estado_procesamiento: "pendiente",
          carpeta_destino: folder,
        });

      if (!insertErr) newCount++;
    }

    await logout(conn, encoder);
    return newCount;

  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

async function sendCommand(conn: Deno.TlsConn, encoder: TextEncoder, cmd: string) {
  await conn.write(encoder.encode(cmd + "\r\n"));
}

async function readResponse(conn: Deno.TlsConn, decoder: TextDecoder): Promise<string> {
  const buf = new Uint8Array(8192);
  const n = await conn.read(buf);
  if (!n) return "";
  return decoder.decode(buf.subarray(0, n));
}

async function readResponseFull(conn: Deno.TlsConn, decoder: TextDecoder, tag: string, timeoutMs = 10000): Promise<string> {
  let result = "";
  const buf = new Uint8Array(16384);
  const deadline = Date.now() + timeoutMs;

  while (!result.includes(`${tag} OK`) && !result.includes(`${tag} NO`) && !result.includes(`${tag} BAD`)) {
    if (Date.now() > deadline) break;
    try {
      const n = await conn.read(buf);
      if (!n) break;
      result += decoder.decode(buf.subarray(0, n));
    } catch {
      break;
    }
  }
  return result;
}

async function logout(conn: Deno.TlsConn, encoder: TextEncoder) {
  try {
    await sendCommand(conn, encoder, "A9 LOGOUT");
  } catch { /* ignore */ }
}

interface ParsedMessage {
  uid?: string;
  messageId?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  bodyPreview?: string;
}

function parseImapFetchResponse(raw: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  // Split by FETCH boundaries
  const fetchBlocks = raw.split(/\* \d+ FETCH/);

  for (const block of fetchBlocks) {
    if (!block.trim()) continue;

    const msg: ParsedMessage = {};

    // Extract UID
    const uidMatch = block.match(/UID (\d+)/);
    if (uidMatch) msg.uid = uidMatch[1];

    // Extract headers
    const headerSection = block.match(/HEADER\.FIELDS.*?\}\r\n([\s\S]*?)(?:\r\n\r\n|\)\r\n)/);
    if (headerSection) {
      const headers = headerSection[1];
      const fromMatch = headers.match(/^From:\s*(.+)$/mi);
      if (fromMatch) msg.from = decodeImapHeader(fromMatch[1].trim());

      const toMatch = headers.match(/^To:\s*(.+)$/mi);
      if (toMatch) msg.to = decodeImapHeader(toMatch[1].trim());

      const subjectMatch = headers.match(/^Subject:\s*(.+)$/mi);
      if (subjectMatch) msg.subject = decodeImapHeader(subjectMatch[1].trim());

      const dateMatch = headers.match(/^Date:\s*(.+)$/mi);
      if (dateMatch) {
        try {
          msg.date = new Date(dateMatch[1].trim()).toISOString();
        } catch {
          msg.date = new Date().toISOString();
        }
      }

      const msgIdMatch = headers.match(/^Message-ID:\s*(.+)$/mi);
      if (msgIdMatch) msg.messageId = msgIdMatch[1].trim().replace(/[<>]/g, "");
    }

    // Generate a fallback message-id from UID if not found in headers
    if (!msg.messageId && msg.uid) {
      msg.messageId = `uid-${msg.uid}-${Date.now()}`;
    }

    // Extract body preview
    const bodyMatch = block.match(/BODY\[TEXT\].*?\}\r\n([\s\S]*?)(?:\)\r\n|$)/);
    if (bodyMatch) {
      msg.bodyPreview = bodyMatch[1].substring(0, 500).replace(/\r\n/g, "\n").trim();
    }

    if (msg.messageId) messages.push(msg);
  }

  return messages;
}

function decodeImapHeader(value: string): string {
  // Decode RFC 2047 encoded words (=?charset?encoding?text?=)
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_match, _charset, encoding, text) => {
    if (encoding.toUpperCase() === "B") {
      try { return atob(text); } catch { return text; }
    }
    if (encoding.toUpperCase() === "Q") {
      return text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    }
    return text;
  });
}
