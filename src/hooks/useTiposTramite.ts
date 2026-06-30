import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, invalidateCache } from '../lib/sessionCache';
import { setDynamicTipos, TIPO_TRAMITE_OPTIONS, type TipoTramiteConfig, type AreaCategoria } from '../lib/registroActividadesTypes';

export interface TipoTramiteDB {
  id: string;
  value: string;
  label: string;
  area: string;
  color: string;
  is_custom: boolean;
  orden: number;
  categoria: string;
  activo: boolean;
  sla_dias: number | null;
}

const CACHE_KEY = 'tipos_tramite_v2';
const CACHE_TTL = 10 * 60 * 1000; // 10 min

/** Invalida el caché de tipos de trámite (llamar al guardar cambios en el catálogo). */
export function invalidateTiposTramiteCache() {
  invalidateCache(CACHE_KEY);
}

/** Tipos de trámite activos con caché compartido de 10 min entre componentes. */
export function useTiposTramite() {
  const [tipos, setTipos] = useState<TipoTramiteDB[]>(() => getCached<TipoTramiteDB[]>(CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(tipos.length === 0);

  useEffect(() => {
    const cached = getCached<TipoTramiteDB[]>(CACHE_KEY);
    if (cached) {
      setTipos(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('ticket_tipos')
      .select('id, value, label, area, color, is_custom, orden, categoria, activo, sla_dias')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => {
        const rows = (data ?? []) as TipoTramiteDB[];
        setCached(CACHE_KEY, rows, CACHE_TTL);
        setTipos(rows);
        setLoading(false);

        // Sincronizar helpers de registroActividadesTypes con datos de DB
        const staticMap = new Map(TIPO_TRAMITE_OPTIONS.map(t => [t.value, t]));
        const fromDb: TipoTramiteConfig[] = rows.map(r => ({
          value: r.value,
          label: r.label,
          area: (r.area || 'Operaciones') as AreaCategoria,
          tipoAplicable: staticMap.get(r.value)?.tipoAplicable ?? 'general',
        }));
        // Tipos estáticos que aún no están en DB (legacy sin migrar)
        const staticOnly = TIPO_TRAMITE_OPTIONS.filter(s => !fromDb.some(d => d.value === s.value));
        setDynamicTipos([...fromDb, ...staticOnly]);
      });
  }, []);

  /** Map value → TipoTramiteDB para lookups O(1). */
  const tiposMap = new Map(tipos.map(t => [t.value, t]));

  return { tipos, tiposMap, loading };
}
