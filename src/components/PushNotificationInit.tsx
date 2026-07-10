import { useEffect } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

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