import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  SicasSoapReportClient,
  SICAS_REPORT_KEYCODES,
} from "../_shared/sicasSoapReportClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[SICAS Sync] Iniciando sincronizacion de polizas vigentes");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: run, error: runError } = await supabase
      .from("sicas_sync_runs")
      .insert({
        module: "documents",
        keycode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
        report_name: "Polizas Vigentes",
        items_per_page: 200,
      })
      .select()
      .single();

    if (runError) throw runError;
    console.log("[SICAS Sync] Run creado:", run.run_id);

    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");
    const sicasEndpoint =
      Deno.env.get("SICAS_SOAP_ENDPOINT") ||
      "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";

    if (!sicasUsername || !sicasPassword) {
      throw new Error("Credenciales SICAS no configuradas");
    }

    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    const sixMonthsAhead = new Date(today);
    sixMonthsAhead.setMonth(today.getMonth() + 6);

    const dateFrom = sixMonthsAgo
      .toISOString()
      .split("T")[0]
      .split("-")
      .reverse()
      .join("/");
    const dateTo = sixMonthsAhead
      .toISOString()
      .split("T")[0]
      .split("-")
      .reverse()
      .join("/");

    const filters = [
      SicasSoapReportClient.createStatusVicenteFilter(),
      SicasSoapReportClient.createDocumentTypeFilter(),
      SicasSoapReportClient.createDateRangeFilter(
        dateFrom,
        dateTo,
        dateFrom,
        dateTo,
        "DatDocumentos.FDesde"
      ),
    ];

    console.log(`[SICAS Sync] Filtros: desde=${dateFrom}, hasta=${dateTo}`);

    // -- Load vendor-to-user and despacho-to-oficina mappings --
    const [vendorMappingsR, despachoMappingsR] = await Promise.all([
      supabase
        .from("sicas_mapeo_vendedor_usuario")
        .select("id_sicas_vendedor, movi_user_id"),
      supabase
        .from("sicas_mapeo_despacho_oficina")
        .select("id_sicas_despacho, movi_oficina_id"),
    ]);

    const vendorToUser = new Map<string, string>();
    for (const m of vendorMappingsR.data || []) {
      vendorToUser.set(String(m.id_sicas_vendedor), m.movi_user_id);
    }

    const despachoToOficina = new Map<string, string>();
    for (const m of despachoMappingsR.data || []) {
      despachoToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
    }

    // Also load user oficina_id for fallback
    const userIds = [...new Set(vendorToUser.values())];
    const userOficinaMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, oficina_id")
        .in("id", userIds);
      for (const u of usuarios || []) {
        if (u.oficina_id) userOficinaMap.set(u.id, u.oficina_id);
      }
    }

    console.log(
      `[SICAS Sync] Mappings: ${vendorToUser.size} vendedores, ${despachoToOficina.size} despachos`
    );

    // -- Paginated fetch: loop through ALL pages --
    const itemsPerPage = 200;
    const maxPages = 50;
    const allRecords: any[] = [];
    let currentPage = 1;

    while (currentPage <= maxPages) {
      console.log(
        `[SICAS Sync] Fetching page ${currentPage} (${itemsPerPage} items/page)...`
      );

      const result = await client.executeReport({
        keyCode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
        page: currentPage,
        itemsPerPage,
        sortField: "DatDocumentos.FCaptura DESC",
        filters,
      });

      if (!result.success) {
        console.error(`[SICAS Sync] Error en pagina ${currentPage}:`, result.message);
        break;
      }

      console.log(
        `[SICAS Sync] Pagina ${currentPage}: ${result.records.length} registros`
      );

      if (result.records.length === 0) {
        console.log("[SICAS Sync] Pagina vacia, finalizando paginacion");
        break;
      }

      allRecords.push(...result.records);
      currentPage++;

      if (result.records.length < itemsPerPage) {
        console.log("[SICAS Sync] Ultima pagina alcanzada (menos registros que el limite)");
        break;
      }
    }

    console.log(
      `[SICAS Sync] Total registros obtenidos: ${allRecords.length} en ${currentPage - 1} paginas`
    );

    let insertedCount = 0;
    let errorCount = 0;

    if (allRecords.length > 0) {
      // Map records to sicas_documents schema with correct user/office mapping
      const documents = allRecords.map((record: any) => {
        const vendId = String(
          record.IDVend || record.IdVendedor || "0"
        );
        const despId = String(
          record.IDDesp || record.IdDespacho || "0"
        );
        const userId = vendorToUser.get(vendId) || null;
        let oficinaId = despachoToOficina.get(despId) || null;
        if (!oficinaId && userId) {
          oficinaId = userOficinaMap.get(userId) || null;
        }

        return {
          id_docto:
            record.IdDocumento ||
            record.IDDocto ||
            `DOC_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          vend_id: vendId,
          vend_nombre:
            (record.VendNombre || record.Vendedor || "").trim() || null,
          usuario_id: userId,
          oficina_id: oficinaId,
          desp_nombre:
            record.DespNombre || record.Despacho || null,
          ramo: record.RamoNombre || record.Ramo || null,
          subramo: record.SubramoNombre || record.Subramo || null,
          compania: record.CiaNombre || record.Aseguradora || null,
          poliza: record.Documento || record.NoPoliza || null,
          cliente: record.Contratante || record.Cliente || null,
          fecha_captura: record.FCaptura || null,
          fecha_emision: record.FEmision || null,
          vigencia_desde: record.FDesde || null,
          vigencia_hasta: record.FHasta || null,
          importe: parseFloat(record.Importe) || 0,
          prima_neta: parseFloat(record.ImporteNeto || record.PrimaNeta) || 0,
          raw_data: record,
          raw_hash: JSON.stringify(record),
          synced_at: new Date().toISOString(),
        };
      });

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const { error: upsertError, data: upserted } = await supabase
          .from("sicas_documents")
          .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
          .select("id");

        if (upsertError) {
          console.error(
            `[SICAS Sync] Error en lote ${Math.floor(i / batchSize) + 1}:`,
            upsertError.message
          );
          errorCount += batch.length;
        } else {
          insertedCount += upserted?.length || batch.length;
        }
      }

      console.log(
        `[SICAS Sync] Guardados: ${insertedCount} exitosos, ${errorCount} errores`
      );

      // Also upsert into sicas_polizas_vigentes table for backwards compatibility
      const polizasVigentes = allRecords.map((record: any) => {
        const vendId = String(record.IDVend || record.IdVendedor || "0");
        const despId = String(record.IDDesp || record.IdDespacho || "0");
        const userId = vendorToUser.get(vendId) || null;
        let oficinaId = despachoToOficina.get(despId) || null;
        if (!oficinaId && userId) {
          oficinaId = userOficinaMap.get(userId) || null;
        }

        return {
          id_documento:
            record.IdDocumento ||
            record.IDDocto ||
            `DOC_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          no_poliza: record.Documento || record.NoPoliza || null,
          vend_id: vendId,
          vend_nombre:
            (record.VendNombre || record.Vendedor || "").trim() || null,
          desp_id: despId,
          desp_nombre: record.DespNombre || record.Despacho || null,
          aseguradora: record.CiaNombre || record.Aseguradora || null,
          ramo: record.RamoNombre || record.Ramo || null,
          subramo: record.SubramoNombre || record.Subramo || null,
          contratante: record.Contratante || record.Cliente || null,
          asegurado: record.Asegurado || null,
          vigencia_desde: record.FDesde || null,
          vigencia_hasta: record.FHasta || null,
          prima_neta: parseFloat(record.ImporteNeto || record.PrimaNeta) || null,
          prima_total: parseFloat(record.Importe || record.PrimaTotal) || null,
          usuario_id: userId,
          oficina_id: oficinaId,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      for (let i = 0; i < polizasVigentes.length; i += batchSize) {
        const batch = polizasVigentes.slice(i, i + batchSize);
        const { error } = await supabase
          .from("sicas_polizas_vigentes")
          .upsert(batch, { onConflict: "id_documento", ignoreDuplicates: false });
        if (error) {
          console.error("[SICAS Sync] Error sicas_polizas_vigentes lote:", error.message);
        }
      }
    }

    // Update sync run as successful
    await supabase
      .from("sicas_sync_runs")
      .update({
        status: allRecords.length > 0 ? "success" : "empty",
        records_fetched: allRecords.length,
        records_upserted: insertedCount,
        finished_at: new Date().toISOString(),
      })
      .eq("run_id", run.run_id);

    await supabase.from("sicas_sync_cursors").upsert(
      {
        module: "documents",
        keycode: SICAS_REPORT_KEYCODES.POLIZAS_VIGENTES,
        last_success_at: new Date().toISOString(),
        last_cursor_date: new Date().toISOString(),
        total_synced: insertedCount,
        last_run_id: run.run_id,
      },
      { onConflict: "module,keycode" }
    );

    console.log("[SICAS Sync] Sincronizacion completada");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronizacion completada exitosamente",
        stats: {
          total_fetched: allRecords.length,
          records_synced: insertedCount,
          records_errors: errorCount,
          pages_processed: currentPage - 1,
          run_id: run.run_id,
          mappings_used: {
            vendedores: vendorToUser.size,
            despachos: despachoToOficina.size,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SICAS Sync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
