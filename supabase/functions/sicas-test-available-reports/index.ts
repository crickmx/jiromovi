import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createSicasRestClient } from '../_shared/sicasRestClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[Test Reports] Probando códigos de reporte disponibles...');

    // Verificar configuración de SICAS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('[Test Reports] Error obteniendo configuración:', configError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo obtener la configuración de SICAS',
          details: configError
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

    console.log('[Test Reports] Configuración verificada, creando cliente...');

    const sicasClient = createSicasRestClient({
      baseUrl: config.endpoint || 'https://security-services.sicasonline.info/api',
      username: config.sicas_usuario,
      password: config.sicas_password,
    });

    // Obtener códigos desde config o usar defaults prioritarios
    // Códigos más comunes en SICAS según documentación
    const reportCodes = config.alternate_report_codes || [
      // Pólizas y producción (más comunes primero)
      'H05106', 'H05107', 'H05101', 'H05102', 'H05105',
      // Cobranza
      'D001', 'D002', 'D003', 'D004',
      // Comisiones
      'C001', 'C002', 'C003', 'C004',
    ];

    console.log(`[Test Reports] Probando ${reportCodes.length} códigos...`);

    // Probar todos en paralelo con timeout individual
    const testPromises = reportCodes.map(async (keyCode) => {
      try {
        console.log(`[Test Reports] Probando ${keyCode}...`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );

        const response = await Promise.race([
          sicasClient.readReport({
            keyCode,
            pageRequested: 1,
            itemsForPage: 1,
            formatResponse: 2,
          }),
          timeoutPromise
        ]) as any;

        if (response.Sucess && !response.Error) {
          const hasData = response.Response?.[0]?.TableInfo?.length > 0;
          console.log(`[Test Reports] ✅ ${keyCode} - Disponible (${hasData ? 'con datos' : 'sin datos'})`);
          return {
            keyCode,
            status: 'available',
            hasData,
            recordCount: response.Response?.[0]?.TableInfo?.length || 0,
          };
        } else {
          console.log(`[Test Reports] ❌ ${keyCode} - Error: ${response.Error}`);
          return {
            keyCode,
            status: 'error',
            error: response.Error || 'Sin datos',
          };
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Error desconocido';
        const isNotFound = errorMsg.includes('no encontrado') ||
                          errorMsg.includes('not found') ||
                          errorMsg.includes('Codigo de reporte');

        console.log(`[Test Reports] ⚠️ ${keyCode} - ${isNotFound ? 'No encontrado' : 'Error'}: ${errorMsg}`);
        return {
          keyCode,
          status: isNotFound ? 'not_found' : 'error',
          error: errorMsg,
        };
      }
    });

    const results = await Promise.all(testPromises);

    // Resumen
    const available = results.filter(r => r.status === 'available');
    const withData = available.filter(r => r.hasData);
    const notFound = results.filter(r => r.status === 'not_found');
    const errors = results.filter(r => r.status === 'error');

    console.log(`[Test Reports] Resumen:`);
    console.log(`  - Disponibles: ${available.length}`);
    console.log(`  - Con datos: ${withData.length}`);
    console.log(`  - No encontrados: ${notFound.length}`);
    console.log(`  - Errores: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_tested: reportCodes.length,
          available: available.length,
          with_data: withData.length,
          not_found: notFound.length,
          errors: errors.length,
        },
        results,
        recommendations: withData.map(r => r.keyCode),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[Test Reports] Error fatal:', error);

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
