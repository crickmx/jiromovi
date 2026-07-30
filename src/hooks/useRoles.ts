import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Los 4 comportamientos canónicos que hereda un rol del catálogo. */
export type RolBase = 'Administrador' | 'Gerente' | 'Empleado' | 'Agente';

export const ROLES_BASE: RolBase[] = ['Administrador', 'Gerente', 'Empleado', 'Agente'];

export const ROL_BASE_LABEL: Record<RolBase, string> = {
  Administrador: 'Administrador — acceso total',
  Gerente: 'Gerente — admin de su oficina/equipos',
  Empleado: 'Empleado — interno operativo',
  Agente: 'Agente — cliente externo',
};

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  rol_base: RolBase;
  es_sistema: boolean;
  activo: boolean;
  orden: number;
}

let _cache: Rol[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

interface UseRolesReturn {
  roles: Rol[];
  loading: boolean;
  reload: () => Promise<void>;
  /** Rol del catálogo por id (o undefined). */
  rolById: (id: string | null | undefined) => Rol | undefined;
}

export function useRoles(): UseRolesReturn {
  const [roles, setRoles] = useState<Rol[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  const fetch = useCallback(async () => {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      setRoles(_cache);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('roles')
      .select('id, nombre, descripcion, color, rol_base, es_sistema, activo, orden')
      .order('orden')
      .order('nombre');
    const rows = (data ?? []) as Rol[];
    _cache = rows;
    _cacheTime = Date.now();
    setRoles(rows);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const reload = useCallback(async () => {
    _cache = null;
    _cacheTime = 0;
    setLoading(true);
    await fetch();
  }, [fetch]);

  const rolById = useCallback(
    (id: string | null | undefined) => (id ? roles.find((r) => r.id === id) : undefined),
    [roles],
  );

  return { roles, loading, reload, rolById };
}

/** Invalida la caché en memoria (llamar tras guardar cambios en el admin de roles). */
export function invalidateRolesCache() {
  _cache = null;
  _cacheTime = 0;
}
