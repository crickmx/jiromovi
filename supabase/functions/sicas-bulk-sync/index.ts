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

interface WorkPlan {
  strategies: Strategy[];
  currentStrategyIndex: number;
  currentStepIndex: number;
  completedSteps: number;
  totalSteps: number;
}

interface Strategy {
  name: string;
  steps: StrategyStep[];
}

interface StrategyStep {
  label: string;
  keyCode: string;
  conditions?: string;
  conditionsDirect?: string;
  done?: boolean;
}

function buildWorkPlan(): WorkPlan {
  const strategies: Strategy[] = [];

  // Strategy 1: Unfiltered with multiple keycodes
  const keyCodes: StrategyStep[] = [
    { label: "HWS_DOCTOS unfiltered", keyCode: "HWS_DOCTOS" },
    { label: "HWSDOC unfiltered", keyCode: "HWSDOC" },
    { label: "HWSInventario unfiltered", keyCode: "HWSInventario" },
  ];
  strategies.push({ name: "keycodes", steps: keyCodes });

  // Strategy 2: IDDocto range scanning (0 to 500000 in chunks of 25000)
  const idRangeSteps: StrategyStep[] = [];
  for (let start = 0; start < 500000; start += 25000) {
    const end = start + 25000;
    idRangeSteps.push({
      label: `IDDocto ${start}-${end}`,
      keyCode: "HWS_DOCTOS",
      conditions: `DatDocumentos.IDDocto>=${start};DatDocumentos.IDDocto<${end}`,
    });
  }
  strategies.push({ name: "id_ranges", steps: idRangeSteps });

  // Strategy 3: Date range scanning by FCaptura (monthly from 2017-01 to 2026-12)
  const dateRangeSteps: StrategyStep[] = [];
  for (let year = 2017; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year === 2026 && month > 6) break;
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
      dateRangeSteps.push({
        label: `FCaptura ${from} to ${to}`,
        keyCode: "HWS_DOCTOS",
        conditions: `DatDocumentos.FCaptura>='${from}';DatDocumentos.FCaptura<'${to}'`,
      });
    }
  }
  strategies.push({ name: "date_ranges", steps: dateRangeSteps });

  // Strategy 4: Status codes (0-10)
  const statusSteps: StrategyStep[] = [];
  for (let s = 0; s <= 10; s++) {
    statusSteps.push({
      label: `Status=${s}`,
      keyCode: "HWS_DOCTOS",
      conditions: `DatDocumentos.Status=${s}`,
    });
  }
  strategies.push({ name: "statuses", steps: statusSteps });

  // Strategy 5: TipoDocto codes (1-10)
  const tipoSteps: StrategyStep[] = [];
  for (let t = 1; t <= 10; t++) {
    tipoSteps.push({
      label: `TipoDocto=${t}`,
      keyCode: "HWS_DOCTOS",
      conditions: `DatDocumentos.IDTipoDocto=${t}`,
    });
  }
  strategies.push({ name: "tipo_docto", steps: tipoSteps });

  // Strategy 6: conditionsDirect with LIKE patterns on Documento field
  const likeSteps: StrategyStep[] = [];
  for (let i = 0; i <= 9; i++) {
    likeSteps.push({
      label: `Documento starts with ${i}`,
      keyCode: "HWS_DOCTOS",
      conditionsDirect: `DatDocumentos.Documento LIKE '${i}%'`,
    });
  }
  for (const c of ["A", "B", "C", "D", "E", "F", "G", "H", "P", "S"]) {
    likeSteps.push({
      label: `Documento starts with ${c}`,
      keyCode: "HWS_DOCTOS",
      conditionsDirect: `DatDocumentos.Documento LIKE '${c}%'`,
    });
  }
  strategies.push({ name: "documento_like", steps: likeSteps });

  let totalSteps = 0;
  for (const s of strategies) totalSteps += s.steps.length;

  return {
    strategies,
    currentStrategyIndex: 0,
    currentStepIndex: 0,
    completedSteps: 0,
    totalSteps,
  };
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

    // ── ACTION: start ──────────────────────────────────────────────────
    if (action === "start") {
      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("status", ["queued", "running"]);

      const workPlan = buildWorkPlan();

      const { data: job, error: jobError } = await supabase
        .from("sicas_sync_jobs")
        .insert({
          mode: "full",
          status: "running",
          triggered_by: body.triggeredBy || null,
          keycode: "BULK",
          started_at: new Date().toISOString(),
          total_pages: workPlan.totalSteps,
          current_page: 0,
          percent: 0,
          error_message: JSON.stringify(workPlan),
        })
        .select("id")
        .single();

      if (jobError) throw new Error(`Error creando job: ${jobError.message}`);

      console.log(
        `[BULK-SYNC] Created job ${job.id} with ${workPlan.totalSteps} total steps across ${workPlan.strategies.length} strategies`
      );

      selfChain(supabaseUrl, supabaseKey, job.id);

      return jsonResponse(200, {
        ok: true,
        jobId: job.id,
        status: "running",
        totalSteps: workPlan.totalSteps,
        strategies: workPlan.strategies.map((s) => ({
          name: s.name,
          steps: s.steps.length,
        })),
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

      let workPlan: WorkPlan;
      try {
        workPlan = JSON.parse(job.error_message || "{}");
      } catch {
        return jsonResponse(200, { ok: true, status: "invalid_plan" });
      }

      if (
        !workPlan.strategies ||
        workPlan.currentStrategyIndex >= workPlan.strategies.length
      ) {
        await markComplete(supabase, jobId, workPlan);
        return jsonResponse(200, { ok: true, status: "completed" });
      }

      const batchStart = Date.now();
      const client = await createSicasRestClientWithDbAuth();
      const despachoNameToOffice = await loadDespachoNameMap(supabase);
      const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

      let totalErrors = job.total_errors || 0;
      let stepsProcessedThisBatch = 0;

      while (workPlan.currentStrategyIndex < workPlan.strategies.length) {
        const elapsed = (Date.now() - batchStart) / 1000;
        if (elapsed >= MAX_SECONDS) break;

        const strategy = workPlan.strategies[workPlan.currentStrategyIndex];
        const stepIdx = workPlan.currentStepIndex;

        if (stepIdx >= strategy.steps.length) {
          workPlan.currentStrategyIndex++;
          workPlan.currentStepIndex = 0;
          continue;
        }

        const step = strategy.steps[stepIdx];
        console.log(
          `[BULK-SYNC] Strategy "${strategy.name}" step ${stepIdx + 1}/${strategy.steps.length}: ${step.label}`
        );

        try {
          const result = await fetchAllPagesForStep(
            client,
            step,
            batchStart,
            MAX_SECONDS,
            supabase,
            despachoNameToOffice,
            vendorToUser,
            vendorToOficina
          );
          totalErrors += result.errors;
          console.log(
            `[BULK-SYNC] ${step.label}: ${result.fetched} fetched, ${result.upserted} upserted, ${result.newIds} new IDs`
          );
        } catch (e: unknown) {
          console.error(
            `[BULK-SYNC] ${step.label} error: ${(e as Error).message}`
          );
          totalErrors++;
        }

        workPlan.currentStepIndex++;
        workPlan.completedSteps++;
        stepsProcessedThisBatch++;

        // Renew token periodically
        if (stepsProcessedThisBatch % 5 === 0) {
          try {
            await client.getValidToken();
          } catch {
            /* ignore */
          }
        }
      }

      const isComplete =
        workPlan.currentStrategyIndex >= workPlan.strategies.length;

      const { count: uniqueCount } = await supabase
        .from("sicas_documents")
        .select("*", { count: "exact", head: true });

      const percent = isComplete
        ? 100
        : workPlan.totalSteps > 0
          ? Math.min(
              99,
              Math.round(
                (workPlan.completedSteps / workPlan.totalSteps) * 100
              )
            )
          : 0;

      await supabase
        .from("sicas_sync_jobs")
        .update({
          status: isComplete ? "completed" : "running",
          total_synced: uniqueCount || 0,
          total_in_sicas: uniqueCount || 0,
          total_errors: totalErrors,
          current_page: workPlan.completedSteps,
          total_pages: workPlan.totalSteps,
          percent,
          error_message: JSON.stringify(workPlan),
          updated_at: new Date().toISOString(),
          ...(isComplete ? { finished_at: new Date().toISOString() } : {}),
        })
        .eq("id", jobId);

      const currentStrategy =
        workPlan.strategies[workPlan.currentStrategyIndex];
      console.log(
        `[BULK-SYNC] Batch done: ${workPlan.completedSteps}/${workPlan.totalSteps} steps, ` +
          `${uniqueCount} unique docs in DB, ` +
          `strategy=${currentStrategy?.name || "done"}, complete=${isComplete}`
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
          completedSteps: workPlan.completedSteps,
          totalSteps: workPlan.totalSteps,
          uniqueDocs: uniqueCount,
          currentStrategy: currentStrategy?.name || "done",
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

      let currentStrategy = "unknown";
      try {
        const plan: WorkPlan = JSON.parse(latestJob.error_message || "{}");
        currentStrategy =
          plan.strategies?.[plan.currentStrategyIndex]?.name || "done";
      } catch {
        /* ignore */
      }

      return jsonResponse(200, {
        ok: true,
        jobId: latestJob.id,
        status: latestJob.status,
        progress: {
          percent: latestJob.percent,
          completedSteps: latestJob.current_page,
          totalSteps: latestJob.total_pages,
          totalSynced: latestJob.total_synced,
          uniqueDocs: uniqueCount,
          currentStrategy,
        },
        startedAt: latestJob.started_at,
        finishedAt: latestJob.finished_at,
      });
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

// ─── Self-chain ──────────────────────────────────────────────────────────
function selfChain(supabaseUrl: string, serviceKey: string, jobId: string) {
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

async function markComplete(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  workPlan: WorkPlan
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
      total_in_sicas: count || 0,
      current_page: workPlan.totalSteps,
      error_message: JSON.stringify(workPlan),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// ─── Fetch all pages for a single strategy step ─────────────────────────
async function fetchAllPagesForStep(
  client: Awaited<ReturnType<typeof createSicasRestClientWithDbAuth>>,
  step: StrategyStep,
  batchStart: number,
  maxSeconds: number,
  supabase: ReturnType<typeof createClient>,
  despachoNameToOffice: Map<string, { oficina_id: string; desp_id: string }>,
  vendorToUser: Map<string, string>,
  vendorToOficina: Map<string, string>
): Promise<{
  fetched: number;
  upserted: number;
  errors: number;
  pages: number;
  newIds: number;
}> {
  let page = 1;
  let totalPages = 1;
  let fetched = 0;
  let upserted = 0;
  let errors = 0;
  let newIds = 0;
  const seenIds = new Set<string>();

  while (page <= totalPages) {
    const elapsed = (Date.now() - batchStart) / 1000;
    if (elapsed >= maxSeconds) break;

    const reportOpts: Parameters<typeof client.readReport>[0] = {
      keyCode: step.keyCode,
      pageRequested: page,
      itemsForPage: ITEMS_PER_PAGE,
      sortFields: "IDDocto",
    };
    if (step.conditions) reportOpts.conditions = step.conditions;
    if (step.conditionsDirect)
      reportOpts.conditionsDirect = step.conditionsDirect;

    const response = await client.readReport(reportOpts);

    const records = response.Response?.[0]?.TableInfo || [];
    const control =
      response.Response?.[1]?.TableControl?.[0] ||
      response.Response?.[0]?.TableControl?.[0];

    if (page === 1 && control) {
      totalPages = control.Pages || 1;
    }

    if (records.length === 0) break;

    let newInPage = 0;
    for (const r of records) {
      const id = String(
        (r as Record<string, unknown>).IDDocto ||
          (r as Record<string, unknown>).IdDocto ||
          (r as Record<string, unknown>).Id_Docto ||
          ""
      ).trim();
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        newInPage++;
      }
    }

    if (page > 1 && newInPage === 0) {
      console.log(
        `[BULK-SYNC] ${step.label} page ${page}: recycled data, stopping.`
      );
      break;
    }

    newIds += newInPage;
    fetched += records.length;

    const documents = records
      .map((raw: Record<string, unknown>) =>
        mapDocument(
          raw,
          step.keyCode,
          despachoNameToOffice,
          vendorToUser,
          vendorToOficina
        )
      )
      .filter((d: unknown) => d !== null);

    const result = await upsertDocuments(supabase, documents);
    upserted += result.upserted;
    errors += result.errors;

    page++;
  }

  return { fetched, upserted, errors, pages: page - 1, newIds };
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
    compania:
      get(["CiaNombre", "Aseguradora", "Compania"]) || null,
    aseguradora_nombre:
      get(["CiaAbreviacion", "CiaNombre", "Abreviacion"]) || null,
    poliza: get(["Documento", "NoDocumento", "No_Documento"]) || null,
    cliente:
      get([
        "NombreCompleto",
        "Nombre_Completo",
        "Cliente",
        "Contratante",
      ]) || null,
    fecha_captura: get(["FCaptura", "FechaCaptura"]) || null,
    fecha_emision: get(["FEmision", "FechaEmision"]) || null,
    vigencia_desde:
      get(["FDesde", "FechaDesde", "Vigencia_Desde"]) || null,
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
    is_cancelada: statusTexto.toLowerCase() === "cancelada",
    is_renewable:
      isVigente &&
      renewalDays !== null &&
      renewalDays >= 0 &&
      renewalDays <= 90,
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
    await supabase
      .from("sicas_polizas_vigentes")
      .upsert(batch, { onConflict: "id_documento", ignoreDuplicates: false });
  }
  return { upserted: totalUpserted, errors: totalErrors };
}
