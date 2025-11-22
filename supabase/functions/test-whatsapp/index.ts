import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestWhatsAppRequest {
  numero: string;
  mensaje: string;
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

    const { numero, mensaje } = await req.json() as TestWhatsAppRequest;

    console.log('=== TEST WHATSAPP ===');
    console.log('Número:', numero);
    console.log('Mensaje:', mensaje);

    const { data: config, error: configError } = await supabaseClient
      .from('whatsapp_configuracion')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      console.error('Error configuración:', configError);
      throw new Error('No hay configuración de WhatsApp activa');
    }

    console.log('Configuración encontrada');

    let numeroNormalizado = numero.replace(/[^0-9]/g, '');

    if (numeroNormalizado.length === 10) {
      numeroNormalizado = '52' + numeroNormalizado;
    }

    console.log('Número normalizado:', numeroNormalizado);

    const wazzupPayload = {
      channelId: config.numero_remitente,
      phone: numeroNormalizado,
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

    console.log('Status:', wazzupResponse.status);

    const responseText = await wazzupResponse.text();
    console.log('Respuesta:', responseText);

    let wazzupData;
    try {
      wazzupData = JSON.parse(responseText);
    } catch (e) {
      wazzupData = { raw_response: responseText };
    }

    const success = wazzupResponse.ok;

    const { error: updateError } = await supabaseClient
      .from('whatsapp_configuracion')
      .update({
        ultima_prueba: new Date().toISOString(),
        estado_ultima_prueba: success ? 'Exitoso' : 'Fallido'
      })
      .eq('id', config.id);

    if (updateError) {
      console.error('Error al actualizar config:', updateError);
    }

    console.log('=== FIN TEST ===');

    return new Response(
      JSON.stringify({
        success,
        message: success ? 'Mensaje enviado exitosamente' : 'Error al enviar mensaje',
        numero_normalizado: numeroNormalizado,
        response: wazzupData
      }),
      {
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error:', error);

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
