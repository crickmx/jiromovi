import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================================
// SERVICIO DE INGESTA UNIFICADO (Deno version)
// Mismo que commissionIngestionService.ts pero compatible con Deno
// ============================================================================

interface StandardCommissionRow {
  fpago: string | null;
  agent_email: string;
  ramo: string;
  aseguradora: string;
  importe_base: number;
  porcentaje: number;
  poliza: string;
  comision_calculada: number;
  prima_neta_info?: number;
  nombre_asegurado?: string;
  concepto?: string;
}

interface DiscardReport {
  missing_email: number;
  missing_importe: number;
  missing_porpart: number;
  missing_ramo: number;
  missing_aseguradora: number;
  missing_poliza: number;
  invalid_importe: number;
  invalid_porpart: number;
  examples: Array<{
    rowIndex: number;
    reason: string;
    values: Record<string, any>;
  }>;
}

interface HeaderCheckResult {
  valid: boolean;
  detected: string[];
  normalized: string[];
  missing: string[];
  mapped: Record<string, string>;
}

function normalizeNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s%]/g, '').trim();
    if (cleaned === '' || cleaned === '-') return 0;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function normalizeText(value: any, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  const str = String(value).trim();
  return str || defaultValue;
}

function normalizeEmail(value: any): string {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function normalizeDate(value: any): string | null {
  if (!value) return null;

  if (typeof value === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = value - 2;
    const resultDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return resultDate.toISOString().split('T')[0];
  }

  if (typeof value === 'string') {
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }

    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return value;
    }

    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Mapea columnas con sinónimos (versión simplificada)
 * Retorna un mapa de: standardKey => nombreOriginal
 */
function mapColumns(data: Record<string, any>): Record<string, string> {
  const mapped: Record<string, string> = {};

  // Normalizar keys del objeto
  const keys = Object.keys(data);
  const normalizedKeys = new Map<string, string>();

  for (const key of keys) {
    const norm = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-_.]/g, '');
    normalizedKeys.set(norm, key);
  }

  // Mapear con sinónimos
  const synonymMap = [
    { standard: 'fpago', variants: ['fpago', 'fecha', 'fechapago'] },
    { standard: 'email', variants: ['email', 'emailagente', 'mail', 'correo'] },
    { standard: 'ramo', variants: ['ramo', 'branch'] },
    { standard: 'aseguradora', variants: ['aseguradora', 'ciaabreviacion', 'cia', 'compania'] },
    { standard: 'importe', variants: ['importe', 'importebase', 'base', 'monto'] },
    { standard: 'porpart', variants: ['porpart', 'porcentaje', 'percentage'] },
    { standard: 'poliza', variants: ['poliza', 'documento', 'policy'] },
    { standard: 'primaneta', variants: ['primaneta', 'prima'] },
    { standard: 'nombreasegurado', variants: ['nombreasegurado', 'asegurado', 'nombrecompleto'] },
    { standard: 'concepto', variants: ['concepto', 'descripcion'] }
  ];

  for (const { standard, variants } of synonymMap) {
    for (const variant of variants) {
      if (normalizedKeys.has(variant)) {
        mapped[standard] = normalizedKeys.get(variant)!;
        break;
      }
    }
  }

  return mapped;
}

/**
 * Pre-check: Valida que el primer documento tenga las columnas obligatorias
 * Retorna información detallada sobre headers detectados y faltantes
 */
function checkHeaders(firstDoc: any): HeaderCheckResult {
  const docData = firstDoc?.document_data || {};
  const keys = Object.keys(docData);

  const normalized = keys.map(key =>
    key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-_.]/g, '')
  );

  const mapped = mapColumns(docData);

  const requiredFields = ['email', 'importe', 'porpart', 'ramo', 'aseguradora', 'poliza'];
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!mapped[field]) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    detected: keys,
    normalized,
    missing,
    mapped
  };
}

/**
 * Parsea una fila de documento importado al modelo estándar
 * REGLA DE ORO: Comisión = Importe × (PorPart / 100)
 * CRÍTICO: NO usar prima_neta como base de cálculo
 * IMPORTANTE: FPago puede ser NULL (va al lote "Sin fecha")
 */
function parseImportedDocument(
  doc: any,
  rowIndex: number,
  discardReport: DiscardReport
): {
  row: StandardCommissionRow | null;
  errors: string[];
} {
  const errors: string[] = [];
  const docData = doc.document_data || {};

  // Mapear columnas del documento
  const mapped = mapColumns(docData);

  // Extraer valores usando mapeo
  const fpagoRaw = mapped.fpago ? docData[mapped.fpago] : null;
  const emailRaw = mapped.email ? docData[mapped.email] : doc.vendor_email_raw;
  const ramoRaw = mapped.ramo ? docData[mapped.ramo] : null;
  const aseguradoraRaw = mapped.aseguradora ? docData[mapped.aseguradora] : null;
  const importeRaw = mapped.importe ? docData[mapped.importe] : null;
  const porpartRaw = mapped.porpart ? docData[mapped.porpart] : null;
  const polizaRaw = mapped.poliza ? docData[mapped.poliza] : doc.document_id;

  const primaNetaRaw = mapped.primaneta ? docData[mapped.primaneta] : null;
  const nombreAseguradoRaw = mapped.nombreasegurado ? docData[mapped.nombreasegurado] : null;
  const conceptoRaw = mapped.concepto ? docData[mapped.concepto] : null;

  // Normalizar
  const fpago = normalizeDate(fpagoRaw);
  const agent_email = normalizeEmail(emailRaw);
  const ramo = normalizeText(ramoRaw);
  const aseguradora = normalizeText(aseguradoraRaw);
  const importe_base = normalizeNumeric(importeRaw);
  const porcentaje = normalizeNumeric(porpartRaw);
  const poliza = normalizeText(polizaRaw);

  const prima_neta_info = primaNetaRaw ? normalizeNumeric(primaNetaRaw) : undefined;
  const nombre_asegurado = nombreAseguradoRaw ? normalizeText(nombreAseguradoRaw) : undefined;
  const concepto = conceptoRaw ? normalizeText(conceptoRaw) : undefined;

  // Validar campos obligatorios (FPago NO es obligatorio)
  let discardReason = '';

  if (!agent_email || agent_email === '') {
    errors.push(`Email vacío o inválido: ${emailRaw}`);
    discardReport.missing_email++;
    discardReason = 'missing_email';
  }

  if (!ramo || ramo === '') {
    errors.push(`Ramo vacío: ${ramoRaw}`);
    discardReport.missing_ramo++;
    discardReason = discardReason || 'missing_ramo';
  }

  if (!aseguradora || aseguradora === '') {
    errors.push(`Aseguradora vacía: ${aseguradoraRaw}`);
    discardReport.missing_aseguradora++;
    discardReason = discardReason || 'missing_aseguradora';
  }

  if (!importe_base || importe_base <= 0) {
    errors.push(`Importe vacío o inválido (debe ser > 0): ${importeRaw}`);
    if (!importeRaw || importeRaw === '') {
      discardReport.missing_importe++;
    } else {
      discardReport.invalid_importe++;
    }
    discardReason = discardReason || 'invalid_importe';
  }

  if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje)) {
    errors.push(`PorPart vacío o inválido: ${porpartRaw}`);
    if (!porpartRaw || porpartRaw === '') {
      discardReport.missing_porpart++;
    } else {
      discardReport.invalid_porpart++;
    }
    discardReason = discardReason || 'invalid_porpart';
  }

  if (!poliza || poliza === '') {
    errors.push(`Póliza vacía: ${polizaRaw}`);
    discardReport.missing_poliza++;
    discardReason = discardReason || 'missing_poliza';
  }

  if (errors.length > 0) {
    if (discardReport.examples.length < 10) {
      discardReport.examples.push({
        rowIndex,
        reason: discardReason,
        values: {
          email: emailRaw,
          ramo: ramoRaw,
          aseguradora: aseguradoraRaw,
          importe: importeRaw,
          porpart: porpartRaw,
          poliza: polizaRaw
        }
      });
    }
    return { row: null, errors };
  }

  // CÁLCULO CORRECTO: Comisión = Importe × (PorPart / 100)
  const comision_calculada = importe_base * (porcentaje / 100);

  return {
    row: {
      fpago,
      agent_email: agent_email!,
      ramo: ramo!,
      aseguradora: aseguradora!,
      importe_base,
      porcentaje,
      poliza: poliza!,
      comision_calculada,
      prima_neta_info,
      nombre_asegurado,
      concepto
    },
    errors: []
  };
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

function getWeekInfo(dateStr: string): {
  week_number: number;
  period_start: string;
  period_end: string;
} {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const oneJan = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((date.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);

  return {
    week_number: weekNumber,
    period_start: monday.toISOString().split('T')[0],
    period_end: sunday.toISOString().split('T')[0],
  };
}

async function insertItemsInChunks(
  supabase: any,
  items: any[],
  chunkSize: number = 200
): Promise<{ success: boolean; insertedCount: number; errors: any[] }> {
  let insertedCount = 0;
  const errors: any[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    try {
      const { data, error } = await supabase
        .from("commission_details")
        .insert(chunk)
        .select();

      if (error) {
        console.error(`[Insert] Chunk ${i}-${i + chunk.length} failed:`, error);

        for (let j = 0; j < chunk.length; j++) {
          const singleItem = chunk[j];
          try {
            const { data: singleData, error: singleError } = await supabase
              .from("commission_details")
              .insert([singleItem])
              .select();

            if (singleError) {
              errors.push({
                row_index: i + j,
                item: singleItem,
                error: {
                  code: singleError.code,
                  message: singleError.message,
                  details: singleError.details
                }
              });
            } else {
              insertedCount++;
            }
          } catch (individualError: any) {
            errors.push({
              row_index: i + j,
              item: singleItem,
              error: { message: individualError.message }
            });
          }
        }
      } else {
        insertedCount += data?.length || 0;
      }
    } catch (chunkError: any) {
      console.error(`[Insert] Chunk error:`, chunkError);
      errors.push({
        chunk_start: i,
        chunk_end: i + chunk.length,
        error: { message: chunkError.message }
      });
    }
  }

  return { success: errors.length === 0, insertedCount, errors };
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  let conversionJobId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const url = new URL(req.url);
    const batchId = url.pathname.split("/").pop();

    if (!batchId) {
      throw new Error("Batch ID is required");
    }

    console.log(`[Conversion] Starting conversion for batch ${batchId}`);

    // Verificar que el batch existe
    const { data: importBatch, error: batchError } = await supabase
      .from("document_import_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !importBatch) {
      return new Response(JSON.stringify({
        success: false,
        code: "BATCH_NOT_FOUND",
        message: "El lote de importación no existe"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verificar que no fue convertido
    if (importBatch.converted_to_commissions) {
      return new Response(JSON.stringify({
        success: false,
        code: "ALREADY_CONVERTED",
        message: "Este lote ya fue convertido anteriormente"
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Contar documentos de origen
    const { count: sourceCount, error: countError } = await supabase
      .from("imported_documents")
      .select("*", { count: 'exact', head: true })
      .eq("batch_id", batchId);

    if (countError) {
      throw countError;
    }

    if (!sourceCount || sourceCount === 0) {
      return new Response(JSON.stringify({
        success: false,
        code: "NO_SOURCE_ITEMS",
        message: "No hay documentos para convertir"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Found ${sourceCount} documents to convert`);

    // Pre-check: Obtener primer documento para validar headers
    const { data: firstDoc, error: firstDocError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batchId)
      .limit(1)
      .single();

    if (firstDocError || !firstDoc) {
      return new Response(JSON.stringify({
        success: false,
        code: "NO_DOCUMENTS",
        message: "No se encontró ningún documento para validar headers"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validar headers
    const headerCheck = checkHeaders(firstDoc);

    if (!headerCheck.valid) {
      return new Response(JSON.stringify({
        success: false,
        code: "MISSING_REQUIRED_COLUMNS",
        message: "El archivo Excel no tiene todas las columnas obligatorias",
        details: {
          detectedHeaders: headerCheck.detected,
          normalizedHeaders: headerCheck.normalized,
          missingColumns: headerCheck.missing,
          mappedColumns: headerCheck.mapped,
          requiredColumns: ['email', 'importe', 'porpart', 'ramo', 'aseguradora', 'poliza']
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('[Conversion] Header check passed:', headerCheck.mapped);

    // Crear job de conversión
    const { data: conversionJob, error: jobError } = await supabase
      .from("conversion_jobs")
      .insert({
        batch_id: batchId,
        started_by: user.id,
        status: "running",
        total_source_items: sourceCount,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !conversionJob) {
      throw new Error("Failed to create conversion job");
    }

    conversionJobId = conversionJob.id;

    // Obtener todos los documentos
    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batchId);

    if (docsError || !documents) {
      throw new Error("Failed to fetch documents");
    }

    console.log(`[Conversion] Processing ${documents.length} documents...`);

    // Parsear documentos al modelo estándar
    const parsedRows: StandardCommissionRow[] = [];
    const parseErrors: any[] = [];

    // Inicializar reporte de descarte
    const discardReport: DiscardReport = {
      missing_email: 0,
      missing_importe: 0,
      missing_porpart: 0,
      missing_ramo: 0,
      missing_aseguradora: 0,
      missing_poliza: 0,
      invalid_importe: 0,
      invalid_porpart: 0,
      examples: []
    };

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const { row, errors } = parseImportedDocument(doc, i, discardReport);

      if (row) {
        parsedRows.push(row);
      } else {
        parseErrors.push({
          document_id: doc.document_id,
          vendor_email: doc.vendor_email_raw,
          errors
        });
        console.error(`[Conversion] Parse error for doc ${doc.document_id}:`, errors);
      }
    }

    console.log(`[Conversion] Parsed ${parsedRows.length} valid rows, ${parseErrors.length} errors`);
    console.log('[Conversion] Discard report:', discardReport);

    if (parsedRows.length === 0) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_VALID_ITEMS_AFTER_MAPPING",
          error_message: "Ninguna fila pudo ser parseada. Todas las filas tienen datos inválidos o incompletos.",
          conversion_report: {
            discard_report: discardReport,
            parse_errors: parseErrors.slice(0, 10)
          }
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_VALID_ITEMS_AFTER_MAPPING",
        message: "Ninguna fila es válida. Todas las filas tienen datos inválidos o incompletos.",
        details: {
          totalSourceItems: sourceCount,
          validRows: 0,
          discarded: discardReport,
          parseErrors: parseErrors.slice(0, 5)
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Agrupar por semana usando FPago
    const weekGroups: Record<string, { week_number: number; period_start: string; period_end: string; rows: StandardCommissionRow[] }> = {};
    const noDateRows: StandardCommissionRow[] = [];

    for (const row of parsedRows) {
      // Si FPago es null, va directo al lote "Sin fecha"
      if (!row.fpago) {
        noDateRows.push(row);
        continue;
      }

      try {
        const weekInfo = getWeekInfo(row.fpago);
        const key = `${weekInfo.week_number}-${weekInfo.period_start}`;

        if (!weekGroups[key]) {
          weekGroups[key] = {
            week_number: weekInfo.week_number,
            period_start: weekInfo.period_start,
            period_end: weekInfo.period_end,
            rows: []
          };
        }

        weekGroups[key].rows.push(row);
      } catch (error) {
        console.error(`[Conversion] Error parsing week for fpago ${row.fpago}:`, error);
        noDateRows.push(row);
      }
    }

    console.log(`[Conversion] Grouped into ${Object.keys(weekGroups).length} weeks, ${noDateRows.length} without date`);

    const createdBatches: any[] = [];
    const createdBatchIds: string[] = [];
    let totalInsertedItems = 0;

    // Crear lote "Sin fecha" si hay
    if (noDateRows.length > 0) {
      console.log(`[Conversion] Creating no-date batch with ${noDateRows.length} items`);

      const { data: noDateBatch, error: createError } = await supabase
        .from("commission_batches")
        .insert({
          name: "Sin fecha (FPago no definido)",
          date_from: null,
          date_to: null,
          uploaded_by: user.id,
          status: "draft",
          source_type: "excel_import",
          source_id: batchId,
          week_number: 0,
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id
        })
        .select()
        .single();

      if (createError || !noDateBatch) {
        throw new Error(`Failed to create no-date batch: ${createError?.message}`);
      }

      createdBatchIds.push(noDateBatch.id);

      // Preparar items para inserción
      const itemsToInsert = noDateRows.map(row => ({
        batch_id: noDateBatch.id,
        agent_id: null,
        poliza: row.poliza,
        nombre_asegurado: row.nombre_asegurado || null,
        ramo: row.ramo,
        aseguradora: row.aseguradora,
        prima_neta: row.prima_neta_info || 0,
        importe_base: row.importe_base,
        porcentaje_comision: row.porcentaje,
        concepto: row.concepto || null,
        date_fpago: row.fpago,
        commission_bruta: row.comision_calculada,
        commission_neta: row.comision_calculada,
        vendor_email_raw: row.agent_email,
        vendor_email_norm: row.agent_email,
        vendor_name_raw: '',
        vendor_name_norm: '',
        vendor_key: row.agent_email,
        match_method: 'email',
        pending_assignment: true,
        raw_row: {}
      }));

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);
      totalInsertedItems += insertResult.insertedCount;

      if (insertResult.insertedCount === 0) {
        await supabase.from("commission_batches").delete().eq("id", noDateBatch.id);
      } else {
        createdBatches.push({
          id: noDateBatch.id,
          week_number: 0,
          period_start: null,
          period_end: null,
          display_name: "Sin fecha (FPago no definido)",
          items: insertResult.insertedCount
        });
      }
    }

    // Crear lotes por semana
    for (const [key, group] of Object.entries(weekGroups)) {
      if (group.rows.length === 0) continue;

      console.log(`[Conversion] Creating batch for week ${group.week_number} with ${group.rows.length} items`);

      const batchName = `Semana ${group.week_number} (${group.period_start} a ${group.period_end})`;

      const { data: weekBatch, error: createError } = await supabase
        .from("commission_batches")
        .insert({
          name: batchName,
          date_from: group.period_start,
          date_to: group.period_end,
          uploaded_by: user.id,
          status: "draft",
          source_type: "excel_import",
          source_id: batchId,
          week_number: group.week_number,
          period_start: group.period_start,
          period_end: group.period_end,
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id
        })
        .select()
        .single();

      if (createError || !weekBatch) {
        throw new Error(`Failed to create batch for week ${group.week_number}: ${createError?.message}`);
      }

      createdBatchIds.push(weekBatch.id);

      const itemsToInsert = group.rows.map(row => ({
        batch_id: weekBatch.id,
        agent_id: null,
        poliza: row.poliza,
        nombre_asegurado: row.nombre_asegurado || null,
        ramo: row.ramo,
        aseguradora: row.aseguradora,
        prima_neta: row.prima_neta_info || 0,
        importe_base: row.importe_base,
        porcentaje_comision: row.porcentaje,
        concepto: row.concepto || null,
        date_fpago: row.fpago,
        commission_bruta: row.comision_calculada,
        commission_neta: row.comision_calculada,
        vendor_email_raw: row.agent_email,
        vendor_email_norm: row.agent_email,
        vendor_name_raw: '',
        vendor_name_norm: '',
        vendor_key: row.agent_email,
        match_method: 'email',
        pending_assignment: true,
        raw_row: {}
      }));

      const insertResult = await insertItemsInChunks(supabase, itemsToInsert);
      totalInsertedItems += insertResult.insertedCount;

      if (insertResult.insertedCount === 0) {
        await supabase.from("commission_batches").delete().eq("id", weekBatch.id);
      } else {
        createdBatches.push({
          id: weekBatch.id,
          week_number: group.week_number,
          period_start: group.period_start,
          period_end: group.period_end,
          display_name: batchName,
          items: insertResult.insertedCount
        });
      }
    }

    if (createdBatches.length === 0 || totalInsertedItems === 0) {
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_ITEMS_INSERTED",
          error_message: "No se pudieron insertar items en los lotes. Todas las filas fueron descartadas.",
          conversion_report: {
            discard_report: discardReport,
            parse_errors: parseErrors.slice(0, 10)
          }
        })
        .eq("id", conversionJobId);

      return new Response(JSON.stringify({
        success: false,
        code: "NO_ITEMS_INSERTED",
        message: "No se pudieron insertar documentos en los lotes",
        details: {
          totalSourceItems: sourceCount,
          validRows: parsedRows.length,
          insertedItems: totalInsertedItems,
          discarded: discardReport
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Success: ${createdBatches.length} batches, ${totalInsertedItems} items`);

    // Marcar batch como convertido
    await supabase
      .from("document_import_batches")
      .update({
        converted_to_commissions: true,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        commission_batch_ids: createdBatchIds
      })
      .eq("id", batchId);

    // Actualizar job
    await supabase
      .from("conversion_jobs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        total_inserted_items: totalInsertedItems,
        created_batch_count: createdBatches.length,
        created_batch_ids: createdBatchIds,
        conversion_report: {
          batches: createdBatches,
          summary: {
            sourceCount,
            parsedCount: parsedRows.length,
            insertedCount: totalInsertedItems,
            parseErrorsCount: parseErrors.length
          }
        }
      })
      .eq("id", conversionJobId);

    return new Response(JSON.stringify({
      success: true,
      totalSourceRows: sourceCount,
      validRows: parsedRows.length,
      discarded: discardReport,
      createdBatches,
      totalInsertedItems,
      conversion_job_id: conversionJobId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Conversion] Error:", error);

    if (conversionJobId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "UNKNOWN",
          error_message: error.message,
          error_stack: error.stack
        })
        .eq("id", conversionJobId);
    }

    return new Response(JSON.stringify({
      success: false,
      code: "INTERNAL_ERROR",
      message: error.message || "Error desconocido al convertir el lote"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
