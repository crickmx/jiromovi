// POP3 + SMTP universales: leer lo que bajó el canal externo y armar lo que
// sale por SMTP.
//
// Puro, sin Deno ni red, para poder probarlo con
//   node supabase/functions/_shared/correoExterno.test.mjs
//
// Va aparte de `ionos-webmail` A PROPÓSITO: ese canal no se toca. Aquí hay
// código que se parece al suyo (decodificadores, armado de MIME) y es una
// copia consciente, no un descuido: el canal de IONOS está en producción y
// moverle piezas para compartirlas es justo lo que se pidió no hacer. Si algún
// día se unifican, será con los dos canales probados y en una sola pasada.
//
// Lo que SÍ se reusa con gusto: el molde de las pruebas puras (`snippet.ts`).

// ─── Pop3: cómo llega la respuesta por el socket ─────────────────────

export interface RespuestaPop {
  ok: boolean;
  /** La primera línea sin el +OK/-ERR. */
  dato: string;
  /** El resto. Con `-` la respuesta puede traer varias líneas. */
  lineas: string[];
}

/**
 * POP3 contesta `+OK ...` o `-ERR ...`, y las respuestas de varias líneas
 * terminan en una línea con un punto solo. Se unifica aquí para que quien
 * llame no tenga que acordarse.
 */
export function partirRespuestaPop(respuesta: string): RespuestaPop {
  const lineas = respuesta.split(/\r?\n/);
  // El salto final deja un renglón vacío que no es dato.
  if (lineas.length && lineas[lineas.length - 1] === '') lineas.pop();
  const primera = lineas[0] ?? '';
  const ok = primera.startsWith('+OK');
  if (!ok) {
    return { ok: false, dato: primera.replace(/^-ERR\s?/, '').trim(), lineas: lineas.slice(1) };
  }
  // Multilínea: se corta en el punto solo.
  const cuerpo: string[] = [];
  for (const l of lineas.slice(1)) {
    if (l === '.') break;
    cuerpo.push(l);
  }
  // Si no vino el punto (respuesta corta), igual se devuelve lo que hay.
  if (cuerpo.length === 0) {
    return { ok: true, dato: primera.replace(/^\+OK\s?/, '').trim(), lineas: [] };
  }
  return { ok: true, dato: primera.replace(/^\+OK\s?/, '').trim(), lineas: cuerpo };
}

/**
 * POP3 duplica los puntos al principio de línea para que un mensaje no pueda
 * "terminar" la respuesta. Al leer hay que deshacerlo — y SOLO al principio
 * de línea: un punto a media línea es del mensaje.
 */
export function desEmpacarPuntos(crudo: string): string {
  // El `^` importa: el primer renglón del mensaje también puede empezar con
  // punto. Con solo `\n` en el patrón, ese primero se quedaba duplicado.
  return crudo.replace(/(^|\r?\n)\.\./g, '$1.');
}

/** Lo que devuelve UIDL: `1 AAAABBBB` por renglón. */
export function parsearUidl(lineas: string[]): Array<[string, string]> {
  const pares: Array<[string, string]> = [];
  for (const l of lineas) {
    const m = l.match(/^(\d+)\s+(\S+)/);
    if (m) pares.push([m[1], m[2]]);
  }
  return pares;
}

/** Los números de mensaje que todavía no tenemos. Lo que evita re-bajar todo. */
export function numerosNuevos(uidl: Array<[string, string]>, yaEnBd: Set<string>): Array<[string, string]> {
  return uidl.filter(([, uid]) => !yaEnBd.has(uid));
}

// ─── Encabezados ────────────────────────────────────────────────────

/**
 * Los encabezados pueden venir partidos en varias líneas (la continuación
 * empieza con espacio o tabulador). Se unen antes de leerlos, o un asunto
 * largo se pierde a la mitad.
 */
export function desplegarEncabezados(cabecera: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lineas = cabecera.split(/\r?\n/);
  let nombre: string | null = null;
  for (const l of lineas) {
    if (/^[ \t]/.test(l) && nombre) {
      out[nombre] = `${out[nombre]} ${l.trim()}`;
      continue;
    }
    const m = l.match(/^([A-Za-z0-9-]+):\s?(.*)$/);
    if (m) {
      nombre = m[1].toLowerCase();
      out[nombre] = m[2];
    }
  }
  return out;
}

function aTexto(bin: string, charset: string): string {
  try {
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
    return new TextDecoder(charset || 'utf-8').decode(bytes);
  } catch {
    return bin;
  }
}

export function decodificarBase64(s: string, charset = 'utf-8'): string {
  try {
    const limpio = s.replace(/[^A-Za-z0-9+/=]/g, '');
    const usable = limpio.slice(0, limpio.length - (limpio.length % 4));
    return aTexto(atob(usable), charset);
  } catch {
    return s;
  }
}

export function decodificarQuotedPrintable(s: string, charset = 'utf-8'): string {
  const sinSuaves = s.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < sinSuaves.length; i++) {
    const c = sinSuaves[i];
    if (c === '=' && i + 2 < sinSuaves.length + 1) {
      const hex = sinSuaves.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(c.charCodeAt(0) & 0xff);
  }
  // Se arma en trozos: `String.fromCharCode(...bytes)` con un correo grande
  // revienta por pila, y un cuerpo de 200 KB no es raro.
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.slice(i, i + 8192));
  }
  return aTexto(bin, charset);
}

/**
 * Las palabras codificadas (RFC 2047) suelen venir partidas: `=?UTF-8?B?…?=`
 * dos veces seguidas con un espacio en medio, y ese espacio NO es del texto.
 */
export function decodificarPalabras(valor: string): string {
  if (!valor) return '';
  const unido = valor.replace(/\?=\s+=\?/g, '?==?');
  return unido.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (todo, charset: string, enc: string, texto: string) => {
    try {
      return enc.toUpperCase() === 'B'
        ? decodificarBase64(texto, charset.toLowerCase())
        : decodificarQuotedPrintable(texto.replace(/_/g, ' '), charset.toLowerCase());
    } catch {
      return todo;
    }
  });
}

export function correoDe(valor: string): string {
  const m = valor.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  const solo = valor.match(/([^\s<>,]+@[^\s<>,]+)/);
  return solo ? solo[1] : valor.trim();
}

export function nombreDe(valor: string): string {
  const m = valor.match(/^\s*"?([^"<]+)"?\s*</);
  if (m) return decodificarPalabras(m[1].trim());
  // Sin `Nombre <correo>`: el correo solo es el nombre.
  return correoDe(valor).split('@')[0] ?? '';
}

export function listaDeCorreos(valor: string | undefined): string[] {
  if (!valor) return [];
  return valor.split(',').map((p) => correoDe(p)).filter((p) => p.includes('@'));
}

// ─── El mensaje ─────────────────────────────────────────────────────

export interface Adjunto {
  nombre: string;
  tipo: string;
  tamano: number;
  /** No se guarda el contenido: aquí solo viaja lo que hace falta para avisar. */
  descartado: true;
}

export interface MensajeParseado {
  messageId: string | null;
  remitenteNombre: string;
  remitenteEmail: string;
  destinatarios: string[];
  cc: string[];
  asunto: string;
  fecha: string | null;
  texto: string;
  html: string;
  adjuntos: Adjunto[];
}

function trozar(crudo: string): { cabecera: string; cuerpo: string } {
  let i = crudo.indexOf('\r\n\r\n');
  if (i === -1) {
    i = crudo.indexOf('\n\n');
    if (i === -1) return { cabecera: crudo, cuerpo: '' };
    return { cabecera: crudo.slice(0, i), cuerpo: crudo.slice(i + 2) };
  }
  return { cabecera: crudo.slice(0, i), cuerpo: crudo.slice(i + 4) };
}

function separatorDe(ct: string): string | null {
  const m = ct.match(/boundary\s*=\s*"?([^";]+)"?/i);
  return m ? m[1].trim() : null;
}

function partesDe(cuerpo: string, boundary: string): string[] {
  const marca = `--${boundary}`;
  const trozos = cuerpo.split(marca);
  // El primero es el preámbulo y el último el cierre.
  return trozos.slice(1).filter((t) => !t.startsWith('--')).map((t) => t.replace(/^\r?\n/, ''));
}

/** ¿Este trozo es un adjunto (lleva archivo) o es parte del cuerpo? */
function esAdjunto(ch: Record<string, string>): boolean {
  const disp = (ch['content-disposition'] ?? '').toLowerCase();
  if (disp.startsWith('attachment')) return true;
  // Algunos mandan el archivo solo con nombre y sin `attachment`: si trae
  // nombre y NO es texto, es un archivo.
  const tipo = (ch['content-type'] ?? '').toLowerCase();
  const tieneNombre = /name\s*=/i.test(ch['content-disposition'] ?? '') || /name\s*=/i.test(ch['content-type'] ?? '');
  return tieneNombre && !tipo.startsWith('text/');
}

function nombreDeAdjunto(ch: Record<string, string>): string {
  const disp = ch['content-disposition'] ?? '';
  const ct = ch['content-type'] ?? '';
  const m = disp.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i) ?? ct.match(/name\*?=(?:UTF-8''|")?([^";]+)/i);
  const crudo = m ? m[1].replace(/["']$/, '') : 'adjunto';
  try {
    return decodificarPalabras(decodeURIComponent(crudo));
  } catch {
    return decodificarPalabras(crudo);
  }
}

function decodeCuerpo(cuerpo: string, ch: Record<string, string>): string {
  const cte = (ch['content-transfer-encoding'] ?? '').trim().toLowerCase();
  const ct = ch['content-type'] ?? '';
  const charset = (ct.match(/charset\s*=\s*"?([^";]+)"?/i)?.[1] ?? 'utf-8').trim();
  if (cte === 'base64') return decodificarBase64(cuerpo, charset);
  if (cte === 'quoted-printable') return decodificarQuotedPrintable(cuerpo, charset);
  return cuerpo;
}

function recorrer(cuerpo: string, ch: Record<string, string>, acc: { texto: string; html: string; adjuntos: Adjunto[] }): void {
  const ct = (ch['content-type'] ?? 'text/plain').toLowerCase();

  if (ct.startsWith('multipart/')) {
    const boundary = separatorDe(ch['content-type'] ?? '');
    if (!boundary) return;
    for (const parte of partesDe(cuerpo, boundary)) {
      const { cabecera, cuerpo: sub } = trozar(parte);
      const subCh = desplegarEncabezados(cabecera);
      if (esAdjunto(subCh)) {
        const cte = (subCh['content-transfer-encoding'] ?? '').toLowerCase();
        const bruto = cte === 'base64' ? sub.replace(/\s/g, '').length : sub.length;
        acc.adjuntos.push({
          nombre: nombreDeAdjunto(subCh),
          tipo: (subCh['content-type'] ?? 'application/octet-stream').split(';')[0].trim(),
          tamano: cte === 'base64' ? Math.floor((bruto * 3) / 4) : bruto,
          descartado: true,
        });
        continue;
      }
      recorrer(sub, subCh, acc);
    }
    return;
  }

  const texto = decodeCuerpo(cuerpo, ch);
  if (ct.startsWith('text/html')) {
    if (!acc.html) acc.html = texto;
  } else if (ct.startsWith('text/')) {
    if (!acc.texto) acc.texto = texto;
  }
}

/**
 * Un mensaje crudo tal como lo entrega POP3 (RETR) a algo que se puede
 * guardar y mostrar. Nunca lanza: un correo raro no puede tumbar la
 * sincronización entera — se guarda lo que se pudo leer.
 */
export function parsearMensaje(crudo: string): MensajeParseado {
  const { cabecera, cuerpo } = trozar(crudo);
  const ch = desplegarEncabezados(cabecera);
  const acc = { texto: '', html: '', adjuntos: [] as Adjunto[] };

  try {
    recorrer(cuerpo, ch, acc);
  } catch {
    // Se sigue con lo que haya: encabezados y, si nada se pudo leer, el crudo.
  }

  const fechaCruda = ch['date'] ?? '';
  let fecha: string | null = null;
  if (fechaCruda) {
    const t = Date.parse(fechaCruda);
    if (!Number.isNaN(t)) fecha = new Date(t).toISOString();
  }

  const from = ch['from'] ?? '';
  return {
    messageId: (ch['message-id'] ?? '').trim().replace(/^<|>$/g, '') || null,
    remitenteNombre: nombreDe(from),
    remitenteEmail: correoDe(from),
    destinatarios: listaDeCorreos(ch['to']),
    cc: listaDeCorreos(ch['cc']),
    asunto: decodificarPalabras(ch['subject'] ?? '').trim(),
    fecha,
    texto: acc.texto.slice(0, 50_000),
    html: (acc.html || `<pre>${acc.texto.slice(0, 50_000)}</pre>`),
    adjuntos: acc.adjuntos,
  };
}

// ─── Armar lo que sale por SMTP ─────────────────────────────────────

/** SMTP no acepta una línea de más de 1000 caracteres: se corta cada 76. */
export function trozarBase64(s: string, ancho = 76): string {
  const partes: string[] = [];
  for (let i = 0; i < s.length; i += ancho) partes.push(s.slice(i, i + ancho));
  return partes.join('\r\n');
}

export function codificarBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface Envio {
  de: string;
  nombreDe: string;
  para: string[];
  cc?: string[];
  asunto: string;
  cuerpoHtml: string;
  cuerpoTexto?: string;
  inReplyTo?: string;
}

/**
 * El mensaje tal como se manda a DATA. Se anotan el punto y el fin de línea
 * con cuidado: un `.` solo al final de línea TERMINA el mensaje, y un
 * mensaje cortado a la mitad es peor que un error.
 */
export function construirMensaje(envio: Envio): string {
  const aleatorio = Math.random().toString(36).slice(2);
  const boundary = `----=_Movil_${Date.now()}_${aleatorio}`;
  const soloHtml = !envio.cuerpoTexto;

  const cabeceras = [
    `From: "${envio.nombreDe.replace(/"/g, '')}" <${envio.de}>`,
    `To: ${envio.para.join(', ')}`,
    ...(envio.cc?.length ? [`Cc: ${envio.cc.join(', ')}`] : []),
    `Subject: =?UTF-8?B?${codificarBase64Utf8(envio.asunto)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${aleatorio}@movi.digital>`,
    ...(envio.inReplyTo ? [`In-Reply-To: ${envio.inReplyTo}`, `References: ${envio.inReplyTo}`] : []),
    'MIME-Version: 1.0',
  ];

  const cuerpo = soloHtml
    ? [
        `Content-Type: text/html; charset=UTF-8`,
        'Content-Transfer-Encoding: base64',
        '',
        trozarBase64(codificarBase64Utf8(envio.cuerpoHtml)),
      ]
    : [
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        trozarBase64(codificarBase64Utf8(envio.cuerpoTexto!)),
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        trozarBase64(codificarBase64Utf8(envio.cuerpoHtml)),
        `--${boundary}--`,
      ];

  // El escapado del punto va sobre el cuerpo, no sobre las cabeceras.
  const completo = [...cabeceras, '', ...cuerpo].join('\r\n');
  const corte = completo.indexOf('\r\n\r\n') + 4;
  return completo.slice(0, corte) + completo.slice(corte).replace(/^\./gm, '..');
}

/** ¿Hay que dejar copia en el servidor? Por omisión sí. */
export function debeBorrarDelServidor(dejarCopia: boolean | null | undefined): boolean {
  return dejarCopia === false;
}

/**
 * A qué puerto y con qué TLS. Devuelve también el nombre del modo para poder
 * decirle a la persona qué se intentó exactamente cuando falla.
 */
export function planDeConexion(tls: string, puerto: number, tipo: 'pop' | 'smtp'): { modo: 'tls' | 'starttls' | 'plano'; puerto: number; etiqueta: string } {
  const plano = tipo === 'pop' ? 110 : 25;
  if (tls === 'ssl') return { modo: 'tls', puerto, etiqueta: `TLS de entrada en el puerto ${puerto}` };
  if (tls === 'starttls') return { modo: 'starttls', puerto, etiqueta: `STARTTLS en el puerto ${puerto}` };
  return { modo: 'plano', puerto: puerto || plano, etiqueta: `sin cifrado en el puerto ${puerto || plano}` };
}
