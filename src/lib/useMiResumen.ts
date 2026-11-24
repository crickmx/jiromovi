import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useImpersonation } from '../contexts/ImpersonationContext';

const BONOS_URL = import.meta.env.VITE_BONOS_URL || 'http://localhost:8003';

export interface CampaniaGroupRow {
  entity_name: string;
  entity?: string;
  rank: number;
  prima_ponderada: number;
  avance_pct: number | null;
  pct_meta?: number | null;
  despacho: string;
  descripcion?: string;
  is_me: boolean;
  prev: Omit<CampaniaGroupRow, 'is_me' | 'prev' | 'next'> | null;
  next: Omit<CampaniaGroupRow, 'is_me' | 'prev' | 'next'> | null;
}

export interface CampaniaActiva {
  id: number;
  nombre: string;
  descripcion?: string;
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

/** Los 5 de mayor prima ponderada del equipo, hayan alcanzado nivel o no. */
export interface ConvencionTopVendedor {
  entity: string;
  prima_pond: number;
  nivel_conv: string;
  sig_conv: string | null;
  falta_conv: number;
  pct_conv: number;
}

export interface ConvencionEquipo {
  total_vendedores: number;
  en_convencion: ConvencionEquipoVendedor[];
  cerca: ConvencionCercaVendedor[];
  /** Opcional: bonos viejo (antes del 15/10/26) no lo manda. */
  top?: ConvencionTopVendedor[];
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
    // Los mismos tres KPI del inicio de Central de Producción. Opcionales
    // porque una versión vieja de bonos no los manda.
    prima_neta_actual?: number;
    prima_neta_anterior?: number;
    delta_neta_pct?: number | null;
    prima_no_conv_actual?: number;
    prima_no_conv_anterior?: number;
    delta_no_conv_pct?: number | null;
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

// La caché se guarda POR persona consultada: si no, al entrar en "ver como"
// se seguían mostrando los datos de quien estuviera antes.
let _cache: MiResumenData | 'error' | null = null;
let _cacheTime = 0;
let _cacheClave = '';
const CACHE_TTL = 60_000;

export function useMiResumen(): MiResumenData | 'loading' | 'error' {
  // La impersonación de MOVI solo cambia lo que pinta la pantalla: el token
  // sigue siendo el del administrador, así que sin decírselo a bonos las
  // tarjetas mostraban la producción del ADMINISTRADOR mientras la pantalla
  // decía estar viendo a otro. Bonos solo lo acepta si quien pregunta es
  // administrador allá, y lo deja en su log.
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const verComo = isImpersonating ? impersonatedUser?.id ?? null : null;

  const [data, setData] = useState<MiResumenData | 'loading' | 'error'>(
    _cacheClave === (verComo ?? 'self') ? (_cache ?? 'loading') : 'loading',
  );

  useEffect(() => {
    let active = true;
    const clave = verComo ?? 'self';
    const now = Date.now();
    if (_cache && _cacheClave === clave && now - _cacheTime < CACHE_TTL) {
      setData(_cache);
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { if (active) setData('error'); return; }
      try {
        const url = new URL('/accounts/api/mi-resumen/', BONOS_URL);
        if (verComo) url.searchParams.set('as', verComo);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) { if (active) setData('error'); return; }
        const json = (await res.json()) as MiResumenData;
        _cache = json;
        _cacheTime = Date.now();
        _cacheClave = clave;
        if (active) setData(json);
      } catch {
        if (active) setData('error');
      }
    })();
    return () => { active = false; };
  }, [verComo]);

  return data;
}
