import { supabase } from './supabase';
import type {
  SicasConfig,
  SicasDespacho,
  SicasVendedor,
  SicasDespachoWithMapping,
  SicasVendedorWithMapping,
  SicasMapeoDespacho,
  SicasMapeoVendedor,
  SicasCatalogType,
  SicasCatalogo,
  SicasSyncHistory,
  SicasCatalogStats,
} from './sicasTypes';

export async function getSicasConfig(): Promise<SicasConfig | null> {
  const { data, error } = await supabase
    .from('sicas_config')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching SICAS config:', error);
    return null;
  }

  return data;
}

export async function testSicasConnection(): Promise<{
  success: boolean;
  connectionSuccess?: boolean;
  message?: string;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-test-connection`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await response.json();
}

export async function syncSicasCatalog(catalogType: 'despachos' | 'vendedores'): Promise<{
  success: boolean;
  itemsProcessed?: number;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ catalogType }),
  });

  return await response.json();
}

export async function getSicasDespachos(onlyUnmapped = false): Promise<SicasDespachoWithMapping[]> {
  let query = supabase
    .from('sicas_despachos')
    .select(`
      *,
      sicas_mapeo_despacho_oficina!inner (
        *,
        oficinas (id, nombre)
      )
    `)
    .order('nombre');

  if (onlyUnmapped) {
    query = query.eq('is_mapped', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching despachos:', error);
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    mapping: item.sicas_mapeo_despacho_oficina?.[0] || null,
    oficina: item.sicas_mapeo_despacho_oficina?.[0]?.oficinas || null,
  }));
}

export async function getAllSicasDespachos(): Promise<SicasDespachoWithMapping[]> {
  const { data, error } = await supabase
    .from('sicas_despachos')
    .select(`
      *,
      sicas_mapeo_despacho_oficina (
        *,
        oficinas (id, nombre)
      )
    `)
    .order('nombre');

  if (error) {
    console.error('Error fetching despachos:', error);
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    mapping: item.sicas_mapeo_despacho_oficina?.[0] || null,
    oficina: item.sicas_mapeo_despacho_oficina?.[0]?.oficinas || null,
  }));
}

export async function getSicasVendedores(onlyUnmapped = false): Promise<SicasVendedorWithMapping[]> {
  let query = supabase
    .from('sicas_vendedores')
    .select(`
      *,
      sicas_mapeo_vendedor_usuario (
        *,
        usuarios (id, nombre, apellidos, email)
      )
    `)
    .order('nombre');

  if (onlyUnmapped) {
    query = query.eq('is_mapped', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching vendedores:', error);
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    mapping: item.sicas_mapeo_vendedor_usuario?.[0] || null,
    usuario: item.sicas_mapeo_vendedor_usuario?.[0]?.usuarios || null,
  }));
}

export async function mapDespacho(id_sicas_despacho: string, movi_oficina_id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-map-despacho`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_sicas_despacho, movi_oficina_id }),
  });

  return await response.json();
}

export async function unmapDespacho(id_sicas_despacho: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-map-despacho`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_sicas_despacho }),
  });

  return await response.json();
}

export async function mapVendedor(id_sicas_vendedor: string, movi_user_id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-map-vendedor`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_sicas_vendedor, movi_user_id }),
  });

  return await response.json();
}

export async function unmapVendedor(id_sicas_vendedor: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-map-vendedor`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_sicas_vendedor }),
  });

  return await response.json();
}

// ========================================
// FUNCIONES GENÉRICAS PARA 61 CATÁLOGOS
// ========================================

export async function getAllCatalogTypes(): Promise<SicasCatalogType[]> {
  const { data, error } = await supabase
    .from('sicas_catalog_types')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error fetching catalog types:', error);
    return [];
  }

  return data || [];
}

export async function syncCatalogById(catalog_type_id: number): Promise<{
  success: boolean;
  catalog_name?: string;
  stats?: any;
  error?: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ catalog_type_id }),
  });

  return await response.json();
}

export async function getCatalogRecords(
  catalog_type_id: number,
  options?: {
    onlyUnmapped?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<SicasCatalogo[]> {
  let query = supabase
    .from('sicas_catalogos')
    .select('*')
    .eq('catalog_type_id', catalog_type_id)
    .order('nombre');

  if (options?.onlyUnmapped) {
    query = query.eq('is_mapped', false);
  }

  if (options?.search) {
    query = query.ilike('nombre', `%${options.search}%`);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching catalog records:', error);
    return [];
  }

  return data || [];
}

export async function getCatalogStats(): Promise<SicasCatalogStats[]> {
  const { data, error } = await supabase.rpc('get_sicas_catalog_stats');

  if (error) {
    console.error('Error fetching catalog stats:', error);
    return [];
  }

  return data || [];
}

export async function getSyncHistory(catalog_type_id?: number): Promise<SicasSyncHistory[]> {
  let query = supabase
    .from('sicas_sync_history')
    .select(`
      *,
      catalog_type:sicas_catalog_types(*)
    `)
    .order('sync_started_at', { ascending: false })
    .limit(50);

  if (catalog_type_id) {
    query = query.eq('catalog_type_id', catalog_type_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sync history:', error);
    return [];
  }

  return data || [];
}
