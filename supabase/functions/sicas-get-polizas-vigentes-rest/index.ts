import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasRestClient } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  vendedor_ids?: string[];
  fecha_desde?: string; // formato: YYYY-MM-DD
  fecha_hasta?: string; // formato: YYYY-MM-DD
  solo_polizas?: boolean;
  page?: number;
  items_per_page?: number;
  sort_field?: string;
}

/**
 * Edge Function para obtener pólizas vigentes usando SICAS REST API
 * Basado en el manual oficial API-Servicios_REST.pdf
 *
 * KeyCode: HWSDOC (Solo pólizas, sin órdenes ni fianzas)
 * Endpoint: POST /Report/ReadData
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validar que las credenciales SICAS estén configuradas ANTES de hacer nada
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');

    if (!sicasUsername || !sicasPassword) {
      console.error('[SICAS REST Pólizas] ❌ Credenciales SICAS no configuradas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciales SICAS no configuradas en el servidor. Contacta al administrador.',
          details: {
            username_configured: !!sicasUsername,
            password_configured: !!sicasPassword,
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();

    // Aplicar fechas por defecto si no se especifican (último año)
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const defaultFechaDesde = oneYearAgo.toISOString().split('T')[0];
    const defaultFechaHasta = now.toISOString().split('T')[0];

    const {
      vendedor_ids,
      fecha_desde = defaultFechaDesde,
      fecha_hasta = defaultFechaHasta,
      solo_polizas = true,
      page = 1,
      items_per_page = 100,
      sort_field,
    } = body;

    console.log('[SICAS REST Pólizas] Iniciando consulta');
    console.log('[SICAS REST Pólizas] Fecha desde:', fecha_desde);
    console.log('[SICAS REST Pólizas] Fecha hasta:', fecha_hasta);
    console.log('[SICAS REST Pólizas] Vendedores:', vendedor_ids?.length || 'Todos');

    // Inicializar cliente REST
    const client = new SicasRestClient();

    // Construir condiciones de filtrado según manual (página 28)
    const conditions: string[] = [];

    // Filtro de estatus vigente (según manual, página 32)
    conditions.push('DatDocumentos.Estatus=V'); // V = Vigente

    // Filtro de solo pólizas si aplica
    if (solo_polizas) {
      // Según manual, HWSDOC ya filtra solo pólizas
      conditions.push('DatDocumentos.TipoDocto=P'); // P = Póliza
    }

    // Filtro de fechas
    if (fecha_desde) {
      conditions.push(`DatDocumentos.FDesde>=${fecha_desde}`);
    }
    if (fecha_hasta) {
      conditions.push(`DatDocumentos.FDesde<=${fecha_hasta}`);
    }

    // Filtro de vendedores
    let conditionsDirect = '';
    if (vendedor_ids && vendedor_ids.length > 0) {
      // Obtener nombres de vendedores de la base de datos
      const { data: vendedores } = await supabase
        .from('sicas_catalogos')
        .select('id_sicas, nombre')
        .eq('catalog_type_id', 32) // Vendedores
        .in('id_sicas', vendedor_ids);

      if (vendedores && vendedores.length > 0) {
        const vendorIdsList = vendedores.map(v => v.id_sicas).join(',');
        conditionsDirect = `DatDocumentos.VendId IN (${vendorIdsList})`;
        console.log('[SICAS REST Pólizas] Filtro de vendedores aplicado:', vendedores.length);
      }
    }

    const conditionsString = conditions.join(' AND ');
    console.log('[SICAS REST Pólizas] Conditions:', conditionsString);
    if (conditionsDirect) {
      console.log('[SICAS REST Pólizas] ConditionsDirect:', conditionsDirect);
    }

    // Ejecutar reporte usando KeyCode HWSDOC según manual (página 32)
    console.log('[SICAS REST Pólizas] Ejecutando readReport con KeyCode: HWSDOC');
    const result = await client.readReport({
      keyCode: 'HWSDOC', // Solo pólizas según manual
      pageRequested: page,
      itemsForPage: items_per_page,
      formatResponse: 2, // JSON
      conditions: conditionsString,
      conditionsDirect: conditionsDirect || undefined,
      sortFields: sort_field,
    });

    console.log('[SICAS REST Pólizas] Respuesta completa de SICAS:', JSON.stringify(result, null, 2));

    // Extraer datos del response según estructura del manual (página 28-29)
    const records = result.Response?.[0]?.TableInfo || [];
    const tableControl = result.Response?.[0]?.TableControl?.[0];

    console.log('[SICAS REST Pólizas] Registros encontrados:', records.length);
    console.log('[SICAS REST Pólizas] Total en servidor:', tableControl?.MaxRecords || records.length);

    // Log adicional para diagnóstico
    if (records.length === 0) {
      console.warn('[SICAS REST Pólizas] ADVERTENCIA: No se encontraron registros');
      console.warn('[SICAS REST Pólizas] Response.Success:', result.Sucess);
      console.warn('[SICAS REST Pólizas] Response.Error:', result.Error);
      console.warn('[SICAS REST Pólizas] Response.Message:', result.Message);
    }

    // Formatear respuesta
    const response = {
      success: true,
      message: 'Pólizas vigentes obtenidas exitosamente',
      stats: {
        total_records: tableControl?.MaxRecords || records.length,
        page: tableControl?.Page || page,
        items_per_page: tableControl?.ItemForPage || items_per_page,
        total_pages: tableControl?.Pages || 1,
        filters_applied: conditions.length + (conditionsDirect ? 1 : 0),
      },
      filters: {
        fecha_desde: fecha_desde || null,
        fecha_hasta: fecha_hasta || null,
        vendedor_ids: vendedor_ids || null,
        solo_polizas,
      },
      polizas: records,
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
    console.error('[SICAS REST Pólizas] Error:', errMsg);

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
