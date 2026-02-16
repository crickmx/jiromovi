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

    const SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
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

    // Contar registros
    const recordMatches = xmlContent.match(/<RECORD>/g);
    const recordCount = recordMatches ? recordMatches.length : 0;

    // Extraer PROCESSDATA
    const processDataMatch = xmlContent.match(/<PROCESSDATA>(.*?)<\/PROCESSDATA>/is);
    let responseTxt = '';
    let responseNbr = '';
    let message = '';

    if (processDataMatch) {
      responseTxt = processDataMatch[1].match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] || '';
      responseNbr = processDataMatch[1].match(/<RESPONSENBR>(.*?)<\/RESPONSENBR>/i)?.[1] || '';
      message = processDataMatch[1].match(/<MESSAGE>(.*?)<\/MESSAGE>/i)?.[1] || '';
    }

    const result = {
      success: true,
      testNumber,
      testDescription,
      conditionsAdd: conditionsAdd || '(sin filtros)',
      response: {
        httpStatus: response.status,
        responseTime: `${responseTime}ms`,
        responseTxt,
        responseNbr,
        message,
        recordCount,
      },
      analysis: {
        hasData: recordCount > 0,
        isAvailable: responseTxt === 'SUCESS' && responseNbr === '1',
        isEmpty: responseTxt === 'SUCESS' && responseNbr === '0',
        isDenied: responseTxt === 'DENIED',
        conclusion: recordCount > 0
          ? '✅ FUNCIONA - Filtro devuelve datos'
          : responseTxt === 'SUCESS' && responseNbr === '0'
          ? '⚠️ Reporte sin datos - Filtro puede estar demasiado restrictivo'
          : responseTxt === 'DENIED'
          ? '❌ Acceso denegado - Problema de autenticación'
          : '❌ Error desconocido'
      },
      soapRequest: soapBody,
      rawResponse: decoded.substring(0, 3000),
    };

    console.log('\n--- Análisis ---');
    console.log(JSON.stringify(result.analysis, null, 2));

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
