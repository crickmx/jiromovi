import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VendorStats {
  usuario_id: string;
  nombre_completo: string;
  email_laboral: string | null;
  vend_id: string;
  vend_nombre: string | null;
  oficina_id: string;
  oficina_nombre: string;
  total_polizas: number;
  total_prima_neta: number;
  total_prima_total: number;
  renovaciones_proximas: number;
  emitidas_mes_actual: number;
  ultima_sincronizacion: string | null;
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

    // Obtener datos del usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, rol, oficina_id, oficinas(nombre)')
      .eq('id', user.id)
      .single();

    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    console.log('[Office-Vendors] Usuario:', usuario.id, 'Rol:', usuario.rol);

    // Determinar qué vendedores puede ver según su rol
    let vendedoresQuery = supabase
      .from('sicas_mapeo_vendedor_usuario')
      .select(`
        id_sicas_vendedor,
        movi_user_id,
        usuarios!inner(
          id,
          nombre_completo,
          email_laboral,
          oficina_id,
          rol,
          oficinas(nombre)
        )
      `);

    // Filtrar según rol
    if (usuario.rol !== 'admin' && usuario.rol !== 'Administrador') {
      // Gerentes y empleados ven solo su oficina
      vendedoresQuery = vendedoresQuery.eq('usuarios.oficina_id', usuario.oficina_id);
    }

    const { data: vendedores, error: vendedoresError } = await vendedoresQuery;

    if (vendedoresError) {
      console.error('[Office-Vendors] Error:', vendedoresError);
      throw vendedoresError;
    }

    console.log('[Office-Vendors] Vendedores encontrados:', vendedores?.length || 0);

    if (!vendedores || vendedores.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          vendors: [],
          stats: {
            total_vendors: 0,
            total_polizas: 0,
            total_prima_total: 0,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Obtener estadísticas de cada vendedor
    const vendorStats: VendorStats[] = [];

    for (const vendedor of vendedores) {
      const vendId = vendedor.id_sicas_vendedor.toString();
      const usuarioData = vendedor.usuarios as any;

      // Contar pólizas vigentes
      const { count: totalPolizas } = await supabase
        .from('sicas_polizas_vigentes')
        .select('*', { count: 'exact', head: true })
        .eq('vend_id', vendId);

      // Sumar primas
      const { data: primas } = await supabase
        .from('sicas_polizas_vigentes')
        .select('prima_neta, prima_total')
        .eq('vend_id', vendId);

      const totalPrimaNeta = primas?.reduce((sum, p) => sum + (p.prima_neta || 0), 0) || 0;
      const totalPrimaTotal = primas?.reduce((sum, p) => sum + (p.prima_total || 0), 0) || 0;

      // Contar renovaciones próximas (60 días)
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      const future = futureDate.toISOString().split('T')[0];

      const { count: renovaciones } = await supabase
        .from('sicas_polizas_vigentes')
        .select('*', { count: 'exact', head: true })
        .eq('vend_id', vendId)
        .gte('vigencia_hasta', today)
        .lte('vigencia_hasta', future);

      // Contar emitidas en mes actual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { count: emitidas } = await supabase
        .from('sicas_polizas_vigentes')
        .select('*', { count: 'exact', head: true })
        .eq('vend_id', vendId)
        .gte('vigencia_desde', startOfMonth)
        .lte('vigencia_desde', endOfMonth);

      // Última sincronización
      const { data: lastSync } = await supabase
        .from('sicas_polizas_vigentes')
        .select('synced_at')
        .eq('vend_id', vendId)
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      vendorStats.push({
        usuario_id: usuarioData.id,
        nombre_completo: usuarioData.nombre_completo,
        email_laboral: usuarioData.email_laboral,
        vend_id: vendId,
        vend_nombre: null, // Se puede obtener de sicas_catalogos si es necesario
        oficina_id: usuarioData.oficina_id,
        oficina_nombre: usuarioData.oficinas?.nombre || '',
        total_polizas: totalPolizas || 0,
        total_prima_neta: totalPrimaNeta,
        total_prima_total: totalPrimaTotal,
        renovaciones_proximas: renovaciones || 0,
        emitidas_mes_actual: emitidas || 0,
        ultima_sincronizacion: lastSync?.synced_at || null,
      });
    }

    // Ordenar por prima total descendente
    vendorStats.sort((a, b) => b.total_prima_total - a.total_prima_total);

    // Calcular totales globales
    const globalStats = {
      total_vendors: vendorStats.length,
      total_polizas: vendorStats.reduce((sum, v) => sum + v.total_polizas, 0),
      total_prima_neta: vendorStats.reduce((sum, v) => sum + v.total_prima_neta, 0),
      total_prima_total: vendorStats.reduce((sum, v) => sum + v.total_prima_total, 0),
      total_renovaciones: vendorStats.reduce((sum, v) => sum + v.renovaciones_proximas, 0),
      total_emitidas_mes: vendorStats.reduce((sum, v) => sum + v.emitidas_mes_actual, 0),
    };

    console.log('[Office-Vendors] Stats calculados para', vendorStats.length, 'vendedores');

    return new Response(
      JSON.stringify({
        success: true,
        vendors: vendorStats,
        stats: globalStats,
        metadata: {
          user_rol: usuario.rol,
          user_oficina_id: usuario.oficina_id,
          oficina_nombre: usuario.oficinas?.nombre || '',
          scope: usuario.rol === 'admin' || usuario.rol === 'Administrador' ? 'all' : 'office',
          fetched_at: new Date().toISOString(),
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
    console.error('[Office-Vendors] Error:', error);
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
