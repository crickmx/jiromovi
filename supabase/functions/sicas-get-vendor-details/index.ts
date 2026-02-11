import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
const SICAS_USERNAME = Deno.env.get('SICAS_USERNAME') || 'j1r0%25$';
const SICAS_PASSWORD = Deno.env.get('SICAS_PASSWORD') || '$45oc14d05$';

interface ProductionDetail {
  fecha: string;
  periodo_mes: string;
  desp_nombre_raw: string;
  gerencia_nombre_raw: string;
  region_raw: string | null;
  aseguradora_nombre: string;
  ramo_nombre: string;
  subramo_nombre: string | null;
  importe_pesos: number;
  prima_convenio: number;
  prima_ponderada: number;
  bono: number;
  convenio_flag: boolean;
}

/**
 * Consulta los detalles de producción de un vendedor específico desde SICAS
 */
async function consultarDetallesVendedor(
  vendNombre: string,
  page: number = 1,
  itemsPerPage: number = 500
): Promise<ProductionDetail[]> {
  console.log(`[SICAS-Details] Consultando detalles para vendedor: ${vendNombre}`);

  // Filtrar por nombre de vendedor
  const conditionsAdd = `<ConditionsAdd>DatDocumentos.Vendedor LIKE '%${vendNombre}%'</ConditionsAdd>`;

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>H03117</KeyCode>
        <Page>${page}</Page>
        <ItemForPage>${itemsPerPage}</ItemForPage>
        <InfoSort>DatDocumentos.FCaptura DESC</InfoSort>
        ${conditionsAdd}
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${SICAS_USERNAME}</UserName>
        <Password>${SICAS_PASSWORD}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(SICAS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://tempuri.org/ProcesarWS',
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    throw new Error(`SICAS HTTP Error: ${response.status}`);
  }

  const responseText = await response.text();

  // Decodificar entidades HTML
  const decoded = responseText
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  // Extraer el contenido del resultado
  const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
  if (!resultMatch) {
    throw new Error('No se pudo extraer ProcesarWSResult del response');
  }

  const resultContent = resultMatch[1];

  // Verificar estado del proceso
  const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
  const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);

  if (!responseNbrMatch || responseNbrMatch[1] === '0') {
    const message = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/)?.[1] || 'Sin mensaje';
    throw new Error(`SICAS RESPONSENBR=0: ${message}`);
  }

  if (responseTxtMatch && responseTxtMatch[1] === 'DENIED') {
    throw new Error('SICAS: Acceso denegado - verificar credenciales');
  }

  // Parsear los registros de producción
  const records: ProductionDetail[] = [];
  const docRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
  let match;

  while ((match = docRegex.exec(resultContent)) !== null) {
    const docContent = match[1];

    const extractField = (fieldName: string): string => {
      const fieldMatch = docContent.match(new RegExp(`<${fieldName}>(.*?)<\/${fieldName}>`));
      return fieldMatch ? fieldMatch[1] : '';
    };

    const extractNumber = (fieldName: string): number => {
      const value = extractField(fieldName);
      return value ? parseFloat(value) : 0;
    };

    records.push({
      fecha: extractField('FCaptura') || extractField('Fecha'),
      periodo_mes: extractField('PeriodoMes') || new Date(extractField('FCaptura')).toISOString().slice(0, 7),
      desp_nombre_raw: extractField('Despacho') || extractField('Oficina'),
      gerencia_nombre_raw: extractField('Gerencia') || '',
      region_raw: extractField('Region') || null,
      aseguradora_nombre: extractField('Aseguradora') || extractField('Compania'),
      ramo_nombre: extractField('Ramo'),
      subramo_nombre: extractField('SubRamo') || null,
      importe_pesos: extractNumber('ImportePesos') || extractNumber('Importe'),
      prima_convenio: extractNumber('PrimaConvenio') || extractNumber('Prima'),
      prima_ponderada: extractNumber('PrimaPonderada') || 0,
      bono: extractNumber('Bono') || 0,
      convenio_flag: extractField('TipoConvenio') === '1' || extractField('Convenio') === 'Si',
    });
  }

  console.log(`[SICAS-Details] Parseados ${records.length} registros`);
  return records;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const vendNombre = url.searchParams.get('vendNombre');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    if (!vendNombre) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parámetro vendNombre es requerido',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`[SICAS-Details] Consultando detalles para: ${vendNombre}`);
    const startTime = Date.now();

    // Consultar SICAS
    const records = await consultarDetallesVendedor(vendNombre, page, limit);

    const duration = Date.now() - startTime;

    console.log(`[SICAS-Details] Consulta completada en ${duration}ms`);
    console.log(`[SICAS-Details] Registros obtenidos: ${records.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        records,
        pagination: {
          page,
          limit,
          total: records.length,
        },
        metadata: {
          vend_nombre: vendNombre,
          fetched_at: new Date().toISOString(),
          duration_ms: duration,
          source: 'SICAS Web Service',
          report_code: 'H03117',
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
    console.error('[SICAS-Details] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
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
