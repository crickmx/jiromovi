import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No autorizado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error('No autorizado');
    }

    const { data: userData } = await supabaseUser
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.rol !== 'Administrador') {
      throw new Error('Solo administradores pueden asignar vendedores');
    }

    const { stagingSessionId, vendorKey, moviUserId, saveMapping } = await req.json();

    if (!stagingSessionId || !vendorKey || !moviUserId) {
      throw new Error('stagingSessionId, vendorKey y moviUserId son requeridos');
    }

    console.log('[assign-vendor-staging] Assigning vendor:', vendorKey, 'to user:', moviUserId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el usuario existe
    const { data: targetUser, error: userCheckError } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email')
      .eq('id', moviUserId)
      .single();

    if (userCheckError || !targetUser) {
      throw new Error('Usuario no encontrado');
    }

    // Actualizar todos los items staging con este vendor_key
    const { data: updatedItems, error: updateError } = await supabase
      .from('commission_items_staging')
      .update({
        movi_user_id: moviUserId,
        match_method: 'manual',
        pending_assignment: false,
        assigned_at: new Date().toISOString(),
      })
      .eq('staging_session_id', stagingSessionId)
      .eq('vendor_key', vendorKey)
      .eq('pending_assignment', true)
      .select();

    if (updateError) {
      throw new Error(`Error al actualizar items: ${updateError.message}`);
    }

    console.log('[assign-vendor-staging] Updated', updatedItems?.length || 0, 'items');

    // Guardar mapping si se solicitó
    if (saveMapping && updatedItems && updatedItems.length > 0) {
      const firstItem = updatedItems[0];

      // Guardar email mapping si existe
      if (firstItem.vendor_email_norm) {
        await supabase
          .from('vendor_mappings')
          .upsert({
            source_type: 'email',
            source_value: firstItem.vendor_email_norm,
            movi_user_id: moviUserId,
            status: 'active',
          }, {
            onConflict: 'source_type,source_value',
          });

        console.log('[assign-vendor-staging] Saved email mapping:', firstItem.vendor_email_norm);
      }

      // Guardar name mapping como fallback
      if (firstItem.vendor_name_norm) {
        await supabase
          .from('vendor_mappings')
          .upsert({
            source_type: 'name',
            source_value: firstItem.vendor_name_norm,
            movi_user_id: moviUserId,
            status: 'active',
          }, {
            onConflict: 'source_type,source_value',
          });

        console.log('[assign-vendor-staging] Saved name mapping:', firstItem.vendor_name_norm);
      }
    }

    // Recalcular contadores de la sesión
    await supabase.rpc('recalculate_staging_session_counters', { session_id: stagingSessionId });

    return new Response(
      JSON.stringify({
        success: true,
        itemsUpdated: updatedItems?.length || 0,
        mappingSaved: saveMapping,
        assignedTo: {
          id: targetUser.id,
          nombre: targetUser.nombre_completo,
          email: targetUser.email,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[assign-vendor-staging] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
