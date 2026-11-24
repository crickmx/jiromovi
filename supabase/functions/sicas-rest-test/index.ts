import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClientWithDbAuth } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasRestUrl = Deno.env.get('SICAS_REST_API_URL');

    console.log('[SICAS REST Test] Iniciando prueba de conexión...');
    console.log('[SICAS REST Test] URL:', sicasRestUrl);

    const client = await createSicasRestClientWithDbAuth();
    const result = await client.testConnection();

    console.log('[SICAS REST Test] Resultado:', result);

    const { error: updateError } = await supabase
      .from('sicas_config')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_success: result.success,
        last_test_message: result.message,
      })
      .eq('endpoint', sicasRestUrl || 'https://security-services.sicasonline.info/api');

    if (updateError) {
      console.error('[SICAS REST Test] Error actualizando config:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        connectionSuccess: result.success,
        message: result.message,
        apiType: 'REST',
        endpoint: sicasRestUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SICAS REST Test] Exception:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
