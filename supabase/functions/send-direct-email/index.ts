import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
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
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments } = await req.json() as EmailRequest;

    console.log('=== SEND DIRECT EMAIL ===');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Attachments:', attachments?.length || 0);

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Loading email configuration from database...');
    const { data: config, error: configError } = await supabase
      .from('correo_configuracion')
      .select('remitente_email, remitente_nombre, resend_api_key')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.error('Error loading email config:', configError);
      throw new Error(`Error loading email configuration: ${configError.message}`);
    }

    if (!config) {
      throw new Error('No active email configuration found');
    }

    if (!config.resend_api_key && !Deno.env.get('RESEND_API_KEY')) {
      throw new Error('No Resend API key found in database or environment');
    }

    console.log('Email config loaded:');
    console.log('  From Name:', config.remitente_nombre);
    console.log('  From Email:', config.remitente_email);

    const resendApiKey = config.resend_api_key || Deno.env.get('RESEND_API_KEY');
    const resend = new Resend(resendApiKey);

    const fromAddress = config.remitente_email;
    const fromName = config.remitente_nombre;

    console.log('Sending email via Resend...');
    console.log('From:', `${fromName} <${fromAddress}>`);

    // Procesar adjuntos
    const resendAttachments = [];
    if (attachments && attachments.length > 0) {
      console.log(`Processing ${attachments.length} attachments...`);

      for (const attachment of attachments) {
        try {
          let fileContent: string;

          // Si tiene URL de Supabase Storage, descargar el archivo
          if (attachment.url) {
            console.log(`  Downloading: ${attachment.filename} from ${attachment.url}`);
            const response = await fetch(attachment.url);
            if (!response.ok) {
              console.error(`Failed to download ${attachment.filename}: ${response.statusText}`);
              continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            fileContent = btoa(String.fromCharCode(...bytes));
          }
          // Si tiene content directo en base64
          else if (attachment.content) {
            fileContent = attachment.content;
          }
          // Si tiene storage_path, construir URL y descargar
          else if (attachment.storage_path) {
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/${attachment.storage_path}`;
            console.log(`  Downloading: ${attachment.filename} from storage path`);
            const response = await fetch(publicUrl);
            if (!response.ok) {
              console.error(`Failed to download ${attachment.filename}: ${response.statusText}`);
              continue;
            }
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            fileContent = btoa(String.fromCharCode(...bytes));
          } else {
            console.error(`Attachment ${attachment.filename} has no content, url, or storage_path`);
            continue;
          }

          resendAttachments.push({
            filename: attachment.filename,
            content: fileContent,
          });

          console.log(`  ✓ Attached: ${attachment.filename}`);
        } catch (err: any) {
          console.error(`Error processing attachment ${attachment.filename}:`, err.message);
        }
      }
    }

    const emailPayload: any = {
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject: subject,
      html: html,
    };

    if (resendAttachments.length > 0) {
      emailPayload.attachments = resendAttachments;
      console.log(`Sending with ${resendAttachments.length} attachments`);
    }

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully. ID:', data?.id);

    // IMPORTANTE: Registrar envío en historial
    console.log('Registering email in history...');
    try {
      const { error: logError } = await supabase.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: 'email_directo',
        p_canal_envio: 'correo',
        p_usuario_id: null,
        p_destinatario_email: to,
        p_destinatario_nombre: null,
        p_numero_destino: null,
        p_asunto: subject,
        p_cuerpo_html: html,
        p_estado: 'enviado',
        p_error_mensaje: null,
        p_enviado_por: null,
        p_evento_id: null,
        p_provider_response: { resend_id: data?.id }
      });

      if (logError) {
        console.error('Error logging email:', logError);
      } else {
        console.log('Email logged successfully');
      }
    } catch (logErr) {
      console.error('Exception logging email:', logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        resend_id: data?.id,
        to,
        subject,
        from: `${fromName} <${fromAddress}>`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);

    // Registrar el error en historial
    try {
      const { to, subject, html } = await req.json() as EmailRequest;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      await supabase.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: 'email_directo',
        p_canal_envio: 'correo',
        p_usuario_id: null,
        p_destinatario_email: to || 'unknown@error.com',
        p_destinatario_nombre: null,
        p_numero_destino: null,
        p_asunto: subject || 'Error',
        p_cuerpo_html: html || '',
        p_estado: 'fallido',
        p_error_mensaje: error.message,
        p_enviado_por: null,
        p_evento_id: null,
        p_provider_response: null
      });
    } catch (logErr) {
      console.error('Error logging failed email:', logErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});