import { supabase } from './supabase';
import type {
  SicasConfig,
  SicasDespacho,
  SicasVendedor,
  SicasDespachoWithMapping,
  SicasVendedorWithMapping,
  SicasMapeoDespacho,
  SicasMapeoVendedor,
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
