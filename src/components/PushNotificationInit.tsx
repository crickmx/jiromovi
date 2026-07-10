// src/components/PushNotificationInit.tsx
import { useEffect } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Componente pasivo: registra SW y suscripcion Web Push.
 * Sin UI — solo logica. Montar UNA sola vez dentro de MoviAuthProvider.
 */
export function PushNotificationInit() {
  const { usuario } = useMoviAuth();
  const { subscribe, isSupported, isSwReady } = usePushNotifications(usuario?.id ?? null);

  useEffect(() => {
    if (isSupported && isSwReady && usuario?.id) {
      subscribe();
    }
  }, [usuario?.id, isSupported, isSwReady]);

  return null;
}
