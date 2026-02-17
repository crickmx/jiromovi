import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

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
    console.log('='.repeat(80));
    console.log('TEST SYNC POLIZAS VIGENTES - DIAGNÓSTICO DETALLADO');
    console.log('='.repeat(80));

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener configuración SICAS
    console.log('📋 Obteniendo configuración SICAS...');
    const { data: config, error: configError } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error(`Error obteniendo config: ${configError?.message || 'Config no encontrada'}`);
    }

    const sicasUrl = config.endpoint || 'http://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
    const sicasUsuario = config.sicas_usuario;
    const sicasPassword = config.sicas_password;

    console.log('✅ Configuración cargada:');
    console.log('  - Endpoint:', sicasUrl);
    console.log('  - Usuario:', sicasUsuario);
    console.log('  - Password:', sicasPassword ? '***configurado***' : 'NO CONFIGURADO');

    if (!sicasUsuario || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    // Inicializar cliente SOAP
    console.log('\n📡 Inicializando cliente SOAP...');
    const client = new SicasSoapReportClient({
      endpoint: sicasUrl,
      username: sicasUsuario,
      password: sicasPassword,
    });

    // Test 1: Sin filtros (obtener todo)
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: Consulta SIN FILTROS (primeros 10 registros)');
    console.log('='.repeat(80));

    const result1 = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page: 1,
      itemsPerPage: 10,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters: [],
    });

    console.log('\n✅ Resultado Test 1:');
    console.log('  - Success:', result1.success);
    console.log('  - ResponseNbr:', result1.responseNbr);
    console.log('  - Message:', result1.message);
    console.log('  - Registros:', result1.records.length);

    if (result1.records.length > 0) {
      console.log('\n📄 Primer registro:');
      console.log(JSON.stringify(result1.records[0], null, 2));
    }

    // Test 2: Con filtros de estatus y tipo
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Consulta CON FILTROS (estatus vigente + tipo póliza)');
    console.log('='.repeat(80));

    const filters = [
      SicasSoapReportClient.createStatusVicenteFilter(),
      SicasSoapReportClient.createDocumentTypeFilter(),
    ];

    const result2 = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
      page: 1,
      itemsPerPage: 10,
      sortField: 'DatDocumentos.FCaptura DESC',
      filters,
    });

    console.log('\n✅ Resultado Test 2:');
    console.log('  - Success:', result2.success);
    console.log('  - ResponseNbr:', result2.responseNbr);
    console.log('  - Message:', result2.message);
    console.log('  - Registros:', result2.records.length);

    if (result2.records.length > 0) {
      console.log('\n📄 Primer registro con filtros:');
      console.log(JSON.stringify(result2.records[0], null, 2));
    }

    // Test 3: Verificar estructura de la tabla sicas_documents
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: Verificar tabla sicas_documents');
    console.log('='.repeat(80));

    const { count, error: countError } = await supabase
      .from('sicas_documents')
      .select('*', { count: 'exact', head: true });

    console.log('  - Registros actuales en sicas_documents:', count || 0);
    console.log('  - Error:', countError?.message || 'ninguno');

    // Resumen final
    console.log('\n' + '='.repeat(80));
    console.log('RESUMEN DIAGNÓSTICO');
    console.log('='.repeat(80));

    const diagnostico = {
      config: {
        endpoint: sicasUrl,
        usuario_configurado: !!sicasUsuario,
        password_configurado: !!sicasPassword,
      },
      test_sin_filtros: {
        success: result1.success,
        registros: result1.records.length,
        responseNbr: result1.responseNbr,
        message: result1.message,
      },
      test_con_filtros: {
        success: result2.success,
        registros: result2.records.length,
        responseNbr: result2.responseNbr,
        message: result2.message,
      },
      base_datos: {
        registros_actuales: count || 0,
      },
      problema_detectado: null as string | null,
      solucion_sugerida: null as string | null,
    };

    // Detectar problemas
    if (!result1.success && !result2.success) {
      diagnostico.problema_detectado = 'SICAS no devuelve datos con ninguna consulta';
      diagnostico.solucion_sugerida = 'Verificar que el código de reporte H03400 esté disponible para tu usuario SICAS';
    } else if (result1.records.length === 0 && result2.records.length === 0) {
      diagnostico.problema_detectado = 'No hay pólizas vigentes en SICAS';
      diagnostico.solucion_sugerida = 'Verificar que existan pólizas vigentes en el sistema SICAS';
    } else if (result1.records.length > 0 && result2.records.length === 0) {
      diagnostico.problema_detectado = 'Los filtros están eliminando todos los registros';
      diagnostico.solucion_sugerida = 'Ajustar o eliminar filtros en la función de sincronización';
    } else {
      diagnostico.problema_detectado = null;
      diagnostico.solucion_sugerida = 'Todo funciona correctamente';
    }

    console.log('\n📊 DIAGNÓSTICO FINAL:');
    console.log(JSON.stringify(diagnostico, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        diagnostico,
        resultados: {
          sin_filtros: {
            registros: result1.records.length,
            muestra: result1.records.slice(0, 2),
          },
          con_filtros: {
            registros: result2.records.length,
            muestra: result2.records.slice(0, 2),
          },
        },
      }, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error: any) {
    console.error('❌ Error en test:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack?.substring(0, 500),
      }, null, 2),
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
