import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VendorRanking {
  agente_nombre: string;
  total_produccion: number;
  num_documentos: number;
  oficina_id?: string | null;
}

interface RankingResult {
  posicion_nacional: number | null;
  total_vendedores_nacional: number;
  posicion_oficina: number | null;
  total_vendedores_oficina: number;
  nombre_oficina: string | null;
  produccion_anual: number;
  num_documentos: number;
  vendor_nombre: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('[get-vendor-ranking] Usuario autenticado:', user.id);

    // 1. BUSCAR VENDOR NAME DEL USUARIO
    const { data: mappings } = await supabase
      .from('vendor_mappings')
      .select('source_value')
      .eq('movi_user_id', user.id)
      .eq('status', 'active');

    if (!mappings || mappings.length === 0) {
      console.log('[get-vendor-ranking] Usuario sin vendor mapping');
      return new Response(
        JSON.stringify({
          success: true,
          has_vendor: false,
          message: 'Tu producción aún no está asociada a un vendedor. Contacta a administración.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vendorName = mappings[0].source_value;
    console.log('[get-vendor-ranking] Vendor encontrado:', vendorName);

    // 2. OBTENER INFORMACIÓN DEL USUARIO (OFICINA)
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('oficina_id, oficinas(nombre)')
      .eq('id', user.id)
      .maybeSingle();

    const oficinaId = usuarioData?.oficina_id || null;
    const nombreOficina = usuarioData?.oficinas?.nombre || null;

    console.log('[get-vendor-ranking] Oficina del usuario:', oficinaId, nombreOficina);

    // 3. CALCULAR FECHA INICIO DEL AÑO ACTUAL
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    console.log('[get-vendor-ranking] Calculando producción desde:', yearStart);

    // 4. OBTENER PRODUCCIÓN ANUAL DE TODOS LOS VENDEDORES
    const { data: allProduction, error: prodError } = await supabase
      .from('production_records')
      .select('agente_nombre, importe_pesos, prima_convenio')
      .gte('fecha', yearStart);

    if (prodError) {
      console.error('[get-vendor-ranking] Error obteniendo producción:', prodError);
      throw new Error(`Error obteniendo producción: ${prodError.message}`);
    }

    console.log('[get-vendor-ranking] Registros del año:', allProduction?.length || 0);

    // 5. AGRUPAR POR VENDEDOR Y CALCULAR TOTALES
    const vendorProduction = new Map<string, VendorRanking>();

    (allProduction || []).forEach((record: any) => {
      const nombre = record.agente_nombre?.toUpperCase().trim();
      if (!nombre) return;

      const valor = parseFloat(record.importe_pesos) > 0
        ? parseFloat(record.importe_pesos)
        : parseFloat(record.prima_convenio) || 0;

      if (!vendorProduction.has(nombre)) {
        vendorProduction.set(nombre, {
          agente_nombre: nombre,
          total_produccion: 0,
          num_documentos: 0,
        });
      }

      const vendor = vendorProduction.get(nombre)!;
      vendor.total_produccion += valor;
      vendor.num_documentos += 1;
    });

    console.log('[get-vendor-ranking] Vendedores únicos:', vendorProduction.size);

    // 6. MAPEAR VENDEDORES A OFICINAS
    const { data: allMappings } = await supabase
      .from('vendor_mappings')
      .select('source_value, movi_user_id')
      .eq('status', 'active');

    const vendorToUser = new Map<string, string>();
    (allMappings || []).forEach((m: any) => {
      vendorToUser.set(m.source_value.toUpperCase().trim(), m.movi_user_id);
    });

    const { data: allUsers } = await supabase
      .from('usuarios')
      .select('id, oficina_id');

    const userToOficina = new Map<string, string | null>();
    (allUsers || []).forEach((u: any) => {
      userToOficina.set(u.id, u.oficina_id);
    });

    // Asignar oficinas a los vendedores
    vendorProduction.forEach((vendor, nombre) => {
      const userId = vendorToUser.get(nombre);
      if (userId) {
        vendor.oficina_id = userToOficina.get(userId) || null;
      }
    });

    // 7. CALCULAR RANKING NACIONAL
    const sortedVendors = Array.from(vendorProduction.values())
      .sort((a, b) => {
        if (b.total_produccion !== a.total_produccion) {
          return b.total_produccion - a.total_produccion;
        }
        return b.num_documentos - a.num_documentos;
      });

    const vendorNameUpper = vendorName.toUpperCase().trim();
    const posicionNacional = sortedVendors.findIndex(v => v.agente_nombre === vendorNameUpper) + 1;
    const totalVendedoresNacional = sortedVendors.length;

    console.log('[get-vendor-ranking] Posición nacional:', posicionNacional, 'de', totalVendedoresNacional);

    // 8. CALCULAR RANKING POR OFICINA
    let posicionOficina: number | null = null;
    let totalVendedoresOficina = 0;

    if (oficinaId) {
      const vendorsInOficina = sortedVendors.filter(v => v.oficina_id === oficinaId);
      totalVendedoresOficina = vendorsInOficina.length;
      posicionOficina = vendorsInOficina.findIndex(v => v.agente_nombre === vendorNameUpper) + 1;

      if (posicionOficina === 0) {
        posicionOficina = null;
      }

      console.log('[get-vendor-ranking] Posición oficina:', posicionOficina, 'de', totalVendedoresOficina);
    } else {
      console.log('[get-vendor-ranking] Usuario sin oficina asignada');
    }

    // 9. OBTENER DATOS DEL VENDEDOR
    const vendorData = vendorProduction.get(vendorNameUpper);
    const produccionAnual = vendorData?.total_produccion || 0;
    const numDocumentos = vendorData?.num_documentos || 0;

    const result: RankingResult = {
      posicion_nacional: posicionNacional > 0 ? posicionNacional : null,
      total_vendedores_nacional: totalVendedoresNacional,
      posicion_oficina: posicionOficina,
      total_vendedores_oficina: totalVendedoresOficina,
      nombre_oficina: nombreOficina,
      produccion_anual: produccionAnual,
      num_documentos: numDocumentos,
      vendor_nombre: vendorName,
    };

    return new Response(
      JSON.stringify({
        success: true,
        has_vendor: true,
        ranking: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[get-vendor-ranking] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        stack: error.stack,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
