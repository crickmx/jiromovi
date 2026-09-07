import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface DashboardVcard {
  id: string;
  card_key: string;
  label: string;
  descripcion: string;
  route: string;
  emoji: string;
  gradient_from: string;
  gradient_to: string;
  orden: number;
  activa: boolean;
  icon_key?: string | null;
}

export interface DashboardWidget {
  id: string;
  widget_key: string;
  orden: number;
  activa: boolean;
  full_width: boolean;
}

interface UseDashboardConfigReturn {
  vcards: DashboardVcard[];
  widgets: DashboardWidget[];
  loading: boolean;
  reload: () => Promise<void>;
}

let _cache: { vcards: DashboardVcard[]; widgets: DashboardWidget[] } | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export function useDashboardConfig(): UseDashboardConfigReturn {
  const [vcards, setVcards] = useState<DashboardVcard[]>(_cache?.vcards ?? []);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(_cache?.widgets ?? []);
  const [loading, setLoading] = useState(!_cache);

  const fetchAll = useCallback(async () => {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setVcards(_cache.vcards);
      setWidgets(_cache.widgets);
      setLoading(false);
      return;
    }
    const [{ data: v }, { data: w }] = await Promise.all([
      supabase.from('dashboard_vcards').select('*').order('orden'),
      supabase.from('dashboard_widgets').select('*').order('orden'),
    ]);
    const vcardsData = (v ?? []).map((row: any) => ({
      ...row,
      icon_key: row.icon_key ?? row.emoji ?? null,
    })) as DashboardVcard[];
    const widgetsData = (w ?? []) as DashboardWidget[];
    _cache = { vcards: vcardsData, widgets: widgetsData };
    _cacheTime = Date.now();
    setVcards(vcardsData);
    setWidgets(widgetsData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const reload = useCallback(async () => {
    _cache = null;
    _cacheTime = 0;
    setLoading(true);
    await fetchAll();
  }, [fetchAll]);

  return { vcards, widgets, loading, reload };
}

/** Invalida el cache en memoria (llamar después de guardar cambios en el editor admin) */
export function invalidateDashboardConfigCache() {
  _cache = null;
  _cacheTime = 0;
}
