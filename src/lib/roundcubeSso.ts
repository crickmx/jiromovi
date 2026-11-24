import { supabase } from './supabase';

interface RoundcubeHandoff {
  token: string;
  expires_at: string;
  handoff_path: string;
}

export class RoundcubeHandoffError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'RoundcubeHandoffError';
    this.code = code;
  }
}

// Deduplica solicitudes concurrentes: cada token SSO es de un solo uso y se
// consume al cargar el iframe, así que dos aperturas que se traslapan (doble
// render, clics rápidos, StrictMode en dev) deben compartir UNA sola petición
// en vez de quemar dos tokens contra el límite de tasa del edge function.
let inflightHandoff: Promise<RoundcubeHandoff> | null = null;

export async function createRoundcubeHandoff(): Promise<RoundcubeHandoff> {
  if (inflightHandoff) return inflightHandoff;

  inflightHandoff = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new RoundcubeHandoffError('No hay una sesión activa.', 'NO_SESSION');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roundcube-sso-token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new RoundcubeHandoffError(body.error || 'No se pudo abrir el correo.', body.error);
    }

    return body as RoundcubeHandoff;
  })();

  try {
    return await inflightHandoff;
  } finally {
    inflightHandoff = null;
  }
}

export async function getRoundcubeHandoffUrl(): Promise<string> {
  const handoff = await createRoundcubeHandoff();
  const base = (import.meta.env.VITE_ROUNDCUBE_URL || '/correo/').replace(/\/?$/, '/');
  return new URL(handoff.handoff_path, new URL(base, window.location.origin)).toString();
}

export async function closeRoundcubeSession(): Promise<void> {
  const base = (import.meta.env.VITE_ROUNDCUBE_URL || '/correo/').replace(/\/?$/, '/');
  const logoutUrl = new URL('?_task=logout', new URL(base, window.location.origin));

  try {
    await fetch(logoutUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    // El cierre de MOVI nunca debe quedar bloqueado si Roundcube no está
    // desplegado o está temporalmente fuera de servicio.
  }
}
