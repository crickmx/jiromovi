import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createSicasRestClientWithDbAuth } from '../_shared/sicasRestClient.ts';

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
    console.log('[H03117 Diagnostic] Iniciando diagnóstico especial para H03117...');

    // Verificar configuración de SICAS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuración no encontrada' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const sicasClient = await createSicasRestClientWithDbAuth();

    const results = [];

    // ============================================
    // PRUEBA 1: Sin parámetros extras (básico)
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 1: Básico (sin parámetros extras)');
    try {
      const response1 = await sicasClient.readReport({
        keyCode: 'H03117',
        pageRequested: 1,
        itemsForPage: 5,
        formatResponse: 2,
      });

      results.push({
        test: 'Básico (sin parámetros)',
        status: response1.Sucess ? 'success' : 'error',
        error: response1.Error,
        recordCount: response1.Response?.[0]?.TableInfo?.length || 0,
        response: response1,
      });
    } catch (error: any) {
      results.push({
        test: 'Básico (sin parámetros)',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // ============================================
    // PRUEBA 2: Con FormatResponse = 0 (XML)
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 2: FormatResponse = 0 (XML)');
    try {
      const response2 = await sicasClient.readReport({
        keyCode: 'H03117',
        pageRequested: 1,
        itemsForPage: 5,
        formatResponse: 0,
      });

      results.push({
        test: 'FormatResponse = 0 (XML)',
        status: response2.Sucess ? 'success' : 'error',
        error: response2.Error,
        recordCount: response2.Response?.[0]?.TableInfo?.length || 0,
        response: response2,
      });
    } catch (error: any) {
      results.push({
        test: 'FormatResponse = 0 (XML)',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // ============================================
    // PRUEBA 3: Con condiciones de fecha (último mes)
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 3: Con condiciones de fecha');
    try {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const fechaInicio = lastMonth.toISOString().split('T')[0];
      const fechaFin = today.toISOString().split('T')[0];

      const response3 = await sicasClient.readReport({
        keyCode: 'H03117',
        pageRequested: 1,
        itemsForPage: 5,
        formatResponse: 2,
        conditionsDirect: `FECHA >= '${fechaInicio}' AND FECHA <= '${fechaFin}'`,
      });

      results.push({
        test: 'Con condiciones de fecha',
        status: response3.Sucess ? 'success' : 'error',
        error: response3.Error,
        recordCount: response3.Response?.[0]?.TableInfo?.length || 0,
        conditions: `FECHA >= '${fechaInicio}' AND FECHA <= '${fechaFin}'`,
        response: response3,
      });
    } catch (error: any) {
      results.push({
        test: 'Con condiciones de fecha',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // ============================================
    // PRUEBA 4: Solicitar campos específicos
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 4: Campos específicos');
    try {
      const response4 = await sicasClient.readReport({
        keyCode: 'H03117',
        pageRequested: 1,
        itemsForPage: 5,
        formatResponse: 2,
        fieldsRequested: 'POLIZA,ASEGURADO,VIGENCIA_DE,VIGENCIA_A,PRIMA_NETA',
      });

      results.push({
        test: 'Campos específicos',
        status: response4.Sucess ? 'success' : 'error',
        error: response4.Error,
        recordCount: response4.Response?.[0]?.TableInfo?.length || 0,
        fieldsRequested: 'POLIZA,ASEGURADO,VIGENCIA_DE,VIGENCIA_A,PRIMA_NETA',
        response: response4,
      });
    } catch (error: any) {
      results.push({
        test: 'Campos específicos',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // ============================================
    // PRUEBA 5: Solo 1 registro (mínimo posible)
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 5: Solo 1 registro');
    try {
      const response5 = await sicasClient.readReport({
        keyCode: 'H03117',
        pageRequested: 1,
        itemsForPage: 1,
        formatResponse: 2,
      });

      results.push({
        test: 'Solo 1 registro',
        status: response5.Sucess ? 'success' : 'error',
        error: response5.Error,
        recordCount: response5.Response?.[0]?.TableInfo?.length || 0,
        response: response5,
      });
    } catch (error: any) {
      results.push({
        test: 'Solo 1 registro',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    // ============================================
    // PRUEBA 6: Sin formatResponse (dejar por defecto)
    // ============================================
    console.log('[H03117 Diagnostic] Prueba 6: Sin FormatResponse especificado');
    try {
      // Llamar directamente al API para tener control total
      const token = await sicasClient.getValidToken();
      const body = new URLSearchParams({
        PageRequested: '1',
        ItemsForPage: '5',
      });

      const response = await fetch(
        `${config.endpoint}/Report/ReadData`,
        {
          method: 'POST',
          headers: {
            'Authorization': token,
            'Prop_KeyCode': 'H03117',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      const data = await response.json();

      results.push({
        test: 'Sin FormatResponse (raw request)',
        status: data.Sucess ? 'success' : 'error',
        httpStatus: response.status,
        error: data.Error,
        message: data.Message,
        recordCount: data.Response?.[0]?.TableInfo?.length || 0,
        response: data,
      });
    } catch (error: any) {
      results.push({
        test: 'Sin FormatResponse (raw request)',
        status: 'exception',
        error: error.message,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    console.log('[H03117 Diagnostic] Diagnóstico completado');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Diagnóstico de H03117 completado',
        summary: {
          total_tests: results.length,
          successful: results.filter(r => r.status === 'success').length,
          errors: results.filter(r => r.status === 'error').length,
          exceptions: results.filter(r => r.status === 'exception').length,
        },
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('[H03117 Diagnostic] Error general:', error);
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
