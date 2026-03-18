import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { userId, prospectoId, prospectoNombre } = await req.json();

    if (!userId) {
      throw new Error('userId es requerido');
    }

    // Verificar que el usuario es agente
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, rol')
      .eq('id', userId)
      .single();

    if (userError || !usuario || usuario.rol !== 'Agente') {
      throw new Error('Usuario no encontrado o no es agente');
    }

    // Verificar límite diario (máximo 50 XP diarios por prospectos)
    const today = new Date().toISOString().split('T')[0];
    const { data: todayEvents } = await supabase
      .from('agent_gamification_events')
      .select('xp_delta')
      .eq('user_id', userId)
      .eq('tipo_evento', 'prospecto')
      .gte('fecha_evento', today + 'T00:00:00')
      .lte('fecha_evento', today + 'T23:59:59');

    const todayXP = todayEvents?.reduce((sum, e) => sum + e.xp_delta, 0) || 0;

    // XP por prospecto: 10 (máximo 50 diarios)
    let xpDelta = 10;
    if (todayXP + xpDelta > 50) {
      xpDelta = Math.max(0, 50 - todayXP);
    }

    const jcDelta = 0;

    // Solo registrar si hay XP a otorgar
    if (xpDelta > 0) {
      // Registrar evento
      const { data: eventId, error: eventError } = await supabase.rpc('add_gamification_event', {
        p_user_id: userId,
        p_tipo_evento: 'prospecto',
        p_referencia_tipo: 'prospecto',
        p_referencia_id: prospectoId,
        p_xp_delta: xpDelta,
        p_jc_delta: jcDelta,
        p_reversible: false,
        p_metadata: {
          prospecto_nombre: prospectoNombre,
        },
      });

      if (eventError) {
        console.error('Error adding gamification event:', eventError);
        throw eventError;
      }

      // Verificar misión de prospectos
      const { data: missions } = await supabase
        .from('agent_missions')
        .select('id, regla_json')
        .eq('activa', true);

      if (missions) {
        for (const mission of missions) {
          const regla = mission.regla_json as any;
          if (regla.tipo === 'prospectos') {
            await supabase.rpc('check_mission_progress', {
              p_user_id: userId,
              p_mission_id: mission.id,
              p_incremento: 1,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          eventId,
          xpDelta,
          jcDelta,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Límite diario de XP por prospectos alcanzado',
          xpDelta: 0,
          jcDelta: 0,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
