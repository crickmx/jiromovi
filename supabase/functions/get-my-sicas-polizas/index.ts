import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PolizaVigente {
  id: string;
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  contratante: string | null;
  asegurado: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number | null;
  prima_total: number | null;
  synced_at: string;
}

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
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No autorizado');
    }

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('No autorizado');
    }

    // Obtener parámetros de query
    const url = new URL(req.url);
    const view = url.searchParams.get('view') || 'vigentes'; // vigentes, renovar, emitidas
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const ramo = url.searchParams.get('ramo') || '';
    const aseguradora = url.searchParams.get('aseguradora') || '';

    console.log('[My-Polizas] Usuario:', user.id);
    console.log('[My-Polizas] Vista:', view, 'Página:', page);

    // Verificar mapeo del usuario
    const { data: mapping } = await supabase
      .from('sicas_mapeo_vendedor_usuario')
      .select('id_sicas_vendedor')
      .eq('movi_user_id', user.id)
      .single();

    if (!mapping) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'no_mapping',
          message: 'No tienes un vendedor SICAS asignado. Contacta al administrador.',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('[My-Polizas] Vendedor SICAS:', mapping.id_sicas_vendedor);

    // Construir query base
    let query = supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact' })
      .eq('vend_id', mapping.id_sicas_vendedor.toString());

    // Aplicar filtros según la vista
    if (view === 'renovar') {
      // Pólizas por renovar (próximos 60 días)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const future = futureDate.toISOString().split('T')[0];

      query = query
        .gte('vigencia_hasta', today)
        .lte('vigencia_hasta', future);
    } else if (view === 'emitidas') {
      // Pólizas emitidas en el mes actual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      query = query
        .gte('vigencia_desde', startOfMonth)
        .lte('vigencia_desde', endOfMonth);
    }

    // Aplicar filtros adicionales
    if (search) {
      query = query.or(
        `contratante.ilike.%${search}%,asegurado.ilike.%${search}%,no_poliza.ilike.%${search}%`
      );
    }

    if (ramo) {
      query = query.eq('ramo', ramo);
    }

    if (aseguradora) {
      query = query.eq('aseguradora', aseguradora);
    }

    // Ordenar por vigencia
    query = query.order('vigencia_hasta', { ascending: view === 'renovar' ? true : false });

    // Paginación
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Ejecutar query
    const { data: polizas, error: polizasError, count } = await query;

    if (polizasError) {
      throw polizasError;
    }

    // Calcular estadísticas
    const statsQuery = supabase
      .from('sicas_polizas_vigentes')
      .select('*')
      .eq('vend_id', mapping.id_sicas_vendedor.toString());

    // Aplicar los mismos filtros de vista
    if (view === 'renovar') {
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const future = futureDate.toISOString().split('T')[0];
      statsQuery.gte('vigencia_hasta', today).lte('vigencia_hasta', future);
    } else if (view === 'emitidas') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      statsQuery.gte('vigencia_desde', startOfMonth).lte('vigencia_desde', endOfMonth);
    }

    const { data: allPolizas } = await statsQuery;

    const stats: Stats = {
      total_polizas: allPolizas?.length || 0,
      total_prima_neta: allPolizas?.reduce((sum, p) => sum + (p.prima_neta || 0), 0) || 0,
      total_prima_total: allPolizas?.reduce((sum, p) => sum + (p.prima_total || 0), 0) || 0,
      por_ramo: {},
      por_aseguradora: {},
    };

    // Agrupar por ramo y aseguradora
    allPolizas?.forEach(p => {
      if (p.ramo) {
        if (!stats.por_ramo[p.ramo]) {
          stats.por_ramo[p.ramo] = { count: 0, total: 0 };
        }
        stats.por_ramo[p.ramo].count++;
        stats.por_ramo[p.ramo].total += p.prima_total || 0;
      }

      if (p.aseguradora) {
        if (!stats.por_aseguradora[p.aseguradora]) {
          stats.por_aseguradora[p.aseguradora] = { count: 0, total: 0 };
        }
        stats.por_aseguradora[p.aseguradora].count++;
        stats.por_aseguradora[p.aseguradora].total += p.prima_total || 0;
      }
    });

    // Calcular pólizas por renovar (para widget)
    const { count: renovacionesCount } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact', head: true })
      .eq('vend_id', mapping.id_sicas_vendedor.toString())
      .gte('vigencia_hasta', new Date().toISOString().split('T')[0])
      .lte('vigencia_hasta', new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    console.log(`[My-Polizas] Retornando ${polizas?.length || 0} de ${count || 0} pólizas`);

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
          last_fetched_at: new Date().toISOString(),
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
