import { supabase } from './supabase';
import { getOficinasDeGerente } from './oficinasUtils';

/**
 * Qué trámites le tocan a cada rol (misma regla que la política `tickets_select_v10`):
 *   Administrador → todos.
 *   Gerente       → los de sus oficinas (principal + adicionales) + sus equipos + lo suyo.
 *   Empleado      → todo lo de sus equipos + lo suyo.
 *   Agente        → solo lo suyo.
 *
 * En una sesión normal la base ya filtra sola, y la pantalla no tiene que hacer nada.
 * Esto existe para "Vista Admin — Viendo como": ahí el JWT sigue siendo el del
 * Administrador, la RLS lo deja ver todo, y hay que reproducir a mano lo que vería
 * la persona impersonada. Devuelve el filtro para `.or(...)` de PostgREST, o null
 * si no hay que filtrar.
 *
 * Diferencia conocida con la RLS: aquí no se excluyen los reportes de bug propios.
 */
const COLUMNAS_PERSONA = [
  'creado_por',
  'agente_id',
  'agente_usuario_id',
  'attending_user_id',
  'assigned_to_user_id',
] as const;

export async function filtroTramitesVistaComo(persona: {
  id: string;
  rol?: string | null;
  oficina_id?: string | null;
}): Promise<string | null> {
  const rol = persona.rol || '';
  if (rol === 'Administrador') return null;

  const partes: string[] = COLUMNAS_PERSONA.map(col => `${col}.eq.${persona.id}`);

  const { data: grupos } = await supabase
    .from('tramites_grupos_miembros')
    .select('grupo_id')
    .eq('usuario_id', persona.id);
  const grupoIds = (grupos || []).map(g => g.grupo_id as string);
  if (grupoIds.length > 0) partes.push(`grupo_asignado_id.in.(${grupoIds.join(',')})`);

  if (rol === 'Gerente') {
    const oficinas = await getOficinasDeGerente({ id: persona.id, rol, oficina_id: persona.oficina_id });
    if (oficinas.length > 0) {
      const { data: gente } = await supabase.from('usuarios').select('id').in('oficina_id', oficinas);
      const ids = (gente || []).map(u => u.id as string);
      if (ids.length > 0) {
        for (const col of COLUMNAS_PERSONA) partes.push(`${col}.in.(${ids.join(',')})`);
      }
    }
  }

  return partes.join(',');
}
