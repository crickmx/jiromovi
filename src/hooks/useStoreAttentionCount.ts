import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeResilientChannel } from '../lib/resilientRealtime';
import { useAuth } from '../contexts/AuthContext';
import { tieneAccesoEquipoStore } from '../lib/storeUtils';

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
      // Admin, o miembro de un equipo con acceso al store (Admin > Tienda MOVI > Equipos
      // con acceso): ve todos los pedidos, igual cuenta todo lo pendiente de respuesta.
      const tieneAccesoAmplio = isAdmin || await tieneAccesoEquipoStore(userId);

      if (tieneAccesoAmplio) {
        // Tickets del store con conversación pendiente de respuesta (se crean solo
        // cuando el pedido cambia a un estatus con trigger configurado, no al crearse).
        const ticketsQuery = supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .not('store_pedido_id', 'is', null)
          .is('eliminado_at', null)
          .is('cerrado_en', null)
          .or(`ultima_accion_por.is.null,ultima_accion_por.neq.${userId}`);

        // Pedidos recién creados en estatus "Pendiente": no generan ticket hasta que
        // alguien cambia su estatus, así que sin esto un pedido nuevo no cuenta en el globo.
        const pedidosQuery = supabase
          .from('store_pedidos')
          .select('id, estatus:store_estatus_pedidos!inner(nombre)', { count: 'exact', head: true })
          .eq('estatus.nombre', 'Pendiente');

        const [{ count: cTickets }, { count: cPedidos }] = await Promise.all([ticketsQuery, pedidosQuery]);
        setCount((cTickets ?? 0) + (cPedidos ?? 0));
        return;
      }

      // Sin acceso de equipo: solo tickets del store asignados directamente a este usuario
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

    // Ver nota en useTramitesAttentionCount: suscripción sin filtro a `tickets` +
    // `store_pedidos`; con debounce coalescemos las ráfagas de eventos en un solo
    // recálculo para no saturar el hilo principal.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { fetchCount(); }, 800);
    };

    fetchCount(); // primera carga inmediata

    const unsubscribe = subscribeResilientChannel({
      channelName: channelNameRef.current,
      configure: (channel) =>
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, scheduleFetch)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'store_pedidos' }, scheduleFetch),
      onReconnect: scheduleFetch,
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [userId, isAdmin]);

  return count;
}
