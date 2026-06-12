import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface ModuleVisibilityRule {
  id: string;
  module_key: string;
  target_type: 'role' | 'office';
  target_value: string; // role name or oficina_id
  visible: boolean;
  updated_at: string;
}

interface UseModuleVisibilityReturn {
  rules: ModuleVisibilityRule[];
  loading: boolean;
  /** Returns false only when there is an explicit hide rule for this key+target */
  isVisible: (moduleKey: string, userRole: string, oficina_id?: string | null) => boolean;
  reload: () => Promise<void>;
}

let _cache: ModuleVisibilityRule[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export function useModuleVisibility(): UseModuleVisibilityReturn {
  const [rules, setRules] = useState<ModuleVisibilityRule[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  const fetch = useCallback(async () => {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setRules(_cache);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('module_visibility')
      .select('id, module_key, target_type, target_value, visible, updated_at')
      .order('module_key');
    const rows = (data ?? []) as ModuleVisibilityRule[];
    _cache = rows;
    _cacheTime = Date.now();
    setRules(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const isVisible = useCallback((moduleKey: string, userRole: string, oficina_id?: string | null): boolean => {
    // Check role rule
    const roleRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'role' && r.target_value === userRole);
    if (roleRule && !roleRule.visible) return false;

    // Check office rule
    if (oficina_id) {
      const officeRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'office' && r.target_value === oficina_id);
      if (officeRule && !officeRule.visible) return false;
    }

    return true;
  }, [rules]);

  const reload = useCallback(async () => {
    _cache = null;
    _cacheTime = 0;
    setLoading(true);
    await fetch();
  }, [fetch]);

  return { rules, loading, isVisible, reload };
}

/** Invalidate the in-memory cache (call after saving changes in admin panel) */
export function invalidateModuleVisibilityCache() {
  _cache = null;
  _cacheTime = 0;
}
