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
        throw new Error("Failed to create no-date commission batch");
      }

      createdBatchIds.push(noDateCommissionBatch.id);

      const noDateCommissionItems = noDateGroup.map((doc) => {
        const docData = doc.document_data || {};

        return {
          batch_id: noDateCommissionBatch.id,
          agent_id: null,
          movi_user_id: doc.movi_user_id,
          vendor_email_raw: doc.vendor_email_raw,
          vendor_email_norm: doc.vendor_email_norm,
          vendor_name_raw: doc.vendor_name_raw,
          vendor_name_norm: doc.vendor_name_norm,
          vendor_key: doc.vendor_key,
          match_method: doc.match_method,
          pending_assignment: doc.is_unmatched || !doc.movi_user_id,
          ramo: docData.ramo || docData.branch || "N/A",
          aseguradora: docData.aseguradora || docData.insurer || "N/A",
          poliza: docData.poliza || docData.policy || doc.document_id,
          prima_base: parseFloat(docData.prima_neta || docData.net_premium || "0") || 0,
          prima_neta: parseFloat(docData.prima_neta || docData.net_premium || "0") || 0,
          importe_base: parseFloat(docData.importe_base || docData.base_amount || docData.prima_neta || "0") || 0,
          concepto: docData.concepto || docData.concept || null,
          date_fpago: null,
          commission_bruta: parseFloat(docData.comision_bruta || docData.gross_commission || "0") || 0,
          commission_neta: parseFloat(docData.comision_neta || docData.net_commission || "0") || 0,
          porcentaje_comision: parseFloat(docData.porcentaje || docData.percentage || "0") || 0,
          porcentaje_base: parseFloat(docData.porcentaje_base || docData.base_percentage || "0") || 0,
          nombre_asegurado: docData.nombre_asegurado || docData.insured_name || null,
          raw_row: docData,
        };
      });

      const { data: insertedNoDateItems, error: noDateItemsError } = await supabase
        .from("commission_details")
        .insert(noDateCommissionItems)
        .select();

      if (noDateItemsError) {
        console.error("Error inserting no-date commission items:", noDateItemsError);
        throw new Error("Failed to insert no-date commission items");
      }

      // VERIFICACIÓN POST-INSERT CRÍTICA
      const insertedCount = insertedNoDateItems?.length || 0;
      if (insertedCount !== noDateGroup.length) {
        console.error(`MISMATCH: Expected ${noDateGroup.length} items, inserted ${insertedCount}`);
        throw new Error(`DB_INSERT_MISMATCH: Expected ${noDateGroup.length}, got ${insertedCount}`);
      }

      totalInsertedItems += insertedCount;

      createdBatches.push({
        id: noDateCommissionBatch.id,
        week_number: 0,
        period_start: null,
        period_end: null,
        display_name: noDateBatchName,
        items: insertedCount
      });

      console.log(`[Conversion] Lote "Sin fecha" creado con ${insertedCount} items`);
    }

    // 2. Crear lotes por semana
    for (const [, group] of Object.entries(weekGroups)) {
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
        throw new Error(`Failed to create commission batch for week ${group.week_number}`);
      }

      createdBatchIds.push(commissionBatch.id);

      const commissionItems = group.documents.map((doc) => {
        const docData = doc.document_data || {};

        return {
          batch_id: commissionBatch.id,
          agent_id: null,
          movi_user_id: doc.movi_user_id,
          vendor_email_raw: doc.vendor_email_raw,
          vendor_email_norm: doc.vendor_email_norm,
          vendor_name_raw: doc.vendor_name_raw,
          vendor_name_norm: doc.vendor_name_norm,
          vendor_key: doc.vendor_key,
          match_method: doc.match_method,
          pending_assignment: doc.is_unmatched || !doc.movi_user_id,
          ramo: docData.ramo || docData.branch || "N/A",
          aseguradora: docData.aseguradora || docData.insurer || "N/A",
          poliza: docData.poliza || docData.policy || doc.document_id,
          prima_base: parseFloat(docData.prima_neta || docData.net_premium || "0") || 0,
          prima_neta: parseFloat(docData.prima_neta || docData.net_premium || "0") || 0,
          importe_base: parseFloat(docData.importe_base || docData.base_amount || docData.prima_neta || "0") || 0,
          concepto: docData.concepto || docData.concept || null,
          date_fpago: docData.FPago || group.period_start,
          commission_bruta: parseFloat(docData.comision_bruta || docData.gross_commission || "0") || 0,
          commission_neta: parseFloat(docData.comision_neta || docData.net_commission || "0") || 0,
          porcentaje_comision: parseFloat(docData.porcentaje || docData.percentage || "0") || 0,
          porcentaje_base: parseFloat(docData.porcentaje_base || docData.base_percentage || "0") || 0,
          nombre_asegurado: docData.nombre_asegurado || docData.insured_name || null,
          raw_row: docData,
        };
      });

      const { data: insertedItems, error: itemsError } = await supabase
        .from("commission_details")
        .insert(commissionItems)
        .select();

      if (itemsError) {
        console.error("Error inserting commission items:", itemsError);
        throw new Error(`Failed to insert items for week ${group.week_number}`);
      }

      // VERIFICACIÓN POST-INSERT CRÍTICA
      const insertedCount = insertedItems?.length || 0;
      if (insertedCount !== group.documents.length) {
        console.error(`MISMATCH: Expected ${group.documents.length} items, inserted ${insertedCount}`);
        throw new Error(`DB_INSERT_MISMATCH: Expected ${group.documents.length}, got ${insertedCount}`);
      }

      totalInsertedItems += insertedCount;

      createdBatches.push({
        id: commissionBatch.id,
        week_number: group.week_number,
        period_start: group.period_start,
        period_end: group.period_end,
        display_name: batchName,
        items: insertedCount
      });

      console.log(`[Conversion] Lote semana ${group.week_number} creado con ${insertedCount} items`);
    }

    // VALIDACIÓN FINAL CRÍTICA: Debe haber al menos 1 lote con items
    if (createdBatches.length === 0 || totalInsertedItems === 0) {
      console.error("NO_ITEMS_CONVERTED: No se crearon lotes o todos quedaron vacíos");
      throw new Error("NO_ITEMS_CONVERTED");
    }

    // VERIFICACIÓN TOTAL
    if (totalInsertedItems !== sourceCount) {
      console.error(`TOTAL MISMATCH: Source ${sourceCount}, Inserted ${totalInsertedItems}`);
      throw new Error(`TOTAL_MISMATCH: Expected ${sourceCount}, got ${totalInsertedItems}`);
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
          }
        }
      })
      .eq("id", conversionJobId);

    // Respuesta de éxito
    const result: ConversionResult = {
      success: true,
      createdBatches,
      totalSourceItems: sourceCount,
      totalInsertedItems,
      conversion_job_id: conversionJobId
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Conversion] Error:", error);

    const duration = Date.now() - startTime;

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
          error_code: error.message?.includes("_") ? error.message : "UNKNOWN",
          error_message: error.message || "Unknown error",
          error_stack: error.stack
        })
        .eq("id", conversionJobId);
    }

    const result: ConversionResult = {
      success: false,
      code: error.message?.includes("_") ? error.message : "UNKNOWN",
      message: error.message || "Error desconocido al convertir el lote",
      details: { error: error.toString() },
      conversion_job_id: conversionJobId || undefined
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
