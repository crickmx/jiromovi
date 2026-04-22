import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PolizasListRequest {
  filters?: {
    searchText?: string;
    estatus?: 'vigente' | 'no_vigente' | 'todas';
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo_fecha?: 'vigencia' | 'captura' | 'emision';
    oficina_id?: string;
    vendedor_id?: string;
    vendedor_nombre?: string;
    aseguradora?: string;
    ramo?: string;
    subramo?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  };
  page?: number;
  items_per_page?: number;
  force_refresh?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Polizas List] Iniciando consulta de polizas');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('[Polizas List] Usuario autenticado:', user.id);

    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuarios')
      .select(`
        id,
        rol,
        oficina_id,
        oficinas(nombre)
      `)
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuarioData) {
      throw new Error('Usuario no encontrado en la base de datos');
    }

    console.log('[Polizas List] Rol del usuario:', usuarioData.rol);

    // Load the user's SICAS vendor mapping from the correct table
    const { data: vendorMapping } = await supabase
      .from('sicas_mapeo_vendedor_usuario')
      .select('id_sicas_vendedor')
      .eq('movi_user_id', user.id)
      .maybeSingle();

    console.log('[Polizas List] Mapeo SICAS vendedor:', vendorMapping
      ? `vend_id=${vendorMapping.id_sicas_vendedor}`
      : 'no encontrado');

    const requestBody: PolizasListRequest = await req.json();
    const filters = requestBody.filters || {};
    const page = requestBody.page || 1;
    const itemsPerPage = Math.min(requestBody.items_per_page || 100, 500);

    console.log('[Polizas List] Filtros recibidos:', JSON.stringify(filters));

    // Build query – try sicas_polizas_vigentes first (populated by sync),
    // fall back to sicas_documents
    let tableName = 'sicas_polizas_vigentes';
    let usePolizasVigentes = true;

    // Check which table has data
    const { count: pvCount } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact', head: true });

    const { count: sdCount } = await supabase
      .from('sicas_documents')
      .select('*', { count: 'exact', head: true });

    if ((pvCount || 0) === 0 && (sdCount || 0) > 0) {
      tableName = 'sicas_documents';
      usePolizasVigentes = false;
    }

    console.log(`[Polizas List] Usando tabla: ${tableName} (pv=${pvCount}, sd=${sdCount})`);

    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    // Role-based access control with correct capitalized role names
    const rol = usuarioData.rol;

    if (rol === 'Administrador') {
      console.log('[Polizas List] Administrador: sin filtros de permisos');
    } else if (rol === 'Gerente' || rol === 'Empleado' || rol === 'Ejecutivo') {
      console.log('[Polizas List] Gerente/Empleado/Ejecutivo: filtrar por oficina');
      if (usuarioData.oficina_id) {
        query = query.eq('oficina_id', usuarioData.oficina_id);
      } else {
        query = query.eq('oficina_id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (rol === 'Agente') {
      console.log('[Polizas List] Agente: filtrar por vend_id del mapeo');
      if (vendorMapping) {
        query = query.eq('vend_id', String(vendorMapping.id_sicas_vendedor));
      } else {
        query = query.eq('usuario_id', user.id);
      }
    } else {
      console.warn('[Polizas List] Rol desconocido:', rol);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rol de usuario no valido para consultar polizas',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Search filter
    if (filters.searchText) {
      const search = `%${filters.searchText}%`;
      if (usePolizasVigentes) {
        query = query.or(`no_poliza.ilike.${search},contratante.ilike.${search},asegurado.ilike.${search},aseguradora.ilike.${search}`);
      } else {
        query = query.or(`poliza.ilike.${search},cliente.ilike.${search},id_docto.ilike.${search},compania.ilike.${search}`);
      }
    }

    // Status filter
    if (filters.estatus === 'vigente') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('vigencia_hasta', today);
    } else if (filters.estatus === 'no_vigente') {
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('vigencia_hasta', today);
    }

    // Date range filter
    if (filters.fecha_desde && filters.fecha_hasta) {
      const fieldMap: Record<string, string> = {
        vigencia: 'vigencia_desde',
        captura: usePolizasVigentes ? 'created_at' : 'fecha_captura',
        emision: usePolizasVigentes ? 'vigencia_desde' : 'fecha_emision',
      };
      const field = fieldMap[filters.tipo_fecha || 'vigencia'] || 'vigencia_desde';
      query = query
        .gte(field, filters.fecha_desde)
        .lte(field, filters.fecha_hasta);
    }

    // Office filter (admin only)
    if (filters.oficina_id && rol === 'Administrador') {
      query = query.eq('oficina_id', filters.oficina_id);
    }

    // Vendor filter by MOVI user ID – translate to SICAS vend_id
    if (filters.vendedor_id) {
      const { data: targetMapping } = await supabase
        .from('sicas_mapeo_vendedor_usuario')
        .select('id_sicas_vendedor')
        .eq('movi_user_id', filters.vendedor_id)
        .maybeSingle();

      if (targetMapping) {
        query = query.eq('vend_id', String(targetMapping.id_sicas_vendedor));
      } else {
        query = query.eq('usuario_id', filters.vendedor_id);
      }
    }

    // Vendor name filter
    if (filters.vendedor_nombre) {
      query = query.ilike('vend_nombre', `%${filters.vendedor_nombre}%`);
    }

    // Insurer filter
    if (filters.aseguradora) {
      const col = usePolizasVigentes ? 'aseguradora' : 'compania';
      query = query.ilike(col, `%${filters.aseguradora}%`);
    }

    // Ramo filter
    if (filters.ramo) {
      query = query.ilike('ramo', `%${filters.ramo}%`);
    }

    // Subramo filter
    if (filters.subramo) {
      query = query.ilike('subramo', `%${filters.subramo}%`);
    }

    // Sorting
    const sortBy = filters.sort_by || (usePolizasVigentes ? 'synced_at' : 'synced_at');
    const sortOrder = filters.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (page - 1) * itemsPerPage;
    query = query.range(offset, offset + itemsPerPage - 1);

    const { data: polizas, error: polizasError, count } = await query;

    if (polizasError) {
      console.error('[Polizas List] Error al consultar:', polizasError);
      throw polizasError;
    }

    console.log('[Polizas List] Resultados:', polizas?.length || 0, 'de', count || 0);

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    // Normalize records to a consistent format regardless of source table
    const polizasMapeadas = (polizas || []).map((p: any) => ({
      id: p.id,
      id_docto: p.id_docto || p.id_documento || '',
      poliza: p.poliza || p.no_poliza || p.documento || 'N/A',
      documento: p.poliza || p.no_poliza || p.documento || 'N/A',
      compania: p.compania || p.aseguradora || 'N/A',
      ramo: p.ramo || 'N/A',
      subramo: p.subramo || '',
      cliente: p.cliente || p.contratante || 'N/A',
      asegurado: p.asegurado || p.cliente || p.contratante || '',
      vigencia_desde: p.vigencia_desde,
      vigencia_hasta: p.vigencia_hasta,
      fecha_emision: p.fecha_emision || p.vigencia_desde,
      fecha_captura: p.fecha_captura || p.created_at,
      prima_neta: p.prima_neta || 0,
      prima_total: p.prima_total || p.importe || 0,
      importe: p.importe || p.prima_total || 0,
      estatus: p.estatus || (p.vigencia_hasta && new Date(p.vigencia_hasta) >= new Date() ? 'vigente' : 'no_vigente'),
      es_vigente: p.vigencia_hasta ? new Date(p.vigencia_hasta) >= new Date() : false,
      vend_id: p.vend_id,
      vend_nombre: p.vend_nombre || 'N/A',
      desp_nombre: p.desp_nombre,
      oficina_id: p.oficina_id,
      usuario_id: p.usuario_id,
      synced_at: p.synced_at || p.updated_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        polizas: polizasMapeadas,
        pagination: {
          page,
          items_per_page: itemsPerPage,
          total_records: totalRecords,
          total_pages: totalPages,
          has_next_page: page < totalPages,
          has_prev_page: page > 1,
        },
        metadata: {
          source: tableName,
          filters_applied: Object.keys(filters),
          cached_at: polizas && polizas.length > 0 ? (polizas[0].synced_at || polizas[0].updated_at) : null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Polizas List] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        polizas: [],
        pagination: {
          page: 1,
          items_per_page: 100,
          total_records: 0,
          total_pages: 0,
          has_next_page: false,
          has_prev_page: false,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
