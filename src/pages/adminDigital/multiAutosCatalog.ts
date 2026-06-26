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
  const { data, error } = await supabase
    .from('multi_autos_catalogo_vehiculos')
    .select('marca')
    .order('marca');
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.marca))].sort();
}

export async function fetchAniosForMarca(marca: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('multi_autos_catalogo_vehiculos')
    .select('anio')
    .eq('marca', marca)
    .order('anio', { ascending: false });
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.anio))].sort((a, b) => b - a);
}

export async function fetchModelosForMarcaAnio(marca: string, anio: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('multi_autos_catalogo_vehiculos')
    .select('modelo')
    .eq('marca', marca)
    .eq('anio', anio)
    .order('modelo');
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.modelo))].sort();
}

export async function fetchVersiones(marca: string, anio: number, modelo: string): Promise<Vehiculo[]> {
  const { data, error } = await supabase
    .from('multi_autos_catalogo_vehiculos')
    .select('*')
    .eq('marca', marca)
    .eq('anio', anio)
    .eq('modelo', modelo)
    .order('version');
  if (error || !data) return [];
  return data.map((row) => rowToVehiculo(row as CatalogVehicleRow));
}
