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
    console.log('[Pólizas List] Iniciando consulta de pólizas');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener usuario autenticado desde el token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuario no autenticado');
    }

    console.log('[Pólizas List] Usuario autenticado:', user.id);

    // Obtener información del usuario y su mapeo SICAS
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

    console.log('[Pólizas List] Rol del usuario:', usuarioData.rol);

    // Obtener mapeo SICAS del usuario (si existe)
    const { data: mappingData } = await supabase
      .from('sicas_user_mapping')
      .select('*')
      .eq('usuario_id', user.id)
      .eq('es_mapeo_principal', true)
      .eq('activo', true)
      .maybeSingle();

    console.log('[Pólizas List] Mapeo SICAS:', mappingData ? 'encontrado' : 'no encontrado');

    // Parsear request body
    const requestBody: PolizasListRequest = await req.json();
    const filters = requestBody.filters || {};
    const page = requestBody.page || 1;
    const itemsPerPage = Math.min(requestBody.items_per_page || 100, 500);

    console.log('[Pólizas List] Filtros recibidos:', filters);

    // Construir query base con RLS
    let query = supabase
      .from('sicas_documents')
      .select('*', { count: 'exact' });

    // Aplicar filtros según rol
    if (usuarioData.rol === 'Administrador') {
      console.log('[Pólizas List] Administrador: sin filtros de permisos');
      // Administrador ve todo
    } else if (usuarioData.rol === 'Gerente' || usuarioData.rol === 'Empleado') {
      console.log('[Pólizas List] Gerente/Empleado: filtrar por oficina');
      // Gerente/Empleado: solo su oficina
      if (usuarioData.oficina_id) {
        query = query.eq('oficina_id', usuarioData.oficina_id);
      } else {
        console.warn('[Pólizas List] Usuario sin oficina asignada');
        // Sin oficina = sin resultados
        query = query.eq('oficina_id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (usuarioData.rol === 'Agente') {
      console.log('[Pólizas List] Agente: filtrar por usuario_id');
      // Agente: solo sus pólizas
      query = query.eq('usuario_id', user.id);
    } else {
      console.warn('[Pólizas List] Rol desconocido, sin acceso');
      // Rol desconocido = sin acceso
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rol de usuario no válido para consultar pólizas',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Aplicar filtros de búsqueda
    if (filters.searchText) {
      const search = `%${filters.searchText}%`;
      query = query.or(`poliza.ilike.${search},cliente.ilike.${search},id_docto.ilike.${search}`);
    }

    // Filtro por estatus
    if (filters.estatus === 'vigente') {
      // Solo vigentes: vigencia_hasta >= hoy
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('vigencia_hasta', today);
    } else if (filters.estatus === 'no_vigente') {
      // Solo no vigentes: vigencia_hasta < hoy
      const today = new Date().toISOString().split('T')[0];
      query = query.lt('vigencia_hasta', today);
    }

    // Filtro por fechas
    if (filters.fecha_desde && filters.fecha_hasta) {
      const fieldMap = {
        vigencia: 'vigencia_desde',
        captura: 'fecha_captura',
        emision: 'fecha_emision',
      };
      const field = fieldMap[filters.tipo_fecha || 'vigencia'] || 'vigencia_desde';

      query = query
        .gte(field, filters.fecha_desde)
        .lte(field, filters.fecha_hasta);
    }

    // Filtro por oficina (solo admin puede filtrar por oficina diferente)
    if (filters.oficina_id && usuarioData.rol === 'admin') {
      query = query.eq('oficina_id', filters.oficina_id);
    }

    // Filtro por vendedor
    if (filters.vendedor_nombre) {
      query = query.ilike('vend_nombre', `%${filters.vendedor_nombre}%`);
    }

    // Filtro por aseguradora
    if (filters.aseguradora) {
      query = query.ilike('compania', `%${filters.aseguradora}%`);
    }

    // Filtro por ramo
    if (filters.ramo) {
      query = query.ilike('ramo', `%${filters.ramo}%`);
    }

    // Filtro por subramo
    if (filters.subramo) {
      query = query.ilike('subramo', `%${filters.subramo}%`);
    }

    // Ordenamiento
    const sortBy = filters.sort_by || 'synced_at';
    const sortOrder = filters.sort_order || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Paginación
    const offset = (page - 1) * itemsPerPage;
    query = query.range(offset, offset + itemsPerPage - 1);

    // Ejecutar query
    const { data: polizas, error: polizasError, count } = await query;

    if (polizasError) {
      console.error('[Pólizas List] Error al consultar:', polizasError);
      throw polizasError;
    }

    console.log('[Pólizas List] Resultados encontrados:', polizas?.length || 0);
    console.log('[Pólizas List] Total en DB:', count || 0);

    // Calcular paginación
    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / itemsPerPage);

    // Mapear pólizas al formato esperado
    const polizasMapeadas = (polizas || []).map((p: any) => ({
      id: p.id,
      id_docto: p.id_docto,
      poliza: p.poliza || p.documento || 'N/A',
      documento: p.poliza || p.documento || 'N/A',
      compania: p.compania || 'N/A',
      ramo: p.ramo || 'N/A',
      subramo: p.subramo || '',
      cliente: p.cliente || 'N/A',
      vigencia_desde: p.vigencia_desde,
      vigencia_hasta: p.vigencia_hasta,
      fecha_emision: p.fecha_emision,
      fecha_captura: p.fecha_captura,
      prima_neta: p.prima_neta || 0,
      prima_total: p.importe || p.prima_total || 0,
      importe: p.importe || 0,
      estatus: p.estatus || 'vigente',
      es_vigente: p.vigencia_hasta ? new Date(p.vigencia_hasta) >= new Date() : false,
      vend_id: p.vend_id,
      vend_nombre: p.vend_nombre || 'N/A',
      desp_nombre: p.desp_nombre,
      oficina_id: p.oficina_id,
      usuario_id: p.usuario_id,
      synced_at: p.synced_at,
    }));

    // Respuesta exitosa
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
          source: 'database',
          keycode_used: 'N/A (from cache)',
          filters_applied: Object.keys(filters),
          cached_at: polizas && polizas.length > 0 ? polizas[0].synced_at : null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[Pólizas List] Error:', error);

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
