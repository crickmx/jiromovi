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

function parseExcelUnified(fileBuffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  let bestSheet: { name: string; rowCount: number } | null = null;
  const rowCountPerSheet: Record<string, number> = {};

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const rowCount = jsonData.length;
    rowCountPerSheet[sheetName] = rowCount;

    if (!bestSheet || rowCount > bestSheet.rowCount) {
      bestSheet = { name: sheetName, rowCount };
    }
  }

  if (!bestSheet) {
    throw new Error('No se pudo determinar la hoja con más datos');
  }

  const sheet = workbook.Sheets[bestSheet.name];
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    blankrows: true
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

  const detectedColumns: { vendNombre?: string; fPago?: string } = {};

  if (headersNormalizedMap['vendnombre']) {
    detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
  }

  if (headersNormalizedMap['fpago']) {
    detectedColumns.fPago = headersNormalizedMap['fpago'];
  }

  const rows = jsonData.map(row => {
    const normalizedRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row as Record<string, any>)) {
      normalizedRow[key] = value;
    }
    return normalizedRow;
  });

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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const batchName = formData.get('batch_name') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se proporcionó archivo' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Import] Procesando archivo: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const parsed = parseExcelUnified(arrayBuffer);

    console.log(`[Import] Hoja seleccionada: ${parsed.sheetNameUsed}`);
    console.log(`[Import] Total filas leídas: ${parsed.totalRowsRead}`);
    console.log(`[Import] VendNombre detectado: ${parsed.debugInfo.detectedColumns.vendNombre || 'NO'}`);

    if (!parsed.debugInfo.detectedColumns.vendNombre) {
      return new Response(
        JSON.stringify({
          error: 'No se encontró la columna VendNombre en el archivo',
          hint: 'Columnas detectadas: ' + parsed.headersOriginal.join(', ')
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const NAME_COL = parsed.debugInfo.detectedColumns.vendNombre;
    const POLIZA_COL = parsed.headersNormalizedMap['poliza'] || parsed.headersNormalizedMap['documento'];

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .insert({
        file_name: batchName || file.name,
        imported_by: user.id,
        status: 'processing',
        metadata: {
          sheet_used: parsed.sheetNameUsed,
          total_sheets: parsed.debugInfo.allSheetNames.length,
          headers_detected: parsed.headersOriginal,
        }
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('Error al crear batch:', batchError);
      return new Response(
        JSON.stringify({ error: 'Error al crear lote de importación' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const documents = [];
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[Import] Procesando ${parsed.rows.length} filas...`);

    let matchedCount = 0;
    let pendingCount = 0;
    let conflictCount = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];

      const documentId = POLIZA_COL ? row[POLIZA_COL] : `DOC-${i + 1}`;
      const vendorNameRaw = NAME_COL ? (row[NAME_COL]?.toString() || '').trim() : '';

      if (!vendorNameRaw) {
        continue;
      }

      const normalized = normalizePersonName(vendorNameRaw);
      const agentKey = buildAgentKey(normalized.name_signature);

      let matchedUserId = null;
      let matchStatus = 'pending';
      let matchMethod = 'none';
      let matchConfidence = 0;
      let matchCandidates = null;

      const existingMapping = await checkExistingMapping(adminSupabase, agentKey);

      if (existingMapping && existingMapping.matched_user_id) {
        matchedUserId = existingMapping.matched_user_id;
        matchStatus = existingMapping.mapping_source === 'manual' ? 'matched_manual' : 'matched_auto';
        matchMethod = existingMapping.mapping_source;
        matchConfidence = existingMapping.confidence;
        matchedCount++;
      } else {
        const matchResult = await findBestUserMatch(adminSupabase, vendorNameRaw);

        if (matchResult.userId) {
          matchedUserId = matchResult.userId;
          matchConfidence = matchResult.confidence;
          matchMethod = matchResult.matchMethod;
          matchStatus = 'matched_auto';
          matchedCount++;

          await adminSupabase
            .from('agent_user_mappings')
            .upsert({
              agent_key: agentKey,
              agent_name_raw_latest: vendorNameRaw,
              agent_name_norm: normalized.name_norm,
              agent_name_signature: normalized.name_signature,
              matched_user_id: matchedUserId,
              mapping_source: matchResult.matchMethod,
              confidence: matchConfidence,
              is_active: true
            }, {
              onConflict: 'agent_key'
            });
        } else if (matchResult.matchMethod === 'conflict') {
          matchStatus = 'conflict';
          matchCandidates = matchResult.candidates;
          conflictCount++;
        } else {
          matchStatus = 'pending';
          pendingCount++;
        }
      }

      documents.push({
        batch_id: batch.id,
        source_row_index: i + 1,
        document_id: String(documentId || `DOC-${i + 1}`),
        vendor_name_raw: vendorNameRaw,
        vendor_name_norm: normalized.name_norm,
        agent_name_raw: vendorNameRaw,
        agent_name_norm: normalized.name_norm,
        agent_name_signature: normalized.name_signature,
        agent_key: agentKey,
        movi_user_id: matchedUserId,
        match_status: matchStatus,
        match_method: matchMethod,
        match_confidence: matchConfidence,
        match_candidates: matchCandidates ? JSON.stringify(matchCandidates) : null,
        is_unmatched: matchedUserId === null,
        pending: matchedUserId === null,
        document_data: row,
      });
    }

    console.log(`[Import] Insertando ${documents.length} documentos...`);

    if (documents.length === 0) {
      await supabase
        .from('document_import_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);

      return new Response(
        JSON.stringify({ error: 'No se encontraron documentos válidos para importar' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: insertError } = await adminSupabase
      .from('imported_documents')
      .insert(documents);

    if (insertError) {
      console.error('Error al insertar documentos:', insertError);
      await supabase
        .from('document_import_batches')
        .update({ status: 'failed' })
        .eq('id', batch.id);

      return new Response(
        JSON.stringify({ error: 'Error al procesar documentos: ' + insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase
      .from('document_import_batches')
      .update({
        status: 'completed',
        total_documents: documents.length,
        matched_documents: matchedCount,
        unmatched_documents: pendingCount + conflictCount
      })
      .eq('id', batch.id);

    const { data: updatedBatch } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single();

    console.log(`[Import] Completado - Matched: ${matchedCount}, Pending: ${pendingCount}, Conflicts: ${conflictCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: updatedBatch,
        batch_id: batch.id,
        diagnostics: {
          sheet_used: parsed.sheetNameUsed,
          total_rows_processed: documents.length,
          matched_count: matchedCount,
          pending_count: pendingCount,
          conflict_count: conflictCount,
          message: 'Importación completada. Los documentos pendientes deben asignarse manualmente.'
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error al procesar archivo' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
