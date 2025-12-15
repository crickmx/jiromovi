import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

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
      emailAgente?: string;
      vendNombre?: string;
      fPago?: string;
    };
  };
}

function normalizeHeader(header: string): string {
  if (!header) return '';

  let normalized = header.toString().trim().toLowerCase();

  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  normalized = normalized
    .replace(/[\s\-_.]/g, '');

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

  const detectedColumns: { emailAgente?: string; vendNombre?: string; fPago?: string } = {};

  if (headersNormalizedMap['emailagente']) {
    detectedColumns.emailAgente = headersNormalizedMap['emailagente'];
  }

  if (headersNormalizedMap['vendnombre']) {
    detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
  }

  // REGLA DE ORO: FPago es la única fecha válida para comisiones
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

function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';

  let normalized = name.trim().toLowerCase();

  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

function buildVendorKey(emailNorm?: string, nameNorm?: string): string {
  if (emailNorm) return `email:${emailNorm}`;
  if (nameNorm) return `name:${nameNorm}`;
  return 'unknown';
}

interface FindUserResult {
  user_id: string | null;
  method: string;
}

async function findMoviUserForVendor(
  supabase: any,
  vendorEmail: string | null,
  vendorName: string | null
): Promise<FindUserResult> {
  const { data, error } = await supabase.rpc('find_movi_user_for_vendor', {
    vendor_email: vendorEmail,
    vendor_name: vendorName,
  });

  if (error) {
    console.error('Error en find_movi_user_for_vendor:', error);
    return { user_id: null, method: 'none' };
  }

  return data || { user_id: null, method: 'none' };
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

    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (userData?.rol !== 'Administrador') {
      return new Response(
        JSON.stringify({ error: 'Sin permisos' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

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
    console.log(`[Import] EmailAgente detectado: ${parsed.debugInfo.detectedColumns.emailAgente || 'NO'}`);
    console.log(`[Import] VendNombre detectado: ${parsed.debugInfo.detectedColumns.vendNombre || 'NO'}`);
    console.log(`[Import] FPago detectado: ${parsed.debugInfo.detectedColumns.fPago || 'NO - Se crearán en lote "Sin fecha"}`);

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

    const EMAIL_COL = parsed.headersNormalizedMap['emailagente'];
    const NAME_COL = parsed.headersNormalizedMap['vendnombre'];
    const POLIZA_COL = parsed.headersNormalizedMap['poliza'] ||
                       parsed.headersNormalizedMap['documento'];

    const { data: batch, error: batchError } = await supabase
      .from('document_import_batches')
      .insert({
        file_name: file.name,
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

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];

      const documentId = POLIZA_COL ? row[POLIZA_COL] : `DOC-${i + 1}`;
      const vendorEmailRaw = EMAIL_COL ? (row[EMAIL_COL]?.toString() || '').trim() : '';
      const vendorNameRaw = NAME_COL ? (row[NAME_COL]?.toString() || '').trim() : '';

      const vendorEmailNorm = normalizeEmail(vendorEmailRaw);
      const vendorNameNorm = normalizeName(vendorNameRaw);
      const vendorKey = buildVendorKey(vendorEmailNorm, vendorNameNorm);

      const userMatch = await findMoviUserForVendor(
        adminSupabase,
        vendorEmailRaw || null,
        vendorNameRaw || null
      );

      documents.push({
        batch_id: batch.id,
        source_row_index: i + 1,
        document_id: String(documentId || `DOC-${i + 1}`),
        vendor_email_raw: vendorEmailRaw || null,
        vendor_name_raw: vendorNameRaw || null,
        vendor_email_norm: vendorEmailNorm || null,
        vendor_name_norm: vendorNameNorm || null,
        vendor_key: vendorKey,
        movi_user_id: userMatch.user_id,
        match_method: userMatch.method,
        is_unmatched: userMatch.user_id === null,
        document_data: row,
      });
    }

    console.log(`[Import] Insertando ${documents.length} documentos...`);

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
        JSON.stringify({ error: 'Error al procesar documentos' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await adminSupabase.rpc('update_batch_counters', {
      p_batch_id: batch.id,
    });

    await supabase
      .from('document_import_batches')
      .update({ status: 'completed' })
      .eq('id', batch.id);

    const { data: updatedBatch } = await supabase
      .from('document_import_batches')
      .select('*')
      .eq('id', batch.id)
      .single();

    const matchedCount = documents.filter(d => d.movi_user_id !== null).length;
    const unmatchedCount = documents.filter(d => d.movi_user_id === null).length;
    const emptyVendorCount = documents.filter(d => !d.vendor_name_raw).length;
    const uniqueVendorNames = [...new Set(documents.map(d => d.vendor_name_raw).filter(n => n))].slice(0, 5);
    const uniqueEmails = [...new Set(documents.map(d => d.vendor_email_raw).filter(e => e))].slice(0, 5);

    const methodCounts: Record<string, number> = {};
    for (const doc of documents) {
      methodCounts[doc.match_method] = (methodCounts[doc.match_method] || 0) + 1;
    }

    console.log(`[Import] Completado - Matched: ${matchedCount}, Unmatched: ${unmatchedCount}`);
    console.log(`[Import] Methods: ${JSON.stringify(methodCounts)}`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: updatedBatch,
        diagnostics: {
          sheet_used: parsed.sheetNameUsed,
          all_sheets: parsed.debugInfo.allSheetNames,
          row_count_per_sheet: parsed.debugInfo.rowCountPerSheet,
          vendor_column_detected: NAME_COL,
          email_column_detected: EMAIL_COL,
          total_rows_read: parsed.totalRowsRead,
          total_rows_processed: documents.length,
          matched_count: matchedCount,
          unmatched_count: unmatchedCount,
          empty_vendor_count: emptyVendorCount,
          match_method_counts: methodCounts,
          sample_vendor_names: uniqueVendorNames,
          sample_emails: uniqueEmails,
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
