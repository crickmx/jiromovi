import { supabase } from './supabase';

/**
 * Enlace de usuarios MOVI con "usuarios SICAS" (catálogo de vendedores).
 *
 * La fuente es `sicas_vendor_user_mappings` (el mismo catálogo que usa Mapeo
 * Vendedores). Cada vendedor trae:
 *   - vend_id      → ID SICAS (coincide con usuarios.id_sicas)
 *   - vend_nombre  → nombre completo en formato APELLIDOS PRIMERO
 *                    ("RAMOS NORIEGA MARCO ANTONIO" = apellidos "RAMOS NORIEGA",
 *                     nombre "MARCO ANTONIO").
 *   - desp_nombre  → despacho/oficina SICAS ("LEON", "TOLUCA", ...).
 *   - movi_user_id → usuario MOVI ya vinculado (si lo hay).
 *
 * Este archivo concentra el parseo de nombre, el slug y el match aproximado de
 * oficina para que la lógica no se duplique en el modal de usuarios.
 */

export interface SicasVendorOption {
  /** uuid de la fila de `sicas_vendor_user_mappings` (para `link_vendor_to_user`). Vacío si el vendedor solo existe en el catálogo del Excel. */
  id: string;
  /** ID de SICAS. Vacío si el vendedor solo existe en el catálogo del Excel. */
  vend_id: string;
  vend_nombre: string;
  desp_nombre: string | null;
  movi_user_id: string | null;
  status: string;
  /** Id en `maestro_agentes` cuando el vendedor viene del catálogo del Excel y no tiene contraparte en SICAS. */
  agente_id?: string | null;
}

export interface OficinaLite {
  id: string;
  nombre: string;
}

export interface ParsedSicasName {
  nombre: string;
  apellidos: string;
  primerApellido: string;
  segundoApellido: string;
  nombreTokens: string[];
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Parte el nombre SICAS (apellidos primero) en nombre + apellidos.
 * Heurística (mejor esfuerzo, siempre editable por el admin):
 *   - 1 palabra  → todo es nombre.
 *   - 2 palabras → 1er apellido + nombre.
 *   - 3+ palabras → 2 apellidos (paterno/materno) + resto nombre(s).
 * Antes limpia sufijos de duplicado tipo "-2", "-QRO", "-GDL".
 */
export function parseSicasVendorName(vendNombreRaw: string | null | undefined): ParsedSicasName {
  const cleaned = (vendNombreRaw || '')
    .replace(/-[0-9A-Za-z]{1,4}$/, '') // sufijo de duplicado SICAS
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned ? cleaned.split(' ') : [];

  let apellidoTokens: string[] = [];
  let nombreTokens: string[] = [];

  if (tokens.length <= 1) {
    nombreTokens = tokens;
  } else if (tokens.length === 2) {
    apellidoTokens = [tokens[0]];
    nombreTokens = [tokens[1]];
  } else {
    apellidoTokens = tokens.slice(0, 2);
    nombreTokens = tokens.slice(2);
  }

  return {
    nombre: nombreTokens.join(' '),
    apellidos: apellidoTokens.join(' '),
    primerApellido: apellidoTokens[0] || '',
    segundoApellido: apellidoTokens[1] || '',
    nombreTokens,
  };
}

/**
 * Slug = inicial del nombre + primer apellido + inicial del segundo apellido.
 * Ej: "RAMOS NORIEGA MARCO ANTONIO" → "mramosn".
 * Normaliza a minúsculas sin acentos ni caracteres especiales.
 */
export function computeSicasSlug(parsed: ParsedSicasName): string {
  const raw =
    (parsed.nombreTokens[0]?.[0] || '') +
    (parsed.primerApellido || '') +
    (parsed.segundoApellido?.[0] || '');
  return stripAccents(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeOficina(s: string): string {
  return stripAccents(s)
    .toUpperCase()
    .replace(/^JIRO\s+/, '') // "Jiro León" → "LEON"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match aproximado despacho SICAS → oficina MOVI por nombre.
 * Los nombres no coinciden literal ("LEON" vs "Jiro León"), así que se compara
 * la parte núcleo. Se elige el match cuyo núcleo sea el más largo posible
 * (evita quedarse con coincidencias parciales cortas). Devuelve null si no hay
 * ninguna coincidencia razonable; el admin la elige a mano.
 */
export function matchOficinaId(despNombre: string | null | undefined, oficinas: OficinaLite[]): string | null {
  if (!despNombre) return null;
  const desp = normalizeOficina(despNombre);
  if (!desp) return null;

  let bestId: string | null = null;
  let bestLen = 0;

  for (const o of oficinas) {
    const core = normalizeOficina(o.nombre);
    if (!core) continue;
    const matched = core === desp || desp.includes(core) || core.includes(desp);
    if (matched && core.length > bestLen) {
      bestId = o.id;
      bestLen = core.length;
    }
  }

  return bestId;
}

/**
 * Busca un vendedor para enlazar, en los DOS catálogos.
 *
 * `sicas_vendor_user_mappings` lo llena la sincronización de SICAS (hoy
 * pausada) y `maestro_agentes` el Excel que se sube en Admin › Base de Datos.
 * Buscar solo en el primero dejaba fuera a todo vendedor que solo existiera en
 * el Excel — y entonces el enlace "no aparecía" sin motivo visible.
 *
 * Los que ya están emparejados traen `vend_id`, así que pedir del Excel solo
 * los que NO lo tienen evita que el mismo vendedor salga dos veces.
 */
export async function searchSicasVendors(term: string): Promise<SicasVendorOption[]> {
  const safe = term.replace(/[,%()]/g, ' ').trim();

  let qSicas = supabase
    .from('sicas_vendor_user_mappings')
    .select('id, vend_id, vend_nombre, desp_nombre, movi_user_id, status')
    .in('status', ['active', 'pending_review'])
    .order('vend_nombre', { ascending: true })
    .limit(20);
  if (safe) qSicas = qSicas.or(`vend_nombre.ilike.%${safe}%,vend_id.ilike.%${safe}%`);

  let qExcel = supabase
    .from('maestro_agentes')
    .select('id, nombre, maestro_despachos(nombre), maestro_usuario_agente(user_id, activo)')
    .is('vend_id', null)
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .limit(20);
  if (safe) qExcel = qExcel.ilike('nombre', `%${safe}%`);

  const [sicas, excel] = await Promise.all([qSicas, qExcel]);
  if (sicas.error) console.error('Error buscando vendedores SICAS:', sicas.error);
  if (excel.error) console.error('Error buscando agentes del catálogo:', excel.error);

  const delExcel: SicasVendorOption[] = ((excel.data ?? []) as unknown as RawAgente[]).map(a => ({
    id: '',
    vend_id: '',
    vend_nombre: a.nombre,
    desp_nombre: a.maestro_despachos?.nombre ?? null,
    movi_user_id: (a.maestro_usuario_agente ?? []).find(m => m.activo)?.user_id ?? null,
    status: 'active',
    agente_id: a.id,
  }));

  return [...((sicas.data ?? []) as SicasVendorOption[]), ...delExcel];
}

interface RawAgente {
  id: string;
  nombre: string;
  maestro_despachos?: { nombre: string } | null;
  maestro_usuario_agente?: { user_id: string; activo: boolean }[] | null;
}

/**
 * Enlaza el usuario con un vendedor que solo existe en el catálogo del Excel.
 *
 * El RPC de SICAS no aplica (no hay `vend_id`), así que se escribe directo el
 * mapeo de trámites, que es la misma tabla que usa la pestaña "Mapeo MOVI ↔
 * Agente".
 */
export async function vincularAgenteDelCatalogo(agenteId: string, moviUserId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('maestro_usuario_agente')
    .upsert({ user_id: moviUserId, agente_id: agenteId, activo: true }, { onConflict: 'user_id' });
  if (error) {
    console.error('Error vinculando agente del catálogo:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Trae un vendedor SICAS por su vend_id (para prellenar el chip al editar). */
export async function getSicasVendorByVendId(vendId: string): Promise<SicasVendorOption | null> {
  const { data, error } = await supabase
    .from('sicas_vendor_user_mappings')
    .select('id, vend_id, vend_nombre, desp_nombre, movi_user_id, status')
    .eq('vend_id', vendId)
    .order('status', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error cargando vendedor SICAS:', error);
    return null;
  }
  return (data as SicasVendorOption) || null;
}

/** Desvincula un vendedor SICAS de un usuario MOVI de forma unificada */
export async function unlinkSicasVendor(params: { vendorId?: string; moviUserId?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('unlink_vendor_from_user', {
      p_vendor_id: params.vendorId || null,
      p_movi_user_id: params.moviUserId || null,
    });

    if (error) throw error;
    return { success: true, ...data };
  } catch (err: any) {
    console.error('Error desvinculando vendedor SICAS:', err);
    return { success: false, error: err?.message || 'Error al desvincular' };
  }
}


/** El agente del catálogo al que ya está mapeado un usuario, para prellenar el chip. */
export async function agenteDelCatalogoDeUsuario(moviUserId: string): Promise<SicasVendorOption | null> {
  const { data } = await supabase
    .from('maestro_usuario_agente')
    .select('agente_id, maestro_agentes(id, nombre, vend_id, maestro_despachos(nombre))')
    .eq('user_id', moviUserId)
    .eq('activo', true)
    .maybeSingle();

  const a = (data as unknown as { maestro_agentes?: RawAgente & { vend_id?: string | null } } | null)?.maestro_agentes;
  if (!a) return null;
  return {
    id: '',
    vend_id: a.vend_id ?? '',
    vend_nombre: a.nombre,
    desp_nombre: a.maestro_despachos?.nombre ?? null,
    movi_user_id: moviUserId,
    status: 'active',
    agente_id: a.id,
  };
}
