import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WAZZUP24_API_URL = 'https://api.wazzup24.com/v3/message';

interface NotificationJob {
  id: string;
  event_code: string;
  user_id: string;
  channel: 'in_app' | 'email' | 'whatsapp';
  status: string;
  payload: Record<string, any>;
  attempt_count: number;
  max_attempts: number;
}

interface UserData {
  id: string;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  email_laboral: string | null;
  email_personal: string | null;
  celular_laboral: string | null;
  celular_personal: string | null;
}

interface EventCatalog {
  event_code: string;
  event_name: string;
  template_in_app: any;
  template_email: any;
  template_whatsapp: any;
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

    const supabase = supabaseClient;

    console.log('🚀 Notification Dispatcher iniciado');

    const { data: pendingJobs, error: jobsError } = await supabase
      .from('notification_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (jobsError) {
      console.error('❌ Error obteniendo trabajos pendientes:', jobsError);
      throw jobsError;
    }

    console.log(`📋 Se encontraron ${pendingJobs?.length || 0} trabajos pendientes`);

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No hay trabajos pendientes', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const job of pendingJobs as NotificationJob[]) {
      try {
        console.log(`\n📝 Procesando job ${job.id} - Canal: ${job.channel} - Evento: ${job.event_code}`);

        await supabase
          .from('notification_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        const { data: user, error: userError } = await supabaseClient
          .from('usuarios')
          .select('id, nombre, apellidos, nombre_completo, email_laboral, email_personal, celular_laboral, celular_personal')
          .eq('id', job.user_id)
          .maybeSingle();

        if (userError || !user) {
          throw new Error(`Usuario no encontrado: ${job.user_id}`);
        }

        const { data: eventCatalog, error: eventError } = await supabase
          .from('notification_events_catalog')
          .select('*')
          .eq('event_code', job.event_code)
          .eq('active', true)
          .maybeSingle();

        if (eventError || !eventCatalog) {
          throw new Error(`Evento no encontrado o inactivo: ${job.event_code}`);
        }

        let providerMessageId: string | null = null;
        let success = false;

        if (job.channel === 'in_app') {
          console.log('  📱 Procesando notificación in-app');
          providerMessageId = await processInAppNotification(supabase, user, job, eventCatalog);
          success = true;
        } else if (job.channel === 'email') {
          console.log('  📧 Procesando notificación por email');
          providerMessageId = await processEmailNotification(supabase, user, job, eventCatalog);
          success = true;
        } else if (job.channel === 'whatsapp') {
          console.log('  📱 Procesando notificación por WhatsApp');
          providerMessageId = await processWhatsAppNotification(supabase, user, job, eventCatalog);
          success = true;
        }

        await supabase
          .from('notification_jobs')
          .update({
            status: 'sent',
            provider_message_id: providerMessageId,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        await supabase
          .from('notification_delivery_attempts')
          .insert({
            job_id: job.id,
            attempt_number: job.attempt_count + 1,
            status: 'sent',
            attempted_at: new Date().toISOString()
          });

        processed++;
        console.log(`✅ Job ${job.id} completado exitosamente`);

      } catch (error: any) {
        console.error(`❌ Error procesando job ${job.id}:`, error.message);

        const attemptCount = job.attempt_count + 1;
        const maxAttempts = job.max_attempts || 3;

        // Obtener datos del usuario para el registro
        let user: UserData | null = null;
        try {
          const { data } = await supabase
            .from('usuarios')
            .select('id, nombre, apellidos, nombre_completo, email_laboral, email_personal, celular_laboral, celular_personal')
            .eq('id', job.user_id)
            .maybeSingle();
          user = data;
        } catch (e) {
          console.error('Error obteniendo usuario para log:', e);
        }

        // Registrar el error en historial
        if (user) {
          try {
            const canalEnvio = job.channel === 'in_app' ? 'notificacion' : job.channel;
            await supabase.rpc('registrar_envio_notificacion', {
              p_tipo_notificacion_codigo: job.event_code,
              p_canal_envio: canalEnvio,
              p_usuario_id: user.id,
              p_destinatario_email: user.email_laboral || user.email_personal || 'sin-email@sistema.local',
              p_destinatario_nombre: user.nombre_completo || `${user.nombre} ${user.apellidos}`,
              p_numero_destino: job.channel === 'whatsapp' ? (user.celular_laboral || user.celular_personal) : null,
              p_asunto: `Error: ${job.event_code}`,
              p_cuerpo_html: error.message,
              p_estado: 'fallido',
              p_error_mensaje: error.message
            });
          } catch (logErr) {
            console.error('Error logging failed notification:', logErr);
          }
        }

        await supabase
          .from('notification_delivery_attempts')
          .insert({
            job_id: job.id,
            attempt_number: attemptCount,
            status: 'failed',
            error_message: error.message,
            attempted_at: new Date().toISOString()
          });

        if (attemptCount >= maxAttempts) {
          await supabase
            .from('notification_jobs')
            .update({
              status: 'failed',
              last_error: error.message,
              attempt_count: attemptCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
          failed++;
        } else {
          const nextRetryMinutes = Math.pow(2, attemptCount);
          const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60000).toISOString();

          await supabase
            .from('notification_jobs')
            .update({
              status: 'pending',
              last_error: error.message,
              attempt_count: attemptCount,
              next_retry_at: nextRetryAt,
              updated_at: new Date().toISOString()
            })
            .eq('id', job.id);
        }
      }
    }

    console.log(`\n✅ Procesamiento completado: ${processed} exitosos, ${failed} fallidos`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingJobs.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error general:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processInAppNotification(
  supabase: any,
  user: UserData,
  job: NotificationJob,
  event: EventCatalog
): Promise<string> {
  const template = event.template_in_app || {};

  let titulo = template.titulo || 'Nueva notificación';
  let mensaje = template.mensaje || '';
  let accionUrl = template.accion_url || null;

  Object.keys(job.payload).forEach(key => {
    const value = job.payload[key];
    titulo = titulo.replace(new RegExp(`{{${key}}}`, 'g'), value);
    mensaje = mensaje.replace(new RegExp(`{{${key}}}`, 'g'), value);
    if (accionUrl) {
      accionUrl = accionUrl.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
  });

  titulo = titulo.replace(/{{nombre}}/g, user.nombre || '');
  mensaje = mensaje.replace(/{{nombre}}/g, user.nombre || '');

  const { data, error } = await supabase
    .from('notificaciones')
    .insert({
      usuario_id: user.id,
      titulo,
      mensaje,
      tipo: 'info',
      modulo: job.payload.modulo || event.module || 'Sistema',
      accion_url: accionUrl,
      url: accionUrl,
      leida: false,
      prioridad: 'normal'
    })
    .select('id')
    .single();

  if (error) throw error;

  console.log(`  ✓ Notificación in-app creada: ${data.id}`);

  // Registrar en historial
  await supabase.rpc('registrar_envio_notificacion', {
    p_tipo_notificacion_codigo: job.event_code,
    p_canal_envio: 'notificacion',
    p_usuario_id: user.id,
    p_destinatario_email: user.email_laboral || user.email_personal || 'sin-email@sistema.local',
    p_destinatario_nombre: user.nombre_completo || `${user.nombre} ${user.apellidos}`,
    p_asunto: titulo,
    p_cuerpo_html: mensaje,
    p_estado: 'enviado'
  });

  return data.id;
}

async function processEmailNotification(
  supabase: any,
  user: UserData,
  job: NotificationJob,
  event: EventCatalog
): Promise<string> {
  const email = user.email_laboral || user.email_personal;
  if (!email) {
    throw new Error('Usuario no tiene email configurado');
  }

  const template = event.template_email || {};
  let asunto = template.asunto || 'Notificación MOVI Digital';

  const { data: plantilla } = await supabase
    .from('correo_plantillas')
    .select('html_cuerpo')
    .eq('tipo_notificacion_id', (await supabase
      .from('correo_tipos_notificacion')
      .select('id')
      .eq('codigo', job.event_code)
      .maybeSingle()
    )?.data?.id)
    .maybeSingle();

  let cuerpoHtml = plantilla?.html_cuerpo || '<p>{{mensaje}}</p>';

  Object.keys(job.payload).forEach(key => {
    const value = job.payload[key];
    asunto = asunto.replace(new RegExp(`{{${key}}}`, 'g'), value);
    cuerpoHtml = cuerpoHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  cuerpoHtml = cuerpoHtml.replace(/{{nombre}}/g, user.nombre || '');
  asunto = asunto.replace(/{{nombre}}/g, user.nombre || '');

  const startTime = Date.now();

  // Preparar adjuntos si existen
  const emailPayload: any = {
    to: email,
    subject: asunto,
    html: cuerpoHtml
  };

  if (job.attachments && Array.isArray(job.attachments) && job.attachments.length > 0) {
    emailPayload.attachments = job.attachments;
    console.log(`  📎 Including ${job.attachments.length} attachments`);
  }

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-direct-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(emailPayload)
    }
  );

  const responseTime = Date.now() - startTime;
  const result = await response.json();

  await supabase
    .from('notification_provider_logs')
    .insert({
      job_id: job.id,
      provider: 'resend',
      provider_message_id: result.resend_id || null,
      request_payload: { email, subject: asunto },
      response_payload: result,
      http_status: response.status,
      success: response.ok,
      error_message: response.ok ? null : result.error,
      response_time_ms: responseTime
    });

  if (!response.ok) {
    throw new Error(result.error || 'Error enviando email');
  }

  console.log(`  ✓ Email enviado a ${email}`);

  // Registrar en historial
  await supabase.rpc('registrar_envio_notificacion', {
    p_tipo_notificacion_codigo: job.event_code,
    p_canal_envio: 'correo',
    p_usuario_id: user.id,
    p_destinatario_email: email,
    p_destinatario_nombre: user.nombre_completo || `${user.nombre} ${user.apellidos}`,
    p_asunto: asunto,
    p_cuerpo_html: cuerpoHtml,
    p_estado: 'enviado',
    p_provider_response: { resend_id: result.resend_id, response_time_ms: responseTime }
  });

  return result.resend_id || result.id || '';
}

async function processWhatsAppNotification(
  supabase: any,
  user: UserData,
  job: NotificationJob,
  event: EventCatalog
): Promise<string> {
  const phone = user.celular_laboral || user.celular_personal;
  if (!phone) {
    throw new Error('Usuario no tiene teléfono configurado');
  }

  const { data: plantilla } = await supabase
    .from('correo_plantillas')
    .select('whatsapp_plantilla')
    .eq('tipo_notificacion_id', (await supabase
      .from('correo_tipos_notificacion')
      .select('id')
      .eq('codigo', job.event_code)
      .maybeSingle()
    )?.data?.id)
    .maybeSingle();

  let mensaje = plantilla?.whatsapp_plantilla || '{{nombre}}, tienes una nueva notificación en MOVI Digital.';

  Object.keys(job.payload).forEach(key => {
    const value = job.payload[key];
    mensaje = mensaje.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  mensaje = mensaje.replace(/{{nombre}}/g, user.nombre || '');

  // IMPORTANTE: Validar longitud del mensaje
  const MAX_WHATSAPP_LENGTH = 550;
  if (mensaje.length > MAX_WHATSAPP_LENGTH) {
    console.warn(`⚠️ Mensaje excede ${MAX_WHATSAPP_LENGTH} caracteres (${mensaje.length}). Truncando...`);
    mensaje = mensaje.substring(0, MAX_WHATSAPP_LENGTH - 20) + '... [Continúa]';
  }

  const { data: whatsappConfig } = await supabase
    .from('whatsapp_configuracion')
    .select('api_key, channel_id_uuid')
    .eq('activo', true)
    .single();

  if (!whatsappConfig || !whatsappConfig.api_key || !whatsappConfig.channel_id_uuid) {
    throw new Error('Configuración de WhatsApp no encontrada o incompleta');
  }

  let normalizedPhone = phone.replace(/[^0-9]/g, '');
  if (normalizedPhone.length === 10) {
    normalizedPhone = '521' + normalizedPhone;
  }

  console.log(`  📱 Enviando a: ${normalizedPhone} (${mensaje.length} chars)`);

  const startTime = Date.now();

  const response = await fetch(WAZZUP24_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${whatsappConfig.api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channelId: whatsappConfig.channel_id_uuid,
      chatId: normalizedPhone + '@c.us',
      chatType: 'whatsapp',
      text: mensaje
    })
  });

  const responseTime = Date.now() - startTime;
  const result = await response.json().catch(() => ({}));

  await supabase
    .from('notification_provider_logs')
    .insert({
      job_id: job.id,
      provider: 'wazzup24',
      provider_message_id: result.messageId || null,
      request_payload: { phone: normalizedPhone, message: mensaje },
      response_payload: result,
      http_status: response.status,
      success: response.ok,
      error_message: response.ok ? null : JSON.stringify(result),
      response_time_ms: responseTime
    });

  if (!response.ok) {
    throw new Error(`Error enviando WhatsApp: ${JSON.stringify(result)}`);
  }

  console.log(`  ✓ WhatsApp enviado a ${normalizedPhone}`);

  // Registrar en historial
  await supabase.rpc('registrar_envio_notificacion', {
    p_tipo_notificacion_codigo: job.event_code,
    p_canal_envio: 'whatsapp',
    p_usuario_id: user.id,
    p_destinatario_email: user.email_laboral || user.email_personal || 'sin-email@sistema.local',
    p_destinatario_nombre: user.nombre_completo || `${user.nombre} ${user.apellidos}`,
    p_numero_destino: normalizedPhone,
    p_asunto: 'Mensaje WhatsApp',
    p_cuerpo_html: mensaje,
    p_estado: 'enviado',
    p_provider_response: { messageId: result.messageId, response_time_ms: responseTime }
  });

  return result.messageId || '';
}
