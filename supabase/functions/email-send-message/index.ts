import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Helper para generar Mi Página Web desde slug
function getMiPaginaWeb(slug: string | null | undefined): string {
  if (!slug) return '';
  return `agentedeseguros.website/${slug}`;
}

interface SendEmailRequest {
  configuracionId: string;
  destinatarios: string[];
  cc?: string[];
  bcc?: string[];
  asunto: string;
  cuerpoHtml: string;
  adjuntos?: any[];
  programado?: boolean;
  fechaProgramada?: string;
}

async function connectSMTP(host: string, port: number) {
  const conn = await Deno.connect({
    hostname: host,
    port: port,
    transport: 'tcp',
  });

  const tlsConn = await Deno.startTls(conn, { hostname: host });
  return tlsConn;
}

async function sendSMTPCommand(conn: Deno.TlsConn, command: string, expectCode?: string): Promise<string> {
  const encoder = new TextEncoder();
  await conn.write(encoder.encode(command + '\r\n'));

  const decoder = new TextDecoder();
  const buffer = new Uint8Array(4096);
  const n = await conn.read(buffer);

  if (n === null) throw new Error('Conexión cerrada');

  const response = decoder.decode(buffer.subarray(0, n));

  if (expectCode && !response.startsWith(expectCode)) {
    throw new Error(`Error SMTP: ${response}`);
  }

  return response;
}

function encodeBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return btoa(String.fromCharCode(...data));
}

function buildEmailMessage(
  from: string,
  fromName: string,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`;
  const messageId = `<${Date.now()}.${Math.random().toString(36)}@ionos.mx>`;
  const date = new Date().toUTCString();

  let message = `From: ${fromName} <${from}>\r\n`;
  message += `To: ${to.join(', ')}\r\n`;

  if (cc.length > 0) {
    message += `Cc: ${cc.join(', ')}\r\n`;
  }

  message += `Subject: ${subject}\r\n`;
  message += `Date: ${date}\r\n`;
  message += `Message-ID: ${messageId}\r\n`;
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  message += `\r\n`;

  const textBody = htmlBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

  message += `--${boundary}\r\n`;
  message += `Content-Type: text/plain; charset="UTF-8"\r\n`;
  message += `Content-Transfer-Encoding: quoted-printable\r\n`;
  message += `\r\n`;
  message += `${textBody}\r\n`;
  message += `\r\n`;

  message += `--${boundary}\r\n`;
  message += `Content-Type: text/html; charset="UTF-8"\r\n`;
  message += `Content-Transfer-Encoding: quoted-printable\r\n`;
  message += `\r\n`;
  message += `${htmlBody}\r\n`;
  message += `\r\n`;

  message += `--${boundary}--\r\n`;

  return message;
}

async function sendEmailSMTP(
  config: any,
  fromName: string,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  htmlBody: string
): Promise<string> {
  let conn: Deno.TlsConn | null = null;

  try {
    conn = await connectSMTP(config.servidor_salida, config.puerto_salida);

    const greeting = await sendSMTPCommand(conn, '', '220');
    console.log('SMTP Greeting:', greeting);

    const domain = config.email.split('@')[1] || 'localhost';
    const ehlo = await sendSMTPCommand(conn, `EHLO ${domain}`, '250');
    console.log('EHLO Response:', ehlo);

    const authCommand = encodeBase64(`\0${config.email}\0${config.password_encrypted}`);
    const authResponse = await sendSMTPCommand(conn, `AUTH PLAIN ${authCommand}`, '235');
    console.log('AUTH Response:', authResponse);

    const mailFrom = await sendSMTPCommand(conn, `MAIL FROM:<${config.email}>`, '250');
    console.log('MAIL FROM Response:', mailFrom);

    const allRecipients = [...to, ...cc, ...bcc];
    for (const recipient of allRecipients) {
      const rcpt = await sendSMTPCommand(conn, `RCPT TO:<${recipient}>`, '250');
      console.log(`RCPT TO <${recipient}> Response:`, rcpt);
    }

    const dataCmd = await sendSMTPCommand(conn, 'DATA', '354');
    console.log('DATA Response:', dataCmd);

    const emailMessage = buildEmailMessage(config.email, fromName, to, cc, bcc, subject, htmlBody);

    const encoder = new TextEncoder();
    await conn.write(encoder.encode(emailMessage));
    const endData = await sendSMTPCommand(conn, '\r\n.', '250');
    console.log('End DATA Response:', endData);

    await sendSMTPCommand(conn, 'QUIT');
    console.log('QUIT sent');

    const messageId = `<${Date.now()}.${Math.random().toString(36)}@${config.servidor_salida}>`;
    return messageId;

  } catch (error) {
    console.error('Error SMTP:', error);
    throw error;
  } finally {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.error('Error cerrando conexión SMTP:', e);
      }
    }
  }
}

async function getFirmaUsuario(supabase: any, userId: string): Promise<string> {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select(`
        *,
        oficinas (
          id,
          nombre,
          direccion,
          telefono,
          email,
          sitio_web,
          facebook,
          instagram,
          linkedin,
          twitter
        )
      `)
      .eq('id', userId)
      .single();

    if (!usuario) return '';

    const { data: firmaAsignada } = await supabase
      .rpc('get_firma_asignada', { p_usuario_id: userId });

    if (!firmaAsignada || firmaAsignada.length === 0) return '';

    let firmaHtml = firmaAsignada[0].template_html;

    const templateData: any = {
      nombre: usuario.nombre || '',
      apellidos: usuario.apellidos || '',
      rol: usuario.rol || '',
      puesto: usuario.puesto || '',
      email_laboral: usuario.email_laboral || '',
      celular_laboral: usuario.celular_laboral || '',
      extension_telefonica: usuario.extension_telefonica || '',
      mi_pagina_web: getMiPaginaWeb(usuario.web_slug),
      web_slug: usuario.web_slug || '',
      imagen_perfil: usuario.imagen_perfil_url || '',
    };

    if (usuario.oficinas) {
      const oficina = usuario.oficinas;
      templateData.oficina_nombre = oficina.nombre || '';
      templateData.oficina_direccion = oficina.direccion || '';
      templateData.oficina_telefono = oficina.telefono || '';
      templateData.oficina_email = oficina.email || '';
      templateData.oficina_sitio_web = oficina.sitio_web || '';
      templateData.oficina_facebook = oficina.facebook || '';
      templateData.oficina_instagram = oficina.instagram || '';
      templateData.oficina_linkedin = oficina.linkedin || '';
      templateData.oficina_twitter = oficina.twitter || '';
    }

    firmaHtml = firmaHtml.replace(/\{\{([^#\/][^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return templateData[trimmedKey] !== undefined && templateData[trimmedKey] !== null
        ? String(templateData[trimmedKey])
        : '';
    });

    firmaHtml = firmaHtml.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      const trimmedKey = key.trim();
      const value = templateData[trimmedKey];
      if (value && value !== '' && value !== null && value !== undefined) {
        return content.replace(/\{\{([^}]+)\}\}/g, (m, k) => {
          const tk = k.trim();
          return templateData[tk] !== undefined ? String(templateData[tk]) : '';
        });
      }
      return '';
    });

    return firmaHtml;
  } catch (error) {
    console.error('Error obteniendo firma:', error);
    return '';
  }
}

function aplicarFirma(cuerpoHtml: string, firmaHtml: string): string {
  if (!firmaHtml) return cuerpoHtml;

  if (cuerpoHtml.includes('<!-- FIRMA_BEGIN -->')) {
    return cuerpoHtml;
  }

  return cuerpoHtml + '\n\n' + firmaHtml;
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

    if (body.programado && body.fechaProgramada) {
      const firmaHtml = await getFirmaUsuario(supabase, user.id);
      const cuerpoConFirma = aplicarFirma(body.cuerpoHtml, firmaHtml);

      const { data: programado, error: progError } = await supabase
        .from('email_programados')
        .insert({
          usuario_id: user.id,
          configuracion_id: config.id,
          destinatarios: body.destinatarios,
          cc: body.cc || [],
          bcc: body.bcc || [],
          asunto: body.asunto,
          cuerpo_html: cuerpoConFirma,
          adjuntos: body.adjuntos || [],
          fecha_programada: body.fechaProgramada,
          estado: 'pendiente'
        })
        .select()
        .single();

      if (progError) {
        throw new Error('Error al programar envío');
      }

      return new Response(
        JSON.stringify({
          success: true,
          programado: true,
          id: programado.id,
          fechaProgramada: body.fechaProgramada
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firmaHtml = await getFirmaUsuario(supabase, user.id);
    const cuerpoConFirma = aplicarFirma(body.cuerpoHtml, firmaHtml);

    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('nombre, apellidos')
      .eq('id', user.id)
      .single();

    const fromName = usuarioData
      ? `${usuarioData.nombre} ${usuarioData.apellidos}`.trim()
      : config.nombre_remitente || config.email;

    const messageId = await sendEmailSMTP(
      config,
      fromName,
      body.destinatarios,
      body.cc || [],
      body.bcc || [],
      body.asunto,
      cuerpoConFirma
    );

    await supabase
      .from('email_mensajes_cache')
      .insert({
        usuario_id: user.id,
        configuracion_id: config.id,
        carpeta: 'SENT',
        message_uid: `sent_${Date.now()}`,
        message_id: messageId,
        remitente: fromName,
        remitente_email: config.email,
        destinatarios: body.destinatarios,
        cc: body.cc || [],
        bcc: body.bcc || [],
        asunto: body.asunto,
        cuerpo_texto: cuerpoConFirma.replace(/<[^>]*>/g, ''),
        cuerpo_html: cuerpoConFirma,
        fecha: new Date().toISOString(),
        leido: true,
        marcado: false,
        tiene_adjuntos: (body.adjuntos?.length || 0) > 0,
        size_bytes: cuerpoConFirma.length,
        etiquetas: []
      });

    await supabase.rpc('extraer_contactos_email', {
      p_usuario_id: user.id,
      p_remitente_email: config.email,
      p_remitente_nombre: fromName,
      p_destinatarios: body.destinatarios,
      p_cc: body.cc || [],
      p_fecha: new Date().toISOString()
    }).catch(err => console.error('Error extrayendo contactos:', err));

    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error al enviar correo:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al enviar correo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
