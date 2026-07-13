// src/hooks/usePushNotifications.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'fjaFkBA2HvLfQQC7huQ6L9dukThrwRb8aVXyA4f8y_U0kodIJ8xF0Xmu0sR8mRj9r_2QqFyvPW5jQqrqBz8awg';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export interface PushHookResult {
  isSupported: boolean;
  permission: NotificationPermission;
  isSwReady: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(userId: string | null): PushHookResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSwReady, setIsSwReady] = useState(false);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!isSupported || !userId) return;
    const init = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        swRegRef.current = reg;
        setIsSwReady(true);
        setPermission(Notification.permission);
        const existing = await reg.pushManager.getSubscription();
        if (existing) setIsSubscribed(true);
      } catch (err: any) {
        console.warn('[Push] Error al registrar SW:', err);
      }
    };
    init();
  }, [isSupported, userId]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId || !swRegRef.current) {
      setError('Push no soportado en este browser');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permiso de notificaciones denegado');
        setIsLoading(false);
        return;
      }
      const subscription = await swRegRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = subscription.toJSON();
      const { error: dbErr } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            usuario_id: userId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
            user_agent: navigator.userAgent.slice(0, 200),
          },
          { onConflict: 'endpoint' }
        );
      if (dbErr) throw dbErr;
      setIsSubscribed(true);
    } catch (err: any) {
      setError(err.message || 'Error al activar notificaciones');
      console.error('[Push] Error suscripcion:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!swRegRef.current) return;
    setIsLoading(true);
    try {
      const sub = await swRegRef.current.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
      setIsSubscribed(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, permission, isSwReady, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
