import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Helper para generar Mi Página Web desde slug
function getMiPaginaWeb(slug: string | null | undefined): string {
  if (!slug) return '';
  return `agentedeseguros.website/${slug}`;
}

interface NotificationRequest {
  usuarioId: string;
}

function reemplazarPlaceholders(texto: string, variables: Record<string, any>): string {
  let resultado = texto;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    resultado = resultado.replace(regex, String(value || ''));
  }
  return resultado;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { usuarioId }: NotificationRequest = await req.json();

    if (!usuarioId) {
      return new Response(
        JSON.stringify({ error: 'Usuario ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: config } = await supabaseAdmin
      .from('configuracion_notificaciones')
      .select('*')
      .eq('clave', 'emails_notificaciones_internas')
      .eq('activo', true)
      .maybeSingle();

    if (!config || !config.valor || config.valor.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          mensaje: 'No hay correos configurados para notificaciones internas' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emails = config.valor.split(',').map((e: string) => e.trim()).filter((e: string) => e);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          mensaje: 'No hay correos válidos configurados' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: plantilla } = await supabaseAdmin
      .from('plantillas_correo')
      .select('*')
      .eq('tipo', 'notificaciones_internas')
      .eq('activo', true)
      .maybeSingle();

    if (!plantilla) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          mensaje: 'No se encontró plantilla de notificaciones internas activa' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select(`
        *,
        oficina:oficinas(nombre)
      `)
      .eq('id', usuarioId)
      .single();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const variables = {
      nombre: usuario.nombre || '',
      apellidos: usuario.apellidos || '',
      rol: usuario.rol || '',
      puesto: usuario.puesto || '',
      oficina: usuario.oficina?.nombre || 'Sin oficina',
      fecha_nacimiento: usuario.fecha_nacimiento || 'No especificada',
      fecha_ingreso: usuario.fecha_ingreso || 'No especificada',
      celular_personal: usuario.celular_personal || 'No especificado',
      email_personal: usuario.email_personal || 'No especificado',
      celular_laboral: usuario.celular_laboral || 'No especificado',
      email_laboral: usuario.email_laboral || 'No especificado',
      extension_telefonica: usuario.extension_telefonica || 'No especificada',
      equipo_computo: usuario.equipo_computo || 'No especificado',
      equipo_celular: usuario.equipo_celular || 'No especificado',
      mi_pagina_web: getMiPaginaWeb(usuario.web_slug) || 'No especificada',
      web_slug: usuario.web_slug || 'No especificado',
      empresa: 'Nuestra Empresa',
    };

    const asunto = reemplazarPlaceholders(plantilla.asunto, variables);
    const cuerpo = reemplazarPlaceholders(plantilla.cuerpo_html, variables);

    const resultados = [];

    for (const email of emails) {
      try {
        console.log(`Sending internal notification to ${email}: ${asunto}`);

        // IMPORTANTE: Registrar envío usando función centralizada
        const { error: historialError } = await supabaseAdmin.rpc('registrar_envio_notificacion', {
          p_tipo_notificacion_codigo: 'notificacion_interna',
          p_canal_envio: 'correo',
          p_usuario_id: usuarioId,
          p_destinatario_email: email,
          p_destinatario_nombre: null,
          p_numero_destino: null,
          p_asunto: asunto,
          p_cuerpo_html: cuerpo,
          p_estado: 'enviado',
          p_error_mensaje: null,
          p_enviado_por: null,
          p_evento_id: null,
          p_provider_response: null
        });

        if (historialError) {
          throw historialError;
        }

        resultados.push({
          email: email,
          estado: 'enviado',
        });
      } catch (error) {
        // Registrar error usando función centralizada
        await supabaseAdmin.rpc('registrar_envio_notificacion', {
          p_tipo_notificacion_codigo: 'notificacion_interna',
          p_canal_envio: 'correo',
          p_usuario_id: usuarioId,
          p_destinatario_email: email,
          p_destinatario_nombre: null,
          p_numero_destino: null,
          p_asunto: asunto,
          p_cuerpo_html: cuerpo,
          p_estado: 'fallido',
          p_error_mensaje: error.message,
          p_enviado_por: null,
          p_evento_id: null,
          p_provider_response: null
        });

        resultados.push({
          email: email,
          estado: 'fallido',
          mensaje: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resultados,
        total: emails.length,
        enviados: resultados.filter(r => r.estado === 'enviado').length,
        fallidos: resultados.filter(r => r.estado === 'fallido').length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en send-internal-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});