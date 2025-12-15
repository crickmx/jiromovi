import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeleteUserRequest {
  userId: string;
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
      .maybeSingle();

    if (currentUserData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Solo los Administradores pueden eliminar usuarios' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userId === currentUser.id) {
      return new Response(
        JSON.stringify({ error: 'No puedes eliminarte a ti mismo' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: deleteResult, error: rpcError } = await supabaseAdmin
      .rpc('safe_delete_user', { user_id_to_delete: userId });

    if (rpcError) {
      console.error('Error calling safe_delete_user function:', rpcError);
      return new Response(
        JSON.stringify({
          error: 'Error al eliminar usuario de la base de datos',
          details: rpcError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!deleteResult || !deleteResult.success) {
      console.error('Delete function returned error:', deleteResult);

      const errorMessage = deleteResult?.error || 'Error desconocido al eliminar usuario';
      const errorDetails = deleteResult?.detail || '';

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorDetails
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({
          error: 'Usuario eliminado de la base de datos pero error al eliminar de autenticación',
          details: deleteAuthError.message,
          partialSuccess: true
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario eliminado correctamente',
        details: deleteResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in delete-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});