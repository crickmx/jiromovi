import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ConversionRequest {
  grabacionId: string;
  publicar?: boolean;
  titulo?: string;
  descripcion?: string;
  categoriaId?: string;
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

    const userMetadata = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!userMetadata.data || !['Administrador', 'Gerente'].includes(userMetadata.data.rol)) {
      throw new Error('No tienes permisos para realizar esta acción');
    }

    const body: ConversionRequest = await req.json();
    const { grabacionId, publicar = false, titulo, descripcion, categoriaId } = body;

    const { data: grabacion, error: grabacionError } = await supabase
      .from('aula_virtual_grabaciones')
      .select(`
        *,
        sesion:aula_virtual_sesiones(
          id,
          titulo,
          descripcion,
          instructor_id,
          duracion_minutos
        )
      `)
      .eq('id', grabacionId)
      .single();

    if (grabacionError || !grabacion) {
      throw new Error('Grabación no encontrada');
    }

    if (grabacion.estado_procesamiento !== 'completado') {
      throw new Error('La grabación aún no está completada');
    }

    if (grabacion.publicado_ondemand) {
      throw new Error('Esta grabación ya fue publicada como contenido On Demand');
    }

    const { data: existingLesson } = await supabase
      .from('seguros_lessons')
      .select('id')
      .eq('session_id', grabacion.sesion_id)
      .maybeSingle();

    if (existingLesson) {
      throw new Error('Ya existe una lección On Demand para esta grabación');
    }

    const lessonTitulo = titulo || grabacion.sesion.titulo || 'Grabación de sesión';
    const lessonDescripcion = descripcion || grabacion.sesion.descripcion || '';

    const { data: newLesson, error: lessonError } = await supabase
      .from('seguros_lessons')
      .insert({
        titulo: lessonTitulo,
        descripcion: lessonDescripcion,
        categoria_id: categoriaId || null,
        miniatura_url: grabacion.miniatura_url,
        video_url: grabacion.archivo_procesado_url || grabacion.archivo_original_url,
        duracion: grabacion.duracion_segundos,
        oficinas_asignadas: [],
        es_grabacion: true,
        session_id: grabacion.sesion_id,
        creado_por: user.id,
        fecha_creacion: new Date().toISOString()
      })
      .select()
      .single();

    if (lessonError) {
      console.error('Error creando lección:', lessonError);
      throw new Error('Error al crear la lección On Demand');
    }

    const { error: updateGrabacionError } = await supabase
      .from('aula_virtual_grabaciones')
      .update({
        publicado_ondemand: true,
        leccion_ondemand_id: newLesson.id
      })
      .eq('id', grabacionId);

    if (updateGrabacionError) {
      console.error('Error actualizando grabación:', updateGrabacionError);
    }

    const { error: eventError } = await supabase
      .from('aula_virtual_eventos')
      .insert({
        sesion_id: grabacion.sesion_id,
        tipo_evento: 'conversion_ondemand',
        datos_evento: {
          grabacion_id: grabacionId,
          leccion_id: newLesson.id,
          publicado_por: user.id
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Grabación convertida exitosamente a contenido On Demand',
        data: {
          leccion: newLesson,
          grabacion: {
            id: grabacion.id,
            publicado_ondemand: true,
            leccion_ondemand_id: newLesson.id
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error en conversión:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error al convertir la grabación'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});