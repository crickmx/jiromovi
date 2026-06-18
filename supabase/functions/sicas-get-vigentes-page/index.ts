import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
const DEFAULT_SICAS_ENDPOINT = 'https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx';

interface VigentesPageRequest {
  page?: number;
  itemsForPage?: number;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  vendedorId?: string; // ID del vendedor SICAS (opcional)
}

interface VigentesPageResponse {
  ok: boolean;
  report: string;
  page: number;
  itemsForPage: number;
  records: Array<{
    idDocto?: string;
    fecha?: string;
    oficina?: string;
    vendedor?: string;
    aseguradora?: string;
    ramo?: string;
    subramo?: string;
    importe?: string;
    poliza?: string;
    cliente?: string;
    rawRecord?: any;
  }>;
  raw?: {
    responseTxt: string;
    responseNbr: string;
    message: string;
  };
  stage?: string;
  message?: string;
}

/**
 * Función quirúrgica para obtener documentos vigentes de SICAS
 * Paso 1: Obtener 1 página con control total
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let stage = 'INIT';

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const body: VigentesPageRequest = await req.json().catch(() => ({}));
    const page = body.page || 1;
    const itemsForPage = body.itemsForPage || 10;
    const vendedorId = body.vendedorId;

    // Fechas por defecto: últimos 365 días
    const today = new Date();
    const lastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    const toDate = body.toDate || today.toISOString().split('T')[0];
    const fromDate = body.fromDate || lastYear.toISOString().split('T')[0];

    console.log(`[SICAS Vigentes] Solicitando página ${page}, items: ${itemsForPage}`);
    console.log(`[SICAS Vigentes] Rango de fechas: ${fromDate} a ${toDate}`);
    if (vendedorId) {
      console.log(`[SICAS Vigentes] Filtro vendedor: ${vendedorId}`);
    }

    // Obtener configuración SICAS
    stage = 'CONFIG';
    const { data: config } = await supabase
      .from('sicas_config')
      .select('*')
      .single();

    if (!config || !config.sicas_usuario || !config.sicas_password) {
      throw new Error('Configuración SICAS no encontrada o incompleta');
    }

    const sicasUrl = config.endpoint || DEFAULT_SICAS_ENDPOINT;
    const sicasUsuario = config.sicas_usuario;
    const sicasPassword = config.sicas_password;

    // Construir SOAP envelope - MÍNIMO para diagnóstico
    stage = 'BUILD_SOAP';
    const reportCode = 'H03117';

    // Construir filtros opcionales
    const filterSection = vendedorId ? `<VendID>${vendedorId}</VendID>` : '';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>REPORT</KeyProcess>
        <KeyCode>${reportCode}</KeyCode>
        <Page>${page}</Page>
        <ItemForPage>${itemsForPage}</ItemForPage>
        ${filterSection}
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${sicasUsuario}</UserName>
        <Password>${sicasPassword}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    console.log(`[SICAS Vigentes] Enviando SOAP request a: ${sicasUrl}`);

    // Llamar a SICAS
    stage = 'SICAS_REPORT';
    const startTime = Date.now();

    const response = await fetch(sicasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://tempuri.org/ProcesarWS',
      },
      body: soapEnvelope,
    });

    const duration = Date.now() - startTime;
    console.log(`[SICAS Vigentes] Response recibida en ${duration}ms, status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseText = await response.text();
    console.log(`[SICAS Vigentes] Response length: ${responseText.length} bytes`);

    // Parse SOAP
    stage = 'PARSE_SOAP';

    // HTML decode
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    // Extraer ProcesarWSResult
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      throw new Error('No se encontró ProcesarWSResult en el response');
    }

    const resultContent = resultMatch[1];

    // Extraer metadatos de SICAS
    const responseNbrMatch = resultContent.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
    const responseTxtMatch = resultContent.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);
    const messageMatch = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/);

    const sicasRaw = {
      responseNbr: responseNbrMatch?.[1] || 'N/A',
      responseTxt: responseTxtMatch?.[1] || 'N/A',
      message: messageMatch?.[1] || 'N/A',
    };

    console.log(`[SICAS Vigentes] RESPONSENBR: ${sicasRaw.responseNbr}`);
    console.log(`[SICAS Vigentes] RESPONSETXT: ${sicasRaw.responseTxt}`);
    console.log(`[SICAS Vigentes] MESSAGE: ${sicasRaw.message}`);

    // Verificar errores internos de SICAS
    const hasInternalError =
      sicasRaw.message.includes('Error en Ejecución') ||
      sicasRaw.message.includes('Proceso Interno') ||
      sicasRaw.message.includes('Variable de objeto') ||
      sicasRaw.message.toLowerCase().includes('error');

    if (hasInternalError) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage: 'SICAS_REPORT',
          message: `Error interno de SICAS: ${sicasRaw.message}`,
          raw: sicasRaw,
        } as VigentesPageResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse dataset
    stage = 'PARSE_DATASET';

    // Buscar la tabla de datos (puede ser DatDocumentos, Table, o NewDataSet)
    const tableRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    const records: any[] = [];

    // Buscar específicamente DatDocumentos
    const datDocumentosRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
    let match;

    while ((match = datDocumentosRegex.exec(resultContent)) !== null) {
      const recordXml = match[1];

      // Extraer campos del registro
      const extractField = (fieldName: string): string | undefined => {
        const regex = new RegExp(`<${fieldName}>([^<]*)<\/${fieldName}>`, 'i');
        const match = recordXml.match(regex);
        return match ? match[1].trim() : undefined;
      };

      const record = {
        idDocto: extractField('IDDocto') || extractField('ID') || extractField('IdDocumento'),
        fecha: extractField('Fecha') || extractField('FechaCaptura') || extractField('FechaEmision'),
        oficina: extractField('DespNombre') || extractField('Oficina') || extractField('Despacho'),
        vendedor: extractField('VendNombre') || extractField('Vendedor'),
        aseguradora: extractField('CompaniaNombre') || extractField('Aseguradora') || extractField('Compania'),
        ramo: extractField('RamosNombre') || extractField('Ramo'),
        subramo: extractField('SubRamo') || extractField('Subramo'),
        importe: extractField('Importe') || extractField('PrimaTotal') || extractField('Prima'),
        poliza: extractField('Poliza') || extractField('NumPoliza'),
        cliente: extractField('Asegurado') || extractField('Cliente'),
        rawRecord: recordXml, // Guardar el XML crudo para análisis
      };

      records.push(record);
    }

    console.log(`[SICAS Vigentes] Registros parseados: ${records.length}`);

    // Si no hay registros pero tampoco error, verificar si el dataset está vacío
    if (records.length === 0 && !hasInternalError) {
      const hasNewDataSet = /<NewDataSet>/i.test(resultContent);
      const hasDatDocumentos = /<DatDocumentos>/i.test(resultContent);

      if (!hasNewDataSet && !hasDatDocumentos) {
        return new Response(
          JSON.stringify({
            ok: false,
            stage: 'PARSE_DATASET',
            message: 'El reporte no devolvió dataset. Puede ser configuración o permisos.',
            raw: sicasRaw,
            debug: {
              resultPreview: resultContent.substring(0, 1000),
            },
          } as VigentesPageResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Respuesta exitosa
    const successResponse: VigentesPageResponse = {
      ok: true,
      report: reportCode,
      page,
      itemsForPage,
      records,
      raw: sicasRaw,
    };

    console.log(`[SICAS Vigentes] ✅ Éxito: ${records.length} registros obtenidos`);

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error(`[SICAS Vigentes] ❌ Error en stage: ${stage}`, error);

    const errorResponse: VigentesPageResponse = {
      ok: false,
      stage,
      message: error.message || 'Error desconocido',
      report: 'H03117',
      page: 1,
      itemsForPage: 10,
      records: [],
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
