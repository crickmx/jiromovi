import { supabase } from '../../lib/supabase';
import type { Vehiculo } from './multiAutosTypes';

interface CatalogVehicleRow {
  id: string;
  marca: string;
  modelo: string;
  anio: number;
  version: string;
  descripcion_completa: string;
  clave_amis: string;
  valor_referencia: number;
  carroceria: string;
  metadata_aseguradoras: Record<string, string>;
}

function rowToVehiculo(row: CatalogVehicleRow): Vehiculo {
  return {
    id: row.id,
    marca: row.marca,
    modelo: row.modelo,
    anio: row.anio,
    version: row.version,
    descripcionCompleta: row.descripcion_completa,
    claveAmis: row.clave_amis,
    armadoraGnp: row.metadata_aseguradoras?.armadora_gnp || row.marca.toUpperCase(),
    carroceriaGnp: row.metadata_aseguradoras?.carroceria_gnp || row.carroceria || '',
    versionGnp: row.version.toUpperCase(),
    valorReferencia: Number(row.valor_referencia),
  };
}

export async function fetchMarcas(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_catalog_marcas');
  if (error || !data) return [];
  return (data as { marca: string }[]).map((r) => r.marca);
}

export async function fetchAniosForMarca(marca: string): Promise<number[]> {
  const { data, error } = await supabase.rpc('get_catalog_anios', { p_marca: marca });
  if (error || !data) return [];
  return (data as { anio: number }[]).map((r) => r.anio);
}

export async function fetchModelosForMarcaAnio(marca: string, anio: number): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_catalog_modelos', { p_marca: marca, p_anio: anio });
  if (error || !data) return [];
  return (data as { modelo: string }[]).map((r) => r.modelo);
}

export async function fetchVersiones(marca: string, anio: number, modelo: string): Promise<Vehiculo[]> {
  const { data: officialLoaded } = await supabase.rpc('qualitas_catalog_is_loaded');
  const { data, error } = await supabase
    .from('multi_autos_catalogo_vehiculos')
    .select('*')
    .eq('marca', marca)
    .eq('anio', anio)
    .eq('modelo', modelo)
    .eq('active', true)
    .eq('catalog_source', officialLoaded ? 'qualitas_official' : 'legacy_seed')
    .order('version')
    .limit(500);
  if (error || !data) return [];
  return data.map((row) => rowToVehiculo(row as CatalogVehicleRow));
}

export interface CatalogSyncStatus {
  status: 'pending' | 'running' | 'success' | 'failed' | 'awaiting_source';
  last_success_at: string | null;
  source_file_date: string | null;
  row_count: number;
}

export async function fetchCatalogSyncStatus(): Promise<CatalogSyncStatus | null> {
  const { data } = await supabase
    .from('multi_autos_catalog_sync_status')
    .select('status, last_success_at, source_file_date, row_count')
    .eq('source', 'qualitas_official')
    .maybeSingle();
  return data as CatalogSyncStatus | null;
}
