import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasSoapReportClient } from "../_shared/sicasSoapReportClient.ts";
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

const ITEMS_PER_PAGE = 500;
const MAX_SECONDS = 45;
const PAGES_PER_BATCH = 999;
const MAX_RETRIES_PER_PAGE = 3;
const RETRY_DELAY_MS = 5000;
const INTER_PAGE_DELAY_MS = 1500;

interface SyncState {
  currentPage: number;
  totalPages: number;
  totalRecordsInSicas: number;
  totalFetched: number;
  totalUpserted: number;
  totalErrors: number;
  emptyPages: number;
  retriedPages: number;
  failedPages: number[];
  droppedPages: number[];
  retryAttempts: Record<string, number>;
  incrementalSince?: string;
  transport: "soap" | "rest";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerSelfContinuation(jobId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = `${supabaseUrl}/functions/v1/sicas-bulk-sync`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ action: "continue", jobId }),
    });
  } catch (e) {
    console.error(`[BULK-SYNC] Self-continuation failed: ${(e as Error).message}`);
  }
}

async function fetchSoapPage(
  client: SicasSoapReportClient,
  keyCode: string,
  page: number,
  itemsPerPage: number,
  _incrementalSince?: string
): Promise<{ records: Record<string, unknown>[]; totalPages: number; totalRecords: number; currentPage: number }> {
  const startMs = Date.now();
  const result = await client.executeReport({
    keyCode,
    page,
    itemsPerPage,
    sortField: "DatDocumentos.FCaptura DESC",
    typeFormat: "XML",
  });

  if (!result.success && result.message) {
    throw new Error(`SICAS SOAP error: ${result.message}`);
  }

  const records = result.records || [];
  const totalRecords = result.totalRecords || 0;

  // SOAP ProcesarWS doesn't return page metadata the same way REST does.
  // We estimate total pages based on totalRecords and items per page.
  let totalPages = 1;
  if (totalRecords > 0 && itemsPerPage > 0) {
    totalPages = Math.ceil(totalRecords / itemsPerPage);
  } else if (records.length === itemsPerPage) {
    // If we got a full page, there are likely more pages
    totalPages = page + 1;
  }

  return { records, totalPages, totalRecords, currentPage: page };
}

async function fetchRestPage(
  client: SicasRestClient,
  keyCode: string,
  page: number,
  itemsPerPage: number,
  _incrementalSince?: string
): Promise<{ records: Record<string, unknown>[]; totalPages: number; totalRecords: number; currentPage: number }> {
  const result = await client.readReport({
    keyCode,
    pageRequested: page,
    itemsForPage: itemsPerPage,
    sortFields: "DatDocumentos.FCaptura DESC",
    formatResponse: 2,
  });

  if (result.Sucess === false && result.Error) {
    throw new Error(`SICAS REST error: ${result.Error}`);
  }

  const responseArray = result.Response || [];
  let records: Record<string, unknown>[] = [];
  let totalRecords = 0;
  let totalPages = 1;

  for (const item of responseArray) {
    if (item.TableControl && Array.isArray(item.TableControl) && item.TableControl.length > 0) {
      const ctrl = item.TableControl[0];
      totalRecords = ctrl.MaxRecords || 0;
      totalPages = ctrl.Pages || 1;
    }
    if (item.TableInfo && Array.isArray(item.TableInfo)) {
      records = item.TableInfo;
    }
  }

  if (totalPages === 0 && totalRecords > 0 && itemsPerPage > 0) {
    totalPages = Math.ceil(totalRecords / itemsPerPage);
  }

  return { records, totalPages, totalRecords, currentPage: page };
}

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

    // Read config
    const { data: sicasConfig } = await supabase
      .from("sicas_config")
      .select("id, endpoint, sicas_usuario, sicas_password, code_auth, use_rest, current_report_code, last_successful_report, alternate_report_codes, report_test_history")
      .limit(1)
      .maybeSingle();

    // Check circuit breaker before proceeding
    const { data: cbData } = await supabase.rpc('check_sicas_circuit_breaker');
    const cbState = cbData || { is_open: false };
    if (cbState.is_open && action !== "status" && action !== "cancel") {
      return jsonResponse(503, {
        ok: false,
        error: "SICAS esta respondiendo con errores o lentitud. MOVI pauso temporalmente los procesos automaticos para evitar saturacion.",
        circuit_breaker: cbState,
      });
    }

    // Determine transport: REST or SOAP based on config
    const useRest = sicasConfig?.use_rest === true;
    const soapEndpoint = sicasConfig?.endpoint || "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx";
    const sicasUsername = Deno.env.get("SICAS_USERNAME") || sicasConfig?.sicas_usuario || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || sicasConfig?.sicas_password || "";
    const codeAuth = sicasConfig?.code_auth || "";

    if (!sicasUsername || !sicasPassword) {
      return jsonResponse(400, { ok: false, error: "Credenciales SICAS no configuradas. Revisa la configuracion SICAS." });
    }

    const soapClient = new SicasSoapReportClient({
      endpoint: soapEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    let restClient: SicasRestClient | null = null;
    if (useRest) {
      restClient = new SicasRestClient({
        username: sicasUsername,
        password: sicasPassword,
        sCodeAuth: codeAuth,
      });
    }

    // Determine keycode from DB config with fallback chain
    const DOCUMENT_REPORT_CODES = [
      sicasConfig?.last_successful_report,
      sicasConfig?.current_report_code,
      "HWS_DOCTOS",
      "HAPPDATAL_D004",
      "H03400",
      "H03117",
      "HWS03668_WS",
    ].filter((c): c is string => !!c && c.length > 0);
    const reportCodesToTry = [...new Set(DOCUMENT_REPORT_CODES)];
    const keyCode = body.keyCode || reportCodesToTry[0] || "HWS_DOCTOS";
    const transport = useRest ? "rest" : "soap";

    console.log(`[BULK-SYNC] Using ${transport.toUpperCase()} API with keyCode: ${keyCode} (fallbacks: ${reportCodesToTry.slice(1).join(", ")})`);

    // ── ACTION: start ──────────────────────────────────────────────────
    if (action === "start") {
      // Auto-recover stale jobs (stuck for more than 10 minutes without update)
      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: "failed",
          error_message: "Auto-recovery: job stuck sin actualizacion por mas de 10 minutos",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("status", ["queued", "running"])
        .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

      // Check if there's already a running job (not stale)
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

      // Determine incremental date filter
      const mode: string = body.mode || "full";
      let incrementalSince: string | undefined;
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
          console.log(`[BULK-SYNC] Incremental mode: fetching since ${incrementalSince}`);
        } else {
          console.log(`[BULK-SYNC] No previous sync, falling back to full mode`);
        }
      }

      // Create the job record
      const syncState: SyncState = {
        currentPage: 0,
        totalPages: 0,
        totalRecordsInSicas: 0,
        totalFetched: 0,
        totalUpserted: 0,
        totalErrors: 0,
        emptyPages: 0,
        retriedPages: 0,
        failedPages: [],
        droppedPages: [],
        retryAttempts: {},
        incrementalSince,
        transport,
      };

      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode: mode || "full",
          status: "running",
          triggered_by: body.triggeredBy || null,
          keycode: `${keyCode}_${transport.toUpperCase()}`,
          started_at: new Date().toISOString(),
          total_pages: 0,
          current_page: 0,
          total_synced: 0,
          total_in_sicas: 0,
          total_errors: 0,
          percent: 0,
          error_message: JSON.stringify(syncState),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creating job: ${jobError.message}`);

      console.log(`[BULK-SYNC] Created job ${job.id}. Using ${transport.toUpperCase()} transport.`);

      // Trigger self-continuation to begin actual sync work
      EdgeRuntime.waitUntil(
        sleep(500).then(() => triggerSelfContinuation(job.id))
      );

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: "running",
        transport,
      });
    }

    // ── ACTION: continue ───────────────────────────────────────────────
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
        });
      }

      // Use the keycode stored in the job
      const effectiveKeyCode = job.keycode
        ? job.keycode.replace(/_REST$/, "").replace(/_SOAP$/, "")
        : keyCode;

      let syncState: SyncState;
      try {
        syncState = JSON.parse(job.error_message || "{}");
      } catch {
        return jsonResponse(200, { ok: true, status: "invalid_state" });
      }

      // Initialize fields for backward compat
      if (syncState.emptyPages === undefined) syncState.emptyPages = 0;
      if (syncState.retriedPages === undefined) syncState.retriedPages = 0;
      if (!Array.isArray(syncState.failedPages)) syncState.failedPages = [];
      if (!Array.isArray(syncState.droppedPages)) syncState.droppedPages = [];
      if (!syncState.retryAttempts || typeof syncState.retryAttempts !== "object") syncState.retryAttempts = {};
      if (!syncState.transport) syncState.transport = "soap";

      // Mark as actively running
      await supabase
        .from("sicas_sync_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId);

      // Discovery phase: totalPages === 0 means we need to fetch page 1
      if (syncState.totalPages === 0) {
        const activeTransport = syncState.transport || transport;
        console.log(`[BULK-SYNC] Discovery phase: fetching page 1 via ${activeTransport.toUpperCase()}...`);
        let firstPageResult: { records: Record<string, unknown>[]; totalPages: number; totalRecords: number; currentPage: number } | null = null;
        let usedKeyCode = effectiveKeyCode;

        // Try primary keycode, then fallbacks
        const codesToAttempt = [effectiveKeyCode, ...reportCodesToTry.filter(c => c !== effectiveKeyCode)];
        let lastError = "";

        for (const tryCode of codesToAttempt) {
          let succeeded = false;
          for (let attempt = 1; attempt <= MAX_RETRIES_PER_PAGE; attempt++) {
            try {
              firstPageResult = activeTransport === "rest" && restClient
                ? await fetchRestPage(restClient, tryCode, 1, ITEMS_PER_PAGE, syncState.incrementalSince)
                : await fetchSoapPage(soapClient, tryCode, 1, ITEMS_PER_PAGE, syncState.incrementalSince);
              usedKeyCode = tryCode;
              succeeded = true;
              break;
            } catch (e: unknown) {
              const errMsg = (e as Error).message || "";
              lastError = errMsg;
              console.error(`[BULK-SYNC] Page 1 with code "${tryCode}" attempt ${attempt}/${MAX_RETRIES_PER_PAGE} failed: ${errMsg}`);

              const isNonRetryable = /no encontrado|not found|no existe|no habilitado|not enabled|invalid.*report|credenciales|unauthorized|forbidden|denegad/i.test(errMsg);
              if (isNonRetryable) {
                console.warn(`[BULK-SYNC] Non-retryable error for code "${tryCode}". Trying next code...`);
                if (sicasConfig?.id) {
                  await supabase.from("sicas_config").update({
                    report_test_history: {
                      ...(sicasConfig?.report_test_history || {}),
                      last_test_at: new Date().toISOString(),
                      last_failed_code: tryCode,
                      last_failed_error: errMsg,
                    },
                    updated_at: new Date().toISOString(),
                  }).eq("id", sicasConfig.id);
                }
                break;
              }

              if (attempt === MAX_RETRIES_PER_PAGE) break;
              await sleep(RETRY_DELAY_MS * attempt);
            }
          }
          if (succeeded) {
            if (sicasConfig?.id && tryCode !== sicasConfig?.last_successful_report) {
              await supabase.from("sicas_config").update({
                last_successful_report: tryCode,
                report_test_history: {
                  ...(sicasConfig?.report_test_history || {}),
                  last_test_at: new Date().toISOString(),
                  successful_codes: [...new Set([...(sicasConfig?.report_test_history?.successful_codes || []), tryCode])],
                },
                updated_at: new Date().toISOString(),
              }).eq("id", sicasConfig.id);
            }
            console.log(`[BULK-SYNC] SOAP connected with code "${tryCode}", ${firstPageResult?.records.length || 0} records on page 1`);
            break;
          }
        }

        if (!firstPageResult || firstPageResult.records.length === 0) {
          const message = firstPageResult
            ? `Reporte ${activeTransport.toUpperCase()} "${usedKeyCode}" no devolvio registros. Verifica que el reporte tenga datos o prueba otro codigo.`
            : `Ningun reporte SICAS valido encontrado via ${activeTransport.toUpperCase()}. Codigos probados: ${codesToAttempt.join(", ")}. Error: ${lastError}`;

          await supabase.from("sicas_sync_jobs").update({
            status: firstPageResult ? "completed" : "failed",
            error_message: message,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            percent: firstPageResult ? 100 : 0,
          }).eq("id", jobId);

          return jsonResponse(200, {
            ok: true,
            status: firstPageResult ? "completed" : "failed",
            message,
            triedCodes: codesToAttempt,
            transport: activeTransport,
          });
        }

        // Update job keycode if we used a different one
        if (usedKeyCode !== effectiveKeyCode) {
          await supabase.from("sicas_sync_jobs").update({
            keycode: `${usedKeyCode}_${activeTransport.toUpperCase()}`,
          }).eq("id", jobId);
        }

        syncState.totalPages = firstPageResult.totalPages;
        syncState.totalRecordsInSicas = firstPageResult.totalRecords;
        syncState.totalFetched = firstPageResult.records.length;
        syncState.currentPage = 1;

        console.log(`[BULK-SYNC] Discovered via SOAP: ${syncState.totalRecordsInSicas} records, ${syncState.totalPages} pages`);

        // Process page 1 records
        if (firstPageResult.records.length > 0) {
          const despachoNameToOffice = await loadDespachoNameMap(supabase);
          const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);
          const documents = firstPageResult.records
            .map((raw) => mapDocument(raw, usedKeyCode, despachoNameToOffice, vendorToUser, vendorToOficina))
            .filter((d) => d !== null);
          const result = await upsertDocuments(supabase, documents);
          syncState.totalUpserted += result.upserted;
          syncState.totalErrors += result.errors;
          console.log(`[BULK-SYNC] Page 1: ${firstPageResult.records.length} fetched, ${result.upserted} upserted`);
        }

        syncState.currentPage = 2;

        await supabase.from("sicas_sync_jobs").update({
          total_pages: syncState.totalPages,
          total_in_sicas: syncState.totalRecordsInSicas,
          current_page: 1,
          total_synced: syncState.totalUpserted,
          percent: syncState.totalPages > 0 ? Math.round((1 / syncState.totalPages) * 90) : 50,
          error_message: JSON.stringify(syncState),
          updated_at: new Date().toISOString(),
        }).eq("id", jobId).eq("status", "running");

        // If totalPages is 1 or records < itemsPerPage, we're done
        if (syncState.totalPages <= 1 || firstPageResult.records.length < ITEMS_PER_PAGE) {
          console.log(`[BULK-SYNC] ${activeTransport.toUpperCase()} returned all records in single page. Completing.`);
          await markComplete(supabase, jobId, syncState);
          return jsonResponse(200, { ok: true, jobId, status: "completed", transport: activeTransport });
        }

        EdgeRuntime.waitUntil(sleep(1000).then(() => triggerSelfContinuation(jobId)));
        return jsonResponse(200, { ok: true, jobId, status: "running", progress: {
          percent: 0, currentPage: 1, totalPages: syncState.totalPages,
          totalRecordsInSicas: syncState.totalRecordsInSicas,
        }});
      }

      if (syncState.currentPage > syncState.totalPages && syncState.totalPages > 0) {
        if (syncState.failedPages.length > 0) {
          console.log(`[BULK-SYNC] All pages visited, retrying ${syncState.failedPages.length} failed pages...`);
          syncState.currentPage = -1;
        } else {
          await markComplete(supabase, jobId, syncState);
          return jsonResponse(200, { ok: true, status: "completed" });
        }
      }

      const batchStart = Date.now();
      const despachoNameToOffice = await loadDespachoNameMap(supabase);
      const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

      let pagesThisBatch = 0;

      // Safety check: too many dropped pages
      if (syncState.droppedPages.length > syncState.totalPages * 0.6 && syncState.totalPages > 10) {
        console.log(`[BULK-SYNC] Too many dropped pages (${syncState.droppedPages.length}/${syncState.totalPages}). Marking as partial.`);
        syncState.currentPage = syncState.totalPages + 1;
        syncState.failedPages = [];
        await markComplete(supabase, jobId, syncState);
        return jsonResponse(200, { ok: true, status: "completed" });
      }

      // Retry mode
      if (syncState.currentPage === -1) {
        const pagesToRetry = [...syncState.failedPages];
        syncState.failedPages = [];
        let retryIdx = 0;

        for (const page of pagesToRetry) {
          const elapsed = (Date.now() - batchStart) / 1000;
          if (elapsed >= MAX_SECONDS) {
            syncState.failedPages.push(...pagesToRetry.slice(retryIdx));
            break;
          }

          const pageKey = String(page);
          const attempts = (syncState.retryAttempts[pageKey] || 0) + 1;
          syncState.retryAttempts[pageKey] = attempts;

          if (attempts > MAX_RETRIES_PER_PAGE) {
            console.log(`[BULK-SYNC] DROPPING page ${page} after ${MAX_RETRIES_PER_PAGE} failed attempts.`);
            syncState.droppedPages.push(page);
            retryIdx++;
            pagesThisBatch++;
            continue;
          }

          if (retryIdx > 0) {
            await sleep(RETRY_DELAY_MS);
          }

          console.log(`[BULK-SYNC] RETRY: page ${page} attempt ${attempts}/${MAX_RETRIES_PER_PAGE}...`);
          try {
            const pageResult = syncState.transport === "rest" && restClient
              ? await fetchRestPage(restClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince)
              : await fetchSoapPage(soapClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince);

            if (pageResult.records.length > 0) {
              syncState.totalFetched += pageResult.records.length;
              syncState.retriedPages++;
              delete syncState.retryAttempts[pageKey];
              const documents = pageResult.records
                .map((raw) => mapDocument(raw, effectiveKeyCode, despachoNameToOffice, vendorToUser, vendorToOficina))
                .filter((d) => d !== null);
              const result = await upsertDocuments(supabase, documents);
              syncState.totalUpserted += result.upserted;
              console.log(`[BULK-SYNC] RETRY page ${page}: ${pageResult.records.length} fetched, ${result.upserted} upserted`);
            } else {
              console.log(`[BULK-SYNC] RETRY page ${page}: still empty (attempt ${attempts}).`);
              syncState.failedPages.push(page);
            }
          } catch (e: unknown) {
            console.error(`[BULK-SYNC] RETRY page ${page} error (attempt ${attempts}): ${(e as Error).message}`);
            syncState.failedPages.push(page);
          }
          retryIdx++;
          pagesThisBatch++;
        }

        if (syncState.failedPages.length === 0) {
          syncState.currentPage = syncState.totalPages + 1;
          await markComplete(supabase, jobId, syncState);
          return jsonResponse(200, { ok: true, status: "completed" });
        }
      } else {
        // Normal sequential page processing
        while (
          syncState.currentPage <= syncState.totalPages &&
          pagesThisBatch < PAGES_PER_BATCH
        ) {
          const elapsed = (Date.now() - batchStart) / 1000;
          if (elapsed >= MAX_SECONDS) break;

          // Check circuit breaker mid-batch
          if (pagesThisBatch > 0 && pagesThisBatch % 5 === 0) {
            const { data: midCbData } = await supabase.rpc('check_sicas_circuit_breaker');
            if (midCbData?.is_open) {
              console.log("[BULK-SYNC] Circuit breaker tripped mid-batch. Pausing.");
              break;
            }
          }

          const page = syncState.currentPage;

          if (pagesThisBatch > 0) {
            await sleep(INTER_PAGE_DELAY_MS);
          }

          try {
            const pageResult = syncState.transport === "rest" && restClient
              ? await fetchRestPage(restClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince)
              : await fetchSoapPage(soapClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince);

            if (pageResult.records.length === 0) {
              console.log(`[BULK-SYNC] Page ${page} returned 0 records.`);
              syncState.emptyPages++;

              const retryElapsed = (Date.now() - batchStart) / 1000;
              if (retryElapsed < MAX_SECONDS - 8) {
                await sleep(RETRY_DELAY_MS);
                try {
                  const retryResult = syncState.transport === "rest" && restClient
                    ? await fetchRestPage(restClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince)
                    : await fetchSoapPage(soapClient, effectiveKeyCode, page, ITEMS_PER_PAGE, syncState.incrementalSince);
                  if (retryResult.records.length > 0) {
                    syncState.totalFetched += retryResult.records.length;
                    syncState.retriedPages++;
                    const documents = retryResult.records
                      .map((raw) => mapDocument(raw, effectiveKeyCode, despachoNameToOffice, vendorToUser, vendorToOficina))
                      .filter((d) => d !== null);
                    const result = await upsertDocuments(supabase, documents);
                    syncState.totalUpserted += result.upserted;
                    console.log(`[BULK-SYNC] Page ${page} RETRY success: ${retryResult.records.length} fetched`);
                  } else {
                    syncState.failedPages.push(page);
                  }
                } catch (retryErr: unknown) {
                  console.error(`[BULK-SYNC] Page ${page} retry error: ${(retryErr as Error).message}`);
                  syncState.failedPages.push(page);
                }
              } else {
                syncState.failedPages.push(page);
              }

              syncState.currentPage++;
              pagesThisBatch++;
              continue;
            }

            // Update totalPages if server provides more info
            if (
              pageResult.totalPages > 0 &&
              pageResult.totalPages !== syncState.totalPages
            ) {
              console.log(
                `[BULK-SYNC] Updated totalPages: ${syncState.totalPages} -> ${pageResult.totalPages}`
              );
              syncState.totalPages = pageResult.totalPages;
              if (pageResult.totalRecords > 0) {
                syncState.totalRecordsInSicas = pageResult.totalRecords;
              }
            }

            syncState.totalFetched += pageResult.records.length;

            const documents = pageResult.records
              .map((raw) =>
                mapDocument(raw, effectiveKeyCode, despachoNameToOffice, vendorToUser, vendorToOficina)
              )
              .filter((d) => d !== null);

            const result = await upsertDocuments(supabase, documents);
            syncState.totalUpserted += result.upserted;
            syncState.totalErrors += result.errors;

            if (pagesThisBatch % 5 === 0 || pageResult.records.length < ITEMS_PER_PAGE) {
              console.log(
                `[BULK-SYNC] Page ${page}/${syncState.totalPages}: ${pageResult.records.length} fetched, ${result.upserted} upserted (total: ${syncState.totalFetched})`
              );
            }

            // If we got fewer records than requested, we've reached the end
            if (pageResult.records.length < ITEMS_PER_PAGE) {
              console.log(`[BULK-SYNC] Page ${page} returned ${pageResult.records.length} < ${ITEMS_PER_PAGE}. Reached end of data.`);
              syncState.currentPage = syncState.totalPages + 1;
              pagesThisBatch++;
              break;
            }
          } catch (e: unknown) {
            const errMsg = (e as Error).message || "";
            console.error(`[BULK-SYNC] Page ${page} error: ${errMsg}`);
            syncState.totalErrors++;
            syncState.failedPages.push(page);

            // Record error in circuit breaker
            const isTimeout = errMsg.includes("timeout") || errMsg.includes("Timeout");
            await supabase.rpc("record_sicas_error", { p_is_timeout: isTimeout });

            // Log the failed call
            await supabase.from("sicas_api_call_logs").insert({
              process_type: "sync",
              module: "documents",
              method: "ProcesarWS",
              key_code: effectiveKeyCode,
              response_success: false,
              response_time_ms: 0,
              retry_count: 0,
              was_cached: false,
              was_rate_limited: false,
              was_blocked: false,
              error_message: errMsg,
              error_code: isTimeout ? "TIMEOUT" : "SOAP_ERROR",
            });
          }

          syncState.currentPage++;
          pagesThisBatch++;
        }
      }

      const isComplete = (syncState.currentPage > syncState.totalPages || syncState.currentPage === -1) && syncState.failedPages.length === 0;

      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      let percent: number;
      if (isComplete) {
        percent = 100;
      } else if (syncState.currentPage === -1) {
        const totalFailedOriginal = syncState.failedPages.length + syncState.droppedPages.length + syncState.retriedPages;
        const processed = syncState.droppedPages.length + syncState.retriedPages;
        percent = Math.min(99, Math.round(90 + (processed / Math.max(1, totalFailedOriginal)) * 10));
      } else if (syncState.totalPages > 0) {
        percent = Math.min(89, Math.round((Math.max(0, syncState.currentPage - 1) / syncState.totalPages) * 90));
      } else {
        percent = 0;
      }

      const { data: updateResult } = await supabase
        .from("sicas_sync_jobs")
        .update({
          status: isComplete ? "completed" : "running",
          total_synced: uniqueCount || 0,
          total_in_sicas: syncState.totalRecordsInSicas,
          total_errors: syncState.totalErrors,
          current_page: syncState.currentPage === -1 ? syncState.totalPages : Math.max(0, syncState.currentPage - 1),
          total_pages: syncState.totalPages,
          percent,
          error_message: JSON.stringify(syncState),
          updated_at: new Date().toISOString(),
          ...(isComplete ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", jobId)
        .eq("status", "running")
        .select("id");

      console.log(
        `[BULK-SYNC] Batch done: page ${Math.max(0, syncState.currentPage - 1)}/${syncState.totalPages}, ` +
          `${uniqueCount} unique docs in DB, ${percent}% complete, ` +
          `${syncState.failedPages.length} pending retry, ${syncState.droppedPages.length} dropped`
      );

      const wasCancelled = !updateResult || updateResult.length === 0;
      if (!isComplete && !wasCancelled) {
        EdgeRuntime.waitUntil(
          sleep(2000).then(() => triggerSelfContinuation(jobId))
        );
      } else if (wasCancelled) {
        console.log(`[BULK-SYNC] Job ${jobId} was cancelled externally, stopping.`);
      }

      return jsonResponse(200, {
        ok: true,
        jobId,
        status: isComplete ? "completed" : "running",
        transport: "soap",
        progress: {
          percent,
          currentPage: Math.max(0, syncState.currentPage - 1),
          totalPages: syncState.totalPages,
          totalRecordsInSicas: syncState.totalRecordsInSicas,
          uniqueDocs: uniqueCount,
          totalFetched: syncState.totalFetched,
          totalErrors: syncState.totalErrors,
          emptyPages: syncState.emptyPages,
          retriedPages: syncState.retriedPages,
          failedPagesRemaining: syncState.failedPages.length,
          droppedPages: syncState.droppedPages.length,
        },
      });
    }

    // ── ACTION: status ─────────────────────────────────────────────────
    if (action === "status") {
      const jobId = body.jobId;
      let query = supabase.from("sicas_sync_jobs").select("*");

      if (jobId) {
        query = query.eq("id", jobId);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }

      const { data: latestJob } = await query.maybeSingle();

      if (!latestJob) {
        return jsonResponse(200, { ok: true, status: "none" });
      }

      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      let syncState: Partial<SyncState> = {};
      try {
        syncState = JSON.parse(latestJob.error_message || "{}");
      } catch {
        /* ignore */
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
          uniqueDocs: uniqueCount,
          totalFetched: syncState.totalFetched || 0,
          totalErrors: latestJob.total_errors,
        },
        startedAt: latestJob.started_at,
        finishedAt: latestJob.finished_at,
      });
    }

    // ── ACTION: cancel ──────────────────────────────────────────────────
    if (action === "cancel" && body.jobId) {
      const jobId = body.jobId as string;
      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .in("status", ["queued", "running"]);

      return jsonResponse(200, { ok: true, status: "cancelled" });
    }

    return jsonResponse(400, {
      ok: false,
      error: `Unknown action: ${action}`,
    });
  } catch (error) {
    console.error(`[BULK-SYNC] FATAL: ${(error as Error).message}`);
    return jsonResponse(500, { ok: false, error: (error as Error).message });
  }
});


async function markComplete(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  syncState: SyncState
) {
  const { count } = await supabase
    .from("sicas_documents")
    .select("*", { count: "exact", head: true });
  await supabase
    .from("sicas_sync_jobs")
    .update({
      status: "completed",
      percent: 100,
      total_synced: count || 0,
      total_in_sicas: syncState.totalRecordsInSicas,
      current_page: syncState.totalPages,
      error_message: JSON.stringify(syncState),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// ===== Helper functions =====

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
  for (const m of mappings)
    despIdToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
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
  for (const m of vendorMappingsR.data || [])
    vendorToUser.set(String(m.id_sicas_vendedor), m.movi_user_id);
  for (const u of usuariosWithSicasR.data || []) {
    if (u.id_sicas && String(u.id_sicas).trim()) {
      const idSicas = String(u.id_sicas).trim();
      if (!vendorToUser.has(idSicas)) vendorToUser.set(idSicas, u.id);
      if (u.oficina_id) vendorToOficina.set(idSicas, u.oficina_id);
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
          if (userId === u.id && !vendorToOficina.has(vendId))
            vendorToOficina.set(vendId, u.oficina_id);
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
    const match = despachoNameToOffice.get(despNombre.toUpperCase().trim());
    if (match) {
      oficina_id = match.oficina_id;
      desp_id = match.desp_id;
      oficina_nombre = despNombre;
    }
  }

  let usuario_id: string | null = null;
  if (vendId && vendorToUser.has(vendId)) {
    usuario_id = vendorToUser.get(vendId)!;
    if (!oficina_id && vendorToOficina.has(vendId))
      oficina_id = vendorToOficina.get(vendId)!;
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
        renewalDays = Math.ceil(
          (hastaDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (renewalDays < 0 && isVigente) isVigente = false;
      }
    } catch {
      /* ignore */
    }
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
    sicas_id_agente: get(["IDAgente", "AgenteId", "CAgente"]) || null,
    agente_nombre:
      get(["AgenteNombre", "Agente", "NombreAgente"]) || null,
    status_codigo: statusRaw || null,
    status_texto: statusTexto || null,
    status_cobro: get(["StatusCobro", "Status_Cobro", "EstatusCobro"]) || null,
    is_poliza: isPoliza,
    is_fianza: isFianza,
    is_vigente: isVigente,
    is_cancelada: statusTexto.toLowerCase() === "cancelada",
    is_renewable:
      isVigente &&
      renewalDays !== null &&
      renewalDays >= 0 &&
      renewalDays <= 90,
    renewal_days_remaining: renewalDays,
    source_keycode: keycode,
    raw_data: null,
    raw_hash: null,
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
  const batchSize = 100;
  for (let i = 0; i < validDocs.length; i += batchSize) {
    const batch = validDocs.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from("sicas_documents")
      .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false });
    if (upsertError) {
      console.error(`[BULK-SYNC] Upsert error: ${upsertError.message}`);
      totalErrors += batch.length;
    } else {
      totalUpserted += batch.length;
    }
  }
  return { upserted: totalUpserted, errors: totalErrors };
}
