import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parsear parámetros
    const url = new URL(req.url);
    const vendNombre = url.searchParams.get('vendNombre');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const cacheKey = 'production_vendors_main';

    if (!vendNombre) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parámetro vendNombre es requerido',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[get-vendor-production-details] Obteniendo detalles para:', vendNombre);

    // Obtener detalles del cache
    const { data: cacheData, error } = await supabase
      .from('production_vendor_details_cache')
      .select('details_json, record_count')
      .eq('cache_key', cacheKey)
      .eq('vend_nombre', vendNombre)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!cacheData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se encontraron detalles para este vendedor. El cache puede estar desactualizado.',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const allRecords = cacheData.details_json || [];
    const totalRecords = allRecords.length;

    // Aplicar paginación
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedRecords = allRecords.slice(from, to);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        vend_nombre: vendNombre,
        records: paginatedRecords,
        pagination: {
          page,
          limit,
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
        },
        performance: {
          duration_ms: duration,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[get-vendor-production-details] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
