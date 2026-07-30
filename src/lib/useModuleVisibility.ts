import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { isBetaHost } from './betaAccess';

export interface ModuleVisibilityRule {
  id: string;
  module_key: string;
  target_type: 'role' | 'office' | 'user' | 'beta_user' | 'rol_id';
  target_value: string; // role name, oficina_id, usuario id, o (para rol_id) id del rol del catálogo
  visible: boolean;
  updated_at: string;
}

interface UseModuleVisibilityReturn {
  rules: ModuleVisibilityRule[];
  loading: boolean;
  /**
   * Resolves visibility with most-specific-wins priority: user > office > role > visible by default.
   * Administradores always see everything, regardless of rules.
   */
  isVisible: (moduleKey: string, userRole: string, oficina_id?: string | null, userId?: string | null) => boolean;
  reload: () => Promise<void>;
}

let _cache: ModuleVisibilityRule[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export function useModuleVisibility(): UseModuleVisibilityReturn {
  const [rules, setRules] = useState<ModuleVisibilityRule[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);
  const { esUsuarioBeta, usuario } = useMoviAuth();
  const betaOverrideEligible = isBetaHost() && esUsuarioBeta;
  const rolId = (usuario as any)?.rol_id as string | null | undefined;

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

  const isVisible = useCallback((moduleKey: string, userRole: string, oficina_id?: string | null, userId?: string | null): boolean => {
    // Administradores siempre ven todo, sin importar las reglas configuradas
    if (userRole === 'Administrador') return true;

    // Override Beta: solo SUMA visibilidad (nunca oculta), y solo aplica en
    // beta.movi.digital para un usuario Beta específico — nunca en producción.
    if (betaOverrideEligible && userId) {
      const betaRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'beta_user' && r.target_value === userId);
      if (betaRule?.visible) return true;
    }

    // La regla más específica presente gana: usuario > oficina > rol
    if (userId) {
      const userRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'user' && r.target_value === userId);
      if (userRule) return userRule.visible;
    }

    if (oficina_id) {
      const officeRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'office' && r.target_value === oficina_id);
      if (officeRule) return officeRule.visible;
    }

    // Rol del catálogo (rol_id): más específico que la capa por rol base.
    // Permite que dos roles con la misma base tengan visibilidad de módulos distinta.
    if (rolId) {
      const rolIdRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'rol_id' && r.target_value === rolId);
      if (rolIdRule) return rolIdRule.visible;
    }

    const roleRule = rules.find(r => r.module_key === moduleKey && r.target_type === 'role' && r.target_value === userRole);
    if (roleRule) return roleRule.visible;

    return true;
  }, [rules, betaOverrideEligible, rolId]);

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
