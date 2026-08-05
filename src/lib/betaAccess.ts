import { supabase } from './supabase';

export const PROD_ORIGIN = 'https://app.movi.digital';
export const BETA_ORIGIN = 'https://beta.movi.digital';

const SKIP_BETA_KEY = 'movi_skip_beta_redirect';

export function isBetaHost(): boolean {
  return window.location.hostname === 'beta.movi.digital';
}

export function skipBetaRedirectActive(): boolean {
  return sessionStorage.getItem(SKIP_BETA_KEY) === '1';
}

/** Arma la URL de destino (mismo path actual) llevando la sesión por query params. */
export async function crossDomainUrl(targetOrigin: string, extraParams?: Record<string, string>): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = new URL(window.location.pathname + window.location.search, targetOrigin);
  if (session) {
    url.searchParams.set('movi_at', session.access_token);
    url.searchParams.set('movi_rt', session.refresh_token);
  }
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
  }
  return url.toString();
}

/**
 * Al cargar la app: si venimos de un redirect entre subdominios, recupera la
 * sesión de los query params y limpia la URL. Llamar una sola vez, antes de
 * cualquier otra lectura de sesión de Supabase.
 */
export async function consumeIncomingSession(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const at = params.get('movi_at');
  const rt = params.get('movi_rt');
  const skip = params.get('skip_beta');

  if (skip === '1') sessionStorage.setItem(SKIP_BETA_KEY, '1');

  if (at && rt) {
    await supabase.auth.setSession({ access_token: at, refresh_token: rt });
  }

  if (at || rt || skip) {
    params.delete('movi_at');
    params.delete('movi_rt');
    params.delete('skip_beta');
    const clean = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState({}, '', clean);
  }
}
