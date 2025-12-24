import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DeleteUserRequest {
  userId: string;
  reason?: string;
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client with user token to verify authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user: currentUser }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !currentUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: currentUserData } = await supabaseAdmin
      .from('usuarios')
      .select('rol, is_deleted')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!currentUserData || currentUserData.rol !== 'Administrador' || currentUserData.is_deleted === true) {
      return new Response(
        JSON.stringify({ error: 'Solo los Administradores activos pueden eliminar usuarios' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { userId, reason }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId es requerido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call the soft delete function
    const { data: deleteResult, error: rpcError } = await supabaseAdmin
      .rpc('safe_delete_user', {
        user_id_to_delete: userId,
        deleted_by_admin_id: currentUser.id,
        deletion_reason: reason || null
      });

    if (rpcError) {
      console.error('Error calling safe_delete_user function:', rpcError);
      return new Response(
        JSON.stringify({
          error: 'Error al eliminar usuario',
          details: rpcError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!deleteResult || !deleteResult.success) {
      console.error('Delete function returned error:', JSON.stringify(deleteResult, null, 2));

      const errorMessage = deleteResult?.error || 'Error desconocido al eliminar usuario';

      let detailedError: any = {
        error: errorMessage,
        error_code: deleteResult?.error_code
      };

      if (deleteResult?.error_code === 'LAST_ADMIN') {
        detailedError.message = 'No se puede eliminar el último administrador activo del sistema';
      } else if (deleteResult?.error_code === 'CANNOT_DELETE_SELF') {
        detailedError.message = 'No puedes eliminarte a ti mismo';
      } else if (deleteResult?.error_code === 'USER_ALREADY_DELETED') {
        detailedError.message = 'Este usuario ya está eliminado';
      } else if (deleteResult?.error_code === 'USER_NOT_FOUND') {
        detailedError.message = 'Usuario no encontrado';
      }

      // Add any additional details
      if (deleteResult?.message) detailedError.details = deleteResult.message;
      if (deleteResult?.sqlstate) detailedError.sqlstate = deleteResult.sqlstate;

      return new Response(
        JSON.stringify(detailedError),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Revoke all sessions for the deleted user
    try {
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, 'global');
      if (signOutError) {
        console.warn('Warning: Could not revoke sessions for deleted user:', signOutError.message);
      }
    } catch (signOutErr) {
      console.warn('Warning: Error revoking sessions:', signOutErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario eliminado correctamente. Acceso revocado.',
        deletion_type: 'soft_delete',
        info: 'El usuario ya no puede iniciar sesión. Sus datos históricos se conservan.',
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
      JSON.stringify({
        error: 'Error interno del servidor',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});