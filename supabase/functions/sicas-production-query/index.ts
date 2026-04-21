import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasRestClient } from "../_shared/sicasRestClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductionConfig {
  report_filter_mode: string;
  report_filter_field: string;
  report_keycode_all: string;
  report_keycode_policies: string;
  report_keycode_bonds: string;
  detail_keycode: string;
  detail_identity_field: string;
  fields_requested_list: string;
  default_page_size: number;
}

interface UserMapping {
  sicas_vendor_id: string;
  sicas_vendor_name: string | null;
  usuario_id: string;
  rol: string;
  oficina_id: string | null;
}

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

interface DetailRequest {
  idDocto: string | number;
}

// ─── Error Normalizer ────────────────────────────────────────────────────────

function normalizeError(
  error: unknown
): { code: string; message: string; userMessage: string } {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("Token Inactivo") || msg.includes("401"))
    return {
      code: "TOKEN_EXPIRED",
      message: msg,
      userMessage: "La sesion con SICAS expiro. Intenta de nuevo.",
    };
  if (msg.includes("Codigo de reporte"))
    return {
      code: "KEYCODE_NOT_FOUND",
      message: msg,
      userMessage: "El reporte solicitado no esta disponible en SICAS.",
    };
  if (msg.includes("credentials") || msg.includes("Authentication"))
    return {
      code: "AUTH_FAILED",
      message: msg,
      userMessage: "No fue posible autenticarse con SICAS.",
    };
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("ECONNREFUSED")
  )
    return {
      code: "CONNECTION_ERROR",
      message: msg,
      userMessage: "No fue posible conectar con SICAS en este momento.",
    };

  return {
    code: "UNKNOWN",
    message: msg,
    userMessage: "Ocurrio un error al consultar SICAS. Intenta de nuevo.",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getConfig(
  supabase: ReturnType<typeof createClient>
): Promise<ProductionConfig> {
  const { data, error } = await supabase
    .from("sicas_production_config")
    .select("*")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      report_filter_mode: "vendor",
      report_filter_field: "DatDocumentos.VendId",
      report_keycode_all: "HWS_DOCTOS",
      report_keycode_policies: "HWSDOC",
      report_keycode_bonds: "HWSInventario",
      detail_keycode: "HWCAPTURE",
      detail_identity_field: "H02",
      fields_requested_list: "",
      default_page_size: 25,
    };
  }
  return data as ProductionConfig;
}

async function resolveUserMapping(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<UserMapping | null> {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, rol, oficina_id, id_sicas, nombre_sicas")
    .eq("id", userId)
    .maybeSingle();

  if (!usuario) return null;

  if (usuario.id_sicas) {
    return {
      sicas_vendor_id: usuario.id_sicas,
      sicas_vendor_name: usuario.nombre_sicas || null,
      usuario_id: usuario.id,
      rol: usuario.rol,
      oficina_id: usuario.oficina_id,
    };
  }

  const { data: mapping } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .select("id_sicas_vendedor")
    .eq("movi_user_id", userId)
    .maybeSingle();

  if (mapping) {
    return {
      sicas_vendor_id: mapping.id_sicas_vendedor,
      sicas_vendor_name: usuario.nombre_sicas || null,
      usuario_id: usuario.id,
      rol: usuario.rol,
      oficina_id: usuario.oficina_id,
    };
  }

  return null;
}

/**
 * Build the vendor filter condition string.
 * Uses the configured filter field (e.g. DatDocumentos.VendId).
 * Returns empty string for ALL mode (no vendor filter).
 */
function buildVendorCondition(
  config: ProductionConfig,
  mapping: UserMapping
): string {
  if (mapping.sicas_vendor_id === "ALL") return "";
  const vid = mapping.sicas_vendor_id;
  const field = config.report_filter_field;
  if (vid.includes(",")) {
    return `${field} IN (${vid})`;
  }
  return `${field}=${vid}`;
}

function buildConditions(
  config: ProductionConfig,
  mapping: UserMapping,
  params: DocumentsRequest
): { conditions: string; conditionsDirect: string } {
  const condParts: string[] = [];
  const cdParts: string[] = [];

  // Vendor filter goes into BOTH conditions and conditionsDirect for maximum compatibility
  const vendorFilter = buildVendorCondition(config, mapping);
  if (vendorFilter) {
    condParts.push(vendorFilter);
    cdParts.push(vendorFilter);
  }

  if (params.status) {
    const statusMap: Record<string, string> = {
      vigente: "1",
      renovada: "2",
      cancelada: "3",
      "no vigente": "4",
      pendiente: "5",
    };
    const val = statusMap[params.status.toLowerCase()] || params.status;
    condParts.push(`DatDocumentos.Status=${val}`);
  }

  if (params.search) {
    const s = params.search.replace(/'/g, "");
    condParts.push(
      `(DatDocumentos.Documento LIKE '%${s}%' OR DatDocumentos.NombreCompleto LIKE '%${s}%')`
    );
  }

  if (params.fechaDesde) {
    condParts.push(`DatDocumentos.FDesde>=${params.fechaDesde}`);
  }
  if (params.fechaHasta) {
    condParts.push(`DatDocumentos.FHasta<=${params.fechaHasta}`);
  }

  if (params.ramo) {
    condParts.push(`DatDocumentos.Ramo LIKE '%${params.ramo.replace(/'/g, "")}%'`);
  }
  if (params.aseguradora) {
    condParts.push(
      `DatDocumentos.Abreviacion LIKE '%${params.aseguradora.replace(/'/g, "")}%'`
    );
  }

  return {
    conditions: condParts.join(" AND "),
    conditionsDirect: cdParts.join(" AND "),
  };
}

function selectKeyCode(
  config: ProductionConfig,
  type: string
): string {
  switch (type) {
    case "policies":
      return config.report_keycode_policies;
    case "bonds":
      return config.report_keycode_bonds;
    default:
      return config.report_keycode_all;
  }
}

function normalizeRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const get = (keys: string[]): unknown => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return null;
  };
  const num = (keys: string[]): number => {
    const v = get(keys);
    if (v === null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };
  const str = (keys: string[]): string => {
    const v = get(keys);
    return v !== null ? String(v) : "";
  };

  const statusTxt = str(["Status_TXT", "Estatus_TXT"]);
  const statusRaw = str(["Status", "Estatus", "StatusDoc"]);
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

  const resolvedStatus = statusTxt
    || statusLetterMap[statusRaw]
    || statusNumMap[statusRaw]
    || statusRaw
    || "Desconocido";

  return {
    idDocto: get(["IDDocto", "IdDocto", "Id_Docto", "iddocto"]),
    documento: str(["Documento", "NoDocumento", "No_Documento", "DAnterior", "DPosterior"]),
    tipo: str(["TipoDocto_TXT", "TipoDocto", "Tipo"]),
    subtipo: str(["SubTipoDocto_TXT", "SubTipoDocto"]),
    ramo: str(["RamosNombre", "Ramo", "Ramo_TXT", "NombreRamo", "RamosAbreviacion"]),
    subramo: str(["SRamoNombre", "SubRamo", "SubRamo_TXT", "NombreSubRamo", "SRamoAbreviacion"]),
    aseguradora: str(["CiaAbreviacion", "CiaNombre", "Abreviacion", "Cia", "Aseguradora", "Compania"]),
    cliente: str([
      "NombreCompleto",
      "Nombre_Completo",
      "Cliente",
      "Contratante",
    ]),
    fechaDesde: str(["FDesde", "Fdesde", "FechaDesde", "Vigencia_Desde"]),
    fechaHasta: str(["FHasta", "Fhasta", "FechaHasta", "Vigencia_Hasta"]),
    primaNeta: num(["PrimaNeta", "Prima_Neta", "Primaneta"]),
    primaTotal: num(["PrimaTotal", "Prima_Total", "Primatotal", "ImporteTotal"]),
    moneda: str(["Moneda", "MonedaTXT", "Moneda_TXT"]) || "MXN",
    status: resolvedStatus,
    statusRaw,
    statusCobro: str(["StatusCobro", "Status_Cobro", "EstatusCobro"]),
    vendedor: str(["VendNombre", "Vendedor", "Vend_Nombre", "VendAbreviacion"]),
    vendedorId: str(["IDVend", "VendId", "Vend_Id"]),
    agente: str(["AgenteNombre", "Agente", "NombreAgente"]),
    agenteId: str(["IDAgente", "AgenteId", "CAgente"]),
    raw,
  };
}

/**
 * Fetch ALL pages from a SICAS report, iterating through pagination.
 * Returns the full array of raw records and the total from TableControl.
 */
async function fetchAllPages(
  client: SicasRestClient,
  opts: {
    keyCode: string;
    conditions?: string;
    conditionsDirect?: string;
    sortFields?: string;
    fieldsRequested?: string;
    pageSize?: number;
    maxPages?: number;
  }
): Promise<{ records: Record<string, unknown>[]; totalInSicas: number; pagesFetched: number }> {
  const pageSize = opts.pageSize || 500;
  const maxPages = opts.maxPages || 100;
  const allRecords: Record<string, unknown>[] = [];
  let page = 1;
  let totalInSicas = 0;
  let totalPages = 1;

  while (page <= maxPages) {
    const response = await client.readReport({
      keyCode: opts.keyCode,
      pageRequested: page,
      itemsForPage: pageSize,
      conditions: opts.conditions || undefined,
      conditionsDirect: opts.conditionsDirect || undefined,
      sortFields: opts.sortFields || undefined,
      fieldsRequested: opts.fieldsRequested || undefined,
    });

    const records = response.Response?.[0]?.TableInfo || [];
    const control = response.Response?.[0]?.TableControl?.[0];

    if (page === 1) {
      totalInSicas = control?.MaxRecords || records.length;
      totalPages = control?.Pages || 1;
      console.log(`[SICASProd] fetchAllPages: SICAS reports MaxRecords=${totalInSicas} Pages=${totalPages} ItemForPage=${control?.ItemForPage || pageSize}`);
    }

    allRecords.push(...records);

    if (records.length === 0 || page >= totalPages) break;
    page++;
  }

  console.log(`[SICASProd] fetchAllPages: fetched ${allRecords.length} records across ${page} pages (totalInSicas=${totalInSicas})`);
  return { records: allRecords, totalInSicas, pagesFetched: page };
}

// ─── Action: documents ───────────────────────────────────────────────────────

async function handleDocuments(
  client: SicasRestClient,
  config: ProductionConfig,
  mapping: UserMapping,
  params: DocumentsRequest
): Promise<Response> {
  const startTime = Date.now();
  const pageSize = Math.min(params.pageSize || config.default_page_size, 500);
  const page = params.page || 1;
  const keyCode = selectKeyCode(config, params.type || "all");
  const { conditions, conditionsDirect } = buildConditions(config, mapping, params);
  const isAllMode = mapping.sicas_vendor_id === "ALL";
  const vendorIdStr = String(mapping.sicas_vendor_id);

  const sortField = params.sortField || "DatDocumentos.FDesde";
  const sortDir = (params.sortDirection || "desc").toUpperCase();

  console.log(`[SICASProd] documents: keyCode=${keyCode} page=${page} pageSize=${pageSize} allMode=${isAllMode} vendorId=${vendorIdStr}`);
  console.log(`[SICASProd] documents: conditions="${conditions || "(none)"}"`);
  console.log(`[SICASProd] documents: conditionsDirect="${conditionsDirect || "(none)"}"`);

  const response = await client.readReport({
    keyCode,
    pageRequested: page,
    itemsForPage: pageSize,
    sortFields: `${sortField} ${sortDir}`,
    conditions: conditions || undefined,
    conditionsDirect: conditionsDirect || undefined,
    fieldsRequested: config.fields_requested_list || undefined,
  });

  const records = response.Response?.[0]?.TableInfo || [];
  const control = response.Response?.[0]?.TableControl?.[0];
  console.log(`[SICASProd] documents: SICAS returned ${records.length} records, MaxRecords=${control?.MaxRecords || "?"}, Pages=${control?.Pages || "?"}, Page=${control?.Page || "?"}`);

  // Log a sample record's vendor fields to debug filtering
  if (records.length > 0) {
    const sample = records[0] as Record<string, unknown>;
    console.log(`[SICASProd] documents: sample record vendor fields - VendId=${sample.VendId ?? sample.IDVend ?? "?"}, VendNombre=${sample.VendNombre ?? sample.Vendedor ?? "?"}`);
  }

  const allItems = records.map(normalizeRecord);

  const duration = Date.now() - startTime;
  console.log(`[SICASProd] documents: returning ${allItems.length} records in ${duration}ms`);

  return jsonResponse(200, {
    ok: true,
    items: allItems,
    pagination: {
      page: control?.Page || page,
      pageSize: control?.ItemForPage || pageSize,
      pages: control?.Pages || 1,
      maxRecords: control?.MaxRecords || allItems.length,
    },
    meta: {
      keyCode,
      duration,
      filtersApplied: conditions,
      conditionsDirectApplied: conditionsDirect,
      vendorId: vendorIdStr,
    },
  });
}

// ─── Action: summary ─────────────────────────────────────────────────────────

async function handleSummary(
  client: SicasRestClient,
  config: ProductionConfig,
  mapping: UserMapping
): Promise<Response> {
  const startTime = Date.now();
  const isAllMode = mapping.sicas_vendor_id === "ALL";
  const vendorFilter = buildVendorCondition(config, mapping);

  console.log(`[SICASProd] summary: vendorId=${mapping.sicas_vendor_id} allMode=${isAllMode}`);
  console.log(`[SICASProd] summary: vendorFilter="${vendorFilter || "(none - all vendors)"}"`);

  const { records, totalInSicas } = await fetchAllPages(client, {
    keyCode: config.report_keycode_all,
    conditions: vendorFilter || undefined,
    conditionsDirect: vendorFilter || undefined,
    pageSize: 500,
    maxPages: isAllMode ? 10 : 50,
  });

  const normalized = records.map(normalizeRecord);

  let totalPrimaNeta = 0;
  let totalPrimaTotal = 0;
  let polizas = 0;
  let fianzas = 0;
  let vigentes = 0;
  let vencidas = 0;
  let canceladas = 0;
  const porRamo: Record<string, { count: number; prima: number }> = {};
  const porAseguradora: Record<string, { count: number; prima: number }> = {};
  const porMes: Record<string, { count: number; prima: number }> = {};

  for (const doc of normalized) {
    const pn = doc.primaNeta as number;
    const pt = doc.primaTotal as number;
    totalPrimaNeta += pn;
    totalPrimaTotal += pt;

    const tipo = String(doc.tipo || "").toLowerCase();
    if (tipo.includes("fianza")) fianzas++;
    else polizas++;

    const st = String(doc.statusRaw || "");
    const statusText = String(doc.status || "").toLowerCase();
    if (st === "V" || st === "1" || statusText === "vigente") vigentes++;
    else if (st === "X" || st === "N" || st === "4" || statusText.includes("no vigente") || statusText.includes("vencida")) vencidas++;
    else if (st === "C" || st === "3" || statusText === "cancelada") canceladas++;
    else if (st === "2" || statusText === "renovada") vigentes++;

    const ramo = String(doc.ramo || "Otros");
    if (!porRamo[ramo]) porRamo[ramo] = { count: 0, prima: 0 };
    porRamo[ramo].count++;
    porRamo[ramo].prima += pt;

    const aseg = String(doc.aseguradora || "Otros");
    if (!porAseguradora[aseg])
      porAseguradora[aseg] = { count: 0, prima: 0 };
    porAseguradora[aseg].count++;
    porAseguradora[aseg].prima += pt;

    const fd = String(doc.fechaDesde || "");
    const mes = fd.length >= 7 ? fd.substring(0, 7) : "sin-fecha";
    if (!porMes[mes]) porMes[mes] = { count: 0, prima: 0 };
    porMes[mes].count++;
    porMes[mes].prima += pt;
  }

  const duration = Date.now() - startTime;
  console.log(`[SICASProd] summary: computed from ${normalized.length} records (totalInSicas=${totalInSicas}) in ${duration}ms`);

  return jsonResponse(200, {
    ok: true,
    summary: {
      totalDocumentos: totalInSicas,
      totalPolizas: polizas,
      totalFianzas: fianzas,
      primaNetaTotal: Math.round(totalPrimaNeta * 100) / 100,
      primaTotalTotal: Math.round(totalPrimaTotal * 100) / 100,
      vigentes,
      vencidas,
      canceladas,
      porRamo,
      porAseguradora,
      porMes,
    },
    meta: { duration, recordsAnalyzed: normalized.length, totalInSicas },
  });
}

// ─── Action: detail ──────────────────────────────────────────────────────────

async function handleDetail(
  client: SicasRestClient,
  config: ProductionConfig,
  mapping: UserMapping,
  params: DetailRequest
): Promise<Response> {
  const startTime = Date.now();
  const idDocto = String(params.idDocto);
  const isAllMode = mapping.sicas_vendor_id === "ALL";

  console.log(`[SICASProd] detail: idDocto=${idDocto} user=${mapping.usuario_id} allMode=${isAllMode}`);

  // Ownership validation: query the document with vendor scope
  const vendorFilter = buildVendorCondition(config, mapping);
  const ownershipConditions = vendorFilter
    ? `DatDocumentos.IDDocto=${idDocto} AND ${vendorFilter}`
    : `DatDocumentos.IDDocto=${idDocto}`;

  const checkResponse = await client.readReport({
    keyCode: config.report_keycode_all,
    pageRequested: 1,
    itemsForPage: 1,
    conditions: ownershipConditions,
    conditionsDirect: vendorFilter || undefined,
  });

  const checkRecords = checkResponse.Response?.[0]?.TableInfo || [];
  if (checkRecords.length === 0) {
    // If vendor-filtered check failed, try without vendor filter for admins
    if (isAllMode) {
      const fallbackResponse = await client.readReport({
        keyCode: config.report_keycode_all,
        pageRequested: 1,
        itemsForPage: 1,
        conditions: `DatDocumentos.IDDocto=${idDocto}`,
      });
      const fallbackRecords = fallbackResponse.Response?.[0]?.TableInfo || [];
      if (fallbackRecords.length === 0) {
        console.log(`[SICASProd] detail: idDocto=${idDocto} not found in SICAS`);
        return jsonResponse(404, {
          ok: false,
          error: "Documento no encontrado en SICAS.",
          code: "DOCUMENT_NOT_FOUND",
        });
      }
      // Use fallback record
      checkRecords.push(...fallbackRecords);
    } else {
      console.log(`[SICASProd] detail: idDocto=${idDocto} not found for vendor=${mapping.sicas_vendor_id}`);
      return jsonResponse(403, {
        ok: false,
        error: "No tienes permiso para consultar este documento.",
        code: "DOCUMENT_NOT_OWNED",
      });
    }
  }

  // Fetch full detail via Data/ReadData
  let document: Record<string, unknown> = normalizeRecord(checkRecords[0]);

  try {
    const detailResponse = await client.request<{
      Response: Array<{ Values?: Record<string, unknown> }>;
      Sucess: boolean;
      Error?: string;
    }>("/Data/ReadData", {
      method: "POST",
      headers: { Prop_KeyCode: config.detail_keycode },
      body: JSON.stringify({ "DatDocumentos.IDDocto": idDocto }),
      maxRetries: 2,
    });

    if (
      detailResponse.Sucess &&
      detailResponse.Response?.[0]?.Values
    ) {
      const detailValues = detailResponse.Response[0].Values;
      document = {
        ...document,
        ...normalizeDetailValues(detailValues),
        raw: { listRecord: checkRecords[0], detailValues },
      };
    } else {
      document.raw = { listRecord: checkRecords[0], detailError: detailResponse.Error };
    }
  } catch (detailError) {
    console.warn(`[SICASProd] detail: /Data/ReadData failed, using list record. Error: ${detailError}`);
    document.raw = { listRecord: checkRecords[0], detailError: String(detailError) };
  }

  const duration = Date.now() - startTime;
  console.log(`[SICASProd] detail: returned in ${duration}ms`);

  return jsonResponse(200, {
    ok: true,
    document,
    meta: { duration },
  });
}

function normalizeDetailValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  const get = (keys: string[]): unknown => {
    for (const k of keys) {
      const val = values[k] ?? values[k.toLowerCase()] ?? values[k.toUpperCase()];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return null;
  };
  const str = (keys: string[]): string => {
    const v = get(keys);
    return v !== null ? String(v) : "";
  };
  const num = (keys: string[]): number => {
    const v = get(keys);
    if (v === null) return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  return {
    cliente: {
      nombre: str(["NombreCompleto", "Contratante", "Cliente"]),
      rfc: str(["RFC", "Rfc"]),
      direccion: str(["Direccion", "DireccionCompleta"]),
      telefono: str(["Telefono", "Tel"]),
      email: str(["Email", "eMail", "Correo"]),
    },
    agente: {
      id: str(["IDAgente", "AgenteId"]),
      nombre: str(["Agente", "AgenteNombre"]),
    },
    vendedor: {
      id: str(["IDVend", "VendId"]),
      nombre: str(["Vendedor", "VendNombre"]),
    },
    fechas: {
      desde: str(["FDesde", "FechaDesde"]),
      hasta: str(["FHasta", "FechaHasta"]),
      emision: str(["FEmision", "FechaEmision"]),
      captura: str(["FCaptura", "FechaCaptura"]),
    },
    importes: {
      primaNeta: num(["PrimaNeta", "Prima_Neta"]),
      primaTotal: num(["PrimaTotal", "ImporteTotal"]),
      derechoPoliza: num(["DerechoPoliza", "Derecho"]),
      iva: num(["IVA", "Iva"]),
      recargos: num(["Recargos"]),
      descuento: num(["Descuento"]),
    },
    estatus: {
      documento: str(["Estatus", "StatusDoc"]),
      cobro: str(["StatusCobro", "EstatusCobro"]),
      usuario: str(["StatusUsuario"]),
    },
  };
}

// ─── Action: dashboard (full KPIs + chart series + top lists) ───────────────

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
  formaPago?: string;
  search?: string;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}


function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function handleDashboard(
  client: SicasRestClient,
  config: ProductionConfig,
  mapping: UserMapping,
  filters: DashboardFilters
): Promise<Response> {
  const startTime = Date.now();
  const isAllMode = mapping.sicas_vendor_id === "ALL";
  const vendorFilter = buildVendorCondition(config, mapping);

  // Determine date range for client-side analysis
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

  // Build SICAS API conditions - vendor filter only, NO date filters sent to API
  // We fetch ALL documents for this vendor and analyze dates client-side
  // This ensures we get complete data for KPIs, renewals, comparisons, etc.
  const apiConditionParts: string[] = [];
  const apiCdParts: string[] = [];

  if (vendorFilter) {
    apiConditionParts.push(vendorFilter);
    apiCdParts.push(vendorFilter);
  }

  // Additional API-compatible filters
  if (filters.status) {
    const statusMap: Record<string, string> = { vigente: "1", renovada: "2", cancelada: "3", "no vigente": "4", pendiente: "5" };
    const val = statusMap[filters.status.toLowerCase()] || filters.status;
    apiConditionParts.push(`DatDocumentos.Status=${val}`);
  }
  if (filters.search) {
    const s = filters.search.replace(/'/g, "");
    apiConditionParts.push(`(DatDocumentos.Documento LIKE '%${s}%' OR DatDocumentos.NombreCompleto LIKE '%${s}%')`);
  }
  if (filters.ramo) apiConditionParts.push(`DatDocumentos.Ramo LIKE '%${filters.ramo.replace(/'/g, "")}%'`);
  if (filters.aseguradora) apiConditionParts.push(`DatDocumentos.Abreviacion LIKE '%${filters.aseguradora.replace(/'/g, "")}%'`);

  const conditions = apiConditionParts.length > 0 ? apiConditionParts.join(" AND ") : undefined;
  const conditionsDirect = apiCdParts.length > 0 ? apiCdParts.join(" AND ") : undefined;

  console.log(`[SICASProd] dashboard: vendorId=${mapping.sicas_vendor_id} (${mapping.sicas_vendor_name}) periodo=${periodoLabel} allMode=${isAllMode}`);
  console.log(`[SICASProd] dashboard: conditions="${conditions || "(none)"}"`);
  console.log(`[SICASProd] dashboard: conditionsDirect="${conditionsDirect || "(none)"}"`);

  // Fetch ALL records using pagination
  const { records: allRecords, totalInSicas, pagesFetched } = await fetchAllPages(client, {
    keyCode: config.report_keycode_all,
    conditions,
    conditionsDirect,
    sortFields: "DatDocumentos.FDesde DESC",
    pageSize: 500,
    maxPages: isAllMode ? 10 : 50,
  });

  const docs = allRecords.map(normalizeRecord);

  // Log sample to debug vendor field values
  if (docs.length > 0) {
    const sample = docs[0];
    console.log(`[SICASProd] dashboard: sample - vendedorId="${sample.vendedorId}" vendedor="${sample.vendedor}" idDocto=${sample.idDocto}`);
  }

  // Apply client-side filters
  let filtered = docs;
  if (filters.type === "policies") filtered = filtered.filter(d => !String(d.tipo).toLowerCase().includes("fianza"));
  else if (filters.type === "bonds") filtered = filtered.filter(d => String(d.tipo).toLowerCase().includes("fianza"));
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

  // ── Compute KPIs ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalPrimaNeta = 0, totalPrimaTotal = 0;
  let polizasEmitidas = 0, fianzasEmitidas = 0;
  let polizasVigentes = 0, fianzasVigentes = 0;
  let primaVigente = 0;
  let cancelaciones = 0;
  let mesPrimaNeta = 0, mesPrimaTotal = 0;
  let mesEmisiones = 0;
  let renew7 = 0, renew15 = 0, renew30 = 0, primaRenovar = 0;
  let renewMes = 0;
  const clientesSet = new Set<string>();
  const clientesMesSet = new Set<string>();

  const rangeDurationMs = rangeEnd.getTime() - rangeStart.getTime();
  const prevRangeEnd = new Date(rangeStart.getTime() - 1);
  const prevRangeStart = new Date(prevRangeEnd.getTime() - rangeDurationMs);
  const yoyRangeStart = new Date(rangeStart);
  yoyRangeStart.setFullYear(yoyRangeStart.getFullYear() - 1);
  const yoyRangeEnd = new Date(rangeEnd);
  yoyRangeEnd.setFullYear(yoyRangeEnd.getFullYear() - 1);
  let prevRangePrima = 0;
  let yoyRangePrima = 0;

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
    const fDesde = parseDate(String(doc.fechaDesde || ""));
    const fHasta = parseDate(String(doc.fechaHasta || ""));

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

    if (fDesde && fDesde >= prevRangeStart && fDesde <= prevRangeEnd) {
      prevRangePrima += pt;
    }
    if (fDesde && fDesde >= yoyRangeStart && fDesde <= yoyRangeEnd) {
      yoyRangePrima += pt;
    }

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
    porRamo[ramo].count++;
    porRamo[ramo].prima += pt;
    if (isVigente) porRamo[ramo].vigentes++;

    if (!porSubramo[subramo]) porSubramo[subramo] = { count: 0, prima: 0 };
    porSubramo[subramo].count++;
    porSubramo[subramo].prima += pt;

    if (!porAseguradora[aseg]) porAseguradora[aseg] = { count: 0, prima: 0, vigentes: 0 };
    porAseguradora[aseg].count++;
    porAseguradora[aseg].prima += pt;
    if (isVigente) porAseguradora[aseg].vigentes++;

    if (cliente) {
      if (!porCliente[cliente]) porCliente[cliente] = { count: 0, prima: 0 };
      porCliente[cliente].count++;
      porCliente[cliente].prima += pt;
    }

    const mesKey = fDesde ? `${fDesde.getFullYear()}-${String(fDesde.getMonth() + 1).padStart(2, "0")}` : "sin-fecha";
    if (!porMes[mesKey]) porMes[mesKey] = { count: 0, primaNeta: 0, primaTotal: 0, emisiones: 0 };
    porMes[mesKey].count++;
    porMes[mesKey].primaNeta += pn;
    porMes[mesKey].primaTotal += pt;
    porMes[mesKey].emisiones++;

    if (!porEstatus[st || "desconocido"]) porEstatus[st || "desconocido"] = { count: 0, prima: 0 };
    porEstatus[st || "desconocido"].count++;
    porEstatus[st || "desconocido"].prima += pt;
  }

  const sortByPrima = (obj: Record<string, { count: number; prima: number }>) =>
    Object.entries(obj).sort((a, b) => b[1].prima - a[1].prima).map(([name, data]) => ({ name, ...data }));

  const topClientes = sortByPrima(porCliente).slice(0, 10);
  const topAseguradoras = sortByPrima(porAseguradora).slice(0, 10);
  const topRamos = sortByPrima(porRamo).slice(0, 10);
  const topSubramos = sortByPrima(porSubramo).slice(0, 10);

  const ticketPromedio = filtered.length > 0 ? totalPrimaTotal / filtered.length : 0;

  const variacionMesAnterior = prevRangePrima > 0
    ? ((mesPrimaTotal - prevRangePrima) / prevRangePrima) * 100
    : mesPrimaTotal > 0 ? 100 : 0;
  const variacionInteranual = yoyRangePrima > 0
    ? ((mesPrimaTotal - yoyRangePrima) / yoyRangePrima) * 100
    : mesPrimaTotal > 0 ? 100 : 0;

  const primaPorMesSeries = Object.entries(porMes)
    .filter(([k]) => k !== "sin-fecha")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, data]) => ({ mes, ...data }));

  const estatusDistribution = Object.entries(porEstatus).map(([estatus, data]) => ({ estatus, ...data }));

  const tipoDistribution = [
    { tipo: "Polizas", count: polizasEmitidas, prima: totalPrimaTotal - (fianzasEmitidas > 0 ? filtered.filter(d => String(d.tipo).toLowerCase().includes("fianza")).reduce((s, d) => s + (d.primaTotal as number), 0) : 0) },
    { tipo: "Fianzas", count: fianzasEmitidas, prima: filtered.filter(d => String(d.tipo).toLowerCase().includes("fianza")).reduce((s, d) => s + (d.primaTotal as number), 0) },
  ];

  const renewals = filtered
    .filter(d => {
      const fH = parseDate(String(d.fechaHasta || ""));
      if (!fH) return false;
      const stLocal = String(d.status || "").toLowerCase();
      const isV = stLocal === "vigente" || stLocal === "renovada";
      const days = daysBetween(today, fH);
      return isV && days >= 0 && days <= 30;
    })
    .sort((a, b) => {
      const da = new Date(String(a.fechaHasta)).getTime();
      const db = new Date(String(b.fechaHasta)).getTime();
      return da - db;
    })
    .slice(0, 50);

  const availableRamos = [...new Set(filtered.map(d => String(d.ramo)).filter(Boolean))].sort();
  const availableSubramos = [...new Set(filtered.map(d => String(d.subramo)).filter(Boolean))].sort();
  const availableAseguradoras = [...new Set(filtered.map(d => String(d.aseguradora)).filter(Boolean))].sort();
  const availableMonedas = [...new Set(filtered.map(d => String(d.moneda)).filter(Boolean))].sort();

  const duration = Date.now() - startTime;
  console.log(`[SICASProd] dashboard: computed from ${filtered.length} records (fetched=${docs.length}, totalInSicas=${totalInSicas}) in ${duration}ms`);

  return jsonResponse(200, {
    ok: true,
    periodo: periodoLabel,
    totalRecords: totalInSicas,
    recordsAnalyzed: filtered.length,
    recordsFetched: docs.length,
    pagesFetched,
    kpis: {
      polizasEmitidas,
      fianzasEmitidas,
      totalDocumentos: filtered.length,
      primaNetaEmitida: Math.round(totalPrimaNeta * 100) / 100,
      primaTotalEmitida: Math.round(totalPrimaTotal * 100) / 100,
      mesPrimaNeta: Math.round(mesPrimaNeta * 100) / 100,
      mesPrimaTotal: Math.round(mesPrimaTotal * 100) / 100,
      mesEmisiones,
      clientesMes: clientesMesSet.size,
      clientesTotal: clientesSet.size,
      polizasVigentes,
      fianzasVigentes,
      primaVigente: Math.round(primaVigente * 100) / 100,
      renovaciones7dias: renew7,
      renovaciones15dias: renew15,
      renovaciones30dias: renew30,
      renovacionesMes: renewMes,
      primaRenovar: Math.round(primaRenovar * 100) / 100,
      cancelaciones,
      ticketPromedio: Math.round(ticketPromedio * 100) / 100,
      topClientePeriodo: topClientes[0]?.name || "-",
      topAseguradoraPeriodo: topAseguradoras[0]?.name || "-",
      topRamoPeriodo: topRamos[0]?.name || "-",
      variacionMesAnterior: Math.round(variacionMesAnterior * 10) / 10,
      variacionInteranual: Math.round(variacionInteranual * 10) / 10,
    },
    charts: {
      primaPorMes: primaPorMesSeries,
      porRamo: topRamos,
      porAseguradora: topAseguradoras,
      porCliente: topClientes,
      porSubramo: topSubramos,
      porEstatus: estatusDistribution,
      tipoDistribution,
      renovacionesPorPeriodo: Object.entries(renewByWeek).map(([periodo, data]) => ({ periodo, ...data })),
    },
    topLists: {
      clientes: topClientes,
      aseguradoras: topAseguradoras,
      ramos: topRamos,
      subramos: topSubramos,
    },
    renewals,
    availableFilters: {
      ramos: availableRamos,
      subramos: availableSubramos,
      aseguradoras: availableAseguradoras,
      monedas: availableMonedas,
    },
    meta: { duration, vendorId: mapping.sicas_vendor_id, vendorName: mapping.sicas_vendor_name },
  });
}

// ─── Admin Actions ──────────────────────────────────────────────────────────

async function handleListUsers(
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos, email_laboral, rol, oficina_id, id_sicas, nombre_sicas, activo")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });
  }

  const [{ data: oficinas }, { data: vendorMappings }] = await Promise.all([
    supabase.from("oficinas").select("id, nombre").eq("activa", true),
    supabase.from("vendor_mappings").select("id, source_type, source_value, movi_user_id, status").eq("status", "active"),
  ]);

  const oficinasMap: Record<string, string> = {};
  for (const o of oficinas || []) {
    oficinasMap[o.id] = o.nombre;
  }

  const vmByUser: Record<string, Array<{ source_type: string; source_value: string }>> = {};
  for (const vm of vendorMappings || []) {
    if (!vmByUser[vm.movi_user_id]) vmByUser[vm.movi_user_id] = [];
    vmByUser[vm.movi_user_id].push({ source_type: vm.source_type, source_value: vm.source_value });
  }

  const mapped = (usuarios || []).map((u: Record<string, unknown>) => {
    const uid = u.id as string;
    const userVms = vmByUser[uid] || [];
    return {
      id: uid,
      nombre: u.nombre,
      apellidos: u.apellidos,
      email: u.email_laboral,
      rol: u.rol,
      oficina: u.oficina_id ? oficinasMap[u.oficina_id as string] || null : null,
      oficina_id: u.oficina_id,
      id_sicas: u.id_sicas || null,
      nombre_sicas: u.nombre_sicas || null,
      has_sicas_mapping: !!u.id_sicas,
      vendor_mappings: userVms,
      has_vendor_mapping: userVms.length > 0,
      has_mapping: !!u.id_sicas || userVms.length > 0,
    };
  });

  return jsonResponse(200, { ok: true, users: mapped });
}

async function handleListMappedVendors(
  supabase: ReturnType<typeof createClient>,
  filterOficinaId?: string | null
): Promise<Response> {
  let query = supabase
    .from("usuarios")
    .select("id, nombre, apellidos, id_sicas, nombre_sicas, oficina_id")
    .eq("activo", true)
    .not("id_sicas", "is", null)
    .order("nombre");

  if (filterOficinaId) {
    query = query.eq("oficina_id", filterOficinaId);
  }

  const { data: usuarios, error } = await query;

  if (error) {
    return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });
  }

  const { data: oficinas } = await supabase
    .from("oficinas")
    .select("id, nombre")
    .eq("activa", true);

  const oficinasMap: Record<string, string> = {};
  for (const o of oficinas || []) {
    oficinasMap[o.id] = o.nombre;
  }

  const vendors = (usuarios || []).map((u: Record<string, unknown>) => ({
    usuario_id: u.id,
    nombre: `${u.nombre} ${u.apellidos}`,
    id_sicas: u.id_sicas,
    nombre_sicas: u.nombre_sicas,
    oficina: u.oficina_id ? oficinasMap[u.oficina_id as string] || null : null,
  }));

  return jsonResponse(200, { ok: true, vendors });
}

async function handleListVendors(
  supabase: ReturnType<typeof createClient>,
  search?: string
): Promise<Response> {
  let query = supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre")
    .eq("catalog_type_id", 32)
    .order("nombre");

  if (search) {
    query = query.or(`nombre.ilike.%${search}%,id_sicas.ilike.%${search}%`);
  }

  query = query.limit(50);

  const { data, error } = await query;

  if (error) {
    return jsonResponse(500, { ok: false, error: error.message, code: "DB_ERROR" });
  }

  return jsonResponse(200, { ok: true, vendors: data || [] });
}

async function handleMapUser(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  targetUserId: string,
  sicasVendorId: string
): Promise<Response> {
  const { data: vendorExists } = await supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre")
    .eq("catalog_type_id", 32)
    .eq("id_sicas", sicasVendorId)
    .maybeSingle();

  if (!vendorExists) {
    return jsonResponse(400, { ok: false, error: "Vendedor SICAS no encontrado.", code: "VENDOR_NOT_FOUND" });
  }

  const { data: userExists } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!userExists) {
    return jsonResponse(400, { ok: false, error: "Usuario no encontrado.", code: "USER_NOT_FOUND" });
  }

  const { error: mapError } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .upsert({
      id_sicas_vendedor: sicasVendorId,
      movi_user_id: targetUserId,
      catalog_type_id: 32,
      mapped_by: adminUserId,
      mapped_at: new Date().toISOString(),
    }, { onConflict: "id_sicas_vendedor" });

  if (mapError) {
    if (mapError.code === "23505") {
      const { error: mapError2 } = await supabase
        .from("sicas_mapeo_vendedor_usuario")
        .upsert({
          id_sicas_vendedor: sicasVendorId,
          movi_user_id: targetUserId,
          catalog_type_id: 32,
          mapped_by: adminUserId,
          mapped_at: new Date().toISOString(),
        }, { onConflict: "movi_user_id" });

      if (mapError2) {
        return jsonResponse(500, { ok: false, error: mapError2.message, code: "MAP_ERROR" });
      }
    } else {
      return jsonResponse(500, { ok: false, error: mapError.message, code: "MAP_ERROR" });
    }
  }

  const { error: updateError } = await supabase
    .from("usuarios")
    .update({
      id_sicas: sicasVendorId,
      nombre_sicas: vendorExists.nombre,
    })
    .eq("id", targetUserId);

  if (updateError) {
    console.warn(`[SICASProd] map-user: failed to update usuarios.id_sicas: ${updateError.message}`);
  }

  console.log(`[SICASProd] map-user: ${targetUserId} -> vendor ${sicasVendorId} (${vendorExists.nombre})`);

  return jsonResponse(200, {
    ok: true,
    message: `Usuario vinculado a ${vendorExists.nombre} (ID: ${sicasVendorId})`,
  });
}

async function handleUnmapUser(
  supabase: ReturnType<typeof createClient>,
  targetUserId: string,
  removeVendorMappings: boolean = false
): Promise<Response> {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, id_sicas")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!usuario) {
    return jsonResponse(400, { ok: false, error: "Usuario no encontrado.", code: "USER_NOT_FOUND" });
  }

  if (usuario.id_sicas) {
    await supabase
      .from("sicas_mapeo_vendedor_usuario")
      .delete()
      .eq("id_sicas_vendedor", usuario.id_sicas);
  }

  await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .delete()
    .eq("movi_user_id", targetUserId);

  const { error: updateError } = await supabase
    .from("usuarios")
    .update({ id_sicas: null, nombre_sicas: null })
    .eq("id", targetUserId);

  if (updateError) {
    console.warn(`[SICASProd] unmap-user: failed to clear usuarios.id_sicas: ${updateError.message}`);
  }

  if (removeVendorMappings) {
    const { error: vmError } = await supabase
      .from("vendor_mappings")
      .delete()
      .eq("movi_user_id", targetUserId);

    if (vmError) {
      console.warn(`[SICASProd] unmap-user: failed to clear vendor_mappings: ${vmError.message}`);
    }
    console.log(`[SICASProd] unmap-user: ${targetUserId} fully unlinked`);
  } else {
    console.log(`[SICASProd] unmap-user: ${targetUserId} SICAS unlinked`);
  }

  return jsonResponse(200, { ok: true, message: "Vinculo eliminado." });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ rol: string; oficina_id: string | null }> {
  const { data } = await supabase
    .from("usuarios")
    .select("rol, oficina_id")
    .eq("id", userId)
    .maybeSingle();
  return { rol: data?.rol || "", oficina_id: data?.oficina_id || null };
}

async function requireAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { rol } = await getUserRole(supabase, userId);
  return rol === "Administrador";
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, {
        ok: false,
        error: "No autorizado.",
        code: "NO_AUTH",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(401, {
        ok: false,
        error: "Sesion no valida.",
        code: "INVALID_SESSION",
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "documents";

    console.log(`[SICASProd] === REQUEST action=${action} userId=${user.id} ===`);

    const { rol: callerRol, oficina_id: callerOficinaId } = await getUserRole(supabase, user.id);
    const isAdmin = callerRol === "Administrador";
    const isGerente = callerRol === "Gerente";
    const canManageVendors = isAdmin || isGerente;

    // Admin-only management actions
    const adminOnlyActions = ["list-users", "list-vendors", "map-user", "unmap-user"];
    if (adminOnlyActions.includes(action)) {
      if (!isAdmin) {
        return jsonResponse(403, { ok: false, error: "Solo administradores pueden gestionar mapeos.", code: "FORBIDDEN" });
      }
      switch (action) {
        case "list-users":
          return await handleListUsers(supabase);
        case "list-vendors":
          return await handleListVendors(supabase, body.search);
        case "map-user":
          if (!body.targetUserId || !body.sicasVendorId) {
            return jsonResponse(400, { ok: false, error: "Se requiere targetUserId y sicasVendorId.", code: "MISSING_PARAMS" });
          }
          return await handleMapUser(supabase, user.id, body.targetUserId, body.sicasVendorId);
        case "unmap-user":
          if (!body.targetUserId) {
            return jsonResponse(400, { ok: false, error: "Se requiere targetUserId.", code: "MISSING_PARAMS" });
          }
          return await handleUnmapUser(supabase, body.targetUserId, body.removeVendorMappings === true);
      }
    }

    // list-mapped-vendors: admin sees all, gerente sees only their office
    if (action === "list-mapped-vendors") {
      if (!canManageVendors) {
        return jsonResponse(403, { ok: false, error: "No tienes permisos para ver vendedores.", code: "FORBIDDEN" });
      }
      const filterOffice = isGerente ? callerOficinaId : null;
      return await handleListMappedVendors(supabase, filterOffice);
    }

    // Resolve vendor mapping for data actions
    let mapping: UserMapping | null = null;

    if (canManageVendors && body.vendorId) {
      const { data: targetUser } = await supabase
        .from("usuarios")
        .select("id, oficina_id, id_sicas, nombre_sicas, nombre, apellidos")
        .eq("id_sicas", body.vendorId)
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      if (isGerente && callerOficinaId && targetUser && targetUser.oficina_id !== callerOficinaId) {
        console.log(`[SICASProd] gerente office mismatch: target office=${targetUser.oficina_id} caller office=${callerOficinaId}`);
        return jsonResponse(403, {
          ok: false,
          error: "Solo puedes consultar la produccion de usuarios de tu oficina.",
          code: "OFFICE_MISMATCH",
        });
      }

      const vendorName = targetUser?.nombre_sicas || targetUser ? `${targetUser.nombre} ${targetUser.apellidos}` : body.vendorId;
      mapping = {
        sicas_vendor_id: String(body.vendorId),
        sicas_vendor_name: vendorName,
        usuario_id: targetUser?.id || user.id,
        rol: callerRol,
        oficina_id: callerOficinaId,
      };
      console.log(`[SICASProd] ${callerRol} selected vendor: vendorId=${body.vendorId} (${vendorName})`);
    } else if (isAdmin && !body.vendorId) {
      mapping = {
        sicas_vendor_id: "ALL",
        sicas_vendor_name: "Todos los vendedores",
        usuario_id: user.id,
        rol: callerRol,
        oficina_id: callerOficinaId,
      };
      console.log(`[SICASProd] admin ALL mode`);
    } else if (isGerente && !body.vendorId) {
      const { data: officeVendors } = await supabase
        .from("usuarios")
        .select("id_sicas")
        .eq("oficina_id", callerOficinaId)
        .eq("activo", true)
        .not("id_sicas", "is", null);

      const vendorIds = (officeVendors || []).map(v => v.id_sicas).filter(Boolean);
      if (vendorIds.length > 0) {
        mapping = {
          sicas_vendor_id: vendorIds.join(","),
          sicas_vendor_name: `Oficina (${vendorIds.length} vendedores)`,
          usuario_id: user.id,
          rol: callerRol,
          oficina_id: callerOficinaId,
        };
        console.log(`[SICASProd] gerente multi-vendor: ${vendorIds.length} vendors [${vendorIds.join(",")}]`);
      }
    }

    if (!mapping) {
      mapping = await resolveUserMapping(supabase, user.id);
    }

    if (!mapping) {
      return jsonResponse(200, {
        ok: false,
        error: "Tu cuenta aun no tiene un vinculo activo con SICAS.",
        code: "NO_MAPPING",
        noMapping: true,
        isAdmin,
        isGerente,
        canSelectVendor: canManageVendors,
      });
    }

    console.log(`[SICASProd] mapping resolved: vendorId=${mapping.sicas_vendor_id} vendorName=${mapping.sicas_vendor_name} rol=${mapping.rol}`);

    const config = await getConfig(supabase);
    console.log(`[SICASProd] config: filterField=${config.report_filter_field} keycode=${config.report_keycode_all}`);

    let client: SicasRestClient;
    try {
      client = new SicasRestClient();
    } catch (e) {
      return jsonResponse(503, {
        ok: false,
        error: "SICAS no esta configurado en el servidor.",
        code: "SICAS_NOT_CONFIGURED",
      });
    }

    // Diagnostic action to test query approaches
    if (action === "diagnose") {
      const vendorId = mapping.sicas_vendor_id;
      const field = config.report_filter_field;
      const results: Record<string, unknown> = {
        vendorId,
        filterField: field,
        keyCode: config.report_keycode_all,
      };

      // Test 1: No filter at all
      try {
        const r1 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 3,
        });
        const recs = r1.Response?.[0]?.TableInfo || [];
        const ctrl = r1.Response?.[0]?.TableControl?.[0];
        results.test1_no_filter = {
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          pages: ctrl?.Pages || 0,
          fieldNames: recs[0] ? Object.keys(recs[0]) : [],
          sampleRecord: recs[0] || null,
        };
      } catch (e) { results.test1_no_filter = { error: String(e) }; }

      // Test 2: Conditions with VendId=id
      try {
        const r2 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditions: `${field}=${vendorId}`,
        });
        const recs = r2.Response?.[0]?.TableInfo || [];
        const ctrl = r2.Response?.[0]?.TableControl?.[0];
        results.test2_conditions_eq = {
          filter: `${field}=${vendorId}`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r2.Error || null,
          sampleVendorId: recs[0] ? (recs[0] as Record<string, unknown>).VendId ?? (recs[0] as Record<string, unknown>).IDVend : null,
        };
      } catch (e) { results.test2_conditions_eq = { error: String(e) }; }

      // Test 3: ConditionsDirect with VendId=id
      try {
        const r3 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditionsDirect: `${field}=${vendorId}`,
        });
        const recs = r3.Response?.[0]?.TableInfo || [];
        const ctrl = r3.Response?.[0]?.TableControl?.[0];
        results.test3_conditionsDirect_eq = {
          filter: `${field}=${vendorId}`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r3.Error || null,
        };
      } catch (e) { results.test3_conditionsDirect_eq = { error: String(e) }; }

      // Test 4: Both Conditions AND ConditionsDirect
      try {
        const r4 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditions: `${field}=${vendorId}`,
          conditionsDirect: `${field}=${vendorId}`,
        });
        const recs = r4.Response?.[0]?.TableInfo || [];
        const ctrl = r4.Response?.[0]?.TableControl?.[0];
        results.test4_both = {
          filter: `${field}=${vendorId}`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r4.Error || null,
        };
      } catch (e) { results.test4_both = { error: String(e) }; }

      // Test 5: Conditions with IN syntax
      try {
        const r5 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditions: `${field} IN (${vendorId})`,
        });
        const recs = r5.Response?.[0]?.TableInfo || [];
        const ctrl = r5.Response?.[0]?.TableControl?.[0];
        results.test5_conditions_in = {
          filter: `${field} IN (${vendorId})`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r5.Error || null,
        };
      } catch (e) { results.test5_conditions_in = { error: String(e) }; }

      // Test 6: ConditionsDirect with IN syntax
      try {
        const r6 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditionsDirect: `${field} IN (${vendorId})`,
        });
        const recs = r6.Response?.[0]?.TableInfo || [];
        const ctrl = r6.Response?.[0]?.TableControl?.[0];
        results.test6_conditionsDirect_in = {
          filter: `${field} IN (${vendorId})`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r6.Error || null,
        };
      } catch (e) { results.test6_conditionsDirect_in = { error: String(e) }; }

      // Test 7: Try IDVend instead of VendId
      try {
        const altField = field.replace("VendId", "IDVend");
        const r7 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 1,
          itemsForPage: 5,
          conditions: `${altField}=${vendorId}`,
        });
        const recs = r7.Response?.[0]?.TableInfo || [];
        const ctrl = r7.Response?.[0]?.TableControl?.[0];
        results.test7_IDVend_conditions = {
          filter: `${altField}=${vendorId}`,
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          error: r7.Error || null,
        };
      } catch (e) { results.test7_IDVend_conditions = { error: String(e) }; }

      // Test 8: Page 2 of no-filter to check pagination works
      try {
        const r8 = await client.readReport({
          keyCode: config.report_keycode_all,
          pageRequested: 2,
          itemsForPage: 100,
        });
        const recs = r8.Response?.[0]?.TableInfo || [];
        const ctrl = r8.Response?.[0]?.TableControl?.[0];
        results.test8_page2_no_filter = {
          records: recs.length,
          maxRecords: ctrl?.MaxRecords || 0,
          pages: ctrl?.Pages || 0,
          currentPage: ctrl?.Page || 0,
        };
      } catch (e) { results.test8_page2_no_filter = { error: String(e) }; }

      return jsonResponse(200, { ok: true, diagnostics: results });
    }

    switch (action) {
      case "dashboard":
        return await handleDashboard(client, config, mapping, {
          fechaDesde: body.fechaDesde,
          fechaHasta: body.fechaHasta,
          type: body.type,
          status: body.status,
          ramo: body.ramo,
          subramo: body.subramo,
          aseguradora: body.aseguradora,
          cliente: body.cliente,
          moneda: body.moneda,
          agente: body.agente,
          formaPago: body.formaPago,
          search: body.search,
        });

      case "summary":
        return await handleSummary(client, config, mapping);

      case "documents":
        return await handleDocuments(client, config, mapping, {
          page: body.page,
          pageSize: body.pageSize,
          type: body.type,
          search: body.search,
          sortField: body.sortField,
          sortDirection: body.sortDirection,
          status: body.status,
          ramo: body.ramo,
          aseguradora: body.aseguradora,
          fechaDesde: body.fechaDesde,
          fechaHasta: body.fechaHasta,
        });

      case "detail": {
        if (!body.idDocto) {
          return jsonResponse(400, {
            ok: false,
            error: "Se requiere idDocto.",
            code: "MISSING_ID",
          });
        }
        return await handleDetail(client, config, mapping, {
          idDocto: body.idDocto,
        });
      }

      default:
        return jsonResponse(400, {
          ok: false,
          error: `Accion no valida: ${action}`,
          code: "INVALID_ACTION",
        });
    }
  } catch (error) {
    const normalized = normalizeError(error);
    console.error(`[SICASProd] ERROR: ${normalized.code} - ${normalized.message}`);
    return jsonResponse(500, {
      ok: false,
      error: normalized.userMessage,
      code: normalized.code,
    });
  }
});
