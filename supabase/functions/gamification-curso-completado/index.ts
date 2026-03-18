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

    const { userId, cursoId, cursoNombre } = await req.json();

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

    // XP por curso completado: 200
    const xpDelta = 200;
    const jcDelta = 0;

    // Registrar evento
    const { data: eventId, error: eventError } = await supabase.rpc('add_gamification_event', {
      p_user_id: userId,
      p_tipo_evento: 'curso_completado',
      p_referencia_tipo: 'curso',
      p_referencia_id: cursoId,
      p_xp_delta: xpDelta,
      p_jc_delta: jcDelta,
      p_reversible: false,
      p_metadata: {
        curso_nombre: cursoNombre,
      },
    });

    if (eventError) {
      console.error('Error adding gamification event:', eventError);
      throw eventError;
    }

    // Verificar misión de cursos
    const { data: missions } = await supabase
      .from('agent_missions')
      .select('id, regla_json')
      .eq('activa', true);

    if (missions) {
      for (const mission of missions) {
        const regla = mission.regla_json as any;
        if (regla.tipo === 'cursos_completados') {
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
