import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function stripPhoneFormat(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

function buildWhatsAppLink(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = '521' + digits;
  else if (digits.length === 12 && digits.startsWith('52')) digits = '521' + digits.slice(2);
  return `https://wa.me/${digits}`;
}

function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return trimmed;
  }
  return '';
}

function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;

  // Process {{#if variable}}...{{/if}} (handle nested by iterating)
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match: string, key: string, content: string) => {
      const value = data[key];
      return (value && value.trim()) ? content : '';
    });
  }

  // Replace {{variable}} with sanitized values
  result = result.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
    const value = data[key];
    if (value == null || value === '') return '';
    if (key.includes('link') || key.includes('logo') || key.includes('imagen') || key.includes('sitio_web') || key.includes('color')) {
      return sanitizeUrl(value) || sanitizeHtml(value);
    }
    return sanitizeHtml(value);
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
          instagram,
          logo_url,
          accent_color,
          color_secundario,
          extension,
          whatsapp,
          sitio_web
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
    const celularRaw = usuario.celular_laboral || '';
    const celularSinFormato = stripPhoneFormat(celularRaw);
    const whatsappLink = buildWhatsAppLink(celularRaw);

    const templateData: Record<string, string> = {
      // Usuario
      nombre: usuario.nombre || '',
      apellidos: usuario.apellidos || '',
      nombre_completo: usuario.nombre_completo || `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim(),
      rol: usuario.rol || '',
      puesto: usuario.puesto || '',
      email_laboral: usuario.email_laboral || '',
      celular_laboral: celularRaw,
      celular_laboral_sin_formato: celularSinFormato,
      whatsapp_link: whatsappLink,
      extension_telefonica: usuario.extension_telefonica || '',
      imagen_perfil: usuario.imagen_perfil_url || '',
      web_slug: usuario.web_slug || '',
      mi_pagina_web: usuario.web_slug ? `agentedeseguros.website/${usuario.web_slug}` : '',
    };

    // Oficina
    if (usuario.oficinas) {
      const oficina = usuario.oficinas;
      templateData.oficina_logo = oficina.logo_url || '';
      templateData.oficina_nombre = oficina.nombre || '';
      templateData.oficina_color_primario = oficina.accent_color || '#0E23E2';
      templateData.oficina_color_secundario = oficina.color_secundario || '';
      templateData.oficina_telefono = oficina.telefono || '';
      templateData.oficina_domicilio = oficina.domicilio || '';
      templateData.oficina_direccion = oficina.domicilio || '';
      templateData.oficina_extension = oficina.extension || '';
      templateData.oficina_whatsapp = oficina.whatsapp || '';
      templateData.oficina_sitio_web = oficina.sitio_web || '';
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