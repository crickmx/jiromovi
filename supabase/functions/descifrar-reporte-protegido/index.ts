import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── TOTP (RFC 6238) ───────────────────────────────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Uint8Array {
  const s = input.toUpperCase().replace(/=+$/, "");
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
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const off = sig[sig.length - 1] & 0x0f;
  const bin = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const t = Math.floor(Date.now() / 1000 / 30);
  for (let i = -1; i <= 1; i++) {
    if (await hotp(secret, t + i) === code) return true;
  }
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return b;
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No auth" }, 401);

  let body: { tramite_id?: string; campo_id?: string; codigo_totp?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { tramite_id, campo_id, codigo_totp } = body;
  if (!tramite_id || !campo_id || !codigo_totp) return json({ error: "Missing fields" }, 400);

  // Verify user identity + access to tramite via RLS
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const [{ data: { user }, error: authErr }, { data: tramite }] = await Promise.all([
    userClient.auth.getUser(),
    userClient.from("tickets").select("id").eq("id", tramite_id).maybeSingle(),
  ]);

  if (authErr || !user) return json({ error: "Unauthorized" }, 401);
  if (!tramite) return json({ error: "Tramite no encontrado" }, 404);

  // Get TOTP secret via service role (bypasses RLS)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: totpRow } = await adminClient
    .from("usuario_totp_secrets")
    .select("encrypted_secret")
    .eq("user_id", user.id)
    .eq("verificado", true)
    .maybeSingle();

  if (!totpRow?.encrypted_secret) return json({ error: "TOTP no configurado" }, 403);

  const valid = await verifyTOTP(totpRow.encrypted_secret, codigo_totp);
  if (!valid) return json({ error: "Código incorrecto" }, 403);

  // Get encrypted reporte
  const { data: resp } = await adminClient
    .from("tramite_respuestas")
    .select("valor_json")
    .eq("tramite_id", tramite_id)
    .eq("campo_id", campo_id)
    .maybeSingle();

  if (!resp?.valor_json?.encrypted) return json({ error: "Reporte no encontrado" }, 404);

  // Decrypt AES-256-GCM
  const keyHex = Deno.env.get("REPORTE_ENCRYPTION_KEY") ?? "";
  if (keyHex.length < 64) return json({ error: "REPORTE_ENCRYPTION_KEY no configurado" }, 500);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", hexToBytes(keyHex.slice(0, 64)), { name: "AES-GCM" }, false, ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(resp.valor_json.iv) },
    cryptoKey,
    fromBase64(resp.valor_json.encrypted)
  );

  return json({ texto: new TextDecoder().decode(decrypted), palabras: resp.valor_json.palabras });
});
