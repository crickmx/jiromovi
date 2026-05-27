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
      platform: 'movi' | 'seguwallet';
      redirect_to?: string;
    };

    const { email, code, magic_token, platform, redirect_to } = body;

    if (!platform || (platform !== 'movi' && platform !== 'seguwallet')) {
      return new Response(JSON.stringify({ error: 'Plataforma inválida.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Find valid, unexpired, unused token ────────────────────────────────────
    let token: any = null;

    if (magic_token) {
      const magicHash = await sha256(magic_token);
      const { data } = await supabase
        .from('passwordless_login_tokens')
        .select('*')
        .eq('magic_token_hash', magicHash)
        .eq('platform', platform)
        .is('used_at', null)
        .maybeSingle();
      token = data;
    } else if (email && code) {
      const { data: tokens } = await supabase
        .from('passwordless_login_tokens')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('platform', platform)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      token = tokens?.[0] || null;
    } else {
      return new Response(JSON.stringify({ error: 'Datos de verificación incompletos.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({
        error: 'Código inválido o no encontrado. Solicita un nuevo código.',
        code: 'INVALID',
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Check expiry ───────────────────────────────────────────────────────────
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

    // ── Check attempt limit ────────────────────────────────────────────────────
    if (token.attempts >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: 'Demasiados intentos fallidos. Solicita un nuevo código.',
        code: 'MAX_ATTEMPTS',
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── For code flow, validate the code ──────────────────────────────────────
    if (code) {
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
    }

    // ── Mark token as used ────────────────────────────────────────────────────
    await supabase
      .from('passwordless_login_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', token.id);

    // ── Generate Supabase magic link ──────────────────────────────────────────
    // For magic_token flow: return action_link so client can redirect directly
    // to Supabase Auth which handles session creation via its own redirect.
    // For code flow: use token_hash with verifyOtp on the client side.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: token.email,
      options: {
        redirectTo: redirect_to || undefined,
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('Error generating link:', linkError, linkData);
      return new Response(JSON.stringify({ error: 'Error al crear sesión. Intenta de nuevo.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: token.user_id,
      platform,
      // token_hash for verifyOtp (code flow)
      token_hash: linkData.properties.hashed_token,
      // action_link for direct redirect (magic link flow) — Supabase handles session creation
      action_link: linkData.properties.action_link,
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
