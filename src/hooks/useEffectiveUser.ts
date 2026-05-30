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
 * Components that display user-specific data should use this hook
 * instead of useAuth().usuario directly.
 */
export function useEffectiveUser(): {
  effectiveUser: Usuario | null;
  realUser: Usuario | null;
  isImpersonating: boolean;
  isReadOnly: boolean;
} {
  const { usuario } = useAuth();
  const { isImpersonating, isReadOnly, impersonatedUser } = useImpersonation();

  if (isImpersonating && impersonatedUser) {
    return {
      effectiveUser: impersonatedUser as unknown as Usuario,
      realUser: usuario,
      isImpersonating: true,
      isReadOnly,
    };
  }

  return {
    effectiveUser: usuario,
    realUser: usuario,
    isImpersonating: false,
    isReadOnly: false,
  };
}
