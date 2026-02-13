import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

interface PolizaBasica {
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  contratante: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_total: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[SICAS Basic] Iniciando sincronización básica...');

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener credenciales SICAS
    const { data: config } = await supabase
      .from('sicas_config')
      .select('sicas_usuario, sicas_password')
      .single();

    if (!config || !config.sicas_usuario || !config.sicas_password) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    console.log('[SICAS Basic] Credenciales obtenidas');

    // Consultar tabla Documentos directamente con SQL
    const sqlQuery = `
      SELECT TOP 500
        IdCaptura as id_documento,
        NoPoliza as no_poliza,
        IdVendedor as vend_id,
        (SELECT Nombre FROM Vendedores WHERE IdVendedor = Documentos.IdVendedor) as vend_nombre,
        IdDespacho as desp_id,
        (SELECT Nombre FROM Despachos WHERE IdDespacho = Documentos.IdDespacho) as desp_nombre,
        (SELECT Nombre FROM Aseguradoras WHERE IdAseguradora = Documentos.IdAseguradora) as aseguradora,
        (SELECT Nombre FROM Ramos WHERE IdRamo = Documentos.IdRamo) as ramo,
        Contratante as contratante,
        VigenciaDesde as vigencia_desde,
        VigenciaHasta as vigencia_hasta,
        Importe as prima_total
      FROM Documentos
      WHERE VigenciaHasta >= GETDATE()
      AND Estatus = 'Vigente'
      ORDER BY FCaptura DESC
    `;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ProcesarWS xmlns="http://tempuri.org/">
      <wsProcesarData>
        <KeyProcess>QUERY</KeyProcess>
        <SQLSentence><![CDATA[${sqlQuery}]]></SQLSentence>
      </wsProcesarData>
      <wsAuthConfig>
        <UserName>${config.sicas_usuario}</UserName>
        <Password>${config.sicas_password}</Password>
      </wsAuthConfig>
    </ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

    console.log('[SICAS Basic] Enviando consulta SQL...');

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
    console.log('[SICAS Basic] Respuesta recibida, parseando...');

    // Decodificar entidades HTML
    const decoded = responseText
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');

    // Extraer el contenido XML
    const resultMatch = decoded.match(/<ProcesarWSResult>([\s\S]*?)<\/ProcesarWSResult>/);
    if (!resultMatch) {
      throw new Error('No se encontró ProcesarWSResult en la respuesta');
    }

    const xmlContent = resultMatch[1];

    // Buscar errores
    const errorMatch = xmlContent.match(/<Error>([\s\S]*?)<\/Error>/);
    if (errorMatch && errorMatch[1].trim()) {
      throw new Error(`SICAS Error: ${errorMatch[1]}`);
    }

    // Extraer registros
    const polizas: PolizaBasica[] = [];
    const recordMatches = xmlContent.matchAll(/<Record>([\s\S]*?)<\/Record>/g);

    for (const match of recordMatches) {
      const recordXml = match[1];

      const getField = (fieldName: string): string | null => {
        const regex = new RegExp(`<${fieldName}>(.*?)</${fieldName}>`, 'i');
        const match = recordXml.match(regex);
        return match ? match[1].trim() || null : null;
      };

      const poliza: PolizaBasica = {
        id_documento: getField('id_documento') || `DOC_${Date.now()}_${Math.random()}`,
        no_poliza: getField('no_poliza'),
        vend_id: getField('vend_id') || '0',
        vend_nombre: getField('vend_nombre'),
        desp_id: getField('desp_id'),
        desp_nombre: getField('desp_nombre'),
        aseguradora: getField('aseguradora'),
        ramo: getField('ramo'),
        contratante: getField('contratante'),
        vigencia_desde: getField('vigencia_desde'),
        vigencia_hasta: getField('vigencia_hasta'),
        prima_total: parseFloat(getField('prima_total') || '0') || null,
      };

      polizas.push(poliza);
    }

    console.log(`[SICAS Basic] ${polizas.length} pólizas extraídas`);

    if (polizas.length === 0) {
      throw new Error('No se obtuvieron pólizas. Verifica que existan documentos vigentes en SICAS.');
    }

    // Guardar en base de datos
    console.log('[SICAS Basic] Guardando en base de datos...');

    const { error } = await supabase
      .from('sicas_polizas_vigentes')
      .upsert(
        polizas.map(p => ({
          ...p,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'id_documento',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('[SICAS Basic] Error guardando:', error);
      throw new Error(`Error guardando en DB: ${error.message}`);
    }

    console.log(`[SICAS Basic] ✅ ${polizas.length} pólizas guardadas`);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          records_fetched: polizas.length,
          records_inserted: polizas.length,
          method: 'SQL Direct Query',
        },
        metadata: {
          synced_at: new Date().toISOString(),
          source: 'SICAS SOAP SQL',
        },
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
    console.error('[SICAS Basic] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
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
