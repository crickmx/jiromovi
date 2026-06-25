import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useImpersonation } from '../contexts/ImpersonationContext';

export function useTramitesAttentionCount(userId: string | null | undefined) {
  const [count, setCount] = useState(0);
  const { isImpersonating, impersonatedUser } = useImpersonation();

  useEffect(() => {
    if (!userId) { setCount(0); return; }

    const fetchCount = async () => {
      let query = supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .is('eliminado_at', null)
        .is('cerrado_en', null)
        .not('ultima_accion_por', 'is', null)
        .neq('ultima_accion_por', userId);

      // In Vista Admin impersonation mode, the real auth session is the admin's,
      // so RLS would count all system tickets. Restrict to only tickets the
      // impersonated user can actually see.
      if (isImpersonating && impersonatedUser && !['Administrador', 'Gerente'].includes(impersonatedUser.rol || '')) {
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

    const channel = supabase
      .channel('tramites-attention-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchCount)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, isImpersonating, impersonatedUser?.id]);

  return count;
}
