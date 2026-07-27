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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...arr));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No auth" }, 401);

  let body: { tramite_id?: string; campo_id?: string; texto?: string; tiempo_segundos?: number; score_humano?: number; chars_pegados?: number; dispositivo?: string; captcha_token?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { tramite_id, campo_id, texto, tiempo_segundos, score_humano, chars_pegados, dispositivo, captcha_token } = body;
  if (!tramite_id || !campo_id || !texto?.trim()) return json({ error: "Missing fields" }, 400);

  // reCAPTCHA v3 — opcional: si la clave está configurada, verifica; si no, omite
  // Clave propia de MOVI, separada de RECAPTCHA_SECRET_KEY (usada por otras funciones ajenas a este flujo).
  const recaptchaSecret = Deno.env.get("RECAPTCHA_SECRET_KEY_MOVI");
  if (recaptchaSecret && captcha_token) {
    const verif = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${recaptchaSecret}&response=${captcha_token}`,
    }).then(r => r.json()).catch(() => ({ success: false, score: 0 }));
    if (!verif.success || verif.score < 0.3) {
      return json({ error: "Verificación de seguridad fallida. Intenta de nuevo." }, 403);
    }
  }

  // Verify user + access to tramite via RLS
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

  // AES-256-GCM encryption
  const keyHex = Deno.env.get("REPORTE_ENCRYPTION_KEY") ?? "";
  if (keyHex.length < 64) return json({ error: "REPORTE_ENCRYPTION_KEY no configurado" }, 500);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", hexToBytes(keyHex.slice(0, 64)), { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    new TextEncoder().encode(texto)
  );

  const palabras = texto.trim().split(/\s+/).filter(Boolean).length;

  // Write via service role
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error: upsertErr } = await adminClient
    .from("tramite_respuestas")
    .upsert(
      { tramite_id, campo_id, valor_json: {
        enviado: true,
        enviado_en: new Date().toISOString(),
        palabras,
        encrypted: toBase64(encrypted),
        iv: toBase64(iv),
        meta: {
          tiempo_segundos: tiempo_segundos ?? null,
          score_humano: score_humano ?? null,
          chars_pegados: chars_pegados ?? null,
          dispositivo: dispositivo ?? null,
        },
      }},
      { onConflict: "tramite_id,campo_id" }
    );

  if (upsertErr) return json({ error: upsertErr.message }, 500);
  return json({ ok: true, palabras });
});
