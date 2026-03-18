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

    const { userId, polizaId, primaNeta, ramo, aseguradora } = await req.json();

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

    // XP por póliza: 100 base
    let xpDelta = 100;

    // Jiro Coins basados en prima neta
    const jcDelta = Math.floor(primaNeta / 1000);

    // Aplicar multiplicadores si existen
    const { data: multipliers } = await supabase
      .from('agent_xp_multipliers')
      .select('*')
      .eq('activo', true)
      .or(`tipo.eq.global,tipo.eq.ramo,tipo.eq.aseguradora`)
      .lte('fecha_inicio', new Date().toISOString().split('T')[0])
      .gte('fecha_fin', new Date().toISOString().split('T')[0]);

    if (multipliers && multipliers.length > 0) {
      for (const mult of multipliers) {
        if (mult.tipo === 'global') {
          xpDelta = Math.floor(xpDelta * mult.factor);
        } else if (mult.tipo === 'ramo' && mult.referencia === ramo) {
          xpDelta = Math.floor(xpDelta * mult.factor);
        } else if (mult.tipo === 'aseguradora' && mult.referencia === aseguradora) {
          xpDelta = Math.floor(xpDelta * mult.factor);
        }
      }
    }

    // Registrar evento
    const { data: eventId, error: eventError } = await supabase.rpc('add_gamification_event', {
      p_user_id: userId,
      p_tipo_evento: 'poliza_emitida',
      p_referencia_tipo: 'poliza',
      p_referencia_id: polizaId,
      p_xp_delta: xpDelta,
      p_jc_delta: jcDelta,
      p_reversible: true,
      p_metadata: {
        ramo,
        aseguradora,
        prima_neta: primaNeta,
      },
    });

    if (eventError) {
      console.error('Error adding gamification event:', eventError);
      throw eventError;
    }

    // Verificar progreso de misiones
    const { data: missions } = await supabase
      .from('agent_missions')
      .select('id, regla_json')
      .eq('activa', true);

    if (missions) {
      for (const mission of missions) {
        const regla = mission.regla_json as any;
        if (regla.tipo === 'polizas_emitidas') {
          await supabase.rpc('check_mission_progress', {
            p_user_id: userId,
            p_mission_id: mission.id,
            p_incremento: 1,
          });
        } else if (regla.tipo === 'prima_neta_total') {
          await supabase.rpc('check_mission_progress', {
            p_user_id: userId,
            p_mission_id: mission.id,
            p_incremento: primaNeta,
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
