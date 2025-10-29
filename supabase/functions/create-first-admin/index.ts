import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const { data: existingUsers } = await supabaseAdmin
      .from('usuarios')
      .select('id', { count: 'exact', head: true });

    if (existingUsers && existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Admin user already exists' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: oficinas } = await supabaseAdmin
      .from('oficinas')
      .select('id, nombre')
      .eq('nombre', 'Oficina Principal')
      .single();

    if (!oficinas) {
      return new Response(
        JSON.stringify({ error: 'Oficina Principal not found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const email = 'ccjimenez@jiro.com.mx';
    const password = 'Movi2024!';

    console.log('Creating admin user:', email);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        nombre: 'Christofer',
        apellidos: 'Cruz-Chousal Jiménez',
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
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
        JSON.stringify({ error: 'Failed to create auth user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Auth user created:', authData.user.id);

    const { error: insertError } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      username: 'ccjimenez',
      nombre: 'Christofer',
      apellidos: 'Cruz-Chousal Jiménez',
      rol: 'Administrador',
      email_laboral: email,
      puesto: 'Director General',
      oficina_id: oficinas.id,
      activo: true,
      estado: 'activo',
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Usuario profile created');

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        email: email,
        message: 'Admin user created successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});