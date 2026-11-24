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

// ── TOTP (RFC 6238) ──────────────────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input: string): Uint8Array {
  const s = input.toUpperCase().replace(/=+$/, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of s) {
    const idx = B32.indexOf(c);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((value >> bits) & 0xff); }
  }
  return new Uint8Array(out);
}
async function hotp(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter >>> 0, false);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key.buffer as ArrayBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}
async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const t = Math.floor(Date.now() / 1000 / 30);
  for (let i = -2; i <= 2; i++) {
    if (await hotp(secret, t + i) === code) return true;
  }
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

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

    // ── Verificar reCAPTCHA ─────────────────────────────────────────────────
    const rcSecret = Deno.env.get('RECAPTCHA_SECRET_KEY_MOVI');
    const rcToken  = body.recaptchaToken as string | undefined;
    if (rcSecret && rcToken) {
      const rcResp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${rcSecret}&response=${rcToken}`,
      });
      const rc = await rcResp.json();
      if (!rc.success || (rc.score ?? 1) < 0.5) {
        return json({ error: 'Verificación de seguridad fallida. Intenta de nuevo.' }, 403);
      }
    }

    // ── Verificar TOTP para producción ──────────────────────────────────────
    if (target === 'produccion') {
      const totpCode = (body.totpCode as string | undefined)?.trim();
      if (!totpCode || totpCode.length !== 6) {
        return json({ error: 'Se requiere código de autenticador para actualizar producción' }, 403);
      }

      const { data: totpRow } = await supabaseAdmin
        .from('usuario_totp_secrets')
        .select('encrypted_secret, verificado')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!totpRow?.verificado) {
        return json({ error: 'Configura el autenticador en tu perfil antes de actualizar producción' }, 403);
      }

      const valid = await verifyTOTP(totpRow.encrypted_secret, totpCode);
      if (!valid) {
        return json({ error: 'Código de autenticador incorrecto' }, 403);
      }
    }

    // ── Llamar relay → Plesk ────────────────────────────────────────────────
    const relayUrl   = Deno.env.get('PLESK_RELAY_URL');
    const relayToken = Deno.env.get('PLESK_RELAY_TOKEN');

    if (!relayUrl || !relayToken) {
      return json({ error: 'Falta configurar PLESK_RELAY_URL / PLESK_RELAY_TOKEN en Supabase Secrets' }, 500);
    }

    let pleskOk   = false;
    let pleskStatus: number | null = null;

    try {
      const relayResp = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Relay-Token': relayToken },
        body: JSON.stringify({ target }),
      });

      const result = await relayResp.json().catch(() => ({ ok: false, status: null }));
      pleskOk     = result.ok === true;
      pleskStatus = result.status ?? relayResp.status;

      await supabaseAdmin.from('deploy_triggers').insert({
        usuario_id: user.id, target, status_code: pleskStatus, ok: pleskOk,
      });

      if (!relayResp.ok) return json({ error: `Relay respondió ${relayResp.status}`, detail: result }, 502);
      if (!pleskOk)      return json({ error: `Plesk respondió ${pleskStatus}`, detail: result }, 502);
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
