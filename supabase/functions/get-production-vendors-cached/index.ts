import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  mappingStatus?: 'all' | 'mapped' | 'unmapped';
  sortBy?: 'total' | 'name' | 'records';
  sortOrder?: 'asc' | 'desc';
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

    // Parsear parámetros de query
    const url = new URL(req.url);
    const params: PaginationParams = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '25'),
      search: url.searchParams.get('search') || undefined,
      mappingStatus: (url.searchParams.get('mappingStatus') as any) || 'all',
      sortBy: (url.searchParams.get('sortBy') as any) || 'total',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
    };

    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const cacheKey = 'production_vendors_main';

    console.log('[get-production-vendors-cached] Params:', params);
    console.log('[get-production-vendors-cached] Force refresh:', forceRefresh);

    // Verificar si el cache es válido
    let isCacheValid = false;
    if (!forceRefresh) {
      const { data: isValid } = await supabase.rpc('is_production_cache_valid', {
        p_cache_key: cacheKey
      });
      isCacheValid = isValid === true;
      console.log('[get-production-vendors-cached] Cache valid:', isCacheValid);
    }

    // Si no es válido, refrescar cache
    if (!isCacheValid) {
      console.log('[get-production-vendors-cached] Refrescando cache...');
      const refreshStartTime = Date.now();

      // Llamar a fetch-production-sheets
      const fetchUrl = `${supabaseUrl}/functions/v1/fetch-production-sheets`;
      const fetchResponse = await fetch(fetchUrl, {
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        }
      });

      if (!fetchResponse.ok) {
        throw new Error(`Error al obtener datos de Google Sheets: ${fetchResponse.status}`);
      }

      const fetchResult = await fetchResponse.json();
      if (!fetchResult.success || !fetchResult.records) {
        throw new Error('No se pudieron obtener registros de Google Sheets');
      }

      console.log('[get-production-vendors-cached] Registros obtenidos:', fetchResult.records.length);

      // Agrupar por vendedor
      const vendorMap = new Map<string, any>();

      for (const record of fetchResult.records) {
        const vendNombre = record.agente_nombre;
        if (!vendNombre) continue;

        if (!vendorMap.has(vendNombre)) {
          vendorMap.set(vendNombre, {
            vend_nombre: vendNombre,
            total_records: 0,
            total_importe_pesos: 0,
            total_prima_convenio: 0,
            total_prima_ponderada: 0,
            total_bono: 0,
            earliest_date: record.fecha,
            latest_date: record.fecha,
            unique_ramos: new Set<string>(),
            unique_aseguradoras: new Set<string>(),
            registros: [],
          });
        }

        const vendor = vendorMap.get(vendNombre)!;
        vendor.total_records++;
        vendor.total_importe_pesos += record.importe_pesos || 0;
        vendor.total_prima_convenio += record.prima_convenio || 0;
        vendor.total_prima_ponderada += record.prima_ponderada || 0;
        vendor.total_bono += record.bono || 0;
        vendor.unique_ramos.add(record.ramo_nombre);
        vendor.unique_aseguradoras.add(record.aseguradora_nombre);

        if (record.fecha < vendor.earliest_date) vendor.earliest_date = record.fecha;
        if (record.fecha > vendor.latest_date) vendor.latest_date = record.fecha;

        vendor.registros.push(record);
      }

      console.log('[get-production-vendors-cached] Vendedores agrupados:', vendorMap.size);

      // Normalizar nombres y buscar mapeos EN BATCH
      const vendorNames = Array.from(vendorMap.keys());
      const normalizedNames = vendorNames.map(name => normalizeVendorName(name));

      // Query 1: Buscar mapeos directos por nombre_completo
      const { data: directMatches } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, oficinas(nombre)')
        .in('nombre_completo', normalizedNames.filter(n => n !== null));

      // Query 2: Buscar mapeos en vendor_mappings
      const { data: vendorMappings } = await supabase
        .from('vendor_mappings')
        .select('source_value, movi_user_id, usuarios(id, nombre_completo, oficinas(nombre))')
        .eq('source_type', 'name')
        .in('source_value', normalizedNames.filter(n => n !== null))
        .eq('status', 'active');

      // Crear mapa de mapeos
      const mappingMap = new Map<string, any>();

      // Procesar directMatches
      if (directMatches) {
        for (const match of directMatches) {
          mappingMap.set(match.nombre_completo.toLowerCase(), {
            movi_user_id: match.id,
            movi_user_name: match.nombre_completo,
            oficina_nombre: (match.oficinas as any)?.nombre || null,
            match_method: 'direct_name',
          });
        }
      }

      // Procesar vendorMappings
      if (vendorMappings) {
        for (const mapping of vendorMappings) {
          const usuario = (mapping as any).usuarios;
          mappingMap.set(mapping.source_value, {
            movi_user_id: mapping.movi_user_id,
            movi_user_name: usuario?.nombre_completo || null,
            oficina_nombre: usuario?.oficinas?.nombre || null,
            match_method: 'mapping_name',
          });
        }
      }

      console.log('[get-production-vendors-cached] Mapeos encontrados:', mappingMap.size);

      // Invalidar cache anterior
      await supabase.rpc('invalidate_production_cache', { p_cache_key: cacheKey });

      // Guardar en cache
      const cacheRecords = [];
      const detailsRecords = [];

      for (const [vendNombre, vendor] of vendorMap) {
        const normalized = normalizeVendorName(vendNombre);
        const mapping = normalized ? mappingMap.get(normalized) : null;

        cacheRecords.push({
          cache_key: cacheKey,
          vend_nombre: vendNombre,
          vend_nombre_normalized: normalized,
          movi_user_id: mapping?.movi_user_id || null,
          movi_user_name: mapping?.movi_user_name || null,
          oficina_nombre: mapping?.oficina_nombre || null,
          match_method: mapping?.match_method || 'none',
          total_records: vendor.total_records,
          total_importe_pesos: vendor.total_importe_pesos,
          total_prima_convenio: vendor.total_prima_convenio,
          total_prima_ponderada: vendor.total_prima_ponderada,
          total_bono: vendor.total_bono,
          earliest_date: vendor.earliest_date,
          latest_date: vendor.latest_date,
          unique_ramos: Array.from(vendor.unique_ramos),
          unique_aseguradoras: Array.from(vendor.unique_aseguradoras),
        });

        // Guardar detalles por separado
        detailsRecords.push({
          cache_key: cacheKey,
          vend_nombre: vendNombre,
          details_json: vendor.registros,
          record_count: vendor.registros.length,
        });
      }

      // Insertar en batch
      console.log('[get-production-vendors-cached] Guardando', cacheRecords.length, 'vendedores en cache...');

      const { error: cacheError } = await supabase
        .from('production_vendor_cache')
        .insert(cacheRecords);

      if (cacheError) {
        console.error('[get-production-vendors-cached] Error al guardar cache:', cacheError);
        throw cacheError;
      }

      console.log('[get-production-vendors-cached] Guardando detalles en cache...');

      const { error: detailsError } = await supabase
        .from('production_vendor_details_cache')
        .insert(detailsRecords);

      if (detailsError) {
        console.error('[get-production-vendors-cached] Error al guardar detalles:', detailsError);
      }

      // Guardar metadata
      const refreshDuration = Date.now() - refreshStartTime;
      await supabase
        .from('production_cache_metadata')
        .upsert({
          cache_key: cacheKey,
          last_fetched_at: new Date().toISOString(),
          last_fetch_duration_ms: refreshDuration,
          total_records: fetchResult.records.length,
          total_vendors: vendorMap.size,
          ttl_minutes: 10,
        }, { onConflict: 'cache_key' });

      console.log('[get-production-vendors-cached] Cache actualizado en', refreshDuration, 'ms');
    }

    // Construir query con filtros
    let query = supabase
      .from('production_vendor_cache')
      .select('*', { count: 'exact' })
      .eq('cache_key', cacheKey);

    // Aplicar filtros
    if (params.search) {
      query = query.or(`vend_nombre.ilike.%${params.search}%,movi_user_name.ilike.%${params.search}%`);
    }

    if (params.mappingStatus === 'mapped') {
      query = query.not('movi_user_id', 'is', null);
    } else if (params.mappingStatus === 'unmapped') {
      query = query.is('movi_user_id', null);
    }

    // Ordenamiento
    if (params.sortBy === 'total') {
      query = query.order('total_importe_pesos', { ascending: params.sortOrder === 'asc' });
    } else if (params.sortBy === 'name') {
      query = query.order('vend_nombre', { ascending: params.sortOrder === 'asc' });
    } else if (params.sortBy === 'records') {
      query = query.order('total_records', { ascending: params.sortOrder === 'asc' });
    }

    // Paginación
    const from = (params.page - 1) * params.limit;
    const to = from + params.limit - 1;
    query = query.range(from, to);

    const { data: vendors, error, count } = await query;

    if (error) {
      throw error;
    }

    // Obtener metadata
    const { data: metadata } = await supabase.rpc('get_production_cache_metadata', {
      p_cache_key: cacheKey
    });

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        vendors: vendors || [],
        pagination: {
          page: params.page,
          limit: params.limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / params.limit),
        },
        metadata: metadata?.[0] || null,
        performance: {
          duration_ms: duration,
          cached: isCacheValid,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[get-production-vendors-cached] Error:', error);

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

// Función helper para normalizar nombres
function normalizeVendorName(name: string | null | undefined): string | null {
  if (!name || name.trim() === '') return null;

  let normalized = name.trim().toLowerCase();

  const accentMap: { [key: string]: string } = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ü': 'U', 'Ñ': 'N',
    'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
    'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
  };

  normalized = normalized
    .split('')
    .map((char) => accentMap[char] || char)
    .join('');

  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}
