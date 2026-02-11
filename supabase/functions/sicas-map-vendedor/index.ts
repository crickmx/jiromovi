import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    if (req.method === 'POST') {
      const { id_sicas_vendedor, movi_user_id } = await req.json();

      if (!id_sicas_vendedor || !movi_user_id) {
        throw new Error('Missing required fields: id_sicas_vendedor, movi_user_id');
      }

      const { data: vendedorExists } = await supabase
        .from('sicas_vendedores')
        .select('id_sicas')
        .eq('id_sicas', id_sicas_vendedor)
        .single();

      if (!vendedorExists) {
        throw new Error('El vendedor SICAS no existe. Por favor, sincroniza los vendedores primero desde la pestaña "Conexión".');
      }

      const { data: usuarioExists } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', movi_user_id)
        .single();

      if (!usuarioExists) {
        throw new Error('El usuario MOVI no existe');
      }

      const { data, error } = await supabase
        .from('sicas_mapeo_vendedor_usuario')
        .upsert({
          id_sicas_vendedor,
          movi_user_id,
          mapped_by: user.id,
          mapped_at: new Date().toISOString(),
        }, {
          onConflict: 'id_sicas_vendedor',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23503') {
          throw new Error('Error de integridad: Verifica que el vendedor SICAS y el usuario MOVI existan');
        }
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      const { id_sicas_vendedor } = await req.json();

      if (!id_sicas_vendedor) {
        throw new Error('Missing required field: id_sicas_vendedor');
      }

      const { error } = await supabase
        .from('sicas_mapeo_vendedor_usuario')
        .delete()
        .eq('id_sicas_vendedor', id_sicas_vendedor);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');
  } catch (error) {
    console.error('Error mapping vendedor:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});