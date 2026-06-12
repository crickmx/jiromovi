import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionForUser(supabaseUrl: string, serviceKey: string, email: string, supabase: ReturnType<typeof createClient>): Promise<{ access_token: string; refresh_token: string } | null> {
  // Generate a one-time magic link (does NOT send email when using service role key)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('generateLink error:', linkError, linkData);
    return null;
  }

  // Verify the magic link server-side to get session tokens directly
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
    },
    body: JSON.stringify({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    }),
  });

  if (!verifyRes.ok) {
    const errBody = await verifyRes.text().catch(() => '');
    console.error('verify failed:', verifyRes.status, errBody);
    return null;
  }

  const sessionJson = await verifyRes.json().catch(() => null);
  if (!sessionJson?.access_token || !sessionJson?.refresh_token) {
    console.error('verify response missing tokens:', sessionJson);
    return null;
  }

  return { access_token: sessionJson.access_token, refresh_token: sessionJson.refresh_token };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json() as {
      email?: string;
      code?: string;
      magic_token?: string;
      platform: 'movi' | 'seguwallet' | 'chava';
      redirect_to?: string;
    };

    const { email, code, magic_token, platform } = body;

    if (!platform || (platform !== 'movi' && platform !== 'seguwallet' && platform !== 'chava')) {
      return new Response(JSON.stringify({ error: 'Plataforma inválida.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Magic token (quick link) path ─────────────────────────────────────────
    if (magic_token) {
      const magicHash = await sha256(magic_token);
      const { data: tokens } = await supabase
        .from('passwordless_login_tokens')
        .select('*')
        .eq('magic_token_hash', magicHash)
        .eq('platform', platform)
        .is('used_at', null)
        .limit(1);

      const token = tokens?.[0] || null;

      if (!token) {
        return new Response(JSON.stringify({
          error: 'Enlace inválido o ya utilizado.',
          code: 'INVALID',
        }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (new Date(token.expires_at) < new Date()) {
        await supabase
          .from('passwordless_login_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('id', token.id);

        return new Response(JSON.stringify({
          error: 'Este enlace ha expirado. Solicita un nuevo código.',
          code: 'EXPIRED',
        }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark used
      await supabase
        .from('passwordless_login_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token.id);

      const session = await createSessionForUser(supabaseUrl, supabaseServiceKey, token.email, supabase);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Error al crear sesión. Intenta de nuevo.' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        user_id: token.user_id,
        platform,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        email: token.email,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Code + email path ─────────────────────────────────────────────────────
    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'Se requieren correo y código.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find valid, unexpired, unused token by email
    const { data: tokens } = await supabase
      .from('passwordless_login_tokens')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('platform', platform)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const token = tokens?.[0] || null;

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Código inválido o no encontrado. Solicita un nuevo código.',
        code: 'INVALID',
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check expiry
    if (new Date(token.expires_at) < new Date()) {
      await supabase
        .from('passwordless_login_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token.id);

      return new Response(JSON.stringify({
        error: 'El código ha expirado. Solicita uno nuevo.',
        code: 'EXPIRED',
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check attempt limit
    if (token.attempts >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: 'MAX_ATTEMPTS',
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate code
    const inputHash = await sha256(code.trim().toUpperCase());
    if (inputHash !== token.code_hash) {
      await supabase
        .from('passwordless_login_tokens')
        .update({ attempts: token.attempts + 1 })
        .eq('id', token.id);

      const remaining = MAX_ATTEMPTS - (token.attempts + 1);
      return new Response(JSON.stringify({
        error: remaining > 0
          ? `Código incorrecto. Te quedan ${remaining} intentos.`
          : 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: remaining > 0 ? 'WRONG_CODE' : 'MAX_ATTEMPTS',
        remaining_attempts: Math.max(0, remaining),
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark token as used
    await supabase
      .from('passwordless_login_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', token.id);

    const session = await createSessionForUser(supabaseUrl, supabaseServiceKey, token.email, supabase);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Error al crear sesión. Intenta de nuevo.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: token.user_id,
      platform,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      email: token.email,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('verify-login-code error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
