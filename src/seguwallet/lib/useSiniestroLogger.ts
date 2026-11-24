import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type SeguwalletInsurer } from './insurerTypes';

type EventType = 'call' | 'whatsapp' | 'view';
type EventSource = 'modal' | 'directory' | 'dashboard';

export function useSiniestroLogger(source: EventSource = 'modal') {
  const logClick = useCallback(async (
    ins: SeguwalletInsurer,
    eventType: EventType
  ): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seguwallet-log-siniestro-click`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          insurer_id: ins.id,
          insurer_name: ins.name,
          claims_phone: ins.claims_phone || null,
          event_type: eventType,
          source,
        }),
      });
    } catch {
      // Logging is fire-and-forget; never block the user action
    }
  }, [source]);

  return { logClick };
}
