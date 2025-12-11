import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  tipo: string;
  destinatario: string;
  datos: Record<string, any>;
  evento_id?: string;
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

    const { tipo, destinatario, datos, evento_id } = await req.json() as EmailRequest;

    console.log('Procesando solicitud de correo:', { tipo, destinatario });

    const { data: config, error: configError } = await supabaseClient
      .from('correo_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Error configuración:', configError);
      throw new Error('No hay configuración de correo activa');
    }

    console.log('Configuración encontrada:', {
      tipo: config.tipo_integracion,
      remitente: config.remitente_email
    });

    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo, enviar_por_correo')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo || !tipoNotif.enviar_por_correo) {
      console.error('Error tipo notificación:', tipoError);
      throw new Error(`Tipo de notificación '${tipo}' no está configurado para correo`);
    }

    const { data: plantilla, error: plantillaError } = await supabaseClient
      .from('correo_plantillas')
      .select('asunto, html_cuerpo')
      .eq('tipo_notificacion_id', tipoNotif.id)
      .single();

    if (plantillaError || !plantilla) {
      console.error('Error plantilla:', plantillaError);
      throw new Error('No se encontró plantilla para este tipo de notificación');
    }

    let asunto = plantilla.asunto;
    let cuerpo = plantilla.html_cuerpo;

    datos['nombre_plataforma'] = 'MOVI Digital';
    datos['fecha'] = new Date().toLocaleDateString('es-MX');

    Object.keys(datos).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      asunto = asunto.replace(regex, datos[key] || '');
      cuerpo = cuerpo.replace(regex, datos[key] || '');
    });

    console.log('Plantilla procesada:', { asunto });

    let estadoEnvio = 'enviado';
    let errorMensaje = null;
    let resendId = null;

    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY no está configurada');
      }

      const resend = new Resend(resendApiKey);

      console.log('Enviando correo con Resend...');

      let fromEmail = config.remitente_email || 'onboarding@resend.dev';
      const fromName = config.remitente_nombre || 'MOVI Digital';

      if (config.tipo_integracion === 'resend' && config.dominio_verificado) {
        fromEmail = `noreply@${config.dominio_verificado}`;
        console.log('Usando dominio verificado de Resend:', fromEmail);
      } else if (!fromEmail.includes('@')) {
        console.log('Usando dominio de desarrollo de Resend');
        fromEmail = 'onboarding@resend.dev';
      }

      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [destinatario],
        subject: asunto,
        html: cuerpo,
      });

      if (error) {
        throw error;
      }

      console.log('Correo enviado exitosamente:', data.id);
      resendId = data.id;
      estadoEnvio = 'enviado';

    } catch (emailError: any) {
      console.error('Error al enviar correo:', emailError);
      estadoEnvio = 'fallido';
      errorMensaje = emailError.message || 'Error al enviar correo';
    }

    const { error: historialError } = await supabaseClient
      .from('correo_historial_envios')
      .insert({
        tipo_notificacion_id: tipoNotif.id,
        tipo_notificacion_codigo: tipo,
        destinatario_email: destinatario,
        destinatario_nombre: datos.nombre || null,
        asunto,
        cuerpo_html: cuerpo,
        estado: estadoEnvio,
        error_mensaje: errorMensaje,
        canal_envio: 'correo',
        evento_id: evento_id || null
      });

    if (historialError) {
      console.error('Error al guardar historial:', historialError);
    }

    return new Response(
      JSON.stringify({
        success: estadoEnvio === 'enviado',
        message: estadoEnvio === 'enviado'
          ? 'Correo enviado exitosamente'
          : 'Error al enviar correo',
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