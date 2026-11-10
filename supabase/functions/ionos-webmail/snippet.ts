// Fragmento legible de un correo a partir de los primeros bytes de su cuerpo
// (BODY.PEEK[TEXT]<0.N>). Puro, sin Deno ni red, para poder probarlo con
//   npx tsx supabase/functions/ionos-webmail/snippet.test.mjs
//
// Es un "mejor esfuerzo": si no se puede leer, devuelve '' y la lista se ve
// como antes. Nunca debe lanzar.

function decodeB64(str: string, charset: string): string {
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, '');
  const usable = clean.slice(0, clean.length - (clean.length % 4));
  try {
    const bin = atob(usable);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch { return ''; }
}

function decodeQP(str: string, charset: string): string {
  const cleaned = str.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '=' && i + 2 < cleaned.length && /^[0-9A-Fa-f]{2}$/.test(cleaned.substring(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      const c = cleaned.charCodeAt(i);
      if (c < 256) bytes.push(c);
    }
  }
  try { return new TextDecoder(charset, { fatal: false }).decode(new Uint8Array(bytes)); } catch { return cleaned; }
}

function header(block: string, name: string): string {
  const m = block.match(new RegExp(`^${name}:\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)`, 'mi'));
  return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
}

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ' };

export function aTextoPlano(s: string, html: boolean): string {
  let t = s;
  if (html) {
    t = t.replace(/<(style|script|head|title)[^>]*>[\s\S]*?(<\/\1>|$)/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, ' ')
      .replace(/<[^>]*>?/g, ' ');
  }
  t = t.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : ' ';
    }
    return ENTIDADES[e] ?? m;
  });
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * @param raw     primeros bytes del cuerpo (sin los encabezados del mensaje)
 * @param ctTop   Content-Type del mensaje
 * @param cteTop  Content-Transfer-Encoding del mensaje
 */
export function fragmentoDeCorreo(raw: string, ctTop: string, cteTop: string, max = 160): string {
  try {
    if (!raw) return '';
    let ct = ctTop || 'text/plain';
    let cte = cteTop || '7bit';
    let body = raw;

    // Multipart: bajar hasta la primera parte de texto (plano antes que HTML).
    for (let depth = 0; depth < 4 && /multipart\//i.test(ct); depth++) {
      const boundary = ct.match(/boundary="?([^";\s]+)"?/i)?.[1];
      if (!boundary) return '';
      const parts = body.split(`--${boundary}`).slice(1).filter(p => !p.startsWith('--'));
      const parsed = parts.map(p => {
        const cleaned = p.replace(/^\r?\n/, '');
        let i = cleaned.indexOf('\r\n\r\n'); let sep = 4;
        if (i === -1) { i = cleaned.indexOf('\n\n'); sep = 2; }
        if (i === -1) return { h: cleaned, b: '' };
        return { h: cleaned.slice(0, i), b: cleaned.slice(i + sep) };
      }).filter(p => !/attachment/i.test(header(p.h, 'Content-Disposition')));
      const pick = parsed.find(p => /text\/plain/i.test(header(p.h, 'Content-Type')))
        || parsed.find(p => /multipart\//i.test(header(p.h, 'Content-Type')))
        || parsed.find(p => /text\/html/i.test(header(p.h, 'Content-Type')));
      if (!pick) return '';
      ct = header(pick.h, 'Content-Type') || 'text/plain';
      cte = header(pick.h, 'Content-Transfer-Encoding') || '7bit';
      body = pick.b;
    }

    if (!/text\//i.test(ct)) return '';
    const charset = (ct.match(/charset="?([^";\s]+)"?/i)?.[1] || 'utf-8').toLowerCase();
    const enc = cte.toLowerCase();
    let text = enc === 'base64' ? decodeB64(body, charset) : enc === 'quoted-printable' ? decodeQP(body, charset) : body;
    text = aTextoPlano(text, /html/i.test(ct));
    // Quita la cita del correo anterior en respuestas ("El ... escribió:")
    text = text.replace(/\s(El|On)\s.{5,80}\s(escribió|wrote):.*$/i, '').trim();
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
  } catch {
    return '';
  }
}

/** Asunto sin prefijos de respuesta/reenvío, para agrupar hilos. */
export function asuntoBase(subject: string): string {
  let s = (subject || '').trim();
  for (let i = 0; i < 5; i++) {
    const n = s.replace(/^\s*(re|rv|fw|fwd|reenv|res|aw|wg)\s*(\[\d+\])?\s*:\s*/i, '');
    if (n === s) break;
    s = n;
  }
  return s.trim();
}

/** Escapa un texto para usarlo entre comillas en un comando IMAP. */
export function imapQuoted(s: string): string {
  return `"${String(s).replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Lee la respuesta de
 *   FETCH n:m (UID BODY.PEEK[HEADER.FIELDS (CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.N>)
 * y devuelve uid → fragmento.
 */
export function parsearFragmentos(resp: string, headerValue: (block: string, name: string) => string | null): Map<number, string> {
  const out = new Map<number, string>();
  for (const part of resp.split(/\* \d+ FETCH /)) {
    const uidM = part.match(/UID (\d+)/);
    if (!uidM) continue;
    const hdrM = part.match(/HEADER\.FIELDS[^\]]*\] \{(\d+)\}\r\n/);
    let hdr = '';
    if (hdrM) {
      const st = part.indexOf(hdrM[0]) + hdrM[0].length;
      hdr = part.substring(st, st + parseInt(hdrM[1]));
    }
    const txtM = part.match(/BODY\[TEXT\]<0> \{(\d+)\}\r\n/);
    if (!txtM) continue;
    const st = part.indexOf(txtM[0]) + txtM[0].length;
    const raw = part.substring(st, st + parseInt(txtM[1]));
    const sn = fragmentoDeCorreo(raw, headerValue(hdr, 'Content-Type') || 'text/plain', headerValue(hdr, 'Content-Transfer-Encoding') || '7bit');
    if (sn) out.set(parseInt(uidM[1]), sn);
  }
  return out;
}
