import { supabase } from './supabase';

/**
 * Oficinas que un Gerente puede ver/gestionar: su oficina principal
 * (usuarios.oficina_id) más las adicionales asignadas por un Administrador
 * (usuario_oficinas_adicionales). Para cualquier otro rol regresa [] -- el
 * llamador debe interpretar un arreglo vacío como "no filtrar por oficina".
 */
export async function getOficinasDeGerente(usuario: {
  id: string;
  rol: string;
  oficina_id?: string | null;
}): Promise<string[]> {
  if (usuario.rol !== 'Gerente') return [];

  const principal = usuario.oficina_id ? [usuario.oficina_id] : [];

  const { data } = await supabase
    .from('usuario_oficinas_adicionales')
    .select('oficina_id')
    .eq('usuario_id', usuario.id);

  const adicionales = (data || []).map(r => r.oficina_id as string);

  return Array.from(new Set([...principal, ...adicionales]));
}
