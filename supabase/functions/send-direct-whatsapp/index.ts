import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getWhatsappApiKey } from "../_shared/emailCredentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WhatsAppRequest {
  phone: string;
  message: string;
}

// ── Quién puede mandar ──────────────────────────────────────────────────────
// Esta función manda mensajes con el remitente de la empresa a cualquier
// destinatario, así que solo la usan: otras funciones del servidor (con la
// llave de servidor, en `Authorization: Bearer` o en `apikey`) y usuarios
// activos de MOVI con su sesión. La llave pública de la app no alcanza.
function llavesDeServidor(): string[] {
  const keys: string[] = [];
  try {
    const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
    if (raw) for (const v of Object.values(JSON.parse(raw) as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length > 0) keys.push(v);
    }
  } catch { /* ausente o mal formada */ }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) keys.push(legacy);
  return keys;
}

async function verificarLlamante(req: Request): Promise<boolean> {
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const apikey = (req.headers.get('apikey') || '').trim();
  const llaves = llavesDeServidor();
  if (llaves.some((k) => k === bearer || k === apikey)) return true;
  if (!bearer) return false;
  const { createClient: crear } = await import('npm:@supabase/supabase-js@2.57.4');
  const admin = crear(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data } = await admin.auth.getUser(bearer);
  if (!data?.user) return false;
  const { data: u } = await admin.from('usuarios').select('activo').eq('id', data.user.id).maybeSingle();
  return !!u?.activo;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!(await verificarLlamante(req))) {
    return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phone, message } = await req.json() as WhatsAppRequest;

    console.log('=== SEND DIRECT WHATSAPP ===');
    console.log('Phone received:', phone);
    console.log('Message length:', message?.length);

    if (!phone || !message) {
      throw new Error('Missing required fields: phone, message');
    }

    const { data: config, error: configError } = await supabaseClient
      .from('whatsapp_configuracion')
      .select('id, channel_id_uuid')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Config error:', configError);
      throw new Error('No active WhatsApp configuration found');
    }
    const apiKey = await getWhatsappApiKey(supabaseClient, config.id);
    if (!apiKey) throw new Error('WhatsApp API key is not configured');

    console.log('Config found. Channel ID:', config.channel_id_uuid);

    let normalizedPhone = phone.replace(/[^0-9]/g, '');

    if (normalizedPhone.length === 10) {
      normalizedPhone = '521' + normalizedPhone;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('52')) {
      normalizedPhone = '521' + normalizedPhone.substring(2);
    } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith('521')) {
      normalizedPhone = '521' + normalizedPhone.substring(3);
    }

    console.log('Normalized phone:', normalizedPhone);

    if (!config.channel_id_uuid) {
      throw new Error('Channel ID (UUID) is not configured');
    }

    const wazzupPayload = {
      channelId: config.channel_id_uuid,
      chatId: normalizedPhone,
      chatType: 'whatsapp',
      text: message
    };

    console.log('Sending to Wazzup24...');

    const wazzupResponse = await fetch('https://api.wazzup24.com/v3/message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(wazzupPayload)
    });

    console.log('Wazzup24 status:', wazzupResponse.status);

    const responseText = await wazzupResponse.text();
    let wazzupData;
    try {
      wazzupData = JSON.parse(responseText);
    } catch (e) {
      wazzupData = { raw_response: responseText };
    }

    console.log('Wazzup24 response:', wazzupData);

    const success = wazzupResponse.ok;

    console.log('Success:', success);

    // IMPORTANTE: Registrar envío en historial
    console.log('Registering WhatsApp in history...');
    try {
      await supabaseClient.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: 'whatsapp_directo',
        p_canal_envio: 'whatsapp',
        p_usuario_id: null,
        p_destinatario_email: 'whatsapp@sistema.local',
        p_destinatario_nombre: null,
        p_numero_destino: normalizedPhone,
        p_asunto: 'Mensaje WhatsApp',
        p_cuerpo_html: message,
        p_estado: success ? 'enviado' : 'fallido',
        p_error_mensaje: success ? null : JSON.stringify(wazzupData),
        p_enviado_por: null,
        p_evento_id: null,
        p_provider_response: wazzupData
      });
      console.log('WhatsApp logged successfully');
    } catch (logErr) {
      console.error('Exception logging WhatsApp:', logErr);
    }

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'WhatsApp message sent successfully' : 'Error sending WhatsApp message',
        normalized_phone: normalizedPhone,
        response: wazzupData
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('=== ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);

    // Registrar el error en historial
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { phone, message } = await req.json();

      await supabaseClient.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: 'whatsapp_directo',
        p_canal_envio: 'whatsapp',
        p_usuario_id: null,
        p_destinatario_email: 'whatsapp@sistema.local',
        p_destinatario_nombre: null,
        p_numero_destino: phone || 'unknown',
        p_asunto: 'Mensaje WhatsApp',
        p_cuerpo_html: message || '',
        p_estado: 'fallido',
        p_error_mensaje: error.message,
        p_enviado_por: null,
        p_evento_id: null,
        p_provider_response: null
      });
    } catch (logErr) {
      console.error('Error logging failed WhatsApp:', logErr);
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
