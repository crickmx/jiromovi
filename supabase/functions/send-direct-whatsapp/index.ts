import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WhatsAppRequest {
  phone: string;
  message: string;
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

    const { phone, message } = await req.json() as WhatsAppRequest;

    console.log('=== SEND DIRECT WHATSAPP ===');
    console.log('Phone received:', phone);
    console.log('Message length:', message?.length);

    if (!phone || !message) {
      throw new Error('Missing required fields: phone, message');
    }

    const { data: config, error: configError } = await supabaseClient
      .from('whatsapp_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Config error:', configError);
      throw new Error('No active WhatsApp configuration found');
    }

    console.log('Config found. Channel ID:', config.channel_id_uuid);

    let normalizedPhone = phone.replace(/[^0-9]/g, '');

    if (normalizedPhone.length === 10) {
      normalizedPhone = '521' + normalizedPhone;
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
        'Authorization': `Bearer ${config.api_key}`,
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
