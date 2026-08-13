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

    const relayUrl   = Deno.env.get('PLESK_RELAY_URL');
    const relayToken = Deno.env.get('PLESK_RELAY_TOKEN');

    if (!relayUrl || !relayToken) {
      return json({ error: 'Falta configurar PLESK_RELAY_URL / PLESK_RELAY_TOKEN en Supabase Secrets' }, 500);
    }

    let relayResp: Response;
    let pleskOk   = false;
    let pleskStatus: number | null = null;

    try {
      relayResp = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Token': relayToken,
        },
        body: JSON.stringify({ target }),
      });

      const result = await relayResp.json().catch(() => ({ ok: false, status: null }));
      pleskOk     = result.ok === true;
      pleskStatus = result.status ?? relayResp.status;

      await supabaseAdmin.from('deploy_triggers').insert({
        usuario_id: user.id, target, status_code: pleskStatus, ok: pleskOk,
      });

      if (!relayResp.ok) {
        return json({ error: `Relay respondió ${relayResp.status}`, detail: result }, 502);
      }
      if (!pleskOk) {
        return json({ error: `Plesk respondió ${pleskStatus}`, detail: result }, 502);
      }
    } catch (fetchErr: any) {
      await supabaseAdmin.from('deploy_triggers').insert({
        usuario_id: user.id, target, status_code: null, ok: false,
      });
      return json({ error: 'No se pudo contactar el relay: ' + fetchErr.message }, 502);
    }

    return json({ ok: true, target, status: pleskStatus });
  } catch (error: any) {
    return json({ error: 'Server error: ' + error.message }, 500);
  }
});
