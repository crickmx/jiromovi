import { supabase } from './supabase';

interface RoundcubeHandoff {
  token: string;
  expires_at: string;
  handoff_path: string;
}

export async function createRoundcubeHandoff(): Promise<RoundcubeHandoff> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay una sesión activa.');

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

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'No se pudo abrir el correo.');
  }

  return body as RoundcubeHandoff;
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
