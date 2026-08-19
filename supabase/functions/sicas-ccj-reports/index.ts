import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SICAS_REST_BASE = Deno.env.get("SICAS_REST_API_URL") ||
  "https://security-services.sicasonline.info/api";

type ReportType = "efectuada" | "pendiente";

interface ReportFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  compania?: string;
  documento?: string;
  vendedor?: string;
  despacho?: string;
  agente?: string;
  ramo?: string;
  subramo?: string;
  gerencia?: string;
}

interface ReportRequest {
  action?: "processPendingRun";
  runId?: string;
  reportType?: ReportType;
  page?: number;
  pageSize?: number;
  exportAll?: boolean;
  forceRefresh?: boolean;
  filters?: ReportFilters;
}

const PENDING_CHUNK_SIZE = 100;
const PENDING_PAGES_PER_WORKER = 8;
const PENDING_MAX_PAGES = 1000;
const PENDING_CACHE_TTL_MS = 15 * 60_000;

const COLUMNS: Record<ReportType, string[]> = {
  efectuada: [
    "Fecha de Pago", "FDesde", "FHasta", "Documento", "PrimaNeta",
    "Nombre Compañía", "ClaveVend", "DespNombre", "Moneda", "TCDocto",
    "RamosNombre", "Sub Ramo", "VendNombre", "EjecutNombre",
    "GerenciaNombre", "CLIENTE", "IMPORTE PESOS", "CAgente", "Serie",
    "Endoso", "Renovacion", "TipoEnt_TXT",
  ],
  pendiente: [
    "Documento", "FDesde", "FHasta", "FLimPago", "Serie", "Endoso",
    "Nombre Compañía", "RamosNombre", "SRamoNombre", "DespNombre",
    "GerenciaNombre", "VendNombre", "PrimaNeta", "Moneda", "Concepto",
    "NombreCompleto", "Clave de Agente", "FPago", "PrimaNetaDocto",
    "PrimaTotalDocto", "Status_TXT",
  ],
};

const NUMERIC_COLUMNS = new Set([
  "PrimaNeta", "TCDocto", "IMPORTE PESOS", "PrimaNetaDocto", "PrimaTotalDocto",
]);
const DATE_COLUMNS = new Set(["Fecha de Pago", "FDesde", "FHasta", "FLimPago"]);

const FIELD_ALIASES: Record<string, string[]> = {
  "Fecha de Pago": ["FechaPago", "FPago", "FPagoRecibo", "FReciboPago", "FecPago", "VDatRecibos.FPago"],
  FDesde: ["FechaDesde", "VigenciaDesde", "VDatDocumentos.FDesde"],
  FHasta: ["FechaHasta", "VigenciaHasta", "VDatDocumentos.FHasta"],
  FLimPago: ["FechaLimitePago", "LimitePago", "VDatDocumentos.FLimPago"],
  Documento: ["Poliza", "NoPoliza", "NumeroPoliza", "VDatDocumentos.Documento"],
  PrimaNeta: ["PrimaNetaRecibo", "VDatDocumentos.PrimaNeta"],
  "Nombre Compañía": ["NombreCompania", "CiaNombre", "Compania", "VCatCias.CiaNombre"],
  ClaveVend: ["ClaveVendedor", "CVend", "VendClave", "IDVend"],
  DespNombre: ["Despacho", "NombreDespacho", "VCatDespachos.DespNombre"],
  Moneda: ["MonedaNombre", "NombreMoneda"],
  TCDocto: ["TipoCambio", "TipoCambioDocto"],
  RamosNombre: ["RamoNombre", "Ramo", "NombreRamo"],
  "Sub Ramo": ["SubRamo", "SubRamoNombre", "SRamoNombre", "NombreSubRamo"],
  SRamoNombre: ["SubRamo", "SubRamoNombre", "Sub Ramo", "NombreSubRamo"],
  VendNombre: ["Vendedor", "VendedorNombre", "NombreVendedor"],
  EjecutNombre: ["Ejecutivo", "EjecutivoNombre", "NombreEjecutivo"],
  GerenciaNombre: ["Gerencia", "NombreGerencia"],
  CLIENTE: ["Cliente", "NombreCompleto", "Contratante", "RazonSocial"],
  "IMPORTE PESOS": ["ImportePesos", "Importe_Pesos", "ImporteMXN"],
  CAgente: ["ClaveAgente", "Clave de Agente", "AgenteClave"],
  Serie: ["SerieDocto"],
  Endoso: ["NoEndoso", "NumeroEndoso"],
  Renovacion: ["NoRenovacion", "NumeroRenovacion"],
  TipoEnt_TXT: ["TipoEntidad", "TipoEntidad_TXT", "TipoEntTxt"],
  Concepto: ["Descripcion", "DescripcionRiesgo"],
  NombreCompleto: ["Cliente", "CLIENTE", "Contratante", "RazonSocial"],
  "Clave de Agente": ["ClaveAgente", "CAgente", "AgenteClave"],
  FPago: ["FormaPago", "FormaDePago", "FPago_TXT"],
  PrimaNetaDocto: ["PrimaNetaDocumento"],
  PrimaTotalDocto: ["PrimaTotal", "PrimaTotalDocumento"],
  Status_TXT: ["StatusTxt", "Estatus", "Estatus_TXT", "Status"],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function sanitizeFilter(value?: string): string {
  return (value || "").trim().replace(/[;!|]/g, " ").slice(0, 180);
}

function toSicasDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatDateValue(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value ?? "";
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/.exec(text);
  if (slash) return `${slash[1].padStart(2, "0")}/${slash[2].padStart(2, "0")}/${slash[3]}`;
  return text;
}

function normalizeRecord(record: Record<string, unknown>, reportType: ReportType) {
  const source = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) source.set(normalizeKey(key), value);

  const result: Record<string, unknown> = {};
  for (const column of COLUMNS[reportType]) {
    const candidates = [column, ...(FIELD_ALIASES[column] || [])];
    let value: unknown = "";
    for (const candidate of candidates) {
      const normalized = normalizeKey(candidate);
      if (source.has(normalized)) {
        value = source.get(normalized);
        break;
      }
    }

    if (DATE_COLUMNS.has(column)) value = formatDateValue(value);
    if (NUMERIC_COLUMNS.has(column) && value !== "" && value !== null && value !== undefined) {
      const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
      value = Number.isFinite(numeric) ? numeric : value;
    }
    result[column] = value ?? "";
  }
  return result;
}

function condition(
  label: string,
  type: number,
  subtype: number,
  values: string,
  text: string,
  posTitle: number,
  changeTable: number,
  field: string,
): string {
  return `${label};${type};${subtype};${values};${text};${posTitle};${changeTable};${field}`;
}

function buildConditions(reportType: ReportType, rawFilters: ReportFilters) {
  const filters = Object.fromEntries(
    Object.entries(rawFilters || {}).map(([key, value]) => [key, sanitizeFilter(value)]),
  ) as ReportFilters;
  const conditions: string[] = [];
  const direct: string[] = [];

  if (reportType === "efectuada") {
    // Confirmed in the supplied SICAS XML: 3 = Pagado, 4 = Liquidado.
    conditions.push(condition("Cobranza", 2, 0, "3|4", "Pagado|Liquidado", -1, 0, "VDatRecibos.Status"));
    if (filters.fechaDesde && filters.fechaHasta) {
      const from = toSicasDate(filters.fechaDesde);
      const to = toSicasDate(filters.fechaHasta);
      conditions.push(condition("Fecha de pago", 3, 1, `${from}|${to}`, `${from}|${to}`, 0, 0, "VDatRecibos.FPago"));
    }
    if (filters.compania) conditions.push(condition("Compañía", 0, 1, `*${filters.compania}*`, `*${filters.compania}*`, 1, 0, "VCatCias.CiaNombre"));
    if (filters.documento) conditions.push(condition("Documento", 0, 0, filters.documento, filters.documento, 1, -1, "VDatDocumentos.Documento"));
    if (filters.vendedor) conditions.push(condition("Vendedor", 0, 1, `*${filters.vendedor}*`, `*${filters.vendedor}*`, 1, 0, "VCatVendedores.VendNombre"));
    if (filters.despacho) conditions.push(condition("Despacho", 0, 1, `*${filters.despacho}*`, `*${filters.despacho}*`, 1, 0, "VCatDespachos.DespNombre"));
    if (filters.agente) conditions.push(condition("Agente", 0, 0, filters.agente, filters.agente, 1, 0, "VCatAgentes.CAgente"));
  } else {
    direct.push(condition("Status", 0, 0, "Pendiente", "Pendiente", 1, 0, "Status_TXT"));
    if (filters.fechaDesde && filters.fechaHasta) {
      const from = toSicasDate(filters.fechaDesde);
      const to = toSicasDate(filters.fechaHasta);
      conditions.push(condition("Límite de pago", 3, 1, `${from}|${to}`, `${from}|${to}`, 0, 0, "VDatDocumentos.FLimPago"));
    }
    if (filters.compania) conditions.push(condition("Compañía", 0, 1, `*${filters.compania}*`, `*${filters.compania}*`, 1, 0, "VCatCias.CiaNombre"));
    if (filters.documento) conditions.push(condition("Documento", 0, 0, filters.documento, filters.documento, 1, -1, "VDatDocumentos.Documento"));
    if (filters.vendedor) conditions.push(condition("Vendedor", 0, 1, `*${filters.vendedor}*`, `*${filters.vendedor}*`, 1, 0, "VCatVendedores.VendNombre"));
    if (filters.despacho) conditions.push(condition("Despacho", 0, 1, `*${filters.despacho}*`, `*${filters.despacho}*`, 1, 0, "VCatDespachos.DespNombre"));
    if (filters.agente) conditions.push(condition("Agente", 0, 0, filters.agente, filters.agente, 1, 0, "VCatAgentes.CAgente"));
    if (filters.ramo) conditions.push(condition("Ramo", 0, 1, `*${filters.ramo}*`, `*${filters.ramo}*`, 1, 0, "VCatRamos.RamosNombre"));
    if (filters.subramo) conditions.push(condition("Subramo", 0, 1, `*${filters.subramo}*`, `*${filters.subramo}*`, 1, 0, "VCatSRamos.SRamoNombre"));
    if (filters.gerencia) conditions.push(condition("Gerencia", 0, 1, `*${filters.gerencia}*`, `*${filters.gerencia}*`, 1, 0, "VCatGerencias.GerenciaNombre"));
  }

  return { conditions: conditions.join("!"), conditionsDirect: direct.join("!") };
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(url, init);
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) return response;
    await response.text();
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return response!;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
  } catch {
    throw new Error(`SICAS devolvió una respuesta no JSON (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = (parsed as Record<string, unknown>)?.Error || (parsed as Record<string, unknown>)?.Message;
    throw new Error(String(message || `SICAS respondió HTTP ${response.status}.`));
  }
  return parsed as Record<string, unknown>;
}

async function obtainToken(username: string, password: string, codeAuth: string): Promise<string> {
  const officialParams = new URLSearchParams({ sUserName: username, sPassword: password });
  if (codeAuth) officialParams.set("sCodeAuth", codeAuth);

  let result: Record<string, unknown> | null = null;
  try {
    const response = await fetchWithRetry(`${SICAS_REST_BASE}/Security/GetToken?${officialParams}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    result = await parseJsonResponse(response);
  } catch {
    const compatibleParams = new URLSearchParams({ Usuario: username, Password: password });
    if (codeAuth) compatibleParams.set("sCodeAuth", codeAuth);
    const response = await fetchWithRetry(`${SICAS_REST_BASE}/Security/GetToken?${compatibleParams}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    result = await parseJsonResponse(response);
  }

  const token = result.Token || result.token || result.Response;
  if (!token || typeof token !== "string") {
    throw new Error(String(result.Error || result.Message || "SICAS no devolvió un token."));
  }
  return token;
}

function extractRows(payload: Record<string, unknown>) {
  if (payload.Sucess === false) throw new Error(String(payload.Error || payload.Message || "Error de SICAS."));
  let response: unknown = payload.Response ?? payload.response ?? payload;
  if (typeof response === "string") {
    try { response = JSON.parse(response); } catch { /* handled as empty below */ }
  }
  const report = Array.isArray(response) ? response[0] : response;
  const reportObject = (report && typeof report === "object" ? report : {}) as Record<string, unknown>;
  const tableInfo = reportObject.TableInfo ?? reportObject.tableInfo ?? reportObject.Data ?? [];
  const rows = Array.isArray(tableInfo) ? tableInfo : tableInfo && typeof tableInfo === "object" ? [tableInfo] : [];
  const controls = reportObject.TableControl ?? reportObject.tableControl ?? [];
  const control = (Array.isArray(controls) ? controls[0] : controls) as Record<string, unknown> | undefined;
  return { rows: rows as Record<string, unknown>[], control: control || {} };
}

async function readSicasReport(
  token: string,
  reportType: ReportType,
  page: number,
  pageSize: number,
  exportAll: boolean,
  filters: ReportFilters,
) {
  const keyCode = reportType === "efectuada"
    ? Deno.env.get("SICAS_REPORT_EFECTUADA_KEYCODE") || "H02761"
    : Deno.env.get("SICAS_REPORT_PENDIENTE_KEYCODE") || "HWS03669_008";
  const sortFields = reportType === "efectuada" ? "VDatRecibos.IDRecibo" : "Documento";
  const { conditions, conditionsDirect } = buildConditions(reportType, filters);
  const requestBody: Record<string, unknown> = {
    PageRequested: page,
    ItemsForPages: exportAll ? -1 : pageSize,
    SortFields: sortFields,
    FormatResponse: 2,
    SingleKey: true,
  };
  if (conditions) {
    requestBody.Conditions = conditions;
    requestBody.ConditionsAdd = conditions;
  }
  if (conditionsDirect) requestBody.ConditionsDirect = conditionsDirect;

  let lastError: Error | null = null;
  for (const authorization of [`Bearer ${token}`, token]) {
    for (const asForm of [false, true]) {
      try {
        const headers: Record<string, string> = {
          Authorization: authorization,
          "Prop_KeyCode": keyCode,
          Accept: "application/json",
          "ReactiveIF": "true",
        };
        let body: BodyInit;
        if (asForm) {
          headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
          const form = new URLSearchParams();
          for (const [key, value] of Object.entries(requestBody)) form.set(key, String(value));
          body = form;
        } else {
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(requestBody);
        }
        const response = await fetchWithRetry(`${SICAS_REST_BASE}/Report/ReadData`, { method: "POST", headers, body });
        const payload = await parseJsonResponse(response);
        const extracted = extractRows(payload);
        return { ...extracted, keyCode };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }
  throw lastError || new Error("No fue posible consultar el reporte SICAS.");
}

function normalizeFiltersForCache(rawFilters: ReportFilters = {}): ReportFilters {
  return Object.fromEntries(
    Object.entries(rawFilters)
      .map(([key, value]) => [key, sanitizeFilter(value)])
      .filter(([, value]) => Boolean(value))
      .sort(([left], [right]) => left.localeCompare(right)),
  ) as ReportFilters;
}

async function buildCacheKey(filters: ReportFilters): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(filters)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function schedulePendingWorker(runId: string) {
  const projectUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  EdgeRuntime.waitUntil(
    fetch(`${projectUrl}/functions/v1/sicas-ccj-reports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        Apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "processPendingRun", runId }),
    }).then(async (response) => {
      if (!response.ok) console.error("[SICAS CCJ worker chain]", response.status, await response.text());
    }).catch((error) => console.error("[SICAS CCJ worker chain]", error)),
  );
}

async function processPendingRun(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  username: string,
  password: string,
  codeAuth: string,
) {
  try {
    const { data: run, error: runError } = await supabase.from("sicas_ccj_report_runs")
      .select("id, filters, status, next_page")
      .eq("id", runId)
      .maybeSingle();
    if (runError) throw runError;
    if (!run || !["queued", "running"].includes(run.status)) return;

    const startPage = Math.max(1, Number(run.next_page) || 1);
    if (startPage > PENDING_MAX_PAGES) {
      throw new Error(`SICAS superó el límite seguro de ${PENDING_MAX_PAGES * PENDING_CHUNK_SIZE} registros.`);
    }
    await supabase.from("sicas_ccj_report_runs").update({
      status: "running",
      ...(run.status === "queued" ? { started_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
      error: null,
    }).eq("id", runId).eq("status", run.status);

    const sicasToken = await obtainToken(username, password, codeAuth);
    const pageNumbers = Array.from(
      { length: Math.min(PENDING_PAGES_PER_WORKER, PENDING_MAX_PAGES - startPage + 1) },
      (_, index) => startPage + index,
    );
    const pageResults = await Promise.all(pageNumbers.map((requestedPage) =>
      readSicasReport(sicasToken, "pendiente", requestedPage, PENDING_CHUNK_SIZE, false, run.filters || {})
    ));

    const cacheRows: Array<{
      run_id: string;
      source_page: number;
      source_index: number;
      row_data: Record<string, unknown>;
    }> = [];
    let sourceRowsProcessed = 0;
    let nextPage = startPage;
    let completed = false;

    for (let resultIndex = 0; resultIndex < pageResults.length; resultIndex++) {
      const sourcePage = pageNumbers[resultIndex];
      const rawRows = pageResults[resultIndex].rows;
      sourceRowsProcessed += rawRows.length;
      rawRows.forEach((rawRow, sourceIndex) => {
        const row = normalizeRecord(rawRow, "pendiente");
        if (String(row.Status_TXT || "").trim().toLocaleLowerCase("es-MX") === "pendiente") {
          cacheRows.push({ run_id: runId, source_page: sourcePage, source_index: sourceIndex, row_data: row });
        }
      });
      nextPage = sourcePage + 1;
      if (rawRows.length < PENDING_CHUNK_SIZE) {
        completed = true;
        break;
      }
    }

    if (cacheRows.length) {
      const { error: rowsError } = await supabase.from("sicas_ccj_report_rows")
        .upsert(cacheRows, { onConflict: "run_id,source_page,source_index" });
      if (rowsError) throw rowsError;
    }
    const { count: resultRows, error: countError } = await supabase.from("sicas_ccj_report_rows")
      .select("id", { count: "exact", head: true }).eq("run_id", runId);
    if (countError) throw countError;

    const { data: currentRun, error: currentError } = await supabase.from("sicas_ccj_report_runs")
      .select("source_rows_processed").eq("id", runId).single();
    if (currentError) throw currentError;
    const now = new Date();
    const update = completed
      ? {
        status: "completed",
        next_page: nextPage,
        source_rows_processed: Number(currentRun.source_rows_processed || 0) + sourceRowsProcessed,
        result_rows: resultRows || 0,
        completed_at: now.toISOString(),
        expires_at: new Date(now.getTime() + PENDING_CACHE_TTL_MS).toISOString(),
        updated_at: now.toISOString(),
      }
      : {
        status: "running",
        next_page: nextPage,
        source_rows_processed: Number(currentRun.source_rows_processed || 0) + sourceRowsProcessed,
        result_rows: resultRows || 0,
        updated_at: now.toISOString(),
      };
    const { error: updateError } = await supabase.from("sicas_ccj_report_runs").update(update).eq("id", runId);
    if (updateError) throw updateError;
    if (!completed) schedulePendingWorker(runId);
  } catch (error) {
    console.error("[SICAS CCJ pending worker]", error);
    await supabase.from("sicas_ccj_report_runs").update({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
  }
}

async function readCachedRows(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  page: number,
  pageSize: number,
  exportAll: boolean,
) {
  if (!exportAll) {
    const from = (page - 1) * pageSize;
    const { data, error } = await supabase.from("sicas_ccj_report_rows").select("row_data")
      .eq("run_id", runId).order("source_page").order("source_index")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    return (data || []).map((item) => item.row_data as Record<string, unknown>);
  }
  const rows: Record<string, unknown>[] = [];
  for (let from = 0;; from += 1000) {
    const { data, error } = await supabase.from("sicas_ccj_report_rows").select("row_data")
      .eq("run_id", runId).order("source_page").order("source_index")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []).map((item) => item.row_data as Record<string, unknown>));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Método no permitido." });

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse(401, { ok: false, error: "No autorizado." });

    const body = await req.json().catch(() => ({})) as ReportRequest;
    const { data: config } = await supabase.from("sicas_config")
      .select("sicas_usuario, sicas_password, code_auth").limit(1).maybeSingle();
    const username = Deno.env.get("SICAS_USUARIO") || Deno.env.get("SICAS_USERNAME") || config?.sicas_usuario || "";
    const password = Deno.env.get("SICAS_PASSWORD") || config?.sicas_password || "";
    const codeAuth = Deno.env.get("SICAS_CODE_AUTH") || config?.code_auth || "";

    if (body.action === "processPendingRun") {
      if (token !== serviceRoleKey || !body.runId) {
        return jsonResponse(403, { ok: false, error: "Worker no autorizado." });
      }
      if (!username || !password) {
        await supabase.from("sicas_ccj_report_runs").update({
          status: "failed",
          error: "Las credenciales REST de SICAS no están configuradas.",
          updated_at: new Date().toISOString(),
        }).eq("id", body.runId);
        return jsonResponse(503, { ok: false, error: "Credenciales SICAS no configuradas." });
      }
      EdgeRuntime.waitUntil(processPendingRun(supabase, body.runId, username, password, codeAuth));
      return jsonResponse(202, { ok: true, status: "worker_started", runId: body.runId });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(401, { ok: false, error: "Sesión no válida." });
    const { data: profile } = await supabase.from("usuarios").select("rol, activo").eq("id", user.id).maybeSingle();
    const role = String(profile?.rol || "").toLowerCase();
    if (!profile?.activo || !["administrador", "admin"].includes(role)) {
      return jsonResponse(403, { ok: false, error: "Este reporte es exclusivo para administradores." });
    }

    const reportType: ReportType = body.reportType === "pendiente" ? "pendiente" : "efectuada";
    const page = Math.max(1, Math.floor(Number(body.page) || 1));
    const pageSize = Math.min(100, Math.max(10, Math.floor(Number(body.pageSize) || 50)));
    const exportAll = body.exportAll === true;

    if (!username || !password) {
      return jsonResponse(503, { ok: false, error: "Las credenciales REST de SICAS no están configuradas." });
    }

    if (reportType === "pendiente") {
      const filters = normalizeFiltersForCache(body.filters || {});
      const cacheKey = await buildCacheKey(filters);
      const now = new Date();
      if (body.forceRefresh) {
        await supabase.from("sicas_ccj_report_runs").update({
          status: "failed",
          error: "Precarga reemplazada por actualización manual.",
          updated_at: now.toISOString(),
        }).eq("cache_key", cacheKey).in("status", ["queued", "running"]);
      }

      if (!body.forceRefresh) {
        const { data: completed, error: completedError } = await supabase.from("sicas_ccj_report_runs")
          .select("id, result_rows, completed_at, expires_at")
          .eq("cache_key", cacheKey).eq("status", "completed")
          .gt("expires_at", now.toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (completedError) throw completedError;
        if (completed) {
          const cachedRows = await readCachedRows(supabase, completed.id, page, pageSize, exportAll);
          const total = Number(completed.result_rows) || 0;
          return jsonResponse(200, {
            ok: true,
            status: "completed",
            reportType,
            columns: COLUMNS.pendiente,
            rows: cachedRows,
            pagination: {
              page,
              pageSize: exportAll ? cachedRows.length : pageSize,
              total,
              pages: Math.max(1, Math.ceil(total / pageSize)),
            },
            progress: { resultRows: total, completedAt: completed.completed_at },
            source: { api: "SICAS REST · caché asíncrono", keyCode: "HWS03669_008", live: true },
          });
        }
      }

      let { data: active, error: activeError } = await supabase.from("sicas_ccj_report_runs")
        .select("id, status, next_page, source_rows_processed, result_rows, created_at, updated_at, error")
        .eq("cache_key", cacheKey).in("status", ["queued", "running"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (activeError) throw activeError;
      if (!active) {
        if (!body.forceRefresh) {
          const { data: recentFailure, error: failureError } = await supabase.from("sicas_ccj_report_runs")
            .select("error, updated_at").eq("cache_key", cacheKey).eq("status", "failed")
            .gt("updated_at", new Date(now.getTime() - 10 * 60_000).toISOString())
            .order("updated_at", { ascending: false }).limit(1).maybeSingle();
          if (failureError) throw failureError;
          if (recentFailure) {
            return jsonResponse(502, {
              ok: false,
              error: recentFailure.error || "La precarga de SICAS no pudo completarse.",
            });
          }
        }
        await supabase.from("sicas_ccj_report_runs").delete()
          .lt("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString())
          .in("status", ["completed", "failed"]);
        const { data: created, error: createError } = await supabase.from("sicas_ccj_report_runs")
          .insert({
            cache_key: cacheKey,
            report_type: "pendiente",
            filters,
            status: "queued",
            requested_by: user.id,
          })
          .select("id, status, next_page, source_rows_processed, result_rows, created_at, updated_at, error")
          .single();
        if (createError) {
          if (createError.code !== "23505") throw createError;
          const { data: raced, error: raceError } = await supabase.from("sicas_ccj_report_runs")
            .select("id, status, next_page, source_rows_processed, result_rows, created_at, updated_at, error")
            .eq("cache_key", cacheKey).in("status", ["queued", "running"]).limit(1).single();
          if (raceError) throw raceError;
          active = raced;
        } else {
          active = created;
          schedulePendingWorker(created.id);
        }
      }
      return jsonResponse(202, {
        ok: true,
        status: active.status,
        reportType,
        columns: COLUMNS.pendiente,
        rows: [],
        pagination: { page: 1, pageSize, total: 0, pages: 1 },
        progress: {
          runId: active.id,
          nextPage: active.next_page,
          sourceRowsProcessed: active.source_rows_processed,
          resultRows: active.result_rows,
          startedAt: active.created_at,
          updatedAt: active.updated_at,
        },
        source: { api: "SICAS REST · precarga asíncrona", keyCode: "HWS03669_008", live: false },
      });
    }

    const sicasToken = await obtainToken(username, password, codeAuth);
    const { rows, control, keyCode } = await readSicasReport(
      sicasToken, reportType, page, pageSize, exportAll, body.filters || {},
    );
    const normalizedRows = rows
      .map((row) => normalizeRecord(row, reportType))
      .filter((row) => reportType !== "pendiente" || String(row.Status_TXT || "").trim().toLocaleLowerCase("es-MX") === "pendiente");
    const total = Number(control.MaxRecords ?? control.TotalRecords ?? control.Records ?? normalizedRows.length) || normalizedRows.length;
    const pages = Number(control.Pages ?? control.TotalPages ?? (exportAll ? 1 : Math.ceil(total / pageSize))) || 1;

    return jsonResponse(200, {
      ok: true,
      reportType,
      columns: COLUMNS[reportType],
      rows: normalizedRows,
      pagination: { page, pageSize: exportAll ? normalizedRows.length : pageSize, total, pages },
      source: { api: "SICAS REST", keyCode, live: true },
    });
  } catch (error) {
    console.error("[SICAS CCJ Reports]", error);
    return jsonResponse(502, {
      ok: false,
      error: error instanceof Error ? error.message : "Error inesperado al consultar SICAS.",
    });
  }
});
