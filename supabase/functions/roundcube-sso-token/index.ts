import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
};

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("MOVI_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] ?? "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Apikey, X-Client-Info",
    "Vary": "Origin",
  };
}

function response(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(req) },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return response(req, 405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return response(req, 401, { error: "UNAUTHORIZED" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authorization.slice("Bearer ".length);
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) return response(req, 401, { error: "INVALID_SESSION" });

    const { data: mailbox } = await admin
      .from("email_configuraciones")
      .select("email")
      .eq("usuario_id", user.id)
      .eq("activa", true)
      .maybeSingle();
    if (!mailbox?.email) return response(req, 409, { error: "MAILBOX_NOT_CONFIGURED" });

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("roundcube_sso_tokens")
      .select("token_hash", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .gte("created_at", oneMinuteAgo);
    if ((count ?? 0) >= 5) return response(req, 429, { error: "RATE_LIMITED" });

    // Limpieza oportunista; nunca es condición para emitir un token nuevo.
    await admin.from("roundcube_sso_tokens").delete().lt("expires_at", new Date().toISOString());

    const random = crypto.getRandomValues(new Uint8Array(32));
    const token = base64Url(random);
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const { error: insertError } = await admin.from("roundcube_sso_tokens").insert({
      token_hash: tokenHash,
      usuario_id: user.id,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    return response(req, 200, {
      token,
      expires_at: expiresAt,
      handoff_path: `?_movi_token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error("roundcube-sso-token:", error instanceof Error ? error.message : "unknown");
    return response(req, 500, { error: "INTERNAL_ERROR" });
  }
});
