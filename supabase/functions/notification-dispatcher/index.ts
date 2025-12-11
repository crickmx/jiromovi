import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WAZZUP24_API_KEY = 'aeaecead58f14a3286b37e4d0b81dc3a';
const WAZZUP24_CHANNEL = '5215588545516';
const WAZZUP24_API_URL = 'https://api.wazzup24.com/v3/messages';

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
  correo_electronico_laboral: string | null;
  correo_electronico: string | null;
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

    console.log('🚀 Notification Dispatcher iniciado');

    const { data: jobs, error: jobsError } = await supabaseClient
      .from('notification_jobs')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (jobsError) {
      console.error('Error obteniendo jobs:', jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay jobs pendientes',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 ${jobs.length} jobs pendientes encontrados`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const job of jobs as NotificationJob[]) {
      processedCount++;
      console.log(`\n🔄 Procesando job ${job.id} - Canal: ${job.channel} - Evento: ${job.event_code}`);

      try {
        await supabaseClient
          .from('notification_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        const { data: user, error: userError } = await supabaseClient
          .from('usuarios')
          .select('id, nombre, apellidos, nombre_completo, correo_electronico_laboral, correo_electronico, celular_laboral, celular_personal')
          .eq('id', job.user_id)
          .single();

        if (userError || !user) {
          throw new Error(`Usuario no encontrado: ${job.user_id}`);
        }

        const { data: event, error: eventError } = await supabaseClient
          .from('notification_events_catalog')
          .select('*')
          .eq('event_code', job.event_code)
          .single();

        if (eventError || !event) {
          throw new Error(`Evento no encontrado: ${job.event_code}`);
        }

        let deliveryResult;

        if (job.channel === 'in_app') {
          deliveryResult = await processInAppNotification(supabaseClient, job, user as UserData, event as EventCatalog);
        } else if (job.channel === 'email') {
          deliveryResult = await processEmailNotification(supabaseClient, job, user as UserData, event as EventCatalog);
        } else if (job.channel === 'whatsapp') {
          deliveryResult = await processWhatsAppNotification(supabaseClient, job, user as UserData, event as EventCatalog);
        } else {
          throw new Error(`Canal desconocido: ${job.channel}`);
        }

        await supabaseClient
          .from('notification_delivery_attempts')
          .insert({
            job_id: job.id,
            attempt_number: job.attempt_count + 1,
            status: 'sent'
          });

        await supabaseClient
          .from('notification_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempt_count: job.attempt_count + 1,
            provider_message_id: deliveryResult.provider_message_id || null
          })
          .eq('id', job.id);

        successCount++;
        console.log(`✅ Job ${job.id} completado exitosamente`);

      } catch (error: any) {
        console.error(`❌ Error procesando job ${job.id}:`, error.message);

        const newAttemptCount = job.attempt_count + 1;

        await supabaseClient
          .from('notification_delivery_attempts')
          .insert({
            job_id: job.id,
            attempt_number: newAttemptCount,
            status: 'failed',
            error_message: error.message
          });

        if (newAttemptCount >= job.max_attempts) {
          await supabaseClient
            .from('notification_jobs')
            .update({
              status: 'failed',
              attempt_count: newAttemptCount,
              last_error: error.message
            })
            .eq('id', job.id);

          console.log(`⚠️ Job ${job.id} marcado como fallido definitivamente`);
        } else {
          const backoffMinutes = Math.pow(2, newAttemptCount) * 5;
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabaseClient
            .from('notification_jobs')
            .update({
              status: 'pending',
              attempt_count: newAttemptCount,
              last_error: error.message,
              next_retry_at: nextRetry.toISOString()
            })
            .eq('id', job.id);

          console.log(`🔄 Job ${job.id} programado para reintento en ${backoffMinutes} minutos`);
        }

        failedCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Resumen: ${processedCount} procesados | ${successCount} exitosos | ${failedCount} fallidos`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        successful: successCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error fatal en dispatcher:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processInAppNotification(
  supabase: any,
  job: NotificationJob,
  user: UserData,
  event: EventCatalog
): Promise<{ provider_message_id?: string }> {
  console.log('  📱 Procesando notificación in-app');

  const template = event.template_in_app || {};
  const titulo = renderTemplate(template.titulo || 'Notificación', { ...job.payload, nombre: user.nombre });
  const mensaje = renderTemplate(template.mensaje || '', { ...job.payload, nombre: user.nombre });
  const accionUrl = renderTemplate(template.accion_url || '', job.payload);

  const { data, error } = await supabase
    .from('notificaciones')
    .insert({
      usuario_id: user.id,
      titulo,
      mensaje,
      tipo: 'info',
      modulo: job.payload.modulo || 'Sistema',
      accion_url: accionUrl || null,
      leida: false,
      prioridad: 'normal'
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('notification_provider_logs')
    .insert({
      job_id: job.id,
      provider: 'internal',
      provider_message_id: data.id,
      request_payload: { titulo, mensaje, accionUrl },
      response_payload: data,
      success: true
    });

  return { provider_message_id: data.id };
}

async function processEmailNotification(
  supabase: any,
  job: NotificationJob,
  user: UserData,
  event: EventCatalog
): Promise<{ provider_message_id?: string }> {
  console.log('  📧 Procesando notificación por email');

  const email = user.correo_electronico_laboral || user.correo_electronico;
  if (!email) {
    throw new Error('Usuario no tiene email configurado');
  }

  const enrichedData = {
    ...job.payload,
    nombre: user.nombre,
    apellidos: user.apellidos,
    nombre_completo: user.nombre_completo,
    email
  };

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const startTime = Date.now();

  const response = await fetch(`${supabaseUrl}/functions/v1/enviar-correo-transaccional`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      tipo: job.event_code,
      destinatario: email,
      datos: enrichedData
    })
  });

  const responseTime = Date.now() - startTime;
  const result = await response.json();

  await supabase
    .from('notification_provider_logs')
    .insert({
      job_id: job.id,
      provider: 'resend',
      provider_message_id: result.resend_id || null,
      request_payload: { tipo: job.event_code, destinatario: email },
      response_payload: result,
      http_status: response.status,
      success: response.ok,
      error_message: response.ok ? null : result.error,
      response_time_ms: responseTime
    });

  if (!response.ok) {
    throw new Error(result.error || 'Error enviando email');
  }

  return { provider_message_id: result.resend_id };
}

async function processWhatsAppNotification(
  supabase: any,
  job: NotificationJob,
  user: UserData,
  event: EventCatalog
): Promise<{ provider_message_id?: string }> {
  console.log('  📱 Procesando notificación por WhatsApp');

  const phone = user.celular_laboral || user.celular_personal;
  if (!phone) {
    throw new Error('Usuario no tiene teléfono configurado');
  }

  const enrichedData = {
    ...job.payload,
    nombre: user.nombre,
    apellidos: user.apellidos,
    nombre_completo: user.nombre_completo
  };

  let whatsappMessage = '';

  const { data: plantilla } = await supabase
    .from('correo_plantillas')
    .select('whatsapp_plantilla')
    .eq('tipo_notificacion_codigo', job.event_code)
    .single();

  if (plantilla && plantilla.whatsapp_plantilla) {
    whatsappMessage = renderTemplate(plantilla.whatsapp_plantilla, enrichedData);
  } else {
    whatsappMessage = `Hola ${user.nombre},\n\n${job.payload.titulo || 'Nueva notificación'}\n\n${job.payload.mensaje || ''}`;
  }

  const normalizedPhone = phone.startsWith('+52') ? phone.replace('+52', '52') : phone.replace(/[^0-9]/g, '');

  const startTime = Date.now();

  const response = await fetch(WAZZUP24_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAZZUP24_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channelId: WAZZUP24_CHANNEL,
      chatId: normalizedPhone + '@c.us',
      chatType: 'whatsapp',
      text: whatsappMessage
    })
  });

  const responseTime = Date.now() - startTime;
  const result = await response.json();

  await supabase
    .from('notification_provider_logs')
    .insert({
      job_id: job.id,
      provider: 'wazzup24',
      provider_message_id: result.messageId || null,
      request_payload: { phone: normalizedPhone, message: whatsappMessage },
      response_payload: result,
      http_status: response.status,
      success: response.ok,
      error_message: response.ok ? null : result.error,
      response_time_ms: responseTime
    });

  if (!response.ok) {
    throw new Error(result.error || 'Error enviando WhatsApp');
  }

  return { provider_message_id: result.messageId };
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;

  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, data[key] || '');
  });

  return result;
}