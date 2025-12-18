import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const records: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: any = {};
    
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    records.push(record);
  }
  
  return records;
}

function parseMoneyValue(value: string): number {
  if (!value) return 0;
  const str = value.toString().replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parsePercentValue(value: string): number | null {
  if (!value) return null;
  const str = value.toString().replace(/%/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

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

function parseDateDMY(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;

  const fecha = new Date(year, month - 1, day);

  if (isNaN(fecha.getTime())) return null;

  return fecha;
}

function transformRecord(row: any): any | null {
  try {
    const fechaValue = row['FechaSimp'] || row['Fecha'] || row['fechasimp'] || row['fecha'];
    if (!fechaValue) return null;

    let fecha: Date | null = null;

    if (typeof fechaValue === 'string') {
      fecha = parseDateDMY(fechaValue);

      if (!fecha) {
        fecha = new Date(fechaValue);
      }
    } else if (fechaValue instanceof Date) {
      fecha = fechaValue;
    } else if (typeof fechaValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      fecha = new Date(excelEpoch.getTime() + fechaValue * 86400000);
    }

    if (!fecha || isNaN(fecha.getTime())) return null;

    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const periodoMes = `${anio}-${mes.toString().padStart(2, '0')}`;
    const periodoAnio = anio;

    // Usar ÚNICAMENTE NombreCompleto para el nombre del cliente
    const clienteNombre = (row['NombreCompleto'] || row['nombrecompleto'] || row['nombre completo'] || '').toString().trim();
    const gerenciaNombre = (row['GerenciaNombre'] || row['gerencianombre'] || '').toString().trim();
    const regionNombre = (row['Dirección Regional'] || row['direccion regional'] || row['region'] || '').toString().trim();

    if (!clienteNombre) return null;

    const importePesos = parseMoneyValue(row['IMPORTE PESOS'] || row['importe pesos'] || row['importe'] || '0');
    const primaConvenio = parseMoneyValue(row['Prima de convenio'] || row['prima de convenio'] || row['prima convenio'] || '0');
    const primaPonderada = parseMoneyValue(row['Prima Ponderada'] || row['prima ponderada'] || '0');
    const bono = parseMoneyValue(row['Bono'] || row['bono'] || '0');
    const porcentajeBono = parsePercentValue(row['% BONO'] || row['porcentaje bono'] || row['porciento bono'] || '');

    const convenioStr = (row['CONVENIO'] || row['convenio'] || '').toString().toLowerCase().trim();
    const convenioFlag = convenioStr === 'si' || convenioStr === 'sí' || convenioStr === 'yes' || primaConvenio > 0;

    const fechaStr = fecha.toISOString().split('T')[0];
    const agenteNombre = (row['VendNombre'] || row['vendnombre'] || row['vendedor'] || '').toString().trim();
    const aseguradoraNombre = (row['Nombre Compañía'] || row['nombre compañia'] || row['nombre compania'] || row['compañia'] || '').toString().trim();
    const ramoNombre = (row['Sub Ramo'] || row['sub ramo'] || row['subramo'] || row['RamosNombre'] || row['ramos'] || '').toString().trim();
    const concepto = (row['Concepto'] || row['concepto'] || '').toString().trim() || null;

    return {
      fecha: fechaStr,
      anio,
      mes,
      dia,
      periodo_mes: periodoMes,
      periodo_anio: periodoAnio,
      desp_nombre_raw: clienteNombre,
      gerencia_nombre_raw: gerenciaNombre || clienteNombre,
      region_raw: regionNombre || null,
      agente_nombre: agenteNombre,
      aseguradora_nombre: aseguradoraNombre,
      ramo_nombre: ramoNombre,
      subramo_nombre: null,
      concepto: concepto,
      importe_pesos: importePesos,
      prima_convenio: primaConvenio,
      prima_ponderada: primaPonderada,
      bono: bono,
      convenio_flag: convenioFlag,
      porcentaje_bono: porcentajeBono
    };
  } catch (error) {
    console.error('Error transforming record:', error);
    return null;
  }
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
    const clienteSearch = url.searchParams.get('clienteSearch') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Buscar el vendedor asociado al usuario
    // ESTRATEGIA DE BÚSQUEDA CON FALLBACKS:
    // 1. Buscar en production_vendors_cache (más rápido)
    // 2. Buscar en vendor_mappings directamente
    // 3. Buscar por coincidencia de nombre en usuarios

    let vendorName: string | null = null;

    console.log('[get-my-production] Buscando vendedor para usuario:', user.id);

    // FALLBACK 1: Buscar en cache
    const { data: vendorCache, error: vendorError } = await supabase
      .from('production_vendors_cache')
      .select('vendor_nombre')
      .eq('movi_user_id', user.id)
      .maybeSingle();

    if (vendorError) {
      console.error('[get-my-production] Error buscando en cache:', vendorError);
    }

    if (vendorCache?.vendor_nombre) {
      vendorName = vendorCache.vendor_nombre;
      console.log('[get-my-production] Vendedor encontrado en cache:', vendorName);
    }

    // FALLBACK 2: Buscar en vendor_mappings
    if (!vendorName) {
      console.log('[get-my-production] No encontrado en cache, buscando en vendor_mappings...');

      // Primero obtener el nombre del usuario
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('nombre_completo')
        .eq('id', user.id)
        .maybeSingle();

      if (usuarioData?.nombre_completo) {
        const nombreNormalizado = normalizeVendorName(usuarioData.nombre_completo);
        console.log('[get-my-production] Nombre usuario normalizado:', nombreNormalizado);

        // Buscar mapping
        const { data: mapping } = await supabase
          .from('vendor_mappings')
          .select('source_value')
          .eq('movi_user_id', user.id)
          .eq('source_type', 'name')
          .eq('status', 'active')
          .maybeSingle();

        if (mapping?.source_value) {
          // Buscar en production_records el nombre original del vendedor
          const { data: productionRecord } = await supabase
            .from('production_records')
            .select('agente_nombre')
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
          console.log('[get-my-production] No encontrado en mappings, buscando por nombre directo...');

          const { data: directMatch } = await supabase
            .from('production_records')
            .select('agente_nombre')
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

    // Si después de todos los fallbacks no se encontró vendedor
    if (!vendorName) {
      console.log('[get-my-production] No se encontró vendedor para el usuario');
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
          charts: {
            produccion_por_ramo: [],
            produccion_por_aseguradora: [],
            evolucion_temporal: [],
            top_10_clientes: [],
          },
          message: 'Aún no tienes un vendedor asignado. Contacta a administración para que asocien tu nombre del Excel con tu usuario.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const vendorNameNormalized = normalizeVendorName(vendorName);
    console.log('[get-my-production] Vendedor encontrado:', vendorName, '(normalizado:', vendorNameNormalized + ')');

    // NUEVO: Consultar directamente desde production_records en lugar de Google Sheets
    console.log('[get-my-production] Querying production_records from database...');

    // Construir query con filtros
    let query = supabase
      .from('production_records')
      .select('*', { count: 'exact' });

    // Filtrar por nombre de vendedor (normalizado)
    // Usamos ilike con wildcards para match flexible
    query = query.ilike('agente_nombre', `%${vendorName}%`);

    // Aplicar filtros de fecha
    if (fechaDesde) {
      query = query.gte('fecha', fechaDesde);
    }

    if (fechaHasta) {
      query = query.lte('fecha', fechaHasta);
    }

    // Filtrar por ramos
    if (ramos.length > 0) {
      query = query.in('ramo_nombre', ramos);
    }

    // Filtrar por aseguradoras
    if (aseguradoras.length > 0) {
      query = query.in('aseguradora_nombre', aseguradoras);
    }

    // Búsqueda de cliente (incluir nombre_cliente en la búsqueda)
    if (clienteSearch) {
      query = query.or(`desp_nombre_raw.ilike.%${clienteSearch}%,nombre_cliente.ilike.%${clienteSearch}%,gerencia_nombre_raw.ilike.%${clienteSearch}%`);
    }

    // Ordenar por fecha descendente
    query = query.order('fecha', { ascending: false });

    // Ejecutar query para count y KPIs (sin paginación)
    const { data: allRecordsForKPIs, error: recordsError, count: totalFiltered } = await query;

    if (recordsError) {
      throw new Error(`Error consultando production_records: ${recordsError.message}`);
    }

    console.log('[get-my-production] Found', totalFiltered, 'records for vendor:', vendorName);

    // Convertir valores numéricos de string a number
    const allRecords = (allRecordsForKPIs || []).map((r: any) => ({
      ...r,
      importe_pesos: parseFloat(r.importe_pesos) || 0,
      prima_convenio: parseFloat(r.prima_convenio) || 0,
      prima_ponderada: parseFloat(r.prima_ponderada) || 0,
      bono: parseFloat(r.bono) || 0,
      porcentaje_bono: r.porcentaje_bono ? parseFloat(r.porcentaje_bono) : null,
    }));

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
          data_source: 'production_records_db',
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
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});