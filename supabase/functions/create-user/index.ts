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
    web_slug?: string;
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

    const body = await req.json();
    console.log('[create-user] Request body:', JSON.stringify(body, null, 2));

    const { password, userData }: CreateUserRequest = body;

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'userData is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
        console.error('[create-user] Error sending welcome email:', await welcomeResponse.text());
      } else {
        console.log('[create-user] Welcome email sent successfully');
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
          console.error('[create-user] Error sending welcome WhatsApp:', await whatsappResponse.text());
        } else {
          console.log('[create-user] Welcome WhatsApp sent successfully');
        }
      }
    } catch (notifError) {
      console.error('[create-user] Failed to send welcome notifications:', notifError);
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