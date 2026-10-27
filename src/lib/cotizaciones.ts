// Cotizaciones de todos los cotizadores de MOVI en una sola tabla
// (`cotizaciones`, migración 20261027000001). Cada cotizador guarda aquí su
// estado completo en `datos` y la página Cotizar › Cotizaciones las lista,
// las reabre en su cotizador (?cotizacion=<id>), regenera el PDF y las envía.
import { supabase } from './supabase';

export type CotizadorId = 'gmm_multi' | 'auna_onco';

export interface CotizadorInfo {
  id: CotizadorId;
  label: string;
  ruta: string;
  logo: string | null;
  color: string;
}

export const COTIZADORES: Record<CotizadorId, CotizadorInfo> = {
  gmm_multi: { id: 'gmm_multi', label: 'Multicotizador GMM', ruta: '/cotizar/multicotizador-gmm', logo: '/logo-bupa.png', color: 'teal' },
  auna_onco: { id: 'auna_onco', label: 'Auna Oncológico', ruta: '/cotizar/auna-oncologico', logo: '/logo-auna.png', color: 'cyan' },
};

export interface EnvioCotizacion {
  canal: 'correo' | 'whatsapp';
  destino: string;
  at: string;
  usuario_id: string | null;
}

export interface Cotizacion<D = Record<string, unknown>> {
  id: string;
  folio: string;
  cotizador: CotizadorId;
  usuario_id: string;
  cliente_nombre: string;
  cliente_email: string | null;
  cliente_telefono: string | null;
  datos: D;
  resumen: Record<string, unknown>;
  prima_total: number | null;
  envios: EnvioCotizacion[];
  created_at: string;
  updated_at: string;
}

export interface GuardarCotizacion<D> {
  /** Sin id se crea (y recibe folio); con id se actualiza el mismo folio. */
  id?: string | null;
  cotizador: CotizadorId;
  cliente_nombre: string;
  cliente_email?: string | null;
  cliente_telefono?: string | null;
  datos: D;
  resumen?: Record<string, unknown>;
  prima_total?: number | null;
}

/** Guarda y devuelve id + folio. Lanza el error de Supabase si no escribió. */
export async function guardarCotizacion<D>(c: GuardarCotizacion<D>): Promise<{ id: string; folio: string }> {
  const fila = {
    cotizador: c.cotizador,
    cliente_nombre: c.cliente_nombre.trim() || 'Sin nombre',
    cliente_email: c.cliente_email ?? null,
    cliente_telefono: c.cliente_telefono ?? null,
    datos: c.datos,
    resumen: c.resumen ?? {},
    prima_total: c.prima_total ?? null,
  };
  if (c.id) {
    const { data, error } = await supabase.from('cotizaciones').update(fila).eq('id', c.id).select('id, folio').single();
    if (error) throw error;
    return data;
  }
  // El dueño es la sesión real, no el usuario "visto como" (la RLS exige auth.uid()).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sin sesión');
  const { data, error } = await supabase
    .from('cotizaciones')
    .insert({ ...fila, usuario_id: session.user.id })
    .select('id, folio')
    .single();
  if (error) throw error;
  return data;
}

export async function cargarCotizacion<D>(id: string): Promise<Cotizacion<D>> {
  const { data, error } = await supabase.from('cotizaciones').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Cotizacion<D>;
}

export async function listarCotizaciones(): Promise<Cotizacion[]> {
  const { data, error } = await supabase
    .from('cotizaciones')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Cotizacion[];
}

export async function eliminarCotizacion(id: string): Promise<void> {
  // Sin .select(): la fila ya borrada no pasa la política de lectura y el
  // RETURNING haría fallar el update. Se confirma con el conteo.
  const { count, error } = await supabase
    .from('cotizaciones')
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  if (!count) throw new Error('No tienes permiso para eliminar esta cotización');
}

export async function duplicarCotizacion(c: Cotizacion): Promise<{ id: string; folio: string }> {
  return guardarCotizacion({
    cotizador: c.cotizador,
    cliente_nombre: `${c.cliente_nombre} (copia)`,
    cliente_email: c.cliente_email,
    cliente_telefono: c.cliente_telefono,
    datos: c.datos,
    resumen: c.resumen,
    prima_total: c.prima_total,
  });
}

/** Texto legible de un error: los de Supabase son objetos, no `Error`. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** Lee ?cotizacion=<id> de la URL (para abrir una guardada en su cotizador). */
export function idCotizacionEnUrl(): string | null {
  return new URLSearchParams(window.location.search).get('cotizacion');
}
