import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Stats {
  total_polizas: number;
  total_prima_neta: number;
  total_prima_total: number;
  por_ramo: Record<string, { count: number; total: number }>;
  por_aseguradora: Record<string, { count: number; total: number }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No autorizado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('No autorizado');
    }

    const url = new URL(req.url);
    const view = url.searchParams.get('view') || 'vigentes';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const ramo = url.searchParams.get('ramo') || '';
    const aseguradora = url.searchParams.get('aseguradora') || '';

    console.log('[My-Polizas] Usuario:', user.id, 'Vista:', view);

    // Use the correct mapping table that actually has data
    const { data: mapping } = await supabase
      .from('sicas_mapeo_vendedor_usuario')
      .select('id_sicas_vendedor')
      .eq('movi_user_id', user.id)
      .maybeSingle();

    if (!mapping) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'no_mapping',
          message: 'No tienes un vendedor SICAS asignado. Contacta al administrador.',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const vendId = String(mapping.id_sicas_vendedor);
    console.log('[My-Polizas] Vendedor SICAS:', vendId);

    // Determine which table has data
    const { count: pvCount } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact', head: true })
      .eq('vend_id', vendId);

    const { count: sdCount } = await supabase
      .from('sicas_documents')
      .select('*', { count: 'exact', head: true })
      .eq('vend_id', vendId);

    const usePolizasVigentes = (pvCount || 0) >= (sdCount || 0);
    const tableName = usePolizasVigentes ? 'sicas_polizas_vigentes' : 'sicas_documents';
    console.log(`[My-Polizas] Tabla: ${tableName} (pv=${pvCount}, sd=${sdCount})`);

    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .eq('vend_id', vendId);

    // View-specific filters
    if (view === 'renovar') {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const future = futureDate.toISOString().split('T')[0];
      query = query.gte('vigencia_hasta', today).lte('vigencia_hasta', future);
    } else if (view === 'emitidas') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      query = query.gte('vigencia_desde', startOfMonth).lte('vigencia_desde', endOfMonth);
    }

    if (search) {
      if (usePolizasVigentes) {
        query = query.or(
          `contratante.ilike.%${search}%,asegurado.ilike.%${search}%,no_poliza.ilike.%${search}%`
        );
      } else {
        query = query.or(
          `cliente.ilike.%${search}%,poliza.ilike.%${search}%,id_docto.ilike.%${search}%`
        );
      }
    }

    if (ramo) {
      query = query.eq('ramo', ramo);
    }

    if (aseguradora) {
      const col = usePolizasVigentes ? 'aseguradora' : 'compania';
      query = query.eq(col, aseguradora);
    }

    query = query.order('vigencia_hasta', { ascending: view === 'renovar' });

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: polizas, error: polizasError, count } = await query;

    if (polizasError) {
      throw polizasError;
    }

    // Stats query (same filters minus pagination)
    let statsQuery = supabase
      .from(tableName)
      .select('*')
      .eq('vend_id', vendId);

    if (view === 'renovar') {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const future = futureDate.toISOString().split('T')[0];
      statsQuery = statsQuery.gte('vigencia_hasta', today).lte('vigencia_hasta', future);
    } else if (view === 'emitidas') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      statsQuery = statsQuery.gte('vigencia_desde', startOfMonth).lte('vigencia_desde', endOfMonth);
    }

    const { data: allPolizas } = await statsQuery;

    const primaTotalKey = usePolizasVigentes ? 'prima_total' : 'importe';

    const stats: Stats = {
      total_polizas: allPolizas?.length || 0,
      total_prima_neta: allPolizas?.reduce((sum, p) => sum + (p.prima_neta || 0), 0) || 0,
      total_prima_total: allPolizas?.reduce((sum, p) => sum + (p[primaTotalKey] || 0), 0) || 0,
      por_ramo: {},
      por_aseguradora: {},
    };

    const asegCol = usePolizasVigentes ? 'aseguradora' : 'compania';
    allPolizas?.forEach(p => {
      if (p.ramo) {
        if (!stats.por_ramo[p.ramo]) stats.por_ramo[p.ramo] = { count: 0, total: 0 };
        stats.por_ramo[p.ramo].count++;
        stats.por_ramo[p.ramo].total += p[primaTotalKey] || 0;
      }
      const aseg = p[asegCol];
      if (aseg) {
        if (!stats.por_aseguradora[aseg]) stats.por_aseguradora[aseg] = { count: 0, total: 0 };
        stats.por_aseguradora[aseg].count++;
        stats.por_aseguradora[aseg].total += p[primaTotalKey] || 0;
      }
    });

    // Renewal count widget
    const { count: renovacionesCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('vend_id', vendId)
      .gte('vigencia_hasta', new Date().toISOString().split('T')[0])
      .lte('vigencia_hasta', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    console.log(`[My-Polizas] Retornando ${polizas?.length || 0} de ${count || 0} polizas`);

    return new Response(
      JSON.stringify({
        success: true,
        polizas: polizas || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats,
        widgets: {
          renovaciones_proximas: renovacionesCount || 0,
        },
        metadata: {
          view,
          vend_id: mapping.id_sicas_vendedor,
          source_table: tableName,
          last_fetched_at: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[My-Polizas] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
