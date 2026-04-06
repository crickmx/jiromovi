import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegisterEmployeeRequest {
  password: string;
  userData: {
    nombre: string;
    apellidos: string;
    rol: string;
    email_laboral: string;
    puesto: string;
    oficina_id: string;
    fecha_nacimiento: string;
    fecha_ingreso_jiro: string;
    celular_laboral: string;
    extension_telefonica?: string;
    imagen_perfil_url?: string;
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

    let currentUserId: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: currentUser } } = await supabaseAdmin.auth.getUser(token);
      if (currentUser) {
        currentUserId = currentUser.id;
      }
    }

    const body = await req.json();
    console.log('[register-employee] Request body:', JSON.stringify(body, null, 2));

    const { password, userData }: RegisterEmployeeRequest = body;

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'userData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userData.email_laboral || !password) {
      return new Response(
        JSON.stringify({
          error: 'Email laboral and password are required',
          details: {
            email_laboral: userData.email_laboral ? 'provided' : 'missing',
            password: password ? 'provided' : 'missing'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userData.nombre || !userData.apellidos) {
      return new Response(
        JSON.stringify({
          error: 'Nombre y apellidos son requeridos',
          details: {
            nombre: userData.nombre ? 'provided' : 'missing',
            apellidos: userData.apellidos ? 'provided' : 'missing'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email_laboral', userData.email_laboral)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Ya existe un usuario con ese email laboral' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-employee] Creating auth user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email_laboral,
      password,
      email_confirm: false,
      user_metadata: {
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        rol: 'Empleado'
      }
    });

    if (authError) {
      console.error('[register-employee] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Error en autenticación: ' + authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-employee] Auth user created:', authData.user.id);

    const insertData = {
      id: authData.user.id,
      nombre: userData.nombre.toUpperCase(),
      apellidos: userData.apellidos.toUpperCase(),
      rol: 'Empleado',
      email_laboral: userData.email_laboral.toLowerCase(),
      puesto: userData.puesto,
      oficina_id: userData.oficina_id,
      fecha_nacimiento: userData.fecha_nacimiento,
      fecha_ingreso_jiro: userData.fecha_ingreso_jiro,
      celular_personal: '',
      email_personal: '',
      celular_laboral: userData.celular_laboral,
      extension_telefonica: userData.extension_telefonica || '',
      imagen_perfil_url: userData.imagen_perfil_url || '/display-avatar.png',
      created_by: currentUserId,
      password_generated_at: new Date().toISOString(),
      status: 'pendiente_activacion',
      activo: false,
      banco: '',
      clabe: '',
    };

    console.log('[register-employee] Inserting into usuarios table...');

    const { error: insertError, data: insertedData } = await supabaseAdmin
      .from('usuarios')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[register-employee] Database insert error:', insertError);

      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({
          error: 'Error al insertar usuario en BD: ' + insertError.message,
          details: insertError.details || insertError.message,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-employee] User inserted successfully:', insertedData);

    if (currentUserId) {
      try {
        const { error: auditError } = await supabaseAdmin
          .from('auditoria_usuarios')
          .insert({
            usuario_id: authData.user.id,
            accion: 'crear',
            realizado_por: currentUserId,
            detalles: {
              nombre: userData.nombre,
              apellidos: userData.apellidos,
              email_laboral: userData.email_laboral,
              puesto: userData.puesto,
              status: 'pendiente_activacion',
              oficina_id: userData.oficina_id,
              origen: 'registro_publico'
            }
          });

        if (auditError) {
          console.error('[register-employee] Error al guardar auditoría:', auditError);
        }
      } catch (auditError) {
        console.error('[register-employee] Error al guardar auditoría:', auditError);
      }
    }

    console.log('[register-employee] Notificando a administradores...');
    try {
      const { error: notifError } = await supabaseAdmin.rpc('enviar_notificacion_completa', {
        p_tipo_codigo: 'nuevo_usuario_creado',
        p_user_id: authData.user.id,
        p_titulo: 'Nuevo empleado registrado',
        p_mensaje: `Se ha registrado un nuevo empleado: ${userData.nombre} ${userData.apellidos}`,
        p_modulo: 'usuarios',
        p_datos_adicionales: {
          email_laboral: userData.email_laboral,
          puesto: userData.puesto,
        },
        p_accion_url: `/usuario/${authData.user.id}`
      });

      if (notifError) {
        console.error('[register-employee] Error al enviar notificación:', notifError);
      }
    } catch (notifError) {
      console.error('[register-employee] Error al enviar notificación:', notifError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        message: 'Empleado registrado correctamente. El usuario quedó pendiente de activación.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[register-employee] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Server error: ' + error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
