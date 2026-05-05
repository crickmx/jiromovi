import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
const MAX_SECONDS = 55;
const PAGES_PER_BATCH = 999;

interface SyncState {
  currentPage: number;
  totalPages: number;
  totalRecordsInSicas: number;
  totalFetched: number;
  totalUpserted: number;
  totalErrors: number;
  incrementalSince?: string;
}

interface SoapPageResult {
  records: Record<string, unknown>[];
  totalPages: number;
  totalRecords: number;
  currentPage: number;
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchSoapPage(
  endpoint: string,
  username: string,
  password: string,
  page: number,
  itemsPerPage: number,
  incrementalSince?: string
): Promise<SoapPageResult> {
  const escapedUser = xmlEscape(username);
  const escapedPass = xmlEscape(password);

  // Build ConditionsAdd: always filter by Vigentes status
  // If incremental, also add date filter for FCaptura
  let conditionsAdd = "Estatus;0;0;0;Vigentes;-1;0;DatDocumentos.Status";
  if (incrementalSince) {
    // Format: DD/MM/YYYY HH:mm
    const parts = incrementalSince.split("-");
    const fromDate = `${parts[2]}/${parts[1]}/${parts[0]} 00:00`;
    const today = new Date();
    const toDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()} 23:59`;
    conditionsAdd += `!Desde|Hasta|Captura;3;1;${fromDate}|${toDate};${fromDate}|${toDate};0;-1;DatDocumentos.FCaptura`;
  }

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${escapedUser}</tem:UserName>
          <tem:Password>${escapedPass}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H03400</tem:KeyCode>
        <tem:Page>${page}</tem:Page>
        <tem:ItemForPage>${itemsPerPage}</tem:ItemForPage>
        <tem:InfoSort>DatDocumentos.FCaptura DESC</tem:InfoSort>
        <tem:ConditionsAdd>${conditionsAdd}</tem:ConditionsAdd>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://tempuri.org/ProcesarWS",
    },
    body: envelope,
  });

  if (!resp.ok) {
    throw new Error(`SOAP HTTP ${resp.status}: ${resp.statusText}`);
  }

  const rawText = await resp.text();

  const decoded = rawText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  // Check for errors in PROCESSDATA
  const msgMatch = decoded.match(/<MESSAGE>([\s\S]*?)<\/MESSAGE>/i);
  if (msgMatch) {
    const msg = msgMatch[1].trim();
    if (
      msg.toLowerCase().includes("error") ||
      msg.toLowerCase().includes("denied") ||
      msg.toLowerCase().includes("sintaxis")
    ) {
      throw new Error(`SICAS SOAP error: ${msg}`);
    }
  }

  // Parse <TableInfo> blocks for records
  const records: Record<string, unknown>[] = [];
  const tableInfoRegex = /<TableInfo>([\s\S]*?)<\/TableInfo>/gi;
  let match;
  while ((match = tableInfoRegex.exec(decoded)) !== null) {
    const block = match[1];
    const record: Record<string, unknown> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fm;
    while ((fm = fieldRegex.exec(block)) !== null) {
      const val = fm[2].trim();
      if (val && !isNaN(Number(val)) && val !== "") {
        record[fm[1]] = Number(val);
      } else {
        record[fm[1]] = val;
      }
    }
    if (Object.keys(record).length > 0) {
      records.push(record);
    }
  }

  // Parse <TableControl> for pagination
  let totalPages = 1;
  let totalRecords = 0;
  let currentPageReturned = page;

  const controlMatch = decoded.match(
    /<TableControl>([\s\S]*?)<\/TableControl>/i
  );
  if (controlMatch) {
    const controlBlock = controlMatch[1];
    const pagesMatch = controlBlock.match(/<Pages>(\d+)<\/Pages>/i);
    const maxRecMatch = controlBlock.match(/<MaxRecords>(\d+)<\/MaxRecords>/i);
    const pageMatch = controlBlock.match(/<Page>(\d+)<\/Page>/i);
    if (pagesMatch) totalPages = parseInt(pagesMatch[1], 10);
    if (maxRecMatch) totalRecords = parseInt(maxRecMatch[1], 10);
    if (pageMatch) currentPageReturned = parseInt(pageMatch[1], 10);
  }

  return { records, totalPages, totalRecords, currentPage: currentPageReturned };
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

    const soapEndpoint =
      Deno.env.get("SICAS_SOAP_ENDPOINT") ||
      "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";
    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";

    // ── ACTION: start ──────────────────────────────────────────────────
    if (action === "start") {
      // Auto-recover stale jobs (stuck for more than 10 minutes)
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

      // Fetch page 1 to discover total pages and records
      console.log("[BULK-SYNC] Fetching page 1 to discover totals...");
      const firstPage = await fetchSoapPage(
        soapEndpoint,
        sicasUsername,
        sicasPassword,
        1,
        ITEMS_PER_PAGE,
        incrementalSince
      );

      const syncState: SyncState = {
        currentPage: 1,
        totalPages: firstPage.totalPages,
        totalRecordsInSicas: firstPage.totalRecords,
        totalFetched: firstPage.records.length,
        totalUpserted: 0,
        totalErrors: 0,
        incrementalSince,
      };

      console.log(
        `[BULK-SYNC] Discovered: ${syncState.totalRecordsInSicas} total records, ${syncState.totalPages} pages`
      );

      // Create job record immediately (don't upsert page 1 here - let continue do all the work)
      syncState.currentPage = 1; // Start from page 1

      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode: mode || "full",
          status: "running",
          triggered_by: body.triggeredBy || null,
          keycode: "H03400_SOAP",
          started_at: new Date().toISOString(),
          total_pages: syncState.totalPages,
          current_page: 0,
          total_synced: 0,
          total_in_sicas: syncState.totalRecordsInSicas,
          total_errors: 0,
          percent: 0,
          error_message: JSON.stringify(syncState),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creating job: ${jobError.message}`);

      console.log(
        `[BULK-SYNC] Created job ${job.id}, discovered ${syncState.totalPages} pages, ${syncState.totalRecordsInSicas} records. Frontend will call continue.`
      );

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: "running",
        totalPages: syncState.totalPages,
        totalRecordsInSicas: syncState.totalRecordsInSicas,
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

      let syncState: SyncState;
      try {
        syncState = JSON.parse(job.error_message || "{}");
      } catch {
        return jsonResponse(200, { ok: true, status: "invalid_state" });
      }

      if (!syncState.currentPage || !syncState.totalPages) {
        return jsonResponse(200, { ok: true, status: "invalid_state" });
      }

      if (syncState.currentPage > syncState.totalPages) {
        await markComplete(supabase, jobId, syncState);
        return jsonResponse(200, { ok: true, status: "completed" });
      }

      // Mark as actively running so auto-recovery won't kill it
      await supabase
        .from("sicas_sync_jobs")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", jobId);

      const batchStart = Date.now();
      const despachoNameToOffice = await loadDespachoNameMap(supabase);
      const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

      let pagesThisBatch = 0;

      while (
        syncState.currentPage <= syncState.totalPages &&
        pagesThisBatch < PAGES_PER_BATCH
      ) {
        const elapsed = (Date.now() - batchStart) / 1000;
        if (elapsed >= MAX_SECONDS) break;

        const page = syncState.currentPage;
        console.log(
          `[BULK-SYNC] Fetching page ${page}/${syncState.totalPages}...`
        );

        try {
          const pageResult = await fetchSoapPage(
            soapEndpoint,
            sicasUsername,
            sicasPassword,
            page,
            ITEMS_PER_PAGE,
            syncState.incrementalSince
          );

          if (pageResult.records.length === 0) {
            console.log(
              `[BULK-SYNC] Page ${page} returned 0 records, skipping.`
            );
            syncState.currentPage++;
            pagesThisBatch++;
            continue;
          }

          // Update totalPages if server reports differently
          if (
            pageResult.totalPages > 0 &&
            pageResult.totalPages !== syncState.totalPages
          ) {
            console.log(
              `[BULK-SYNC] Server updated totalPages: ${syncState.totalPages} -> ${pageResult.totalPages}`
            );
            syncState.totalPages = pageResult.totalPages;
            if (pageResult.totalRecords > 0) {
              syncState.totalRecordsInSicas = pageResult.totalRecords;
            }
          }

          syncState.totalFetched += pageResult.records.length;

          const documents = pageResult.records
            .map((raw) =>
              mapDocument(
                raw,
                "H03400",
                despachoNameToOffice,
                vendorToUser,
                vendorToOficina
              )
            )
            .filter((d) => d !== null);

          const result = await upsertDocuments(supabase, documents);
          syncState.totalUpserted += result.upserted;
          syncState.totalErrors += result.errors;

          console.log(
            `[BULK-SYNC] Page ${page}: ${pageResult.records.length} fetched, ${result.upserted} upserted`
          );
        } catch (e: unknown) {
          console.error(
            `[BULK-SYNC] Page ${page} error: ${(e as Error).message}`
          );
          syncState.totalErrors++;
        }

        syncState.currentPage++;
        pagesThisBatch++;
      }

      const isComplete = syncState.currentPage > syncState.totalPages;

      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      const percent = isComplete
        ? 100
        : syncState.totalPages > 0
          ? Math.min(
              99,
              Math.round(
                ((syncState.currentPage - 1) / syncState.totalPages) * 100
              )
            )
          : 0;

      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: isComplete ? "completed" : "running",
          total_synced: uniqueCount || 0,
          total_in_sicas: syncState.totalRecordsInSicas,
          total_errors: syncState.totalErrors,
          current_page: syncState.currentPage - 1,
          total_pages: syncState.totalPages,
          percent,
          error_message: JSON.stringify(syncState),
          updated_at: new Date().toISOString(),
          ...(isComplete ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", jobId);

      console.log(
        `[BULK-SYNC] Batch done: page ${syncState.currentPage - 1}/${syncState.totalPages}, ` +
          `${uniqueCount} unique docs in DB, ${percent}% complete`
      );

      // Frontend auto-continues via polling when job is stale

      return jsonResponse(200, {
        ok: true,
        jobId,
        status: isComplete ? "completed" : "running",
        progress: {
          percent,
          currentPage: syncState.currentPage - 1,
          totalPages: syncState.totalPages,
          totalRecordsInSicas: syncState.totalRecordsInSicas,
          uniqueDocs: uniqueCount,
          totalFetched: syncState.totalFetched,
          totalErrors: syncState.totalErrors,
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
