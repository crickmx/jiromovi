import { supabase } from './supabase';

export type Aula100msRole = 'instructor' | 'ponente' | 'estudiante' | 'observador' | 'recorder';

/** Solicita un token efímero; las credenciales administrativas nunca llegan al navegador. */
export async function solicitarToken100ms(input: {
  roomId: string;
  role: Aula100msRole;
  name: string;
}) {
  const { data, error } = await supabase.functions.invoke('aula-virtual-100ms', {
    body: { action: 'token', room_id: input.roomId, role: input.role, name: input.name },
  });
  if (error) throw error;
  if (!data?.token) throw new Error(data?.error || 'No se recibió el token de 100ms');
  return data as { token: string; room_id: string; role: Aula100msRole; expires_in: number };
}
