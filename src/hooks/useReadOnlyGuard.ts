import { useImpersonation } from '../contexts/ImpersonationContext';

/**
 * Returns true if the current session is in read-only mode (impersonation active).
 * Use this to guard destructive or sensitive actions.
 */
export function useReadOnlyGuard() {
  const { isImpersonating, isReadOnly } = useImpersonation();

  const guardAction = (action: () => void | Promise<void>): (() => void) => {
    return () => {
      if (isReadOnly) {
        alert('Esta accion no esta disponible en modo de visualizacion.');
        return;
      }
      action();
    };
  };

  return {
    isReadOnly: isImpersonating && isReadOnly,
    guardAction,
  };
}
