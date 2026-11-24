import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SendEmailRequest {
  para: string[];
  cc?: string[];
  bcc?: string[];
  asunto: string;
  cuerpo_html?: string;
  cuerpo_texto?: string;
  adjuntos?: Array<{nombre: string; contenido: string; tipo: string}>;
}

async function connectSMTP(email: string, password: string): Promise<Deno.TlsConn> {
  const rawConn = await Deno.connect({
    hostname: 'smtp.ionos.mx',
    port: 465,
    transport: 'tcp',
  });

  const conn = await Deno.startTls(rawConn, { hostname: 'smtp.ionos.mx' });
  return conn;
}

async function sendSMTPCommand(conn: Deno.TlsConn, command: string, expectCode?: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (command) {
    await conn.write(encoder.encode(command + '\r\n'));
  }

  const buffer = new Uint8Array(4096);
  let response = '';
  let attempts = 0;
  
  while (attempts < 10) {
    const n = await conn.read(buffer);
    if (n === null) break;
    
    response += decoder.decode(buffer.subarray(0, n));
    
    if (response.includes('\r\n') && /^\d{3}[ -]/.test(response)) {
      const lines = response.split('\r\n');
      const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
      if (/^\d{3} /.test(lastLine)) {
        break;
      }
    }
    attempts++;
  }

  if (expectCode && !response.startsWith(expectCode)) {
    throw new Error(`Esperaba código ${expectCode}, recibió: ${response}`);
  }

  return response;
}

function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

async function sendEmail(
  email: string,
  password: string,
  para: string[],
  cc: string[],
  bcc: string[],
  asunto: string,
  cuerpoHtml: string,
  cuerpoTexto: string,
  adjuntos: Array<{nombre: string; contenido: string; tipo: string}>
): Promise<void> {
  let conn: Deno.TlsConn | null = null;

  try {
    conn = await connectSMTP(email, password);

    await sendSMTPCommand(conn, '', '220');

    await sendSMTPCommand(conn, `EHLO ${email.split('@')[1]}`, '250');

    await sendSMTPCommand(conn, 'AUTH LOGIN', '334');

    await sendSMTPCommand(conn, encodeBase64(email), '334');

    await sendSMTPCommand(conn, encodeBase64(password), '235');

    await sendSMTPCommand(conn, `MAIL FROM:<${email}>`, '250');

    for (const destinatario of para) {
      await sendSMTPCommand(conn, `RCPT TO:<${destinatario}>`, '250');
    }

    for (const destinatario of cc) {
      await sendSMTPCommand(conn, `RCPT TO:<${destinatario}>`, '250');
    }

    for (const destinatario of bcc) {
      await sendSMTPCommand(conn, `RCPT TO:<${destinatario}>`, '250');
    }

    await sendSMTPCommand(conn, 'DATA', '354');

    const boundary = '----=_NextPart_' + Date.now();
    let message = '';
    message += `From: ${email}\r\n`;
    message += `To: ${para.join(', ')}\r\n`;
    if (cc.length > 0) {
      message += `Cc: ${cc.join(', ')}\r\n`;
    }
    message += `Subject: =?UTF-8?B?${encodeBase64(asunto)}?=\r\n`;
    message += `Date: ${new Date().toUTCString()}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
    message += `\r\n`;

    if (cuerpoTexto) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/plain; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `\r\n`;
      message += encodeBase64(cuerpoTexto) + '\r\n';
    }

    if (cuerpoHtml) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `\r\n`;
      message += encodeBase64(cuerpoHtml) + '\r\n';
    }

    for (const adjunto of adjuntos) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: ${adjunto.tipo}; name="${adjunto.nombre}"\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n`;
      message += `Content-Disposition: attachment; filename="${adjunto.nombre}"\r\n`;
      message += `\r\n`;
      message += adjunto.contenido + '\r\n';
    }

    message += `--${boundary}--\r\n`;
    message += `.\r\n`;

    await sendSMTPCommand(conn, message, '250');

    await sendSMTPCommand(conn, 'QUIT', '221');

  } catch (error) {
    console.error('Error en SMTP:', error);
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

    const body: SendEmailRequest = await req.json();

    if (!body.para || body.para.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Se requiere al menos un destinatario' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.asunto) {
      return new Response(
        JSON.stringify({ error: 'El asunto es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.cuerpo_html && !body.cuerpo_texto) {
      return new Response(
        JSON.stringify({ error: 'Se requiere al menos un cuerpo (HTML o texto)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('email_cuenta, email_password, nombre_completo')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || !usuario.email_cuenta || !usuario.email_password) {
      return new Response(
        JSON.stringify({ error: 'Credenciales de correo no configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await sendEmail(
      usuario.email_cuenta,
      usuario.email_password,
      body.para,
      body.cc || [],
      body.bcc || [],
      body.asunto,
      body.cuerpo_html || '',
      body.cuerpo_texto || body.asunto,
      body.adjuntos || []
    );

    const { data: carpetaEnviados } = await supabase
      .from('carpetas_correo')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('tipo_carpeta', 'sent')
      .maybeSingle();

    if (carpetaEnviados) {
      await supabase
        .from('correos_usuario')
        .insert({
          usuario_id: user.id,
          carpeta_id: carpetaEnviados.id,
          message_uid: `sent-${Date.now()}`,
          message_id: `<${Date.now()}@${usuario.email_cuenta.split('@')[1]}>`,
          remitente_nombre: usuario.nombre_completo || usuario.email_cuenta,
          remitente_email: usuario.email_cuenta,
          destinatarios: body.para,
          cc: body.cc || [],
          bcc: body.bcc || [],
          asunto: body.asunto,
          cuerpo_html: body.cuerpo_html || '',
          cuerpo_texto: body.cuerpo_texto || '',
          fecha: new Date().toISOString(),
          leido: true,
          tiene_adjuntos: (body.adjuntos || []).length > 0
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Correo enviado exitosamente',
        fecha: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error enviando correo:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al enviar correo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});