import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8003';

export interface CampaniaGroupRow {
  entity_name: string;
  rank: number;
  prima_ponderada: number;
  avance_pct: number | null;
  despacho: string;
  is_me: boolean;
  prev: Omit<CampaniaGroupRow, 'is_me' | 'prev' | 'next'> | null;
  next: Omit<CampaniaGroupRow, 'is_me' | 'prev' | 'next'> | null;
}

export interface CampaniaActiva {
  id: number;
  nombre: string;
  dias_restantes: number;
  total_participantes: number;
  group_rows: CampaniaGroupRow[];
  equipo_count: number;
  equipo_prima_total: number;
  equipo_en_zona: number;
}

export interface ConvencionStep {
  name: string;
  status: 'done' | 'active' | 'pending';
  umbral: number;
}

export interface ConvencionPropia {
  nivel: string;
  siguiente: string | null;
  falta: number;
  pct: number;
  maximo: boolean;
  msg: string;
  prima_acum: number;
  steps: ConvencionStep[];
}

export interface ConvencionEquipoVendedor {
  entity: string;
  nivel_conv: string;
  pct_conv: number;
  sig_conv: string | null;
  falta_conv: number;
}

export interface ConvencionCercaVendedor {
  entity: string;
  pct_conv: number;
  falta_conv: number;
  sig_conv: string | null;
}

export interface ConvencionEquipo {
  total_vendedores: number;
  en_convencion: ConvencionEquipoVendedor[];
  cerca: ConvencionCercaVendedor[];
}

export interface MiResumenData {
  vinculado: boolean;
  aplica?: boolean;
  role?: 'vendedor' | 'gerencia' | 'despacho';
  entity?: string;
  produccion?: {
    prima_conv_actual: number;
    prima_conv_anterior: number;
    delta_pct: number | null;
    num_polizas: number;
    meta_monto: number | null;
    meta_pct: number | null;
  };
  convencion?: ConvencionPropia | null;
  convencion_equipo?: ConvencionEquipo | null;
  renovaciones?: Array<{
    numero_poliza: string;
    asegurado: string;
    ramo: string;
    compania: string;
    fecha_fin: string;
  }>;
  campanias?: CampaniaActiva[];
}

let _cache: MiResumenData | 'error' | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

export function useMiResumen(): MiResumenData | 'loading' | 'error' {
  const [data, setData] = useState<MiResumenData | 'loading' | 'error'>(_cache ?? 'loading');

  useEffect(() => {
    let active = true;
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setData(_cache);
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { if (active) setData('error'); return; }
      try {
        const url = new URL('/accounts/api/mi-resumen/', BONOS_URL).toString();
        const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) { if (active) setData('error'); return; }
        const json = (await res.json()) as MiResumenData;
        _cache = json;
        _cacheTime = Date.now();
        if (active) setData(json);
      } catch {
        if (active) setData('error');
      }
    })();
    return () => { active = false; };
  }, []);

  return data;
}
