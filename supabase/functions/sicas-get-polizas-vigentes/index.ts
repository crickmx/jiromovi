import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  vendedor_ids?: string[];
  fecha_desde?: string;
  fecha_hasta?: string;
  fecha_desde_text?: string;
  fecha_hasta_text?: string;
  solo_polizas?: boolean;
  page?: number;
  items_per_page?: number;
  sort_field?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const {
      vendedor_ids,
      fecha_desde = '01/01/2025',
      fecha_hasta = '31/12/2025',
      fecha_desde_text = '01/Ene/2025',
      fecha_hasta_text = '31/Dic/2025',
      solo_polizas = true,
      page = 1,
      items_per_page = 100,
      sort_field = 'DatDocumentos.FDesde',
    } = body;

    // Credenciales SICAS
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') ||
      'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');

    if (!sicasUsername || !sicasPassword) {
      throw new Error('SICAS credentials not configured');
    }

    console.log('[SICAS Pólizas Vigentes] Iniciando consulta');
    console.log('[SICAS Pólizas Vigentes] Fecha desde:', fecha_desde);
    console.log('[SICAS Pólizas Vigentes] Fecha hasta:', fecha_hasta);
    console.log('[SICAS Pólizas Vigentes] Vendedores:', vendedor_ids?.length || 'Todos');

    // Inicializar cliente SOAP
    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // Construir filtros
    const filters = [];

    // Filtro de estatus vigente
    filters.push(SicasSoapReportClient.createStatusVicenteFilter());

    // Filtro de fecha
    filters.push(SicasSoapReportClient.createDateRangeFilter(
      fecha_desde,
      fecha_hasta,
      fecha_desde_text,
      fecha_hasta_text,
      'DatDocumentos.FDesde'
    ));

    // Filtro de solo pólizas (excluir endosos, etc)
    if (solo_polizas) {
      filters.push(SicasSoapReportClient.createDocumentTypeFilter());
    }

    // Filtro de vendedores (si se especificaron)
    if (vendedor_ids && vendedor_ids.length > 0) {
      // Obtener nombres de vendedores de la base de datos
      const { data: vendedores } = await supabase
        .from('sicas_catalogos')
        .select('id_sicas, nombre')
        .eq('catalog_type_id', 32) // Vendedores
        .in('id_sicas', vendedor_ids);

      if (vendedores && vendedores.length > 0) {
        const vendorNames = vendedores.map(v => v.nombre);
        filters.push(SicasSoapReportClient.createVendorFilter(
          vendedor_ids,
          vendorNames
        ));
        console.log('[SICAS Pólizas Vigentes] Filtro de vendedores aplicado:', vendedores.length);
      }
    }

    console.log('[SICAS Pólizas Vigentes] Filtros aplicados:', filters.length);

    // Ejecutar reporte
    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page,
      itemsPerPage: items_per_page,
      sortField: sort_field,
      filters,
    });

    console.log('[SICAS Pólizas Vigentes] Registros encontrados:', result.records.length);

    // Formatear respuesta
    const response = {
      success: true,
      message: result.message,
      stats: {
        total_records: result.totalRecords || result.records.length,
        page,
        items_per_page,
        filters_applied: filters.length,
      },
      filters: {
        fecha_desde,
        fecha_hasta,
        vendedor_ids,
        solo_polizas,
      },
      polizas: result.records,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    const errMsg = String(error?.message ?? error ?? 'Unknown error');
    console.error('[SICAS Pólizas Vigentes] Error:', errMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errMsg,
        stack: error?.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
