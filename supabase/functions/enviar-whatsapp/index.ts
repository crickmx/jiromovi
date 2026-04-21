import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WhatsAppRequest {
  tipo?: string;
  numero?: string;
  datos?: Record<string, any>;
  evento_id?: string;
  // Formato directo para notificaciones transaccionales
  phone?: string;
  message?: string;
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

    const requestBody = await req.json() as WhatsAppRequest;

    // Soporte para formato directo (usado por notificaciones transaccionales)
    if (requestBody.phone && requestBody.message) {
      console.log('=== INICIO ENVÍO WHATSAPP TRANSACCIONAL ===');
      console.log('Número:', requestBody.phone);

      const { data: config, error: configError } = await supabaseClient
        .from('whatsapp_configuracion')
        .select('*')
        .eq('activo', true)
        .single();

      if (configError || !config) {
        console.error('Error configuración:', configError);
        throw new Error('No hay configuración de WhatsApp activa');
      }

      let numeroNormalizado = requestBody.phone.replace(/[^0-9]/g, '');

      if (numeroNormalizado.length === 10) {
        numeroNormalizado = '521' + numeroNormalizado;
      } else if (numeroNormalizado.length === 12 && numeroNormalizado.startsWith('52')) {
        numeroNormalizado = '521' + numeroNormalizado.substring(2);
      } else if (numeroNormalizado.length === 13 && !numeroNormalizado.startsWith('521')) {
        numeroNormalizado = '521' + numeroNormalizado.substring(3);
      }

      console.log('Número normalizado:', numeroNormalizado);

      // IMPORTANTE: Validar longitud del mensaje
      let mensaje = requestBody.message;
      const MAX_WHATSAPP_LENGTH = 550;
      if (mensaje.length > MAX_WHATSAPP_LENGTH) {
        console.warn(`⚠️ Mensaje excede ${MAX_WHATSAPP_LENGTH} caracteres (${mensaje.length}). Truncando...`);
        mensaje = mensaje.substring(0, MAX_WHATSAPP_LENGTH - 20) + '... [Continúa]';
      }
      console.log(`Longitud mensaje: ${mensaje.length} caracteres`);

      if (!config.channel_id_uuid) {
        throw new Error('El Channel ID (UUID) no está configurado');
      }

      const wazzupPayload = {
        channelId: config.channel_id_uuid,
        chatId: numeroNormalizado,
        chatType: 'whatsapp',
        text: mensaje
      };

      console.log('Enviando a Wazzup24:', wazzupPayload);

      const wazzupResponse = await fetch('https://api.wazzup24.com/v3/message', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wazzupPayload)
      });

      const responseText = await wazzupResponse.text();
      let wazzupData;
      try {
        wazzupData = JSON.parse(responseText);
      } catch (e) {
        wazzupData = { raw_response: responseText };
      }

      console.log('Respuesta Wazzup24:', wazzupData);

      const success = wazzupResponse.ok;

      // IMPORTANTE: Registrar envío en historial
      try {
        await supabaseClient.rpc('registrar_envio_notificacion', {
          p_tipo_notificacion_codigo: 'whatsapp_transaccional',
          p_canal_envio: 'whatsapp',
          p_usuario_id: null,
          p_destinatario_email: 'whatsapp@sistema.local',
          p_destinatario_nombre: null,
          p_numero_destino: numeroNormalizado,
          p_asunto: 'Mensaje WhatsApp',
          p_cuerpo_html: mensaje,
          p_estado: success ? 'enviado' : 'fallido',
          p_error_mensaje: success ? null : JSON.stringify(wazzupData),
          p_enviado_por: null,
          p_evento_id: null,
          p_provider_response: wazzupData
        });
      } catch (logErr) {
        console.error('Error logging WhatsApp:', logErr);
      }

      console.log('=== FIN ENVÍO WHATSAPP TRANSACCIONAL ===');

      return new Response(
        JSON.stringify({
          success,
          message: success ? 'Mensaje de WhatsApp enviado exitosamente' : 'Error al enviar mensaje',
          numero_normalizado: numeroNormalizado,
          response: wazzupData
        }),
        {
          status: success ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Formato legacy (con plantillas)
    const { tipo, numero, datos, evento_id } = requestBody;

    console.log('=== INICIO ENVÍO WHATSAPP ===');
    console.log('Tipo:', tipo);
    console.log('Número recibido:', numero);
    console.log('Datos:', datos);

    const { data: config, error: configError } = await supabaseClient
      .from('whatsapp_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Error configuración:', configError);
      throw new Error('No hay configuración de WhatsApp activa');
    }

    console.log('Configuración encontrada:', {
      numero_remitente: config.numero_remitente,
      tiene_api_key: !!config.api_key
    });

    const { data: tipoNotif, error: tipoError } = await supabaseClient
      .from('correo_tipos_notificacion')
      .select('id, activo, enviar_por_whatsapp')
      .eq('codigo', tipo)
      .single();

    if (tipoError || !tipoNotif || !tipoNotif.activo || !tipoNotif.enviar_por_whatsapp) {
      console.error('Error tipo notificación:', tipoError);
      throw new Error(`Tipo de notificación '${tipo}' no está configurado para WhatsApp`);
    }

    console.log('Tipo notificación válido:', tipoNotif.id);

    const { data: plantilla, error: plantillaError } = await supabaseClient
      .from('correo_plantillas')
      .select('whatsapp_plantilla')
      .eq('tipo_notificacion_id', tipoNotif.id)
      .single();

    if (plantillaError || !plantilla || !plantilla.whatsapp_plantilla) {
      console.error('Error plantilla:', plantillaError);
      throw new Error('No se encontró plantilla de WhatsApp para este tipo de notificación');
    }

    console.log('Plantilla encontrada');

    let numeroNormalizado = numero.replace(/[^0-9]/g, '');

    if (numeroNormalizado.length === 10) {
      numeroNormalizado = '521' + numeroNormalizado;
    } else if (numeroNormalizado.length === 12 && numeroNormalizado.startsWith('52')) {
      numeroNormalizado = '521' + numeroNormalizado.substring(2);
    } else if (numeroNormalizado.length === 13 && !numeroNormalizado.startsWith('521')) {
      numeroNormalizado = '521' + numeroNormalizado.substring(3);
    }

    console.log('Número normalizado:', numeroNormalizado);

    let texto = plantilla.whatsapp_plantilla;

    datos['nombre_plataforma'] = 'MOVI Digital';
    datos['fecha'] = new Date().toLocaleDateString('es-MX');

    Object.keys(datos).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      texto = texto.replace(regex, datos[key] || '');
    });

    // IMPORTANTE: Validar longitud del mensaje
    const MAX_WHATSAPP_LENGTH = 550;
    if (texto.length > MAX_WHATSAPP_LENGTH) {
      console.warn(`⚠️ Mensaje excede ${MAX_WHATSAPP_LENGTH} caracteres (${texto.length}). Truncando...`);
      texto = texto.substring(0, MAX_WHATSAPP_LENGTH - 20) + '... [Continúa]';
    }

    console.log('Texto procesado:', texto);
    console.log('Longitud:', texto.length, 'caracteres');

    if (!config.channel_id_uuid) {
      throw new Error('El Channel ID (UUID) no está configurado');
    }

    // channelId debe ser el UUID del canal de Wazzup24
    const wazzupPayload = {
      channelId: config.channel_id_uuid,
      chatId: numeroNormalizado,
      chatType: 'whatsapp',
      text: texto
    };

    console.log('=== ENVIANDO A WAZZUP24 ===');
    console.log('URL: https://api.wazzup24.com/v3/message');
    console.log('Payload:', wazzupPayload);

    const wazzupResponse = await fetch('https://api.wazzup24.com/v3/message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wazzupPayload)
    });

    console.log('Status Wazzup24:', wazzupResponse.status);

    const responseText = await wazzupResponse.text();
    console.log('Respuesta raw:', responseText);

    let wazzupData;
    try {
      wazzupData = JSON.parse(responseText);
    } catch (e) {
      wazzupData = { raw_response: responseText };
    }

    console.log('Respuesta Wazzup24:', wazzupData);

    const success = wazzupResponse.ok;

    console.log('=== REGISTRANDO EN HISTORIAL ===');

    // IMPORTANTE: Registrar envío usando función centralizada
    try {
      await supabaseClient.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: tipo,
        p_canal_envio: 'whatsapp',
        p_usuario_id: null,
        p_destinatario_email: datos.email_laboral || datos.email || 'whatsapp@sistema.local',
        p_destinatario_nombre: datos.nombre || null,
        p_numero_destino: numeroNormalizado,
        p_asunto: `WhatsApp: ${tipo}`,
        p_cuerpo_html: texto,
        p_estado: success ? 'enviado' : 'fallido',
        p_error_mensaje: success ? null : JSON.stringify(wazzupData),
        p_enviado_por: null,
        p_evento_id: evento_id || null,
        p_provider_response: wazzupData
      });
      console.log('Historial guardado correctamente');
    } catch (historialError) {
      console.error('Error al guardar historial:', historialError);
    }

    console.log('=== FIN ENVÍO WHATSAPP ===');
    console.log('Success:', success);

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Mensaje de WhatsApp enviado exitosamente' : 'Error al enviar mensaje',
        numero_normalizado: numeroNormalizado,
        response: wazzupData,
        texto_enviado: texto
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('=== ERROR GENERAL ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);

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
