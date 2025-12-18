import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function normalizeVendorName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remover acentos
  normalized = normalized
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n');

  // Normalizar espacios
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

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
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // 1. OBTENER ÚLTIMO BATCH EXITOSO
    console.log('[get-my-production] Fetching latest successful batch...');

    const { data: latestBatch, error: batchError } = await supabase
      .from('production_import_batches')
      .select('id, finished_at, rows_inserted, status')
      .eq('status', 'success')
      .eq('visible_to_agents', true)
      .order('finished_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (batchError) {
      console.error('[get-my-production] Error fetching batch:', batchError);
    }

    // Si no hay batch exitoso, retornar mensaje informativo
    if (!latestBatch) {
      console.log('[get-my-production] No successful batch found');
      return new Response(
        JSON.stringify({
          success: true,
          vendor_nombre: null,
          records: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          kpis: {
            total_produccion: 0,
            total_documentos: 0,
            aseguradora_top: null,
            ramo_top: null,
          },
          charts: {
            produccion_por_ramo: [],
            produccion_por_aseguradora: [],
            evolucion_temporal: [],
          },
          fecha_actualizacion: null,
          batch_info: null,
          message: 'Aún no hay datos de producción disponibles. Por favor, contacta al administrador para sincronizar los datos.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[get-my-production] Latest batch found:', latestBatch.id, 'finished at:', latestBatch.finished_at);

    // 2. BUSCAR VENDEDOR ASOCIADO AL USUARIO
    let vendorName: string | null = null;

    // FALLBACK 1: Buscar en cache
    const { data: vendorCache } = await supabase
      .from('production_vendors_cache')
      .select('vendor_nombre')
      .eq('movi_user_id', user.id)
      .maybeSingle();

    if (vendorCache?.vendor_nombre) {
      vendorName = vendorCache.vendor_nombre;
      console.log('[get-my-production] Vendedor encontrado en cache:', vendorName);
    }

    // FALLBACK 2: Buscar en vendor_mappings
    if (!vendorName) {
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('nombre_completo')
        .eq('id', user.id)
        .maybeSingle();

      if (usuarioData?.nombre_completo) {
        const { data: mapping } = await supabase
          .from('vendor_mappings')
          .select('source_value')
          .eq('movi_user_id', user.id)
          .eq('source_type', 'name')
          .eq('status', 'active')
          .maybeSingle();

        if (mapping?.source_value) {
          const { data: productionRecord } = await supabase
            .from('production_records')
            .select('agente_nombre')
            .eq('batch_id', latestBatch.id)
            .ilike('agente_nombre', `%${mapping.source_value}%`)
            .limit(1)
            .maybeSingle();

          if (productionRecord?.agente_nombre) {
            vendorName = productionRecord.agente_nombre;
            console.log('[get-my-production] Vendedor encontrado via mapping:', vendorName);
          }
        }

        // FALLBACK 3: Buscar por coincidencia directa de nombre
        if (!vendorName) {
          const { data: directMatch } = await supabase
            .from('production_records')
            .select('agente_nombre')
            .eq('batch_id', latestBatch.id)
            .ilike('agente_nombre', `%${usuarioData.nombre_completo}%`)
            .limit(1)
            .maybeSingle();

          if (directMatch?.agente_nombre) {
            vendorName = directMatch.agente_nombre;
            console.log('[get-my-production] Vendedor encontrado por nombre directo:', vendorName);
          }
        }
      }
    }

    // Si no se encontró vendedor, retornar mensaje específico
    if (!vendorName) {
      console.log('[get-my-production] No vendor found for user');
      return new Response(
        JSON.stringify({
          success: true,
          vendor_nombre: null,
          records: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          kpis: {
            total_produccion: 0,
            total_documentos: 0,
            aseguradora_top: null,
            ramo_top: null,
          },
          charts: {
            produccion_por_ramo: [],
            produccion_por_aseguradora: [],
            evolucion_temporal: [],
          },
          fecha_actualizacion: latestBatch.finished_at,
          batch_info: {
            batch_id: latestBatch.id,
            finished_at: latestBatch.finished_at,
            total_records: latestBatch.rows_inserted,
          },
          message: 'Tu producción está pendiente de asignación. Contacta al administrador para asociar tu usuario con un vendedor.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[get-my-production] Vendedor encontrado:', vendorName);

    // 3. CONSULTAR REGISTROS DEL BATCH FILTRADOS POR VENDEDOR
    let query = supabase
      .from('production_records')
      .select('*', { count: 'exact' });

    // CRÍTICO: Filtrar solo registros del último batch exitoso
    query = query.eq('batch_id', latestBatch.id);

    // Filtrar por nombre de vendedor
    query = query.ilike('agente_nombre', `%${vendorName}%`);

    // Aplicar filtros adicionales
    if (fechaDesde) {
      query = query.gte('fecha', fechaDesde);
    }

    if (fechaHasta) {
      query = query.lte('fecha', fechaHasta);
    }

    if (ramos.length > 0) {
      query = query.in('ramo_nombre', ramos);
    }

    if (aseguradoras.length > 0) {
      query = query.in('aseguradora_nombre', aseguradoras);
    }

    // Ordenar por fecha descendente
    query = query.order('fecha', { ascending: false });

    // Ejecutar query
    const { data: allRecordsForKPIs, error: recordsError, count: totalFiltered } = await query;

    if (recordsError) {
      console.error('[get-my-production] Error querying records:', recordsError);
      throw new Error(`Error consultando registros: ${recordsError.message}`);
    }

    console.log('[get-my-production] Found', totalFiltered, 'records for vendor:', vendorName);

    // Convertir valores numéricos
    const allRecords = (allRecordsForKPIs || []).map((r: any) => ({
      ...r,
      importe_pesos: parseFloat(r.importe_pesos) || 0,
      prima_convenio: parseFloat(r.prima_convenio) || 0,
      prima_ponderada: parseFloat(r.prima_ponderada) || 0,
      bono: parseFloat(r.bono) || 0,
      porcentaje_bono: r.porcentaje_bono ? parseFloat(r.porcentaje_bono) : null,
    }));

    // 4. CALCULAR KPIs
    const totalProduccion = allRecords.reduce((sum: number, r: any) =>
      sum + (r.importe_pesos > 0 ? r.importe_pesos : r.prima_convenio), 0
    );

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

    // 5. APLICAR PAGINACIÓN
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedRecords = allRecords.slice(from, to);

    const duration = Date.now() - startTime;

    // 6. CALCULAR DATOS PARA GRÁFICAS
    const produccionPorRamo = Array.from(ramoSums.entries())
      .map(([ramo, total]) => ({ ramo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const produccionPorAseguradora = Array.from(aseguradoraSums.entries())
      .map(([aseguradora, total]) => ({ aseguradora, total }))
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
          aseguradora_top: aseguradoraTop,
          ramo_top: ramoTop,
        },
        charts: {
          produccion_por_ramo: produccionPorRamo,
          produccion_por_aseguradora: produccionPorAseguradora,
          evolucion_temporal: evolucionTemporal,
        },
        fecha_actualizacion: latestBatch.finished_at,
        batch_info: {
          batch_id: latestBatch.id,
          finished_at: latestBatch.finished_at,
          total_records: latestBatch.rows_inserted,
        },
        performance: {
          duration_ms: duration,
          data_source: 'production_records_db_batch',
          total_records_found: totalFiltered || 0,
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
        error_type: 'internal_error',
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
