import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SessionAction {
  action: 'create' | 'start' | 'end' | 'join' | 'leave' | 'update_participant';
  sessionId?: string;
  token?: string;
  participantData?: any;
  sessionData?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: SessionAction = await req.json();
    let responseData: any = {};

    switch (body.action) {
      case 'create': {
        const { sessionData } = body;
        
        const { data: newSession, error: sessionError } = await supabase
          .from('aula_virtual_sesiones')
          .insert({
            ...sessionData,
            instructor_id: user.id,
            room_id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        const { error: participantError } = await supabase
          .from('aula_virtual_participantes')
          .insert({
            sesion_id: newSession.id,
            usuario_id: user.id,
            rol_participante: 'instructor',
            puede_compartir_pantalla: true,
            puede_hablar: true,
            puede_video: true
          });

        if (participantError) throw participantError;

        responseData = { session: newSession };
        break;
      }

      case 'start': {
        const { sessionId } = body;
        
        const { data: session, error: sessionError } = await supabase
          .from('aula_virtual_sesiones')
          .update({
            esta_activa: true,
            estado: 'en_vivo',
            iniciada_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (sessionError) throw sessionError;

        if (session.grabar_sesion) {
          const { error: recordError } = await supabase
            .from('aula_virtual_grabaciones')
            .insert({
              sesion_id: sessionId,
              estado_procesamiento: 'grabando',
              iniciado_at: new Date().toISOString()
            });

          if (recordError) throw recordError;
        }

        const { error: eventError } = await supabase
          .from('aula_virtual_eventos')
          .insert({
            sesion_id: sessionId,
            tipo_evento: 'sesion_iniciada',
            datos_evento: { iniciada_por: user.id }
          });

        responseData = { session, recording: session.grabar_sesion };
        break;
      }

      case 'end': {
        const { sessionId } = body;
        
        const { data: session, error: sessionError } = await supabase
          .from('aula_virtual_sesiones')
          .update({
            esta_activa: false,
            estado: 'finalizada',
            finalizada_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (sessionError) throw sessionError;

        const { error: participantsError } = await supabase
          .from('aula_virtual_participantes')
          .update({
            estado_conexion: 'desconectado',
            salida_at: new Date().toISOString()
          })
          .eq('sesion_id', sessionId)
          .eq('estado_conexion', 'conectado');

        const { data: recording, error: recordingError } = await supabase
          .from('aula_virtual_grabaciones')
          .update({
            estado_procesamiento: 'procesando',
            completado_at: new Date().toISOString()
          })
          .eq('sesion_id', sessionId)
          .eq('estado_procesamiento', 'grabando')
          .select()
          .single();

        const { error: eventError } = await supabase
          .from('aula_virtual_eventos')
          .insert({
            sesion_id: sessionId,
            tipo_evento: 'sesion_finalizada',
            datos_evento: { finalizada_por: user.id }
          });

        responseData = { session, recording: recording || null };
        break;
      }

      case 'join': {
        const { sessionId, token: joinToken, participantData } = body;
        
        let session;
        if (joinToken) {
          const { data, error } = await supabase
            .from('aula_virtual_sesiones')
            .select('*')
            .or(`enlace_sala.eq.${joinToken},enlace_invitado.eq.${joinToken}`)
            .single();
          
          if (error) throw new Error('Token inválido');
          session = data;
        } else if (sessionId) {
          const { data, error } = await supabase
            .from('aula_virtual_sesiones')
            .select('*')
            .eq('id', sessionId)
            .single();
          
          if (error) throw error;
          session = data;
        } else {
          throw new Error('Se require sessionId o token');
        }

        if (!session.esta_activa) {
          throw new Error('La sesión no está activa');
        }

        const { data: existingParticipant } = await supabase
          .from('aula_virtual_participantes')
          .select('*')
          .eq('sesion_id', session.id)
          .eq('usuario_id', user.id)
          .maybeSingle();

        let participant;
        if (existingParticipant) {
          const { data, error } = await supabase
            .from('aula_virtual_participantes')
            .update({
              estado_conexion: 'conectado',
              ingreso_at: new Date().toISOString(),
              peer_id: participantData?.peerId || null
            })
            .eq('id', existingParticipant.id)
            .select()
            .single();
          
          if (error) throw error;
          participant = data;
        } else {
          const { data, error } = await supabase
            .from('aula_virtual_participantes')
            .insert({
              sesion_id: session.id,
              usuario_id: user.id,
              rol_participante: 'participante',
              puede_compartir_pantalla: false,
              puede_hablar: true,
              puede_video: true,
              estado_conexion: 'conectado',
              ingreso_at: new Date().toISOString(),
              peer_id: participantData?.peerId || null
            })
            .select()
            .single();
          
          if (error) throw error;
          participant = data;
        }

        const { error: eventError } = await supabase
          .from('aula_virtual_eventos')
          .insert({
            sesion_id: session.id,
            participante_id: participant.id,
            tipo_evento: 'ingreso',
            datos_evento: { usuario_id: user.id }
          });

        responseData = { session, participant };
        break;
      }

      case 'leave': {
        const { sessionId } = body;
        
        const { data: participant, error: participantError } = await supabase
          .from('aula_virtual_participantes')
          .update({
            estado_conexion: 'desconectado',
            salida_at: new Date().toISOString()
          })
          .eq('sesion_id', sessionId)
          .eq('usuario_id', user.id)
          .eq('estado_conexion', 'conectado')
          .select()
          .single();

        if (participantError) throw participantError;

        const { error: eventError } = await supabase
          .from('aula_virtual_eventos')
          .insert({
            sesion_id: sessionId,
            participante_id: participant.id,
            tipo_evento: 'salida',
            datos_evento: { usuario_id: user.id }
          });

        responseData = { participant };
        break;
      }

      case 'update_participant': {
        const { sessionId, participantData } = body;
        
        const { data: participant, error } = await supabase
          .from('aula_virtual_participantes')
          .update(participantData)
          .eq('sesion_id', sessionId)
          .eq('usuario_id', user.id)
          .select()
          .single();

        if (error) throw error;
        responseData = { participant };
        break;
      }

      default:
        throw new Error('Acción no válida');
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});