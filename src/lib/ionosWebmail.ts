import { supabase } from './supabase';

// Cliente del edge function `ionos-webmail` (método de correo nativo/legacy).
// Se extrajo de GestorEmails.tsx para poder reutilizarlo también desde el
// selector de destinatarios (contactos IONOS).
export async function callWebmail(action: string, params: Record<string, unknown> = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesion activa');

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ionos-webmail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    },
  );

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.message || 'Error del servidor');
  return data;
}
