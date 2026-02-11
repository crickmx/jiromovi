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

interface VendorProductionRecord {
  vend_nombre: string;
  vend_nombre_normalized: string;
  movi_user_id: string | null;
  movi_user_name: string | null;
  oficina_nombre: string | null;
  match_method: 'direct_name' | 'mapping_name' | 'none';
  total_records: number;
  total_importe_pesos: number;
  total_prima_convenio: number;
  total_prima_ponderada: number;
  total_bono: number;
}

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
  vend_nombre: string;
}

/**
 * Consulta el reporte de pólizas vigentes H03117 desde SICAS
 */
async function consultarProduccionSICAS(
  page: number = 1,
  itemsPerPage: number = 100,
  vendorFilter?: string
): Promise<ProductionDetail[]> {
  console.log(`[SICAS] Consultando producción - Página ${page}, Items: ${itemsPerPage}`);

  // Construir filtro si se especifica vendedor
  let conditionsAdd = '';
  if (vendorFilter) {
    // Filtrar por nombre de vendedor normalizado
    conditionsAdd = `<ConditionsAdd>DatDocumentos.Vendedor LIKE '%${vendorFilter}%'</ConditionsAdd>`;
  }

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
  console.log('[SICAS] Response recibido, parseando...');

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

  // Los registros vienen en formato DatDocumentos
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
      vend_nombre: extractField('Vendedor') || extractField('NombreVendedor'),
    });
  }

  console.log(`[SICAS] Parseados ${records.length} registros de producción`);
  return records;
}

/**
 * Agrupa y procesa los registros por vendedor aplicando el mapeo de usuarios
 */
async function procesarProduccionPorVendedor(
  supabase: any,
  records: ProductionDetail[]
): Promise<VendorProductionRecord[]> {
  console.log('[SICAS] Procesando producción por vendedor...');

  // Obtener mapeos de vendedores
  const { data: mappings, error: mappingError } = await supabase
    .from('sicas_mapeo_vendedores')
    .select('vend_nombre, usuario_id, usuarios(id, nombre_completo, oficina_id, oficinas(nombre))');

  if (mappingError) {
    console.error('[SICAS] Error al obtener mapeos:', mappingError);
  }

  const mappingMap = new Map<string, any>();
  if (mappings) {
    for (const mapping of mappings) {
      const vendNormalized = mapping.vend_nombre.toLowerCase().trim();
      mappingMap.set(vendNormalized, mapping);
    }
  }

  // Normalizar nombre de vendedor
  const normalizar = (nombre: string): string => {
    return nombre
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  // Agrupar por vendedor
  const vendorMap = new Map<string, {
    vend_nombre: string;
    records: ProductionDetail[];
    mapping: any;
  }>();

  for (const record of records) {
    if (!record.vend_nombre) continue;

    const vendNormalized = normalizar(record.vend_nombre);

    if (!vendorMap.has(vendNormalized)) {
      const mapping = mappingMap.get(vendNormalized);
      vendorMap.set(vendNormalized, {
        vend_nombre: record.vend_nombre,
        records: [],
        mapping: mapping || null,
      });
    }

    vendorMap.get(vendNormalized)!.records.push(record);
  }

  // Construir resultado final
  const result: VendorProductionRecord[] = [];

  for (const [vendNormalized, data] of vendorMap.entries()) {
    const totalImporte = data.records.reduce((sum, r) => sum + r.importe_pesos, 0);
    const totalConvenio = data.records.reduce((sum, r) => sum + r.prima_convenio, 0);
    const totalPonderada = data.records.reduce((sum, r) => sum + r.prima_ponderada, 0);
    const totalBono = data.records.reduce((sum, r) => sum + r.bono, 0);

    result.push({
      vend_nombre: data.vend_nombre,
      vend_nombre_normalized: vendNormalized,
      movi_user_id: data.mapping?.usuario_id || null,
      movi_user_name: data.mapping?.usuarios?.nombre_completo || null,
      oficina_nombre: data.mapping?.usuarios?.oficinas?.nombre || null,
      match_method: data.mapping ? 'mapping_name' : 'none',
      total_records: data.records.length,
      total_importe_pesos: totalImporte,
      total_prima_convenio: totalConvenio,
      total_prima_ponderada: totalPonderada,
      total_bono: totalBono,
    });
  }

  // Ordenar por producción total (importe o convenio, el que sea mayor)
  result.sort((a, b) => {
    const totalA = Math.max(a.total_importe_pesos, a.total_prima_convenio);
    const totalB = Math.max(b.total_importe_pesos, b.total_prima_convenio);
    return totalB - totalA;
  });

  console.log(`[SICAS] Procesados ${result.length} vendedores únicos`);
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener parámetros
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const search = url.searchParams.get('search') || '';
    const mappingStatus = url.searchParams.get('mappingStatus') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'total';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    console.log('[SICAS-Production] Iniciando consulta...');
    console.log('[SICAS-Production] Parámetros:', { page, limit, search, mappingStatus });

    const startTime = Date.now();

    // Consultar SICAS (traer todas las páginas necesarias)
    // Por ahora traemos un lote grande y filtramos en memoria
    const allRecords: ProductionDetail[] = [];
    let currentPage = 1;
    const maxPages = 10; // Límite de seguridad

    while (currentPage <= maxPages) {
      try {
        const pageRecords = await consultarProduccionSICAS(currentPage, 500);
        if (pageRecords.length === 0) break;

        allRecords.push(...pageRecords);
        currentPage++;

        // Si obtuvimos menos registros que el límite, ya no hay más páginas
        if (pageRecords.length < 500) break;
      } catch (error: any) {
        console.error(`[SICAS] Error en página ${currentPage}:`, error.message);
        break;
      }
    }

    console.log(`[SICAS-Production] Total registros obtenidos: ${allRecords.length}`);

    // Procesar y agrupar por vendedor
    const vendors = await procesarProduccionPorVendedor(supabase, allRecords);

    // Aplicar filtros
    let filteredVendors = vendors;

    // Filtro de búsqueda
    if (search) {
      const searchLower = search.toLowerCase();
      filteredVendors = filteredVendors.filter(v =>
        v.vend_nombre.toLowerCase().includes(searchLower) ||
        (v.movi_user_name && v.movi_user_name.toLowerCase().includes(searchLower))
      );
    }

    // Filtro de estado de mapeo
    if (mappingStatus === 'mapped') {
      filteredVendors = filteredVendors.filter(v => v.movi_user_id !== null);
    } else if (mappingStatus === 'unmapped') {
      filteredVendors = filteredVendors.filter(v => v.movi_user_id === null);
    }

    // Ordenamiento
    if (sortBy === 'name') {
      filteredVendors.sort((a, b) => {
        const nameA = a.movi_user_name || a.vend_nombre;
        const nameB = b.movi_user_name || b.vend_nombre;
        return sortOrder === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'records') {
      filteredVendors.sort((a, b) => {
        return sortOrder === 'asc'
          ? a.total_records - b.total_records
          : b.total_records - a.total_records;
      });
    }
    // El ordenamiento por 'total' ya está aplicado por defecto

    // Paginación
    const totalVendors = filteredVendors.length;
    const totalPages = Math.ceil(totalVendors / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

    const duration = Date.now() - startTime;

    console.log(`[SICAS-Production] Procesamiento completado en ${duration}ms`);
    console.log(`[SICAS-Production] Vendedores totales: ${totalVendors}, Retornando: ${paginatedVendors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        vendors: paginatedVendors,
        pagination: {
          page,
          limit,
          total: totalVendors,
          totalPages,
        },
        metadata: {
          last_fetched_at: new Date().toISOString(),
          last_fetch_duration_ms: duration,
          total_records: allRecords.length,
          total_vendors: totalVendors,
          source: 'SICAS Web Service',
          report_code: 'H03117',
        },
        performance: {
          duration_ms: duration,
          sicas_records: allRecords.length,
          unique_vendors: totalVendors,
          returned_vendors: paginatedVendors.length,
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
    console.error('[SICAS-Production] Error:', error);
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
