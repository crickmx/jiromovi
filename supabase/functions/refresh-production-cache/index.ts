import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[refresh-production-cache] Starting cache refresh...');

    // 1. Intentar obtener el último batch exitoso
    const { data: latestBatch } = await supabase
      .from('production_import_batches')
      .select('id')
      .eq('status', 'success')
      .eq('visible_to_agents', true)
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // 2. Obtener vendedores únicos (del último batch o de todos los registros)
    let vendorsQuery = supabase
      .from('production_records')
      .select('agente_nombre')
      .not('agente_nombre', 'is', null);

    // Si hay batch, filtrar por él. Si no, tomar todos los registros
    if (latestBatch) {
      console.log('[refresh-production-cache] Using batch ID:', latestBatch.id);
      vendorsQuery = vendorsQuery.eq('batch_id', latestBatch.id);
    } else {
      console.log('[refresh-production-cache] No batches found, using all production records');
    }

    const { data: vendors, error: vendorsError } = await vendorsQuery;

    if (vendorsError) {
      throw new Error(`Error obteniendo vendedores: ${vendorsError.message}`);
    }

    // Extraer nombres únicos
    const uniqueVendors = Array.from(new Set(
      (vendors || []).map((v: any) => v.agente_nombre).filter(Boolean)
    ));

    console.log('[refresh-production-cache] Found', uniqueVendors.length, 'unique vendors');

    // 3. Contar registros por vendedor
    const vendorCounts = new Map<string, number>();
    for (const vendor of vendors || []) {
      if (vendor.agente_nombre) {
        vendorCounts.set(
          vendor.agente_nombre,
          (vendorCounts.get(vendor.agente_nombre) || 0) + 1
        );
      }
    }

    // 4. Actualizar cache para cada vendedor
    let syncedCount = 0;
    let errorCount = 0;
    const syncedAt = new Date().toISOString();

    for (const vendorNombre of uniqueVendors) {
      try {
        // Llamar a la función que actualiza el cache
        const { error: refreshError } = await supabase.rpc('refresh_vendor_mapping_cache', {
          p_vendor_nombre: vendorNombre
        });

        if (refreshError) {
          console.error(`[refresh-production-cache] Error refreshing ${vendorNombre}:`, refreshError);
          errorCount++;
          continue;
        }

        // Actualizar el conteo
        const recordCount = vendorCounts.get(vendorNombre) || 0;
        const { error: updateError } = await supabase
          .from('production_vendors_cache')
          .update({
            total_records: recordCount,
            synced_from_sheets_at: syncedAt,
            updated_at: syncedAt
          })
          .eq('vendor_nombre', vendorNombre);

        if (updateError) {
          console.error(`[refresh-production-cache] Error updating count for ${vendorNombre}:`, updateError);
          errorCount++;
        } else {
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`[refresh-production-cache] Exception for ${vendorNombre}:`, err);
        errorCount++;
      }
    }

    console.log('[refresh-production-cache] Synced', syncedCount, 'vendors. Errors:', errorCount);

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        error_count: errorCount,
        total_vendors: uniqueVendors.length,
        batch_id: latestBatch?.id || null,
        synced_at: syncedAt
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[refresh-production-cache] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido al refrescar el cache'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});