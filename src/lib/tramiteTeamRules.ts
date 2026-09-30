// Reglas puras del emparejado de equipos de trámite por usuario.
//
// Vive aparte de `tramiteTeamAssignments.ts` para poder comprobarse sin cliente
// de Supabase ni navegador (ver `tramiteTeamRules.test.mjs`). Ese archivo
// lo reexporta, así que nadie más tiene que cambiar de import.

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

/**
 * Roles que pueden tener equipos de trámite asignados.
 *
 * Un Administrador también levanta trámites y las reglas del motor se resuelven
 * por agente + área igual que con un Agente, así que necesita su asignación.
 * Lo que NO comparte es la exigencia de cubrir todas las categorías: eso se
 * sigue pidiendo solo al Agente (ver `mustValidateTramiteTeams`).
 */
export const ROLES_CON_EQUIPOS_TRAMITE = ['Agente', 'Administrador'];

export function puedeTenerEquiposTramite(rol: string | null | undefined): boolean {
  return ROLES_CON_EQUIPOS_TRAMITE.includes((rol ?? '').trim());
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

export function normalizeCategory(value: string | null | undefined) {
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

export interface ReglaEquipoExistente {
  id: string;
  grupo_id: string;
  area: string | null;
  activo?: boolean | null;
}

export interface PlanReglasEquipo {
  actualizar: { id: string; grupo_id: string; area: string; limpiarEjecutivo: boolean }[];
  insertar: { grupo_id: string; area: string }[];
  desactivar: string[];
}

/**
 * Decide qué regla se reusa para cada equipo elegido.
 *
 * La clave es buscar primero por EQUIPO y no por área. `tramites_grupos_reglas.area`
 * guarda el nombre del área como texto: si el área se renombra, o el equipo se
 * mueve a otra, ese texto queda viejo. Emparejando por área no se encontraba la
 * regla que ya existía, se insertaba otra —quedaban dos— y el ejecutivo que
 * alguien había asignado a mano se perdía. Por equipo, la configuración se
 * mantiene y de paso se refresca el nombre del área.
 *
 * Se separa del guardado porque es la única decisión no evidente de todo esto.
 */
export function planearReglasDeEquipo(
  existentes: ReglaEquipoExistente[],
  porCategoria: Map<string, { id: string; area: string }>,
): PlanReglasEquipo {
  // Las activas primero: si quedó una vieja desactivada del mismo equipo, se
  // reutiliza la que está en uso, no la de la basura.
  const filas = [...existentes].sort((a, b) => Number(!!b.activo) - Number(!!a.activo));
  const reutilizadas = new Set<string>();
  const plan: PlanReglasEquipo = { actualizar: [], insertar: [], desactivar: [] };

  for (const [categoryKey, seleccion] of porCategoria) {
    const porEquipo = filas.find((row) => !reutilizadas.has(row.id) && row.grupo_id === seleccion.id);
    const existente = porEquipo
      ?? filas.find((row) => !reutilizadas.has(row.id) && normalizeCategory(row.area) === categoryKey);

    if (existente) {
      reutilizadas.add(existente.id);
      plan.actualizar.push({
        id: existente.id,
        grupo_id: seleccion.id,
        area: seleccion.area,
        limpiarEjecutivo: existente.grupo_id !== seleccion.id,
      });
    } else {
      plan.insertar.push({ grupo_id: seleccion.id, area: seleccion.area });
    }
  }

  // Todo lo que no se reutilizó sobra: reglas de equipos que ya no se eligieron
  // y duplicados que dejaron las versiones anteriores.
  plan.desactivar = filas.filter((row) => !reutilizadas.has(row.id)).map((row) => row.id);
  return plan;
}
