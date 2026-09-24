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
    email_laboral?: string;
    email_personal?: string;
    puesto?: string;
    oficina_id: string;
    fecha_nacimiento: string;
    fecha_ingreso?: string;
    celular_laboral?: string;
    celular_personal?: string;
    cedula_cnsf?: string;
    extension_telefonica?: string;
    imagen_perfil_url?: string;
    equipo_computo?: string;
    equipo_celular?: string;
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

    const { password, userData }: RegisterEmployeeRequest = body;

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'userData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rol = userData.rol === 'Agente' ? 'Agente' : 'Empleado';
    const emailAcceso = rol === 'Agente' ? userData.email_personal : userData.email_laboral;

    if (!emailAcceso || !password) {
      return new Response(
        JSON.stringify({
          error: 'El email de acceso y la contraseña son requeridos',
          details: {
            email: emailAcceso ? 'provided' : 'missing',
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

    if (rol === 'Agente' && (!userData.cedula_cnsf || !userData.celular_personal)) {
      return new Response(
        JSON.stringify({ error: 'La cédula CNSF y el celular personal son requeridos para agentes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .or(`email_laboral.eq.${emailAcceso},email_personal.eq.${emailAcceso}`)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'Ya existe un usuario con ese email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-employee] Creating auth user...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailAcceso,
      password,
      email_confirm: true,
      user_metadata: {
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        rol
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
      rol,
      email_laboral: rol === 'Empleado' ? emailAcceso.toLowerCase() : '',
      email_personal: rol === 'Agente' ? emailAcceso.toLowerCase() : '',
      puesto: rol === 'Empleado' ? userData.puesto || '' : 'Agente de Seguros',
      oficina_id: userData.oficina_id,
      fecha_nacimiento: userData.fecha_nacimiento,
      fecha_ingreso: rol === 'Empleado' ? userData.fecha_ingreso || null : null,
      celular_personal: rol === 'Agente' ? userData.celular_personal || '' : '',
      celular_laboral: rol === 'Empleado' ? userData.celular_laboral || '' : '',
      cedula_cnsf: rol === 'Agente' ? userData.cedula_cnsf || '' : null,
      extension_telefonica: userData.extension_telefonica || '',
      equipo_computo: userData.equipo_computo || '',
      equipo_celular: userData.equipo_celular || '',
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
              email: emailAcceso,
              rol,
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
        p_titulo: `Nuevo ${rol.toLowerCase()} registrado`,
        p_mensaje: `Se ha registrado un nuevo ${rol.toLowerCase()}: ${userData.nombre} ${userData.apellidos}`,
        p_modulo: 'usuarios',
        p_datos_adicionales: {
          email: emailAcceso,
          rol,
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
        message: `${rol} registrado correctamente. El usuario quedó pendiente de activación.`
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
