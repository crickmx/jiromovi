import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

interface CreateUserRequest {
  userData: {
    nombre: string;
    apellidos: string;
    rol: string;
    email_laboral: string;
    puesto?: string;
    oficina_id?: string | null;
    fecha_nacimiento?: string | null;
    fecha_ingreso?: string | null;
    celular_personal?: string;
    email_personal?: string;
    celular_laboral?: string;
    extension_telefonica?: string;
    web_slug?: string;
    regimen_fiscal_id?: string | null;
    banco?: string;
    clabe?: string;
    dias_vacaciones_disponibles?: number;
    equipo_computo?: string | null;
    equipo_celular?: string | null;
    seguros_express_habilitado?: boolean;
    ubicacion_lat?: number | null;
    ubicacion_lng?: number | null;
    ubicacion_direccion_manual?: string | null;
    ubicacion_metodo?: 'gps' | 'manual' | null;
    tramite_group_ids?: string[];
  };
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
      .select('rol')
      .eq('id', currentUser.id)
      .single();

    const isGerente = currentUserData?.rol === 'Gerente';
    const isAdmin = currentUserData?.rol === 'Administrador';

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
        JSON.stringify({ error: 'No tienes permiso para crear usuarios' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('[create-user] Request body:', JSON.stringify({ ...body, password: '[REDACTED]' }, null, 2));

    const { userData }: CreateUserRequest = body;

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'userData is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!userData.email_laboral) {
      return new Response(
        JSON.stringify({
          error: 'Email laboral es requerido',
          details: { email_laboral: 'missing' }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Auto-generate a secure internal password - user authenticates via code only
    const password = generateSecurePassword();

    if (!userData.nombre || !userData.apellidos) {
      return new Response(
        JSON.stringify({
          error: 'Nombre y apellidos son requeridos',
          details: {
            nombre: userData.nombre ? 'provided' : 'missing',
            apellidos: userData.apellidos ? 'provided' : 'missing'
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (isGerente && !['Empleado', 'Agente'].includes(userData.rol)) {
      return new Response(
        JSON.stringify({ error: 'Los Gerentes solo pueden crear usuarios con rol Empleado o Agente' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Equipo de Marketing: solo puede crear Agentes, sin importar lo que mande el cliente
    if (isMktEquipo) {
      userData.rol = 'Agente';
    }

    console.log('[create-user] Creating auth user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email_laboral,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('[create-user] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Error en autenticación: ' + authError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-user] Auth user created:', authData.user.id);

    const insertData = {
      id: authData.user.id,
      nombre: userData.nombre,
      apellidos: userData.apellidos,
      rol: userData.rol,
      email_laboral: userData.email_laboral,
      puesto: userData.puesto || '',
      oficina_id: userData.oficina_id || null,
      fecha_nacimiento: userData.fecha_nacimiento || null,
      fecha_ingreso: userData.fecha_ingreso || null,
      celular_personal: userData.celular_personal || '',
      email_personal: userData.email_personal || '',
      celular_laboral: userData.celular_laboral || '',
      extension_telefonica: userData.extension_telefonica || '',
      web_slug: userData.web_slug && userData.web_slug.trim() !== '' ? userData.web_slug.trim() : null,
      regimen_fiscal_id: userData.regimen_fiscal_id || null,
      banco: userData.banco || '',
      clabe: userData.clabe || '',
      dias_vacaciones_disponibles: userData.dias_vacaciones_disponibles || 0,
      equipo_computo: userData.equipo_computo || null,
      equipo_celular: userData.equipo_celular || null,
      seguros_express_habilitado: userData.seguros_express_habilitado ?? false,
      ubicacion_lat: userData.ubicacion_lat ?? null,
      ubicacion_lng: userData.ubicacion_lng ?? null,
      ubicacion_direccion_manual: userData.ubicacion_direccion_manual ?? null,
      ubicacion_metodo: userData.ubicacion_metodo ?? null,
      ubicacion_updated_at: (userData.ubicacion_lat != null || userData.ubicacion_direccion_manual)
        ? new Date().toISOString() : null,
      estado: isGerente ? 'pendiente' : 'activo',
    };

    console.log('[create-user] Inserting into usuarios table...');
    console.log('[create-user] Insert data:', JSON.stringify(insertData, null, 2));

    const { error: insertError, data: insertedData } = await supabaseAdmin
      .from('usuarios')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[create-user] ❌ Database insert error:');
      console.error('[create-user] Error message:', insertError.message);
      console.error('[create-user] Error code:', insertError.code);
      console.error('[create-user] Error details:', insertError.details);
      console.error('[create-user] Error hint:', insertError.hint);
      console.error('[create-user] Full error:', JSON.stringify(insertError, null, 2));
      
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Error al insertar usuario en BD: ' + insertError.message,
          details: insertError.details || insertError.message,
          code: insertError.code,
          hint: insertError.hint
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-user] ✅ User inserted successfully:', insertedData);

    const selectedGroupIds = Array.from(new Set((userData.tramite_group_ids || []).filter((id): id is string => typeof id === 'string' && id.trim() !== '')));
    if (isAdmin && userData.rol === 'Agente') {
      const { data: activeGroups, error: groupsError } = await supabaseAdmin
        .from('tramites_grupos_visualizacion')
        .select('id, area_categoria')
        .eq('activo', true);

      if (groupsError) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'No se pudieron validar los equipos de trámite: ' + groupsError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const activeMap = new Map<string, string[]>();
      for (const group of activeGroups ?? []) {
        const category = String(group.area_categoria || '').trim();
        if (!category) continue;
        const bucket = activeMap.get(category) ?? [];
        bucket.push(group.id);
        activeMap.set(category, bucket);
      }

      const selectedSet = new Set(selectedGroupIds);
      const missingCategories = Array.from(activeMap.entries())
        .filter(([, groupIds]) => !groupIds.some((id) => selectedSet.has(id)))
        .map(([category]) => category);

      const selectedActiveIds = selectedGroupIds.filter((id) =>
        (activeGroups ?? []).some((group) => group.id === id)
      );

      if (missingCategories.length > 0) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({
            error: 'El agente debe tener al menos un equipo en cada categoría activa',
            details: { missingCategories },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (selectedActiveIds.length !== selectedGroupIds.length) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({
            error: 'Uno o más equipos seleccionados no están activos',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const selectedGroups = (activeGroups ?? []).filter((group) => selectedSet.has(group.id));
      const selectedCategories = new Set(selectedGroups.map((group) => String(group.area_categoria || '').trim()));
      if (selectedCategories.size !== selectedGroups.length) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'Selecciona solo un equipo por categoría de trámite' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Estos equipos atienden al agente; el agente NO es miembro operativo.
      const assignments = selectedGroups.map((group) => ({
        grupo_id: group.id,
        usuario_id: authData.user.id,
        area: String(group.area_categoria || '').trim(),
        activo: true,
        created_by: currentUser.id,
      }));
      const { error: assignmentError } = await supabaseAdmin
        .from('tramites_grupos_reglas')
        .insert(assignments);

      if (assignmentError) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authData.user.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'No se pudieron guardar los equipos que atienden al agente: ' + assignmentError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Si el usuario se creó como activo, enviar notificaciones de bienvenida inmediatamente
    if (insertData.estado === 'activo') {
      console.log('[create-user] Usuario creado como activo, enviando notificaciones...');

      try {
        // Construir URL de página web pública
        const paginaWeb = userData.web_slug
          ? `https://agentedeseguros.website/${userData.web_slug}`
          : 'No configurada aún';

        // Obtener nombre de oficina
        let nombreOficina = 'No asignada';
        if (userData.oficina_id) {
          const { data: oficina } = await supabaseAdmin
            .from('oficinas')
            .select('nombre')
            .eq('id', userData.oficina_id)
            .maybeSingle();
          if (oficina) nombreOficina = oficina.nombre;
        }

        // Usar función enviar_notificacion_completa que respeta los canales configurados
        const { error: notifError } = await supabaseAdmin.rpc('enviar_notificacion_completa', {
          p_tipo_codigo: 'cuenta_activada',
          p_user_id: authData.user.id,
          p_titulo: '¡Bienvenido a MOVI Digital!',
          p_mensaje: 'Tu cuenta ha sido activada exitosamente. Explora todas las funcionalidades de la plataforma.',
          p_modulo: 'usuarios',
          p_datos_adicionales: {
            email_laboral: userData.email_laboral,
            rol: userData.rol,
            oficina: nombreOficina,
            pagina_web: paginaWeb,
            puesto: userData.puesto || ''
          },
          p_accion_url: '/dashboard'
        });

        if (notifError) {
          console.error('[create-user] Error al enviar notificaciones:', notifError);
        } else {
          console.log('[create-user] Notificaciones enviadas correctamente');
        }
      } catch (notifError) {
        console.error('[create-user] Error al enviar notificaciones:', notifError);
        // No fallar la creación del usuario si las notificaciones fallan
      }
    } else {
      console.log('[create-user] Usuario creado como pendiente, las notificaciones se enviarán cuando sea activado');
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[create-user] ❌ Unexpected error:', error);
    console.error('[create-user] Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: 'Server error: ' + error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
