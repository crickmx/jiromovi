import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:soporte@movi.digital";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importECKey(
  base64Url: string,
  type: "public" | "private"
): Promise<CryptoKey> {
  const raw = base64UrlToUint8Array(base64Url);
  if (type === "public") {
    return crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  }
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64Url(raw.slice(1, 33)),
    y: uint8ArrayToBase64Url(raw.slice(33, 65)),
    d: base64Url,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
}

async function createJWT(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await importECKey(VAPID_PRIVATE_KEY, "private");
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(unsignedToken)
  );

  const signatureArr = new Uint8Array(signatureBuffer);
  const signatureB64 = uint8ArrayToBase64Url(signatureArr);
  return `${unsignedToken}.${signatureB64}`;
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  authKey: string
): Promise<{ body: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlToUint8Array(p256dh);
  const clientAuthBytes = base64UrlToUint8Array(authKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  const localPublicKeyExported = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  const enc = new TextEncoder();

  const authInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...clientPublicKeyBytes,
    ...localPublicKeyExported,
  ]);

  const authHkeyMaterial = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: clientAuthBytes, info: authInfo },
      authHkeyMaterial,
      256
    )
  );

  const contentEncryptionKeyInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: aes128gcm\0"),
  ]);
  const nonceInfo = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
  ]);

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);

  const contentEncryptionKey = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: contentEncryptionKeyInfo },
      ikmKey,
      128
    )
  );

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey,
      96
    )
  );

  const payloadBytes = enc.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter

  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  const recordSize = encrypted.length + 86;
  const header = new Uint8Array(86);
  header.set(salt, 0);
  header[16] = (recordSize >> 24) & 0xff;
  header[17] = (recordSize >> 16) & 0xff;
  header[18] = (recordSize >> 8) & 0xff;
  header[19] = recordSize & 0xff;
  header[20] = 65; // key length
  header.set(localPublicKeyExported, 21);

  const body = new Uint8Array(header.length + encrypted.length);
  body.set(header);
  body.set(encrypted, header.length);

  return { body, salt, localPublicKey: localPublicKeyExported };
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payloadObj: Record<string, unknown>
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const payloadStr = JSON.stringify(payloadObj);
    const { body } = await encryptPayload(payloadStr, subscription.p256dh, subscription.auth_key);

    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const jwt = await createJWT(audience);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": body.byteLength.toString(),
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        TTL: "86400",
        Urgency: "high",
      },
      body,
    });

    if (response.status === 410 || response.status === 404) {
      return { success: false, status: response.status, error: "subscription_expired" };
    }

    return { success: response.status >= 200 && response.status < 300, status: response.status };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const isServiceCall = authHeader?.includes(supabaseServiceKey);

    if (!isServiceCall) {
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader || "" } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { usuario_id, title, body: notifBody, url, tag, caller_number } = await req.json();

    if (!usuario_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing usuario_id or title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscriptions, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("usuario_id", usuario_id);

    if (subError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushPayload = {
      title,
      body: notifBody || "",
      url: url || "/admin/telefonia",
      tag: tag || "notification",
      caller_number: caller_number || null,
      timestamp: Date.now(),
    };

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendPushNotification(sub, pushPayload);
      if (result.success) {
        sent++;
      } else if (result.error === "subscription_expired") {
        expired.push(sub.endpoint);
      }
    }

    if (expired.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expired);
    }

    return new Response(
      JSON.stringify({ success: true, sent, expired: expired.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
