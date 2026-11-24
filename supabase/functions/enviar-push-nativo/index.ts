// enviar-push-nativo
// ----------------------------------------------------------------------------
// Manda como push a los teléfonos (apps de iOS y Android) un aviso que acaba de
// entrar a la campanita. La llama el trigger push_nativo_por_notificacion con
// { tabla: 'notificaciones' | 'notifications', id }.
//
// Seguridad: Verify JWT apagado (la llama la base, sin llave). Por eso NO acepta
// texto: solo un id, lee la fila con service_role, y solo manda si se creó hace
// menos de 2 minutos. La URL no sirve para mandar avisos inventados ni viejos.
//
// Canales (cada uno se activa solo si tiene sus Secrets; si faltan, se omite):
//  · Android → Firebase Cloud Messaging v1.
//      FCM_SERVICE_ACCOUNT = el JSON completo de la cuenta de servicio de Firebase
//  · iPhone  → APNs directo (sin SDK de Firebase en la app).
//      APNS_KEY_P8   = contenido del archivo AuthKey_XXXX.p8
//      APNS_KEY_ID   = Key ID de esa llave
//      APNS_TEAM_ID  = Team ID de la cuenta de Apple Developer
//      APNS_SANDBOX  = 'true' solo para probar desde Xcode (por defecto producción)
//
// Tokens que el proveedor declara inválidos se borran de push_dispositivos.
// Un solo archivo, sin imports de _shared (se puede pegar en el dashboard).
// ----------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });

const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof buf === 'string' ? new TextEncoder().encode(buf) : new Uint8Array(buf as ArrayBuffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function pemABytes(pem: string): Uint8Array {
  const limpio = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0));
}

async function firmarJwt(alg: 'RS256' | 'ES256', header: object, payload: object, pem: string) {
  const datos = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemABytes(pem) as BufferSource,
    alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } : { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
  const firma = await crypto.subtle.sign(
    alg === 'RS256' ? 'RSASSA-PKCS1-v1_5' : { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(datos),
  );
  return `${datos}.${b64url(firma)}`;
}

// ── FCM ──────────────────────────────────────────────────────────────────────
let fcmCache: { token: string; vence: number; proyecto: string } | null = null;
async function fcmAcceso() {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) return null;
  if (fcmCache && fcmCache.vence > Date.now() + 60_000) return fcmCache;
  const sa = JSON.parse(raw);
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = await firmarJwt('RS256', { alg: 'RS256', typ: 'JWT' }, {
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
  }, sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`OAuth FCM: ${JSON.stringify(d)}`);
  fcmCache = { token: d.access_token, vence: Date.now() + d.expires_in * 1000, proyecto: sa.project_id };
  return fcmCache;
}

async function enviarFcm(token: string, titulo: string, cuerpo: string, url: string) {
  const acc = await fcmAcceso();
  if (!acc) return 'sin_configurar' as const;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.proyecto}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${acc.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token, notification: { title: titulo, body: cuerpo }, data: { url },
      android: { priority: 'high', notification: { sound: 'default' } },
    } }),
  });
  if (r.ok) return 'ok' as const;
  const t = await r.text();
  if (r.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT.*token/i.test(t)) return 'invalido' as const;
  console.error('[enviar-push-nativo] FCM', r.status, t.slice(0, 300));
  return 'error' as const;
}

// ── APNs ─────────────────────────────────────────────────────────────────────
let apnsCache: { jwt: string; creado: number } | null = null;
async function apnsJwt() {
  const p8 = Deno.env.get('APNS_KEY_P8'), kid = Deno.env.get('APNS_KEY_ID'), team = Deno.env.get('APNS_TEAM_ID');
  if (!p8 || !kid || !team) return null;
  // Apple pide renovarlo entre 20 y 60 minutos.
  if (apnsCache && Date.now() - apnsCache.creado < 40 * 60_000) return apnsCache.jwt;
  const jwt = await firmarJwt('ES256', { alg: 'ES256', kid }, { iss: team, iat: Math.floor(Date.now() / 1000) }, p8);
  apnsCache = { jwt, creado: Date.now() };
  return jwt;
}

async function enviarApns(token: string, topic: string, titulo: string, cuerpo: string, url: string) {
  const jwt = await apnsJwt();
  if (!jwt) return 'sin_configurar' as const;
  const host = Deno.env.get('APNS_SANDBOX') === 'true' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const r = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert',
      'apns-priority': '10', 'content-type': 'application/json',
    },
    body: JSON.stringify({ aps: { alert: { title: titulo, body: cuerpo }, sound: 'default' }, url }),
  });
  if (r.ok) return 'ok' as const;
  const t = await r.text();
  if (r.status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(t)) return 'invalido' as const;
  console.error('[enviar-push-nativo] APNs', r.status, t.slice(0, 300));
  return 'error' as const;
}

// ── Principal ────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  let body: { tabla?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }
  if (!['notificaciones', 'notifications'].includes(body.tabla || '') || !/^[0-9a-f-]{36}$/i.test(body.id || '')) {
    return json({ error: 'Datos inválidos' }, 400);
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const esMovi = body.tabla === 'notificaciones';
  const { data: fila } = await sb.from(body.tabla!)
    .select(esMovi ? 'usuario_id, titulo, mensaje, accion_url, url, created_at' : 'user_id, title, body, link_url, created_at')
    .eq('id', body.id!).maybeSingle();
  if (!fila) return json({ ok: true, omitido: 'no_existe' });
  // deno-lint-ignore no-explicit-any
  const f = fila as any;
  if (Date.now() - new Date(f.created_at).getTime() > 2 * 60_000) return json({ ok: true, omitido: 'viejo' });

  const usuario = esMovi ? f.usuario_id : f.user_id;
  const titulo = String(esMovi ? f.titulo : f.title).slice(0, 120);
  const cuerpo = String(esMovi ? f.mensaje : f.body).slice(0, 300);
  const url = String((esMovi ? (f.accion_url || f.url) : f.link_url) || '/');

  const { data: dispositivos } = await sb.from('push_dispositivos')
    .select('id, token, plataforma, app_id').eq('auth_user_id', usuario);
  if (!dispositivos?.length) return json({ ok: true, enviados: 0 });

  let enviados = 0;
  const invalidos: string[] = [];
  for (const d of dispositivos) {
    try {
      const r = d.plataforma === 'ios'
        ? await enviarApns(d.token, d.app_id || 'digital.movi.app', titulo, cuerpo, url)
        : await enviarFcm(d.token, titulo, cuerpo, url);
      if (r === 'ok') enviados++;
      if (r === 'invalido') invalidos.push(d.id);
    } catch (e) {
      console.error('[enviar-push-nativo]', d.plataforma, e instanceof Error ? e.message : e);
    }
  }
  if (invalidos.length) await sb.from('push_dispositivos').delete().in('id', invalidos);
  return json({ ok: true, enviados, invalidos: invalidos.length });
});
