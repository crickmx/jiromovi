import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdatePasswordRequest {
  userId: string;
  password?: string;
  email?: string;
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

    console.log('[update-user-password] Iniciando actualización de contraseña');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { userId, password, email }: UpdatePasswordRequest = await req.json();

    console.log('[update-user-password] Request:', { userId, hasPassword: !!password, hasEmail: !!email });

    if (!userId) {
      console.error('[update-user-password] Error: userId no proporcionado');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!password && !email) {
      console.error('[update-user-password] Error: ni password ni email proporcionados');
      return new Response(
        JSON.stringify({ error: 'At least password or email must be provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const updateData: { password?: string; email?: string; email_confirm?: boolean } = {};
    if (password) updateData.password = password;
    if (email) {
      updateData.email = email;
      updateData.email_confirm = true;
    }

    console.log('[update-user-password] Llamando a auth.admin.updateUserById...');

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateData
    );

    if (error) {
      console.error('[update-user-password] Error de Supabase:', error.message);
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[update-user-password] Contraseña actualizada exitosamente para userId:', userId);
    console.log('[update-user-password] User data:', data.user?.email);

    return new Response(
      JSON.stringify({
        success: true,
        userId: userId,
        email: data.user?.email,
        updated: true
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[update-user-password] Error catch:', error.message, error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
      status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});