import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tipo, destinatario, datos, evento_id } = await req.json() as EmailRequest;

    // Obtener configuración activa
    const { data: config, error: configError } = await supabaseClient
      .from('correo_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      throw new Error('No hay configuración de correo activa');
    }

    // Validar que sea SMTP
    if (config.tipo_integracion !== 'smtp') {
      throw new Error('Esta función solo soporta SMTP. Use SendGrid para API.');
    }

    // Obtener tipo de notificación
    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo, enviar_por_correo')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo || !tipoNotif.enviar_por_correo) {
      throw new Error(`Tipo de notificación '${tipo}' no está configurado para correo`);
    }

    // Obtener plantilla
    const { data: plantilla, error: plantillaError } = await supabaseClient
      .from('correo_plantillas')
      .select('asunto, html_cuerpo')
      .eq('tipo_notificacion_id', tipoNotif.id)
      .single();

    if (plantillaError || !plantilla) {
      throw new Error('No se encontró plantilla para este tipo de notificación');
    }

    // Reemplazar variables en asunto y cuerpo
    let asunto = plantilla.asunto;
    let cuerpo = plantilla.html_cuerpo;

    // Variables por defecto
    datos['nombre_plataforma'] = 'MOVI Digital';
    datos['fecha'] = new Date().toLocaleDateString('es-MX');

    Object.keys(datos).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      asunto = asunto.replace(regex, datos[key] || '');
      cuerpo = cuerpo.replace(regex, datos[key] || '');
    });

    console.log('Configurando SMTP:', {
      hostname: config.servidor,
      port: config.puerto,
      username: config.usuario
    });

    // Configurar cliente SMTP
    const client = new SMTPClient({
      connection: {
        hostname: config.servidor,
        port: config.puerto,
        tls: config.seguridad === 'ssl' || config.seguridad === 'tls',
        auth: {
          username: config.usuario,
          password: config.password_encriptado,
        },
      },
    });

    // Enviar correo
    try {
      await client.send({
        from: `${config.remitente_nombre} <${config.remitente_email}>`,
        to: destinatario,
        subject: asunto,
        content: cuerpo,
        html: cuerpo,
      });

      console.log('Correo enviado exitosamente a:', destinatario);

      // Cerrar conexión
      await client.close();

      // Registrar en historial como exitoso
      await supabaseClient
        .from('correo_historial_envios')
        .insert({
          tipo_notificacion_id: tipoNotif.id,
          tipo_notificacion_codigo: tipo,
          destinatario_email: destinatario,
          destinatario_nombre: datos.nombre || null,
          asunto,
          cuerpo_html: cuerpo,
          estado: 'enviado',
          canal_envio: 'correo',
          evento_id: evento_id || null
        });

      return new Response(
        JSON.stringify({ success: true, message: 'Correo enviado exitosamente' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (smtpError: any) {
      console.error('Error SMTP:', smtpError);

      // Cerrar conexión en caso de error
      try {
        await client.close();
      } catch (e) {
        // Ignorar errores al cerrar
      }

      // Registrar en historial como fallido
      await supabaseClient
        .from('correo_historial_envios')
        .insert({
          tipo_notificacion_id: tipoNotif.id,
          tipo_notificacion_codigo: tipo,
          destinatario_email: destinatario,
          destinatario_nombre: datos.nombre || null,
          asunto,
          cuerpo_html: cuerpo,
          estado: 'fallido',
          error_mensaje: smtpError.message || 'Error al enviar correo',
          canal_envio: 'correo',
          evento_id: evento_id || null
        });

      throw new Error(`Error SMTP: ${smtpError.message}`);
    }
  } catch (error: any) {
    console.error('Error al enviar correo:', error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
