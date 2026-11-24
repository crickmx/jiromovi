import { supabase } from './supabase';

/**
 * Etiquetas de contenido: tres niveles fijos (aseguradora → ramo → subramo)
 * más etiquetas libres. Sirven para clasificar clases del Aula Virtual y
 * lecciones de On Demand, y para filtrar el directorio.
 */
export type TipoEtiqueta = 'aseguradora' | 'ramo' | 'subramo' | 'libre';

export interface Etiqueta {
  id: string;
  tipo: TipoEtiqueta;
  nombre: string;
  slug: string;
  padre_id: string | null;
}

export const ORDEN_TIPOS: TipoEtiqueta[] = ['aseguradora', 'ramo', 'subramo', 'libre'];

export const NOMBRE_TIPO: Record<TipoEtiqueta, string> = {
  aseguradora: 'Aseguradora',
  ramo: 'Ramo',
  subramo: 'Subramo',
  libre: 'Otra etiqueta',
};

export function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Todas las etiquetas, ordenadas por tipo y nombre. */
export async function cargarEtiquetas(): Promise<Etiqueta[]> {
  const { data, error } = await supabase
    .from('seguros_etiquetas')
    .select('id, tipo, nombre, slug, padre_id')
    .order('nombre');

  if (error) throw error;
  const lista = (data ?? []) as Etiqueta[];
  return lista.sort((a, b) => {
    const t = ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo);
    return t !== 0 ? t : a.nombre.localeCompare(b.nombre, 'es');
  });
}

/** Crea la etiqueta si no existe (mismo tipo y mismo nombre). */
export async function crearEtiqueta(
  tipo: TipoEtiqueta,
  nombre: string,
  padreId: string | null = null,
): Promise<Etiqueta> {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (!limpio) throw new Error('La etiqueta necesita un nombre');

  const { data: existente } = await supabase
    .from('seguros_etiquetas')
    .select('id, tipo, nombre, slug, padre_id')
    .eq('tipo', tipo)
    .ilike('nombre', limpio)
    .maybeSingle();

  if (existente) return existente as Etiqueta;

  const { data, error } = await supabase
    .from('seguros_etiquetas')
    .insert({ tipo, nombre: limpio, slug: slugify(limpio), padre_id: padreId })
    .select('id, tipo, nombre, slug, padre_id')
    .single();

  if (error) throw error;
  return data as Etiqueta;
}

/** Etiquetas asignadas a un conjunto de lecciones. */
export async function etiquetasDeLecciones(ids: string[]): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('seguros_leccion_etiquetas')
    .select('leccion_id, etiqueta_id')
    .in('leccion_id', ids);

  const mapa: Record<string, string[]> = {};
  for (const fila of (data ?? []) as { leccion_id: string; etiqueta_id: string }[]) {
    (mapa[fila.leccion_id] ??= []).push(fila.etiqueta_id);
  }
  return mapa;
}

/** Etiquetas asignadas a un conjunto de eventos de Aula Virtual. */
export async function etiquetasDeEventos(ids: string[]): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('aula_evento_etiquetas')
    .select('evento_id, etiqueta_id')
    .in('evento_id', ids);

  const mapa: Record<string, string[]> = {};
  for (const fila of (data ?? []) as { evento_id: string; etiqueta_id: string }[]) {
    (mapa[fila.evento_id] ??= []).push(fila.etiqueta_id);
  }
  return mapa;
}

export async function guardarEtiquetasLeccion(leccionId: string, ids: string[]) {
  const { error: borrado } = await supabase
    .from('seguros_leccion_etiquetas')
    .delete()
    .eq('leccion_id', leccionId);
  if (borrado) throw borrado;
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('seguros_leccion_etiquetas')
    .insert(ids.map((etiqueta_id) => ({ leccion_id: leccionId, etiqueta_id })));
  if (error) throw error;
}

export async function guardarEtiquetasEvento(eventoId: string, ids: string[]) {
  const { error: borrado } = await supabase
    .from('aula_evento_etiquetas')
    .delete()
    .eq('evento_id', eventoId);
  if (borrado) throw borrado;
  if (ids.length === 0) return;

  const { error } = await supabase
    .from('aula_evento_etiquetas')
    .insert(ids.map((etiqueta_id) => ({ evento_id: eventoId, etiqueta_id })));
  if (error) throw error;
}

/** Junta las etiquetas de una lista con sus datos completos. */
export function resolverEtiquetas(
  ids: string[] | undefined,
  catalogo: Etiqueta[],
): Etiqueta[] {
  if (!ids?.length) return [];
  const porId = new Map(catalogo.map((e) => [e.id, e]));
  return ids.map((id) => porId.get(id)).filter((e): e is Etiqueta => !!e);
}

/** Texto de filtro: "qualitas" encuentra "Quálitas". */
export function coincide(texto: string, busqueda: string) {
  const normal = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normal(texto).includes(normal(busqueda));
}