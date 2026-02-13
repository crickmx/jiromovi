import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_ENDPOINT = 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';
const SICAS_USERNAME = Deno.env.get('SICAS_USERNAME') || 'j1r0%25$';
const SICAS_PASSWORD = Deno.env.get('SICAS_PASSWORD') || '$45oc14d05$';

interface PolizaVigente {
  id_documento: string;
  no_poliza: string | null;
  vend_id: string;
  vend_nombre: string | null;
  desp_id: string | null;
  desp_nombre: string | null;
  aseguradora: string | null;
  ramo: string | null;
  subramo: string | null;
  contratante: string | null;
  asegurado: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  prima_neta: number | null;
  prima_total: number | null;
}

/**
 * Consulta el reporte de pólizas vigentes H03117 desde SICAS
 */
async function consultarPolizasVigentesSICAS(
  page: number = 1,
  itemsPerPage: number = 100
): Promise<PolizaVigente[]> {
  console.log(`[SICAS] Consultando pólizas vigentes - Página ${page}`);

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
  if (!responseNbrMatch || responseNbrMatch[1] === '0') {
    const message = resultContent.match(/<MESSAGE>(.*?)<\/MESSAGE>/)?.[1] || 'Sin mensaje';
    throw new Error(`SICAS RESPONSENBR=0: ${message}`);
  }

  // Parsear los registros de pólizas
  const polizas: PolizaVigente[] = [];
  const docRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
  let match;

  while ((match = docRegex.exec(resultContent)) !== null) {
    const docContent = match[1];

    const extractField = (fieldName: string): string | null => {
      const fieldMatch = docContent.match(new RegExp(`<${fieldName}>(.*?)<\/${fieldName}>`));
      return fieldMatch ? fieldMatch[1] : null;
    };

    const extractNumber = (fieldName: string): number | null => {
      const value = extractField(fieldName);
      return value ? parseFloat(value) : null;
    };

    const idDocumento = extractField('IdDocumento') || extractField('IdCaptura');
    const vendId = extractField('IdVendedor') || extractField('VendedorId');

    if (!idDocumento || !vendId) {
      console.warn('[SICAS] Registro sin IdDocumento o VendedorId, omitiendo...');
      continue;
    }

    polizas.push({
      id_documento: idDocumento,
      no_poliza: extractField('NoPoliza') || extractField('Poliza'),
      vend_id: vendId,
      vend_nombre: extractField('Vendedor') || extractField('NombreVendedor'),
      desp_id: extractField('IdDespacho') || extractField('DespachoId'),
      desp_nombre: extractField('Despacho') || extractField('Oficina'),
      aseguradora: extractField('Aseguradora') || extractField('Compania'),
      ramo: extractField('Ramo'),
      subramo: extractField('SubRamo'),
      contratante: extractField('Contratante') || extractField('Cliente'),
      asegurado: extractField('Asegurado'),
      vigencia_desde: extractField('VigenciaDesde') || extractField('FDesde'),
      vigencia_hasta: extractField('VigenciaHasta') || extractField('FHasta'),
      prima_neta: extractNumber('PrimaNeta') || extractNumber('ImporteNeto'),
      prima_total: extractNumber('PrimaTotal') || extractNumber('Importe'),
    });
  }

  console.log(`[SICAS] Parseadas ${polizas.length} pólizas`);
  return polizas;
}

/**
 * Guarda las pólizas en la tabla de caché
 */
async function guardarPolizasCache(
  supabase: any,
  polizas: PolizaVigente[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  console.log(`[Cache] Guardando ${polizas.length} pólizas...`);

  // Procesar en lotes de 100
  const batchSize = 100;
  for (let i = 0; i < polizas.length; i += batchSize) {
    const batch = polizas.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from('sicas_polizas_vigentes')
        .upsert(
          batch.map(p => ({
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
        console.error('[Cache] Error en lote:', error);
        errors += batch.length;
      } else {
        // Asumimos que todos se insertaron/actualizaron
        inserted += batch.length;
      }
    } catch (error: any) {
      console.error('[Cache] Error procesando lote:', error.message);
      errors += batch.length;
    }
  }

  console.log(`[Cache] Guardado completado: ${inserted} exitosos, ${errors} errores`);
  return { inserted, updated, errors };
}

/**
 * Registra el historial de sincronización
 */
async function registrarSyncLog(
  supabase: any,
  status: string,
  stats: {
    records_fetched: number;
    records_inserted: number;
    records_updated: number;
    records_errors: number;
  },
  startedAt: Date,
  errorMessage?: string
) {
  await supabase
    .from('sicas_production_sync_log')
    .insert({
      sync_type: 'polizas_vigentes',
      status,
      records_fetched: stats.records_fetched,
      records_inserted: stats.records_inserted,
      records_updated: stats.records_updated,
      records_errors: stats.records_errors,
      error_message: errorMessage || null,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      metadata: {
        report_code: 'H03117',
        source: 'SICAS Web Service',
      },
    });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startedAt = new Date();

  try {
    // Inicializar Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parámetros opcionales
    const url = new URL(req.url);
    const maxPages = parseInt(url.searchParams.get('maxPages') || '5');
    const itemsPerPage = parseInt(url.searchParams.get('itemsPerPage') || '200');

    console.log('[Sync] Iniciando sincronización de pólizas vigentes...');
    console.log('[Sync] Parámetros:', { maxPages, itemsPerPage });

    const allPolizas: PolizaVigente[] = [];
    let currentPage = 1;

    // Consultar todas las páginas
    while (currentPage <= maxPages) {
      try {
        const pagePolizas = await consultarPolizasVigentesSICAS(currentPage, itemsPerPage);

        if (pagePolizas.length === 0) {
          console.log(`[Sync] Página ${currentPage} sin resultados, finalizando...`);
          break;
        }

        allPolizas.push(...pagePolizas);
        console.log(`[Sync] Página ${currentPage}: ${pagePolizas.length} pólizas`);

        currentPage++;

        // Si obtuvimos menos registros que el límite, ya no hay más páginas
        if (pagePolizas.length < itemsPerPage) {
          console.log('[Sync] Última página alcanzada');
          break;
        }
      } catch (error: any) {
        console.error(`[Sync] Error en página ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[Sync] Total pólizas obtenidas: ${allPolizas.length}`);

    // Guardar en caché
    const saveStats = await guardarPolizasCache(supabase, allPolizas);

    // Determinar status final
    const status = saveStats.errors === 0 ? 'success' :
                   saveStats.inserted > 0 ? 'partial' : 'error';

    // Registrar en historial
    await registrarSyncLog(
      supabase,
      status,
      {
        records_fetched: allPolizas.length,
        records_inserted: saveStats.inserted,
        records_updated: saveStats.updated,
        records_errors: saveStats.errors,
      },
      startedAt
    );

    const duration = Date.now() - startedAt.getTime();

    console.log(`[Sync] Completado en ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        stats: {
          records_fetched: allPolizas.length,
          records_inserted: saveStats.inserted,
          records_updated: saveStats.updated,
          records_errors: saveStats.errors,
          pages_processed: currentPage - 1,
        },
        metadata: {
          synced_at: new Date().toISOString(),
          duration_ms: duration,
          report_code: 'H03117',
          source: 'SICAS Web Service',
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
    console.error('[Sync] Error fatal:', error);

    // Registrar error en log
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await registrarSyncLog(
        supabase,
        'error',
        {
          records_fetched: 0,
          records_inserted: 0,
          records_updated: 0,
          records_errors: 0,
        },
        startedAt,
        error.message
      );
    } catch (logError) {
      console.error('[Sync] Error al registrar log:', logError);
    }

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
