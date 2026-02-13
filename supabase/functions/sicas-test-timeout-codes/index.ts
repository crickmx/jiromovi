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
    console.log('[Test Timeout Codes] Probando códigos con timeout de manera SECUENCIAL...');

    // Verificar configuración de SICAS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('[Test Timeout Codes] Error obteniendo configuración:', configError);
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

    console.log('[Test Timeout Codes] Configuración verificada, creando cliente...');

    const sicasClient = createSicasRestClient({
      baseUrl: config.endpoint || 'https://security-services.sicasonline.info/api',
      username: config.sicas_usuario,
      password: config.sicas_password,
    });

    // Códigos que dieron timeout en la prueba anterior (probados secuencialmente)
    const timeoutCodes = [
      'H03117',       // Pólizas Vigentes
      'H03120_001',   // Cobranza Pagada
      'H03846_Cob',   // Toda la Cobranza
      'H03492_ALL',   // Comisiones Pendientes
      'H03797',       // Comisiones Pagadas
      'H03492_001',   // Comisiones Pendientes (variante)
      'H03120',       // Cobranza (variante)
    ];

    console.log(`[Test Timeout Codes] Probando ${timeoutCodes.length} códigos secuencialmente...`);
    console.log('[Test Timeout Codes] ADVERTENCIA: Esto puede tomar varios minutos...');

    const results = [];

    // Probar UNO POR UNO (secuencial) con timeout de 90 segundos
    for (const keyCode of timeoutCodes) {
      try {
        console.log(`[Test Timeout Codes] Probando ${keyCode}... (puede tardar hasta 90 segundos)`);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 90000) // 90 segundos
        );

        const startTime = Date.now();

        const response = await Promise.race([
          sicasClient.readReport({
            keyCode,
            pageRequested: 1,
            itemsForPage: 5, // Solicitar 5 registros para verificar datos
            formatResponse: 2,
          }),
          timeoutPromise
        ]) as any;

        const elapsedTime = Date.now() - startTime;

        if (response.Sucess && !response.Error) {
          const hasData = response.Response?.[0]?.TableInfo?.length > 0;
          const recordCount = response.Response?.[0]?.TableInfo?.length || 0;
          console.log(`[Test Timeout Codes] ✅ ${keyCode} - Disponible en ${elapsedTime}ms (${recordCount} registros)`);

          results.push({
            keyCode,
            status: 'available',
            hasData,
            recordCount,
            elapsedTime,
            message: hasData ? `Disponible con ${recordCount} registros` : 'Disponible pero sin datos',
          });
        } else {
          console.log(`[Test Timeout Codes] ❌ ${keyCode} - Error: ${response.Error || response.Message}`);
          results.push({
            keyCode,
            status: 'error',
            hasData: false,
            recordCount: 0,
            elapsedTime,
            message: response.Error || response.Message || 'Error desconocido',
          });
        }
      } catch (error: any) {
        if (error.message === 'Timeout') {
          console.log(`[Test Timeout Codes] ⏱️ ${keyCode} - Timeout después de 90 segundos`);
          results.push({
            keyCode,
            status: 'timeout',
            hasData: false,
            recordCount: 0,
            message: 'Timeout después de 90 segundos',
          });
        } else {
          console.error(`[Test Timeout Codes] ❌ ${keyCode} - Error inesperado:`, error);
          results.push({
            keyCode,
            status: 'error',
            hasData: false,
            recordCount: 0,
            message: error.message || 'Error inesperado',
          });
        }
      }

      // Esperar 2 segundos entre cada prueba para no sobrecargar el servidor
      if (keyCode !== timeoutCodes[timeoutCodes.length - 1]) {
        console.log('[Test Timeout Codes] Esperando 2 segundos antes del siguiente código...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Guardar los códigos exitosos en la configuración
    const successfulCodes = results
      .filter(r => r.status === 'available' && r.hasData)
      .map(r => r.keyCode);

    if (successfulCodes.length > 0) {
      console.log(`[Test Timeout Codes] Guardando ${successfulCodes.length} códigos exitosos...`);

      // Actualizar configuración con códigos exitosos
      await supabase
        .from('sicas_config')
        .update({
          report_test_history: {
            last_sequential_test_at: new Date().toISOString(),
            successful_codes: successfulCodes,
            all_results: results,
          }
        })
        .eq('id', config.id);
    }

    console.log('[Test Timeout Codes] Prueba secuencial completada');

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: results.length,
          available: results.filter(r => r.status === 'available').length,
          timeout: results.filter(r => r.status === 'timeout').length,
          error: results.filter(r => r.status === 'error').length,
          withData: results.filter(r => r.hasData).length,
        },
        successfulCodes,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[Test Timeout Codes] Error general:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error desconocido',
        details: error
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
