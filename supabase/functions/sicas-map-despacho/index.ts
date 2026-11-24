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
      const { id_sicas_despacho, movi_oficina_id } = await req.json();

      if (!id_sicas_despacho || !movi_oficina_id) {
        throw new Error('Missing required fields: id_sicas_despacho, movi_oficina_id');
      }

      const { data: despachoExists } = await supabase
        .from('sicas_catalogos')
        .select('id_sicas')
        .eq('catalog_type_id', 11)
        .eq('id_sicas', id_sicas_despacho)
        .maybeSingle();

      if (!despachoExists) {
        throw new Error('El despacho SICAS no existe. Por favor, sincroniza los despachos primero desde la pestaña "Conexión".');
      }

      const { data: oficinaExists } = await supabase
        .from('oficinas')
        .select('id')
        .eq('id', movi_oficina_id)
        .maybeSingle();

      if (!oficinaExists) {
        throw new Error('La oficina MOVI no existe');
      }

      const { data, error } = await supabase
        .from('sicas_mapeo_despacho_oficina')
        .upsert({
          id_sicas_despacho,
          movi_oficina_id,
          catalog_type_id: 11,
          mapped_by: user.id,
          mapped_at: new Date().toISOString(),
        }, {
          onConflict: 'id_sicas_despacho',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      const { id_sicas_despacho } = await req.json();

      if (!id_sicas_despacho) {
        throw new Error('Missing required field: id_sicas_despacho');
      }

      const { error } = await supabase
        .from('sicas_mapeo_despacho_oficina')
        .delete()
        .eq('id_sicas_despacho', id_sicas_despacho);

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
    console.error('Error mapping despacho:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});