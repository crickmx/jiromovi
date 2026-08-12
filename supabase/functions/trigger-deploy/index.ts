import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Authorization required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return json({ error: 'Invalid token' }, 401);

    const { data: usuarioData } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (usuarioData?.rol !== 'Administrador') {
      return json({ error: 'Solo Administrador puede disparar un deploy' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const target = body.target;
    if (target !== 'beta' && target !== 'produccion') {
      return json({ error: 'target debe ser "beta" o "produccion"' }, 400);
    }

    const webhookUrl = target === 'beta'
      ? Deno.env.get('PLESK_WEBHOOK_BETA_URL')
      : Deno.env.get('PLESK_WEBHOOK_PRODUCCION_URL');

    if (!webhookUrl) {
      return json({ error: `Falta configurar el webhook de "${target}" en Supabase (Edge Functions > Secrets)` }, 500);
    }

    let resp: Response;
    try {
      resp = await fetch(webhookUrl, { method: 'GET' });
    } catch (fetchErr: any) {
      await supabaseAdmin.from('deploy_triggers').insert({
        usuario_id: user.id, target, status_code: null, ok: false,
      });
      return json({ error: 'No se pudo contactar a Plesk: ' + fetchErr.message }, 502);
    }

    const bodyText = await resp.text().catch(() => '');

    await supabaseAdmin.from('deploy_triggers').insert({
      usuario_id: user.id,
      target,
      status_code: resp.status,
      ok: resp.ok,
    });

    if (!resp.ok) {
      return json({ error: `Plesk respondió ${resp.status}`, detail: bodyText.slice(0, 500) }, 502);
    }

    return json({ ok: true, target, status: resp.status });
  } catch (error: any) {
    return json({ error: 'Server error: ' + error.message }, 500);
  }
});
