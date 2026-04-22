import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasRestClient } from "../_shared/sicasRestClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SyncStats {
  recordsFetched: number;
  documentsUpserted: number;
  userMapsCreated: number;
  pagesProcessed: number;
  totalInSicas: number;
  errors: number;
  durationMs: number;
  runId: string;
  keycode: string;
  perPage: Array<{
    page: number;
    fetched: number;
    accumulated: number;
    upserted: number;
    errors: number;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  let runId: string | null = null;
  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "full";
    const triggeredBy: string | null = body.triggeredBy || null;

    console.log(`[SYNC] ========== INICIO SINCRONIZACION ==========`);
    console.log(`[SYNC] Modo: ${action} | Trigger: ${triggeredBy || "manual"}`);
    console.log(`[SYNC] Timestamp: ${new Date().toISOString()}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }
    supabase = createClient(supabaseUrl, supabaseKey);

    // Prevent duplicate runs: check if there's already a running sync
    const { data: existingRun } = await supabase
      .from("sicas_sync_runs")
      .select("run_id, started_at")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRun) {
      const runAge = Date.now() - new Date(existingRun.started_at).getTime();
      if (runAge < 5 * 60 * 1000) {
        console.log(`[SYNC] Ya hay una sincronizacion en progreso (${existingRun.run_id}). Abortando.`);
        return jsonResponse(409, { ok: false, error: "Ya hay una sincronizacion en progreso. Espere a que termine." });
      }
      // Stale run older than 5 min, mark as failed
      await supabase.from("sicas_sync_runs").update({
        status: "failed",
        error_message: "Auto-closed: run stuck >5min when new sync started",
        finished_at: new Date().toISOString(),
      }).eq("run_id", existingRun.run_id);
    }

    // Load config
    const { data: configRow } = await supabase
      .from("sicas_production_config")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    const keycode = configRow?.report_keycode_all || "HWS_DOCTOS";
    const pageSize = 500;
    const maxPages = action === "full" ? 100 : 10;

    console.log(`[SYNC] Config: keycode=${keycode}, pageSize=${pageSize}, maxPages=${maxPages}`);

    // Create sync run record
    const { data: run, error: runError } = await supabase
      .from("sicas_sync_runs")
      .insert({
        module: "documents",
        keycode,
        report_name: `Sync ${action}`,
        items_per_page: pageSize,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      console.error("[SYNC] Error creando sync run:", runError.message);
      throw new Error(`Error creando registro de sync: ${runError.message}`);
    }

    runId = run.run_id;
    console.log(`[SYNC] Run ID: ${runId}`);

    // Load vendor and despacho mappings
    const [vendorMappingsR, despachoMappingsR, usuariosWithSicasR] = await Promise.all([
      supabase.from("sicas_mapeo_vendedor_usuario").select("id_sicas_vendedor, movi_user_id"),
      supabase.from("sicas_mapeo_despacho_oficina").select("id_sicas_despacho, movi_oficina_id"),
      supabase.from("usuarios").select("id, id_sicas, oficina_id").not("id_sicas", "is", null),
    ]);

    const vendorToUser = new Map<string, string>();
    const vendorToOficina = new Map<string, string>();

    for (const m of vendorMappingsR.data || []) {
      vendorToUser.set(String(m.id_sicas_vendedor), m.movi_user_id);
    }

    // Build mapping from usuarios.id_sicas
    for (const u of usuariosWithSicasR.data || []) {
      if (u.id_sicas && String(u.id_sicas).trim()) {
        const idSicas = String(u.id_sicas).trim();
        if (!vendorToUser.has(idSicas)) {
          vendorToUser.set(idSicas, u.id);
        }
        if (u.oficina_id) {
          vendorToOficina.set(idSicas, u.oficina_id);
        }
      }
    }

    const despachoToOficina = new Map<string, string>();
    for (const m of despachoMappingsR.data || []) {
      despachoToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
    }

    // User oficina fallback
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

    console.log(`[SYNC] Mappings cargados: ${vendorToUser.size} vendedor->usuario, ${despachoToOficina.size} despacho->oficina`);

    // Initialize REST client
    const client = new SicasRestClient({
      baseUrl: Deno.env.get("SICAS_REST_API_URL") || undefined,
      username: Deno.env.get("SICAS_USERNAME") || undefined,
      password: Deno.env.get("SICAS_PASSWORD") || undefined,
      sCodeAuth: Deno.env.get("SICAS_CODE_AUTH") || undefined,
    });

    // Build conditions for incremental sync
    let conditionsDirect: string | undefined;
    if (action === "incremental") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split("T")[0].split("-").reverse().join("/");
      conditionsDirect = `DatDocumentos.FCaptura>='${dateStr}'`;
      console.log(`[SYNC] Incremental filter: ${conditionsDirect}`);
    }

    // Paginated fetch
    const allRecords: Record<string, unknown>[] = [];
    let page = 1;
    let totalInSicas = 0;
    let totalPages = 1;
    const perPageStats: SyncStats["perPage"] = [];

    console.log(`[SYNC] ---- Iniciando paginacion ----`);

    while (page <= maxPages) {
      console.log(`[SYNC] Pagina ${page}/${Math.min(maxPages, totalPages)}: solicitando ${pageSize} items...`);

      let response;
      try {
        response = await client.readReport({
          keyCode: keycode,
          pageRequested: page,
          itemsForPage: pageSize,
          sortFields: "DatDocumentos.FDesde DESC",
          conditionsDirect,
        });
      } catch (err: any) {
        console.error(`[SYNC] ERROR en pagina ${page}: ${err.message}`);
        perPageStats.push({ page, fetched: 0, accumulated: allRecords.length, upserted: 0, errors: 1 });
        break;
      }

      const records = response.Response?.[0]?.TableInfo || [];
      const control = response.Response?.[0]?.TableControl?.[0];

      if (page === 1) {
        totalInSicas = control?.MaxRecords || records.length;
        totalPages = control?.Pages || 1;
        console.log(`[SYNC] SICAS reporta: MaxRecords=${totalInSicas}, Pages=${totalPages}, ItemForPage=${control?.ItemForPage || pageSize}`);
      }

      allRecords.push(...records);

      const stat = {
        page,
        fetched: records.length,
        accumulated: allRecords.length,
        upserted: 0,
        errors: 0,
      };
      perPageStats.push(stat);

      console.log(`[SYNC] Pagina ${page}: ${records.length} registros (acumulado: ${allRecords.length}/${totalInSicas})`);

      if (records.length === 0) {
        console.log(`[SYNC] Pagina ${page} vacia. Fin de paginacion.`);
        break;
      }

      if (page >= totalPages) {
        console.log(`[SYNC] Alcanzada ultima pagina (${totalPages}). Fin de paginacion.`);
        break;
      }

      page++;
    }

    if (page > maxPages && page <= totalPages) {
      console.warn(`[SYNC] ADVERTENCIA: Se alcanzo el limite de ${maxPages} paginas pero SICAS tiene ${totalPages}. Faltan datos.`);
    }

    console.log(`[SYNC] ---- Paginacion completa: ${allRecords.length} registros en ${perPageStats.length} paginas ----`);

    // Process and upsert records
    let totalUpserted = 0;
    let totalErrors = 0;
    const userMapEntries: Array<{ movi_user_id: string; sicas_identity_type: string; sicas_identity_value: string; sicas_id_docto: string; relation_source: string }> = [];

    if (allRecords.length > 0) {
      const now = new Date().toISOString();
      const today = new Date();

      const documents = allRecords.map((raw: Record<string, unknown>) => {
        const get = (keys: string[]): string => {
          for (const k of keys) {
            const val = raw[k] ?? raw[k?.toLowerCase()] ?? raw[k?.toUpperCase()];
            if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
          }
          return "";
        };
        const num = (keys: string[]): number => {
          const v = get(keys);
          if (!v) return 0;
          const n = parseFloat(v.replace(/,/g, ""));
          return isNaN(n) ? 0 : n;
        };

        const idDocto = get(["IDDocto", "IdDocto", "Id_Docto", "iddocto"]) || `DOC_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const vendId = get(["IDVend", "VendId", "Vend_Id"]);
        const despId = get(["IDDesp", "DespId"]);
        const userId = vendorToUser.get(vendId) || null;
        let oficinaId = despachoToOficina.get(despId) || vendorToOficina.get(vendId) || null;
        if (!oficinaId && userId) {
          oficinaId = userOficinaMap.get(userId) || null;
        }

        // Status resolution
        const statusTxt = get(["Status_TXT", "Estatus_TXT"]);
        const statusRaw = get(["Status", "Estatus", "StatusDoc"]);
        const statusLetterMap: Record<string, string> = { V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente" };
        const statusNumMap: Record<string, string> = { "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente" };
        const statusTexto = statusTxt || statusLetterMap[statusRaw] || statusNumMap[statusRaw] || statusRaw || "";

        // Type resolution
        const tipoDoc = get(["TipoDocto_TXT", "TipoDocto", "Tipo"]);
        const subtipoDoc = get(["SubTipoDocto_TXT", "SubTipoDocto"]);
        const tipoLower = tipoDoc.toLowerCase();
        const isPoliza = tipoLower.includes("poliza") || tipoLower.includes("póliza") || (!tipoLower.includes("fianza") && !tipoLower.includes("orden"));
        const isFianza = tipoLower.includes("fianza");

        // Vigencia check
        const fHasta = get(["FHasta", "FechaHasta", "Vigencia_Hasta"]);
        let isVigente = statusTexto.toLowerCase() === "vigente";
        let renewalDays: number | null = null;
        if (fHasta) {
          try {
            const hastaDate = new Date(fHasta);
            if (!isNaN(hastaDate.getTime())) {
              const diffMs = hastaDate.getTime() - today.getTime();
              renewalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              if (renewalDays < 0 && isVigente) isVigente = false;
            }
          } catch { /* ignore */ }
        }
        const isCancelada = statusTexto.toLowerCase() === "cancelada";
        const isRenewable = isVigente && renewalDays !== null && renewalDays >= 0 && renewalDays <= 90;

        // Build user map entry
        if (userId) {
          userMapEntries.push({
            movi_user_id: userId,
            sicas_identity_type: "vendor",
            sicas_identity_value: vendId,
            sicas_id_docto: idDocto,
            relation_source: "sync",
          });
        }

        return {
          id_docto: idDocto,
          vend_id: vendId || null,
          vend_nombre: get(["VendNombre", "Vendedor", "Vend_Nombre"]) || null,
          usuario_id: userId,
          oficina_id: oficinaId,
          desp_nombre: get(["DespNombre", "Despacho"]) || null,
          ramo: get(["RamosNombre", "Ramo", "Ramo_TXT", "NombreRamo"]) || null,
          subramo: get(["SRamoNombre", "SubRamo", "SubRamo_TXT"]) || null,
          compania: get(["CiaNombre", "Aseguradora", "Compania"]) || null,
          aseguradora_nombre: get(["CiaAbreviacion", "CiaNombre", "Abreviacion"]) || null,
          poliza: get(["Documento", "NoDocumento", "No_Documento"]) || null,
          cliente: get(["NombreCompleto", "Nombre_Completo", "Cliente", "Contratante"]) || null,
          fecha_captura: get(["FCaptura", "FechaCaptura"]) || null,
          fecha_emision: get(["FEmision", "FechaEmision"]) || null,
          vigencia_desde: get(["FDesde", "FechaDesde", "Vigencia_Desde"]) || null,
          vigencia_hasta: fHasta || null,
          importe: num(["Importe", "ImporteTotal"]),
          prima_neta: num(["PrimaNeta", "Prima_Neta", "ImporteNeto"]),
          prima_total: num(["PrimaTotal", "Prima_Total", "ImporteTotal"]),
          derechos: num(["DerechoPoliza", "Derecho"]),
          impuestos: num(["IVA", "Iva"]),
          recargos: num(["Recargos"]),
          moneda: get(["Moneda", "MonedaTXT"]) || "MXN",
          tipo_documento: tipoDoc || null,
          subtipo_documento: subtipoDoc || null,
          sicas_id_agente: get(["IDAgente", "AgenteId", "CAgente"]) || null,
          agente_nombre: get(["AgenteNombre", "Agente", "NombreAgente"]) || null,
          status_codigo: statusRaw || null,
          status_texto: statusTexto || null,
          status_cobro: get(["StatusCobro", "Status_Cobro", "EstatusCobro"]) || null,
          is_poliza: isPoliza,
          is_fianza: isFianza,
          is_vigente: isVigente,
          is_cancelada: isCancelada,
          is_renewable: isRenewable,
          renewal_days_remaining: renewalDays,
          source_keycode: keycode,
          raw_data: raw,
          raw_hash: JSON.stringify(raw),
          synced_at: now,
        };
      });

      console.log(`[SYNC] Procesados ${documents.length} documentos. Iniciando upsert...`);

      // Upsert in batches of 200
      const batchSize = 200;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(documents.length / batchSize);

        const { error: upsertError, data: upserted } = await supabase
          .from("sicas_documents")
          .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
          .select("id");

        if (upsertError) {
          console.error(`[SYNC] Error upsert lote ${batchNum}/${totalBatches}: ${upsertError.message}`);
          totalErrors += batch.length;
        } else {
          const count = upserted?.length || batch.length;
          totalUpserted += count;
          console.log(`[SYNC] Upsert lote ${batchNum}/${totalBatches}: ${count} documentos OK`);
        }
      }

      // Upsert user map entries
      if (userMapEntries.length > 0) {
        console.log(`[SYNC] Upserting ${userMapEntries.length} user-document mappings...`);
        for (let i = 0; i < userMapEntries.length; i += batchSize) {
          const batch = userMapEntries.slice(i, i + batchSize);
          const { error: mapError } = await supabase
            .from("sicas_document_user_map")
            .upsert(batch, { onConflict: "movi_user_id,sicas_id_docto", ignoreDuplicates: true });
          if (mapError) {
            console.error(`[SYNC] Error user map upsert: ${mapError.message}`);
          }
        }
        console.log(`[SYNC] User mappings upserted: ${userMapEntries.length}`);
      }

      // Also update sicas_polizas_vigentes for backward compatibility
      const polizasVigentes = allRecords.map((raw: Record<string, unknown>) => {
        const get = (keys: string[]): string => {
          for (const k of keys) {
            const val = raw[k] ?? raw[k?.toLowerCase()] ?? raw[k?.toUpperCase()];
            if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
          }
          return "";
        };
        const vendId = get(["IDVend", "VendId", "Vend_Id"]);
        const despId = get(["IDDesp", "DespId"]);
        const userId = vendorToUser.get(vendId) || null;
        let oficinaId = despachoToOficina.get(despId) || vendorToOficina.get(vendId) || null;
        if (!oficinaId && userId) oficinaId = userOficinaMap.get(userId) || null;

        return {
          id_documento: get(["IDDocto", "IdDocto"]) || `DOC_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          no_poliza: get(["Documento", "NoDocumento"]) || null,
          vend_id: vendId || null,
          vend_nombre: get(["VendNombre", "Vendedor"]) || null,
          desp_id: despId || null,
          desp_nombre: get(["DespNombre", "Despacho"]) || null,
          aseguradora: get(["CiaNombre", "Aseguradora"]) || null,
          ramo: get(["RamosNombre", "Ramo"]) || null,
          subramo: get(["SRamoNombre", "SubRamo"]) || null,
          contratante: get(["NombreCompleto", "Cliente", "Contratante"]) || null,
          asegurado: get(["Asegurado"]) || null,
          vigencia_desde: get(["FDesde", "FechaDesde"]) || null,
          vigencia_hasta: get(["FHasta", "FechaHasta"]) || null,
          prima_neta: parseFloat(get(["PrimaNeta", "ImporteNeto"]) || "0") || null,
          prima_total: parseFloat(get(["PrimaTotal", "Importe"]) || "0") || null,
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
          console.error(`[SYNC] Error sicas_polizas_vigentes: ${error.message}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const durationSeconds = Math.round(durationMs / 1000);

    // Update sync run
    await supabase
      .from("sicas_sync_runs")
      .update({
        status: totalErrors > 0 && totalUpserted === 0 ? "failed" : "completed",
        records_fetched: allRecords.length,
        records_upserted: totalUpserted,
        records_failed: totalErrors,
        finished_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        error_message: totalErrors > 0 ? `${totalErrors} errores durante upsert` : null,
      })
      .eq("run_id", runId);

    // Update sync cursor
    await supabase.from("sicas_sync_cursors").upsert(
      {
        module: "documents",
        keycode,
        last_success_at: new Date().toISOString(),
        last_cursor_date: new Date().toISOString(),
        total_synced: totalUpserted,
        last_run_id: runId,
      },
      { onConflict: "module,keycode" }
    );

    const stats: SyncStats = {
      recordsFetched: allRecords.length,
      documentsUpserted: totalUpserted,
      userMapsCreated: userMapEntries.length,
      pagesProcessed: perPageStats.length,
      totalInSicas,
      errors: totalErrors,
      durationMs,
      runId,
      keycode,
      perPage: perPageStats,
    };

    console.log(`[SYNC] ========== FIN SINCRONIZACION ==========`);
    console.log(`[SYNC] Resultado: ${totalUpserted} upserted, ${totalErrors} errors, ${perPageStats.length} pages, ${durationMs}ms`);
    console.log(`[SYNC] Total en SICAS: ${totalInSicas}, Total descargados: ${allRecords.length}`);

    return jsonResponse(200, { ok: true, stats });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[SYNC] ERROR FATAL: ${(error as Error).message}`);
    console.error(`[SYNC] Stack: ${(error as Error).stack}`);

    // Update sync run to failed if we have a run ID
    if (runId && supabase) {
      try {
        await supabase.from("sicas_sync_runs").update({
          status: "failed",
          error_message: (error as Error).message?.substring(0, 500),
          finished_at: new Date().toISOString(),
          duration_seconds: Math.round(durationMs / 1000),
        }).eq("run_id", runId);
        console.log(`[SYNC] Sync run ${runId} marcado como failed`);
      } catch (updateErr) {
        console.error(`[SYNC] No se pudo actualizar sync run: ${(updateErr as Error).message}`);
      }
    }

    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
      durationMs,
    });
  }
});
