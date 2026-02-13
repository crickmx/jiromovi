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

    // Lista extendida de códigos de reporte posibles
    const reportCodes = [
      // Pólizas y producción
      'H05106', 'H05107', 'H05105', 'H03117', 'H05101', 'H05102',
      // Cobranza
      'D004', 'D001', 'D002', 'D003',
      // Comisiones
      'C001', 'C002', 'C003', 'C004',
      // Otros
      'R001', 'R002', 'P001', 'P002',
    ];

    const results = [];

    for (const keyCode of reportCodes) {
      try {
        console.log(`[Test Reports] Probando ${keyCode}...`);

        const response = await sicasClient.readReport({
          keyCode,
          pageRequested: 1,
          itemsForPage: 1,
          formatResponse: 2,
        });

        if (response.Sucess && !response.Error) {
          const hasData = response.Response?.[0]?.TableInfo?.length > 0;
          results.push({
            keyCode,
            status: 'available',
            hasData,
            recordCount: response.Response?.[0]?.TableInfo?.length || 0,
          });
          console.log(`[Test Reports] ✅ ${keyCode} - Disponible (${hasData ? 'con datos' : 'sin datos'})`);
        } else {
          results.push({
            keyCode,
            status: 'error',
            error: response.Error || 'Sin datos',
          });
          console.log(`[Test Reports] ❌ ${keyCode} - Error: ${response.Error}`);
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Error desconocido';
        const isNotFound = errorMsg.includes('no encontrado') ||
                          errorMsg.includes('not found') ||
                          errorMsg.includes('Codigo de reporte');

        results.push({
          keyCode,
          status: isNotFound ? 'not_found' : 'error',
          error: errorMsg,
        });
        console.log(`[Test Reports] ⚠️ ${keyCode} - ${isNotFound ? 'No encontrado' : 'Error'}: ${errorMsg}`);
      }

      // Pequeña pausa entre requests para no saturar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

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
