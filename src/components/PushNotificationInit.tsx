// src/components/PushNotificationInit.tsx
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Componente pasivo: registra SW y suscripcion Web Push.
 * Sin UI — solo logica. Montar UNA sola vez dentro de MoviAuthProvider.
 */
export function PushNotificationInit() {
  const { usuario } = useMoviAuth();
  usePushNotifications(usuario?.id ?? null);
  return null;
}
