import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import type { Database } from '../lib/database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  permisosAdicionales?: string[];
  oficina?: { id: string; nombre: string; accent_color: string | null; logo_url: string | null } | null;
};

/**
 * Returns the "effective" user for the current session.
 * - During normal operation: returns the real authenticated user.
 * - During impersonation: returns the impersonated user's data.
 *
 * Note: useAuth().usuario already returns the effective user,
 * so this hook is mainly useful when you need both realUser and effectiveUser.
 */
export function useEffectiveUser(): {
  effectiveUser: Usuario | null;
  realUser: Usuario | null;
  isImpersonating: boolean;
  isReadOnly: boolean;
} {
  const { usuario, realUsuario } = useAuth();
  const { isImpersonating, isReadOnly } = useImpersonation();

  return {
    effectiveUser: usuario as Usuario | null,
    realUser: (realUsuario ?? usuario) as Usuario | null,
    isImpersonating,
    isReadOnly,
  };
}
