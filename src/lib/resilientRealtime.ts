import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface ResilientChannelOptions {
  /** Prefijo del nombre de canal — se le agrega un sufijo único por conexión. */
  channelName: string;
  /** Agrega los `.on('postgres_changes', ...)` que le interesan a quien llama. */
  configure: (channel: RealtimeChannel) => RealtimeChannel;
  /**
   * Se llama después de cada conexión exitosa (incluida la primera) y cuando la
   * pestaña recupera el foco o la red vuelve — cubre los cambios que pudieron
   * perderse mientras el canal estaba caído o el navegador tenía la pestaña
   * en pausa (los navegadores suspenden websockets en segundo plano sin
   * disparar necesariamente CHANNEL_ERROR).
   */
  onReconnect: () => void;
}

/**
 * Suscripción realtime que se reconecta sola: reintenta con backoff si el canal
 * falla (CHANNEL_ERROR/TIMED_OUT/CLOSED) y fuerza una reconexión + refetch cuando
 * la pestaña vuelve a estar visible o el navegador recupera la red — sin esto,
 * un globo puede quedarse desactualizado hasta que el usuario recarga la página.
 */
export function subscribeResilientChannel({ channelName, configure, onReconnect }: ResilientChannelOptions) {
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: RealtimeChannel | null = null;
  let cancelled = false;
  let attempt = 0;

  const connect = () => {
    if (cancelled) return;

    const channel = configure(supabase.channel(`${channelName}-${Date.now()}`));

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        attempt = 0;
        onReconnect();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!cancelled) {
          supabase.removeChannel(channel);
          const delay = Math.min(3000 * 2 ** attempt, 30000);
          attempt++;
          retryTimeout = setTimeout(connect, delay);
        }
      }
    });

    currentChannel = channel;
  };

  connect();

  const handleVisibilityOrOnline = () => {
    if (cancelled) return;
    if (document.visibilityState !== 'visible') return;

    onReconnect();

    if (!currentChannel || currentChannel.state !== 'joined') {
      if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
      if (currentChannel) supabase.removeChannel(currentChannel);
      attempt = 0;
      connect();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityOrOnline);
  window.addEventListener('online', handleVisibilityOrOnline);
  window.addEventListener('focus', handleVisibilityOrOnline);

  return () => {
    cancelled = true;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (currentChannel) supabase.removeChannel(currentChannel);
    document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
    window.removeEventListener('online', handleVisibilityOrOnline);
    window.removeEventListener('focus', handleVisibilityOrOnline);
  };
}
