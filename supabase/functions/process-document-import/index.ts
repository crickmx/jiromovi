import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { normalizePersonName, buildAgentKey, findBestUserMatch } from '../_shared/nameNormalization.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParsedExcel {
  sheetNameUsed: string;
  headersOriginal: string[];
  headersNormalizedMap: Record<string, string>;
  rows: Record<string, any>[];
  totalRowsRead: number;
  debugInfo: {
    allSheetNames: string[];
    rowCountPerSheet: Record<string, number>;
    detectedColumns: {
      vendNombre?: string;
      documento?: string;
      ramo?: string;
      importe?: string;
      porPart?: string;
      fPago?: string;
    };
  };
}

function normalizeHeader(header: string): string {
  if (!header) return '';
  let normalized = header.toString().trim().toLowerCase();
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.replace(/[\s\-_.]/g, '');
  return normalized;
}

function parseExcelLogExport(fileBuffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  let bestSheet: { name: string; rowCount: number; hasRequiredColumns: boolean } | null = null;
  const rowCountPerSheet: Record<string, number> = {};

  const requiredNormalized = ['vendnombre', 'documento', 'ramo', 'importe', 'porpart'];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const rowCount = jsonData.length;
    rowCountPerSheet[sheetName] = rowCount;

    if (rowCount === 0) continue;

    const firstRow = jsonData[0] as Record<string, any>;
    const headers = Object.keys(firstRow).map(normalizeHeader);
    const hasRequired = requiredNormalized.every(req => headers.includes(req));

    if (!bestSheet || (hasRequired && rowCount > bestSheet.rowCount)) {
      bestSheet = { name: sheetName, rowCount, hasRequiredColumns: hasRequired };
    }
  }

  if (!bestSheet) {
    throw new Error('No se pudo determinar la hoja con datos válidos');
  }

  const sheet = workbook.Sheets[bestSheet.name];
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    blankrows: false
  });

  if (jsonData.length === 0) {
    throw new Error(`La hoja "${bestSheet.name}" no contiene datos`);
  }

  const firstRow = jsonData[0] as Record<string, any>;
  const headersOriginal = Object.keys(firstRow);

  const headersNormalizedMap: Record<string, string> = {};
  for (const header of headersOriginal) {
    const normalized = normalizeHeader(header);
    if (normalized) {
      headersNormalizedMap[normalized] = header;
    }
  }

  const detectedColumns: any = {};
  detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
  detectedColumns.documento = headersNormalizedMap['documento'] || headersNormalizedMap['poliza'];
  detectedColumns.ramo = headersNormalizedMap['ramo'];
  detectedColumns.importe = headersNormalizedMap['importe'];
  detectedColumns.porPart = headersNormalizedMap['porpart'];
  detectedColumns.fPago = headersNormalizedMap['fpago'];

  const rows = jsonData as Record<string, any>[];

  return {
    sheetNameUsed: bestSheet.name,
    headersOriginal,
    headersNormalizedMap,
    rows,
    totalRowsRead: rows.length,
    debugInfo: {
      allSheetNames: sheetNames,
      rowCountPerSheet,
      detectedColumns,
    },
  };
}

function parseNumberMx(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  let str = String(value).trim();

  if (str === '' || str === '-' || str === 'N/A' || str.toLowerCase() === 'na') return null;

  str = str.replace(/\$/g, '');
  str = str.replace(/\s/g, '');
  str = str.replace(/,/g, '');

  if (str.includes('%')) {
    str = str.replace(/%/g, '');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function parseDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(date.getTime())) return date;
  }

  const str = String(value).trim();
  if (!str) return null;

  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      if (pattern.source.startsWith('^(\\d{1,2})')) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
        }
      } else {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }
  }

  return null;
}

async function checkExistingMapping(supabase: any, agentKey: string) {
  const { data, error } = await supabase
    .from('agent_user_mappings')
    .select('matched_user_id, confidence, mapping_source')
    .eq('agent_key', agentKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error checking mapping:', error);
    return null;
  }

  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const batchName = formData.get('batch_name') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó archivo' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Import] Procesando archivo: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const parsed = parseExcelLogExport(arrayBuffer);

    console.log(`[Import] Hoja seleccionada: ${parsed.sheetNameUsed}`);
    console.log(`[Import] Total filas leídas: ${parsed.totalRowsRead}`);
    console.log(`[Import] Columnas detectadas:`, parsed.debugInfo.detectedColumns);

    const { vendNombre, documento, ramo, importe, porPart, fPago } = parsed.debugInfo.detectedColumns;

    if (!vendNombre || !documento || !ramo || !importe || !porPart) {
      const missing = [];
      if (!vendNombre) missing.push('VendNombre');
      if (!documento) missing.push('Documento/Poliza');
      if (!ramo) missing.push('Ramo');
      if (!importe) missing.push('Importe');
      if (!porPart) missing.push('PorPart');

      return new Response(
        JSON.stringify({
          error: `Faltan columnas obligatorias: ${missing.join(', ')}`,
          available_columns: parsed.headersOriginal
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const detectedFormat = 'LOGEXPORT';

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .insert({
        file_name: batchName || file.name,
        imported_by: user.id,
        status: 'processing',
        detected_format: detectedFormat,
        sheet_name_used: parsed.sheetNameUsed,
        headers_json: {
          original: parsed.headersOriginal,
          normalized: Object.keys(parsed.headersNormalizedMap),
          detected: parsed.debugInfo.detectedColumns
        }
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('Error al crear batch:', batchError);
      return new Response(
        JSON.stringify({ error: 'Error al crear lote de importación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Import] Batch creado: ${batch.id}`);
    console.log(`[Import] Procesando ${parsed.rows.length} filas...`);

    const itemsToInsert = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];

      const vendorNameRaw = row[vendNombre]?.toString()?.trim() || '';
      const documentoValue = row[documento]?.toString()?.trim() || '';
      const ramoValue = row[ramo]?.toString()?.trim() || '';
      const importeValue = parseNumberMx(row[importe]);
      const porPartValue = parseNumberMx(row[porPart]);

      const warnings: string[] = [];
      let status: 'valid' | 'warning' | 'discard' = 'valid';
      let discardReason: string | null = null;

      if (!documentoValue) {
        status = 'discard';
        discardReason = 'Documento vacío';
      } else if (!ramoValue) {
        status = 'discard';
        discardReason = 'Ramo vacío';
      } else if (importeValue === null) {
        status = 'discard';
        discardReason = 'Importe no numérico o vacío';
      } else if (porPartValue === null) {
        status = 'discard';
        discardReason = 'PorPart no numérico o vacío';
      }

      let fpagoValue: Date | null = null;
      if (fPago && row[fPago]) {
        fpagoValue = parseDate(row[fPago]);
        if (!fpagoValue && status === 'valid') {
          status = 'warning';
          warnings.push('FPago inválido o vacío');
        }
      } else if (status === 'valid') {
        status = 'warning';
        warnings.push('FPago no especificado');
      }

      const aseguradoraValue = row[parsed.headersNormalizedMap['ciaabreviacion']]?.toString()?.trim() ||
                               row[parsed.headersNormalizedMap['aseguradora']]?.toString()?.trim() ||
                               'NO_ESPECIFICADA';

      if (aseguradoraValue === 'NO_ESPECIFICADA' && status === 'valid') {
        status = 'warning';
        warnings.push('Aseguradora no especificada');
      }

      const comisionCalculada = (importeValue !== null && porPartValue !== null)
        ? importeValue * (porPartValue / 100)
        : 0;

      let agentKey = 'unknown';
      let agentNameNorm = '';
      let agentNameSignature = '';
      let matchedUserId = null;
      let matchStatus = 'pending';
      let matchMethod = 'none';
      let matchConfidence = 0;

      if (vendorNameRaw) {
        const normalized = normalizePersonName(vendorNameRaw);
        agentKey = buildAgentKey(normalized.name_signature);
        agentNameNorm = normalized.name_norm;
        agentNameSignature = normalized.name_signature;

        const existingMapping = await checkExistingMapping(adminSupabase, agentKey);

        if (existingMapping && existingMapping.matched_user_id) {
          matchedUserId = existingMapping.matched_user_id;
          matchStatus = existingMapping.mapping_source === 'manual' ? 'matched_manual' : 'matched_auto';
          matchMethod = existingMapping.mapping_source;
          matchConfidence = existingMapping.confidence;
        } else {
          const matchResult = await findBestUserMatch(adminSupabase, vendorNameRaw);

          if (matchResult.userId) {
            matchedUserId = matchResult.userId;
            matchConfidence = matchResult.confidence;
            matchMethod = matchResult.matchMethod;
            matchStatus = 'matched_auto';

            await adminSupabase
              .from('agent_user_mappings')
              .upsert({
                agent_key: agentKey,
                agent_name_raw_latest: vendorNameRaw,
                agent_name_norm: agentNameNorm,
                agent_name_signature: agentNameSignature,
                matched_user_id: matchedUserId,
                mapping_source: matchResult.matchMethod,
                confidence: matchConfidence,
                is_active: true
              }, {
                onConflict: 'agent_key'
              });
          } else if (matchResult.matchMethod === 'conflict') {
            matchStatus = 'conflict';
          } else {
            matchStatus = 'pending';
          }
        }
      }

      const item = {
        import_batch_id: batch.id,
        row_index: i + 1,
        raw_json: row,
        status,
        discard_reason: discardReason,
        warnings: JSON.stringify(warnings),
        vendor_name_raw: vendorNameRaw || null,
        vendor_name_norm: vendorNameRaw ? normalizePersonName(vendorNameRaw).name_norm : null,
        agent_key: agentKey,
        agent_name_raw: vendorNameRaw || null,
        agent_name_norm: agentNameNorm || null,
        agent_name_signature: agentNameSignature || null,
        documento: documentoValue || null,
        endoso: row[parsed.headersNormalizedMap['endoso']]?.toString()?.trim() || null,
        fpago: fpagoValue,
        fpago_raw: fPago ? row[fPago]?.toString()?.trim() : null,
        aseguradora: aseguradoraValue,
        ramo: ramoValue || null,
        importe_base: importeValue,
        porcentaje: porPartValue,
        comision_calculada: comisionCalculada,
        prima_neta_info: parseNumberMx(row[parsed.headersNormalizedMap['primaneta']]),
        concepto: row[parsed.headersNormalizedMap['concepto']]?.toString()?.trim() || null,
        oficina: row[parsed.headersNormalizedMap['despnombre']]?.toString()?.trim() || null,
        nombre_completo: row[parsed.headersNormalizedMap['nombrecompleto']]?.toString()?.trim() || null,
        movi_user_id: matchedUserId,
        match_status: matchStatus,
        match_method: matchMethod,
        match_confidence: matchConfidence
      };

      itemsToInsert.push(item);
    }

    console.log(`[Import] Insertando ${itemsToInsert.length} items en staging...`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
      const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
      const { error: insertError } = await adminSupabase
        .from('document_import_items')
        .insert(chunk);

      if (insertError) {
        console.error('Error al insertar chunk:', insertError);
        await supabase
          .from('document_import_batches')
          .update({ status: 'failed', conversion_failed_reason: insertError.message })
          .eq('id', batch.id);

        return new Response(
          JSON.stringify({ error: 'Error al procesar documentos: ' + insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    await supabase
      .from('document_import_batches')
      .update({ status: 'completed' })
      .eq('id', batch.id);

    const { data: updatedBatch } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single();

    console.log(`[Import] Completado - Total: ${updatedBatch.row_count_total}, Valid: ${updatedBatch.row_count_valid}, Warning: ${updatedBatch.row_count_warning}, Discard: ${updatedBatch.row_count_discard}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: updatedBatch,
        batch_id: batch.id,
        message: 'Importación completada exitosamente'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al procesar archivo' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
