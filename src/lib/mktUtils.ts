import { supabase } from './supabase';

export async function obtenerGruposConAccesoMkt(): Promise<string[]> {
  const { data } = await supabase.from('mkt_equipos_acceso').select('grupo_id');
  return (data ?? []).map(r => r.grupo_id);
}

export async function tieneAccesoEquipoMkt(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const grupos = await obtenerGruposConAccesoMkt();
  if (grupos.length === 0) return false;
  const { count } = await supabase
    .from('tramites_grupos_miembros')
    .select('grupo_id', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .in('grupo_id', grupos);
  return (count ?? 0) > 0;
}
