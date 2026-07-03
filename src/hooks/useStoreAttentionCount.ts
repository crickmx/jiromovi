import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function useStoreAttentionCount(userId: string | null | undefined) {
  const [count, setCount] = useState(0);
  const { usuario } = useAuth();
  // Nombre único por instancia — este hook se usa a la vez en Layout.tsx y Store.tsx;
  // un nombre de canal fijo hace que la segunda instancia reutilice el canal ya
  // suscrito de la primera y truene al intentar agregarle más listeners.
  const channelNameRef = useRef(`store-attention-count-${Math.random().toString(36).slice(2)}`);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (!userId) { setCount(0); return; }

    const fetchCount = async () => {
      if (isAdmin) {
        // Admin: tickets del store abiertos donde el agente fue el último en actuar
        // (el cliente/equipo necesita responder)
        const { count: c } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .not('store_pedido_id', 'is', null)
          .is('eliminado_at', null)
          .is('cerrado_en', null)
          .or(`ultima_accion_por.is.null,ultima_accion_por.neq.${userId}`);
        setCount(c ?? 0);
        return;
      }

      // Miembro de equipo con acceso al store: tickets del store asignados a este usuario
      // pendientes de su acción
      const { count: c } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .not('store_pedido_id', 'is', null)
        .is('eliminado_at', null)
        .is('cerrado_en', null)
        .or(`ultima_accion_por.is.null,ultima_accion_por.neq.${userId}`)
        .or(`agente_id.eq.${userId},assigned_to_user_id.eq.${userId},attending_user_id.eq.${userId}`);
      setCount(c ?? 0);
    };

    fetchCount();

    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_pedidos' }, fetchCount)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, isAdmin]);

  return count;
}
