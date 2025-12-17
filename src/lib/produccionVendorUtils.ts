import { supabase } from './supabase';
import type { VendorMapping } from './vendorMappingTypes';

/**
 * Tipos para Producción por Vendedor
 */
export interface VendorProductionRecord {
  vend_nombre: string;
  vend_nombre_normalized: string;
  movi_user_id: string | null;
  movi_user_name: string | null;
  oficina_nombre: string | null;
  match_method: 'direct_name' | 'mapping_name' | 'none';
  total_records: number;
  total_importe_pesos: number;
  total_prima_convenio: number;
  total_prima_ponderada: number;
  total_bono: number;
  registros: ProductionDetailRecord[];
}

export interface ProductionDetailRecord {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
}

export interface VendorMappingInfo {
  vendor_nombre: string;
  vendor_nombre_normalized: string;
  movi_user_id: string | null;
  movi_user_name: string | null;
  oficina_nombre: string | null;
  mapping_source: 'auto' | 'manual' | 'none';
  total_records: number;
}

/**
 * Normalizar nombre de vendedor (igual que normalize_name de la BD)
 */
export function normalizeVendorName(name: string | null | undefined): string | null {
  if (!name || name.trim() === '') return null;

  let normalized = name.trim().toLowerCase();

  // Quitar acentos
  const accentMap: { [key: string]: string } = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
  };

  normalized = normalized
    .split('')
    .map((char) => accentMap[char] || char)
    .join('');

  // Quitar dobles espacios
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Buscar mapeo automático para un VendNombre
 */
export async function findVendorMapping(vendNombre: string): Promise<{
  movi_user_id: string | null;
  movi_user_name: string | null;
  oficina_nombre: string | null;
  match_method: 'direct_name' | 'mapping_name' | 'none';
}> {
  const normalized = normalizeVendorName(vendNombre);

  if (!normalized) {
    return {
      movi_user_id: null,
      movi_user_name: null,
      oficina_nombre: null,
      match_method: 'none',
    };
  }

  // Paso 1: Buscar coincidencia directa en usuarios por nombre_completo
  const { data: directMatch } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, oficinas(nombre)')
    .ilike('nombre_completo', normalized)
    .limit(1)
    .maybeSingle();

  if (directMatch) {
    return {
      movi_user_id: directMatch.id,
      movi_user_name: directMatch.nombre_completo,
      oficina_nombre: (directMatch.oficinas as any)?.nombre || null,
      match_method: 'direct_name',
    };
  }

  // Paso 2: Buscar en vendor_mappings por nombre
  const { data: mappingMatch } = await supabase
    .from('vendor_mappings')
    .select('movi_user_id, usuarios(nombre_completo, oficinas(nombre))')
    .eq('source_type', 'name')
    .eq('source_value', normalized)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (mappingMatch) {
    const usuario = (mappingMatch as any).usuarios;
    return {
      movi_user_id: mappingMatch.movi_user_id,
      movi_user_name: usuario?.nombre_completo || null,
      oficina_nombre: usuario?.oficinas?.nombre || null,
      match_method: 'mapping_name',
    };
  }

  // No se encontró match
  return {
    movi_user_id: null,
    movi_user_name: null,
    oficina_nombre: null,
    match_method: 'none',
  };
}

/**
 * Agrupar registros de producción por VendNombre
 */
export async function groupProductionByVendor(
  records: any[]
): Promise<VendorProductionRecord[]> {
  // Agrupar por agente_nombre (que es VendNombre)
  const vendorGroups = new Map<string, any[]>();

  for (const record of records) {
    const vendNombre = record.agente_nombre;
    if (!vendNombre) continue;

    if (!vendorGroups.has(vendNombre)) {
      vendorGroups.set(vendNombre, []);
    }
    vendorGroups.get(vendNombre)!.push(record);
  }

  // Procesar cada vendedor
  const vendorRecords: VendorProductionRecord[] = [];

  for (const [vendNombre, vendorRecords_] of vendorGroups) {
    const normalized = normalizeVendorName(vendNombre);

    // Buscar mapeo
    const mapping = await findVendorMapping(vendNombre);

    // Calcular totales
    const totalImporte = vendorRecords_.reduce((sum, r) => sum + (r.importe_pesos || 0), 0);
    const totalConvenio = vendorRecords_.reduce((sum, r) => sum + (r.prima_convenio || 0), 0);
    const totalPonderada = vendorRecords_.reduce((sum, r) => sum + (r.prima_ponderada || 0), 0);
    const totalBono = vendorRecords_.reduce((sum, r) => sum + (r.bono || 0), 0);

    vendorRecords.push({
      vend_nombre: vendNombre,
      vend_nombre_normalized: normalized || '',
      movi_user_id: mapping.movi_user_id,
      movi_user_name: mapping.movi_user_name,
      oficina_nombre: mapping.oficina_nombre,
      match_method: mapping.match_method,
      total_records: vendorRecords_.length,
      total_importe_pesos: totalImporte,
      total_prima_convenio: totalConvenio,
      total_prima_ponderada: totalPonderada,
      total_bono: totalBono,
      registros: vendorRecords_,
    });
  }

  // Ordenar por total (usando importe o convenio)
  return vendorRecords.sort((a, b) => {
    const aTotal = a.total_importe_pesos > 0 ? a.total_importe_pesos : a.total_prima_convenio;
    const bTotal = b.total_importe_pesos > 0 ? b.total_importe_pesos : b.total_prima_convenio;
    return bTotal - aTotal;
  });
}

/**
 * Obtener lista de vendedores únicos para configuración
 */
export async function getUniqueVendorsFromProduction(): Promise<VendorMappingInfo[]> {
  // Obtener registros de producción
  const { data: { session } } = await supabase.auth.getSession();
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-production-sheets`;

  const headers = {
    'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    throw new Error('Error al obtener datos de Google Sheets');
  }

  const result = await response.json();

  if (!result.success || !result.records) {
    throw new Error('No se recibieron registros del servidor');
  }

  // Obtener vendedores únicos
  const vendorMap = new Map<string, number>();

  for (const record of result.records) {
    const vendNombre = record.agente_nombre;
    if (!vendNombre) continue;

    vendorMap.set(vendNombre, (vendorMap.get(vendNombre) || 0) + 1);
  }

  // Buscar mapeos para cada vendedor
  const vendors: VendorMappingInfo[] = [];

  for (const [vendNombre, count] of vendorMap) {
    const normalized = normalizeVendorName(vendNombre);
    const mapping = await findVendorMapping(vendNombre);

    vendors.push({
      vendor_nombre: vendNombre,
      vendor_nombre_normalized: normalized || '',
      movi_user_id: mapping.movi_user_id,
      movi_user_name: mapping.movi_user_name,
      oficina_nombre: mapping.oficina_nombre,
      mapping_source: mapping.match_method === 'direct_name' ? 'auto' :
                      mapping.match_method === 'mapping_name' ? 'manual' : 'none',
      total_records: count,
    });
  }

  return vendors.sort((a, b) => a.vendor_nombre.localeCompare(b.vendor_nombre));
}

/**
 * Crear o actualizar mapeo de vendedor
 */
export async function createOrUpdateVendorMapping(
  vendNombre: string,
  moviUserId: string,
  userId: string
): Promise<void> {
  console.log('[createOrUpdateVendorMapping] Iniciando:', { vendNombre, moviUserId, userId });

  const normalized = normalizeVendorName(vendNombre);

  if (!normalized) {
    console.error('[createOrUpdateVendorMapping] Nombre normalizado es null');
    throw new Error('Nombre de vendedor inválido');
  }

  console.log('[createOrUpdateVendorMapping] Nombre normalizado:', normalized);

  // Insertar o actualizar en vendor_mappings
  const payload = {
    source_type: 'name' as const,
    source_value: normalized,
    movi_user_id: moviUserId,
    status: 'active' as const,
    created_by: userId,
    updated_by: userId,
    source_raw_examples: [{
      name: vendNombre,
    }],
  };

  console.log('[createOrUpdateVendorMapping] Payload:', payload);

  const { data, error } = await supabase
    .from('vendor_mappings')
    .upsert(payload, {
      onConflict: 'source_type,source_value',
    })
    .select();

  if (error) {
    console.error('[createOrUpdateVendorMapping] Error de Supabase:', error);
    throw new Error(`Error al guardar mapeo: ${error.message}`);
  }

  console.log('[createOrUpdateVendorMapping] Guardado exitoso:', data);
}

/**
 * Eliminar mapeo de vendedor
 */
export async function deleteVendorMapping(vendNombre: string): Promise<void> {
  const normalized = normalizeVendorName(vendNombre);

  if (!normalized) {
    throw new Error('Nombre de vendedor inválido');
  }

  const { error } = await supabase
    .from('vendor_mappings')
    .delete()
    .eq('source_type', 'name')
    .eq('source_value', normalized);

  if (error) throw error;
}

/**
 * Obtener estadísticas de mapeo
 */
export interface VendorMappingStats {
  total_vendors: number;
  mapped_vendors: number;
  auto_mapped: number;
  manual_mapped: number;
  unmapped_vendors: number;
}

export async function getVendorMappingStats(
  vendors: VendorMappingInfo[]
): Promise<VendorMappingStats> {
  const total = vendors.length;
  const mapped = vendors.filter(v => v.movi_user_id !== null).length;
  const auto = vendors.filter(v => v.mapping_source === 'auto').length;
  const manual = vendors.filter(v => v.mapping_source === 'manual').length;
  const unmapped = vendors.filter(v => v.mapping_source === 'none').length;

  return {
    total_vendors: total,
    mapped_vendors: mapped,
    auto_mapped: auto,
    manual_mapped: manual,
    unmapped_vendors: unmapped,
  };
}
