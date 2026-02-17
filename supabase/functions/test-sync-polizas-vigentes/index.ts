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

    // Test 1: Probar todos los códigos de reporte disponibles
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: PROBAR TODOS LOS CÓDIGOS DE REPORTE');
    console.log('='.repeat(80));

    const reportCodes = [
      { code: 'H03400', name: 'Pólizas Vigentes', sortField: 'DatDocumentos.FCaptura DESC' },
      { code: 'H03410', name: 'Documentos por ID', sortField: 'DatDocumentos.FCaptura DESC' },
      { code: 'H02761', name: 'Renovaciones', sortField: 'DatDocumentos.FDesde DESC' },
      { code: 'H03430_001', name: 'Cobranza con Filtros', sortField: 'DatDocumentos.FCaptura DESC' },
      { code: 'H03420', name: 'Comisiones Pagadas', sortField: 'DatDocumentos.FCaptura DESC' },
      { code: 'H03421', name: 'Comisiones Pendientes', sortField: 'DatDocumentos.FCaptura DESC' },
      // Códigos adicionales comunes
      { code: 'H03117', name: 'Producción General', sortField: 'DatDocumentos.FCaptura DESC' },
      { code: 'H03118', name: 'Producción Alternativa', sortField: 'DatDocumentos.FCaptura DESC' },
    ];

    const testResults = [];

    for (const report of reportCodes) {
      console.log(`\n🔍 Probando ${report.name} (${report.code})...`);

      try {
        const result = await client.executeReport({
          keyCode: report.code,
          page: 1,
          itemsPerPage: 5,
          sortField: report.sortField,
          filters: [],
        });

        const testData = {
          code: report.code,
          name: report.name,
          success: result.success,
          responseNbr: result.responseNbr,
          message: result.message,
          registros: result.records.length,
          muestra: result.records.length > 0 ? result.records[0] : null,
        };

        testResults.push(testData);

        console.log(`  ✅ Success: ${result.success}`);
        console.log(`  📊 Registros: ${result.records.length}`);
        console.log(`  📝 Message: ${result.message}`);

        if (result.records.length > 0) {
          console.log(`  ✨ ESTE CÓDIGO TIENE DATOS!`);
        }

      } catch (error: any) {
        console.log(`  ❌ Error: ${error.message}`);
        testResults.push({
          code: report.code,
          name: report.name,
          success: false,
          responseNbr: '-1',
          message: error.message,
          registros: 0,
          muestra: null,
        });
      }
    }

    // Encontrar códigos que funcionan
    const codigosConDatos = testResults.filter(r => r.registros > 0);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN DE CÓDIGOS DE REPORTE');
    console.log('='.repeat(80));
    console.log(`✅ Códigos con datos: ${codigosConDatos.length}`);
    console.log(`❌ Códigos sin datos: ${testResults.length - codigosConDatos.length}`);

    if (codigosConDatos.length > 0) {
      console.log('\n🎯 CÓDIGOS DISPONIBLES CON DATOS:');
      codigosConDatos.forEach(c => {
        console.log(`  - ${c.code}: ${c.name} (${c.registros} registros)`);
      });
    }

    // Usar el mejor código disponible para tests adicionales
    const mejorCodigo = codigosConDatos.length > 0
      ? codigosConDatos[0].code
      : SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES;

    const result1 = codigosConDatos.length > 0
      ? testResults.find(r => r.code === mejorCodigo)!
      : testResults.find(r => r.code === SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES)!;

    // Test 2: Con filtros (solo si encontramos un código con datos)
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Consulta CON FILTROS (usando mejor código disponible)');
    console.log('='.repeat(80));

    let result2;
    if (codigosConDatos.length > 0) {
      console.log(`Usando código: ${mejorCodigo}`);

      const filters = [
        SicasSoapReportClient.createStatusVicenteFilter(),
        SicasSoapReportClient.createDocumentTypeFilter(),
      ];

      result2 = await client.executeReport({
        keyCode: mejorCodigo,
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
    } else {
      console.log('⚠️ No se encontraron códigos con datos, omitiendo test con filtros');
      result2 = { success: false, responseNbr: '-1', message: 'No hay datos', records: [] };
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
      codigos_probados: testResults,
      codigos_con_datos: codigosConDatos.map(c => ({
        code: c.code,
        name: c.name,
        registros: c.registros,
      })),
      mejor_codigo: mejorCodigo,
      test_sin_filtros: {
        success: result1.success,
        registros: result1.registros,
        responseNbr: result1.responseNbr,
        message: result1.message,
      },
      test_con_filtros: {
        success: result2.success,
        registros: result2.records?.length || 0,
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
    if (codigosConDatos.length === 0) {
      diagnostico.problema_detectado = 'Ningún código de reporte devuelve datos';
      diagnostico.solucion_sugerida = `Se probaron ${reportCodes.length} códigos diferentes. Posibles causas: (1) No hay pólizas en el sistema, (2) Tu usuario no tiene permisos para estos reportes, (3) Verifica con SICAS qué códigos de reporte tienes disponibles`;
    } else if (codigosConDatos.length > 0 && result2.records.length === 0) {
      diagnostico.problema_detectado = 'Los filtros están eliminando todos los registros';
      diagnostico.solucion_sugerida = `Usa el código ${mejorCodigo} sin filtros o ajusta los filtros de estatus/tipo de documento`;
    } else {
      diagnostico.problema_detectado = null;
      diagnostico.solucion_sugerida = `Todo funciona correctamente. Usa el código ${mejorCodigo} para la sincronización de producción`;
    }

    console.log('\n📊 DIAGNÓSTICO FINAL:');
    console.log(JSON.stringify(diagnostico, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        diagnostico,
        resultados: {
          todos_codigos: testResults,
          mejor_resultado: codigosConDatos.length > 0 ? {
            code: mejorCodigo,
            registros: result1.registros,
            muestra: result1.muestra,
          } : null,
          con_filtros: {
            registros: result2.records?.length || 0,
            muestra: result2.records?.slice(0, 2) || [],
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
