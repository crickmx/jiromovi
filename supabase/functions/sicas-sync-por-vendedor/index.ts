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

const VENDORS_PER_BATCH = 30;
const PARALLEL_VENDORS = 6;
const ITEMS_PER_PAGE = 100;
const MAX_PAGES_PER_VENDOR = 20;
const UPSERT_BATCH_SIZE = 500;
const CURSOR_MODULE = "documents_by_vendor";
const CURSOR_KEYCODE = "HWS_DOCTOS";
const MAX_EXECUTION_MS = 50_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || "continue";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // === MUTEX: prevent overlapping sync jobs ===
    const jobId = crypto.randomUUID();
    const { data: runningJob } = await supabase
      .from("sicas_sync_jobs")
      .select("id, started_at")
      .eq("status", "running")
      .eq("job_type", "vendor_sync")
      .gt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .maybeSingle();

    if (runningJob) {
      return jsonResponse(409, {
        ok: false,
        error: "Ya hay una sincronizacion de vendedores en curso",
        running_since: runningJob.started_at,
      });
    }

    await supabase.from("sicas_sync_jobs").insert({
      id: jobId,
      job_type: "vendor_sync",
      status: "running",
      started_at: new Date().toISOString(),
      metadata: { mode, batch_size: VENDORS_PER_BATCH, parallel: PARALLEL_VENDORS },
    });

    try {
      const result = await runVendorSync(supabase, mode, startTime);

      await supabase.from("sicas_sync_jobs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        metadata: { ...result, duration_ms: Date.now() - startTime },
      }).eq("id", jobId);

      return jsonResponse(200, result);
    } catch (err) {
      await supabase.from("sicas_sync_jobs").update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      }).eq("id", jobId);
      throw err;
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[VENDOR-SYNC] FATAL ERROR: ${(error as Error).message}`);

    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
      filterWorking: false,
      durationMs,
    });
  }
});

async function runVendorSync(
  supabase: ReturnType<typeof createClient>,
  mode: string,
  startTime: number,
) {
  const { data: configRow } = await supabase
    .from("sicas_production_config")
    .select("*")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

  const keycode = configRow?.report_keycode_all || "HWS_DOCTOS";

  // 1. Load all vendors from catalog
  const { data: allVendors, error: vendErr } = await supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre")
    .eq("catalog_type_id", 32)
    .order("id_sicas", { ascending: true });

  if (vendErr || !allVendors || allVendors.length === 0) {
    return {
      ok: false,
      error: "No se encontraron vendedores en sicas_catalogos (type 32)",
      vendorCount: 0,
    };
  }

  console.log(`[VENDOR-SYNC] Total vendedores en catalogo: ${allVendors.length}`);

  // 2. Read cursor
  const { data: cursor } = await supabase
    .from("sicas_sync_cursors")
    .select("*")
    .eq("module", CURSOR_MODULE)
    .eq("keycode", CURSOR_KEYCODE)
    .maybeSingle();

  let lastVendorId = "";
  if (mode === "full") {
    lastVendorId = "";
    console.log(`[VENDOR-SYNC] Modo FULL: reiniciando desde el primer vendedor`);
  } else if (cursor?.last_cursor_date) {
    lastVendorId = cursor.last_cursor_date || "";
    console.log(`[VENDOR-SYNC] Modo CONTINUE: retomando despues de vendedor ${lastVendorId}`);
  }

  // 3. Find vendors to process in this batch
  const startIdx = lastVendorId
    ? allVendors.findIndex((v) => String(v.id_sicas) === lastVendorId) + 1
    : 0;

  if (startIdx >= allVendors.length) {
    return {
      ok: true,
      isComplete: true,
      filterWorking: null,
      message: "Todos los vendedores ya fueron procesados. Usa mode=full para reiniciar.",
      stats: {
        totalVendors: allVendors.length,
        totalSynced: cursor?.total_synced || 0,
      },
    };
  }

  const vendorBatch = allVendors.slice(startIdx, startIdx + VENDORS_PER_BATCH);
  console.log(`[VENDOR-SYNC] Procesando vendedores ${startIdx + 1}-${startIdx + vendorBatch.length} de ${allVendors.length}`);

  // 4. Get baseline (quick single page to detect filter effectiveness)
  const client = await createSicasRestClientWithDbAuth();

  let baselineIds = new Set<string>();
  let baselineCount = 0;
  try {
    const baselineResp = await client.readReport({
      keyCode: keycode,
      pageRequested: 1,
      itemsForPage: ITEMS_PER_PAGE,
      sortFields: "Documento",
    });
    const baseRecords = baselineResp.Response?.[0]?.TableInfo || [];
    for (const r of baseRecords) {
      const id = r.IDDocto || r.IdDocto || r.iddocto;
      if (id) baselineIds.add(String(id));
    }
    baselineCount = baselineIds.size;
    console.log(`[VENDOR-SYNC] Baseline sin filtro: ${baselineCount} IDs`);
  } catch (err) {
    console.warn(`[VENDOR-SYNC] Error obteniendo baseline: ${(err as Error).message}`);
  }

  // 5. Load mapping helpers ONCE (cached for entire batch)
  const [despachoNameToOffice, vendorMaps] = await Promise.all([
    loadDespachoNameMap(supabase),
    loadVendorMaps(supabase),
  ]);
  const { vendorToUser, vendorToOficina } = vendorMaps;

  // 6. Process vendors in PARALLEL chunks
  let filterWorking: boolean | null = null;
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalErrors = 0;
  let vendorsProcessed = 0;
  let vendorsWithData = 0;
  let newDocsFound = 0;
  const allDocIds = new Set<string>();
  const vendorResults: Array<{
    id_sicas: string;
    nombre: string;
    records: number;
    newRecords: number;
    pages: number;
  }> = [];

  // Process in parallel chunks of PARALLEL_VENDORS
  for (let chunkStart = 0; chunkStart < vendorBatch.length; chunkStart += PARALLEL_VENDORS) {
    // Check time budget
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      console.log(`[VENDOR-SYNC] Tiempo maximo alcanzado, deteniendo en chunk ${chunkStart}`);
      break;
    }

    const chunk = vendorBatch.slice(chunkStart, chunkStart + PARALLEL_VENDORS);

    // Renew token before each parallel chunk
    try {
      await client.getValidToken();
    } catch (e) {
      console.warn(`[VENDOR-SYNC] Token renewal warning: ${(e as Error).message}`);
    }

    // Process all vendors in this chunk concurrently
    const chunkResults = await Promise.allSettled(
      chunk.map((vendor) =>
        processVendor(client, vendor, keycode, baselineIds)
      )
    );

    // Collect all documents from this chunk for batch upsert
    const allChunkDocs: Record<string, unknown>[] = [];

    for (let i = 0; i < chunkResults.length; i++) {
      const result = chunkResults[i];
      const vendor = chunk[i];
      const vendorId = String(vendor.id_sicas);

      if (result.status === "fulfilled") {
        const { records, newRecords, pages, docIds, rawRecords } = result.value;
        totalFetched += records;
        newDocsFound += newRecords;
        vendorsProcessed++;
        if (records > 0) vendorsWithData++;

        for (const id of docIds) allDocIds.add(id);

        // Map all raw records to documents
        for (const raw of rawRecords) {
          const doc = mapDocument(raw, keycode, despachoNameToOffice, vendorToUser, vendorToOficina);
          if (doc && doc.id_docto) allChunkDocs.push(doc);
        }

        vendorResults.push({
          id_sicas: vendorId,
          nombre: vendor.nombre || "",
          records,
          newRecords,
          pages,
        });

        console.log(
          `[VENDOR-SYNC] Vendor ${vendorId} (${vendor.nombre}): ${records} records, ${newRecords} new, ${pages} pages`
        );
      } else {
        console.error(`[VENDOR-SYNC] Error vendor ${vendorId}: ${result.reason}`);
        totalErrors++;
        vendorsProcessed++;
        vendorResults.push({
          id_sicas: vendorId,
          nombre: vendor.nombre || "",
          records: 0,
          newRecords: 0,
          pages: 0,
        });
      }
    }

    // Batch upsert all documents from this chunk at once
    if (allChunkDocs.length > 0) {
      const { upserted, errors } = await upsertDocumentsParallel(supabase, allChunkDocs);
      totalUpserted += upserted;
      totalErrors += errors;
    }

    // Detect if filter is working after processing a few vendors
    if (filterWorking === null && vendorsProcessed >= 5) {
      if (allDocIds.size > baselineCount && newDocsFound > 0) {
        filterWorking = true;
      } else if (newDocsFound === 0 && allDocIds.size <= baselineCount) {
        filterWorking = false;
      }
    }
  }

  if (filterWorking === null) {
    filterWorking = newDocsFound > 0 && allDocIds.size > baselineCount;
  }

  // 7. Update cursor
  const lastProcessedVendor = vendorBatch[Math.min(vendorsProcessed - 1, vendorBatch.length - 1)];
  const isComplete = startIdx + vendorsProcessed >= allVendors.length;
  const previousSynced = cursor?.total_synced || 0;
  const accumulatedSynced = previousSynced + totalUpserted;

  await supabase.from("sicas_sync_cursors").upsert(
    {
      module: CURSOR_MODULE,
      keycode: CURSOR_KEYCODE,
      last_page: startIdx + vendorsProcessed,
      total_pages: allVendors.length,
      is_complete: isComplete,
      total_synced: accumulatedSynced,
      last_success_at: new Date().toISOString(),
      last_cursor_date: String(lastProcessedVendor.id_sicas),
      last_run_id: null,
    },
    { onConflict: "module,keycode" }
  );

  const durationMs = Date.now() - startTime;
  const progressPercent = Math.round(
    ((startIdx + vendorsProcessed) / allVendors.length) * 100
  );

  console.log(`[VENDOR-SYNC] ========== BATCH COMPLETE ==========`);
  console.log(`[VENDOR-SYNC] Vendors: ${vendorsProcessed}, WithData: ${vendorsWithData}`);
  console.log(`[VENDOR-SYNC] Fetched: ${totalFetched}, Upserted: ${totalUpserted}, NewDocs: ${newDocsFound}`);
  console.log(`[VENDOR-SYNC] FilterWorking: ${filterWorking}, Duration: ${durationMs}ms`);

  return {
    ok: true,
    isComplete,
    filterWorking,
    progress: {
      vendorsProcessed,
      vendorsWithData,
      vendorsTotal: allVendors.length,
      vendorStart: startIdx + 1,
      vendorEnd: startIdx + vendorsProcessed,
      percent: progressPercent,
    },
    stats: {
      baselineCount,
      totalUniqueDocIds: allDocIds.size,
      newDocsFound,
      totalFetched,
      totalUpserted,
      totalErrors,
      accumulatedSynced,
      durationMs,
    },
    vendorResults: vendorResults.slice(0, 10),
  };
}

// Process a single vendor's data from SICAS (API calls only, no DB writes)
async function processVendor(
  client: Awaited<ReturnType<typeof createSicasRestClientWithDbAuth>>,
  vendor: { id_sicas: string | number; nombre: string },
  keycode: string,
  baselineIds: Set<string>,
): Promise<{
  records: number;
  newRecords: number;
  pages: number;
  docIds: string[];
  rawRecords: Record<string, unknown>[];
}> {
  const vendorId = String(vendor.id_sicas);
  const conditions = `;0;0;${vendorId};Vendedor;0;0;DatDocumentos.IDVend`;

  let records = 0;
  let newRecords = 0;
  let pages = 0;
  const docIds: string[] = [];
  const rawRecords: Record<string, unknown>[] = [];

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES_PER_VENDOR) {
    const resp = await client.readReport({
      keyCode: keycode,
      pageRequested: page,
      itemsForPage: ITEMS_PER_PAGE,
      sortFields: "Documento",
      conditions,
    });

    const pageRecords = resp.Response?.[0]?.TableInfo || [];
    const control = resp.Response?.[1]?.TableControl?.[0]
      || resp.Response?.[0]?.TableControl?.[0];

    if (page === 1 && control) {
      totalPages = control.Pages || 1;
    }

    if (pageRecords.length === 0) break;

    records += pageRecords.length;
    pages++;

    for (const r of pageRecords) {
      const id = r.IDDocto || r.IdDocto || r.iddocto;
      if (id) {
        const idStr = String(id);
        docIds.push(idStr);
        if (!baselineIds.has(idStr)) {
          newRecords++;
        }
      }
      rawRecords.push(r);
    }

    page++;
  }

  return { records, newRecords, pages, docIds, rawRecords };
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

  const catalogs = catalogsR.data || [];
  const mappings = mappingsR.data || [];

  if (catalogs.length === 0) return map;

  const despIdToOficina = new Map<string, string>();
  for (const m of mappings) {
    despIdToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
  }

  for (const cat of catalogs) {
    const oficinaId = despIdToOficina.get(String(cat.id_sicas));
    if (oficinaId) {
      const normalizedName = String(cat.nombre).toUpperCase().trim();
      map.set(normalizedName, { oficina_id: oficinaId, desp_id: String(cat.id_sicas) });
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
    supabase.from("sicas_mapeo_vendedor_usuario").select("id_sicas_vendedor, movi_user_id"),
    supabase.from("usuarios").select("id, id_sicas, oficina_id").not("id_sicas", "is", null),
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
  vendorToOficina: Map<string, string>,
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
    V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente",
  };
  const statusNumMap: Record<string, string> = {
    "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente",
  };
  const statusTexto = statusTxt || statusLetterMap[statusRaw] || statusNumMap[statusRaw] || statusRaw || "";

  const tipoDoc = get(["TipoDocto_TXT", "TipoDocto", "Tipo"]);
  const subtipoDoc = get(["SubTipoDocto_TXT", "SubTipoDocto"]);
  const tipoLower = tipoDoc.toLowerCase();
  const isPoliza = tipoLower.includes("poliza") || tipoLower.includes("póliza") ||
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
    } catch { /* ignore */ }
  }
  const isCancelada = statusTexto.toLowerCase() === "cancelada";
  const isRenewable = isVigente && renewalDays !== null && renewalDays >= 0 && renewalDays <= 90;

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
    is_cancelada: isCancelada,
    is_renewable: isRenewable,
    renewal_days_remaining: renewalDays,
    source_keycode: keycode,
    synced_at: new Date().toISOString(),
  };
}

async function upsertDocumentsParallel(
  supabase: ReturnType<typeof createClient>,
  documents: Record<string, unknown>[],
): Promise<{ upserted: number; errors: number }> {
  const validDocs = documents.filter((d) => d !== null && d.id_docto);
  if (validDocs.length === 0) return { upserted: 0, errors: 0 };

  let totalUpserted = 0;
  let totalErrors = 0;

  // Split into batches and run up to 3 upserts in parallel
  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < validDocs.length; i += UPSERT_BATCH_SIZE) {
    batches.push(validDocs.slice(i, i + UPSERT_BATCH_SIZE));
  }

  const PARALLEL_UPSERTS = 3;
  for (let i = 0; i < batches.length; i += PARALLEL_UPSERTS) {
    const upsertChunk = batches.slice(i, i + PARALLEL_UPSERTS);

    const results = await Promise.allSettled(
      upsertChunk.map(async (batch) => {
        const { error: upsertError, data: upserted } = await supabase
          .from("sicas_documents")
          .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
          .select("id");

        if (upsertError) {
          console.error(`[VENDOR-SYNC] Upsert error: ${upsertError.message}`);
          return { upserted: 0, errors: batch.length };
        }
        return { upserted: upserted?.length || batch.length, errors: 0 };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        totalUpserted += r.value.upserted;
        totalErrors += r.value.errors;
      } else {
        totalErrors += UPSERT_BATCH_SIZE;
      }
    }
  }

  return { upserted: totalUpserted, errors: totalErrors };
}
