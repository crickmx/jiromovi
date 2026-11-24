// node supabase/functions/_shared/emailOauth.test.mjs
import assert from 'node:assert/strict';
import {
  cadenaXoauth2, saslXoauth2, urlDeAutorizacion, configDeProveedor, redirectUri,
  cuerpoDelIntercambio, cuerpoDelRefresco, tokensDeRespuesta, hayQueRefrescar,
  credencialDesdeBlob, blobDesdeTokens, proveedorOauthDe, requiereAppendAEnviados,
} from './emailOauth.ts';

// ── XOAUTH2: el formato es exacto, con \x01 y no espacios ─────────────
const sasl = cadenaXoauth2('agente@jiro.mx', 'ya29.TOKEN');
assert.equal(sasl, 'user=agente@jiro.mx\x01auth=Bearer ya29.TOKEN\x01\x01');
assert.equal(sasl.split('\x01').length - 1, 3, 'tres \\x01: tras el usuario y el doble del cierre');
assert.ok(sasl.startsWith('user='), 'empieza por user=');
assert.ok(sasl.endsWith('\x01\x01'), 'termina con el doble separador');
// Lo que viaja es esa cadena en base64, y se decodifica de vuelta igual.
assert.equal(Buffer.from(saslXoauth2('agente@jiro.mx', 'ya29.TOKEN'), 'base64').toString('utf8'), sasl);
// Acentos en el usuario no rompen el base64 (se codifica UTF-8, no latin1).
assert.equal(
  Buffer.from(saslXoauth2('josé@jiro.mx', 't'), 'base64').toString('utf8'),
  cadenaXoauth2('josé@jiro.mx', 't'),
);

// ── Configuración por proveedor ───────────────────────────────────────
const env = {
  GOOGLE_OAUTH_CLIENT_ID: 'gid', GOOGLE_OAUTH_CLIENT_SECRET: 'gsec',
  MICROSOFT_OAUTH_CLIENT_ID: 'mid', MICROSOFT_OAUTH_CLIENT_SECRET: 'msec',
};
const SUPA = 'https://qhwvuuyjhcennqccgvse.supabase.co';
assert.equal(redirectUri(SUPA), `${SUPA}/functions/v1/email-oauth-callback`);
assert.equal(redirectUri(SUPA + '/'), `${SUPA}/functions/v1/email-oauth-callback`, 'la diagonal final no duplica');

const google = configDeProveedor('google', env, SUPA);
const micro = configDeProveedor('microsoft', env, SUPA);
assert.ok(google && micro);
assert.equal(google.clientId, 'gid');
assert.equal(micro.clientId, 'mid');
assert.ok(google.scope.includes('https://mail.google.com/'), 'IMAP/SMTP de Google exige mail.google.com');
assert.ok(micro.scope.includes('https://outlook.office.com/IMAP.AccessAsUser.All'));
assert.ok(micro.scope.includes('https://outlook.office.com/SMTP.Send'));
assert.ok(micro.scope.includes('offline_access'), 'sin offline_access no hay refresh_token');

// Sin llaves configuradas no se inventa una config: se devuelve null para que
// la pantalla diga "falta conectar el proveedor" en vez de fallar raro.
assert.equal(configDeProveedor('microsoft', {}, SUPA), null);
assert.equal(configDeProveedor('google', { GOOGLE_OAUTH_CLIENT_ID: 'x' }, SUPA), null, 'sin secreto tampoco');

// ── URL de autorización ───────────────────────────────────────────────
const ug = new URL(urlDeAutorizacion(google, 'STATE123'));
assert.equal(ug.origin + ug.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
assert.equal(ug.searchParams.get('client_id'), 'gid');
assert.equal(ug.searchParams.get('response_type'), 'code');
assert.equal(ug.searchParams.get('redirect_uri'), `${SUPA}/functions/v1/email-oauth-callback`);
assert.equal(ug.searchParams.get('state'), 'STATE123');
// Sin esto Google NO devuelve refresh_token y a la hora se cae la cuenta.
assert.equal(ug.searchParams.get('access_type'), 'offline');
assert.equal(ug.searchParams.get('prompt'), 'consent');
assert.ok(!ug.searchParams.get('scope').includes('client_secret'), 'el scope nunca lleva el secreto');

const um = new URL(urlDeAutorizacion(micro, 'S2'));
assert.equal(um.origin + um.pathname, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
assert.equal(um.searchParams.get('prompt'), 'select_account');
assert.equal(um.searchParams.get('redirect_uri'), `${SUPA}/functions/v1/email-oauth-callback`);

// ── Cuerpos del canje y del refresco ──────────────────────────────────
const canje = new URLSearchParams(cuerpoDelIntercambio(micro, 'CODIGO'));
assert.equal(canje.get('grant_type'), 'authorization_code');
assert.equal(canje.get('code'), 'CODIGO');
assert.equal(canje.get('client_secret'), 'msec');
assert.equal(canje.get('redirect_uri'), micro.redirectUri, 'el canje repite EXACTAMENTE la misma redirect_uri');
const refresco = new URLSearchParams(cuerpoDelRefresco(google, 'RT'));
assert.equal(refresco.get('grant_type'), 'refresh_token');
assert.equal(refresco.get('refresh_token'), 'RT');

// ── Lo que devuelve el proveedor ──────────────────────────────────────
const t = tokensDeRespuesta({ access_token: 'A', refresh_token: 'R', expires_in: 3599 }, 1_000_000);
assert.equal(t.access_token, 'A');
assert.equal(t.refresh_token, 'R');
assert.equal(t.expires_at, new Date(1_000_000 + 3599_000).toISOString());
// Sin expires_in se asume una hora (refrescar de más es mejor que fallar).
assert.equal(tokensDeRespuesta({ access_token: 'A' }, 0).expires_at, new Date(3600_000).toISOString());
assert.throws(() => tokensDeRespuesta({}), /access_token/);

// ── ¿Refrescar? ───────────────────────────────────────────────────────
const ahora = Date.parse('2026-11-21T12:00:00Z');
assert.equal(hayQueRefrescar(null, ahora), true, 'sin fecha se refresca');
assert.equal(hayQueRefrescar('no-es-fecha', ahora), true, 'una fecha basura no deja a nadie sin correo');
assert.equal(hayQueRefrescar('2026-11-21T12:10:00Z', ahora), false, '10 min de sobra: se usa tal cual');
assert.equal(hayQueRefrescar('2026-11-21T12:01:00Z', ahora), true, 'a 60 s del vencimiento ya no sirve');

// ── El sobre cifrado ──────────────────────────────────────────────────
const blob = blobDesdeTokens({ access_token: 'A2', refresh_token: 'R2', expires_at: 'X' });
const leido = credencialDesdeBlob(blob);
assert.equal(leido.refresh_token, 'R2');
assert.equal(leido.access_token, 'A2');
assert.equal(leido.tipo, 'oauth');
// El refresco no siempre devuelve refresh_token: se conserva el anterior.
assert.match(blobDesdeTokens({ access_token: 'A3', expires_at: 'Y' }, 'R-ANTERIOR'), /R-ANTERIOR/);
assert.throws(() => blobDesdeTokens({ access_token: 'A', expires_at: 'Y' }), /refresh_token/);
assert.equal(credencialDesdeBlob('no es json'), null);
assert.equal(credencialDesdeBlob('{"tipo":"oauth"}'), null, 'sin refresh_token no sirve de nada');
assert.equal(credencialDesdeBlob('mi-contrasena-de-toda-la-vida'), null, 'una contraseña suelta no es una credencial OAuth');

// ── Proveedor → OAuth, y la trampa de Gmail ───────────────────────────
assert.equal(proveedorOauthDe('gmail'), 'google');
assert.equal(proveedorOauthDe('outlook'), 'microsoft');
assert.equal(proveedorOauthDe('movi'), null);
assert.equal(proveedorOauthDe(null), null);
// Gmail archiva solo lo enviado por SMTP: hacer APPEND lo duplicaría.
assert.equal(requiereAppendAEnviados('gmail'), false);
assert.equal(requiereAppendAEnviados('outlook'), true);
assert.equal(requiereAppendAEnviados('movi'), true);
assert.equal(requiereAppendAEnviados(null), true, 'ante la duda, el comportamiento de siempre');

console.log('emailOauth: OK');
