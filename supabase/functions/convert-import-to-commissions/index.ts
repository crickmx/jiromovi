import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WeekGroup {
  week_number: number;
  week_start: string;
  week_end: string;
  documents: any[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener el authHeader y crear cliente autenticado
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar que es administrador
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (!usuario || usuario.rol !== "Administrador") {
      return new Response(
        JSON.stringify({ error: "Solo los administradores pueden convertir batches" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obtener el batch_id del body
    const { batch_id } = await req.json();

    if (!batch_id) {
      return new Response(
        JSON.stringify({ error: "batch_id es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar que el batch puede convertirse
    const { data: validation } = await supabase.rpc(
      "validate_batch_for_conversion",
      { batch_id_param: batch_id }
    );

    if (!validation || !validation.can_convert) {
      return new Response(
        JSON.stringify({
          error: "El batch no puede convertirse",
          validation,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obtener TODOS los documentos del batch (incluyendo los sin usuario asignado)
    const { data: documents, error: docsError } = await supabase
      .from("imported_documents")
      .select(`
        *,
        movi_user:usuarios!movi_user_id(
          id,
          nombre_completo,
          email_laboral,
          email_personal
        )
      `)
      .eq("batch_id", batch_id);

    if (docsError || !documents || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se encontraron documentos para convertir" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Agrupar documentos por semana
    const weekGroups = new Map<string, WeekGroup>();

    for (const doc of documents) {
      const fechaPago = doc.document_data?.fecha_pago;
      if (!fechaPago) continue;

      const fecha = new Date(fechaPago);

      // Calcular inicio de semana (lunes)
      const dayOfWeek = fecha.getDay();
      const diff = fecha.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(fecha.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);

      // Calcular fin de semana (domingo)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Obtener número de semana ISO
      const weekNumber = getISOWeek(new Date(fechaPago));
      const yearNumber = new Date(fechaPago).getFullYear();
      const weekKey = `${yearNumber}-W${weekNumber}`;

      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, {
          week_number: weekNumber,
          week_start: weekStart.toISOString().split("T")[0],
          week_end: weekEnd.toISOString().split("T")[0],
          documents: [],
        });
      }

      weekGroups.get(weekKey)!.documents.push(doc);
    }

    // Obtener información del batch
    const { data: batchInfo } = await supabase
      .from("document_import_batches")
      .select("file_name")
      .eq("id", batch_id)
      .single();

    // Crear lotes de comisiones por cada semana
    const createdBatches = [];

    for (const [weekKey, weekGroup] of weekGroups.entries()) {
      // Crear el lote de comisiones
      const { data: commissionBatch, error: batchError } = await supabase
        .from("commission_batches")
        .insert({
          name: `${batchInfo?.file_name || "Importación"} - Semana ${weekGroup.week_number}`,
          date_from: weekGroup.week_start,
          date_to: weekGroup.week_end,
          uploaded_by: user.id,
          status: "draft",
          source_import_batch_id: batch_id,
          week_number: weekGroup.week_number,
          period_start: weekGroup.week_start,
          period_end: weekGroup.week_end,
          source_file: batchInfo?.file_name || null,
        })
        .select()
        .single();

      if (batchError || !commissionBatch) {
        console.error("Error creando batch:", batchError);
        continue;
      }

      // Crear los detalles de comisiones a partir de los documentos
      const commissionDetails = [];

      for (const doc of weekGroup.documents) {
        const docData = doc.document_data || {};

        let agentId = null;
        let pendingAssignment = false;
        let assignmentStatus = "assigned";
        let vendorGroupKey = null;

        // Si tiene usuario asignado, usar directamente el usuario_id
        if (doc.movi_user_id && doc.movi_user) {
          agentId = doc.movi_user_id;
        } else {
          // Documento SIN usuario asignado
          pendingAssignment = true;
          assignmentStatus = "unassigned";

          // Generar vendor_group_key para poder agrupar después
          const vendorEmail = doc.vendor_email_norm || docData.email_vendedor;
          const vendorName = doc.vendor_name_norm || docData.vendedor || docData.nombre_vendedor;

          if (vendorEmail) {
            vendorGroupKey = `email:${vendorEmail.toLowerCase().trim()}`;
          } else if (vendorName) {
            vendorGroupKey = `name:${vendorName.toLowerCase().trim()}`;
          } else {
            vendorGroupKey = `unknown:${doc.id}`;
          }
        }

        // Calcular valores para comisión
        const primaNeta = parseFloat(docData.prima_neta || docData.prima || 0);
        const importeBase = parseFloat(docData.importe_base || docData.prima_base || primaNeta);
        const comisionBruta = parseFloat(docData.comision_bruta || docData.comision || 0);
        const comisionNeta = parseFloat(docData.comision_neta || comisionBruta);
        const porcentajeComision = importeBase > 0 ? (comisionBruta / importeBase * 100) : 0;

        commissionDetails.push({
          batch_id: commissionBatch.id,
          usuario_id: agentId, // puede ser null
          ramo: docData.ramo || "Sin especificar",
          aseguradora: docData.aseguradora || docData.aseguradora_abreviacion || "Sin especificar",
          poliza: docData.poliza || docData.documento || doc.document_id,
          prima_neta: primaNeta,
          importe_base: importeBase,
          porcentaje_comision: porcentajeComision,
          concepto: docData.concepto || null,
          nombre_asegurado: docData.nombre_asegurado || docData.asegurado || null,
          date_fpago: docData.fecha_pago,
          commission_bruta: comisionBruta,
          impuestos_json: {},
          commission_neta: comisionNeta,
          raw_row: docData,
          // Nuevos campos para manejo de pendientes
          pending_assignment: pendingAssignment,
          assignment_status: assignmentStatus,
          vendor_group_key: vendorGroupKey,
          vendor_name_raw: doc.vendor_name_raw || docData.vendedor || null,
          vendor_email_raw: doc.vendor_email_raw || docData.email_vendedor || null,
        });
      }

      // Insertar todos los detalles
      if (commissionDetails.length > 0) {
        const { error: detailsError } = await supabase
          .from("commission_details")
          .insert(commissionDetails);

        if (detailsError) {
          console.error("Error insertando detalles:", detailsError);
        }
      }

      // Contar documentos pendientes en este lote
      const { count: pendingCount } = await supabase
        .from("commission_details")
        .select("*", { count: "exact", head: true })
        .eq("batch_id", commissionBatch.id)
        .eq("pending_assignment", true);

      createdBatches.push({
        id: commissionBatch.id,
        week_number: weekGroup.week_number,
        period_start: weekGroup.week_start,
        period_end: weekGroup.week_end,
        document_count: weekGroup.documents.length,
        pending_count: pendingCount || 0,
      });
    }

    // Marcar el batch como convertido
    await supabase
      .from("document_import_batches")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        conversion_summary: {
          total_batches_created: createdBatches.length,
          total_documents_converted: documents.length,
          batches: createdBatches,
        },
      })
      .eq("id", batch_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se crearon ${createdBatches.length} lotes de comisiones`,
        batches: createdBatches,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en convert-import-to-commissions:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Función auxiliar para calcular semana ISO
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
