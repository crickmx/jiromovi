import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getMailboxPassword, setMailboxPassword } from '../_shared/emailCredentials.ts';
import { emailCorsHeaders, forbiddenOriginResponse } from '../_shared/emailCors.ts';

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

// Pide el STATUS (MESSAGES/UNSEEN) de TODAS las carpetas en una sola tanda:
// escribe todos los comandos de golpe (pipelining IMAP) y lee hasta el OK del
// último tag, en vez de un round-trip por carpeta. Con 7-10 carpetas eso
// recorta 7-10 idas y vueltas a IONOS a ~1. Si algo falla en el parseo, el que
// llama cae al camino secuencial de siempre (nunca peor que antes).
async function imapStatusPipeline(conn: Deno.TlsConn, paths: string[]): Promise<Map<string, { total: number; unseen: number }>> {
  const map = new Map<string, { total: number; unseen: number }>();
  if (paths.length === 0) return map;

  const tags: string[] = [];
  let cmds = '';
  for (const p of paths) {
    const tag = `A${++tagCounter}`;
    tags.push(tag);
    cmds += `${tag} STATUS "${p}" (MESSAGES UNSEEN)\r\n`;
  }
  await conn.write(new TextEncoder().encode(cmds));

  const lastTag = tags[tags.length - 1];
  const decoder = new TextDecoder();
  const doneRe = new RegExp(`${lastTag} (OK|NO|BAD)`);
  let result = '';
  let attempts = 0;
  while (!doneRe.test(result)) {
    if (attempts++ > 400) break;
    const buf = new Uint8Array(262144);
    const n = await conn.read(buf);
    if (n === null) break;
    result += decoder.decode(buf.subarray(0, n));
  }

  for (const line of result.split(/\r\n/)) {
    const m = line.match(/^\* STATUS (?:"([^"]+)"|(\S+)) \(([^)]*)\)/);
    if (!m) continue;
    const name = m[1] ?? m[2];
    const attrs = m[3];
    const msgM = attrs.match(/MESSAGES (\d+)/);
    const unM = attrs.match(/UNSEEN (\d+)/);
    map.set(name, { total: msgM ? parseInt(msgM[1]) : 0, unseen: unM ? parseInt(unM[1]) : 0 });
  }
  return map;
}

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

  // Contadores por carpeta: intento pipelined (1 round-trip); si no devuelve
  // datos para alguna carpeta, la completo con un STATUS suelto de respaldo.
  let counts = new Map<string, { total: number; unseen: number }>();
  try {
    counts = await imapStatusPipeline(conn, folders.map((f) => f.path));
  } catch { /* cae al secuencial abajo */ }

  for (const f of folders) {
    const c = counts.get(f.path);
    if (c) {
      f.total = c.total;
      f.unseen = c.unseen;
      continue;
    }
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

// Camino de respaldo: baja el RFC822 completo (BODY[], incluye adjuntos) y lo
// parsea entero. Asume que la carpeta YA fue seleccionada por quien llama.
async function getMessageFull(conn: Deno.TlsConn, uid: number): Promise<EmailFull | null> {
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
  // Delega en decodePartContent, que respeta el charset del Content-Type
  // (reconstruye bytes + TextDecoder(charset)). Antes usaba decodeQP, que
  // mapea cada byte con String.fromCharCode (Latin-1): un UTF-8 =C3=A9 salía
  // como "Ã©" (mojibake) en correos single-part quoted-printable.
  return decodePartContent(body, headers);
}

function extractFilenameFromHeaders(headersBlock: string): string | null {
  const disp = extractHeaderValue(headersBlock, 'Content-Disposition') || '';
  const ct = extractHeaderValue(headersBlock, 'Content-Type') || '';
  const m = disp.match(/filename="?([^";\r\n]+)"?/i) || ct.match(/name="?([^";\r\n]+)"?/i);
  return m ? decodeHeaderWord(m[1]) : null;
}

// ── BODYSTRUCTURE: fetch selectivo del cuerpo (sin bajar adjuntos) ──
//
// getMessageFull baja el correo ENTERO (BODY[]) — con adjuntos pesados en
// base64 — solo para mostrar el texto. Aquí, en su lugar, pedimos primero la
// BODYSTRUCTURE (metadata liviana), ubicamos las partes text/html y text/plain
// y traemos SOLO esas; los adjuntos quedan como metadata y se bajan on-demand
// vía 'download-attachment'. Si algo del parseo falla o el mensaje no es
// multipart, caemos a getMessageFull (comportamiento idéntico al de antes).

interface BodyPartRef {
  partId: string;
  type: string;
  subtype: string;
  encoding: string;
  charset: string;
  size: number;
  filename: string | null;
  disposition: string;
}

// Devuelve la subcadena balanceada de paréntesis desde `openIdx` (respeta
// comillas). Usada para aislar la lista de BODYSTRUCTURE del resto de la respuesta.
function extractBalancedParens(s: string, openIdx: number): string | null {
  if (openIdx < 0 || s[openIdx] !== '(') return null;
  let depth = 0;
  let inQuote = false;
  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') inQuote = false;
      continue;
    }
    if (ch === '"') { inQuote = true; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return s.substring(openIdx, i + 1); }
  }
  return null;
}

// Tokeniza una lista IMAP con paréntesis en un arreglo anidado (strings, null
// para NIL, y sub-arreglos). Maneja comillas y literales {n}.
function tokenizeImapList(s: string): any {
  let i = 0;
  const parseQuoted = (): string => {
    i++; // salta la comilla inicial
    let out = '';
    while (i < s.length) {
      const ch = s[i];
      if (ch === '\\') { out += s[i + 1] ?? ''; i += 2; continue; }
      if (ch === '"') { i++; break; }
      out += ch; i++;
    }
    return out;
  };
  const parseLiteral = (): string => {
    const m = s.slice(i).match(/^\{(\d+)\}\r\n/);
    if (!m) { i++; return ''; }
    const n = parseInt(m[1]);
    const start = i + m[0].length;
    const val = s.substr(start, n);
    i = start + n;
    return val;
  };
  const parseAtom = (): any => {
    let out = '';
    while (i < s.length && s[i] !== ' ' && s[i] !== '(' && s[i] !== ')') { out += s[i]; i++; }
    return out === 'NIL' ? null : out;
  };
  const parseList = (): any[] => {
    const arr: any[] = [];
    i++; // salta '('
    while (i < s.length) {
      const ch = s[i];
      if (ch === ')') { i++; break; }
      if (ch === ' ' || ch === '\r' || ch === '\n') { i++; continue; }
      if (ch === '(') { arr.push(parseList()); continue; }
      if (ch === '"') { arr.push(parseQuoted()); continue; }
      if (ch === '{') { arr.push(parseLiteral()); continue; }
      arr.push(parseAtom());
    }
    return arr;
  };
  while (i < s.length && s[i] !== '(') i++;
  if (i >= s.length) return null;
  return parseList();
}

// Recorre el árbol de BODYSTRUCTURE asignando números de parte IMAP y
// clasificando cada hoja como texto, html o adjunto.
function walkBodyStructure(
  node: any[],
  prefix: string,
  out: { text?: BodyPartRef; html?: BodyPartRef; attachments: BodyPartRef[] },
): void {
  if (!Array.isArray(node)) return;

  if (Array.isArray(node[0])) {
    // multipart: (part1)(part2)... "subtype" ...
    let idx = 0;
    const children: any[] = [];
    while (Array.isArray(node[idx])) { children.push(node[idx]); idx++; }
    children.forEach((child, ci) => {
      walkBodyStructure(child, prefix ? `${prefix}.${ci + 1}` : `${ci + 1}`, out);
    });
    return;
  }

  const type = (node[0] ?? '').toString().toLowerCase();
  const subtype = (node[1] ?? '').toString().toLowerCase();
  const params = Array.isArray(node[2]) ? node[2] : [];
  const encoding = (node[5] ?? '7bit').toString().toLowerCase();
  const size = parseInt((node[6] ?? '0').toString()) || 0;

  let charset = 'utf-8';
  for (let k = 0; k + 1 < params.length; k += 2) {
    if ((params[k] ?? '').toString().toLowerCase() === 'charset') charset = (params[k + 1] ?? 'utf-8').toString();
  }

  // Disposición + filename: buscamos una sublista tipo ["attachment", ["filename","x"]]
  let filename: string | null = null;
  let disposition = '';
  for (let k = 7; k < node.length; k++) {
    const el = node[k];
    if (Array.isArray(el) && typeof el[0] === 'string' && /attachment|inline/i.test(el[0])) {
      disposition = el[0].toLowerCase();
      const dp = el[1];
      if (Array.isArray(dp)) {
        for (let j = 0; j + 1 < dp.length; j += 2) {
          if (/filename/i.test((dp[j] ?? '').toString())) filename = (dp[j + 1] ?? '').toString();
        }
      }
    }
  }
  if (!filename) {
    for (let k = 0; k + 1 < params.length; k += 2) {
      if (/^name$/i.test((params[k] ?? '').toString())) filename = (params[k + 1] ?? '').toString();
    }
  }
  if (filename) filename = decodeHeaderWord(filename);

  const partId = prefix || '1';
  const ref: BodyPartRef = { partId, type, subtype, encoding, charset, size, filename, disposition };

  if (type === 'text' && subtype === 'plain' && disposition !== 'attachment' && !out.text) {
    out.text = ref;
  } else if (type === 'text' && subtype === 'html' && disposition !== 'attachment' && !out.html) {
    out.html = ref;
  } else {
    out.attachments.push(ref);
  }
}

// Decodifica el contenido de una parte reutilizando decodePartContent (que ya
// respeta charset y transfer-encoding) sintetizando sus cabeceras.
function decodePartWithRef(data: string, ref: BodyPartRef): string {
  const fakeHeaders = `Content-Transfer-Encoding: ${ref.encoding}\r\nContent-Type: ${ref.type}/${ref.subtype}; charset="${ref.charset}"`;
  return decodePartContent(data, fakeHeaders);
}

async function getMessage(conn: Deno.TlsConn, uid: number, folder: string): Promise<EmailFull | null> {
  await imapCommand(conn, `SELECT "${folder}"`);

  try {
    const bsResp = await imapCommand(conn, `UID FETCH ${uid} (FLAGS BODYSTRUCTURE)`);
    const bsKeyIdx = bsResp.search(/BODYSTRUCTURE /i);
    if (bsKeyIdx === -1) throw new Error('sin BODYSTRUCTURE');
    const listStr = extractBalancedParens(bsResp, bsResp.indexOf('(', bsKeyIdx));
    if (!listStr) throw new Error('BODYSTRUCTURE no balanceada');

    const tree = tokenizeImapList(listStr);
    // Solo optimizamos el caso multipart (donde viven los adjuntos). Un
    // mensaje single-part no tiene adjuntos y es liviano ⇒ camino completo.
    if (!Array.isArray(tree) || !Array.isArray(tree[0])) throw new Error('single-part');

    const parsed: { text?: BodyPartRef; html?: BodyPartRef; attachments: BodyPartRef[] } = { attachments: [] };
    walkBodyStructure(tree, '', parsed);
    if (!parsed.html && !parsed.text) throw new Error('sin partes de cuerpo');

    const flagsM = bsResp.match(/FLAGS \(([^)]*)\)/);
    const flags = flagsM ? flagsM[1].split(' ').filter(Boolean) : [];

    // Traer cabeceras + SOLO las partes de cuerpo en un único FETCH.
    const wanted: BodyPartRef[] = [];
    if (parsed.html) wanted.push(parsed.html);
    if (parsed.text) wanted.push(parsed.text);
    const partSpecs = wanted.map((w) => `BODY.PEEK[${w.partId}]`).join(' ');
    const fetchResp = await imapCommand(
      conn,
      `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE MESSAGE-ID)] ${partSpecs})`,
    );

    // Aísla el bloque de cabeceras por su longitud de literal (la respuesta
    // trae varios literales: cabeceras + partes de cuerpo).
    let headers = '';
    const hIdx = fetchResp.search(/BODY\[HEADER\.FIELDS[^\]]*\] \{\d+\}\r\n/);
    if (hIdx !== -1) {
      const hLenM = fetchResp.substring(hIdx).match(/^BODY\[HEADER\.FIELDS[^\]]*\] \{(\d+)\}\r\n/);
      if (hLenM) {
        const hStart = hIdx + hLenM[0].length;
        headers = fetchResp.substring(hStart, hStart + parseInt(hLenM[1]));
      }
    }

    const rawFrom = decodeHeaderWord(extractHeaderValue(headers, 'From') || '');
    const fromEmail = extractEmail(rawFrom);
    const fromName = extractName(rawFrom) || fromEmail;
    const to = (extractHeaderValue(headers, 'To') || '').split(',').map((s) => decodeHeaderWord(s.trim())).filter(Boolean);
    const cc = (extractHeaderValue(headers, 'Cc') || '').split(',').map((s) => decodeHeaderWord(s.trim())).filter(Boolean);
    const bcc = (extractHeaderValue(headers, 'Bcc') || '').split(',').map((s) => decodeHeaderWord(s.trim())).filter(Boolean);
    const subject = decodeHeaderWord(extractHeaderValue(headers, 'Subject') || '');
    const date = extractHeaderValue(headers, 'Date') || '';
    const messageId = extractHeaderValue(headers, 'Message-ID') || '';

    let bodyHtml: string | null = null;
    let bodyText: string | null = null;
    for (const w of wanted) {
      // Aísla el bloque de esta parte: BODY[<partId>] {len}\r\n<data>
      const marker = `BODY[${w.partId}] {`;
      const mi = fetchResp.indexOf(marker);
      if (mi === -1) continue;
      const lenM = fetchResp.substring(mi).match(/^BODY\[[^\]]+\] \{(\d+)\}\r\n/);
      if (!lenM) continue;
      const dataStart = mi + lenM[0].length;
      const raw = fetchResp.substring(dataStart, dataStart + parseInt(lenM[1]));
      const decoded = decodePartWithRef(raw, w);
      if (w === parsed.html) bodyHtml = decoded;
      else if (w === parsed.text) bodyText = decoded;
    }

    if (bodyHtml === null && bodyText === null) throw new Error('sin cuerpo tras fetch');

    const attachments = parsed.attachments.map((a) => ({
      filename: a.filename || `adjunto_${a.partId}`,
      contentType: `${a.type}/${a.subtype}`,
      size: a.size,
      partId: a.partId,
    }));

    return {
      uid, messageId, from: fromName, fromEmail, to, cc, bcc, subject, date,
      seen: flags.includes('\\Seen'), flagged: flags.includes('\\Flagged'),
      bodyHtml, bodyText, attachments,
    };
  } catch {
    // Cualquier problema ⇒ camino completo de siempre (carpeta ya seleccionada).
    return await getMessageFull(conn, uid);
  }
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

// ── Contactos IONOS ────────────────────────────────────────────────
//
// Dos fuentes que se combinan:
//  1. "Recientes": remitentes/destinatarios reales de tu buzón (INBOX + Enviados).
//  2. "Libreta": tu agenda CardDAV de IONOS, si está configurado IONOS_CARDDAV_URL.

interface IonosContact { name: string; email: string; source: 'reciente' | 'libreta'; }

function splitAddresses(value: string): string[] {
  // Corte simple por coma (coincide con el resto del parseo del proyecto). Los
  // nombres con coma suelen ir entre comillas; el caso raro se tolera.
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

async function collectFromFolder(
  conn: Deno.TlsConn,
  folder: string,
  fields: string[],
  map: Map<string, { name: string; date: string }>,
  limit: number,
): Promise<void> {
  const selResp = await imapCommand(conn, `SELECT "${folder}"`);
  const total = parseInt(selResp.match(/\* (\d+) EXISTS/)?.[1] || '0');
  if (!total) return;
  const start = Math.max(1, total - limit + 1);
  const fetchFields = [...fields, 'DATE'].join(' ');
  const resp = await imapCommand(conn, `FETCH ${start}:${total} (BODY.PEEK[HEADER.FIELDS (${fetchFields})])`);

  const parts = resp.split(/\* \d+ FETCH /);
  for (const part of parts) {
    if (!part.trim()) continue;
    const hb = part.match(/HEADER\.FIELDS[^}]*\}\r\n([\s\S]*?)(?:\r\n\))/)?.[1] || '';
    if (!hb) continue;
    const date = extractHeaderValue(hb, 'Date') || '';
    for (const fld of fields) {
      const val = extractHeaderValue(hb, fld);
      if (!val) continue;
      for (const addr of splitAddresses(val)) {
        const email = extractEmail(addr).toLowerCase();
        if (!email.includes('@') || email.length > 254) continue;
        const name = decodeHeaderWord(extractName(addr)) || '';
        const prev = map.get(email);
        if (!prev) {
          map.set(email, { name, date });
        } else {
          const newer = date && (!prev.date || new Date(date).getTime() > new Date(prev.date).getTime());
          if (newer) map.set(email, { name: name || prev.name, date });
          else if (!prev.name && name) prev.name = name;
        }
      }
    }
  }
}

async function listImapContacts(conn: Deno.TlsConn, ownEmail: string): Promise<IonosContact[]> {
  const listResp = await imapCommand(conn, 'LIST "" "*"');
  let sentFolder = '';
  for (const sf of ['Sent', 'Enviados', 'Sent Items', 'Sent Messages', 'INBOX.Sent']) {
    if (listResp.includes(`"${sf}"`)) { sentFolder = sf; break; }
  }

  const map = new Map<string, { name: string; date: string }>();
  try { await collectFromFolder(conn, 'INBOX', ['From'], map, 250); } catch { /* ignore */ }
  if (sentFolder) { try { await collectFromFolder(conn, sentFolder, ['To', 'Cc'], map, 250); } catch { /* ignore */ } }

  const own = ownEmail.toLowerCase();
  return [...map.entries()]
    .filter(([email]) => email !== own)
    .sort((a, b) => (new Date(b[1].date).getTime() || 0) - (new Date(a[1].date).getTime() || 0))
    .slice(0, 400)
    .map(([email, v]) => ({ email, name: v.name, source: 'reciente' as const }));
}

// Best-effort: sólo corre si IONOS_CARDDAV_URL apunta a la colección de la
// libreta. Un solo REPORT addressbook-query, parseo de vCards por regex. Ante
// cualquier error devuelve [] (nunca rompe el resto de contactos).
async function fetchCardDavContacts(collectionUrl: string, email: string, password: string): Promise<IonosContact[]> {
  try {
    const body = `<?xml version="1.0" encoding="utf-8" ?>` +
      `<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">` +
      `<D:prop><D:getetag/><C:address-data/></D:prop></C:addressbook-query>`;
    const resp = await fetch(collectionUrl, {
      method: 'REPORT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${email}:${password}`),
        'Content-Type': 'application/xml; charset=utf-8',
        'Depth': '1',
      },
      body,
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const out: IonosContact[] = [];
    for (const m of xml.matchAll(/BEGIN:VCARD([\s\S]*?)END:VCARD/gi)) {
      const card = m[1];
      const fn = card.match(/\r?\nFN[^:\r\n]*:(.+)/i)?.[1]?.trim() || '';
      for (const em of card.matchAll(/\r?\nEMAIL[^:\r\n]*:(.+)/gi)) {
        const addr = em[1].trim().toLowerCase();
        if (addr.includes('@')) out.push({ name: fn, email: addr, source: 'libreta' });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = emailCorsHeaders(req);
  if (!corsHeaders) return forbiddenOriginResponse();
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

    const body = await req.json();
    const { action } = body;

    // Guardar/verificar una cuenta nueva: la contraseña llega solo en este
    // request (HTTPS), nunca se escribe en texto plano en ninguna tabla.
    if (action === 'save-config') {
      const { email, password, nombreRemitente } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Correo y contrasena requeridos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const conn = await imapConnect('imap.ionos.mx', 993);
      let verified = false;
      try {
        verified = await imapLogin(conn, email, password);
        await imapLogout(conn);
      } catch (e: any) {
        try { conn.close(); } catch { /* ignore */ }
        return new Response(JSON.stringify({ error: 'Credenciales incorrectas', code: 'AUTH_FAILED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!verified) {
        return new Response(JSON.stringify({ error: 'Credenciales incorrectas', code: 'AUTH_FAILED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { error: upsertError } = await supabase
        .from('email_configuraciones')
        .upsert({
          usuario_id: user.id,
          email,
          nombre_remitente: nombreRemitente || null,
          activa: true,
          estado_conexion: 'conectado',
        }, { onConflict: 'usuario_id' });
      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await setMailboxPassword(supabase, user.id, password);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get user email config
    const { data: config } = await supabase
      .from('email_configuraciones')
      .select('email, nombre_remitente')
      .eq('usuario_id', user.id)
      .eq('activa', true)
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({ error: 'NO_CONFIG', message: 'No hay cuenta de correo configurada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const mailboxPassword = await getMailboxPassword(supabase, user.id);
    if (!mailboxPassword) {
      return new Response(JSON.stringify({ error: 'NO_CREDENTIAL', message: 'No hay credencial de correo almacenada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creds = { email: config.email, password: mailboxPassword, nombre: config.nombre_remitente || config.email };

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

      // Carga inicial en UN solo login: carpetas + primera página de una
      // carpeta (INBOX por defecto). Reemplaza el waterfall list-folders →
      // list-messages (dos logins IMAP en serie) por una sola conexión.
      case 'open-mailbox': {
        const folder = body.folder || 'INBOX';
        const page = body.page || 1;
        const perPage = body.perPage || 30;
        const conn = await imapConnect('imap.ionos.mx', 993);
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          const folders = await listFolders(conn);
          const { messages, total } = await listMessages(conn, folder, page, perPage);
          await imapLogout(conn);
          result = { folders, folder, messages, total, page, perPage };
        } catch (e) { try { conn.close(); } catch {} throw e; }
        break;
      }

      // Contactos IONOS: recientes del buzón (INBOX + Enviados) combinados con
      // la libreta CardDAV si está configurada. Un solo login IMAP.
      case 'list-contacts': {
        const conn = await imapConnect('imap.ionos.mx', 993);
        let recientes: IonosContact[] = [];
        try {
          if (!await imapLogin(conn, creds.email, creds.password)) throw new Error('AUTH_FAILED');
          recientes = await listImapContacts(conn, creds.email);
          await imapLogout(conn);
        } catch (e) { try { conn.close(); } catch {} throw e; }

        const cardDavUrl = Deno.env.get('IONOS_CARDDAV_URL');
        const libreta = cardDavUrl
          ? await fetchCardDavContacts(cardDavUrl, creds.email, creds.password)
          : [];

        // Merge dedup por email: la libreta (con nombre "oficial") pisa el
        // nombre vacío de un reciente, pero conservamos ambos orígenes.
        const byEmail = new Map<string, IonosContact>();
        for (const c of recientes) byEmail.set(c.email, c);
        for (const c of libreta) {
          const prev = byEmail.get(c.email);
          if (!prev) byEmail.set(c.email, c);
          else if (!prev.name && c.name) byEmail.set(c.email, { ...prev, name: c.name });
        }
        result = { contacts: [...byEmail.values()] };
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
