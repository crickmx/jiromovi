import { supabase } from './supabase';
import {
  getTeamCategoryLabel,
  normalizeCategory,
  planearReglasDeEquipo,
  type TramiteTeamOption,
} from './tramiteTeamRules';

export * from './tramiteTeamRules';

/**
 * Equipos activos, con el área que tienen HOY.
 *
 * `area_categoria` es texto libre: una copia del nombre del área que se escribió
 * al guardar el equipo y que se queda congelada. Si después se renombra el área
 * —o se crea una nueva y se mueve el equipo ahí— esa copia sigue diciendo lo de
 * antes, y las categorías de esta pantalla se quedaban en el pasado. La fuente
 * de verdad es la FK `area_id` → `tramites_areas`; el texto solo sirve de
 * respaldo para los equipos viejos que nunca la llenaron.
 */
export async function loadActiveTramiteTeams(): Promise<TramiteTeamOption[]> {
  const { data, error } = await supabase
    .from('tramites_grupos_visualizacion')
    .select('id, nombre, color, area_categoria, area_id, area:tramites_areas(nombre)')
    .eq('activo', true)
    .order('nombre');

  if (error) throw error;

  type Fila = {
    id: string; nombre: string; color: string | null;
    area_categoria: string | null; area_id: string | null;
    area?: { nombre: string | null } | { nombre: string | null }[] | null;
  };

  return ((data ?? []) as Fila[]).map((row) => {
    const rel = Array.isArray(row.area) ? row.area[0] : row.area;
    return {
      id: row.id,
      nombre: row.nombre,
      color: row.color,
      area_categoria: rel?.nombre ?? row.area_categoria ?? null,
    };
  });
}

export async function loadUserTramiteTeamIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tramites_grupos_reglas')
    .select('grupo_id')
    .eq('usuario_id', userId)
    .eq('activo', true);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.grupo_id as string)));
}

/**
 * Guarda los equipos que ATIENDEN al agente.
 *
 * Un agente nunca es miembro operativo del equipo. La relación correcta vive
 * en tramites_grupos_reglas (agente + área -> equipo), no en
 * tramites_grupos_miembros (líderes/ejecutivos que trabajan dentro del equipo).
 */
export async function syncUserTramiteTeamAssignments(userId: string, selectedIds: string[]) {
  const uniqueIds = Array.from(new Set(selectedIds.filter(Boolean)));
  const { data: selectedTeams, error: teamsError } = await supabase
    .from('tramites_grupos_visualizacion')
    .select('id, area_categoria')
    .in('id', uniqueIds)
    .eq('activo', true);

  if (teamsError) throw teamsError;
  if ((selectedTeams ?? []).length !== uniqueIds.length) {
    throw new Error('Uno o más equipos seleccionados no existen o están inactivos');
  }

  const byCategory = new Map<string, { id: string; area: string }>();
  for (const team of selectedTeams ?? []) {
    const area = String(team.area_categoria ?? '').trim();
    if (!area) throw new Error('Todos los equipos seleccionados deben tener una categoría');
    const key = normalizeCategory(area);
    if (byCategory.has(key)) {
      throw new Error(`Selecciona solo un equipo para la categoría ${getTeamCategoryLabel(area)}`);
    }
    byCategory.set(key, { id: team.id as string, area });
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('tramites_grupos_reglas')
    .select('id, grupo_id, area, ejecutivo_id, activo')
    .eq('usuario_id', userId);

  if (existingError) throw existingError;

  const plan = planearReglasDeEquipo(existingRows ?? [], byCategory);

  for (const paso of plan.actualizar) {
    const { error } = await supabase
      .from('tramites_grupos_reglas')
      .update({
        grupo_id: paso.grupo_id,
        area: paso.area,
        activo: true,
        ...(paso.limpiarEjecutivo ? { ejecutivo_id: null } : {}),
      })
      .eq('id', paso.id);
    if (error) throw error;
  }

  for (const paso of plan.insertar) {
    const { error } = await supabase
      .from('tramites_grupos_reglas')
      .insert({ usuario_id: userId, grupo_id: paso.grupo_id, area: paso.area, activo: true });
    if (error) throw error;
  }

  if (plan.desactivar.length > 0) {
    const { error } = await supabase
      .from('tramites_grupos_reglas')
      .update({ activo: false })
      .in('id', plan.desactivar);
    if (error) throw error;
  }

  // Limpia cualquier pertenencia incorrecta creada por versiones anteriores.
  const { error: membershipError } = await supabase
    .from('tramites_grupos_miembros')
    .delete()
    .eq('usuario_id', userId);
  if (membershipError) throw membershipError;
}
