import { createClient } from 'npm:@supabase/supabase-js@2';
import { createSicasRestClientWithDbAuth } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GetDigitalFilesRequest {
  idDocto: string;
  identity?: string;
  valuePK?: string;
  skipCache?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: GetDigitalFilesRequest = await req.json();

    if (!body.idDocto) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'idDocto es requerido',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { idDocto, identity = 'Documento', valuePK, skipCache = false } = body;
    const actualValuePK = valuePK || idDocto;

    console.log('[Digital Files] Solicitando archivos para:', idDocto);
    console.log('[Digital Files] Identity:', identity, 'ValuePK:', actualValuePK);

    if (!skipCache) {
      const { data: cached, error: cacheError } = await supabase
        .from('sicas_digital_cache')
        .select('*')
        .eq('id_docto', idDocto)
        .eq('identity_type', identity)
        .eq('value_pk', actualValuePK)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (cached && !cacheError) {
        console.log('[Digital Files] ✅ Cache hit:', idDocto);
        return new Response(
          JSON.stringify({
            success: true,
            files: cached.files,
            cached: true,
            cached_at: cached.cached_at,
            expires_at: cached.expires_at,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('[Digital Files] Cache miss, consultando SICAS...');
    } else {
      console.log('[Digital Files] Omitiendo cache, consultando SICAS directamente...');
    }

    const client = await createSicasRestClientWithDbAuth();

    const response = await client.getDigitalFiles({
      identity,
      valuePK: actualValuePK,
    });

    if (!response.Sucess) {
      const sicasMsg = response.Error || response.Message || '';
      console.warn('[Digital Files] SICAS respondio sin exito:', sicasMsg);

      const isNotFound = sicasMsg.toLowerCase().includes('no se localizo')
        || sicasMsg.toLowerCase().includes('not found');

      if (isNotFound) {
        return new Response(
          JSON.stringify({
            success: true,
            files: [],
            cached: false,
            sicas_message: sicasMsg,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: sicasMsg || 'Error desconocido',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const files = response.Files || [];
    console.log('[Digital Files] Archivos obtenidos:', files.length);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { error: upsertError } = await supabase
      .from('sicas_digital_cache')
      .upsert({
        id_docto: idDocto,
        identity_type: identity,
        value_pk: actualValuePK,
        files: files,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'id_docto,identity_type,value_pk',
      });

    if (upsertError) {
      console.error('[Digital Files] Error guardando en cache:', upsertError);
    } else {
      console.log('[Digital Files] ✅ Cache actualizado');
    }

    return new Response(
      JSON.stringify({
        success: true,
        files,
        cached: false,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Digital Files] ❌ Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        stack: (error as Error).stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
