import { supabase } from './supabase';

export interface TramiteTeamOption {
  id: string;
  nombre: string;
  color: string | null;
  area_categoria: string | null;
}

export interface TramiteTeamCategory {
  key: string;
  label: string;
  teams: TramiteTeamOption[];
}

const CATEGORY_PRIORITY = [
  'administracion',
  'comercial',
  'mercadotecnia',
  'operaciones',
  'sistemas',
];

const CATEGORY_LABELS: Record<string, string> = {
  administracion: 'Administración',
  comercial: 'Comercial',
  mercadotecnia: 'Mercadotecnia',
  operaciones: 'Operaciones',
  sistemas: 'Sistemas',
};

function normalizeCategory(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getTeamCategoryLabel(value: string | null | undefined) {
  if (!value || !value.trim()) return 'Sin categoría';
  const key = normalizeCategory(value);
  return CATEGORY_LABELS[key] || value.trim();
}

export function groupTramiteTeamsByCategory(teams: TramiteTeamOption[]): TramiteTeamCategory[] {
  const grouped = new Map<string, TramiteTeamOption[]>();

  for (const team of teams) {
    const key = normalizeCategory(team.area_categoria);
    const bucketKey = key || '__sin_categoria__';
    const bucket = grouped.get(bucketKey) ?? [];
    bucket.push(team);
    grouped.set(bucketKey, bucket);
  }

  const ordered = Array.from(grouped.entries()).sort(([a], [b]) => {
    const aIdx = CATEGORY_PRIORITY.indexOf(a);
    const bIdx = CATEGORY_PRIORITY.indexOf(b);
    if (aIdx !== -1 || bIdx !== -1) {
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    }
    if (a === '__sin_categoria__') return 1;
    if (b === '__sin_categoria__') return -1;
    return (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b, 'es');
  });

  return ordered.map(([key, categoryTeams]) => ({
    key,
    label: key === '__sin_categoria__' ? 'Sin categoría' : getTeamCategoryLabel(categoryTeams[0]?.area_categoria ?? key),
    teams: categoryTeams.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  }));
}

export function validateTramiteTeamSelection(teams: TramiteTeamOption[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  const groups = groupTramiteTeamsByCategory(teams);
  const missingCategories = groups
    .filter((group) => group.teams.some((team) => selected.has(team.id)) === false)
    .map((group) => group.label);

  return {
    ready: true,
    valid: missingCategories.length === 0,
    missingCategories,
    categories: groups,
  };
}

export async function loadActiveTramiteTeams(): Promise<TramiteTeamOption[]> {
  const { data, error } = await supabase
    .from('tramites_grupos_visualizacion')
    .select('id, nombre, color, area_categoria')
    .eq('activo', true)
    .order('nombre');

  if (error) throw error;
  return (data ?? []) as TramiteTeamOption[];
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
    .select('id, grupo_id, area, ejecutivo_id')
    .eq('usuario_id', userId);

  if (existingError) throw existingError;

  for (const [categoryKey, selection] of byCategory) {
    const existing = (existingRows ?? []).find((row) => normalizeCategory(row.area) === categoryKey);
    if (existing) {
      const groupChanged = existing.grupo_id !== selection.id;
      const { error } = await supabase
        .from('tramites_grupos_reglas')
        .update({
          grupo_id: selection.id,
          area: selection.area,
          activo: true,
          ...(groupChanged ? { ejecutivo_id: null } : {}),
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('tramites_grupos_reglas')
        .insert({ usuario_id: userId, grupo_id: selection.id, area: selection.area, activo: true });
      if (error) throw error;
    }
  }

  const selectedCategories = new Set(byCategory.keys());
  const staleIds = (existingRows ?? [])
    .filter((row) => !selectedCategories.has(normalizeCategory(row.area)))
    .map((row) => row.id as string);
  if (staleIds.length > 0) {
    const { error } = await supabase
      .from('tramites_grupos_reglas')
      .update({ activo: false })
      .in('id', staleIds);
    if (error) throw error;
  }

  // Limpia cualquier pertenencia incorrecta creada por versiones anteriores.
  const { error: membershipError } = await supabase
    .from('tramites_grupos_miembros')
    .delete()
    .eq('usuario_id', userId);
  if (membershipError) throw membershipError;
}
