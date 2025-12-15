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

    const { data: importBatch, error: batchError } = await supabase
      .from("document_import_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !importBatch) {
      throw new Error("Import batch not found");
    }

    if (importBatch.converted_to_commissions) {
      return new Response(
        JSON.stringify({
          error: "This batch has already been converted to commissions",
          commission_batch_ids: importBatch.commission_batch_ids
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select("*")
      .eq("batch_id", batchId);

    if (docsError || !documents || documents.length === 0) {
      throw new Error("No documents found in this batch");
    }

    const weekGroups: Record<string, WeekGroup> = {};
    const noDateGroup: any[] = [];

    for (const doc of documents) {
      const docData = doc.document_data || {};

      // REGLA DE ORO: FPago es la única fecha válida para comisiones.
      // Si no existe o no parsea, el documento va a "Sin fecha".
      // Nunca se bloquea la conversión por fecha.
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

    const createdBatchIds: string[] = [];

    if (noDateGroup.length > 0) {
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

      if (!noDateCreateError && noDateCommissionBatch) {
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
            pending_date: true,
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

        const { error: noDateItemsError } = await supabase
          .from("commission_details")
          .insert(noDateCommissionItems);

        if (noDateItemsError) {
          console.error("Error inserting no-date commission items:", noDateItemsError);
        }
      }
    }

    for (const [, group] of Object.entries(weekGroups)) {
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
        continue;
      }

      createdBatchIds.push(commissionBatch.id);

      const commissionItems = group.documents.map((doc) => {
        const docData = doc.document_data || {};

        return {
          batch_id: commissionBatch.id,
          agent_id: doc.movi_user_id ? null : null,
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

      const { error: itemsError } = await supabase
        .from("commission_details")
        .insert(commissionItems);

      if (itemsError) {
        console.error("Error inserting commission items:", itemsError);
      }
    }

    await supabase
      .from("document_import_batches")
      .update({
        converted_to_commissions: true,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
        commission_batch_ids: createdBatchIds,
      })
      .eq("id", batchId);

    const weekBatchesCreated = Object.keys(weekGroups).length;
    const hasNoDateBatch = noDateGroup.length > 0;

    let message = `Se crearon ${createdBatchIds.length} lote(s) de comisiones exitosamente.`;

    if (hasNoDateBatch && weekBatchesCreated > 0) {
      message = `Convertido. Se crearon ${weekBatchesCreated} lote(s) por semana y 1 lote especial "Sin fecha" con ${noDateGroup.length} documento(s).`;
    } else if (hasNoDateBatch) {
      message = `Se creó 1 lote especial "Sin fecha" con ${noDateGroup.length} documento(s) que requieren revisión.`;
    } else if (weekBatchesCreated > 0) {
      message = `Se crearon ${weekBatchesCreated} lote(s) por semana exitosamente.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: message,
        commission_batch_ids: createdBatchIds,
        weeks_created: weekBatchesCreated,
        no_date_documents: noDateGroup.length,
        has_no_date_batch: hasNoDateBatch,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error converting import to commissions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
