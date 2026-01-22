import { supabase } from './supabase';
import type {
  VendorMapping,
  UnmatchedVendor,
  VendorMappingApplyResult,
  VendorAssignmentResult,
  VendorMappingSourceType,
  VendorMappingStatus,
} from './vendorMappingTypes';

export async function obtenerVendorMappings(status?: VendorMappingStatus): Promise<VendorMapping[]> {
  let query = supabase
    .from('vendor_mappings')
    .select(`
      *,
      usuarios:movi_user_id (
        nombre_completo,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as VendorMapping[];
}

export async function obtenerVendorMapping(id: string): Promise<VendorMapping> {
  const { data, error } = await supabase
    .from('vendor_mappings')
    .select(`
      *,
      usuarios:movi_user_id (
        nombre_completo,
        email
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as VendorMapping;
}

export async function crearVendorMapping(
  mapping: {
    source_type: VendorMappingSourceType;
    source_value: string;
    movi_user_id: string;
    notes?: string;
  },
  userId: string
): Promise<VendorMapping> {
  // Primero desactivar cualquier mapeo activo existente con el mismo source
  await supabase
    .from('vendor_mappings')
    .update({
      status: 'inactive',
      updated_by: userId,
    })
    .eq('source_type', mapping.source_type)
    .eq('source_value', mapping.source_value)
    .eq('status', 'active');

  // Desactivar cualquier otro mapeo activo del usuario
  await supabase
    .from('vendor_mappings')
    .update({
      status: 'inactive',
      updated_by: userId,
    })
    .eq('movi_user_id', mapping.movi_user_id)
    .eq('status', 'active');

  // Ahora crear el nuevo mapeo activo
  const { data, error } = await supabase
    .from('vendor_mappings')
    .insert({
      ...mapping,
      created_by: userId,
      updated_by: userId,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return data as VendorMapping;
}

export async function actualizarVendorMapping(
  id: string,
  mapping: {
    movi_user_id?: string;
    status?: VendorMappingStatus;
    notes?: string;
  },
  userId: string
): Promise<VendorMapping> {
  const { data, error } = await supabase
    .from('vendor_mappings')
    .update({
      ...mapping,
      updated_by: userId,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as VendorMapping;
}

export async function eliminarVendorMapping(id: string): Promise<void> {
  const { error } = await supabase.from('vendor_mappings').delete().eq('id', id);

  if (error) throw error;
}

export async function obtenerVendedoresNoReconocidos(batchId: string): Promise<UnmatchedVendor[]> {
  const { data, error } = await supabase.rpc('get_unmatched_vendors_by_batch', {
    batch_id_param: batchId,
  });

  if (error) throw error;
  return data as UnmatchedVendor[];
}

export async function aplicarMapeosALote(batchId: string): Promise<VendorMappingApplyResult> {
  const { data, error } = await supabase.rpc('apply_vendor_mappings_to_batch', {
    batch_id_param: batchId,
  });

  if (error) throw error;
  return data[0] as VendorMappingApplyResult;
}

export async function asignarVendedorManualmente(
  batchId: string,
  vendorKey: string,
  moviUserId: string,
  saveMapping: boolean,
  userId: string
): Promise<VendorAssignmentResult> {
  const { data, error } = await supabase.rpc('assign_vendor_manually', {
    batch_id_param: batchId,
    vendor_key_param: vendorKey,
    movi_user_id_param: moviUserId,
    save_mapping: saveMapping,
    created_by_param: userId,
  });

  if (error) throw error;
  return data[0] as VendorAssignmentResult;
}

export async function obtenerUsuariosMOVI() {
  console.log('[obtenerUsuariosMOVI] Obteniendo usuarios...');
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, email, oficina_id')
    .neq('estado', 'eliminado')
    .order('nombre_completo');

  if (error) {
    console.error('[obtenerUsuariosMOVI] Error:', error);
    throw error;
  }

  console.log('[obtenerUsuariosMOVI] Usuarios obtenidos:', data?.length || 0);
  return data;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || email.trim() === '') return null;
  return email.trim().toLowerCase();
}

export function normalizeName(name: string | null | undefined): string | null {
  if (!name || name.trim() === '') return null;

  let normalized = name.trim().toLowerCase();

  const accentMap: { [key: string]: string } = {
    á: 'a',
    é: 'e',
    í: 'i',
    ó: 'o',
    ú: 'u',
    ü: 'u',
    ñ: 'n',
    Á: 'A',
    É: 'E',
    Í: 'I',
    Ó: 'O',
    Ú: 'U',
    Ü: 'U',
    Ñ: 'N',
  };

  normalized = normalized
    .split('')
    .map((char) => accentMap[char] || char)
    .join('');

  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

export function calculateVendorKey(
  vendorEmail: string | null | undefined,
  vendorName: string | null | undefined
): string {
  const normalizedEmail = normalizeEmail(vendorEmail);
  const normalizedName = normalizeName(vendorName);

  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return 'unknown';
}

export function formatVendorKey(vendorKey: string): {
  type: 'email' | 'name' | 'unknown';
  value: string;
} {
  if (vendorKey.startsWith('email:')) {
    return { type: 'email', value: vendorKey.substring(6) };
  }
  if (vendorKey.startsWith('name:')) {
    return { type: 'name', value: vendorKey.substring(5) };
  }
  return { type: 'unknown', value: vendorKey };
}

export function getMatchMethodLabel(method: string | null): string {
  switch (method) {
    case 'direct_email':
      return 'Email directo';
    case 'mapping_email':
      return 'Mapeo por email';
    case 'mapping_name':
      return 'Mapeo por nombre';
    case 'manual':
      return 'Asignación manual';
    case 'none':
      return 'Sin asignar';
    default:
      return 'Desconocido';
  }
}

export function getVendorTypeLabel(type: 'email' | 'name' | 'unknown'): string {
  switch (type) {
    case 'email':
      return 'Email';
    case 'name':
      return 'Nombre';
    case 'unknown':
      return 'Desconocido';
  }
}
