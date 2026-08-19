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
  reportType?: ReportType;
  page?: number;
  pageSize?: number;
  exportAll?: boolean;
  filters?: ReportFilters;
}

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
    ItemsForPage: exportAll ? -1 : pageSize,
    SortFields: sortFields,
    FormatResponse: 2,
    SingleKey: true,
  };
  if (conditions) requestBody.Conditions = conditions;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Método no permitido." });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return jsonResponse(401, { ok: false, error: "No autorizado." });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(401, { ok: false, error: "Sesión no válida." });
    const { data: profile } = await supabase.from("usuarios").select("rol, activo").eq("id", user.id).maybeSingle();
    const role = String(profile?.rol || "").toLowerCase();
    if (!profile?.activo || !["administrador", "admin"].includes(role)) {
      return jsonResponse(403, { ok: false, error: "Este reporte es exclusivo para administradores." });
    }

    const body = await req.json().catch(() => ({})) as ReportRequest;
    const reportType: ReportType = body.reportType === "pendiente" ? "pendiente" : "efectuada";
    const page = Math.max(1, Math.floor(Number(body.page) || 1));
    const pageSize = Math.min(100, Math.max(10, Math.floor(Number(body.pageSize) || 50)));
    const exportAll = body.exportAll === true;

    const { data: config } = await supabase.from("sicas_config")
      .select("sicas_usuario, sicas_password, code_auth").limit(1).maybeSingle();
    const username = Deno.env.get("SICAS_USUARIO") || Deno.env.get("SICAS_USERNAME") || config?.sicas_usuario || "";
    const password = Deno.env.get("SICAS_PASSWORD") || config?.sicas_password || "";
    const codeAuth = Deno.env.get("SICAS_CODE_AUTH") || config?.code_auth || "";
    if (!username || !password) {
      return jsonResponse(503, { ok: false, error: "Las credenciales REST de SICAS no están configuradas." });
    }

    const sicasToken = await obtainToken(username, password, codeAuth);
    const { rows, control, keyCode } = await readSicasReport(
      sicasToken, reportType, page, pageSize, exportAll, body.filters || {},
    );
    const normalizedRows = rows.map((row) => normalizeRecord(row, reportType));
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
