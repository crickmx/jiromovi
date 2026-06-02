import { useMoviAuth } from '../contexts/MoviAuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import type { Usuario } from '../contexts/MoviAuthContext';

/**
 * Returns the "effective" user for the current session.
 * - During normal operation: returns the real authenticated user.
 * - During impersonation: effectiveUser is the masked user, realUser is the admin.
 *
 * Note: useMoviAuth().usuario already returns the effective user transparently,
 * so this hook is mainly useful when you need both identities simultaneously.
 */
export function useEffectiveUser(): {
  effectiveUser: Usuario | null;
  realUser: Usuario | null;
  isImpersonating: boolean;
  isReadOnly: boolean;
} {
  const { usuario, realUsuario } = useMoviAuth();
  const { isImpersonating, isReadOnly } = useImpersonation();

  return {
    effectiveUser: usuario,
    realUser: realUsuario ?? usuario,
    isImpersonating,
    isReadOnly,
  };
}
