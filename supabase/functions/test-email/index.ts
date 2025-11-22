import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestEmailRequest {
  destinatario: string;
  asunto: string;
  mensaje: string;
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

    const { destinatario, asunto, mensaje } = await req.json() as TestEmailRequest;

    console.log('=== TEST EMAIL ===');
    console.log('Destinatario:', destinatario);
    console.log('Asunto:', asunto);
    console.log('Mensaje:', mensaje);

    const { data: config, error: configError } = await supabaseClient
      .from('correo_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Error configuración:', configError);
      throw new Error('No hay configuración de correo activa');
    }

    console.log('Configuración encontrada');

    let estadoEnvio = 'enviado';
    let errorMensaje = null;
    let resendId = null;

    try {
      const resend = new Resend('re_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW');

      console.log('Enviando con Resend...');

      const cuerpoHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
      white-space: pre-wrap;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✉️ Mensaje de Prueba</h1>
    <p>MOVI Digital</p>
  </div>
  <div class="content">
    ${mensaje.replace(/\n/g, '<br>')}
  </div>
  <div class="footer">
    <p>Este es un mensaje de prueba del sistema de notificaciones</p>
    <p>MOVI Digital © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>
      `;

      const { data, error } = await resend.emails.send({
        from: `${config.remitente_nombre} <${config.remitente_email}>`,
        to: [destinatario],
        subject: asunto,
        html: cuerpoHTML,
      });

      if (error) {
        throw error;
      }

      console.log('Correo enviado:', data.id);
      resendId = data.id;
      estadoEnvio = 'enviado';

    } catch (emailError: any) {
      console.error('Error al enviar:', emailError);
      estadoEnvio = 'fallido';
      errorMensaje = emailError.message || 'Error al enviar correo';
    }

    console.log('=== FIN TEST ===');

    return new Response(
      JSON.stringify({
        success: estadoEnvio === 'enviado',
        message: estadoEnvio === 'enviado'
          ? 'Correo enviado exitosamente'
          : 'Error al enviar correo',
        resend_id: resendId,
        asunto,
        destinatario,
        error: errorMensaje
      }),
      {
        status: estadoEnvio === 'enviado' ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error general:', error);

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
