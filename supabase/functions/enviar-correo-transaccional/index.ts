import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailAttachment {
  filename: string;
  content_type?: string;
  storage_path?: string;
  url?: string;
  content?: string;
}

interface EmailRequest {
  tipo?: string;
  destinatario?: string;
  datos?: Record<string, any>;
  evento_id?: string;
  to_email?: string;
  to_name?: string;
  subject?: string;
  html_body?: string;
  attachments?: EmailAttachment[];
  skip_global_layout?: boolean;
}

async function getGlobalLayout(supabaseClient: any): Promise<{ header: string; footer: string }> {
  try {
    const { data, error } = await supabaseClient
      .from('email_global_settings')
      .select('header_html, footer_html')
      .eq('activo', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('No se encontró configuración global de correo, usando layout vacío:', error?.message);
      return { header: '', footer: '' };
    }

    return { header: data.header_html || '', footer: data.footer_html || '' };
  } catch (err) {
    console.error('Error obteniendo layout global:', err);
    return { header: '', footer: '' };
  }
}

function wrapWithLayout(body: string, header: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>MOVI Digital</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          ${header ? `<tr><td>${header}</td></tr>` : ''}
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          ${footer ? `<tr><td>${footer}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function processAttachments(attachments: EmailAttachment[], supabaseUrl: string): Promise<any[]> {
  const resendAttachments = [];

  for (const attachment of attachments) {
    try {
      let fileContent: string;

      if (attachment.url) {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          console.error(`Error descargando ${attachment.filename}: ${response.statusText}`);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        fileContent = btoa(String.fromCharCode(...bytes));
      } else if (attachment.content) {
        fileContent = attachment.content;
      } else if (attachment.storage_path) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/${attachment.storage_path}`;
        const response = await fetch(publicUrl);
        if (!response.ok) {
          console.error(`Error descargando ${attachment.filename}: ${response.statusText}`);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        fileContent = btoa(String.fromCharCode(...bytes));
      } else {
        console.error(`Adjunto ${attachment.filename} no tiene content, url, o storage_path`);
        continue;
      }

      resendAttachments.push({ filename: attachment.filename, content: fileContent });
      console.log(`  Adjunto procesado: ${attachment.filename}`);
    } catch (err: any) {
      console.error(`Error procesando adjunto ${attachment.filename}:`, err.message);
    }
  }

  return resendAttachments;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json() as EmailRequest;

    // Obtener layout global (header + footer) para TODOS los correos
    const { header, footer } = await getGlobalLayout(supabaseClient);

    // ── Formato directo (usado por notificaciones transaccionales) ──
    if (requestBody.to_email && requestBody.subject && requestBody.html_body) {
      console.log('Procesando correo transaccional directo:', { to: requestBody.to_email, subject: requestBody.subject });

      const { data: config, error: configError } = await supabaseClient
        .from('correo_configuracion')
        .select('*')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (configError || !config) {
        throw new Error(`No hay configuración de correo activa: ${configError?.message || 'Config no encontrada'}`);
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY') || config.resend_api_key;
      if (!resendApiKey) throw new Error('RESEND_API_KEY no está configurada');

      const resend = new Resend(resendApiKey);
      const fromEmail = config.remitente_email;
      const fromName = config.remitente_nombre || 'MOVI Digital';

      // Inyectar layout global (a menos que se indique explícitamente que no)
      const finalHtml = requestBody.skip_global_layout
        ? requestBody.html_body
        : wrapWithLayout(requestBody.html_body, header, footer);

      const resendAttachments = requestBody.attachments?.length
        ? await processAttachments(requestBody.attachments, Deno.env.get('SUPABASE_URL') ?? '')
        : [];

      const emailPayload: any = {
        from: `${fromName} <${fromEmail}>`,
        to: [requestBody.to_email],
        subject: requestBody.subject,
        html: finalHtml,
      };

      if (resendAttachments.length > 0) {
        emailPayload.attachments = resendAttachments;
      }

      const { data, error } = await resend.emails.send(emailPayload);
      if (error) throw error;

      console.log('Correo transaccional enviado:', data.id);

      try {
        await supabaseClient.rpc('registrar_envio_notificacion', {
          p_tipo_notificacion_codigo: 'correo_transaccional',
          p_canal_envio: 'correo',
          p_usuario_id: null,
          p_destinatario_email: requestBody.to_email,
          p_destinatario_nombre: requestBody.to_name || null,
          p_numero_destino: null,
          p_asunto: requestBody.subject,
          p_cuerpo_html: finalHtml,
          p_estado: 'enviado',
          p_error_mensaje: null,
          p_enviado_por: null,
          p_evento_id: null,
          p_provider_response: { resend_id: data.id }
        });
      } catch (logErr) {
        console.error('Error logging email:', logErr);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Correo enviado exitosamente', resend_id: data.id, destinatario: requestBody.to_email }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Formato legacy (con plantillas) ──
    const { tipo, destinatario, datos, evento_id } = requestBody;
    console.log('Procesando solicitud de correo:', { tipo, destinatario });

    const { data: config, error: configError } = await supabaseClient
      .from('correo_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      throw new Error('No hay configuración de correo activa');
    }

    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo, enviar_correo')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo) {
      throw new Error(`Tipo de notificación '${tipo}' no encontrado o inactivo`);
    }

    const { data: plantilla, error: plantillaError } = await supabaseClient
      .from('correo_plantillas')
      .select('asunto, html_cuerpo, enviar_correo, enviar_whatsapp, enviar_notificacion')
      .eq('tipo_notificacion_id', tipoNotif.id)
      .single();

    if (plantillaError || !plantilla) {
      throw new Error('No se encontró plantilla para este tipo de notificación');
    }

    const enviarCorreo = plantilla.enviar_correo ?? tipoNotif.enviar_correo ?? true;
    if (!enviarCorreo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Envío por correo desactivado para este tipo de notificación' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let asunto = plantilla.asunto;
    let cuerpo = plantilla.html_cuerpo;

    const datosConMeta = { ...datos, nombre_plataforma: 'MOVI Digital', fecha: new Date().toLocaleDateString('es-MX') };
    Object.keys(datosConMeta).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      asunto = asunto.replace(regex, datosConMeta[key] || '');
      cuerpo = cuerpo.replace(regex, datosConMeta[key] || '');
    });

    // Inyectar layout global
    const finalHtml = wrapWithLayout(cuerpo, header, footer);

    console.log('Plantilla procesada con layout global:', { asunto });

    let estadoEnvio = 'enviado';
    let errorMensaje = null;
    let resendId = null;

    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') || config.resend_api_key;
      if (!resendApiKey) throw new Error('RESEND_API_KEY no está configurada');

      const resend = new Resend(resendApiKey);
      const fromEmail = config.remitente_email;
      const fromName = config.remitente_nombre || 'MOVI Digital';

      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [destinatario],
        subject: asunto,
        html: finalHtml,
      });

      if (error) throw error;

      console.log('Correo enviado exitosamente:', data.id);
      resendId = data.id;
    } catch (emailError: any) {
      console.error('Error al enviar correo:', emailError);
      estadoEnvio = 'fallido';
      errorMensaje = emailError.message || 'Error al enviar correo';
    }

    try {
      await supabaseClient.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: tipo,
        p_canal_envio: 'correo',
        p_usuario_id: null,
        p_destinatario_email: destinatario,
        p_destinatario_nombre: datos?.nombre || null,
        p_numero_destino: null,
        p_asunto: asunto,
        p_cuerpo_html: finalHtml,
        p_estado: estadoEnvio,
        p_error_mensaje: errorMensaje,
        p_enviado_por: null,
        p_evento_id: evento_id || null,
        p_provider_response: resendId ? { resend_id: resendId } : null
      });
    } catch (historialError) {
      console.error('Error al guardar historial:', historialError);
    }

    return new Response(
      JSON.stringify({
        success: estadoEnvio === 'enviado',
        message: estadoEnvio === 'enviado' ? 'Correo enviado exitosamente' : 'Error al enviar correo',
        resend_id: resendId,
        asunto,
        destinatario
      }),
      {
        status: estadoEnvio === 'enviado' ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error general:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
