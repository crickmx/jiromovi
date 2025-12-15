import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  password: string;
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
    url_web_jiro?: string;
    url_web_multicotizador?: string;
    regimen_fiscal_id?: string | null;
    banco?: string;
    clabe?: string;
    dias_vacaciones_disponibles?: number;
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

    const { password, userData }: CreateUserRequest = await req.json();

    if (!userData.email_laboral || !password) {
      return new Response(
        JSON.stringify({ error: 'Email laboral and password are required' }),
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

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email_laboral,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
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
      url_web_jiro: userData.url_web_jiro || '',
      url_web_multicotizador: userData.url_web_multicotizador || '',
      regimen_fiscal_id: userData.regimen_fiscal_id || null,
      banco: userData.banco || '',
      clabe: userData.clabe || '',
      dias_vacaciones_disponibles: userData.dias_vacaciones_disponibles || 0,
      estado: isGerente ? 'registrado' : 'activo',
    });

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      const welcomeResponse = await fetch(
        `${supabaseUrl}/functions/v1/enviar-correo-transaccional`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            tipo: 'bienvenida',
            destinatario: userData.email_laboral,
            datos: {
              nombre: userData.nombre,
              apellidos: userData.apellidos,
              email_laboral: userData.email_laboral,
              rol: userData.rol,
              puesto: userData.puesto || '',
              nombre_plataforma: 'MOVI Digital',
              fecha: new Date().toLocaleDateString('es-MX'),
            },
          }),
        }
      );

      if (!welcomeResponse.ok) {
        console.error('Error sending welcome email:', await welcomeResponse.text());
      } else {
        console.log('Welcome email sent successfully');
      }

      if (userData.celular_personal || userData.celular_laboral) {
        const whatsappResponse = await fetch(
          `${supabaseUrl}/functions/v1/enviar-whatsapp`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              tipo: 'bienvenida',
              numero: userData.celular_personal || userData.celular_laboral,
              datos: {
                nombre: userData.nombre,
                apellidos: userData.apellidos,
                email_laboral: userData.email_laboral,
                rol: userData.rol,
                puesto: userData.puesto || '',
                nombre_plataforma: 'MOVI Digital',
                fecha: new Date().toLocaleDateString('es-MX'),
              },
            }),
          }
        );

        if (!whatsappResponse.ok) {
          console.error('Error sending welcome WhatsApp:', await whatsappResponse.text());
        } else {
          console.log('Welcome WhatsApp sent successfully');
        }
      }
    } catch (notifError) {
      console.error('Failed to send welcome notifications:', notifError);
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});