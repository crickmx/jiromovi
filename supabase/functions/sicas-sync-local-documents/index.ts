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
  recordsLinked: number;
  pagesProcessed: number;
  totalInSicas: number;
  vendedoresConDocs: number;
  vendedoresSinMapeo: number;
  vendedoresSinMapeoDetalle: Array<{ vendId: string; vendNombre: string; docs: number }>;
  errors: number;
  durationMs: number;
  runId: string;
  keycode: string;
  perPage: Array<{
    page: number;
    fetched: number;
    accumulated: number;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "full";

    console.log(`[SYNC] ========== INICIO SINCRONIZACION ==========`);
    console.log(`[SYNC] Modo: ${action} | Timestamp: ${new Date().toISOString()}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: configRow } = await supabase
      .from("sicas_production_config")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    const keycode = configRow?.report_keycode_all || "HWS_DOCTOS";
    const pageSize = 500;
    const maxPages = 200;

    console.log(`[SYNC] Config: keycode=${keycode}, pageSize=${pageSize}, maxPages=${maxPages}`);

    const { data: run, error: runError } = await supabase
      .from("sicas_sync_runs")
      .insert({
        module: "documents",
        keycode,
        report_name: `Sync ${action} - ALL docs no vendor filter`,
        items_per_page: pageSize,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      throw new Error(`Error creando registro de sync: ${runError.message}`);
    }
    const runId = run.run_id;
    console.log(`[SYNC] Run ID: ${runId}`);

    // ===== STEP 1: Download ALL documents WITHOUT vendor filter =====
    console.log(`[SYNC] === STEP 1: Descarga masiva SIN filtro de vendedor ===`);

    const client = new SicasRestClient({
      baseUrl: Deno.env.get("SICAS_REST_API_URL") || undefined,
      username: Deno.env.get("SICAS_USERNAME") || undefined,
      password: Deno.env.get("SICAS_PASSWORD") || undefined,
      sCodeAuth: Deno.env.get("SICAS_CODE_AUTH") || undefined,
    });

    const allRecords: Record<string, unknown>[] = [];
    const perPageStats: SyncStats["perPage"] = [];
    let totalInSicas = 0;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= maxPages) {
      let response;
      try {
        response = await client.readReport({
          keyCode: keycode,
          pageRequested: page,
          itemsForPage: pageSize,
          sortFields: "Documento",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SYNC] ERROR pagina ${page}: ${msg}`);
        perPageStats.push({ page, fetched: 0, accumulated: allRecords.length });
        break;
      }

      const records = response.Response?.[0]?.TableInfo || [];
      const control = response.Response?.[0]?.TableControl?.[0];

      if (page === 1) {
        totalInSicas = control?.MaxRecords || records.length;
        totalPages = control?.Pages || 1;
        console.log(`[SYNC] SICAS reporta: MaxRecords=${totalInSicas}, Pages=${totalPages}`);
      }

      allRecords.push(...records);
      perPageStats.push({ page, fetched: records.length, accumulated: allRecords.length });
      console.log(`[SYNC] Pagina ${page}/${totalPages}: ${records.length} registros (acumulado: ${allRecords.length}/${totalInSicas})`);

      if (records.length === 0) break;
      page++;
    }

    console.log(`[SYNC] Descarga completa: ${allRecords.length} registros en ${perPageStats.length} paginas`);

    // ===== STEP 2: Parse and upsert all documents =====
    console.log(`[SYNC] === STEP 2: Upsert de ${allRecords.length} documentos ===`);

    let totalUpserted = 0;
    let totalErrors = 0;

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
          const n = Number.parseFloat(v.replace(/,/g, ""));
          return isNaN(n) ? 0 : n;
        };

        const idDocto = get(["IDDocto", "IdDocto", "Id_Docto", "iddocto"]) || `DOC_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const vendId = get(["IDVend", "VendId", "Vend_Id"]);
        const despId = get(["IDDesp", "DespId"]);

        const statusTxt = get(["Status_TXT", "Estatus_TXT"]);
        const statusRaw = get(["Status", "Estatus", "StatusDoc"]);
        const statusLetterMap: Record<string, string> = { V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente" };
        const statusNumMap: Record<string, string> = { "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente" };
        const statusTexto = statusTxt || statusLetterMap[statusRaw] || statusNumMap[statusRaw] || statusRaw || "";

        const tipoDoc = get(["TipoDocto_TXT", "TipoDocto", "Tipo"]);
        const subtipoDoc = get(["SubTipoDocto_TXT", "SubTipoDocto"]);
        const tipoLower = tipoDoc.toLowerCase();
        const isPoliza = tipoLower.includes("poliza") || tipoLower.includes("póliza") || (!tipoLower.includes("fianza") && !tipoLower.includes("orden"));
        const isFianza = tipoLower.includes("fianza");

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

        return {
          id_docto: idDocto,
          vend_id: vendId || null,
          vend_nombre: get(["VendNombre", "Vendedor", "Vend_Nombre"]) || null,
          desp_id: despId || null,
          desp_nombre: get(["DespNombre", "Despacho"]) || null,
          usuario_id: null,
          oficina_id: null,
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
          console.log(`[SYNC] Upsert lote ${batchNum}/${totalBatches}: ${count} docs OK`);
        }
      }

      // Backward compat: upsert into sicas_polizas_vigentes
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
          prima_neta: Number.parseFloat(get(["PrimaNeta", "ImporteNeto"]) || "0") || null,
          prima_total: Number.parseFloat(get(["PrimaTotal", "Importe"]) || "0") || null,
          usuario_id: null,
          oficina_id: null,
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

    // ===== STEP 3: Link documents to users/offices using mappings =====
    console.log(`[SYNC] === STEP 3: Vinculacion de documentos a usuarios ===`);

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

    // Get user->oficina fallback
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

    console.log(`[SYNC] Mappings: ${vendorToUser.size} vendedor->usuario, ${despachoToOficina.size} despacho->oficina`);

    let recordsLinked = 0;
    for (const [vendId, userId] of vendorToUser.entries()) {
      let oficinaId = vendorToOficina.get(vendId) || userOficinaMap.get(userId) || null;

      // Also try despacho mapping for this vendor's documents
      const updatePayload: Record<string, unknown> = { usuario_id: userId };
      if (oficinaId) updatePayload.oficina_id = oficinaId;

      const { count, error: linkErr } = await supabase
        .from("sicas_documents")
        .update(updatePayload, { count: "exact" })
        .eq("vend_id", vendId)
        .is("usuario_id", null);

      if (linkErr) {
        console.error(`[SYNC] Error linking vendor ${vendId}: ${linkErr.message}`);
      } else if (count && count > 0) {
        recordsLinked += count;
        console.log(`[SYNC] Vendor ${vendId} -> usuario ${userId}: ${count} docs linked`);
      }

      // Also update sicas_polizas_vigentes
      await supabase
        .from("sicas_polizas_vigentes")
        .update(updatePayload)
        .eq("vend_id", vendId)
        .is("usuario_id", null);
    }

    // Link by despacho for remaining unlinked docs
    for (const [despId, oficinaId] of despachoToOficina.entries()) {
      const { count, error: linkErr } = await supabase
        .from("sicas_documents")
        .update({ oficina_id: oficinaId }, { count: "exact" })
        .eq("desp_id", despId)
        .is("oficina_id", null);

      if (linkErr) {
        console.error(`[SYNC] Error linking despacho ${despId}: ${linkErr.message}`);
      } else if (count && count > 0) {
        console.log(`[SYNC] Despacho ${despId} -> oficina ${oficinaId}: ${count} docs linked`);
      }
    }

    console.log(`[SYNC] Total documentos vinculados a usuarios: ${recordsLinked}`);

    // ===== STEP 4: Calculate unmapped vendor stats =====
    console.log(`[SYNC] === STEP 4: Estadisticas de vendedores sin mapeo ===`);

    const vendedoresConDocsMap = new Map<string, { nombre: string; docs: number }>();
    for (const raw of allRecords) {
      const vendId = String((raw as Record<string, unknown>)["IDVend"] || (raw as Record<string, unknown>)["VendId"] || "").trim();
      const vendNombre = String((raw as Record<string, unknown>)["VendNombre"] || (raw as Record<string, unknown>)["Vendedor"] || "").trim();
      if (!vendId) continue;
      const existing = vendedoresConDocsMap.get(vendId);
      if (existing) {
        existing.docs++;
      } else {
        vendedoresConDocsMap.set(vendId, { nombre: vendNombre, docs: 1 });
      }
    }

    const vendedoresSinMapeo: Array<{ vendId: string; vendNombre: string; docs: number }> = [];
    for (const [vendId, info] of vendedoresConDocsMap.entries()) {
      if (!vendorToUser.has(vendId)) {
        vendedoresSinMapeo.push({ vendId, vendNombre: info.nombre, docs: info.docs });
      }
    }
    vendedoresSinMapeo.sort((a, b) => b.docs - a.docs);

    console.log(`[SYNC] Vendedores con docs: ${vendedoresConDocsMap.size}, sin mapeo: ${vendedoresSinMapeo.length}`);
    for (const v of vendedoresSinMapeo.slice(0, 10)) {
      console.log(`[SYNC]   - Vendor ${v.vendId} "${v.vendNombre}": ${v.docs} docs`);
    }

    // ===== STEP 5: Record sync run results =====
    const durationMs = Date.now() - startTime;
    const durationSeconds = Math.round(durationMs / 1000);

    await supabase
      .from("sicas_sync_runs")
      .update({
        status: totalErrors > 0 && totalUpserted === 0 ? "failed" : "completed",
        records_fetched: allRecords.length,
        records_upserted: totalUpserted,
        records_linked: recordsLinked,
        records_failed: totalErrors,
        pages_requested: perPageStats.length,
        finished_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        error_message: totalErrors > 0 ? `${totalErrors} errores durante upsert` : null,
      })
      .eq("run_id", runId);

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
      recordsLinked,
      pagesProcessed: perPageStats.length,
      totalInSicas,
      vendedoresConDocs: vendedoresConDocsMap.size,
      vendedoresSinMapeo: vendedoresSinMapeo.length,
      vendedoresSinMapeoDetalle: vendedoresSinMapeo,
      errors: totalErrors,
      durationMs,
      runId,
      keycode,
      perPage: perPageStats,
    };

    console.log(`[SYNC] ========== FIN SINCRONIZACION ==========`);
    console.log(`[SYNC] ${totalUpserted} upserted, ${recordsLinked} linked, ${totalErrors} errors, ${perPageStats.length} pages, ${durationMs}ms`);
    console.log(`[SYNC] Total en SICAS: ${totalInSicas}, Descargados: ${allRecords.length}`);

    return jsonResponse(200, { ok: true, stats });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[SYNC] ERROR FATAL: ${(error as Error).message}`);
    console.error(`[SYNC] Stack: ${(error as Error).stack}`);

    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
      durationMs,
    });
  }
});
