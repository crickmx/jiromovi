import { supabase } from './supabase';

// Mensaje único para cuando el navegador ya no tiene sesión de Supabase (lo
// típico: la pestaña se quedó dormida en el iPad y el token venció). Antes cada
// pantalla decía algo distinto —«No hay sesion activa», o nada y se quedaba en
// «no configurado»— y nadie sabía que bastaba con volver a entrar.
export const SESION_EXPIRADA = 'Tu sesión expiró. Recarga la página o vuelve a iniciar sesión.';

/** Token de la sesión real del navegador, o lanza `SESION_EXPIRADA`. */
export async function tokenDeSesion(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error(SESION_EXPIRADA);
  return session.access_token;
}
