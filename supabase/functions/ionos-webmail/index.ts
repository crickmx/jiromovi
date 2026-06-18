import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ─────────────────────────────────────────────────────────

interface ImapFolder {
  name: string;
  path: string;
  flags: string[];
  total: number;
  unseen: number;
}

interface EmailHeader {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  size: number;
}

interface EmailFull {
  uid: number;
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  bodyHtml: string | null;
  bodyText: string | null;
  attachments: { filename: string; contentType: string; size: number; partId: string }[];
}

// ── IMAP Low-level helpers ────────────────────────────────────────

async function imapConnect(host: string, port: number): Promise<Deno.TlsConn> {
  const rawConn = await Deno.connect({ hostname: host, port, transport: 'tcp' });
  const conn = await Deno.startTls(rawConn, { hostname: host });
  await imapRead(conn);
  return conn;
}

let tagCounter = 0;

async function imapCommand(conn: Deno.TlsConn, cmd: string): Promise<string> {
  const tag = `A${++tagCounter}`;
  const fullCmd = `${tag} ${cmd}\r\n`;
  await conn.write(new TextEncoder().encode(fullCmd));
  return imapReadUntilTag(conn, tag);
}

async function imapRead(conn: Deno.TlsConn): Promise<string> {
  const buf = new Uint8Array(65536);
  const n = await conn.read(buf);
  if (n === null) return '';
  return new TextDecoder().decode(buf.subarray(0, n));
}

async function imapReadUntilTag(conn: Deno.TlsConn, tag: string): Promise<string> {
  let result = '';
  const decoder = new TextDecoder();
  let attempts = 0;
  while (!result.includes(`${tag} OK`) && !result.includes(`${tag} NO`) && !result.includes(`${tag} BAD`)) {
    if (attempts++ > 200) break;
    const buf = new Uint8Array(262144);
    const n = await conn.read(buf);
    if (n === null) break;
    result += decoder.decode(buf.subarray(0, n));
  }
  return result;
}

async function imapLogin(conn: Deno.TlsConn, email: string, password: string): Promise<boolean> {
  const escaped = password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const resp = await imapCommand(conn, `LOGIN "${email}" "${escaped}"`);
  return resp.includes('OK');
}

async function imapLogout(conn: Deno.TlsConn): Promise<void> {
  try { await imapCommand(conn, 'LOGOUT'); } catch { /* ignore */ }
  try { conn.close(); } catch { /* ignore */ }
}

// ── Decode utilities ──────────────────────────────────────────────

function decodeBase64Str(str: string, charset = 'utf-8'): string {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder(charset).decode(bytes);
  } catch { return str; }
}

function decodeQP(str: string): string {
  return str.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeQPBytes(str: string, charset: string): string {
  const cleaned = str.replace(/_/g, ' ');
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length) {
      const hex = cleaned.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(cleaned.charCodeAt(i));
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return cleaned.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
}

function decodeHeaderWord(str: string): string {
  if (!str) return '';
  // Handle consecutive encoded words separated by whitespace
  const combined = str.replace(/\?=\s+=\?/g, '?==?');
  return combined.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_m, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') return decodeBase64Str(text, charset.toLowerCase());
      return decodeQPBytes(text, charset.toLowerCase());
    } catch { return _m; }
  });
}

function extractEmail(str: string): string {
  const m = str.match(/<([^>]+)>/);
  if (m) return m[1];
  const em = str.match(/([^\s<,]+@[^\s>,]+)/);
  return em ? em[1] : str.trim();
}

function extractName(str: string): string {
  const m = str.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : '';
}

function extractHeaderValue(block: string, name: string): string | null {
  const re = new RegExp(`^${name}:\\s*(.+?)$`, 'mi');
  const m = block.match(re);
  if (!m) return null;
  let val = m[1];
  const startIdx = block.indexOf(m[0]) + m[0].length;
  const rest = block.substring(startIdx);
  const cont = rest.match(/^(\r?\n[ \t]+.+)+/);
  if (cont) val += cont[0].replace(/\r?\n[ \t]+/g, ' ');
  return val.trim();
}

function splitHeadersBody(raw: string): { headers: string; body: string } {
  let idx = raw.indexOf('\r\n\r\n');
  if (idx === -1) {
    idx = raw.indexOf('\n\n');
    if (idx === -1) return { headers: raw, body: '' };
    return { headers: raw.substring(0, idx), body: raw.substring(idx + 2) };
  }
  return { headers: raw.substring(0, idx), body: raw.substring(idx + 4) };
}

// ── IMAP operations ───────────────────────────────────────────────

async function listFolders(conn: Deno.TlsConn): Promise<ImapFolder[]> {
  const resp = await imapCommand(conn, 'LIST "" "*"');
  const folders: ImapFolder[] = [];
  const lines = resp.split('\r\n');
  for (const line of lines) {
    const m = line.match(/^\* LIST \(([^)]*)\) "(.)" "?([^"\r\n]+)"?$/);
    if (m) {
      const flags = m[1].split(' ').filter(Boolean);
      const name = m[3];
      folders.push({ name, path: name, flags, total: 0, unseen: 0 });
    }
  }
  // Get counts
  for (const f of folders) {
    try {
      const st = await imapCommand(conn, `STATUS "${f.path}" (MESSAGES UNSEEN)`);
      const msgM = st.match(/MESSAGES (\d+)/);
      const unM = st.match(/UNSEEN (\d+)/);
      f.total = msgM ? parseInt(msgM[1]) : 0;
      f.unseen = unM ? parseInt(unM[1]) : 0;
    } catch { /* skip */ }
  }
  return folders;
}

async function listMessages(conn: Deno.TlsConn, folder: string, page: number, perPage: number): Promise<{ messages: EmailHeader[]; total: number }> {
  const selResp = await imapCommand(conn, `SELECT "${folder}"`);
  const existsM = selResp.match(/\* (\d+) EXISTS/);
  const total = existsM ? parseInt(existsM[1]) : 0;
  if (total === 0) return { messages: [], total: 0 };

  // Calculate range: newest first
  const end = total - ((page - 1) * perPage);
  const start = Math.max(1, end - perPage + 1);
  if (end < 1) return { messages: [], total };

  const resp = await imapCommand(conn, `FETCH ${start}:${end} (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID CONTENT-TYPE)])`);

  const messages = parseHeaderResponses(resp);
  return { messages: messages.reverse(), total };
}

function parseHeaderResponses(resp: string): EmailHeader[] {
  const messages: EmailHeader[] = [];
  // Split by fetch responses
  const parts = resp.split(/\* \d+ FETCH /);
  for (const part of parts) {
    if (!part.trim()) continue;
    try {
      const uidM = part.match(/UID (\d+)/);
      if (!uidM) continue;
      const uid = parseInt(uidM[1]);

      const flagsM = part.match(/FLAGS \(([^)]*)\)/);
      const flags = flagsM ? flagsM[1].split(' ').filter(Boolean) : [];

      const sizeM = part.match(/RFC822\.SIZE (\d+)/);
      const size = sizeM ? parseInt(sizeM[1]) : 0;

      // Extract header block
      const headerBlockM = part.match(/HEADER\.FIELDS[^}]*\}\r\n([\s\S]*?)(?:\r\n\))/);
      const headerBlock = headerBlockM ? headerBlockM[1] : '';

      const rawFrom = decodeHeaderWord(extractHeaderValue(headerBlock, 'From') || '');
      const fromEmail = extractEmail(rawFrom);
      const fromName = extractName(rawFrom) || fromEmail;
      const to = (extractHeaderValue(headerBlock, 'To') || '').split(',').map(s => decodeHeaderWord(s.trim())).filter(Boolean);
      const cc = (extractHeaderValue(headerBlock, 'Cc') || '').split(',').map(s => decodeHeaderWord(s.trim())).filter(Boolean);
      const subject = decodeHeaderWord(extractHeaderValue(headerBlock, 'Subject') || '');
      const date = extractHeaderValue(headerBlock, 'Date') || '';
      const messageId = extractHeaderValue(headerBlock, 'Message-ID') || '';
      const contentType = extractHeaderValue(headerBlock, 'Content-Type') || '';

      const hasAttachments = /mixed/i.test(contentType) || /attachment/i.test(part);

      messages.push({ uid, messageId, from: fromName, fromEmail, to, cc, subject, date, seen: flags.includes('\\Seen'), flagged: flags.includes('\\Flagged'), hasAttachments, size });
    } catch { /* skip malformed */ }
  }
  return messages;
}

async function getMessage(conn: Deno.TlsConn, uid: number, folder: string): Promise<EmailFull | null> {
  await imapCommand(conn, `SELECT "${folder}"`);
  const resp = await imapCommand(conn, `UID FETCH ${uid} (FLAGS BODY[])`);

  const flagsM = resp.match(/FLAGS \(([^)]*)\)/);
  const flags = flagsM ? flagsM[1].split(' ').filter(Boolean) : [];

  // Extract body
  const bodyM = resp.match(/BODY\[\] \{(\d+)\}\r\n/);
  if (!bodyM) return null;
  const bodyLen = parseInt(bodyM[1]);
  const bodyStart = resp.indexOf(bodyM[0]) + bodyM[0].length;
  const rawEmail = resp.substring(bodyStart, bodyStart + bodyLen);

  const { headers, body } = splitHeadersBody(rawEmail);

  const rawFrom = decodeHeaderWord(extractHeaderValue(headers, 'From') || '');
  const fromEmail = extractEmail(rawFrom);
  const fromName = extractName(rawFrom) || fromEmail;
  const to = (extractHeaderValue(headers, 'To') || '').split(',').map(s => decodeHeaderWord(s.trim())).filter(Boolean);
  const cc = (extractHeaderValue(headers, 'Cc') || '').split(',').map(s => decodeHeaderWord(s.trim())).filter(Boolean);
  const bcc = (extractHeaderValue(headers, 'Bcc') || '').split(',').map(s => decodeHeaderWord(s.trim())).filter(Boolean);
  const subject = decodeHeaderWord(extractHeaderValue(headers, 'Subject') || '');
  const date = extractHeaderValue(headers, 'Date') || '';
  const messageId = extractHeaderValue(headers, 'Message-ID') || '';
  const contentType = extractHeaderValue(headers, 'Content-Type') || 'text/plain';

  let bodyHtml: string | null = null;
  let bodyText: string | null = null;
  const attachments: { filename: string; contentType: string; size: number; partId: string }[] = [];

  function extractContent(ct: string, partBody: string, partHeaders: string, disp: string, partId: string, depth: number): void {
    if (depth > 5) return;
    const ctLower = ct.toLowerCase();

    if (ctLower.includes('multipart')) {
      const nb = ct.match(/boundary="?([^";\s]+)"?/i)?.[1];
      if (nb) {
        parseParts(partBody, nb, (nct, nd, nh, nb2, npid) => {
          extractContent(nct, nb2, nh, nd, `${partId}.${npid}`, depth + 1);
        });
      }
    } else if (ctLower.includes('text/html') && !bodyHtml && !disp.includes('attachment')) {
      bodyHtml = decodePartContent(partBody, partHeaders);
    } else if (ctLower.includes('text/plain') && !bodyText && !disp.includes('attachment')) {
      bodyText = decodePartContent(partBody, partHeaders);
    } else if (disp.includes('attachment') || (disp.includes('inline') && extractFilenameFromHeaders(partHeaders))) {
      const fn = extractFilenameFromHeaders(partHeaders) || `adjunto_${partId}`;
      attachments.push({ filename: fn, contentType: ctLower.split(';')[0], size: partBody.length, partId });
    } else if (!ctLower.includes('text/') && !ctLower.includes('multipart')) {
      const fn = extractFilenameFromHeaders(partHeaders) || `adjunto_${partId}`;
      attachments.push({ filename: fn, contentType: ctLower.split(';')[0], size: partBody.length, partId });
    }
  }

  if (contentType.toLowerCase().includes('multipart')) {
    const boundary = contentType.match(/boundary="?([^";\s]+)"?/i)?.[1];
    if (boundary) {
      parseParts(body, boundary, (ct, disp, partHeaders, partBody, partId) => {
        extractContent(ct, partBody, partHeaders, disp, partId, 0);
      });
    }
  } else if (contentType.includes('text/html')) {
    bodyHtml = decodeBodyContent(body, headers);
  } else {
    bodyText = decodeBodyContent(body, headers);
  }

  return { uid, messageId, from: fromName, fromEmail, to, cc, bcc, subject, date, seen: flags.includes('\\Seen'), flagged: flags.includes('\\Flagged'), bodyHtml, bodyText, attachments };
}

function parseParts(body: string, boundary: string, handler: (ct: string, disp: string, headers: string, body: string, partId: string) => void): void {
  const sep = `--${boundary}`;
  const segments = body.split(sep);
  let idx = 1;
  for (const seg of segments) {
    if (seg.trim() === '--' || seg.trim() === '') continue;
    const cleaned = seg.replace(/^\r\n/, '');
    const { headers: h, body: b } = splitHeadersBody(cleaned);
    if (!h.trim() && !b.trim()) continue;
    const ct = (extractHeaderValue(h, 'Content-Type') || 'text/plain').toLowerCase();
    const disp = (extractHeaderValue(h, 'Content-Disposition') || '').toLowerCase();
    handler(ct, disp, h, b, String(idx++));
  }
}

function decodePartContent(body: string, headersBlock: string): string {
  const enc = (extractHeaderValue(headersBlock, 'Content-Transfer-Encoding') || '7bit').toLowerCase();
  const ctHeader = extractHeaderValue(headersBlock, 'Content-Type') || '';
  const charset = ctHeader.match(/charset="?([^";\s]+)"?/i)?.[1] || 'utf-8';
  if (enc === 'base64') return decodeBase64Str(body.replace(/\s/g, ''), charset);
  if (enc === 'quoted-printable') {
    // Decode QP bytes respecting charset
    const cleaned = body.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '=' && i + 2 < cleaned.length) {
        const hex = cleaned.substring(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(cleaned.charCodeAt(i));
    }
    try {
      return new TextDecoder(charset).decode(new Uint8Array(bytes));
    } catch {
      return decodeQP(body);
    }
  }
  return body;
}

function decodeBodyContent(body: string, headers: string): string {
  const enc = (extractHeaderValue(headers, 'Content-Transfer-Encoding') || '7bit').toLowerCase();
  if (enc === 'base64') return decodeBase64Str(body.replace(/\s/g, ''));
  if (enc === 'quoted-printable') return decodeQP(body);
  return body;
}

function extractFilenameFromHeaders(headersBlock: string): string | null {
  const disp = extractHeaderValue(headersBlock, 'Content-Disposition') || '';
  const ct = extractHeaderValue(headersBlock, 'Content-Type') || '';
  const m = disp.match(/filename="?([^";\r\n]+)"?/i) || ct.match(/name="?([^";\r\n]+)"?/i);
  return m ? decodeHeaderWord(m[1]) : null;
}

// ── SMTP ──────────────────────────────────────────────────────────

interface SmtpAttachment {
  filename: string;
  contentType: string;
  content: string; // base64 encoded
}

async function smtpSend(email: string, password: string, fromName: string, to: string[], cc: string[], bcc: string[], subject: string, bodyHtml: string, bodyText: string, attachments: SmtpAttachment[] = [], inReplyTo?: string, references?: string): Promise<void> {
  const rawConn = await Deno.connect({ hostname: 'smtp.ionos.mx', port: 465, transport: 'tcp' });
  const conn = await Deno.startTls(rawConn, { hostname: 'smtp.ionos.mx' });

  const read = async (): Promise<string> => {
    const buf = new Uint8Array(8192);
    let result = '';
    let attempts = 0;
    while (attempts++ < 10) {
      const n = await conn.read(buf);
      if (n === null) break;
      result += new TextDecoder().decode(buf.subarray(0, n));
      if (/^\d{3} /m.test(result)) break;
    }
    return result;
  };

  const send = async (cmd: string, expect: string) => {
    await conn.write(new TextEncoder().encode(cmd + '\r\n'));
    const r = await read();
    if (!r.startsWith(expect)) throw new Error(`SMTP: esperado ${expect}, recibido: ${r.substring(0, 100)}`);
    return r;
  };

  const sendRaw = async (data: string, expect: string) => {
    await conn.write(new TextEncoder().encode(data));
    const r = await read();
    if (!r.startsWith(expect)) throw new Error(`SMTP: esperado ${expect}, recibido: ${r.substring(0, 100)}`);
  };

  try {
    await read(); // Greeting
    await send('EHLO movi-digital', '250');
    await send('AUTH LOGIN', '334');
    await send(btoa(email), '334');
    await send(btoa(password), '235');
    await send(`MAIL FROM:<${email}>`, '250');

    for (const rcpt of [...to, ...cc, ...bcc]) {
      const addr = extractEmail(rcpt);
      await send(`RCPT TO:<${addr}>`, '250');
    }

    await send('DATA', '354');

    const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@ionos.mx>`;
    const hasAttachments = attachments.length > 0;
    const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let msg = `From: "${fromName}" <${email}>\r\n`;
    msg += `To: ${to.join(', ')}\r\n`;
    if (cc.length > 0) msg += `Cc: ${cc.join(', ')}\r\n`;
    msg += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
    msg += `Date: ${new Date().toUTCString()}\r\n`;
    msg += `Message-ID: ${msgId}\r\n`;
    if (inReplyTo) msg += `In-Reply-To: ${inReplyTo}\r\n`;
    if (references) msg += `References: ${references}\r\n`;
    msg += `MIME-Version: 1.0\r\n`;

    if (hasAttachments) {
      msg += `Content-Type: multipart/mixed; boundary="${mixedBoundary}"\r\n\r\n`;
      msg += `--${mixedBoundary}\r\n`;
      msg += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    } else {
      msg += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    }

    // Text part
    msg += `--${altBoundary}\r\n`;
    msg += `Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
    msg += btoa(unescape(encodeURIComponent(bodyText || subject))) + '\r\n';

    // HTML part
    msg += `--${altBoundary}\r\n`;
    msg += `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
    msg += btoa(unescape(encodeURIComponent(bodyHtml))) + '\r\n';
    msg += `--${altBoundary}--\r\n`;

    // Attachments
    if (hasAttachments) {
      for (const att of attachments) {
        const encodedName = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(att.filename)))}?=`;
        msg += `--${mixedBoundary}\r\n`;
        msg += `Content-Type: ${att.contentType}; name="${encodedName}"\r\n`;
        msg += `Content-Disposition: attachment; filename="${encodedName}"\r\n`;
        msg += `Content-Transfer-Encoding: base64\r\n\r\n`;
        // Split base64 into 76-char lines
        const b64 = att.content;
        for (let i = 0; i < b64.length; i += 76) {
          msg += b64.substring(i, i + 76) + '\r\n';
        }
      }
      msg += `--${mixedBoundary}--\r\n`;
    }

    msg += '.\r\n';

    await sendRaw(msg, '250');
    await send('QUIT', '221');
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

// ── Build RFC822 for IMAP APPEND ─────────────────────────────────

function buildRfc822Message(fromEmail: string, fromName: string, to: string[], cc: string[], subject: string, bodyHtml: string, bodyText: string, inReplyTo?: string, references?: string): string {
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let msg = `From: "${fromName}" <${fromEmail}>\r\n`;
  msg += `To: ${to.join(', ')}\r\n`;
  if (cc.length > 0) msg += `Cc: ${cc.join(', ')}\r\n`;
  msg += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
  msg += `Date: ${new Date().toUTCString()}\r\n`;
  msg += `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@ionos.mx>\r\n`;
  if (inReplyTo) msg += `In-Reply-To: ${inReplyTo}\r\n`;
  if (references) msg += `References: ${references}\r\n`;
  msg += `MIME-Version: 1.0\r\n`;
  msg += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
  msg += `--${altBoundary}\r\n`;
  msg += `Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  msg += btoa(unescape(encodeURIComponent(bodyText || subject))) + '\r\n';
  msg += `--${altBoundary}\r\n`;
  msg += `Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  msg += btoa(unescape(encodeURIComponent(bodyHtml))) + '\r\n';
  msg += `--${altBoundary}--\r\n`;
  return msg;
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get user email config
    const { data: config } = await supabase
      .from('email_configuraciones')
      .select('email, password, nombre_remitente')
      .eq('usuario_id', user.id)
      .eq('activa', true)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: 'NO_CONFIG', message: 'No hay cuenta de correo configurada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creds = { email: config.email, password: config.password, nombre: config.nombre_remitente || config.email };
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case 'list-folders': {
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          result = await listFolders(conn);
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      case 'list-messages': {
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          const { messages, total } = await listMessages(conn, body.folder || 'INBOX', body.page || 1, body.perPage || 25);
          result = { messages, total, page: body.page || 1, perPage: body.perPage || 25 };
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      case 'get-message': {
        if (!body.uid || !body.folder) throw new Error('uid y folder son requeridos');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          result = await getMessage(conn, body.uid, body.folder);
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      case 'send-message': {
        if (!body.to || !body.subject) throw new Error('to y subject son requeridos');
        const attachments: SmtpAttachment[] = (body.attachments || []).map((a: any) => ({
          filename: a.filename || 'adjunto',
          contentType: a.contentType || 'application/octet-stream',
          content: a.content || '',
        }));
        await smtpSend(creds.email, creds.password, creds.nombre, body.to, body.cc || [], body.bcc || [], body.subject, body.bodyHtml, body.bodyText || '', attachments, body.inReplyTo, body.references);

        // Append sent message to Sent folder via IMAP
        try {
          const sentMsg = buildRfc822Message(creds.email, creds.nombre, body.to, body.cc || [], body.subject, body.bodyHtml, body.bodyText || '', body.inReplyTo, body.references);
          const sentMsgBytes = new TextEncoder().encode(sentMsg);
          const conn = await imapConnect('imap.ionos.mx', 993);
          if (await imapLogin(conn, creds.email, creds.password)) {
            // Detect the Sent folder from LIST
            const listResp = await imapCommand(conn, 'LIST "" "*"');
            let sentFolder = 'Sent';
            const sentFolderCandidates = ['Sent', 'Enviados', 'Sent Items', 'Sent Messages', 'INBOX.Sent'];
            for (const sf of sentFolderCandidates) {
              if (listResp.includes(`"${sf}"`)) {
                sentFolder = sf;
                break;
              }
            }
            // IMAP APPEND with literal
            const tag = `A${++tagCounter}`;
            const appendLine = `${tag} APPEND "${sentFolder}" (\\Seen) {${sentMsgBytes.length}}\r\n`;
            await conn.write(new TextEncoder().encode(appendLine));
            // Read server response - expect continuation "+"
            const waitBuf = new Uint8Array(4096);
            let waitResp = '';
            const waitStart = Date.now();
            while (Date.now() - waitStart < 5000) {
              const wn = await Promise.race([
                conn.read(waitBuf),
                new Promise<null>(r => setTimeout(() => r(null), 5000)),
              ]);
              if (wn === null || typeof wn !== 'number') break;
              waitResp += new TextDecoder().decode(waitBuf.subarray(0, wn));
              if (waitResp.includes('+') || waitResp.includes(tag)) break;
            }
            if (waitResp.includes('+')) {
              // Server ready to receive literal data
              await conn.write(sentMsgBytes);
              await conn.write(new TextEncoder().encode('\r\n'));
              // Wait for completion
              await imapReadUntilTag(conn, tag);
            }
            await imapLogout(conn);
          } else {
            try { conn.close(); } catch {}
          }
        } catch { /* best-effort: don't fail the send if APPEND fails */ }

        result = { success: true };
        break;
      }

      case 'mark-read': {
        if (!body.uid || !body.folder) throw new Error('uid y folder son requeridos');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          await imapCommand(conn, `SELECT "${body.folder}"`);
          const op = body.read !== false ? '+FLAGS' : '-FLAGS';
          await imapCommand(conn, `UID STORE ${body.uid} ${op} (\\Seen)`);
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        result = { success: true };
        break;
      }

      case 'move-message': {
        if (!body.uid || !body.fromFolder || !body.toFolder) throw new Error('uid, fromFolder y toFolder son requeridos');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          await imapCommand(conn, `SELECT "${body.fromFolder}"`);
          // Try MOVE, fallback to COPY+DELETE
          const moveResp = await imapCommand(conn, `UID MOVE ${body.uid} "${body.toFolder}"`);
          if (!moveResp.includes('OK')) {
            await imapCommand(conn, `UID COPY ${body.uid} "${body.toFolder}"`);
            await imapCommand(conn, `UID STORE ${body.uid} +FLAGS (\\Deleted)`);
            await imapCommand(conn, 'EXPUNGE');
          }
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        result = { success: true };
        break;
      }

      case 'delete-message': {
        if (!body.uid || !body.folder) throw new Error('uid y folder son requeridos');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          await imapCommand(conn, `SELECT "${body.folder}"`);
          // Move to Trash
          const moveResp = await imapCommand(conn, `UID MOVE ${body.uid} "Trash"`);
          if (!moveResp.includes('OK')) {
            await imapCommand(conn, `UID COPY ${body.uid} "Trash"`);
            await imapCommand(conn, `UID STORE ${body.uid} +FLAGS (\\Deleted)`);
            await imapCommand(conn, 'EXPUNGE');
          }
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        result = { success: true };
        break;
      }

      case 'search': {
        if (!body.query) throw new Error('query es requerido');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          await imapCommand(conn, `SELECT "${body.folder || 'INBOX'}"`);
          const searchResp = await imapCommand(conn, `UID SEARCH OR OR SUBJECT "${body.query}" FROM "${body.query}" TO "${body.query}"`);
          const matchLine = searchResp.match(/\* SEARCH ([\d\s]*)/);
          const uids = matchLine ? matchLine[1].trim().split(/\s+/).filter(Boolean).map(Number) : [];
          const limited = uids.slice(-(body.maxResults || 50)).reverse();

          // Fetch headers for found UIDs
          let messages: EmailHeader[] = [];
          if (limited.length > 0) {
            const uidSet = limited.join(',');
            const fetchResp = await imapCommand(conn, `UID FETCH ${uidSet} (UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID CONTENT-TYPE)])`);
            messages = parseHeaderResponses(fetchResp);
          }
          result = { messages, total: uids.length };
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      case 'download-attachment': {
        if (!body.uid || !body.partId || !body.folder) throw new Error('uid, partId y folder son requeridos');
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          await imapCommand(conn, `SELECT "${body.folder}"`);
          const resp = await imapCommand(conn, `UID FETCH ${body.uid} (BODY.PEEK[${body.partId}])`);
          // Extract base64 content
          const dataM = resp.match(/\{(\d+)\}\r\n([\s\S]*)/);
          if (!dataM) throw new Error('No se pudo obtener el adjunto');
          const rawData = dataM[2].substring(0, parseInt(dataM[1]));
          result = { content: rawData.replace(/\s/g, ''), contentType: 'application/octet-stream' };
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      case 'verify-connection': {
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          const ok = await imapLogin(conn, creds.email, creds.password);
          await imapLogout(conn);
          result = { success: ok };
        } catch (e: any) {
          try { conn.close(); } catch {}
          result = { success: false, error: e.message };
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Accion desconocida: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    const msg = error.message || 'Error interno';
    const isAuth = msg === 'AUTH_FAILED';
    return new Response(
      JSON.stringify({ error: isAuth ? 'Credenciales incorrectas' : msg, code: isAuth ? 'AUTH_FAILED' : 'ERROR' }),
      { status: isAuth ? 401 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
