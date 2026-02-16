import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestRequest {
  testNumber: number; // 1-5
  customFilters?: string; // Para probar manualmente
}

interface FilterCondition {
  name: string;
  type: 0 | 1 | 2 | 3;
  subtype: number;
  values: string[];
  texts: string[];
  flag1: number;
  flag2?: number;
  fieldDb: string;
}

function buildConditionsAdd(filters: FilterCondition[]): string {
  if (!filters || filters.length === 0) return '';

  return filters.map(f => {
    const valuesStr = f.values.join('|');
    const textsStr = f.texts.join('|');
    const flag2Str = f.flag2 !== undefined ? `;${f.flag2}` : '';
    return `${f.name};${f.type};${f.subtype};${valuesStr};${textsStr};${f.flag1}${flag2Str};${f.fieldDb}`;
  }).join('!');
}

function buildSoapRequest(keyCode: string, conditionsAdd: string, page = 1, itemsPerPage = 10): string {
  const username = 'W4sP3r';
  const password = 'wA5P3R%202020';
  const sortField = 'DatDocumentos.FCaptura DESC'; // Ordenar por fecha de captura

  const sortFieldXml = sortField ? `<tem:InfoSort>${sortField}</tem:InfoSort>` : '';
  const conditionsXml = conditionsAdd ? `<tem:ConditionsAdd>${conditionsAdd}</tem:ConditionsAdd>` : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${username}</tem:UserName>
          <tem:Password>${password}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>${keyCode}</tem:KeyCode>
        <tem:Page>${page}</tem:Page>
        <tem:ItemForPage>${itemsPerPage}</tem:ItemForPage>
        ${sortFieldXml}
        ${conditionsXml}
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { testNumber, customFilters }: TestRequest = await req.json();

    const SICAS_ENDPOINT = Deno.env.get('SICAS_SOAP_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';
    const keyCode = 'H03400'; // Pólizas vigentes

    let conditionsAdd = '';
    let testDescription = '';

    // Fechas con horas (formato del ejemplo oficial)
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const formatDate = (date: Date, withTime: boolean = true): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      if (withTime) {
        return `${day}/${month}/${year} 00:00`;
      }
      return `${day}/${month}/${year}`;
    };

    const formatDateEnd = (date: Date): string => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year} 23:59:59`;
    };

    const dateFromWithTime = formatDate(oneYearAgo, true);
    const dateToWithTime = formatDateEnd(today);
    const dateFromText = formatDate(oneYearAgo, false);
    const dateToText = formatDate(today, false);

    switch (testNumber) {
      case 1:
        // TEST 1: Sin filtros (baseline)
        conditionsAdd = '';
        testDescription = 'Sin filtros - Si aquí da 0, problema es permisos/reporte';
        break;

      case 2:
        // TEST 2: Solo TipoDocto (Pólizas)
        // Siguiendo el ejemplo oficial: orden de flags puede ser crítico
        const filters2: FilterCondition[] = [{
          name: 'Documentos',
          type: 2,
          subtype: 0,
          values: ['1'],
          texts: ['Polizas'],
          flag1: -1,
          flag2: 0,
          fieldDb: 'DatDocumentos.TipoDocto'
        }];
        conditionsAdd = buildConditionsAdd(filters2);
        testDescription = 'Solo TipoDocto=Pólizas - Valida que el filtro de tipo funciona';
        break;

      case 3:
        // TEST 3: TipoDocto + Estatus
        const filters3: FilterCondition[] = [
          {
            name: 'Estatus',
            type: 0,
            subtype: 0,
            values: ['0'],
            texts: ['Vigentes'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.Status'
          },
          {
            name: 'Documentos',
            type: 2,
            subtype: 0,
            values: ['1'],
            texts: ['Polizas'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.TipoDocto'
          }
        ];
        conditionsAdd = buildConditionsAdd(filters3);
        testDescription = 'Estatus + TipoDocto - Si falla aquí, problema es combinación de filtros';
        break;

      case 4:
        // TEST 4A: Todo + Fecha por FCAPTURA (como el ejemplo oficial)
        const filters4a: FilterCondition[] = [
          {
            name: 'Estatus',
            type: 0,
            subtype: 0,
            values: ['0'],
            texts: ['Vigentes'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.Status'
          },
          {
            name: 'Documentos',
            type: 2,
            subtype: 0,
            values: ['1'],
            texts: ['Polizas'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.TipoDocto'
          },
          {
            name: 'Desde|Hasta|Captura', // ⚠️ Nombre cambiado para reflejar que filtra por captura
            type: 3,
            subtype: 1,
            values: [dateFromWithTime, dateToWithTime], // ⚠️ Con horas como en el ejemplo
            texts: [dateFromText, dateToText],
            flag1: 0,
            flag2: -1, // ⚠️ Flags invertidos como en el ejemplo (0;-1 en lugar de -1;0)
            fieldDb: 'DatDocumentos.FCaptura' // ⚠️ FCAPTURA en lugar de FDesde
          }
        ];
        conditionsAdd = buildConditionsAdd(filters4a);
        testDescription = `Estatus + TipoDocto + Fecha CAPTURA (${dateFromText} - ${dateToText}) con horas - Formato del ejemplo oficial`;
        break;

      case 5:
        // TEST 4B: Todo + Fecha por FDESDE (vigencia)
        const filters4b: FilterCondition[] = [
          {
            name: 'Estatus',
            type: 0,
            subtype: 0,
            values: ['0'],
            texts: ['Vigentes'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.Status'
          },
          {
            name: 'Documentos',
            type: 2,
            subtype: 0,
            values: ['1'],
            texts: ['Polizas'],
            flag1: -1,
            flag2: 0,
            fieldDb: 'DatDocumentos.TipoDocto'
          },
          {
            name: 'Desde|Hasta|Desde',
            type: 3,
            subtype: 1,
            values: [dateFromWithTime, dateToWithTime], // Con horas
            texts: [dateFromText, dateToText],
            flag1: 0,
            flag2: -1, // Flags invertidos
            fieldDb: 'DatDocumentos.FDesde' // FDesde (vigencia)
          }
        ];
        conditionsAdd = buildConditionsAdd(filters4b);
        testDescription = `Estatus + TipoDocto + Fecha VIGENCIA (${dateFromText} - ${dateToText}) con horas`;
        break;

      default:
        throw new Error('testNumber debe ser 1-5');
    }

    // Permitir custom filters para testing manual
    if (customFilters) {
      conditionsAdd = customFilters;
      testDescription = 'Filtros personalizados';
    }

    const soapBody = buildSoapRequest(keyCode, conditionsAdd, 1, 10);

    console.log(`\n========== TEST ${testNumber} ==========`);
    console.log(`Descripción: ${testDescription}`);
    console.log(`ConditionsAdd: ${conditionsAdd || '(vacío)'}`);
    console.log('\n--- SOAP Request ---');
    console.log(soapBody);

    const startTime = Date.now();
    const response = await fetch(SICAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapBody,
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    console.log('\n--- SOAP Response ---');
    console.log(responseText.substring(0, 2000));

    // Decodificar entidades HTML
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Extraer ProcesarWSResult
    const resultMatch = decoded.match(/<ProcesarWSResult>(.*?)<\/ProcesarWSResult>/is);
    const xmlContent = resultMatch ? resultMatch[1] : '';

    // Extraer PROCESSDATA completo
    const processDataMatch = xmlContent.match(/<PROCESSDATA>(.*?)<\/PROCESSDATA>/is);
    const processData: Record<string, string> = {};

    if (processDataMatch) {
      const pdContent = processDataMatch[1];
      processData.RESPONSETXT = pdContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] || '';
      processData.RESPONSENBR = pdContent.match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/i)?.[1] || '';
      processData.MESSAGE = pdContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/i)?.[1] || '';
      processData.TOTALRECORDS = pdContent.match(/<TOTALRECORDS>(.*?)<\/TOTALRECORDS>/i)?.[1] || '';
      processData.PROCESSTIME = pdContent.match(/<PROCESSTIME>(.*?)<\/PROCESSTIME>/i)?.[1] || '';
    }

    // Detectar tabla/dataset
    const newDatasetMatch = xmlContent.match(/<NEWDATASET>(.*?)<\/NEWDATASET>/is);
    const datasetContent = newDatasetMatch ? newDatasetMatch[1] : '';

    // Identificar nombre de tabla (puede ser DatDocumentos, Table, etc.)
    const tableNameMatch = datasetContent.match(/<([A-Z][a-zA-Z0-9_]+)>/);
    const tableName = tableNameMatch ? tableNameMatch[1] : 'RECORD';

    // Contar registros (buscar por nombre de tabla o RECORD genérico)
    const recordPattern = new RegExp(`<${tableName}>`, 'g');
    const recordMatches = datasetContent.match(recordPattern);
    const recordCount = recordMatches ? recordMatches.length : 0;

    // Extraer primer registro completo para análisis
    let firstRecord: Record<string, string> = {};
    if (recordCount > 0) {
      const firstRecordMatch = datasetContent.match(new RegExp(`<${tableName}>(.*?)</${tableName}>`, 'is'));
      if (firstRecordMatch) {
        const recordContent = firstRecordMatch[1];
        // Extraer todos los campos del primer registro
        const fieldMatches = recordContent.matchAll(/<([^>]+)>([^<]*)<\/\1>/g);
        for (const match of fieldMatches) {
          firstRecord[match[1]] = match[2];
        }
      }
    }

    // Análisis detallado
    const hasData = recordCount > 0;
    const isSuccess = processData.RESPONSETXT === 'SUCESS' || processData.RESPONSETXT === 'SUCCESS';
    const isEmpty = isSuccess && (processData.RESPONSENBR === '0' || recordCount === 0);
    const isDenied = processData.RESPONSETXT === 'DENIED';

    const result = {
      success: true,
      testNumber,
      testDescription,
      endpoint: SICAS_ENDPOINT,
      conditionsAdd: conditionsAdd || '(sin filtros)',

      // PROCESSDATA completo
      processData: {
        ...processData,
        note: isEmpty ? 'Reporte sin datos - puede ser filtro restrictivo o catálogo vacío' : ''
      },

      // Dataset info
      datasetInfo: {
        tableName,
        recordCount,
        totalRecordsFromProcess: processData.TOTALRECORDS || 'no especificado',
        rawXmlLength: xmlContent.length,
      },

      // Primer registro de muestra
      firstRecord: hasData ? firstRecord : null,

      // HTTP metadata
      httpMetadata: {
        httpStatus: response.status,
        responseTime: `${responseTime}ms`,
      },

      // Análisis
      analysis: {
        hasData,
        isSuccess,
        isEmpty,
        isDenied,
        conclusion: hasData
          ? `✅ FUNCIONA - ${recordCount} registro(s) encontrado(s)`
          : isEmpty
          ? '⚠️ Reporte sin datos - Filtro puede estar demasiado restrictivo o no hay datos en ese rango'
          : isDenied
          ? '❌ Acceso denegado - Problema de autenticación'
          : `❌ Error: ${processData.RESPONSETXT || 'desconocido'}`
      },

      // Debug info
      debug: {
        soapRequest: soapBody,
        rawResponsePreview: decoded.substring(0, 2000),
      }
    };

    console.log('\n--- Análisis ---');
    console.log(JSON.stringify(result.analysis, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error completo:', error);

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const SICAS_ENDPOINT = Deno.env.get('SICAS_SOAP_ENDPOINT') || 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

    // Detectar tipo de error
    let errorType = 'unknown';
    let diagnosis = '';

    if (errorMessage.includes('UnknownIssuer') || errorMessage.includes('invalid peer certificate')) {
      errorType = 'tls_certificate';
      diagnosis = 'Certificado TLS inválido o cadena incompleta. El servidor no presenta un certificado confiable.';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorType = 'timeout';
      diagnosis = 'Timeout de conexión. El servidor no responde dentro del tiempo esperado.';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection refused')) {
      errorType = 'connection_refused';
      diagnosis = 'Conexión rechazada. El servidor no está escuchando o no es accesible.';
    } else if (errorMessage.includes('DNS') || errorMessage.includes('getaddrinfo')) {
      errorType = 'dns';
      diagnosis = 'Error de resolución DNS. El dominio no se puede resolver.';
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorType,
        diagnosis,
        endpoint: SICAS_ENDPOINT,
        timestamp: new Date().toISOString(),
        suggestion: errorType === 'tls_certificate'
          ? 'Intenta cambiar el endpoint a .com (sin .mx) o contacta al proveedor para arreglar el certificado.'
          : 'Verifica conectividad y configuración del servidor SICAS.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
