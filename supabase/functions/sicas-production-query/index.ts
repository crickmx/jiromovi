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
      report_filter_field: "DatDocumentos.IDVend",
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

function buildConditions(
  config: ProductionConfig,
  mapping: UserMapping,
  params: DocumentsRequest
): string {
  const parts: string[] = [];

  parts.push(`${config.report_filter_field}=${mapping.sicas_vendor_id}`);

  if (params.status) {
    const statusMap: Record<string, string> = {
      vigente: "V",
      cancelada: "C",
      vencida: "X",
    };
    const val = statusMap[params.status.toLowerCase()] || params.status;
    parts.push(`DatDocumentos.Estatus=${val}`);
  }

  if (params.search) {
    const s = params.search.replace(/'/g, "");
    parts.push(
      `(DatDocumentos.Documento LIKE '%${s}%' OR DatDocumentos.NombreCompleto LIKE '%${s}%')`
    );
  }

  if (params.fechaDesde) {
    parts.push(`DatDocumentos.FDesde>=${params.fechaDesde}`);
  }
  if (params.fechaHasta) {
    parts.push(`DatDocumentos.FHasta<=${params.fechaHasta}`);
  }

  if (params.ramo) {
    parts.push(`DatDocumentos.Ramo LIKE '%${params.ramo.replace(/'/g, "")}%'`);
  }
  if (params.aseguradora) {
    parts.push(
      `DatDocumentos.Abreviacion LIKE '%${params.aseguradora.replace(/'/g, "")}%'`
    );
  }

  return parts.join(" AND ");
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

  const statusRaw = str(["Estatus", "Status", "StatusDoc"]);
  const statusMap: Record<string, string> = {
    V: "Vigente",
    C: "Cancelada",
    X: "Vencida",
    N: "No Vigente",
    P: "Pendiente",
  };

  return {
    idDocto: get(["IDDocto", "IdDocto", "Id_Docto", "iddocto"]),
    documento: str(["Documento", "NoDocumento", "No_Documento"]),
    tipo: str(["TipoDocto_TXT", "TipoDocto", "Tipo"]),
    subtipo: str(["SubTipoDocto_TXT", "SubTipoDocto"]),
    ramo: str(["Ramo", "Ramo_TXT", "NombreRamo"]),
    subramo: str(["SubRamo", "SubRamo_TXT", "NombreSubRamo"]),
    aseguradora: str(["Abreviacion", "Cia", "Aseguradora", "Compania"]),
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
    status: statusMap[statusRaw] || statusRaw || "Desconocido",
    statusRaw,
    statusCobro: str(["StatusCobro", "Status_Cobro", "EstatusCobro"]),
    vendedor: str(["Vendedor", "VendNombre", "Vend_Nombre"]),
    vendedorId: str(["IDVend", "VendId", "Vend_Id"]),
    agente: str(["Agente", "AgenteNombre", "NombreAgente"]),
    agenteId: str(["IDAgente", "AgenteId"]),
    raw,
  };
}

// ─── Action: documents ───────────────────────────────────────────────────────

async function handleDocuments(
  client: SicasRestClient,
  config: ProductionConfig,
  mapping: UserMapping,
  params: DocumentsRequest
): Promise<Response> {
  const startTime = Date.now();
  const pageSize = Math.min(
    params.pageSize || config.default_page_size,
    100
  );
  const page = params.page || 1;
  const keyCode = selectKeyCode(config, params.type || "all");
  const conditions = buildConditions(config, mapping, params);

  const sortField = params.sortField || "DatDocumentos.FDesde";
  const sortDir = (params.sortDirection || "desc").toUpperCase();

  console.log(
    `[SICASProd] documents keyCode=${keyCode} page=${page} pageSize=${pageSize}`
  );
  console.log(`[SICASProd] conditions: ${conditions}`);

  const response = await client.readReport({
    keyCode,
    pageRequested: page,
    itemsForPage: pageSize,
    sortFields: `${sortField} ${sortDir}`,
    conditions,
    fieldsRequested: config.fields_requested_list || undefined,
  });

  const records = response.Response?.[0]?.TableInfo || [];
  const control = response.Response?.[0]?.TableControl?.[0];
  const items = records.map(normalizeRecord);

  const duration = Date.now() - startTime;
  console.log(
    `[SICASProd] documents returned ${items.length} records in ${duration}ms`
  );

  return jsonResponse(200, {
    ok: true,
    items,
    pagination: {
      page: control?.Page || page,
      pageSize: control?.ItemForPage || pageSize,
      pages: control?.Pages || 1,
      maxRecords: control?.MaxRecords || items.length,
    },
    meta: {
      keyCode,
      duration,
      filtersApplied: conditions,
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
  const conditions = `${config.report_filter_field}=${mapping.sicas_vendor_id}`;

  console.log(`[SICASProd] summary for vendorId=${mapping.sicas_vendor_id}`);

  const response = await client.readReport({
    keyCode: config.report_keycode_all,
    pageRequested: 1,
    itemsForPage: 500,
    conditions,
  });

  const records = response.Response?.[0]?.TableInfo || [];
  const control = response.Response?.[0]?.TableControl?.[0];
  const normalized = records.map(normalizeRecord);
  const totalFromControl = control?.MaxRecords || normalized.length;

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
    if (st === "V") vigentes++;
    else if (st === "X" || st === "N") vencidas++;
    else if (st === "C") canceladas++;

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
  console.log(
    `[SICASProd] summary computed from ${normalized.length} records (total=${totalFromControl}) in ${duration}ms`
  );

  return jsonResponse(200, {
    ok: true,
    summary: {
      totalDocumentos: totalFromControl,
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
    meta: { duration, recordsAnalyzed: normalized.length, totalInSicas: totalFromControl },
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

  console.log(
    `[SICASProd] detail idDocto=${idDocto} user=${mapping.usuario_id}`
  );

  // Ownership validation: query user's documents with this ID
  const ownershipConditions = `${config.report_filter_field}=${mapping.sicas_vendor_id} AND DatDocumentos.IDDocto=${idDocto}`;

  const checkResponse = await client.readReport({
    keyCode: config.report_keycode_all,
    pageRequested: 1,
    itemsForPage: 1,
    conditions: ownershipConditions,
  });

  const checkRecords = checkResponse.Response?.[0]?.TableInfo || [];
  if (checkRecords.length === 0) {
    console.log(
      `[SICASProd] detail DENIED: idDocto=${idDocto} not found for vendor=${mapping.sicas_vendor_id}`
    );
    return jsonResponse(403, {
      ok: false,
      error: "No tienes permiso para consultar este documento.",
      code: "DOCUMENT_NOT_OWNED",
    });
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
    console.warn(
      `[SICASProd] detail /Data/ReadData failed, using list record. Error: ${detailError}`
    );
    document.raw = { listRecord: checkRecords[0], detailError: String(detailError) };
  }

  const duration = Date.now() - startTime;
  console.log(`[SICASProd] detail returned in ${duration}ms`);

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

  const { data: oficinas } = await supabase
    .from("oficinas")
    .select("id, nombre")
    .eq("activa", true);

  const oficinasMap: Record<string, string> = {};
  for (const o of oficinas || []) {
    oficinasMap[o.id] = o.nombre;
  }

  const mapped = (usuarios || []).map((u: Record<string, unknown>) => ({
    id: u.id,
    nombre: u.nombre,
    apellidos: u.apellidos,
    email: u.email_laboral,
    rol: u.rol,
    oficina: u.oficina_id ? oficinasMap[u.oficina_id as string] || null : null,
    oficina_id: u.oficina_id,
    id_sicas: u.id_sicas || null,
    nombre_sicas: u.nombre_sicas || null,
    has_mapping: !!u.id_sicas,
  }));

  return jsonResponse(200, { ok: true, users: mapped });
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
  targetUserId: string
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

  console.log(`[SICASProd] unmap-user: ${targetUserId} unlinked`);

  return jsonResponse(200, { ok: true, message: "Vinculo eliminado." });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();
  return data?.rol === "Administrador";
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

    console.log(
      `[SICASProd] action=${action} userId=${user.id}`
    );

    // Admin-only actions (no SICAS mapping needed)
    if (action === "list-users" || action === "list-vendors" || action === "map-user" || action === "unmap-user") {
      const isAdmin = await requireAdmin(supabase, user.id);
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
          return await handleUnmapUser(supabase, body.targetUserId);
      }
    }

    // Resolve user's SICAS mapping
    const mapping = await resolveUserMapping(supabase, user.id);
    if (!mapping) {
      return jsonResponse(200, {
        ok: false,
        error: "Tu cuenta aun no tiene un vinculo activo con SICAS.",
        code: "NO_MAPPING",
        noMapping: true,
      });
    }

    console.log(
      `[SICASProd] mapping resolved: vendorId=${mapping.sicas_vendor_id} rol=${mapping.rol}`
    );

    // Load config
    const config = await getConfig(supabase);

    // Create REST client
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

    switch (action) {
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

      case "detail":
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
