// Quién puede administrar un módulo por pertenecer a un equipo de trámites.
//
// MOVI Store y Marketing Admin resuelven lo mismo —"los miembros de estos
// equipos administran el módulo, igual que un Administrador"— con la misma
// consulta sobre dos tablas gemelas. Estaba escrito dos veces: `storeUtils.ts`
// tenía cuatro funciones y `mktUtils.ts` una copia literal de dos, con el
// nombre de la tabla cambiado. Por eso Marketing nunca tuvo el equivalente de
// `esLiderDeEquipoConAccesoStore`: no es que se decidiera, es que la copia se
// hizo a medias.
//
// Las tablas se conservan separadas a propósito: dar acceso a Store no debe dar
// acceso a Marketing.

import { supabase } from './supabase';

/** Tablas de acceso por módulo. Agregar un módulo nuevo es una línea aquí. */
export const TABLA_ACCESO = {
  store: 'store_equipos_acceso',
  mkt: 'mkt_equipos_acceso',
} as const;

export type ModuloConAcceso = keyof typeof TABLA_ACCESO;

/** Equipos a los que se les dio acceso a este módulo. */
export async function gruposConAcceso(modulo: ModuloConAcceso): Promise<string[]> {
  const { data } = await supabase.from(TABLA_ACCESO[modulo]).select('grupo_id');
  return (data ?? []).map(r => r.grupo_id as string);
}

/** ¿El usuario pertenece a algún equipo con acceso a este módulo? */
export async function tieneAccesoEquipo(modulo: ModuloConAcceso, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const grupos = await gruposConAcceso(modulo);
  if (grupos.length === 0) return false;
  const { count } = await supabase
    .from('tramites_grupos_miembros')
    .select('grupo_id', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .in('grupo_id', grupos);
  return (count ?? 0) > 0;
}

/**
 * ¿Es líder de un equipo con acceso?
 *
 * Ojo con el glosario: `rol_en_equipo` es el rol DENTRO del equipo, un eje
 * aparte de `usuarios.rol`. Un Empleado puede ser líder.
 */
export async function esLiderDeEquipoConAcceso(modulo: ModuloConAcceso, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const grupos = await gruposConAcceso(modulo);
  if (grupos.length === 0) return false;
  const { count } = await supabase
    .from('tramites_grupos_miembros')
    .select('grupo_id', { count: 'exact', head: true })
    .eq('usuario_id', userId)
    .eq('rol_en_equipo', 'lider')
    .in('grupo_id', grupos);
  return (count ?? 0) > 0;
}

/** Todos los usuarios que administran el módulo por equipo (para notificar). */
export async function miembrosConAcceso(modulo: ModuloConAcceso): Promise<string[]> {
  const grupos = await gruposConAcceso(modulo);
  if (grupos.length === 0) return [];
  const { data } = await supabase
    .from('tramites_grupos_miembros')
    .select('usuario_id')
    .in('grupo_id', grupos);
  return [...new Set((data ?? []).map(r => r.usuario_id as string))];
}
