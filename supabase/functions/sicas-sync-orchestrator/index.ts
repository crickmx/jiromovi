import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasSoapReportClient } from "../_shared/sicasSoapReportClient.ts";

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

const ITEMS_PER_PAGE = 1000;
const MAX_EXECUTION_SECONDS = 48;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "start";
    const jobId: string | undefined = body.jobId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── ACTION: start ─ Create a new sync job and begin processing ──
    if (action === "start") {
      const mode: string = body.mode || "incremental";
      const triggeredBy: string | null = body.triggeredBy || null;

      // Check if there's already a running job
      const { data: activeJob } = await supabase
        .from("sicas_sync_jobs")
        .select("id, status, percent, current_page, total_pages, total_synced, total_in_sicas, updated_at")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeJob) {
        const lastUpdate = new Date(activeJob.updated_at).getTime();
        const staleThreshold = 10 * 60 * 1000;
        if (Date.now() - lastUpdate > staleThreshold) {
          console.log(`[ORCHESTRATOR] Stale job detected (${activeJob.id}), marking as failed`);
          await supabase
            .from("sicas_sync_jobs")
            .update({
              status: "failed",
              error_message: "Auto-recovery: job stuck sin actualizacion por mas de 10 minutos",
              finished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", activeJob.id);
        } else {
          return jsonResponse(200, {
            ok: true,
            jobId: activeJob.id,
            status: activeJob.status,
            message: "Ya hay una sincronizacion en progreso.",
            alreadyRunning: true,
            progress: {
              percent: activeJob.percent,
              currentPage: activeJob.current_page,
              totalPages: activeJob.total_pages,
              totalSynced: activeJob.total_synced,
              totalInSicas: activeJob.total_in_sicas,
            },
          });
        }
      }

      // Get keycode from config
      const { data: configRow } = await supabase
        .from("sicas_production_config")
        .select("report_keycode_all")
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      const { data: sicasConfig } = await supabase
        .from("sicas_config")
        .select("last_successful_report, current_report_code")
        .limit(1)
        .maybeSingle();

      const keycode = configRow?.report_keycode_all
        || sicasConfig?.last_successful_report
        || sicasConfig?.current_report_code
        || "HAPPDATAL_D004";

      // Determine incremental date filter
      let incrementalSince: string | null = null;
      if (mode === "incremental") {
        const { data: lastJob } = await supabase
          .from("sicas_sync_jobs")
          .select("finished_at")
          .eq("status", "completed")
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastJob?.finished_at) {
          const since = new Date(lastJob.finished_at);
          since.setDate(since.getDate() - 3);
          incrementalSince = since.toISOString().split("T")[0];
          console.log(`[ORCHESTRATOR] Incremental mode: fetching since ${incrementalSince}`);
        } else {
          console.log(`[ORCHESTRATOR] No previous sync found, falling back to full mode`);
        }
      }

      // Reset cursor
      await supabase
        .from("sicas_sync_cursors")
        .upsert(
          {
            module: "documents",
            keycode,
            last_page: 0,
            total_pages: null,
            is_complete: false,
            total_synced: 0,
            incremental_since: incrementalSince,
            last_success_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "module,keycode" }
        );

      // Create job
      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode,
          status: "running",
          triggered_by: triggeredBy,
          keycode: `${keycode}_SOAP`,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creando job: ${jobError.message}`);

      // Start processing immediately, then self-chain
      const result = await processBatch(supabase, job.id, keycode);

      if (!result.isComplete) {
        selfChain(supabaseUrl, supabaseKey, job.id);
      }

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: result.isComplete ? "completed" : "running",
        transport: "soap",
        progress: result.progress,
      });
    }

    // ── ACTION: continue ─ Resume processing an existing job ──
    if (action === "continue" && jobId) {
      const { data: job } = await supabase
        .from("sicas_sync_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (!job) {
        return jsonResponse(404, { ok: false, error: "Job no encontrado" });
      }

      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        return jsonResponse(200, {
          ok: true,
          jobId,
          status: job.status,
          message: `Job ya terminado con status: ${job.status}`,
          progress: {
            percent: job.percent,
            currentPage: job.current_page,
            totalPages: job.total_pages,
            totalSynced: job.total_synced,
            totalInSicas: job.total_in_sicas,
          },
        });
      }

      const keycode = job.keycode
        ? job.keycode.replace(/_REST$/, "").replace(/_SOAP$/, "")
        : "HAPPDATAL_D004";

      const result = await processBatch(supabase, jobId, keycode);

      if (!result.isComplete) {
        selfChain(supabaseUrl, supabaseKey, jobId);
      }

      return jsonResponse(200, {
        ok: true,
        jobId,
        status: result.isComplete ? "completed" : "running",
        transport: "soap",
        progress: result.progress,
      });
    }

    // ── ACTION: status ──
    if (action === "status") {
      const targetJobId = jobId;

      if (targetJobId) {
        const { data: job } = await supabase
          .from("sicas_sync_jobs")
          .select("*")
          .eq("id", targetJobId)
          .maybeSingle();

        if (!job) return jsonResponse(404, { ok: false, error: "Job no encontrado" });

        return jsonResponse(200, {
          ok: true,
          jobId: job.id,
          status: job.status,
          progress: {
            percent: job.percent,
            currentPage: job.current_page,
            totalPages: job.total_pages,
            totalSynced: job.total_synced,
            totalInSicas: job.total_in_sicas,
            totalErrors: job.total_errors,
          },
          startedAt: job.started_at,
          finishedAt: job.finished_at,
          errorMessage: job.error_message,
        });
      }

      const { data: latestJob } = await supabase
        .from("sicas_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestJob) {
        return jsonResponse(200, { ok: true, jobId: null, status: "none", message: "No hay jobs de sincronizacion" });
      }

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
          totalErrors: latestJob.total_errors,
        },
        startedAt: latestJob.started_at,
        finishedAt: latestJob.finished_at,
        errorMessage: latestJob.error_message,
      });
    }

    // ── ACTION: cancel ──
    if (action === "cancel" && jobId) {
      await supabase
        .from("sicas_sync_jobs")
        .update({ status: "cancelled", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .in("status", ["queued", "running"]);

      return jsonResponse(200, { ok: true, message: "Job cancelado" });
    }

    return jsonResponse(400, { ok: false, error: `Accion no valida: ${action}` });
  } catch (error) {
    console.error(`[ORCHESTRATOR] FATAL: ${(error as Error).message}`);
    return jsonResponse(500, { ok: false, error: (error as Error).message });
  }
});

// ─── Self-chain ────────────────────────────────────────────────────────────
function selfChain(supabaseUrl: string, serviceKey: string, jobId: string) {
  const url = `${supabaseUrl}/functions/v1/sicas-sync-orchestrator`;
  const promise = fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Apikey: serviceKey,
    },
    body: JSON.stringify({ action: "continue", jobId }),
  }).catch((err) => {
    console.error(`[ORCHESTRATOR] Self-chain failed: ${err.message}`);
  });

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(promise);
  }
}

// ─── Process one batch of pages within time budget (SOAP) ──────────────────
async function processBatch(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  keycode: string
): Promise<{ isComplete: boolean; progress: Record<string, number> }> {
  const batchStart = Date.now();

  const { data: job } = await supabase
    .from("sicas_sync_jobs")
    .select("status, current_page, total_pages, total_synced, total_in_sicas, total_errors")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.status === "cancelled" || job.status === "failed") {
    return {
      isComplete: true,
      progress: { percent: 0, currentPage: 0, totalPages: 0, totalSynced: 0, totalInSicas: 0 },
    };
  }

  // Read cursor
  const { data: cursor } = await supabase
    .from("sicas_sync_cursors")
    .select("*")
    .eq("module", "documents")
    .eq("keycode", keycode)
    .maybeSingle();

  let startPage = (cursor?.last_page || 0) + 1;
  let knownTotalPages = cursor?.total_pages || job.total_pages || 0;
  const incrementalSince: string | null = (cursor as any)?.incremental_since || null;

  if (cursor?.is_complete) {
    await supabase
      .from("sicas_sync_jobs")
      .update({
        status: "completed",
        percent: 100,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      isComplete: true,
      progress: {
        percent: 100,
        currentPage: cursor.last_page || 0,
        totalPages: knownTotalPages,
        totalSynced: cursor.total_synced || 0,
        totalInSicas: job.total_in_sicas || 0,
      },
    };
  }

  console.log(`[ORCHESTRATOR] Job ${jobId}: starting batch from page ${startPage} via SOAP`);

  // Load mappings
  const [despachoNameToOffice, vendorMaps] = await Promise.all([
    loadDespachoNameMap(supabase),
    loadVendorMaps(supabase),
  ]);
  const { vendorToUser, vendorToOficina } = vendorMaps;

  // Create SOAP client
  const { data: sicasConfig } = await supabase
    .from("sicas_config")
    .select("endpoint, sicas_usuario, sicas_password")
    .limit(1)
    .maybeSingle();

  // Fallback uses .com (HTTPS valid cert). .com.mx has invalid TLS (UnknownIssuer).
  const soapEndpoint = sicasConfig?.endpoint || "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";
  const soapUsername = Deno.env.get("SICAS_USERNAME") || sicasConfig?.sicas_usuario || "";
  const soapPassword = Deno.env.get("SICAS_PASSWORD") || sicasConfig?.sicas_password || "";

  if (!soapUsername || !soapPassword) {
    await supabase.from("sicas_sync_jobs").update({
      status: "failed",
      error_message: "Credenciales SICAS no configuradas",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return { isComplete: true, progress: { percent: 0, currentPage: 0, totalPages: 0, totalSynced: 0, totalInSicas: 0 } };
  }

  const soapClient = new SicasSoapReportClient({
    endpoint: soapEndpoint,
    username: soapUsername,
    password: soapPassword,
  });

  let totalPages = knownTotalPages || 1;
  let totalInSicas = job.total_in_sicas || 0;
  let batchFetched = 0;
  let batchUpserted = 0;
  let batchErrors = 0;
  let lastPageProcessed = startPage - 1;
  let page = startPage;
  let consecutiveErrors = 0;
  let duplicatePageDetected = false;

  const allSeenIds = new Set<string>();
  let uniqueCountAfterLastPage = 0;
  let pagesWithNoNewIds = 0;

  while (true) {
    const elapsed = (Date.now() - batchStart) / 1000;
    if (elapsed >= MAX_EXECUTION_SECONDS) {
      console.log(`[ORCHESTRATOR] Time budget reached (${elapsed.toFixed(1)}s), pausing at page ${lastPageProcessed}`);
      break;
    }

    if (totalPages > 0 && page > totalPages) break;

    let records: Record<string, unknown>[] = [];
    try {
      const result = await soapClient.executeReport({
        keyCode: keycode,
        page,
        itemsPerPage: ITEMS_PER_PAGE,
        sortField: "DatDocumentos.FCaptura DESC",
        typeFormat: "XML",
      });

      if (!result.success && result.message) {
        throw new Error(result.message);
      }

      records = result.records || [];

      if (page === startPage && result.totalRecords) {
        totalInSicas = result.totalRecords;
        const computedPages = totalInSicas > 0 ? Math.ceil(totalInSicas / ITEMS_PER_PAGE) : 1;
        totalPages = Math.max(totalPages, computedPages);
        console.log(`[ORCHESTRATOR] SOAP reports: totalRecords=${totalInSicas}, estimatedPages=${totalPages}`);
      }

      consecutiveErrors = 0;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ORCHESTRATOR] ERROR page ${page}: ${msg}`);
      batchErrors++;
      consecutiveErrors++;
      if (consecutiveErrors >= 3) {
        console.error(`[ORCHESTRATOR] 3 consecutive errors, marking job as failed`);
        await supabase
          .from("sicas_sync_jobs")
          .update({
            status: "failed",
            error_message: `Error en pagina ${page}: ${msg}`,
            total_errors: (job.total_errors || 0) + batchErrors,
            updated_at: new Date().toISOString(),
            finished_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return {
          isComplete: true,
          progress: {
            percent: totalPages > 0 ? Math.round((lastPageProcessed / totalPages) * 100) : 0,
            currentPage: lastPageProcessed,
            totalPages,
            totalSynced: (job.total_synced || 0) + batchUpserted,
            totalInSicas,
          },
        };
      }
      page++;
      continue;
    }

    if (records.length === 0) {
      console.log(`[ORCHESTRATOR] Page ${page}: 0 records, end of data`);
      lastPageProcessed = page;
      break;
    }

    // Track unique IDs to detect API recycling
    for (const r of records) {
      const id = String(
        (r as Record<string, unknown>).IDDocto ||
        (r as Record<string, unknown>).IdDocto ||
        (r as Record<string, unknown>).Id_Docto || ""
      ).trim();
      if (id) allSeenIds.add(id);
    }

    if (page > startPage) {
      if (allSeenIds.size === uniqueCountAfterLastPage) {
        pagesWithNoNewIds++;
        console.log(`[ORCHESTRATOR] Page ${page}: no new unique IDs (still ${allSeenIds.size}). Streak: ${pagesWithNoNewIds}`);
      } else {
        pagesWithNoNewIds = 0;
      }
      if (pagesWithNoNewIds >= 2) {
        console.log(`[ORCHESTRATOR] API recycling detected. Only ${allSeenIds.size} unique records exist. Stopping.`);
        duplicatePageDetected = true;
        lastPageProcessed = page;
        break;
      }
    }
    uniqueCountAfterLastPage = allSeenIds.size;

    batchFetched += records.length;

    const documents = records
      .map((raw: Record<string, unknown>) =>
        mapDocument(raw, keycode, despachoNameToOffice, vendorToUser, vendorToOficina)
      )
      .filter((d: unknown) => d !== null);

    const { upserted, errors } = await upsertDocuments(supabase, documents);
    batchUpserted += upserted;
    batchErrors += errors;
    lastPageProcessed = page;

    console.log(
      `[ORCHESTRATOR] Page ${page}/${totalPages}: ${records.length} fetched, ${upserted} upserted, unique IDs: ${allSeenIds.size}`
    );

    // If we got fewer records than page size, we've reached the end
    if (records.length < ITEMS_PER_PAGE) {
      console.log(`[ORCHESTRATOR] Page ${page} returned ${records.length} < ${ITEMS_PER_PAGE}. End of data.`);
      duplicatePageDetected = true;
      break;
    }

    if (duplicatePageDetected) break;
    page++;
  }

  let accumulatedSynced = (job.total_synced || 0) + batchUpserted;
  const accumulatedErrors = (job.total_errors || 0) + batchErrors;

  if (duplicatePageDetected) {
    totalPages = lastPageProcessed;
    const { count: realCount } = await supabase
      .from("sicas_documents")
      .select("*", { count: "exact", head: true })
      .eq("source_keycode", keycode);
    if (realCount !== null) {
      totalInSicas = realCount;
      accumulatedSynced = realCount;
    }
    console.log(`[ORCHESTRATOR] End detection: real unique records: ${totalInSicas}`);
  }

  const isComplete = duplicatePageDetected || (lastPageProcessed >= totalPages && totalPages > 0);
  const percent = isComplete ? 100 : (totalPages > 0 ? Math.round((lastPageProcessed / totalPages) * 100) : 0);

  // Update cursor
  await supabase.from("sicas_sync_cursors").upsert(
    {
      module: "documents",
      keycode,
      last_page: lastPageProcessed,
      total_pages: totalPages,
      is_complete: isComplete,
      total_synced: accumulatedSynced,
      last_success_at: new Date().toISOString(),
      last_cursor_date: new Date().toISOString(),
      last_run_id: null,
    },
    { onConflict: "module,keycode" }
  );

  // Update job
  await supabase
    .from("sicas_sync_jobs")
    .update({
      status: isComplete ? "completed" : "running",
      current_page: lastPageProcessed,
      total_pages: totalPages,
      total_synced: accumulatedSynced,
      total_in_sicas: totalInSicas,
      total_errors: accumulatedErrors,
      percent,
      updated_at: new Date().toISOString(),
      ...(isComplete ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);

  // Audit record
  await supabase.from("sicas_sync_runs").insert({
    module: "documents",
    keycode,
    report_name: `Orchestrator SOAP batch pages ${startPage}-${lastPageProcessed}`,
    items_per_page: ITEMS_PER_PAGE,
    pages_requested: lastPageProcessed - startPage + 1,
    records_fetched: batchFetched,
    records_upserted: batchUpserted,
    records_failed: batchErrors,
    status: isComplete ? "completed" : "partial",
    started_at: new Date(batchStart).toISOString(),
    finished_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - batchStart) / 1000),
    parent_run_id: null,
  });

  console.log(
    `[ORCHESTRATOR] Batch done: pages ${startPage}-${lastPageProcessed}/${totalPages} (${percent}%), synced=${accumulatedSynced}, complete=${isComplete}`
  );

  return {
    isComplete,
    progress: {
      percent,
      currentPage: lastPageProcessed,
      totalPages,
      totalSynced: accumulatedSynced,
      totalInSicas,
    },
  };
}

// ===== Helper functions =====

async function loadDespachoNameMap(
  supabase: ReturnType<typeof createClient>
): Promise<Map<string, { oficina_id: string; desp_id: string }>> {
  const map = new Map<string, { oficina_id: string; desp_id: string }>();
  const [catalogsR, mappingsR] = await Promise.all([
    supabase.from("sicas_catalogos").select("id_sicas, nombre").eq("catalog_type_id", 11),
    supabase.from("sicas_mapeo_despacho_oficina").select("id_sicas_despacho, movi_oficina_id"),
  ]);
  const catalogs = catalogsR.data;
  const mappings = mappingsR.data;
  if (!catalogs || catalogs.length === 0) return map;
  if (!mappings) return map;
  const despIdToOficina = new Map<string, string>();
  for (const m of mappings) despIdToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
  for (const cat of catalogs) {
    const oficinaId = despIdToOficina.get(String(cat.id_sicas));
    if (oficinaId) {
      map.set(String(cat.nombre).toUpperCase().trim(), { oficina_id: oficinaId, desp_id: String(cat.id_sicas) });
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
    desp_id,
    desp_nombre: despNombre || null,
    usuario_id,
    oficina_id,
    oficina_nombre,
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
  const batchSize = 500;
  for (let i = 0; i < validDocs.length; i += batchSize) {
    const batch = validDocs.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from("sicas_documents")
      .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false });
    if (upsertError) {
      console.error(`[ORCHESTRATOR] Upsert error: ${upsertError.message}`);
      totalErrors += batch.length;
    } else {
      totalUpserted += batch.length;
    }
  }
  return { upserted: totalUpserted, errors: totalErrors };
}
