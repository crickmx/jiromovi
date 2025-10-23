import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  userData: {
    username: string;
    nombre: string;
    apellidos: string;
    rol: string;
    puesto?: string;
    oficina_id?: string | null;
    fecha_nacimiento?: string | null;
    fecha_ingreso?: string | null;
    celular_personal?: string;
    email_personal?: string;
    celular_laboral?: string;
    email_laboral?: string;
    extension_telefonica?: string;
    url_web_jiro?: string;
    url_web_multicotizador?: string;
    esquema_pago_id?: string | null;
    banco?: string;
    clabe?: string;
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

    const { email, password, userData }: CreateUserRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
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
      username: userData.username,
      nombre: userData.nombre,
      apellidos: userData.apellidos,
      rol: userData.rol,
      puesto: userData.puesto || '',
      oficina_id: userData.oficina_id || null,
      fecha_nacimiento: userData.fecha_nacimiento || null,
      fecha_ingreso: userData.fecha_ingreso || null,
      celular_personal: userData.celular_personal || '',
      email_personal: userData.email_personal || '',
      celular_laboral: userData.celular_laboral || '',
      email_laboral: userData.email_laboral || '',
      extension_telefonica: userData.extension_telefonica || '',
      url_web_jiro: userData.url_web_jiro || '',
      url_web_multicotizador: userData.url_web_multicotizador || '',
      esquema_pago_id: userData.esquema_pago_id || null,
      banco: userData.banco || '',
      clabe: userData.clabe || '',
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
      const notificationResponse = await fetch(
        `${supabaseUrl}/functions/v1/send-internal-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usuarioId: authData.user.id,
          }),
        }
      );

      if (!notificationResponse.ok) {
        console.error('Error sending internal notification:', await notificationResponse.text());
      } else {
        const notificationResult = await notificationResponse.json();
        console.log('Internal notification sent:', notificationResult);
      }
    } catch (notifError) {
      console.error('Failed to send internal notification:', notifError);
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