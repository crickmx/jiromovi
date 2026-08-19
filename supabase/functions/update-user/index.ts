import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdateUserRequest {
  userId: string;
  userData: {
    nombre?: string;
    apellidos?: string;
    rol?: string;
    rol_id?: string | null;
    email_laboral?: string;
    puesto?: string;
    oficina_id?: string | null;
    fecha_nacimiento?: string | null;
    fecha_ingreso?: string | null;
    celular_personal?: string;
    email_personal?: string;
    celular_laboral?: string;
    extension_telefonica?: string;
    web_slug?: string | null;
    url_web_jiro?: string;
    url_web_multicotizador?: string;
    regimen_fiscal_id?: string | null;
    banco?: string;
    clabe?: string;
    dias_vacaciones_disponibles?: number;
    equipo_computo?: string | null;
    equipo_celular?: string | null;
    plan_mkt_premium?: boolean;
    seguros_express_habilitado?: boolean;
    imagen_perfil_url?: string | null;
    mi_logotipo_url?: string | null;
    ubicacion_lat?: number | null;
    ubicacion_lng?: number | null;
    ubicacion_direccion_manual?: string | null;
    ubicacion_metodo?: 'gps' | 'manual' | null;
    id_sicas?: string | null;
    nombre_sicas?: string | null;
  };
}

function normalizeSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  return trimmed !== '' ? trimmed : null;
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser(token);

    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: currentUserData } = await supabaseAdmin
      .from('usuarios')
      .select('rol, oficina_id')
      .eq('id', currentUser.id)
      .single();

    const isAdmin = currentUserData?.rol === 'Administrador';
    const isGerente = currentUserData?.rol === 'Gerente';

    let isMktEquipo = false;
    if (!isAdmin && !isGerente) {
      const { data: gruposMkt } = await supabaseAdmin.from('mkt_equipos_acceso').select('grupo_id');
      const gruposConAcceso = (gruposMkt ?? []).map((g) => g.grupo_id);
      if (gruposConAcceso.length > 0) {
        const { count } = await supabaseAdmin
          .from('tramites_grupos_miembros')
          .select('grupo_id', { count: 'exact', head: true })
          .eq('usuario_id', currentUser.id)
          .in('grupo_id', gruposConAcceso);
        isMktEquipo = (count ?? 0) > 0;
      }
    }

    if (!isAdmin && !isGerente && !isMktEquipo) {
      return new Response(
        JSON.stringify({ error: 'No tienes permiso para actualizar usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('[update-user] Request body:', JSON.stringify({ ...body, userData: { ...body.userData, password: '[REDACTED]' } }, null, 2));

    const { userId, userData }: UpdateUserRequest = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'userData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, oficina_id')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) {
      return new Response(
        JSON.stringify({ error: 'Error loading target user', details: targetError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isGerente && targetUser.oficina_id !== currentUserData?.oficina_id) {
      return new Response(
        JSON.stringify({ error: 'Los Gerentes solo pueden editar usuarios de su oficina' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isMktEquipo && !['Agente', 'Empleado'].includes(String(userData.rol ?? targetUser.rol))) {
      return new Response(
        JSON.stringify({ error: 'El equipo de Marketing solo puede editar usuarios Agente o Empleado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webSlug = normalizeSlug(userData.web_slug);
    if (webSlug) {
      if (!/^[a-z0-9-]+$/.test(webSlug)) {
        return new Response(
          JSON.stringify({ error: 'El slug solo puede contener letras minúsculas, números y guiones' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingSlug, error: slugError } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('web_slug', webSlug)
        .maybeSingle();

      if (slugError) {
        return new Response(
          JSON.stringify({ error: 'Error validando el slug', details: slugError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingSlug && existingSlug.id !== userId) {
        return new Response(
          JSON.stringify({ error: `El slug "${webSlug}" ya está en uso. Por favor elige otro.` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (userData.nombre !== undefined) updateData.nombre = userData.nombre;
    if (userData.apellidos !== undefined) updateData.apellidos = userData.apellidos;
    if (userData.rol !== undefined) updateData.rol = userData.rol;
    if (userData.rol_id !== undefined) updateData.rol_id = userData.rol_id;
    if (userData.puesto !== undefined) updateData.puesto = userData.puesto;
    if (userData.oficina_id !== undefined) updateData.oficina_id = userData.oficina_id;
    if (userData.web_slug !== undefined) updateData.web_slug = webSlug;
    if (userData.url_web_jiro !== undefined) updateData.url_web_jiro = userData.url_web_jiro;
    if (userData.url_web_multicotizador !== undefined) updateData.url_web_multicotizador = userData.url_web_multicotizador;
    if (userData.fecha_nacimiento !== undefined) updateData.fecha_nacimiento = userData.fecha_nacimiento;
    if (userData.fecha_ingreso !== undefined) updateData.fecha_ingreso = userData.fecha_ingreso;
    if (userData.celular_personal !== undefined) updateData.celular_personal = userData.celular_personal;
    if (userData.email_personal !== undefined) updateData.email_personal = userData.email_personal;
    if (userData.celular_laboral !== undefined) updateData.celular_laboral = userData.celular_laboral;
    if (userData.email_laboral !== undefined) updateData.email_laboral = userData.email_laboral;
    if (userData.extension_telefonica !== undefined) updateData.extension_telefonica = userData.extension_telefonica;
    if (userData.regimen_fiscal_id !== undefined) updateData.regimen_fiscal_id = userData.regimen_fiscal_id;
    if (userData.banco !== undefined) updateData.banco = userData.banco;
    if (userData.clabe !== undefined) updateData.clabe = userData.clabe;
    if (userData.dias_vacaciones_disponibles !== undefined) updateData.dias_vacaciones_disponibles = userData.dias_vacaciones_disponibles;
    if (userData.equipo_computo !== undefined) updateData.equipo_computo = userData.equipo_computo;
    if (userData.equipo_celular !== undefined) updateData.equipo_celular = userData.equipo_celular;
    if (userData.plan_mkt_premium !== undefined) updateData.plan_mkt_premium = userData.plan_mkt_premium;
    if (userData.seguros_express_habilitado !== undefined) updateData.seguros_express_habilitado = userData.seguros_express_habilitado;
    if (userData.imagen_perfil_url !== undefined) updateData.imagen_perfil_url = userData.imagen_perfil_url;
    if (userData.mi_logotipo_url !== undefined) updateData.mi_logotipo_url = userData.mi_logotipo_url;
    if (userData.ubicacion_lat !== undefined) updateData.ubicacion_lat = userData.ubicacion_lat;
    if (userData.ubicacion_lng !== undefined) updateData.ubicacion_lng = userData.ubicacion_lng;
    if (userData.ubicacion_direccion_manual !== undefined) updateData.ubicacion_direccion_manual = userData.ubicacion_direccion_manual;
    if (userData.ubicacion_metodo !== undefined) updateData.ubicacion_metodo = userData.ubicacion_metodo;
    if (userData.id_sicas !== undefined) updateData.id_sicas = userData.id_sicas;
    if (userData.nombre_sicas !== undefined) updateData.nombre_sicas = userData.nombre_sicas;

    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update(updateData)
      .eq('id', userId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Error actualizando usuario', details: updateError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[update-user] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
