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
    .from('tramites_grupos_miembros')
    .select('grupo_id')
    .eq('usuario_id', userId);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.grupo_id as string)));
}

export async function syncUserTramiteTeamMemberships(userId: string, selectedIds: string[]) {
  const uniqueIds = Array.from(new Set(selectedIds.filter(Boolean)));
  const { data: existingRows, error: existingError } = await supabase
    .from('tramites_grupos_miembros')
    .select('grupo_id')
    .eq('usuario_id', userId);

  if (existingError) throw existingError;

  const existingIds = Array.from(new Set((existingRows ?? []).map((row) => row.grupo_id as string)));
  const existingSet = new Set(existingIds);
  const selectedSet = new Set(uniqueIds);

  const toAdd = uniqueIds.filter((id) => !existingSet.has(id));
  const toRemove = existingIds.filter((id) => !selectedSet.has(id));

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase
      .from('tramites_grupos_miembros')
      .insert(toAdd.map((grupoId) => ({ grupo_id: grupoId, usuario_id: userId })));

    if (insertError) throw insertError;
  }

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('tramites_grupos_miembros')
      .delete()
      .eq('usuario_id', userId)
      .in('grupo_id', toRemove);

    if (deleteError) throw deleteError;
  }
}
