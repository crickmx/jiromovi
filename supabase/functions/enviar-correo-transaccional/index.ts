import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Obtener tipo de notificación
    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo) {
      throw new Error(`Tipo de notificación '${tipo}' no está activo o no existe`);
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

    // Enviar correo (simulado - aquí debes integrar con SMTP o SendGrid real)
    console.log('Enviando correo:', {
      from: `${config.remitente_nombre} <${config.remitente_email}>`,
      to: destinatario,
      subject: asunto,
      html: cuerpo
    });

    // Registrar en historial
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
        evento_id: evento_id || null
      });

    return new Response(
      JSON.stringify({ success: true, message: 'Correo enviado exitosamente' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
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
