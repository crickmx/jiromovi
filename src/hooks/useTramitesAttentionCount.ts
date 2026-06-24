import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTramitesAttentionCount(userId: string | null | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .is('eliminado_at', null)
        .is('cerrado_en', null)
        .not('ultima_accion_por', 'is', null)
        .neq('ultima_accion_por', userId);
      setCount(c ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel('tramites-attention-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchCount)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId]);

  return count;
}
