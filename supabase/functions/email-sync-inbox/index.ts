import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  configuracionId: string;
  carpeta?: string;
}

async function connectIMAP(host: string, port: number, email: string, password: string) {
  const conn = await Deno.connect({
    hostname: host,
    port: port,
    transport: 'tcp',
  });

  const tlsConn = await Deno.startTls(conn, { hostname: host });
  return tlsConn;
}

async function sendCommand(conn: Deno.TlsConn, command: string): Promise<string> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(command + '\r\n'));

  const decoder = new TextDecoder();
  const buffer = new Uint8Array(65536);
  const n = await conn.read(buffer);

  if (n === null) return '';
  return decoder.decode(buffer.subarray(0, n));
}

function parseEmailAddresses(str: string): string[] {
  if (!str) return [];
  const matches = str.match(/<([^>]+)>|([^\s,]+@[^\s,]+)/g);
  return matches ? matches.map(m => m.replace(/[<>]/g, '')) : [];
}

function decodeQuotedPrintable(str: string): string {
  return str.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64Safe(str: string): string {
  try {
    const binaryString = atob(str);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
}

function decodeHeader(str: string): string {
  if (!str) return '';

  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return decodeBase64Safe(text);
      } else if (encoding.toUpperCase() === 'Q') {
        return decodeQuotedPrintable(text.replace(/_/g, ' '));
      }
    } catch {
      return match;
    }
    return match;
  });
}

async function syncIMAPMessages(config: any, carpeta: string) {
  let conn: Deno.TlsConn | null = null;
  const mensajes: any[] = [];

  try {
    conn = await connectIMAP(config.servidor_imap, config.puerto_imap, config.email, config.password);

    let response = await sendCommand(conn, '');
    console.log('Conexión IMAP iniciada:', response);

    let tagNum = 1;
    const getTag = () => `A${tagNum++}`;

    response = await sendCommand(conn, `${getTag()} LOGIN "${config.email}" "${config.password}"`);
    if (!response.includes('OK')) {
      throw new Error('Error de autenticación IMAP');
    }

    response = await sendCommand(conn, `${getTag()} SELECT ${carpeta}`);
    if (!response.includes('OK')) {
      throw new Error(`No se pudo seleccionar la carpeta ${carpeta}`);
    }

    const existsMatch = response.match(/\* (\d+) EXISTS/);
    const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;

    if (totalMessages === 0) {
      return mensajes;
    }

    const start = Math.max(1, totalMessages - 49);
    const end = totalMessages;

    response = await sendCommand(conn, `${getTag()} FETCH ${start}:${end} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT])`);

    const messageBlocks = response.split(/\* \d+ FETCH/).slice(1);

    for (const block of messageBlocks) {
      try {
        const uidMatch = block.match(/UID (\d+)/);
        const flagsMatch = block.match(/FLAGS \(([^)]*)\)/);
        const sizeMatch = block.match(/RFC822.SIZE (\d+)/);
        const dateMatch = block.match(/INTERNALDATE "([^"]+)"/);

        if (!uidMatch) continue;

        const headerMatch = block.match(/BODY\[HEADER\.FIELDS[^\]]*\] \{(\d+)\}\r?\n([\s\S]*?)(?=\r?\n\r?\n)/);
        const bodyMatch = block.match(/BODY\[TEXT\] \{(\d+)\}\r?\n([\s\S]*?)(?=\)[\r\n]*$|\)[\r\n]*\* )/);

        const headers = headerMatch ? headerMatch[2] : '';
        const body = bodyMatch ? bodyMatch[2] : '';

        const fromMatch = headers.match(/From: ([^\r\n]+)/i);
        const toMatch = headers.match(/To: ([^\r\n]+)/i);
        const ccMatch = headers.match(/Cc: ([^\r\n]+)/i);
        const subjectMatch = headers.match(/Subject: ([^\r\n]+)/i);
        const dateHeaderMatch = headers.match(/Date: ([^\r\n]+)/i);
        const messageIdMatch = headers.match(/Message-ID: ([^\r\n]+)/i);

        const fromRaw = fromMatch ? fromMatch[1].trim() : '';
        const fromEmail = parseEmailAddresses(fromRaw)[0] || '';
        const fromName = fromRaw.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || fromEmail.split('@')[0];

        const flags = flagsMatch ? flagsMatch[1] : '';
        const isRead = flags.includes('\\Seen');
        const isFlagged = flags.includes('\\Flagged');

        let bodyText = body;
        let bodyHtml = '';

        if (body.includes('Content-Type: text/html')) {
          const htmlMatch = body.match(/Content-Type: text\/html[^\r\n]*\r?\n(?:Content-Transfer-Encoding: ([^\r\n]+)\r?\n)?[^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\n--)/);
          if (htmlMatch) {
            const encoding = htmlMatch[1]?.toLowerCase();
            let html = htmlMatch[2];

            if (encoding === 'base64') {
              html = decodeBase64Safe(html.replace(/\s/g, ''));
            } else if (encoding === 'quoted-printable') {
              html = decodeQuotedPrintable(html);
            }

            bodyHtml = html;
          }
        }

        if (body.includes('Content-Type: text/plain')) {
          const textMatch = body.match(/Content-Type: text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding: ([^\r\n]+)\r?\n)?[^\r\n]*\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\n\r?\n--|\r?\nContent-Type)/);
          if (textMatch) {
            const encoding = textMatch[1]?.toLowerCase();
            let text = textMatch[2];

            if (encoding === 'base64') {
              text = decodeBase64Safe(text.replace(/\s/g, ''));
            } else if (encoding === 'quoted-printable') {
              text = decodeQuotedPrintable(text);
            }

            bodyText = text;
          }
        }

        const mensaje = {
          message_uid: `${uidMatch[1]}`,
          message_id: messageIdMatch ? messageIdMatch[1].trim() : `<${uidMatch[1]}@${config.servidor_imap}>`,
          remitente: decodeHeader(fromName),
          remitente_email: fromEmail,
          destinatarios: toMatch ? parseEmailAddresses(toMatch[1]) : [config.email],
          cc: ccMatch ? parseEmailAddresses(ccMatch[1]) : [],
          bcc: [],
          asunto: subjectMatch ? decodeHeader(subjectMatch[1].trim()) : '(Sin asunto)',
          cuerpo_texto: bodyText.substring(0, 50000),
          cuerpo_html: bodyHtml || `<pre>${bodyText.substring(0, 50000)}</pre>`,
          fecha: dateHeaderMatch ? new Date(dateHeaderMatch[1]).toISOString() : new Date(dateMatch ? dateMatch[1] : Date.now()).toISOString(),
          leido: isRead,
          marcado: isFlagged,
          tiene_adjuntos: body.includes('Content-Disposition: attachment'),
          size_bytes: sizeMatch ? parseInt(sizeMatch[1]) : body.length,
          etiquetas: []
        };

        mensajes.push(mensaje);
      } catch (err) {
        console.error('Error parseando mensaje:', err);
      }
    }

    await sendCommand(conn, `${getTag()} LOGOUT`);

  } catch (error) {
    console.error('Error en IMAP:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.error('Error cerrando conexión:', e);
      }
    }
  }

  return mensajes;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SyncRequest = await req.json();
    const carpeta = body.carpeta || 'INBOX';

    const { data: config, error: configError } = await supabase
      .from('email_configuraciones')
      .select('*')
      .eq('id', body.configuracionId)
      .eq('usuario_id', user.id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Configuración no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mensajes = await syncIMAPMessages(config, carpeta);

    for (const msg of mensajes) {
      await supabase
        .from('email_mensajes_cache')
        .upsert({
          usuario_id: user.id,
          configuracion_id: config.id,
          carpeta: carpeta,
          ...msg
        }, {
          onConflict: 'usuario_id,message_uid,carpeta'
        });
    }

    await supabase
      .from('email_configuraciones')
      .update({
        ultima_sincronizacion: new Date().toISOString(),
        estado_conexion: 'conectado'
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({
        success: true,
        mensajes: mensajes.length,
        ultimaSincronizacion: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error en sincronización:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al sincronizar' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});