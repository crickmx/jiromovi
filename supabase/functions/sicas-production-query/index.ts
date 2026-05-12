import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocumentsRequest {
  page?: number;
  pageSize?: number;
  type?: "all" | "policies" | "bonds";
  search?: string;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  status?: string;
  ramo?: string;
  aseguradora?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

interface DashboardFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  type?: "all" | "policies" | "bonds";
  status?: string;
  ramo?: string;
  subramo?: string;
  aseguradora?: string;
  cliente?: string;
  moneda?: string;
  agente?: string;
  search?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ rol: string; oficina_id: string | null }> {
  const { data } = await supabase
    .from("usuarios")
    .select("rol, oficina_id")
    .eq("id", userId)
    .maybeSingle();
  return { rol: data?.rol || "", oficina_id: data?.oficina_id || null };
}

// ─── SICAS Identity Resolution ──────────────────────────────────────────────

interface SicasIdentity {
  vendorId: string;
  vendorName: string | null;
  moviUserId: string;
  source: "usuarios.id_sicas" | "sicas_mapeo_vendedor_usuario";
}

async function resolveMoviUserToSicasIdentity(
  supabase: SupabaseClient,
  moviUserId: string
): Promise<SicasIdentity | null> {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, id_sicas, nombre_sicas")
    .eq("id", moviUserId)
    .maybeSingle();

  if (usuario?.id_sicas) {
    return {
      vendorId: usuario.id_sicas,
      vendorName: usuario.nombre_sicas || null,
      moviUserId,
      source: "usuarios.id_sicas",
    };
  }

  const { data: mapping } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .select("id_sicas_vendedor")
    .eq("movi_user_id", moviUserId)
    .maybeSingle();

  if (mapping?.id_sicas_vendedor) {
    return {
      vendorId: mapping.id_sicas_vendedor,
      vendorName: usuario?.nombre_sicas || null,
      moviUserId,
      source: "sicas_mapeo_vendedor_usuario",
    };
  }

  return null;
}

async function resolveVendorIdToSicasIdentity(
  supabase: SupabaseClient,
  vendorId: string
): Promise<SicasIdentity | null> {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, id_sicas, nombre_sicas, nombre")
    .eq("id_sicas", vendorId)
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

  if (usuario) {
    return {
      vendorId,
      vendorName: usuario.nombre_sicas || usuario.nombre || null,
      moviUserId: usuario.id,
      source: "usuarios.id_sicas",
    };
  }

  const { data: mapping } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .select("movi_user_id, id_sicas_vendedor")
    .eq("id_sicas_vendedor", vendorId)
    .limit(1)
    .maybeSingle();

  if (mapping) {
    return {
      vendorId,
      vendorName: null,
      moviUserId: mapping.movi_user_id,
      source: "sicas_mapeo_vendedor_usuario",
    };
  }

  return null;
}

// ─── Record Normalizer (from sicas_documents row) ───────────────────────────

function normalizeDbRecord(row: Record<string, unknown>): Record<string, unknown> {
  const statusText = String(row.status_texto || "");
  const statusCode = String(row.status_codigo || "");
  const statusLetterMap: Record<string, string> = { V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente" };
  const statusNumMap: Record<string, string> = { "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente" };
  const resolvedStatus = statusText || statusLetterMap[statusCode] || statusNumMap[statusCode] || statusCode || "Desconocido";

  return {
    idDocto: row.id_docto,
    documento: row.poliza || "",
    tipo: row.tipo_documento || "",
    subtipo: row.subtipo_documento || "",
    ramo: row.ramo || "",
    subramo: row.subramo || "",
    aseguradora: row.aseguradora_nombre || row.compania || "",
    cliente: row.cliente || "",
    fechaDesde: row.vigencia_desde || "",
    fechaHasta: row.vigencia_hasta || "",
    primaNeta: Number(row.prima_neta) || 0,
    primaTotal: Number(row.prima_total) || Number(row.importe) || 0,
    moneda: row.moneda || "MXN",
    status: resolvedStatus,
    statusRaw: statusCode,
    statusCobro: row.status_cobro || "",
    vendedor: row.vend_nombre || "",
    vendedorId: row.vend_id || "",
    agente: row.agente_nombre || "",
    agenteId: row.sicas_id_agente || "",
  };
}

// ════════════════════════════════════════════════════════════════════════════
// LOCAL DB QUERY FUNCTIONS (replaces REST API calls)
// All data comes from sicas_documents table, populated by SOAP bulk-sync
// ════════════════════════════════════════════════════════════════════════════

async function queryDocumentsFromDb(
  supabase: SupabaseClient,
  opts: {
    vendorIds?: string[];
    page: number;
    pageSize: number;
    type?: string;
    search?: string;
    sortField?: string;
    sortDirection?: string;
    status?: string;
    ramo?: string;
    aseguradora?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }
): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number; pages: number }> {
  const { page, pageSize } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("sicas_documents").select("*", { count: "exact" });

  if (opts.vendorIds && opts.vendorIds.length > 0) {
    query = query.in("vend_id", opts.vendorIds);
  }
  if (opts.type === "policies") query = query.eq("is_poliza", true);
  else if (opts.type === "bonds") query = query.eq("is_fianza", true);
  if (opts.status) {
    const statusMap: Record<string, string> = { vigente: "1", renovada: "2", cancelada: "3", "no vigente": "4", pendiente: "5" };
    const val = statusMap[opts.status.toLowerCase()] || opts.status;
    query = query.eq("status_codigo", val);
  }
  if (opts.ramo) query = query.ilike("ramo", `%${opts.ramo}%`);
  if (opts.aseguradora) query = query.or(`compania.ilike.%${opts.aseguradora}%,aseguradora_nombre.ilike.%${opts.aseguradora}%`);
  if (opts.fechaDesde) query = query.gte("vigencia_desde", opts.fechaDesde);
  if (opts.fechaHasta) query = query.lte("vigencia_hasta", opts.fechaHasta);
  if (opts.search) {
    query = query.or(`poliza.ilike.%${opts.search}%,cliente.ilike.%${opts.search}%`);
  }

  const sortCol = mapSortField(opts.sortField);
  const ascending = (opts.sortDirection || "desc") === "asc";
  query = query.order(sortCol, { ascending }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[SICASProd] DB query error:", error.message);
    return { items: [], total: 0, page, pageSize, pages: 0 };
  }

  const total = count || 0;
  const items = (data || []).map(normalizeDbRecord);
  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

function mapSortField(field?: string): string {
  if (!field) return "vigencia_desde";
  const map: Record<string, string> = {
    "DatDocumentos.FDesde": "vigencia_desde",
    "DatDocumentos.FHasta": "vigencia_hasta",
    "DatDocumentos.PrimaTotal": "prima_total",
    "DatDocumentos.PrimaNeta": "prima_neta",
    "DatDocumentos.NombreCompleto": "cliente",
    "DatDocumentos.Documento": "poliza",
    "vigencia_desde": "vigencia_desde",
    "vigencia_hasta": "vigencia_hasta",
    "prima_total": "prima_total",
    "prima_neta": "prima_neta",
    "cliente": "cliente",
    "poliza": "poliza",
  };
  return map[field] || "vigencia_desde";
}

async function queryAllForDashboard(
  supabase: SupabaseClient,
  opts: {
    vendorIds?: string[];
    filters: DashboardFilters;
  }
): Promise<Record<string, unknown>[]> {
  let query = supabase.from("sicas_documents").select("*");

  if (opts.vendorIds && opts.vendorIds.length > 0) {
    query = query.in("vend_id", opts.vendorIds);
  }
  if (opts.filters.type === "policies") query = query.eq("is_poliza", true);
  else if (opts.filters.type === "bonds") query = query.eq("is_fianza", true);
  if (opts.filters.status) {
    const statusMap: Record<string, string> = { vigente: "1", renovada: "2", cancelada: "3", "no vigente": "4", pendiente: "5" };
    const val = statusMap[opts.filters.status.toLowerCase()] || opts.filters.status;
    query = query.eq("status_codigo", val);
  }
  if (opts.filters.ramo) query = query.ilike("ramo", `%${opts.filters.ramo}%`);
  if (opts.filters.aseguradora) query = query.or(`compania.ilike.%${opts.filters.aseguradora}%,aseguradora_nombre.ilike.%${opts.filters.aseguradora}%`);
  if (opts.filters.search) {
    query = query.or(`poliza.ilike.%${opts.filters.search}%,cliente.ilike.%${opts.filters.search}%`);
  }

  query = query.order("vigencia_desde", { ascending: false }).limit(5000);

  const { data, error } = await query;
  if (error) {
    console.error("[SICASProd] Dashboard DB query error:", error.message);
    return [];
  }
  return (data || []).map(normalizeDbRecord);
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW A: Global Documents (no vendor filter)
// ════════════════════════════════════════════════════════════════════════════

async function handleGlobalDocuments(
  supabase: SupabaseClient,
  params: DocumentsRequest,
  officeVendorIds?: string[]
): Promise<Response> {
  const startTime = Date.now();
  const pageSize = Math.min(params.pageSize || 25, 500);
  const page = params.page || 1;

  console.log(`[SICASProd][FlowA] global-documents: page=${page} pageSize=${pageSize} vendorScope=${officeVendorIds ? "office" : "all"}`);

  const result = await queryDocumentsFromDb(supabase, {
    vendorIds: officeVendorIds,
    page,
    pageSize,
    type: params.type,
    search: params.search,
    sortField: params.sortField,
    sortDirection: params.sortDirection,
    status: params.status,
    ramo: params.ramo,
    aseguradora: params.aseguradora,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
  });

  return jsonResponse(200, {
    ok: true,
    flow: "global",
    items: result.items,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      pages: result.pages,
      maxRecords: result.total,
    },
    meta: { source: "local_db", duration: Date.now() - startTime, vendorScope: officeVendorIds ? "office" : "all" },
  });
}

async function handleGlobalDashboard(
  supabase: SupabaseClient,
  filters: DashboardFilters,
  officeVendorIds?: string[]
): Promise<Response> {
  const startTime = Date.now();

  console.log(`[SICASProd][FlowA] global-dashboard: vendorScope=${officeVendorIds ? "office" : "all"}`);

  const docs = await queryAllForDashboard(supabase, { vendorIds: officeVendorIds, filters });
  const result = computeKPIs(docs, filters, docs.length, 1);
  result.meta.flow = "global";
  result.meta.source = "local_db";
  result.meta.vendorScope = officeVendorIds ? "office" : "all";
  result.meta.duration = Date.now() - startTime;

  return jsonResponse(200, result);
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW B: User-Scoped Documents (filtered by vendor)
// ════════════════════════════════════════════════════════════════════════════

async function handleScopedDocuments(
  supabase: SupabaseClient,
  identity: SicasIdentity,
  params: DocumentsRequest
): Promise<Response> {
  const startTime = Date.now();
  const pageSize = Math.min(params.pageSize || 25, 500);
  const page = params.page || 1;

  console.log(`[SICASProd][FlowB] scoped-documents: vendorId=${identity.vendorId} vendorName="${identity.vendorName}"`);

  const result = await queryDocumentsFromDb(supabase, {
    vendorIds: [identity.vendorId],
    page,
    pageSize,
    type: params.type,
    search: params.search,
    sortField: params.sortField,
    sortDirection: params.sortDirection,
    status: params.status,
    ramo: params.ramo,
    aseguradora: params.aseguradora,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta,
  });

  return jsonResponse(200, {
    ok: true,
    flow: "scoped",
    items: result.items,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      pages: result.pages,
      maxRecords: result.total,
    },
    meta: {
      source: "local_db", duration: Date.now() - startTime,
      vendorId: identity.vendorId, vendorName: identity.vendorName,
    },
  });
}

async function handleScopedDashboard(
  supabase: SupabaseClient,
  identity: SicasIdentity,
  filters: DashboardFilters
): Promise<Response> {
  const startTime = Date.now();

  console.log(`[SICASProd][FlowB] scoped-dashboard: vendorId=${identity.vendorId} vendorName="${identity.vendorName}"`);

  const docs = await queryAllForDashboard(supabase, { vendorIds: [identity.vendorId], filters });

  const result = computeKPIs(docs, filters, docs.length, 1);
  result.meta.flow = "scoped";
  result.meta.source = "local_db";
  result.meta.vendorId = identity.vendorId;
  result.meta.vendorName = identity.vendorName;
  result.meta.duration = Date.now() - startTime;

  return jsonResponse(200, result);
}

// ─── KPI Computation ────────────────────────────────────────────────────────

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function computeKPIs(
  docs: Record<string, unknown>[],
  filters: DashboardFilters,
  totalInDb: number,
  _pagesFetched: number
): Record<string, any> {
  const now = new Date();
  let rangeStart: Date;
  let rangeEnd: Date;

  if (filters.fechaDesde && filters.fechaHasta) {
    rangeStart = new Date(filters.fechaDesde + "T00:00:00");
    rangeEnd = new Date(filters.fechaHasta + "T23:59:59");
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
  } else {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const periodoLabel = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-${String(rangeStart.getDate()).padStart(2, "0")} a ${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(rangeEnd.getDate()).padStart(2, "0")}`;

  let filtered = docs;
  if (filters.cliente) {
    const cl = String(filters.cliente).toLowerCase();
    filtered = filtered.filter(d => String(d.cliente).toLowerCase().includes(cl));
  }
  if (filters.subramo) {
    const sr = String(filters.subramo).toLowerCase();
    filtered = filtered.filter(d => String(d.subramo).toLowerCase().includes(sr));
  }
  if (filters.moneda) {
    const mn = String(filters.moneda).toUpperCase();
    filtered = filtered.filter(d => String(d.moneda).toUpperCase() === mn);
  }
  if (filters.agente) {
    const ag = String(filters.agente).toLowerCase();
    filtered = filtered.filter(d => String(d.agente).toLowerCase().includes(ag) || String(d.vendedor).toLowerCase().includes(ag));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalPrimaNeta = 0, totalPrimaTotal = 0;
  let polizasEmitidas = 0, fianzasEmitidas = 0;
  let polizasVigentes = 0, fianzasVigentes = 0;
  let primaVigente = 0, cancelaciones = 0;
  let mesPrimaNeta = 0, mesPrimaTotal = 0, mesEmisiones = 0;
  let renew7 = 0, renew15 = 0, renew30 = 0, primaRenovar = 0, renewMes = 0;
  const clientesSet = new Set<string>();
  const clientesMesSet = new Set<string>();

  const rangeDurationMs = rangeEnd.getTime() - rangeStart.getTime();
  const prevRangeEnd = new Date(rangeStart.getTime() - 1);
  const prevRangeStart = new Date(prevRangeEnd.getTime() - rangeDurationMs);
  const yoyRangeStart = new Date(rangeStart);
  yoyRangeStart.setFullYear(yoyRangeStart.getFullYear() - 1);
  const yoyRangeEnd = new Date(rangeEnd);
  yoyRangeEnd.setFullYear(yoyRangeEnd.getFullYear() - 1);
  let prevRangePrima = 0, yoyRangePrima = 0;

  const porRamo: Record<string, { count: number; prima: number; vigentes: number }> = {};
  const porSubramo: Record<string, { count: number; prima: number }> = {};
  const porAseguradora: Record<string, { count: number; prima: number; vigentes: number }> = {};
  const porCliente: Record<string, { count: number; prima: number }> = {};
  const porMes: Record<string, { count: number; primaNeta: number; primaTotal: number; emisiones: number }> = {};
  const porEstatus: Record<string, { count: number; prima: number }> = {};
  const renewByWeek: Record<string, { count: number; prima: number }> = {};

  for (const doc of filtered) {
    const pn = doc.primaNeta as number;
    const pt = doc.primaTotal as number;
    const st = String(doc.status || "").toLowerCase();
    const stRaw = String(doc.statusRaw || "");
    const tipo = String(doc.tipo || "").toLowerCase();
    const isPoliza = !tipo.includes("fianza");
    const isFianza = tipo.includes("fianza");
    const isVigente = st === "vigente" || stRaw === "1" || stRaw === "V" || st === "renovada" || stRaw === "2";
    const isCancelada = st === "cancelada" || stRaw === "3" || stRaw === "C";
    const cliente = String(doc.cliente || "");
    const ramo = String(doc.ramo || "Otros");
    const subramo = String(doc.subramo || "Otros");
    const aseg = String(doc.aseguradora || "Otros");
    const fDesde = parseDateStr(String(doc.fechaDesde || ""));
    const fHasta = parseDateStr(String(doc.fechaHasta || ""));

    totalPrimaNeta += pn;
    totalPrimaTotal += pt;
    if (isPoliza) polizasEmitidas++;
    if (isFianza) fianzasEmitidas++;
    if (isVigente && isPoliza) polizasVigentes++;
    if (isVigente && isFianza) fianzasVigentes++;
    if (isVigente) primaVigente += pt;
    if (isCancelada) cancelaciones++;
    if (cliente) clientesSet.add(cliente);

    if (fDesde && fDesde >= rangeStart && fDesde <= rangeEnd) {
      mesPrimaNeta += pn;
      mesPrimaTotal += pt;
      mesEmisiones++;
      if (cliente) clientesMesSet.add(cliente);
    }
    if (fDesde && fDesde >= prevRangeStart && fDesde <= prevRangeEnd) prevRangePrima += pt;
    if (fDesde && fDesde >= yoyRangeStart && fDesde <= yoyRangeEnd) yoyRangePrima += pt;

    if (fHasta && isVigente) {
      const daysToExpiry = daysBetween(today, fHasta);
      if (daysToExpiry >= 0 && daysToExpiry <= 30) {
        renew30++;
        primaRenovar += pt;
        if (daysToExpiry <= 15) renew15++;
        if (daysToExpiry <= 7) renew7++;
        if (fHasta >= rangeStart && fHasta <= rangeEnd) renewMes++;
        const weekLabel = daysToExpiry <= 7 ? "0-7 dias" : daysToExpiry <= 15 ? "8-15 dias" : "16-30 dias";
        if (!renewByWeek[weekLabel]) renewByWeek[weekLabel] = { count: 0, prima: 0 };
        renewByWeek[weekLabel].count++;
        renewByWeek[weekLabel].prima += pt;
      }
    }

    if (!porRamo[ramo]) porRamo[ramo] = { count: 0, prima: 0, vigentes: 0 };
    porRamo[ramo].count++; porRamo[ramo].prima += pt;
    if (isVigente) porRamo[ramo].vigentes++;

    if (!porSubramo[subramo]) porSubramo[subramo] = { count: 0, prima: 0 };
    porSubramo[subramo].count++; porSubramo[subramo].prima += pt;

    if (!porAseguradora[aseg]) porAseguradora[aseg] = { count: 0, prima: 0, vigentes: 0 };
    porAseguradora[aseg].count++; porAseguradora[aseg].prima += pt;
    if (isVigente) porAseguradora[aseg].vigentes++;

    if (cliente) {
      if (!porCliente[cliente]) porCliente[cliente] = { count: 0, prima: 0 };
      porCliente[cliente].count++; porCliente[cliente].prima += pt;
    }

    const mesKey = fDesde ? `${fDesde.getFullYear()}-${String(fDesde.getMonth() + 1).padStart(2, "0")}` : "sin-fecha";
    if (!porMes[mesKey]) porMes[mesKey] = { count: 0, primaNeta: 0, primaTotal: 0, emisiones: 0 };
    porMes[mesKey].count++; porMes[mesKey].primaNeta += pn; porMes[mesKey].primaTotal += pt; porMes[mesKey].emisiones++;

    if (!porEstatus[st || "desconocido"]) porEstatus[st || "desconocido"] = { count: 0, prima: 0 };
    porEstatus[st || "desconocido"].count++; porEstatus[st || "desconocido"].prima += pt;
  }

  const sortByPrima = (obj: Record<string, { count: number; prima: number }>) =>
    Object.entries(obj).sort((a, b) => b[1].prima - a[1].prima).map(([name, data]) => ({ name, ...data }));

  const topClientes = sortByPrima(porCliente).slice(0, 10);
  const topAseguradoras = sortByPrima(porAseguradora).slice(0, 10);
  const topRamos = sortByPrima(porRamo).slice(0, 10);
  const topSubramos = sortByPrima(porSubramo).slice(0, 10);

  const ticketPromedio = filtered.length > 0 ? totalPrimaTotal / filtered.length : 0;
  const variacionMesAnterior = prevRangePrima > 0 ? ((mesPrimaTotal - prevRangePrima) / prevRangePrima) * 100 : mesPrimaTotal > 0 ? 100 : 0;
  const variacionInteranual = yoyRangePrima > 0 ? ((mesPrimaTotal - yoyRangePrima) / yoyRangePrima) * 100 : mesPrimaTotal > 0 ? 100 : 0;

  const primaPorMesSeries = Object.entries(porMes).filter(([k]) => k !== "sin-fecha").sort((a, b) => a[0].localeCompare(b[0])).map(([mes, data]) => ({ mes, ...data }));
  const estatusDistribution = Object.entries(porEstatus).map(([estatus, data]) => ({ estatus, ...data }));

  const tipoDistribution = [
    { tipo: "Polizas", count: polizasEmitidas, prima: totalPrimaTotal - (fianzasEmitidas > 0 ? filtered.filter(d => String(d.tipo).toLowerCase().includes("fianza")).reduce((s, d) => s + (d.primaTotal as number), 0) : 0) },
    { tipo: "Fianzas", count: fianzasEmitidas, prima: filtered.filter(d => String(d.tipo).toLowerCase().includes("fianza")).reduce((s, d) => s + (d.primaTotal as number), 0) },
  ];

  const renewals = filtered.filter(d => {
    const fH = parseDateStr(String(d.fechaHasta || ""));
    if (!fH) return false;
    const stLocal = String(d.status || "").toLowerCase();
    const isV = stLocal === "vigente" || stLocal === "renovada";
    return isV && daysBetween(today, fH) >= 0 && daysBetween(today, fH) <= 30;
  }).sort((a, b) => new Date(String(a.fechaHasta)).getTime() - new Date(String(b.fechaHasta)).getTime()).slice(0, 50);

  const availableRamos = [...new Set(filtered.map(d => String(d.ramo)).filter(Boolean))].sort();
  const availableSubramos = [...new Set(filtered.map(d => String(d.subramo)).filter(Boolean))].sort();
  const availableAseguradoras = [...new Set(filtered.map(d => String(d.aseguradora)).filter(Boolean))].sort();
  const availableMonedas = [...new Set(filtered.map(d => String(d.moneda)).filter(Boolean))].sort();

  return {
    ok: true,
    periodo: periodoLabel,
    totalRecords: totalInDb,
    recordsAnalyzed: filtered.length,
    recordsFetched: docs.length,
    pagesFetched: _pagesFetched,
    kpis: {
      polizasEmitidas, fianzasEmitidas, totalDocumentos: filtered.length,
      primaNetaEmitida: Math.round(totalPrimaNeta * 100) / 100,
      primaTotalEmitida: Math.round(totalPrimaTotal * 100) / 100,
      mesPrimaNeta: Math.round(mesPrimaNeta * 100) / 100,
      mesPrimaTotal: Math.round(mesPrimaTotal * 100) / 100,
      mesEmisiones, clientesMes: clientesMesSet.size, clientesTotal: clientesSet.size,
      polizasVigentes, fianzasVigentes, primaVigente: Math.round(primaVigente * 100) / 100,
      renovaciones7dias: renew7, renovaciones15dias: renew15, renovaciones30dias: renew30,
      renovacionesMes: renewMes, primaRenovar: Math.round(primaRenovar * 100) / 100,
      cancelaciones, ticketPromedio: Math.round(ticketPromedio * 100) / 100,
      topClientePeriodo: topClientes[0]?.name || "-",
      topAseguradoraPeriodo: topAseguradoras[0]?.name || "-",
      topRamoPeriodo: topRamos[0]?.name || "-",
      variacionMesAnterior: Math.round(variacionMesAnterior * 10) / 10,
      variacionInteranual: Math.round(variacionInteranual * 10) / 10,
    },
    charts: {
      primaPorMes: primaPorMesSeries, porRamo: topRamos, porAseguradora: topAseguradoras,
      porCliente: topClientes, porSubramo: topSubramos, porEstatus: estatusDistribution,
      tipoDistribution, renovacionesPorPeriodo: Object.entries(renewByWeek).map(([periodo, data]) => ({ periodo, ...data })),
    },
    topLists: { clientes: topClientes, aseguradoras: topAseguradoras, ramos: topRamos, subramos: topSubramos },
    renewals,
    availableFilters: { ramos: availableRamos, subramos: availableSubramos, aseguradoras: availableAseguradoras, monedas: availableMonedas },
    meta: {},
  };
}

// ─── Action: detail (from local DB) ────────────────────────────────────────

async function handleDetail(
  supabase: SupabaseClient,
  identity: SicasIdentity | null,
  isAdmin: boolean,
  params: { idDocto: string | number }
): Promise<Response> {
  const startTime = Date.now();
  const idDocto = String(params.idDocto);

  console.log(`[SICASProd] detail: idDocto=${idDocto} vendorId=${identity?.vendorId || "ALL"} isAdmin=${isAdmin}`);

  let query = supabase.from("sicas_documents").select("*").eq("id_docto", idDocto);

  if (identity && !isAdmin) {
    query = query.eq("vend_id", identity.vendorId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[SICASProd] detail DB error:", error.message);
    return jsonResponse(500, { ok: false, error: "Error al consultar documento.", code: "DB_ERROR" });
  }

  if (!data) {
    if (isAdmin || !identity) {
      const { data: fallback } = await supabase.from("sicas_documents").select("*").eq("id_docto", idDocto).maybeSingle();
      if (!fallback) {
        return jsonResponse(404, { ok: false, error: "Documento no encontrado.", code: "DOCUMENT_NOT_FOUND" });
      }
      const document = normalizeDbRecord(fallback);
      return jsonResponse(200, { ok: true, document, meta: { source: "local_db", duration: Date.now() - startTime } });
    }
    return jsonResponse(403, { ok: false, error: "No tienes permiso para consultar este documento.", code: "DOCUMENT_NOT_OWNED" });
  }

  const document = normalizeDbRecord(data);
  return jsonResponse(200, { ok: true, document, meta: { source: "local_db", duration: Date.now() - startTime } });
}

// ─── Action: diagnose (local DB stats) ─────────────────────────────────────

async function handleDiagnose(
  supabase: SupabaseClient,
  vendorId: string
): Promise<Response> {
  const results: Record<string, unknown> = { vendorId, source: "local_db" };

  const { count: totalDocs } = await supabase.from("sicas_documents").select("*", { count: "exact", head: true });
  results.total_documents_in_db = totalDocs || 0;

  const { count: vendorDocs } = await supabase.from("sicas_documents").select("*", { count: "exact", head: true }).eq("vend_id", vendorId);
  results.vendor_documents = vendorDocs || 0;

  const { data: lastSync } = await supabase.from("sicas_sync_runs").select("started_at, status, records_upserted").order("started_at", { ascending: false }).limit(1).maybeSingle();
  results.last_sync = lastSync || null;

  const { data: sample } = await supabase.from("sicas_documents").select("*").eq("vend_id", vendorId).limit(3);
  results.sample_records = (sample || []).map(normalizeDbRecord);

  const { data: vendorList } = await supabase.from("sicas_documents").select("vend_id, vend_nombre").eq("vend_id", vendorId).limit(1).maybeSingle();
  results.vendor_info = vendorList || null;

  return jsonResponse(200, { ok: true, diagnostics: results });
}

// ─── Admin Actions ──────────────────────────────────────────────────────────

async function handleListUsers(supabase: SupabaseClient): Promise<Response> {
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos, email_laboral, rol, oficina_id, id_sicas, nombre_sicas, activo")
    .eq("activo", true)
    .order("nombre");

  if (error) return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });

  const [{ data: oficinas }, { data: vendorMappings }] = await Promise.all([
    supabase.from("oficinas").select("id, nombre").eq("activa", true),
    supabase.from("vendor_mappings").select("id, source_type, source_value, movi_user_id, status").eq("status", "active"),
  ]);

  const oficinasMap: Record<string, string> = {};
  for (const o of oficinas || []) oficinasMap[o.id] = o.nombre;

  const vmByUser: Record<string, Array<{ source_type: string; source_value: string }>> = {};
  for (const vm of vendorMappings || []) {
    if (!vmByUser[vm.movi_user_id]) vmByUser[vm.movi_user_id] = [];
    vmByUser[vm.movi_user_id].push({ source_type: vm.source_type, source_value: vm.source_value });
  }

  const mapped = (usuarios || []).map((u: Record<string, unknown>) => {
    const uid = u.id as string;
    const userVms = vmByUser[uid] || [];
    return {
      id: uid, nombre: u.nombre, apellidos: u.apellidos, email: u.email_laboral,
      rol: u.rol, oficina: u.oficina_id ? oficinasMap[u.oficina_id as string] || null : null,
      oficina_id: u.oficina_id, id_sicas: u.id_sicas || null, nombre_sicas: u.nombre_sicas || null,
      has_sicas_mapping: !!u.id_sicas, vendor_mappings: userVms, has_vendor_mapping: userVms.length > 0,
      has_mapping: !!u.id_sicas || userVms.length > 0,
    };
  });

  return jsonResponse(200, { ok: true, users: mapped });
}

async function handleListMappedVendors(
  supabase: SupabaseClient,
  filterOficinaId?: string | null
): Promise<Response> {
  let query = supabase
    .from("usuarios")
    .select("id, nombre, apellidos, id_sicas, nombre_sicas, oficina_id")
    .eq("activo", true)
    .not("id_sicas", "is", null)
    .order("nombre");

  if (filterOficinaId) query = query.eq("oficina_id", filterOficinaId);

  const { data: usuarios, error } = await query;
  if (error) return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });

  const { data: oficinas } = await supabase.from("oficinas").select("id, nombre").eq("activa", true);
  const oficinasMap: Record<string, string> = {};
  for (const o of oficinas || []) oficinasMap[o.id] = o.nombre;

  const vendors = (usuarios || []).map((u: Record<string, unknown>) => ({
    usuario_id: u.id, nombre: `${u.nombre} ${u.apellidos}`, id_sicas: u.id_sicas,
    nombre_sicas: u.nombre_sicas, oficina: u.oficina_id ? oficinasMap[u.oficina_id as string] || null : null,
  }));

  return jsonResponse(200, { ok: true, vendors });
}

async function handleListVendors(supabase: SupabaseClient, search?: string): Promise<Response> {
  let query = supabase.from("sicas_catalogos").select("id_sicas, nombre").eq("catalog_type_id", 32).order("nombre");
  if (search) query = query.or(`nombre.ilike.%${search}%,id_sicas.ilike.%${search}%`);
  query = query.limit(50);
  const { data, error } = await query;
  if (error) return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });
  return jsonResponse(200, { ok: true, vendors: data || [] });
}

async function handleMapUser(
  supabase: SupabaseClient,
  adminUserId: string,
  targetUserId: string,
  sicasVendorId: string
): Promise<Response> {
  const { data: vendorExists } = await supabase
    .from("sicas_catalogos").select("id_sicas, nombre").eq("catalog_type_id", 32).eq("id_sicas", sicasVendorId).maybeSingle();
  if (!vendorExists) return jsonResponse(400, { ok: false, error: "Vendedor SICAS no encontrado.", code: "VENDOR_NOT_FOUND" });

  const { data: userExists } = await supabase.from("usuarios").select("id").eq("id", targetUserId).maybeSingle();
  if (!userExists) return jsonResponse(400, { ok: false, error: "Usuario no encontrado.", code: "USER_NOT_FOUND" });

  const { error: mapError } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .upsert({ id_sicas_vendedor: sicasVendorId, movi_user_id: targetUserId, catalog_type_id: 32, mapped_by: adminUserId, mapped_at: new Date().toISOString() }, { onConflict: "id_sicas_vendedor" });

  if (mapError) {
    if (mapError.code === "23505") {
      const { error: mapError2 } = await supabase
        .from("sicas_mapeo_vendedor_usuario")
        .upsert({ id_sicas_vendedor: sicasVendorId, movi_user_id: targetUserId, catalog_type_id: 32, mapped_by: adminUserId, mapped_at: new Date().toISOString() }, { onConflict: "movi_user_id" });
      if (mapError2) return jsonResponse(500, { ok: false, error: mapError2.message, code: "MAP_ERROR" });
    } else {
      return jsonResponse(500, { ok: false, error: mapError.message, code: "MAP_ERROR" });
    }
  }

  await supabase.from("usuarios").update({ id_sicas: sicasVendorId, nombre_sicas: vendorExists.nombre }).eq("id", targetUserId);
  console.log(`[SICASProd] map-user: ${targetUserId} -> vendor ${sicasVendorId} (${vendorExists.nombre})`);
  return jsonResponse(200, { ok: true, message: `Usuario vinculado a ${vendorExists.nombre} (ID: ${sicasVendorId})` });
}

async function handleUnmapUser(
  supabase: SupabaseClient,
  targetUserId: string,
  removeVendorMappings: boolean = false
): Promise<Response> {
  const { data: usuario } = await supabase.from("usuarios").select("id, id_sicas").eq("id", targetUserId).maybeSingle();
  if (!usuario) return jsonResponse(400, { ok: false, error: "Usuario no encontrado.", code: "USER_NOT_FOUND" });

  if (usuario.id_sicas) await supabase.from("sicas_mapeo_vendedor_usuario").delete().eq("id_sicas_vendedor", usuario.id_sicas);
  await supabase.from("sicas_mapeo_vendedor_usuario").delete().eq("movi_user_id", targetUserId);
  await supabase.from("usuarios").update({ id_sicas: null, nombre_sicas: null }).eq("id", targetUserId);

  if (removeVendorMappings) {
    await supabase.from("vendor_mappings").delete().eq("movi_user_id", targetUserId);
  }

  return jsonResponse(200, { ok: true, message: "Vinculo eliminado." });
}

// ─── Main Router ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(401, { ok: false, error: "No autorizado.", code: "NO_AUTH" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(401, { ok: false, error: "Sesion no valida.", code: "INVALID_SESSION" });

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "documents";

    const { rol: callerRol, oficina_id: callerOficinaId } = await getUserRole(supabase, user.id);
    const isAdmin = callerRol === "Administrador";
    const isGerente = callerRol === "Gerente";
    const canManageVendors = isAdmin || isGerente;

    console.log(`[SICASProd] === REQUEST action=${action} userId=${user.id} rol=${callerRol} vendorId=${body.vendorId || "(none)"} ===`);

    // ── Admin-only management actions ──
    const adminOnlyActions = ["list-users", "list-vendors", "map-user", "unmap-user"];
    if (adminOnlyActions.includes(action)) {
      if (!isAdmin) return jsonResponse(403, { ok: false, error: "Solo administradores pueden gestionar mapeos.", code: "FORBIDDEN" });
      switch (action) {
        case "list-users": return await handleListUsers(supabase);
        case "list-vendors": return await handleListVendors(supabase, body.search);
        case "map-user":
          if (!body.targetUserId || !body.sicasVendorId) return jsonResponse(400, { ok: false, error: "Se requiere targetUserId y sicasVendorId.", code: "MISSING_PARAMS" });
          return await handleMapUser(supabase, user.id, body.targetUserId, body.sicasVendorId);
        case "unmap-user":
          if (!body.targetUserId) return jsonResponse(400, { ok: false, error: "Se requiere targetUserId.", code: "MISSING_PARAMS" });
          return await handleUnmapUser(supabase, body.targetUserId, body.removeVendorMappings === true);
      }
    }

    // ── list-mapped-vendors ──
    if (action === "list-mapped-vendors") {
      if (!canManageVendors) return jsonResponse(403, { ok: false, error: "No tienes permisos para ver vendedores.", code: "FORBIDDEN" });
      return await handleListMappedVendors(supabase, isGerente ? callerOficinaId : null);
    }

    // ════════════════════════════════════════════════════════════════════
    // ROUTING: Scoped (Flow B) vs Global (Flow A)
    // All data comes from local sicas_documents table (synced via SOAP)
    // ════════════════════════════════════════════════════════════════════

    const hasVendorId = !!body.vendorId;

    // ── diagnose action ──
    if (action === "diagnose") {
      let vendorId = body.vendorId;
      if (!vendorId) {
        const identity = await resolveMoviUserToSicasIdentity(supabase, user.id);
        vendorId = identity?.vendorId || "1";
      }
      return await handleDiagnose(supabase, vendorId);
    }

    // ── FLOW B: Scoped query (specific vendor selected) ──
    if (hasVendorId) {
      console.log(`[SICASProd] FLOW B (scoped): vendorId=${body.vendorId}`);

      const identity = await resolveVendorIdToSicasIdentity(supabase, body.vendorId);
      if (!identity) {
        return jsonResponse(200, {
          ok: false, error: `No se encontro mapping para vendorId=${body.vendorId}`,
          code: "VENDOR_NOT_MAPPED", noMapping: true,
        });
      }

      if (isGerente && callerOficinaId) {
        const { data: targetUser } = await supabase.from("usuarios").select("oficina_id").eq("id", identity.moviUserId).maybeSingle();
        if (targetUser && targetUser.oficina_id !== callerOficinaId) {
          return jsonResponse(403, { ok: false, error: "Solo puedes consultar la produccion de usuarios de tu oficina.", code: "OFFICE_MISMATCH" });
        }
      }

      switch (action) {
        case "dashboard":
          return await handleScopedDashboard(supabase, identity, {
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
            type: body.type, status: body.status, ramo: body.ramo,
            subramo: body.subramo, aseguradora: body.aseguradora,
            cliente: body.cliente, moneda: body.moneda, agente: body.agente,
            search: body.search,
          });
        case "documents":
          return await handleScopedDocuments(supabase, identity, {
            page: body.page, pageSize: body.pageSize, type: body.type,
            search: body.search, sortField: body.sortField, sortDirection: body.sortDirection,
            status: body.status, ramo: body.ramo, aseguradora: body.aseguradora,
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
          });
        case "detail":
          if (!body.idDocto) return jsonResponse(400, { ok: false, error: "Se requiere idDocto.", code: "MISSING_ID" });
          return await handleDetail(supabase, identity, isAdmin, { idDocto: body.idDocto });
        default:
          return jsonResponse(400, { ok: false, error: `Accion no valida: ${action}`, code: "INVALID_ACTION" });
      }
    }

    // ── FLOW A or FLOW B for self ──
    if (isAdmin) {
      console.log(`[SICASProd] FLOW A (global): admin, all vendors`);

      switch (action) {
        case "dashboard":
          return await handleGlobalDashboard(supabase, {
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
            type: body.type, status: body.status, ramo: body.ramo,
            subramo: body.subramo, aseguradora: body.aseguradora,
            cliente: body.cliente, moneda: body.moneda, agente: body.agente,
            search: body.search,
          });
        case "documents":
          return await handleGlobalDocuments(supabase, {
            page: body.page, pageSize: body.pageSize, type: body.type,
            search: body.search, sortField: body.sortField, sortDirection: body.sortDirection,
            status: body.status, ramo: body.ramo, aseguradora: body.aseguradora,
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
          });
        case "detail":
          if (!body.idDocto) return jsonResponse(400, { ok: false, error: "Se requiere idDocto.", code: "MISSING_ID" });
          return await handleDetail(supabase, null, true, { idDocto: body.idDocto });
        default:
          return jsonResponse(400, { ok: false, error: `Accion no valida: ${action}`, code: "INVALID_ACTION" });
      }
    }

    if (isGerente) {
      console.log(`[SICASProd] FLOW A (global): gerente, office=${callerOficinaId}`);

      const { data: officeVendors } = await supabase
        .from("usuarios")
        .select("id_sicas")
        .eq("oficina_id", callerOficinaId)
        .eq("activo", true)
        .not("id_sicas", "is", null);

      const officeVendorIds = (officeVendors || []).map((v: any) => v.id_sicas).filter(Boolean);
      if (officeVendorIds.length === 0) {
        return jsonResponse(200, {
          ok: false, error: "No hay usuarios con vinculo SICAS en tu oficina.",
          code: "NO_OFFICE_MAPPINGS", noMapping: true, isGerente: true, canSelectVendor: true,
        });
      }

      console.log(`[SICASProd] FLOW A: gerente office vendors: [${officeVendorIds.join(",")}]`);

      switch (action) {
        case "dashboard":
          return await handleGlobalDashboard(supabase, {
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
            type: body.type, status: body.status, ramo: body.ramo,
            subramo: body.subramo, aseguradora: body.aseguradora,
            cliente: body.cliente, moneda: body.moneda, agente: body.agente,
            search: body.search,
          }, officeVendorIds);
        case "documents":
          return await handleGlobalDocuments(supabase, {
            page: body.page, pageSize: body.pageSize, type: body.type,
            search: body.search, sortField: body.sortField, sortDirection: body.sortDirection,
            status: body.status, ramo: body.ramo, aseguradora: body.aseguradora,
            fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
          }, officeVendorIds);
        case "detail":
          if (!body.idDocto) return jsonResponse(400, { ok: false, error: "Se requiere idDocto.", code: "MISSING_ID" });
          return await handleDetail(supabase, null, false, { idDocto: body.idDocto });
        default:
          return jsonResponse(400, { ok: false, error: `Accion no valida: ${action}`, code: "INVALID_ACTION" });
      }
    }

    // Regular user (Agente/Empleado) → Flow B with their own SICAS identity
    console.log(`[SICASProd] FLOW B (self): resolving identity for user=${user.id}`);

    const selfIdentity = await resolveMoviUserToSicasIdentity(supabase, user.id);
    if (!selfIdentity) {
      return jsonResponse(200, {
        ok: false, error: "Tu cuenta aun no tiene un vinculo activo con SICAS.",
        code: "NO_MAPPING", noMapping: true, isAdmin: false, isGerente: false, canSelectVendor: false,
      });
    }

    console.log(`[SICASProd] FLOW B (self): vendorId=${selfIdentity.vendorId} vendorName="${selfIdentity.vendorName}" source=${selfIdentity.source}`);

    switch (action) {
      case "dashboard":
        return await handleScopedDashboard(supabase, selfIdentity, {
          fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
          type: body.type, status: body.status, ramo: body.ramo,
          subramo: body.subramo, aseguradora: body.aseguradora,
          cliente: body.cliente, moneda: body.moneda, agente: body.agente,
          search: body.search,
        });
      case "documents":
        return await handleScopedDocuments(supabase, selfIdentity, {
          page: body.page, pageSize: body.pageSize, type: body.type,
          search: body.search, sortField: body.sortField, sortDirection: body.sortDirection,
          status: body.status, ramo: body.ramo, aseguradora: body.aseguradora,
          fechaDesde: body.fechaDesde, fechaHasta: body.fechaHasta,
        });
      case "detail":
        if (!body.idDocto) return jsonResponse(400, { ok: false, error: "Se requiere idDocto.", code: "MISSING_ID" });
        return await handleDetail(supabase, selfIdentity, false, { idDocto: body.idDocto });
      default:
        return jsonResponse(400, { ok: false, error: `Accion no valida: ${action}`, code: "INVALID_ACTION" });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[SICASProd] ERROR: ${msg}`);
    return jsonResponse(500, { ok: false, error: "Ocurrio un error al consultar produccion. Intenta de nuevo.", code: "UNKNOWN" });
  }
});
