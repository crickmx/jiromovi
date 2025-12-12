import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WAZZUP24_API_URL = 'https://api.wazzup24.com/v3/message';

interface NotificationJob {
  id: string;
  user_id: string;
  event_catalog_id: string;
  notification_type_code: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  scheduled_at: string;
  processed_at?: string;
  error_message?: string;
}

interface User {
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
  id: string;
  event_code: string;
  event_name: string;
  description: string;
  default_priority: string;
  default_channels: string[];
}

interface NotificationTemplate {
  id: string;
  email_subject?: string;
  email_body_html?: string;
  whatsapp_template?: string;
  in_app_title?: string;
  in_app_message?: string;
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

    const now = new Date().toISOString();

    const { data: pendingJobs, error: jobsError } = await supabase
      .from('transactional_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50);

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
        console.log(`\n📝 Procesando trabajo ${job.id}`);

        await supabase
          .from('transactional_notification_queue')
          .update({ status: 'processing' })
          .eq('id', job.id);

        const { data: user, error: userError } = await supabaseClient
          .from('usuarios')
          .select('id, nombre, apellidos, nombre_completo, email_laboral, email_personal, celular_laboral, celular_personal')
          .eq('id', job.user_id)
          .single();

        if (userError || !user) {
          throw new Error(`Usuario no encontrado: ${job.user_id}`);
        }

        const { data: eventCatalog, error: eventError } = await supabase
          .from('transactional_event_catalog')
          .select('*')
          .eq('id', job.event_catalog_id)
          .single();

        if (eventError || !eventCatalog) {
          throw new Error(`Evento no encontrado en catálogo: ${job.event_catalog_id}`);
        }

        const { data: template, error: templateError } = await supabase
          .from('transactional_notification_templates')
          .select('*')
          .eq('event_catalog_id', job.event_catalog_id)
          .eq('active', true)
          .maybeSingle();

        if (templateError) {
          console.warn('⚠️ Error obteniendo plantilla:', templateError);
        }

        const channels = eventCatalog.default_channels || [];
        console.log(`📡 Canales a procesar:`, channels);

        const results: any = {};

        if (channels.includes('in_app')) {
          console.log('  📱 Procesando notificación in-app');
          try {
            const inAppResult = await processInAppNotification(supabase, user, job, template);
            results.in_app = inAppResult;
          } catch (error: any) {
            console.error('  ❌ Error en notificación in-app:', error.message);
            results.in_app = { error: error.message };
          }
        }

        if (channels.includes('email')) {
          console.log('  📧 Procesando notificación por email');
          try {
            const emailResult = await processEmailNotification(supabase, user, job, template);
            results.email = emailResult;
          } catch (error: any) {
            console.error('  ❌ Error en email:', error.message);
            results.email = { error: error.message };
          }
        }

        if (channels.includes('whatsapp')) {
          console.log('  📱 Procesando notificación por WhatsApp');
          try {
            const whatsappResult = await processWhatsAppNotification(supabase, user, job, template);
            results.whatsapp = whatsappResult;
          } catch (error: any) {
            console.error('  ❌ Error en WhatsApp:', error.message);
            results.whatsapp = { error: error.message };
          }
        }

        await supabase
          .from('transactional_notification_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', job.id);

        processed++;
        console.log(`✅ Trabajo ${job.id} completado exitosamente`);

      } catch (error: any) {
        console.error(`❌ Error procesando trabajo ${job.id}:`, error.message);
        
        const retryCount = job.retry_count + 1;
        const maxRetries = 3;

        if (retryCount >= maxRetries) {
          await supabase
            .from('transactional_notification_queue')
            .update({
              status: 'failed',
              error_message: error.message,
              retry_count: retryCount
            })
            .eq('id', job.id);
          failed++;
        } else {
          await supabase
            .from('transactional_notification_queue')
            .update({
              status: 'pending',
              error_message: error.message,
              retry_count: retryCount,
              scheduled_at: new Date(Date.now() + (retryCount * 60000)).toISOString()
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
  user: User,
  job: NotificationJob,
  template: NotificationTemplate | null
): Promise<{ notification_id: string }> {
  console.log('  📱 Procesando notificación in-app');

  const title = template?.in_app_title || job.payload.title || 'Nueva notificación';
  const message = template?.in_app_message || job.payload.message || '';

  let finalTitle = title;
  let finalMessage = message;

  if (job.payload) {
    Object.keys(job.payload).forEach(key => {
      const value = job.payload[key];
      finalTitle = finalTitle.replace(new RegExp(`{{${key}}}`, 'g'), value);
      finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
  }

  const { data: notification, error } = await supabase
    .from('notificaciones')
    .insert({
      usuario_id: user.id,
      titulo: finalTitle,
      mensaje: finalMessage,
      tipo: job.payload.priority || 'info',
      modulo: job.payload.module || 'Sistema',
      accion_url: job.payload.action_url || null,
      leida: false,
      prioridad: job.payload.priority || 'normal'
    })
    .select('id')
    .single();

  if (error) throw error;

  console.log(`  ✓ Notificación in-app creada: ${notification.id}`);

  await supabase
    .from('transactional_notification_logs')
    .insert({
      queue_id: job.id,
      channel: 'in_app',
      status: 'sent',
      sent_at: new Date().toISOString()
    });

  return { notification_id: notification.id };
}

async function processEmailNotification(
  supabase: any,
  user: User,
  job: NotificationJob,
  template: NotificationTemplate | null
): Promise<{ message_id?: string }> {
  console.log('  📧 Procesando notificación por email');

  const email = user.email_laboral || user.email_personal;
  if (!email) {
    throw new Error('Usuario no tiene email configurado');
  }

  const subject = template?.email_subject || job.payload.subject || 'Notificación MOVI Digital';
  const body = template?.email_body_html || job.payload.message || '';

  let finalSubject = subject;
  let finalBody = body;

  if (job.payload) {
    Object.keys(job.payload).forEach(key => {
      const value = job.payload[key];
      finalSubject = finalSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      finalBody = finalBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
  }

  const startTime = Date.now();

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-direct-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        to: email,
        subject: finalSubject,
        html: finalBody
      })
    }
  );

  const responseTime = Date.now() - startTime;
  const result = await response.json();

  await supabase
    .from('transactional_notification_logs')
    .insert({
      queue_id: job.id,
      channel: 'email',
      status: response.ok ? 'sent' : 'failed',
      provider: 'resend',
      provider_message_id: result.messageId || null,
      request_payload: { email, subject: finalSubject },
      response_payload: result,
      http_status: response.status,
      response_time_ms: responseTime,
      sent_at: response.ok ? new Date().toISOString() : null,
      error_message: response.ok ? null : result.error
    });

  if (!response.ok) {
    throw new Error(result.error || 'Error enviando email');
  }

  console.log(`  ✓ Email enviado a ${email}`);
  return { message_id: result.messageId };
}

async function processWhatsAppNotification(
  supabase: any,
  user: User,
  job: NotificationJob,
  template: NotificationTemplate | null
): Promise<{ provider_message_id?: string }> {
  console.log('  📱 Procesando notificación por WhatsApp');

  const phone = user.celular_laboral || user.celular_personal;
  if (!phone) {
    throw new Error('Usuario no tiene teléfono configurado');
  }

  const message = template?.whatsapp_template || job.payload.message || '';

  let finalMessage = message;

  if (job.payload) {
    Object.keys(job.payload).forEach(key => {
      const value = job.payload[key];
      finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
  }

  finalMessage += '\n\n---\n📱 *MOVI Digital*\nTu plataforma de gestión integral';

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

  console.log(`  📱 Número normalizado: ${normalizedPhone} (original: ${phone})`);

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
      text: finalMessage
    })
  });

  const responseTime = Date.now() - startTime;
  const result = await response.json().catch(() => ({}));

  await supabase
    .from('transactional_notification_logs')
    .insert({
      queue_id: job.id,
      channel: 'whatsapp',
      status: response.ok ? 'sent' : 'failed',
      provider: 'wazzup24',
      provider_message_id: result.messageId || null,
      request_payload: { phone: normalizedPhone, message: finalMessage },
      response_payload: result,
      http_status: response.status,
      response_time_ms: responseTime,
      sent_at: response.ok ? new Date().toISOString() : null,
      error_message: response.ok ? null : JSON.stringify(result)
    });

  if (!response.ok) {
    throw new Error(`Error enviando WhatsApp: ${JSON.stringify(result)}`);
  }

  console.log(`  ✓ WhatsApp enviado a ${normalizedPhone}`);
  return { provider_message_id: result.messageId };
}
