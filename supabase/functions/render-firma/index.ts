import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Helper para generar Mi Página Web desde slug
function getMiPaginaWeb(slug: string | null | undefined): string {
  if (!slug) return '';
  return `agentedeseguros.online/${slug}`;
}

// Simple Handlebars-like template engine
function renderTemplate(template: string, data: any): string {
  let result = template;
  
  // Replace simple variables {{variable}}
  result = result.replace(/\{\{([^#\/][^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return data[trimmedKey] !== undefined && data[trimmedKey] !== null ? String(data[trimmedKey]) : '';
  });
  
  // Handle conditional blocks {{#if variable}}...{{/if}}
  result = result.replace(/\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    const trimmedKey = key.trim();
    const value = data[trimmedKey];
    if (value && value !== '' && value !== null && value !== undefined) {
      // Recursively render the content inside the if block
      return renderTemplate(content, data);
    }
    return '';
  });
  
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { usuarioId, templateId } = body;

    const targetUserId = usuarioId || user.id;

    console.log('[render-firma] Buscando usuario:', targetUserId);

    // Obtener datos del usuario y oficina
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select(`
        *,
        oficinas (
          id,
          nombre,
          domicilio,
          telefono,
          email,
          facebook,
          instagram
        )
      `)
      .eq('id', targetUserId)
      .single();

    if (usuarioError) {
      console.error('[render-firma] Error obteniendo usuario:', usuarioError);
      return new Response(
        JSON.stringify({
          error: 'Usuario no encontrado',
          details: usuarioError.message,
          userId: targetUserId
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!usuario) {
      console.error('[render-firma] Usuario no existe:', targetUserId);
      return new Response(
        JSON.stringify({
          error: 'Usuario no encontrado',
          userId: targetUserId
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[render-firma] Usuario encontrado:', usuario.nombre, usuario.apellidos);

    // Obtener firma asignada
    let firmaHtml = '';
    let firmaInfo = null;

    if (templateId) {
      // Vista previa con template específico
      const { data: template } = await supabase
        .from('firma_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (template) {
        firmaHtml = template.html;
        firmaInfo = {
          template_id: template.id,
          template_nombre: template.nombre,
          tipo_asignacion: 'preview'
        };
      }
    } else {
      // Obtener firma asignada por prioridad
      const { data: firmaAsignada, error: firmaError } = await supabase
        .rpc('get_firma_asignada', { p_usuario_id: targetUserId });

      if (firmaError) {
        console.error('Error obteniendo firma:', firmaError);
      }

      if (firmaAsignada && firmaAsignada.length > 0) {
        firmaHtml = firmaAsignada[0].template_html;
        firmaInfo = {
          template_id: firmaAsignada[0].template_id,
          template_nombre: firmaAsignada[0].template_nombre,
          tipo_asignacion: firmaAsignada[0].tipo_asignacion,
          prioridad: firmaAsignada[0].prioridad
        };
      }
    }

    if (!firmaHtml) {
      return new Response(
        JSON.stringify({ 
          error: 'No hay firma asignada',
          html: '',
          info: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar datos para el template
    const templateData: any = {
      // Datos del usuario
      nombre: usuario.nombre || '',
      apellidos: usuario.apellidos || '',
      rol: usuario.rol || '',
      puesto: usuario.puesto || '',
      email_laboral: usuario.email_laboral || '',
      celular_laboral: usuario.celular_laboral || '',
      extension_telefonica: usuario.extension_telefonica || '',
      mi_pagina_web: getMiPaginaWeb(usuario.web_slug),
      web_slug: usuario.web_slug || '',
      imagen_perfil: usuario.imagen_perfil_url || '',
    };

    // Datos de la oficina
    if (usuario.oficinas) {
      const oficina = usuario.oficinas;
      templateData.oficina_nombre = oficina.nombre || '';
      templateData.oficina_direccion = oficina.domicilio || '';
      templateData.oficina_domicilio = oficina.domicilio || '';
      templateData.oficina_telefono = oficina.telefono || '';
      templateData.oficina_email = oficina.email || '';
      templateData.oficina_facebook = oficina.facebook || '';
      templateData.oficina_instagram = oficina.instagram || '';
    }

    // Renderizar template
    const renderedHtml = renderTemplate(firmaHtml, templateData);

    return new Response(
      JSON.stringify({
        success: true,
        html: renderedHtml,
        info: firmaInfo,
        data: templateData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error renderizando firma:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al renderizar firma' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});