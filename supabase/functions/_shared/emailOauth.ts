// OAuth2 para Gmail y Outlook: armar la ida, canjear la vuelta y firmar
// XOAUTH2 contra IMAP y SMTP.
//
// Puro siempre que se pueda —nada de red aquí, salvo que se le pase un
// `fetch`— para poder probarlo con
//   node supabase/functions/_shared/emailOauth.test.mjs
//
// Por qué existe:
//   · Outlook SOLO entra por OAuth2. Microsoft deshabilitó la autenticación
//     básica para las cuentas personales el 16/09/2024 y las contraseñas de
//     aplicación tampoco sirven para correo.
//   · Gmail acepta contraseña de aplicación, pero Google Workspace ya no, así
//     que también necesita este camino.
//
// Las llaves del cliente viven en los secretos de la edge function. Aquí solo
// se leen sus NOMBRES desde `email_proveedores_preset.oauth_variables`.

export type ProveedorOauth = 'google' | 'microsoft';

export interface ConfigOauth {
  autorizacion: string;
  token: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Parámetros extra que el proveedor necesita para devolver refresh token. */
  extraAutorizacion: Record<string, string>;
}

/** Los nombres de las variables de entorno de cada proveedor. */
export const VARIABLES_OAUTH: Record<ProveedorOauth, { id: string; secreto: string }> = {
  google: { id: 'GOOGLE_OAUTH_CLIENT_ID', secreto: 'GOOGLE_OAUTH_CLIENT_SECRET' },
  microsoft: { id: 'MICROSOFT_OAUTH_CLIENT_ID', secreto: 'MICROSOFT_OAUTH_CLIENT_SECRET' },
};

/**
 * `https://mail.google.com/` es lo que exige IMAP/SMTP de Google y está
 * clasificado como scope RESTRINGIDO: una app pública que lo use necesita
 * verificación de Google (y auditoría anual). Por eso Gmail también ofrece
 * la contraseña de aplicación: no todas las cuentas van a poder pasar por
 * aquí el primer día.
 */
const SCOPE_GOOGLE = 'https://mail.google.com/ openid email';
const SCOPE_MICROSOFT =
  'offline_access openid email ' +
  'https://outlook.office.com/IMAP.AccessAsUser.All ' +
  'https://outlook.office.com/SMTP.Send';

/** De dónde sacar el cliente y a dónde vuelve el proveedor. */
export function redirectUri(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/email-oauth-callback`;
}

export function configDeProveedor(
  proveedor: ProveedorOauth,
  env: Record<string, string | undefined>,
  supabaseUrl: string,
): ConfigOauth | null {
  const vars = VARIABLES_OAUTH[proveedor];
  const clientId = env[vars.id];
  const clientSecret = env[vars.secreto];
  if (!clientId || !clientSecret) return null;

  return proveedor === 'google'
    ? {
        autorizacion: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        scope: SCOPE_GOOGLE,
        clientId,
        clientSecret,
        redirectUri: redirectUri(supabaseUrl),
        // `access_type=offline` + `prompt=consent` son lo que hace que Google
        // entregue refresh_token; sin ellos solo da un access token de una hora.
        extraAutorizacion: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
      }
    : {
        // `common` sirve para cuentas personales Y de organización.
        autorizacion: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scope: SCOPE_MICROSOFT,
        clientId,
        clientSecret,
        redirectUri: redirectUri(supabaseUrl),
        extraAutorizacion: { prompt: 'select_account' },
      };
}

export function urlDeAutorizacion(cfg: ConfigOauth, state: string): string {
  const u = new URL(cfg.autorizacion);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('scope', cfg.scope);
  u.searchParams.set('state', state);
  for (const [k, v] of Object.entries(cfg.extraAutorizacion)) u.searchParams.set(k, v);
  return u.toString();
}

export function cuerpoDeFormulario(pares: Record<string, string>): string {
  return new URLSearchParams(pares).toString();
}

export function cuerpoDelIntercambio(cfg: ConfigOauth, code: string): string {
  return cuerpoDeFormulario({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });
}

export function cuerpoDelRefresco(cfg: ConfigOauth, refreshToken: string, scope = cfg.scope): string {
  return cuerpoDeFormulario({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    scope,
  });
}

export interface Tokens {
  access_token: string;
  refresh_token?: string;
  expires_at: string | null;
  scope?: string;
}

/**
 * Lo que devuelve el proveedor. `expires_at` se guarda como ISO y no como
 * duración a propósito: así el vencimiento no depende de cuándo se lea.
 */
export function tokensDeRespuesta(json: Record<string, unknown>, ahoraMs = Date.now()): Tokens {
  const access = String(json.access_token ?? '');
  if (!access) throw new Error('El proveedor no devolvió access_token');
  const segundos = Number(json.expires_in ?? 0);
  return {
    access_token: access,
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    // Sin `expires_in` se asume una hora, que es lo que dan los dos. Se
    // prefiere refrescar de más que fallar en medio de una bandeja.
    expires_at: new Date(ahoraMs + (segundos > 0 ? segundos : 3600) * 1000).toISOString(),
    scope: typeof json.scope === 'string' ? json.scope : undefined,
  };
}

/**
 * ¿Hay que refrescar? Se adelanta `margenMs` para no quedarse a medio camino:
 * un token que vence en 30 segundos ya no sirve para abrir un buzón.
 */
export function hayQueRefrescar(expiresAtIso: string | null | undefined, ahoraMs = Date.now(), margenMs = 120_000): boolean {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return true;
  return t - margenMs <= ahoraMs;
}

/** El sobre de credencial que se guarda cifrado cuando la cuenta es de OAuth. */
export interface CredencialOauth {
  tipo: 'oauth';
  refresh_token: string;
  access_token?: string;
  expires_at?: string | null;
  scope?: string;
}

/** Lee la credencial de una cuenta OAuth. Nunca lanza por datos incompletos. */
export function credencialDesdeBlob(blob: string): CredencialOauth | null {
  try {
    const j = JSON.parse(blob) as Record<string, unknown>;
    if (typeof j.refresh_token !== 'string' || !j.refresh_token) return null;
    return {
      tipo: 'oauth',
      refresh_token: j.refresh_token,
      access_token: typeof j.access_token === 'string' ? j.access_token : undefined,
      expires_at: typeof j.expires_at === 'string' ? j.expires_at : null,
      scope: typeof j.scope === 'string' ? j.scope : undefined,
    };
  } catch {
    return null;
  }
}

export function blobDesdeTokens(tokens: Tokens, refreshAnterior?: string): string {
  const refresh = tokens.refresh_token ?? refreshAnterior;
  if (!refresh) throw new Error('Sin refresh_token no hay forma de volver a entrar mañana');
  return JSON.stringify({
    tipo: 'oauth',
    refresh_token: refresh,
    access_token: tokens.access_token,
    expires_at: tokens.expires_at,
    scope: tokens.scope,
  } satisfies CredencialOauth);
}

/**
 * La cadena SASL de XOAUTH2 (RFC 7628 tal como la usan Google y Microsoft).
 * Los `\x01` no son separadores de adorno: el formato es exacto y con un
 * espacio en su lugar el servidor contesta AUTHENTICATIONFAILED.
 */
export function cadenaXoauth2(usuario: string, accessToken: string): string {
  return `user=${usuario}\x01auth=Bearer ${accessToken}\x01\x01`;
}

/** Lo que viaja en el comando: la cadena anterior en base64. */
export function saslXoauth2(usuario: string, accessToken: string): string {
  const cadena = cadenaXoauth2(usuario, accessToken);
  const bytes = new TextEncoder().encode(cadena);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** ¿Esta cuenta se autentica con OAuth? Se decide por el proveedor, no por la pantalla. */
export function proveedorOauthDe(proveedor: string | null | undefined): ProveedorOauth | null {
  if (proveedor === 'gmail') return 'google';
  if (proveedor === 'outlook') return 'microsoft';
  return null;
}

/**
 * Gmail archiva solo lo que sale por SMTP: si además hiciéramos APPEND a
 * Enviados, el correo aparecería dos veces. Se salta.
 */
export function requiereAppendAEnviados(proveedor: string | null | undefined): boolean {
  return proveedor !== 'gmail';
}

/** Nombres de carpeta de cada proveedor, para el mapa de roles del gestor. */
export const CARPETAS_POR_PROVEEDOR: Record<string, { enviados: string[]; papelera: string[]; spam: string[]; archivo: string[] }> = {
  gmail: { enviados: ['[Gmail]/Enviado', '[Gmail]/Sent Mail'], papelera: ['[Gmail]/Papelera', '[Gmail]/Trash'], spam: ['[Gmail]/Spam', '[Gmail]/Correo no deseado'], archivo: ['[Gmail]/Todos', '[Gmail]/All Mail'] },
  outlook: { enviados: ['Elementos enviados', 'Sent Items'], papelera: ['Elementos eliminados', 'Deleted Items'], spam: ['Correo no deseado', 'Junk Email'], archivo: ['Archivo', 'Archive'] },
};
