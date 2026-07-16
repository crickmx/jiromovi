import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, code, magic_token, platform } = await req.json();

    if (!email || (!code && !magic_token)) {
      return new Response(
        JSON.stringify({ error: "Email y código son requeridos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const targetPlatform = platform || "movi";

    // Find the most recent valid token for this email + platform
    const { data: token, error: tokenError } = await supabase
      .from("passwordless_login_tokens")
      .select("*")
      .eq("email", email)
      .eq("platform", targetPlatform)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: "Error al verificar código" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Código expirado o inválido. Solicita uno nuevo.",
          error_code: "TOKEN_EXPIRED",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check max attempts (5 max)
    if (token.attempts >= 5) {
      return new Response(
        JSON.stringify({
          error: "Demasiados intentos. Solicita un nuevo código.",
          error_code: "MAX_ATTEMPTS",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let isValid = false;

    if (magic_token) {
      // Verify via magic token (auto-login from app)
      const magicHash = await hashCode(magic_token);
      isValid = magicHash === token.magic_token_hash;
    } else {
      // Verify via manual code entry
      // CRITICAL FIX: Normalize code to UPPERCASE before hashing
      // Codes are generated and sent in uppercase (e.g., "A4HQVG")
      // but users might type lowercase on their keyboard
      const normalizedCode = code.trim().toUpperCase();
      const codeHash = await hashCode(normalizedCode);
      isValid = codeHash === token.code_hash;
    }

    if (!isValid) {
      // Increment attempts
      await supabase
        .from("passwordless_login_tokens")
        .update({ attempts: token.attempts + 1 })
        .eq("id", token.id);

      return new Response(
        JSON.stringify({
          error: "Código incorrecto. Verifica e intenta de nuevo.",
          error_code: "INVALID_CODE",
          attempts_remaining: 4 - token.attempts,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Code is valid! Check if user can login
    const { data: loginCheck } = await supabase.rpc("check_user_can_login", {
      user_id_to_check: token.user_id,
    });

    if (loginCheck && !loginCheck.can_login) {
      return new Response(
        JSON.stringify({
          error: loginCheck.error,
          error_code: loginCheck.error_code,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark token as used
    await supabase
      .from("passwordless_login_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token.id);

    // Mark all previous tokens for this user+platform as used (cleanup)
    await supabase
      .from("passwordless_login_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", token.user_id)
      .eq("platform", targetPlatform)
      .is("used_at", null)
      .neq("id", token.id);

    // Get user email from auth to sign in
    const { data: authUser } = await supabase.auth.admin.getUserById(
      token.user_id
    );

    if (!authUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado en auth" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a session for the user using admin API
    const { data: sessionData, error: sessionError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: authUser.user.email,
      });

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify({ error: "Error al generar sesión" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: token.user_id,
        user_name: loginCheck?.user_name || "",
        user_rol: loginCheck?.user_rol || "",
        token_hash: sessionData.properties?.hashed_token || null,
        verification_url: sessionData.properties?.action_link || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
