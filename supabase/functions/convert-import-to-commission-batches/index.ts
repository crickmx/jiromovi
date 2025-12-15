import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WeekGroup {
  week_number: number;
  period_start: string;
  period_end: string;
  documents: any[];
}

interface ConversionResult {
  success: boolean;
  createdBatches?: Array<{
    id: string;
    week_number: number;
    period_start: string | null;
    period_end: string | null;
    display_name: string;
    items: number;
  }>;
  totalSourceItems?: number;
  totalInsertedItems?: number;
  conversion_job_id?: string;
  code?: string;
  message?: string;
  details?: any;
  db?: {
    code?: string;
    message?: string;
    constraint?: string;
    detail?: string;
  };
}

interface ValidationError {
  row_index: number;
  vendor_name?: string;
  vendor_email?: string;
  poliza?: string;
  field: string;
  reason: string;
  value?: any;
}

function normalizeNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    // Remover símbolos de moneda, comas, espacios
    const cleaned = value.replace(/[$,\s]/g, '').trim();

    if (cleaned === '' || cleaned === '-') return 0;

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function normalizeText(value: any, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim() || defaultValue;
}

function validateCommissionItem(item: any, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validar campos requeridos
  if (!item.batch_id) {
    errors.push({
      row_index: index,
      field: 'batch_id',
      reason: 'Batch ID es requerido',
      vendor_name: item.vendor_name_raw,
      poliza: item.poliza
    });
  }

  // Validar que ramo no esté vacío después de normalización
  const ramo = normalizeText(item.ramo, 'N/A');
  if (ramo === '') {
    errors.push({
      row_index: index,
      field: 'ramo',
      reason: 'Ramo es requerido',
      vendor_name: item.vendor_name_raw,
      poliza: item.poliza
    });
  }

  // Validar que aseguradora no esté vacía
  const aseguradora = normalizeText(item.aseguradora, 'N/A');
  if (aseguradora === '') {
    errors.push({
      row_index: index,
      field: 'aseguradora',
      reason: 'Aseguradora es requerida',
      vendor_name: item.vendor_name_raw,
      poliza: item.poliza
    });
  }

  // Validar que póliza no esté vacía
  const poliza = normalizeText(item.poliza, 'N/A');
  if (poliza === '') {
    errors.push({
      row_index: index,
      field: 'poliza',
      reason: 'Póliza es requerida',
      vendor_name: item.vendor_name_raw
    });
  }

  return errors;
}

function normalizeCommissionItem(doc: any, batchId: string): any {
  const docData = doc.document_data || {};

  return {
    batch_id: batchId,
    agent_id: null,
    movi_user_id: doc.movi_user_id || null,
    vendor_email_raw: normalizeText(doc.vendor_email_raw, ''),
    vendor_email_norm: normalizeText(doc.vendor_email_norm, ''),
    vendor_name_raw: normalizeText(doc.vendor_name_raw, ''),
    vendor_name_norm: normalizeText(doc.vendor_name_norm, ''),
    vendor_key: normalizeText(doc.vendor_key, 'unknown'),
    match_method: normalizeText(doc.match_method, 'none'),
    pending_assignment: doc.is_unmatched || !doc.movi_user_id,
    ramo: normalizeText(docData.ramo || docData.branch, 'N/A'),
    aseguradora: normalizeText(docData.aseguradora || docData.insurer, 'N/A'),
    poliza: normalizeText(docData.poliza || docData.policy || doc.document_id, 'N/A'),
    prima_neta: normalizeNumeric(docData.prima_neta || docData.net_premium),
    importe_base: normalizeNumeric(docData.importe_base || docData.base_amount || docData.prima_neta),
    concepto: normalizeText(docData.concepto || docData.concept, null),
    date_fpago: docData.FPago || null,
    commission_bruta: normalizeNumeric(docData.comision_bruta || docData.gross_commission),
    commission_neta: normalizeNumeric(docData.comision_neta || docData.net_commission),
    porcentaje_comision: normalizeNumeric(docData.porcentaje || docData.percentage),
    porcentaje_base: normalizeNumeric(docData.porcentaje_base || docData.base_percentage),
    nombre_asegurado: normalizeText(docData.nombre_asegurado || docData.insured_name, null),
    raw_row: docData,
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

        // Si el chunk falla, intentar insertar uno por uno para identificar la fila problemática
        console.log(`[Insert] Intentando inserción individual para identificar fila problemática...`);

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
                  details: singleError.details,
                  hint: singleError.hint
                }
              });
              console.error(`[Insert] Row ${i + j} failed:`, {
                poliza: singleItem.poliza,
                vendor: singleItem.vendor_name_raw,
                error: singleError
              });
            } else {
              insertedCount++;
            }
          } catch (individualError: any) {
            errors.push({
              row_index: i + j,
              item: singleItem,
              error: {
                message: individualError.message,
                stack: individualError.stack
              }
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
        error: {
          message: chunkError.message,
          stack: chunkError.stack
        }
      });
    }
  }

  return {
    success: errors.length === 0,
    insertedCount,
    errors
  };
}

function extractDatabaseError(error: any): { code: string; message: string; constraint?: string; detail?: string } {
  // Extraer información del error de PostgreSQL
  const pgError = {
    code: error.code || 'UNKNOWN',
    message: error.message || 'Unknown database error',
    constraint: error.constraint || undefined,
    detail: error.details || error.detail || undefined
  };

  // Mapear códigos de error de PostgreSQL a mensajes amigables
  const errorMap: Record<string, string> = {
    '23502': 'NOT_NULL_VIOLATION',
    '23503': 'FOREIGN_KEY_VIOLATION',
    '23505': 'UNIQUE_VIOLATION',
    '23514': 'CHECK_VIOLATION',
    '22P02': 'INVALID_TEXT_REPRESENTATION',
    '22003': 'NUMERIC_VALUE_OUT_OF_RANGE',
    '42P01': 'UNDEFINED_TABLE',
    '42703': 'UNDEFINED_COLUMN'
  };

  const mappedCode = errorMap[pgError.code] || pgError.code;

  return {
    code: mappedCode,
    message: pgError.message,
    constraint: pgError.constraint,
    detail: pgError.detail
  };
}

function getWeekInfo(dateStr: string): { week_number: number; period_start: string; period_end: string } {
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

    // VALIDACIÓN 1: Verificar que el batch existe
    const { data: importBatch, error: batchError } = await supabase
      .from("document_import_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !importBatch) {
      const result: ConversionResult = {
        success: false,
        code: "BATCH_NOT_FOUND",
        message: "El lote de importación no existe",
        details: { batchId }
      };
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // VALIDACIÓN 2: Verificar que no fue convertido previamente
    if (importBatch.converted_to_commissions) {
      const result: ConversionResult = {
        success: false,
        code: "ALREADY_CONVERTED",
        message: "Este lote ya fue convertido anteriormente",
        details: {
          batchId,
          commission_batch_ids: importBatch.commission_batch_ids
        }
      };
      return new Response(JSON.stringify(result), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // VALIDACIÓN 3: Contar items de origen (CRÍTICO: debe ser > 0)
    const { count: sourceCount, error: countError } = await supabase
      .from("imported_documents")
      .select("*", { count: 'exact', head: true })
      .eq("batch_id", batchId);

    if (countError) {
      throw countError;
    }

    if (!sourceCount || sourceCount === 0) {
      const result: ConversionResult = {
        success: false,
        code: "NO_SOURCE_ITEMS",
        message: "No hay documentos para convertir. El batch está vacío o no se guardó correctamente.",
        details: {
          batchId,
          totalSourceItems: 0
        }
      };
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Conversion] Iniciando conversión de batch ${batchId} con ${sourceCount} items`);

    // CREAR CONVERSION JOB para auditoría
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
      console.error("Error creating conversion job:", jobError);
      throw new Error("Failed to create conversion job");
    }

    conversionJobId = conversionJob.id;
    console.log(`[Conversion] Job created: ${conversionJobId}`);

    // Obtener todos los documentos
    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batchId);

    if (docsError || !documents) {
      throw new Error("Failed to fetch documents");
    }

    // REGLA DE ORO: FPago es la única fecha válida para comisiones.
    // Agrupar por semana usando FPago
    const weekGroups: Record<string, WeekGroup> = {};
    const noDateGroup: any[] = [];

    for (const doc of documents) {
      const docData = doc.document_data || {};
      const fpagoField = docData.FPago;

      if (!fpagoField || fpagoField === '') {
        noDateGroup.push(doc);
        continue;
      }

      try {
        const weekInfo = getWeekInfo(fpagoField);
        const key = `${weekInfo.week_number}-${weekInfo.period_start}`;

        if (!weekGroups[key]) {
          weekGroups[key] = {
            week_number: weekInfo.week_number,
            period_start: weekInfo.period_start,
            period_end: weekInfo.period_end,
            documents: [],
          };
        }

        weekGroups[key].documents.push(doc);
      } catch (error) {
        console.error("Error parsing FPago for document:", doc.document_id, error);
        noDateGroup.push(doc);
      }
    }

    const createdBatches: Array<{
      id: string;
      week_number: number;
      period_start: string | null;
      period_end: string | null;
      display_name: string;
      items: number;
    }> = [];
    const createdBatchIds: string[] = [];
    let totalInsertedItems = 0;
    const allValidationErrors: any[] = [];
    const allInsertErrors: any[] = [];

    // CREAR LOTES - Solo si tienen items (anti-lotes-vacíos)

    // 1. Crear lote "Sin fecha" si hay documentos sin FPago
    if (noDateGroup.length > 0) {
      console.log(`[Conversion] Creando lote "Sin fecha" con ${noDateGroup.length} items`);

      const noDateBatchName = "Sin fecha (FPago no definido)";

      const { data: noDateCommissionBatch, error: noDateCreateError } = await supabase
        .from("commission_batches")
        .insert({
          name: noDateBatchName,
          date_from: null,
          date_to: null,
          uploaded_by: user.id,
          status: "draft",
          source_type: "excel_import",
          source_id: batchId,
          week_number: 0,
          period_start: null,
          period_end: null,
          converted_from_import_at: new Date().toISOString(),
          converted_by: user.id,
        })
        .select()
        .single();

      if (noDateCreateError || !noDateCommissionBatch) {
        console.error("Error creating no-date commission batch:", noDateCreateError);
        const dbError = extractDatabaseError(noDateCreateError);
        throw new Error(`DB_INSERT_FAILED: ${dbError.message} (${dbError.code})`);
      }

      createdBatchIds.push(noDateCommissionBatch.id);

      // Normalizar items
      const noDateCommissionItems = noDateGroup.map((doc, index) =>
        normalizeCommissionItem(doc, noDateCommissionBatch.id)
      );

      // Pre-validar items
      noDateCommissionItems.forEach((item, index) => {
        const errors = validateCommissionItem(item, index);
        if (errors.length > 0) {
          allValidationErrors.push(...errors);
        }
      });

      // Insertar en chunks
      const insertResult = await insertItemsInChunks(supabase, noDateCommissionItems);

      if (!insertResult.success) {
        allInsertErrors.push(...insertResult.errors);
        console.error(`[Conversion] Errores en inserción de lote "Sin fecha":`, insertResult.errors);
      }

      totalInsertedItems += insertResult.insertedCount;

      createdBatches.push({
        id: noDateCommissionBatch.id,
        week_number: 0,
        period_start: null,
        period_end: null,
        display_name: noDateBatchName,
        items: insertResult.insertedCount
      });

      console.log(`[Conversion] Lote "Sin fecha" creado con ${insertResult.insertedCount} items (${insertResult.errors.length} errores)`);
    }

    // 2. Crear lotes por semana
    for (const [key, group] of Object.entries(weekGroups)) {
      // ANTI-LOTES-VACÍOS: Saltar si no hay items
      if (group.documents.length === 0) {
        console.log(`[Conversion] Saltando grupo vacío para semana ${group.week_number}`);
        continue;
      }

      console.log(`[Conversion] Creando lote para semana ${group.week_number} con ${group.documents.length} items`);

      const batchName = `Semana ${group.week_number} (${group.period_start} a ${group.period_end})`;

      const { data: commissionBatch, error: createError } = await supabase
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
          converted_by: user.id,
        })
        .select()
        .single();

      if (createError || !commissionBatch) {
        console.error("Error creating commission batch:", createError);
        const dbError = extractDatabaseError(createError);
        throw new Error(`DB_INSERT_FAILED: Failed to create batch for week ${group.week_number}: ${dbError.message} (${dbError.code})`);
      }

      createdBatchIds.push(commissionBatch.id);

      // Normalizar items
      const commissionItems = group.documents.map((doc) =>
        normalizeCommissionItem(doc, commissionBatch.id)
      );

      // Pre-validar items
      commissionItems.forEach((item, index) => {
        const errors = validateCommissionItem(item, index);
        if (errors.length > 0) {
          allValidationErrors.push(...errors.map(e => ({ ...e, week_number: group.week_number })));
        }
      });

      // Insertar en chunks
      const insertResult = await insertItemsInChunks(supabase, commissionItems);

      if (!insertResult.success) {
        allInsertErrors.push(...insertResult.errors.map(e => ({ ...e, week_number: group.week_number })));
        console.error(`[Conversion] Errores en inserción de semana ${group.week_number}:`, insertResult.errors);
      }

      totalInsertedItems += insertResult.insertedCount;

      createdBatches.push({
        id: commissionBatch.id,
        week_number: group.week_number,
        period_start: group.period_start,
        period_end: group.period_end,
        display_name: batchName,
        items: insertResult.insertedCount
      });

      console.log(`[Conversion] Lote semana ${group.week_number} creado con ${insertResult.insertedCount} items (${insertResult.errors.length} errores)`);
    }

    // VALIDACIÓN FINAL CRÍTICA: Debe haber al menos 1 lote con items
    if (createdBatches.length === 0 || totalInsertedItems === 0) {
      console.error("NO_ITEMS_CONVERTED: No se crearon lotes o todos quedaron vacíos");

      // Guardar errores de validación e inserción en el job
      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error_code: "NO_ITEMS_CONVERTED",
          error_message: "No se pudieron insertar items en los lotes",
          conversion_report: {
            validation_errors: allValidationErrors,
            insert_errors: allInsertErrors
          }
        })
        .eq("id", conversionJobId);

      throw new Error("NO_ITEMS_CONVERTED");
    }

    // Si hay errores de inserción pero sí se insertó algo, reportarlo
    if (allInsertErrors.length > 0) {
      console.warn(`[Conversion] Conversión parcial: ${totalInsertedItems} items insertados, ${allInsertErrors.length} errores`);
    }

    console.log(`[Conversion] Conversión exitosa: ${createdBatches.length} lotes, ${totalInsertedItems} items`);

    // Marcar batch como convertido
    await supabase
      .from("document_import_batches")
      .update({
        converted_to_commissions: true,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        commission_batch_ids: createdBatchIds,
      })
      .eq("id", batchId);

    // Actualizar conversion job como success
    const duration = Date.now() - startTime;
    await supabase
      .from("conversion_jobs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        total_inserted_items: totalInsertedItems,
        created_batch_count: createdBatches.length,
        created_batch_ids: createdBatchIds,
        conversion_report: {
          batches: createdBatches,
          summary: {
            sourceCount,
            insertedCount: totalInsertedItems,
            verified: true
          },
          validation_errors: allValidationErrors,
          insert_errors: allInsertErrors
        }
      })
      .eq("id", conversionJobId);

    // Respuesta de éxito (puede ser parcial si hay errores)
    const result: ConversionResult = {
      success: true,
      createdBatches,
      totalSourceItems: sourceCount,
      totalInsertedItems,
      conversion_job_id: conversionJobId,
      ...(allInsertErrors.length > 0 && {
        details: {
          warning: "Conversión parcial: algunos items no pudieron ser insertados",
          errors_count: allInsertErrors.length,
          validation_errors_count: allValidationErrors.length
        }
      })
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Conversion] Error:", error);

    const duration = Date.now() - startTime;

    // Extraer error de base de datos si aplica
    const dbError = extractDatabaseError(error);

    // Actualizar conversion job como failed
    if (conversionJobId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("conversion_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          error_code: dbError.code,
          error_message: dbError.message,
          error_stack: error.stack
        })
        .eq("id", conversionJobId);
    }

    const result: ConversionResult = {
      success: false,
      code: dbError.code,
      message: error.message || "Error desconocido al convertir el lote",
      details: {
        error: error.toString(),
        ...(dbError.constraint && { constraint: dbError.constraint }),
        ...(dbError.detail && { detail: dbError.detail })
      },
      db: {
        code: dbError.code,
        message: dbError.message,
        constraint: dbError.constraint,
        detail: dbError.detail
      },
      conversion_job_id: conversionJobId || undefined
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
