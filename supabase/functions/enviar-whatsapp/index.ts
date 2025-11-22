import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WhatsAppRequest {
  tipo: string;
  numero: string;
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

    const { tipo, numero, datos, evento_id } = await req.json() as WhatsAppRequest;

    // Obtener configuración activa de WhatsApp
    const { data: config, error: configError } = await supabaseClient
      .from('whatsapp_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      throw new Error('No hay configuración de WhatsApp activa');
    }

    // Obtener tipo de notificación
    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo, enviar_por_whatsapp')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo || !tipoNotif.enviar_por_whatsapp) {
      throw new Error(`Tipo de notificación '${tipo}' no está configurado para WhatsApp`);
    }

    // Obtener plantilla WhatsApp
    const { data: plantilla, error: plantillaError } = await supabaseClient
      .from('correo_plantillas')
      .select('whatsapp_plantilla')
      .eq('tipo_notificacion_id', tipoNotif.id)
      .single();

    if (plantillaError || !plantilla || !plantilla.whatsapp_plantilla) {
      throw new Error('No se encontró plantilla de WhatsApp para este tipo de notificación');
    }

    // Normalizar número de teléfono
    let numeroNormalizado = numero.replace(/[^0-9]/g, '');

    // Si no empieza con 52 y tiene 10 dígitos, agregar 52
    if (numeroNormalizado.length === 10) {
      numeroNormalizado = '52' + numeroNormalizado;
    }

    // Reemplazar variables en el texto
    let texto = plantilla.whatsapp_plantilla;

    // Variables por defecto
    datos['nombre_plataforma'] = 'MOVI Digital';
    datos['fecha'] = new Date().toLocaleDateString('es-MX');

    Object.keys(datos).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      texto = texto.replace(regex, datos[key] || '');
    });

    console.log('Enviando WhatsApp a:', numeroNormalizado);
    console.log('Texto:', texto);

    // Enviar mensaje via Wazzup24 API
    const wazzupResponse = await fetch('https://api.wazzup24.com/v3/message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: config.numero_remitente,
        phone: numeroNormalizado,
        text: texto
      })
    });

    const wazzupData = await wazzupResponse.json();

    const success = wazzupResponse.ok;

    // Registrar en historial
    await supabaseClient
      .from('correo_historial_envios')
      .insert({
        tipo_notificacion_id: tipoNotif.id,
        tipo_notificacion_codigo: tipo,
        destinatario_email: datos.email_laboral || '',
        destinatario_nombre: datos.nombre || null,
        asunto: `WhatsApp: ${tipo}`,
        cuerpo_html: texto,
        estado: success ? 'enviado' : 'fallido',
        error_mensaje: success ? null : JSON.stringify(wazzupData),
        canal_envio: 'whatsapp',
        numero_destino: numeroNormalizado,
        whatsapp_respuesta: wazzupData,
        evento_id: evento_id || null
      });

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Mensaje de WhatsApp enviado exitosamente' : 'Error al enviar mensaje',
        response: wazzupData
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error al enviar WhatsApp:', error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
