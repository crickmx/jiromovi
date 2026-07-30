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
  id: string; // uuid de la fila del mapeo (para link_vendor_to_user)
  vend_id: string;
  vend_nombre: string;
  desp_nombre: string | null;
  movi_user_id: string | null;
  status: string;
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

/** Busca vendedores SICAS por nombre o ID (activos / pendientes de revisión). */
export async function searchSicasVendors(term: string): Promise<SicasVendorOption[]> {
  let query = supabase
    .from('sicas_vendor_user_mappings')
    .select('id, vend_id, vend_nombre, desp_nombre, movi_user_id, status')
    .in('status', ['active', 'pending_review'])
    .order('vend_nombre', { ascending: true })
    .limit(20);

  const safe = term.replace(/[,%()]/g, ' ').trim();
  if (safe) {
    query = query.or(`vend_nombre.ilike.%${safe}%,vend_id.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error buscando vendedores SICAS:', error);
    return [];
  }
  return (data || []) as SicasVendorOption[];
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
