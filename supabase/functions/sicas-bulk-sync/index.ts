import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createSicasRestClientWithDbAuth } from "../_shared/sicasRestClient.ts";

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

const ITEMS_PER_PAGE = 100;
const MAX_SECONDS = 50;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "start";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── ACTION: start ─ Begin bulk sync ──────────────────────────────
    if (action === "start") {
      // Cancel any previous running job
      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("status", ["queued", "running"]);

      // Create job
      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode: "full",
          status: "running",
          triggered_by: body.triggeredBy || null,
          keycode: "BULK",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creando job: ${jobError.message}`);

      // Phase 1: Discover all vendor IDs from an unfiltered query
      const client = await createSicasRestClientWithDbAuth();
      const discovery = await client.readReport({
        keyCode: "HWS_DOCTOS",
        pageRequested: 1,
        itemsForPage: ITEMS_PER_PAGE,
        sortFields: "IDDocto",
      });

      const baseRecords = discovery.Response?.[0]?.TableInfo || [];
      const control =
        discovery.Response?.[1]?.TableControl?.[0] ||
        discovery.Response?.[0]?.TableControl?.[0];

      const apiMaxRecords = control?.MaxRecords || 0;

      // Extract all vendor IDs from this first batch
      const vendorIds = new Set<string>();
      for (const r of baseRecords) {
        const vid = String(
          r.IDVend || r.VendId || r.Vend_Id || ""
        ).trim();
        if (vid && vid !== "0") vendorIds.add(vid);
      }

      // Also include known vendor IDs from existing documents
      const { data: existingVendors } = await supabase
        .from("sicas_documents")
        .select("vend_id")
        .not("vend_id", "is", null)
        .neq("vend_id", "");
      for (const v of existingVendors || []) {
        if (v.vend_id) vendorIds.add(String(v.vend_id).trim());
      }

      // Also from vendor mappings
      const { data: mappedVendors } = await supabase
        .from("sicas_mapeo_vendedor_usuario")
        .select("id_sicas_vendedor");
      for (const m of mappedVendors || []) {
        if (m.id_sicas_vendedor)
          vendorIds.add(String(m.id_sicas_vendedor).trim());
      }

      // Also from usuarios with id_sicas
      const { data: usersWithSicas } = await supabase
        .from("usuarios")
        .select("id_sicas")
        .not("id_sicas", "is", null)
        .neq("id_sicas", "");
      for (const u of usersWithSicas || []) {
        if (u.id_sicas) vendorIds.add(String(u.id_sicas).trim());
      }

      const vendorList = [...vendorIds].sort(
        (a, b) => Number(a) - Number(b)
      );

      console.log(
        `[BULK-SYNC] Discovered ${vendorList.length} vendor IDs. API claims ${apiMaxRecords} total records.`
      );

      // Store the work plan in the job
      await supabase
        .from("sicas_sync_jobs")
        .update({
          total_in_sicas: apiMaxRecords,
          total_pages: vendorList.length,
          error_message: JSON.stringify({
            vendorIds: vendorList,
            currentVendorIndex: 0,
            phase: "vendors",
            statusCodes: [1, 2, 3, 4, 5],
            currentStatusIndex: 0,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      // Process the base records first (unfiltered)
      const despachoNameToOffice = await loadDespachoNameMap(supabase);
      const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

      const documents = baseRecords
        .map((raw: Record<string, unknown>) =>
          mapDocument(raw, "HWS_DOCTOS", despachoNameToOffice, vendorToUser, vendorToOficina)
        )
        .filter((d: unknown) => d !== null);

      const { upserted } = await upsertDocuments(supabase, documents);

      await supabase
        .from("sicas_sync_jobs")
        .update({
          total_synced: upserted,
          current_page: 0,
          percent: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      console.log(
        `[BULK-SYNC] Phase 0: ${baseRecords.length} base records upserted (${upserted} unique).`
      );

      // Self-chain to continue with vendor-by-vendor sync
      selfChain(supabaseUrl, supabaseKey, job.id);

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: "running",
        vendorCount: vendorList.length,
        apiMaxRecords,
        baseRecords: baseRecords.length,
      });
    }

    // ── ACTION: continue ─ Process next batch of vendors/statuses ────
    if (action === "continue" && body.jobId) {
      const jobId = body.jobId as string;
      const { data: job } = await supabase
        .from("sicas_sync_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (!job || job.status !== "running") {
        return jsonResponse(200, {
          ok: true,
          status: job?.status || "not_found",
          message: "Job no activo",
        });
      }

      let workPlan: {
        vendorIds: string[];
        currentVendorIndex: number;
        phase: string;
        statusCodes: number[];
        currentStatusIndex: number;
      };

      try {
        workPlan = JSON.parse(job.error_message || "{}");
      } catch {
        workPlan = {
          vendorIds: [],
          currentVendorIndex: 0,
          phase: "done",
          statusCodes: [],
          currentStatusIndex: 0,
        };
      }

      const batchStart = Date.now();
      const client = await createSicasRestClientWithDbAuth();
      const despachoNameToOffice = await loadDespachoNameMap(supabase);
      const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

      let totalUpserted = job.total_synced || 0;
      let totalErrors = job.total_errors || 0;

      if (workPlan.phase === "vendors") {
        let idx = workPlan.currentVendorIndex;

        while (idx < workPlan.vendorIds.length) {
          const elapsed = (Date.now() - batchStart) / 1000;
          if (elapsed >= MAX_SECONDS) break;

          const vendorId = workPlan.vendorIds[idx];
          console.log(
            `[BULK-SYNC] Vendor ${idx + 1}/${workPlan.vendorIds.length}: ID=${vendorId}`
          );

          try {
            const result = await fetchAllPagesForCondition(
              client,
              `DatDocumentos.VendId=${vendorId}`,
              "HWS_DOCTOS",
              batchStart,
              MAX_SECONDS,
              supabase,
              despachoNameToOffice,
              vendorToUser,
              vendorToOficina
            );
            totalUpserted += result.upserted;
            totalErrors += result.errors;
            console.log(
              `[BULK-SYNC] Vendor ${vendorId}: ${result.fetched} fetched, ${result.upserted} upserted, ${result.pages} pages`
            );
          } catch (e: unknown) {
            console.error(
              `[BULK-SYNC] Vendor ${vendorId} error: ${(e as Error).message}`
            );
            totalErrors++;
          }

          idx++;

          // Renew token every few vendors
          if (idx % 3 === 0) {
            try {
              await client.getValidToken();
            } catch {
              /* ignore */
            }
          }
        }

        workPlan.currentVendorIndex = idx;
        if (idx >= workPlan.vendorIds.length) {
          workPlan.phase = "statuses";
          workPlan.currentStatusIndex = 0;
          console.log(
            `[BULK-SYNC] All vendors done. Moving to status phase.`
          );
        }
      }

      if (
        workPlan.phase === "statuses" &&
        (Date.now() - batchStart) / 1000 < MAX_SECONDS
      ) {
        let sIdx = workPlan.currentStatusIndex;

        while (sIdx < workPlan.statusCodes.length) {
          const elapsed = (Date.now() - batchStart) / 1000;
          if (elapsed >= MAX_SECONDS) break;

          const statusCode = workPlan.statusCodes[sIdx];
          console.log(
            `[BULK-SYNC] Status ${sIdx + 1}/${workPlan.statusCodes.length}: code=${statusCode}`
          );

          try {
            const result = await fetchAllPagesForCondition(
              client,
              `DatDocumentos.Status=${statusCode}`,
              "HWS_DOCTOS",
              batchStart,
              MAX_SECONDS,
              supabase,
              despachoNameToOffice,
              vendorToUser,
              vendorToOficina
            );
            totalUpserted += result.upserted;
            totalErrors += result.errors;
            console.log(
              `[BULK-SYNC] Status ${statusCode}: ${result.fetched} fetched, ${result.upserted} upserted, ${result.pages} pages`
            );
          } catch (e: unknown) {
            console.error(
              `[BULK-SYNC] Status ${statusCode} error: ${(e as Error).message}`
            );
            totalErrors++;
          }

          sIdx++;
        }

        workPlan.currentStatusIndex = sIdx;
        if (sIdx >= workPlan.statusCodes.length) {
          workPlan.phase = "done";
        }
      }

      // Count actual unique documents in DB
      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      const totalVendors = workPlan.vendorIds.length;
      const totalStatuses = workPlan.statusCodes.length;
      const vendorsDone = Math.min(
        workPlan.currentVendorIndex,
        totalVendors
      );
      const statusesDone =
        workPlan.phase === "statuses" || workPlan.phase === "done"
          ? Math.min(workPlan.currentStatusIndex, totalStatuses)
          : 0;
      const totalSteps = totalVendors + totalStatuses;
      const stepsDone = vendorsDone + statusesDone;
      const percent =
        workPlan.phase === "done"
          ? 100
          : totalSteps > 0
            ? Math.min(99, Math.round((stepsDone / totalSteps) * 100))
            : 0;

      const isComplete = workPlan.phase === "done";

      // Update job
      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: isComplete ? "completed" : "running",
          total_synced: uniqueCount || totalUpserted,
          total_in_sicas: uniqueCount || 0,
          total_errors: totalErrors,
          current_page: stepsDone,
          total_pages: totalSteps,
          percent,
          error_message: JSON.stringify(workPlan),
          updated_at: new Date().toISOString(),
          ...(isComplete ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", jobId);

      // Audit run
      await supabase.from("sicas_sync_runs").insert({
        module: "documents",
        keycode: "BULK",
        report_name: `Bulk sync batch (vendors ${workPlan.currentVendorIndex}/${totalVendors}, statuses ${statusesDone}/${totalStatuses})`,
        items_per_page: ITEMS_PER_PAGE,
        pages_requested: stepsDone,
        records_fetched: totalUpserted,
        records_upserted: uniqueCount || 0,
        records_failed: totalErrors,
        status: isComplete ? "completed" : "partial",
        started_at: new Date(batchStart).toISOString(),
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round((Date.now() - batchStart) / 1000),
        parent_run_id: null,
      });

      console.log(
        `[BULK-SYNC] Batch done: ${stepsDone}/${totalSteps} steps, ${uniqueCount} unique docs in DB, phase=${workPlan.phase}, complete=${isComplete}`
      );

      if (!isComplete) {
        selfChain(supabaseUrl, supabaseKey, jobId);
      }

      return jsonResponse(200, {
        ok: true,
        jobId,
        status: isComplete ? "completed" : "running",
        progress: {
          percent,
          stepsDone,
          totalSteps,
          uniqueDocs: uniqueCount,
          phase: workPlan.phase,
        },
      });
    }

    // ── ACTION: status ─ Check job progress ──────────────────────────
    if (action === "status") {
      const { data: latestJob } = await supabase
        .from("sicas_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestJob) {
        return jsonResponse(200, {
          ok: true,
          status: "none",
        });
      }

      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      return jsonResponse(200, {
        ok: true,
        jobId: latestJob.id,
        status: latestJob.status,
        progress: {
          percent: latestJob.percent,
          currentPage: latestJob.current_page,
          totalPages: latestJob.total_pages,
          totalSynced: latestJob.total_synced,
          totalInSicas: latestJob.total_in_sicas,
          uniqueDocs: uniqueCount,
        },
        startedAt: latestJob.started_at,
        finishedAt: latestJob.finished_at,
      });
    }

    return jsonResponse(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    console.error(`[BULK-SYNC] FATAL: ${(error as Error).message}`);
    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
    });
  }
});

// ─── Self-chain ──────────────────────────────────────────────────────────
function selfChain(
  supabaseUrl: string,
  serviceKey: string,
  jobId: string
) {
  const url = `${supabaseUrl}/functions/v1/sicas-bulk-sync`;
  const promise = fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Apikey: serviceKey,
    },
    body: JSON.stringify({ action: "continue", jobId }),
  }).catch((err) => {
    console.error(`[BULK-SYNC] Self-chain failed: ${err.message}`);
  });

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(promise);
  }
}

// ─── Fetch all pages for a given condition ────────────────────────────────
async function fetchAllPagesForCondition(
  client: Awaited<ReturnType<typeof createSicasRestClientWithDbAuth>>,
  conditions: string,
  keyCode: string,
  batchStart: number,
  maxSeconds: number,
  supabase: ReturnType<typeof createClient>,
  despachoNameToOffice: Map<string, { oficina_id: string; desp_id: string }>,
  vendorToUser: Map<string, string>,
  vendorToOficina: Map<string, string>
): Promise<{ fetched: number; upserted: number; errors: number; pages: number }> {
  let page = 1;
  let totalPages = 1;
  let fetched = 0;
  let upserted = 0;
  let errors = 0;
  const seenIds = new Set<string>();

  while (page <= totalPages) {
    const elapsed = (Date.now() - batchStart) / 1000;
    if (elapsed >= maxSeconds) break;

    const response = await client.readReport({
      keyCode,
      pageRequested: page,
      itemsForPage: ITEMS_PER_PAGE,
      sortFields: "IDDocto",
      conditions,
    });

    const records = response.Response?.[0]?.TableInfo || [];
    const control =
      response.Response?.[1]?.TableControl?.[0] ||
      response.Response?.[0]?.TableControl?.[0];

    if (page === 1 && control) {
      totalPages = control.Pages || 1;
    }

    if (records.length === 0) break;

    // Check for recycled data
    let newCount = 0;
    for (const r of records) {
      const id = String(
        (r as Record<string, unknown>).IDDocto ||
        (r as Record<string, unknown>).IdDocto ||
        (r as Record<string, unknown>).Id_Docto || ""
      ).trim();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        newCount++;
      }
    }

    if (page > 1 && newCount === 0) {
      console.log(
        `[BULK-SYNC] condition="${conditions}" page ${page}: all records already seen, stopping.`
      );
      break;
    }

    fetched += records.length;

    const documents = records
      .map((raw: Record<string, unknown>) =>
        mapDocument(raw, keyCode, despachoNameToOffice, vendorToUser, vendorToOficina)
      )
      .filter((d: unknown) => d !== null);

    const result = await upsertDocuments(supabase, documents);
    upserted += result.upserted;
    errors += result.errors;

    page++;
  }

  return { fetched, upserted, errors, pages: page - 1 };
}

// ===== Helper functions (same as orchestrator) =====

async function loadDespachoNameMap(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, { oficina_id: string; desp_id: string }>> {
  const map = new Map<string, { oficina_id: string; desp_id: string }>();
  const { data: catalogs } = await supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre")
    .eq("catalog_type_id", 11);
  if (!catalogs || catalogs.length === 0) return map;
  const { data: mappings } = await supabase
    .from("sicas_mapeo_despacho_oficina")
    .select("id_sicas_despacho, movi_oficina_id");
  if (!mappings) return map;
  const despIdToOficina = new Map<string, string>();
  for (const m of mappings) despIdToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
  for (const cat of catalogs) {
    const oficinaId = despIdToOficina.get(String(cat.id_sicas));
    if (oficinaId) {
      map.set(String(cat.nombre).toUpperCase().trim(), {
        oficina_id: oficinaId,
        desp_id: String(cat.id_sicas),
      });
    }
  }
  return map;
}

async function loadVendorMaps(
  supabase: ReturnType<typeof createClient>
): Promise<{ vendorToUser: Map<string, string>; vendorToOficina: Map<string, string> }> {
  const vendorToUser = new Map<string, string>();
  const vendorToOficina = new Map<string, string>();
  const [vendorMappingsR, usuariosWithSicasR] = await Promise.all([
    supabase.from("sicas_mapeo_vendedor_usuario").select("id_sicas_vendedor, movi_user_id"),
    supabase.from("usuarios").select("id, id_sicas, oficina_id").not("id_sicas", "is", null),
  ]);
  for (const m of vendorMappingsR.data || []) vendorToUser.set(String(m.id_sicas_vendedor), m.movi_user_id);
  for (const u of usuariosWithSicasR.data || []) {
    if (u.id_sicas && String(u.id_sicas).trim()) {
      const idSicas = String(u.id_sicas).trim();
      if (!vendorToUser.has(idSicas)) vendorToUser.set(idSicas, u.id);
      if (u.oficina_id) vendorToOficina.set(idSicas, u.oficina_id);
    }
  }
  const userIds = [...new Set(vendorToUser.values())];
  if (userIds.length > 0) {
    const { data: usuarios } = await supabase.from("usuarios").select("id, oficina_id").in("id", userIds);
    for (const u of usuarios || []) {
      if (u.oficina_id) {
        for (const [vendId, userId] of vendorToUser.entries()) {
          if (userId === u.id && !vendorToOficina.has(vendId)) vendorToOficina.set(vendId, u.oficina_id);
        }
      }
    }
  }
  return { vendorToUser, vendorToOficina };
}

function mapDocument(
  raw: Record<string, unknown>,
  keycode: string,
  despachoNameToOffice: Map<string, { oficina_id: string; desp_id: string }>,
  vendorToUser: Map<string, string>,
  vendorToOficina: Map<string, string>
): Record<string, unknown> | null {
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

  const idDocto = get(["IDDocto", "IdDocto", "Id_Docto", "iddocto"]);
  if (!idDocto) return null;

  const vendId = get(["IDVend", "VendId", "Vend_Id"]);
  const despNombre = get(["DespNombre", "Despacho"]);

  let oficina_id: string | null = null;
  let desp_id: string | null = null;
  let oficina_nombre: string | null = null;

  if (despNombre) {
    const match = despachoNameToOffice.get(despNombre.toUpperCase().trim());
    if (match) { oficina_id = match.oficina_id; desp_id = match.desp_id; oficina_nombre = despNombre; }
  }

  let usuario_id: string | null = null;
  if (vendId && vendorToUser.has(vendId)) {
    usuario_id = vendorToUser.get(vendId)!;
    if (!oficina_id && vendorToOficina.has(vendId)) oficina_id = vendorToOficina.get(vendId)!;
  }

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
  const today = new Date();
  let isVigente = statusTexto.toLowerCase() === "vigente";
  let renewalDays: number | null = null;
  if (fHasta) {
    try {
      const hastaDate = new Date(fHasta);
      if (!isNaN(hastaDate.getTime())) {
        renewalDays = Math.ceil((hastaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (renewalDays < 0 && isVigente) isVigente = false;
      }
    } catch { /* ignore */ }
  }

  return {
    id_docto: idDocto,
    vend_id: vendId || null,
    vend_nombre: get(["VendNombre", "Vendedor", "Vend_Nombre"]) || null,
    desp_id, desp_nombre: despNombre || null,
    usuario_id, oficina_id, oficina_nombre,
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
    is_cancelada: statusTexto.toLowerCase() === "cancelada",
    is_renewable: isVigente && renewalDays !== null && renewalDays >= 0 && renewalDays <= 90,
    renewal_days_remaining: renewalDays,
    source_keycode: keycode,
    raw_data: raw,
    raw_hash: JSON.stringify(raw),
    synced_at: new Date().toISOString(),
  };
}

async function upsertDocuments(
  supabase: ReturnType<typeof createClient>,
  documents: Record<string, unknown>[]
): Promise<{ upserted: number; errors: number }> {
  const validDocs = documents.filter((d) => d !== null && d.id_docto);
  if (validDocs.length === 0) return { upserted: 0, errors: 0 };
  let totalUpserted = 0;
  let totalErrors = 0;
  const batchSize = 200;
  for (let i = 0; i < validDocs.length; i += batchSize) {
    const batch = validDocs.slice(i, i + batchSize);
    const { error: upsertError, data: upserted } = await supabase
      .from("sicas_documents")
      .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
      .select("id");
    if (upsertError) {
      console.error(`[BULK-SYNC] Upsert error: ${upsertError.message}`);
      totalErrors += batch.length;
    } else {
      totalUpserted += upserted?.length || batch.length;
    }
  }
  // Also upsert into backward-compat table
  const polizasVigentes = validDocs.map((d) => ({
    id_documento: d.id_docto as string,
    no_poliza: d.poliza || null,
    vend_id: d.vend_id || null, vend_nombre: d.vend_nombre || null,
    desp_id: d.desp_id || null, desp_nombre: d.desp_nombre || null,
    aseguradora: d.compania || null, ramo: d.ramo || null, subramo: d.subramo || null,
    contratante: d.cliente || null,
    vigencia_desde: d.vigencia_desde || null, vigencia_hasta: d.vigencia_hasta || null,
    prima_neta: d.prima_neta || null, prima_total: d.prima_total || null,
    usuario_id: d.usuario_id || null, oficina_id: d.oficina_id || null,
    synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < polizasVigentes.length; i += batchSize) {
    const batch = polizasVigentes.slice(i, i + batchSize);
    await supabase.from("sicas_polizas_vigentes").upsert(batch, { onConflict: "id_documento", ignoreDuplicates: false });
  }
  return { upserted: totalUpserted, errors: totalErrors };
}
