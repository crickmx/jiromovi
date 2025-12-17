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

    // Obtener usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-my-production] Usuario autenticado:', user.id);

    // Parsear parámetros de filtro
    const url = new URL(req.url);
    const fechaDesde = url.searchParams.get('fechaDesde');
    const fechaHasta = url.searchParams.get('fechaHasta');
    const ramos = url.searchParams.get('ramos')?.split(',').filter(Boolean) || [];
    const aseguradoras = url.searchParams.get('aseguradoras')?.split(',').filter(Boolean) || [];
    const clienteSearch = url.searchParams.get('clienteSearch') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Obtener mapeo del usuario autenticado
    const { data: vendorMapping, error: mappingError } = await supabase
      .from('vendor_mappings')
      .select('source_value, source_raw_examples')
      .eq('movi_user_id', user.id)
      .eq('source_type', 'name')
      .eq('status', 'active')
      .maybeSingle();

    if (mappingError) {
      throw mappingError;
    }

    if (!vendorMapping) {
      return new Response(
        JSON.stringify({
          success: true,
          vendor_nombre: null,
          records: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          kpis: {
            total_produccion: 0,
            total_documentos: 0,
            clientes_unicos: 0,
            aseguradora_top: null,
            ramo_top: null,
          },
          message: 'Aún no tienes un vendedor asignado. Contacta a administración.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const vendorName = vendorMapping.source_raw_examples?.[0]?.name || vendorMapping.source_value;
    console.log('[get-my-production] Vendedor encontrado:', vendorName);

    // Obtener detalles del cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('production_vendor_details_cache')
      .select('details_json, record_count')
      .eq('cache_key', 'production_vendors_main')
      .eq('vend_nombre', vendorName)
      .maybeSingle();

    if (cacheError) {
      throw cacheError;
    }

    if (!cacheData) {
      return new Response(
        JSON.stringify({
          success: true,
          vendor_nombre: vendorName,
          records: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          kpis: {
            total_produccion: 0,
            total_documentos: 0,
            clientes_unicos: 0,
            aseguradora_top: null,
            ramo_top: null,
          },
          message: 'No hay datos de producción disponibles para tu vendedor.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let allRecords = cacheData.details_json || [];

    // Aplicar filtros
    if (fechaDesde) {
      const desde = new Date(fechaDesde);
      allRecords = allRecords.filter((r: any) => new Date(r.fecha) >= desde);
    }

    if (fechaHasta) {
      const hasta = new Date(fechaHasta);
      allRecords = allRecords.filter((r: any) => new Date(r.fecha) <= hasta);
    }

    if (ramos.length > 0) {
      allRecords = allRecords.filter((r: any) => ramos.includes(r.ramo_nombre));
    }

    if (aseguradoras.length > 0) {
      allRecords = allRecords.filter((r: any) => aseguradoras.includes(r.aseguradora_nombre));
    }

    if (clienteSearch) {
      const searchLower = clienteSearch.toLowerCase();
      allRecords = allRecords.filter((r: any) =>
        r.desp_nombre_raw?.toLowerCase().includes(searchLower) ||
        r.gerencia_nombre_raw?.toLowerCase().includes(searchLower)
      );
    }

    const totalFiltered = allRecords.length;

    // Calcular KPIs
    const totalProduccion = allRecords.reduce((sum: number, r: any) =>
      sum + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio), 0
    );

    const clientesUnicos = new Set(allRecords.map((r: any) => r.desp_nombre_raw)).size;

    // Top aseguradora
    const aseguradoraSums = new Map<string, number>();
    allRecords.forEach((r: any) => {
      const current = aseguradoraSums.get(r.aseguradora_nombre) || 0;
      aseguradoraSums.set(r.aseguradora_nombre, current + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio));
    });
    const aseguradoraTop = Array.from(aseguradoraSums.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Top ramo
    const ramoSums = new Map<string, number>();
    allRecords.forEach((r: any) => {
      const current = ramoSums.get(r.ramo_nombre) || 0;
      ramoSums.set(r.ramo_nombre, current + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio));
    });
    const ramoTop = Array.from(ramoSums.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Aplicar paginación
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedRecords = allRecords.slice(from, to);

    const duration = Date.now() - startTime;

    // Calcular datos para gráficas
    const produccionPorRamo = Array.from(ramoSums.entries())
      .map(([ramo, total]) => ({ ramo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const produccionPorAseguradora = Array.from(aseguradoraSums.entries())
      .map(([aseguradora, total]) => ({ aseguradora, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Top 10 clientes
    const clienteSums = new Map<string, { total: number; documentos: number }>();
    allRecords.forEach((r: any) => {
      const cliente = r.desp_nombre_raw || 'Sin nombre';
      const current = clienteSums.get(cliente) || { total: 0, documentos: 0 };
      clienteSums.set(cliente, {
        total: current.total + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio),
        documentos: current.documentos + 1,
      });
    });

    const top10Clientes = Array.from(clienteSums.entries())
      .map(([cliente, data]) => ({ cliente, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Evolución temporal (por mes)
    const mesSums = new Map<string, number>();
    allRecords.forEach((r: any) => {
      const mes = r.periodo_mes || new Date(r.fecha).toISOString().substring(0, 7);
      const current = mesSums.get(mes) || 0;
      mesSums.set(mes, current + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio));
    });

    const evolucionTemporal = Array.from(mesSums.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return new Response(
      JSON.stringify({
        success: true,
        vendor_nombre: vendorName,
        records: paginatedRecords,
        pagination: {
          page,
          limit,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limit),
        },
        kpis: {
          total_produccion: totalProduccion,
          total_documentos: totalFiltered,
          clientes_unicos: clientesUnicos,
          aseguradora_top: aseguradoraTop,
          ramo_top: ramoTop,
        },
        charts: {
          produccion_por_ramo: produccionPorRamo,
          produccion_por_aseguradora: produccionPorAseguradora,
          evolucion_temporal: evolucionTemporal,
          top_10_clientes: top10Clientes,
        },
        performance: {
          duration_ms: duration,
          total_records_before_filter: cacheData.record_count,
          total_records_after_filter: totalFiltered,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[get-my-production] Error:', error);

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