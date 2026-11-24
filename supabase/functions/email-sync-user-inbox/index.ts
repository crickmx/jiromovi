import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SyncRequest {
  carpeta?: string;
  limite?: number;
}

async function connectIMAP(email: string, password: string): Promise<Deno.TlsConn> {
  const rawConn = await Deno.connect({
    hostname: 'imap.ionos.mx',
    port: 993,
    transport: 'tcp',
  });

  const conn = await Deno.startTls(rawConn, { hostname: 'imap.ionos.mx' });
  return conn;
}

async function sendCommand(conn: Deno.TlsConn, command: string): Promise<string> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(command + '\r\n'));

  const decoder = new TextDecoder();
  const buffer = new Uint8Array(65536);
  let response = '';
  let attempts = 0;
  
  while (attempts < 10) {
    const n = await conn.read(buffer);
    if (n === null) break;
    
    response += decoder.decode(buffer.subarray(0, n));
    
    if (response.includes('\r\n') && (response.match(/^[A-Z0-9]+ (OK|NO|BAD)/m) || response.includes('* BYE'))) {
      break;
    }
    attempts++;
  }

  return response;
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

async function syncIMAPMessages(email: string, password: string, carpeta: string, limite: number) {
  let conn: Deno.TlsConn | null = null;
  const mensajes: any[] = [];

  try {
    conn = await connectIMAP(email, password);

    await sendCommand(conn, '');

    let tagNum = 1;
    const getTag = () => `A${tagNum++}`;

    const loginResponse = await sendCommand(conn, `${getTag()} LOGIN "${email}" "${password}"`);
    if (!loginResponse.includes('OK')) {
      throw new Error('Error de autenticación IMAP');
    }

    const selectResponse = await sendCommand(conn, `${getTag()} SELECT ${carpeta}`);
    if (!selectResponse.includes('OK')) {
      throw new Error(`No se pudo seleccionar la carpeta ${carpeta}`);
    }

    const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
    const totalMessages = existsMatch ? parseInt(existsMatch[1]) : 0;

    if (totalMessages === 0) {
      return { mensajes, totalMessages, noLeidos: 0 };
    }

    const recentMatch = selectResponse.match(/\* (\d+) RECENT/);
    const unseenMatch = selectResponse.match(/\[UNSEEN (\d+)\]/);
    const noLeidos = unseenMatch ? parseInt(unseenMatch[1]) : (recentMatch ? parseInt(recentMatch[1]) : 0);

    const start = Math.max(1, totalMessages - (limite - 1));
    const end = totalMessages;

    const fetchResponse = await sendCommand(conn, `${getTag()} FETCH ${start}:${end} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT])`);

    const messageBlocks = fetchResponse.split(/\* \d+ FETCH/).slice(1);

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
        const isAnswered = flags.includes('\\Answered');

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
          message_id: messageIdMatch ? messageIdMatch[1].trim() : `<${uidMatch[1]}@imap.ionos.mx>`,
          remitente_nombre: decodeHeader(fromName),
          remitente_email: fromEmail,
          destinatarios: toMatch ? parseEmailAddresses(toMatch[1]) : [email],
          cc: ccMatch ? parseEmailAddresses(ccMatch[1]) : [],
          bcc: [],
          asunto: subjectMatch ? decodeHeader(subjectMatch[1].trim()) : '(Sin asunto)',
          cuerpo_texto: bodyText.substring(0, 50000),
          cuerpo_html: bodyHtml || `<pre>${bodyText.substring(0, 50000)}</pre>`,
          fecha: dateHeaderMatch ? new Date(dateHeaderMatch[1]).toISOString() : new Date(dateMatch ? dateMatch[1] : Date.now()).toISOString(),
          leido: isRead,
          marcado: isFlagged,
          respondido: isAnswered,
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

    return { mensajes, totalMessages, noLeidos };

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
    const limite = body.limite || 50;

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('email_cuenta, email_password')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || !usuario.email_cuenta || !usuario.email_password) {
      return new Response(
        JSON.stringify({ error: 'Credenciales de correo no configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mensajes, totalMessages, noLeidos } = await syncIMAPMessages(
      usuario.email_cuenta,
      usuario.email_password,
      carpeta,
      limite
    );

    let carpetaId: string;
    const { data: carpetaExistente } = await supabase
      .from('carpetas_correo')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('nombre_servidor', carpeta)
      .maybeSingle();

    if (carpetaExistente) {
      carpetaId = carpetaExistente.id;
      await supabase
        .from('carpetas_correo')
        .update({
          total_mensajes: totalMessages,
          no_leidos: noLeidos,
          ultima_sincronizacion: new Date().toISOString()
        })
        .eq('id', carpetaId);
    } else {
      const { data: nuevaCarpeta } = await supabase
        .from('carpetas_correo')
        .insert({
          usuario_id: user.id,
          nombre: carpeta === 'INBOX' ? 'Bandeja de entrada' : carpeta,
          nombre_servidor: carpeta,
          total_mensajes: totalMessages,
          no_leidos: noLeidos,
          ultima_sincronizacion: new Date().toISOString()
        })
        .select('id')
        .single();
      
      carpetaId = nuevaCarpeta!.id;
    }

    for (const msg of mensajes) {
      await supabase
        .from('correos_usuario')
        .upsert({
          usuario_id: user.id,
          carpeta_id: carpetaId,
          ...msg
        }, {
          onConflict: 'usuario_id,message_uid,carpeta_id',
          ignoreDuplicates: false
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        mensajes: mensajes.length,
        totalMessages,
        noLeidos,
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