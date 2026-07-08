import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeResilientChannel } from '../lib/resilientRealtime';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useAuth } from '../contexts/AuthContext';

let _instanceId = 0;

export function useTramitesAttentionCount(userId: string | null | undefined) {
  const [count, setCount] = useState(0);
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { usuario } = useAuth();
  const channelName = useRef(`tramites-attention-count-${++_instanceId}`);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (!userId) { setCount(0); return; }

    const fetchCount = async () => {
      // Admin (no impersonando): solo cuenta tramites donde el agente fue el último en actuar
      // (empleado necesita responder), NO cuando el empleado ya respondió.
      // Usa RPC porque necesita comparar dos columnas (ultima_accion_por = agente_id).
      if (isAdmin && !isImpersonating) {
        const { data } = await supabase.rpc('get_admin_tramites_attention_count');
        setCount((data as number) ?? 0);
        return;
      }

      // Determinar el ID efectivo para comparar (impersonado o real)
      const effectiveId = isImpersonating && impersonatedUser ? impersonatedUser.id : userId;

      let query = supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .is('eliminado_at', null)
        .is('cerrado_en', null)
        // null (sin acción) O alguien más fue el último en actuar O se marcó a mano
        .or(`ultima_accion_por.is.null,ultima_accion_por.neq.${effectiveId},requiere_atencion_manual.eq.true`);

      // En Vista Admin impersonando un agente: RLS devuelve todos los tickets del sistema.
      // Restringir solo a los tickets que el usuario impersonado puede ver.
      if (isImpersonating && impersonatedUser && !['Administrador'].includes(impersonatedUser.rol || '')) {
        const uid = impersonatedUser.id;
        const { data: gruposData } = await supabase
          .from('tramites_grupos_miembros')
          .select('grupo_id')
          .eq('usuario_id', uid);
        const grupIds = (gruposData || []).map((g: { grupo_id: string }) => g.grupo_id);
        let orFilter = `agente_id.eq.${uid},creado_por.eq.${uid},assigned_to_user_id.eq.${uid},agente_usuario_id.eq.${uid},attending_user_id.eq.${uid}`;
        if (grupIds.length > 0) orFilter += `,and(assigned_to_user_id.is.null,attending_user_id.is.null,grupo_asignado_id.in.(${grupIds.join(',')}))`;
        query = query.or(orFilter);
      }

      const { count: c } = await query;
      setCount(c ?? 0);
    };

    fetchCount();

    const unsubscribe = subscribeResilientChannel({
      channelName: channelName.current,
      configure: (channel) =>
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchCount),
      onReconnect: fetchCount,
    });

    return unsubscribe;
  }, [userId, isAdmin, isImpersonating, impersonatedUser?.id]);

  return count;
}
