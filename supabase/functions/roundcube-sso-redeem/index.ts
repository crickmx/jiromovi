import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getMailboxPassword } from "../_shared/emailCredentials.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, private",
  "Pragma": "no-cache",
};

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  const [providedHash, expectedHash] = await Promise.all([sha256(provided), sha256(expected)]);
  const a = new TextEncoder().encode(providedHash);
  const b = new TextEncoder().encode(expectedHash);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const expectedSecret = Deno.env.get("ROUNDCUBE_SSO_SHARED_SECRET") ?? "";
    const providedSecret = req.headers.get("X-Movi-Roundcube-Secret") ?? "";
    if (!await secretsMatch(providedSecret, expectedSecret)) {
      return response(401, { error: "UNAUTHORIZED" });
    }

    const body = await req.json() as { token?: string };
    if (!body.token || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
      return response(400, { error: "INVALID_TOKEN" });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const tokenHash = await sha256(body.token);
    const now = new Date().toISOString();

    // UPDATE condicional: exactamente una petición puede reclamar el token.
    const { data: claimed, error: claimError } = await admin
      .from("roundcube_sso_tokens")
      .update({ used_at: now })
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("usuario_id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed?.usuario_id) return response(401, { error: "TOKEN_EXPIRED_OR_USED" });

    const { data: mailbox, error: mailboxError } = await admin
      .from("email_configuraciones")
      .select("email")
      .eq("usuario_id", claimed.usuario_id)
      .eq("activa", true)
      .maybeSingle();
    if (mailboxError || !mailbox?.email) return response(409, { error: "MAILBOX_NOT_CONFIGURED" });

    const password = await getMailboxPassword(admin, claimed.usuario_id);
    if (!password) return response(409, { error: "MAILBOX_CREDENTIAL_MISSING" });

    return response(200, {
      username: mailbox.email,
      password,
      host: Deno.env.get("IONOS_IMAP_HOST") ?? "ssl://imap.ionos.mx",
    });
  } catch (error) {
    console.error("roundcube-sso-redeem:", error instanceof Error ? error.message : "unknown");
    return response(500, { error: "INTERNAL_ERROR" });
  }
});
