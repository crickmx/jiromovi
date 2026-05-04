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
const TOKEN_RENEW_INTERVAL = 2;
const MAX_EXECUTION_SECONDS = 45;

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
      const mode: string = body.mode || "full";
      const triggeredBy: string | null = body.triggeredBy || null;

      // Check if there's already a running job
      const { data: activeJob } = await supabase
        .from("sicas_sync_jobs")
        .select("id, status, percent, current_page, total_pages, total_synced, total_in_sicas")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeJob) {
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

      // Get keycode from config
      const { data: configRow } = await supabase
        .from("sicas_production_config")
        .select("report_keycode_all")
        .eq("activo", true)
        .limit(1)
        .maybeSingle();
      const keycode = configRow?.report_keycode_all || "HWS_DOCTOS";

      // Reset cursor if full mode
      if (mode === "full") {
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
              last_success_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "module,keycode" }
          );
      }

      // Create job
      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode,
          status: "running",
          triggered_by: triggeredBy,
          keycode,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creando job: ${jobError.message}`);

      // Start processing immediately, then self-chain
      const result = await processBatch(supabase, job.id, keycode);

      if (!result.isComplete) {
        // Self-chain: invoke this function again to continue
        selfChain(supabaseUrl, supabaseKey, job.id);
      }

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: result.isComplete ? "completed" : "running",
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

      const result = await processBatch(supabase, jobId, job.keycode);

      if (!result.isComplete) {
        selfChain(supabaseUrl, supabaseKey, jobId);
      }

      return jsonResponse(200, {
        ok: true,
        jobId,
        status: result.isComplete ? "completed" : "running",
        progress: result.progress,
      });
    }

    // ── ACTION: status ─ Check job status (for frontend polling) ──
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

      // No jobId: return latest job
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

    // ── ACTION: cancel ─ Cancel a running job ──
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

// ─── Self-chain: fire-and-forget call to continue processing ────────────
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

// ─── Process one batch of pages within time budget ──────────────────────
async function processBatch(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  keycode: string
): Promise<{ isComplete: boolean; progress: Record<string, number> }> {
  const batchStart = Date.now();

  // Check if job was cancelled
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

  console.log(`[ORCHESTRATOR] Job ${jobId}: starting batch from page ${startPage}`);

  // Load mappings in parallel
  const [despachoNameToOffice, vendorMaps] = await Promise.all([
    loadDespachoNameMap(supabase),
    loadVendorMaps(supabase),
  ]);
  const { vendorToUser, vendorToOficina } = vendorMaps;

  const client = await createSicasRestClientWithDbAuth();

  let totalPages = knownTotalPages || 1;
  let totalInSicas = job.total_in_sicas || 0;
  let batchFetched = 0;
  let batchUpserted = 0;
  let batchErrors = 0;
  let lastPageProcessed = startPage - 1;
  let page = startPage;
  let consecutiveErrors = 0;
  let duplicatePageDetected = false;

  // Track ALL unique IDs across every page in this batch to detect when the
  // API recycles the same records across different "pages".
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

    if ((page - startPage) > 0 && (page - startPage) % TOKEN_RENEW_INTERVAL === 0) {
      try {
        await client.getValidToken();
      } catch (e) {
        console.warn(`[ORCHESTRATOR] Token renewal warning: ${(e as Error).message}`);
      }
    }

    let response;
    try {
      response = await client.readReport({
        keyCode: keycode,
        pageRequested: page,
        itemsForPage: ITEMS_PER_PAGE,
        sortFields: "Documento",
      });
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

    const records = response.Response?.[0]?.TableInfo || [];
    const control =
      response.Response?.[1]?.TableControl?.[0] ||
      response.Response?.[0]?.TableControl?.[0];

    if (page === startPage && control) {
      totalInSicas = control.MaxRecords || totalInSicas;
      const apiPages = control.Pages || 1;
      const computedPages = totalInSicas > 0 ? Math.ceil(totalInSicas / ITEMS_PER_PAGE) : apiPages;
      totalPages = Math.max(apiPages, computedPages);
      console.log(`[ORCHESTRATOR] SICAS reports: MaxRecords=${totalInSicas}, TotalPages=${totalPages}`);
    }

    if (records.length === 0) {
      console.log(`[ORCHESTRATOR] Page ${page}: 0 records, end of data`);
      lastPageProcessed = page;
      break;
    }

    // Track unique IDs across all pages to detect API recycling the same records
    for (const r of records) {
      const id = String(
        (r as Record<string, unknown>).IDDocto ||
        (r as Record<string, unknown>).IdDocto ||
        (r as Record<string, unknown>).Id_Docto || ""
      ).trim();
      if (id) allSeenIds.add(id);
    }

    // After at least 2 pages, check if unique count is growing
    if (page > startPage) {
      if (allSeenIds.size === uniqueCountAfterLastPage) {
        pagesWithNoNewIds++;
        console.log(`[ORCHESTRATOR] Page ${page}: no new unique IDs (still ${allSeenIds.size}). Streak: ${pagesWithNoNewIds}`);
      } else {
        pagesWithNoNewIds = 0;
      }
      // If 2+ consecutive pages added zero new IDs, the API is recycling
      if (pagesWithNoNewIds >= 2) {
        console.log(`[ORCHESTRATOR] API recycling detected after ${page - startPage + 1} pages. Only ${allSeenIds.size} unique records exist. Stopping.`);
        duplicatePageDetected = true;
        lastPageProcessed = page;
        break;
      }
    }
    uniqueCountAfterLastPage = allSeenIds.size;

    // Also check: if we requested page > 1 but control always says Page=1
    if (page === startPage && startPage > 1 && control && control.Page === 1) {
      console.log(`[ORCHESTRATOR] API ignores PageRequested (requested ${startPage}, got Page=1). All accessible data already synced.`);
      duplicatePageDetected = true;
      lastPageProcessed = page;
      // Still upsert this page's data before breaking
    }

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
      `[ORCHESTRATOR] Page ${page}/${totalPages}: ${records.length} fetched, ${upserted} upserted, unique IDs so far: ${allSeenIds.size}`
    );

    if (duplicatePageDetected) break;
    page++;
  }

  let accumulatedSynced = (job.total_synced || 0) + batchUpserted;
  const accumulatedErrors = (job.total_errors || 0) + batchErrors;

  // If duplicate pages were detected, the API doesn't paginate - we have all data
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
    console.log(`[ORCHESTRATOR] Duplicate detection: API recycles data. Real unique records: ${totalInSicas} (seen ${allSeenIds.size} unique IDs across ${lastPageProcessed - startPage + 1} pages)`);
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

  // Create sync run record for audit
  await supabase.from("sicas_sync_runs").insert({
    module: "documents",
    keycode,
    report_name: `Orchestrator batch pages ${startPage}-${lastPageProcessed}`,
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

// ===== Helper functions (same logic as sicas-sync-local-documents) =====

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
  for (const m of mappings) {
    despIdToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
  }

  for (const cat of catalogs) {
    const oficinaId = despIdToOficina.get(String(cat.id_sicas));
    if (oficinaId) {
      const normalizedName = String(cat.nombre).toUpperCase().trim();
      map.set(normalizedName, {
        oficina_id: oficinaId,
        desp_id: String(cat.id_sicas),
      });
    }
  }

  return map;
}

async function loadVendorMaps(
  supabase: ReturnType<typeof createClient>
): Promise<{
  vendorToUser: Map<string, string>;
  vendorToOficina: Map<string, string>;
}> {
  const vendorToUser = new Map<string, string>();
  const vendorToOficina = new Map<string, string>();

  const [vendorMappingsR, usuariosWithSicasR] = await Promise.all([
    supabase
      .from("sicas_mapeo_vendedor_usuario")
      .select("id_sicas_vendedor, movi_user_id"),
    supabase
      .from("usuarios")
      .select("id, id_sicas, oficina_id")
      .not("id_sicas", "is", null),
  ]);

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

  const userIds = [...new Set(vendorToUser.values())];
  if (userIds.length > 0) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, oficina_id")
      .in("id", userIds);
    for (const u of usuarios || []) {
      if (u.oficina_id) {
        for (const [vendId, userId] of vendorToUser.entries()) {
          if (userId === u.id && !vendorToOficina.has(vendId)) {
            vendorToOficina.set(vendId, u.oficina_id);
          }
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
      if (val !== undefined && val !== null && String(val).trim())
        return String(val).trim();
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
    const normalizedDesp = despNombre.toUpperCase().trim();
    const match = despachoNameToOffice.get(normalizedDesp);
    if (match) {
      oficina_id = match.oficina_id;
      desp_id = match.desp_id;
      oficina_nombre = despNombre;
    }
  }

  let usuario_id: string | null = null;
  if (vendId && vendorToUser.has(vendId)) {
    usuario_id = vendorToUser.get(vendId)!;
    if (!oficina_id && vendorToOficina.has(vendId)) {
      oficina_id = vendorToOficina.get(vendId)!;
    }
  }

  const statusTxt = get(["Status_TXT", "Estatus_TXT"]);
  const statusRaw = get(["Status", "Estatus", "StatusDoc"]);
  const statusLetterMap: Record<string, string> = {
    V: "Vigente",
    C: "Cancelada",
    X: "Vencida",
    N: "No Vigente",
    P: "Pendiente",
  };
  const statusNumMap: Record<string, string> = {
    "1": "Vigente",
    "2": "Renovada",
    "3": "Cancelada",
    "4": "No Vigente",
    "5": "Pendiente",
  };
  const statusTexto =
    statusTxt ||
    statusLetterMap[statusRaw] ||
    statusNumMap[statusRaw] ||
    statusRaw ||
    "";

  const tipoDoc = get(["TipoDocto_TXT", "TipoDocto", "Tipo"]);
  const subtipoDoc = get(["SubTipoDocto_TXT", "SubTipoDocto"]);
  const tipoLower = tipoDoc.toLowerCase();
  const isPoliza =
    tipoLower.includes("poliza") ||
    tipoLower.includes("póliza") ||
    (!tipoLower.includes("fianza") && !tipoLower.includes("orden"));
  const isFianza = tipoLower.includes("fianza");

  const fHasta = get(["FHasta", "FechaHasta", "Vigencia_Hasta"]);
  const today = new Date();
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
    } catch {
      /* ignore */
    }
  }
  const isCancelada = statusTexto.toLowerCase() === "cancelada";
  const isRenewable =
    isVigente &&
    renewalDays !== null &&
    renewalDays >= 0 &&
    renewalDays <= 90;

  return {
    id_docto: idDocto,
    vend_id: vendId || null,
    vend_nombre: get(["VendNombre", "Vendedor", "Vend_Nombre"]) || null,
    desp_id: desp_id,
    desp_nombre: despNombre || null,
    usuario_id,
    oficina_id,
    oficina_nombre,
    ramo: get(["RamosNombre", "Ramo", "Ramo_TXT", "NombreRamo"]) || null,
    subramo: get(["SRamoNombre", "SubRamo", "SubRamo_TXT"]) || null,
    compania:
      get(["CiaNombre", "Aseguradora", "Compania"]) || null,
    aseguradora_nombre:
      get(["CiaAbreviacion", "CiaNombre", "Abreviacion"]) || null,
    poliza: get(["Documento", "NoDocumento", "No_Documento"]) || null,
    cliente:
      get(["NombreCompleto", "Nombre_Completo", "Cliente", "Contratante"]) ||
      null,
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
    sicas_id_agente:
      get(["IDAgente", "AgenteId", "CAgente"]) || null,
    agente_nombre:
      get(["AgenteNombre", "Agente", "NombreAgente"]) || null,
    status_codigo: statusRaw || null,
    status_texto: statusTexto || null,
    status_cobro:
      get(["StatusCobro", "Status_Cobro", "EstatusCobro"]) || null,
    is_poliza: isPoliza,
    is_fianza: isFianza,
    is_vigente: isVigente,
    is_cancelada: isCancelada,
    is_renewable: isRenewable,
    renewal_days_remaining: renewalDays,
    source_keycode: keycode,
    synced_at: new Date().toISOString(),
  };
}

async function upsertDocuments(
  supabase: ReturnType<typeof createClient>,
  documents: Record<string, unknown>[]
): Promise<{ upserted: number; errors: number }> {
  const validDocs = documents.filter(
    (d) => d !== null && d.id_docto
  );
  if (validDocs.length === 0) return { upserted: 0, errors: 0 };

  let totalUpserted = 0;
  let totalErrors = 0;
  const batchSize = 500;

  for (let i = 0; i < validDocs.length; i += batchSize) {
    const batch = validDocs.slice(i, i + batchSize);
    const { error: upsertError, data: upserted } = await supabase
      .from("sicas_documents")
      .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
      .select("id");

    if (upsertError) {
      console.error(`[ORCHESTRATOR] Upsert error: ${upsertError.message}`);
      totalErrors += batch.length;
    } else {
      totalUpserted += upserted?.length || batch.length;
    }
  }

  // Also upsert into sicas_polizas_vigentes for backward compat
  const polizasVigentes = validDocs.map((d) => ({
    id_documento: d.id_docto as string,
    no_poliza: d.poliza || null,
    vend_id: d.vend_id || null,
    vend_nombre: d.vend_nombre || null,
    desp_id: d.desp_id || null,
    desp_nombre: d.desp_nombre || null,
    aseguradora: d.compania || null,
    ramo: d.ramo || null,
    subramo: d.subramo || null,
    contratante: d.cliente || null,
    vigencia_desde: d.vigencia_desde || null,
    vigencia_hasta: d.vigencia_hasta || null,
    prima_neta: d.prima_neta || null,
    prima_total: d.prima_total || null,
    usuario_id: d.usuario_id || null,
    oficina_id: d.oficina_id || null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < polizasVigentes.length; i += batchSize) {
    const batch = polizasVigentes.slice(i, i + batchSize);
    const { error } = await supabase
      .from("sicas_polizas_vigentes")
      .upsert(batch, { onConflict: "id_documento", ignoreDuplicates: false });
    if (error) {
      console.error(
        `[ORCHESTRATOR] sicas_polizas_vigentes error: ${error.message}`
      );
    }
  }

  return { upserted: totalUpserted, errors: totalErrors };
}
