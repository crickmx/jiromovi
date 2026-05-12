import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasSoapReportClient } from "../_shared/sicasSoapReportClient.ts";

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

const PAGES_PER_BATCH = 5;
const ITEMS_PER_PAGE = 100;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || body.action || "continue";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variables de entorno de Supabase no configuradas");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: configRow } = await supabase
      .from("sicas_production_config")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    const keycode = configRow?.report_keycode_all || "HWS_DOCTOS";

    // Read cursor to know where we left off
    const { data: cursor } = await supabase
      .from("sicas_sync_cursors")
      .select("*")
      .eq("module", "documents")
      .eq("keycode", keycode)
      .maybeSingle();

    let startPage = 1;
    let knownTotalPages: number | null = null;

    if (mode === "full") {
      startPage = 1;
      console.log(`[SYNC] Modo FULL: reiniciando desde pagina 1`);
    } else {
      if (cursor && !cursor.is_complete && cursor.last_page) {
        startPage = cursor.last_page + 1;
        knownTotalPages = cursor.total_pages || null;
        console.log(`[SYNC] Modo CONTINUE: retomando desde pagina ${startPage}, totalPages conocido: ${knownTotalPages}`);
      } else if (cursor?.is_complete) {
        return jsonResponse(200, {
          ok: true,
          isComplete: true,
          message: "Sincronizacion ya completa. Usa mode=full para reiniciar.",
          stats: {
            totalSynced: cursor.total_synced || 0,
            totalPages: cursor.total_pages || 0,
          },
        });
      }
    }

    console.log(`[SYNC] ========== BATCH SYNC (SOAP) ==========`);
    console.log(`[SYNC] Keycode: ${keycode}, StartPage: ${startPage}, PagesPerBatch: ${PAGES_PER_BATCH}`);

    // Create sync run
    const { data: run, error: runError } = await supabase
      .from("sicas_sync_runs")
      .insert({
        module: "documents",
        keycode,
        report_name: `Batch sync pages ${startPage}-${startPage + PAGES_PER_BATCH - 1} (SOAP)`,
        items_per_page: ITEMS_PER_PAGE,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) throw new Error(`Error creando sync run: ${runError.message}`);
    const runId = run.run_id;

    // Load despacho name -> office mapping
    const despachoNameToOffice = await loadDespachoNameMap(supabase);
    console.log(`[SYNC] Despacho name mappings loaded: ${despachoNameToOffice.size}`);

    // Load vendor -> user mappings
    const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);
    console.log(`[SYNC] Vendor mappings: ${vendorToUser.size} vendor->user, ${vendorToOficina.size} vendor->oficina`);

    // Get SICAS SOAP credentials
    const { data: sicasConfig } = await supabase
      .from("sicas_config")
      .select("endpoint, username, password")
      .limit(1)
      .maybeSingle();

    if (!sicasConfig?.endpoint || !sicasConfig?.username || !sicasConfig?.password) {
      throw new Error("SICAS no configurado: faltan credenciales SOAP en sicas_config");
    }

    const soapClient = new SicasSoapReportClient({
      endpoint: sicasConfig.endpoint,
      username: sicasConfig.username,
      password: sicasConfig.password,
    });

    let totalPages = knownTotalPages || 1;
    let totalInSicas = 0;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalErrors = 0;
    let lastPageProcessed = startPage - 1;
    let page = startPage;
    const endPage = startPage + PAGES_PER_BATCH - 1;

    while (page <= endPage) {
      if (totalPages > 0 && page > totalPages) break;

      let records: Record<string, unknown>[] = [];
      try {
        const result = await soapClient.executeReport({
          keyCode: keycode,
          page,
          itemsPerPage: ITEMS_PER_PAGE,
          sortFields: "Documento",
        });
        records = result.records || [];

        if (page === startPage && result.totalRecords) {
          totalInSicas = result.totalRecords;
          totalPages = Math.ceil(totalInSicas / ITEMS_PER_PAGE);
          console.log(`[SYNC] SICAS SOAP reports: totalRecords=${totalInSicas}, estimatedPages=${totalPages}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SYNC] ERROR page ${page}: ${msg}`);
        totalErrors++;
        if (totalErrors >= 3) {
          console.error(`[SYNC] Too many consecutive errors, stopping batch`);
          break;
        }
        page++;
        continue;
      }

      if (records.length === 0) {
        console.log(`[SYNC] Page ${page}: 0 records, end of data`);
        break;
      }

      totalFetched += records.length;

      const documents = records
        .map((raw: Record<string, unknown>) =>
          mapDocument(raw, keycode, despachoNameToOffice, vendorToUser, vendorToOficina)
        )
        .filter(Boolean);

      const { upserted, errors } = await upsertDocuments(supabase, documents);
      totalUpserted += upserted;
      totalErrors += errors;

      lastPageProcessed = page;
      console.log(`[SYNC] Page ${page}/${totalPages}: ${records.length} fetched, ${upserted} upserted (total: ${totalFetched}/${totalInSicas})`);

      // End-of-data detection
      if (records.length < ITEMS_PER_PAGE) {
        console.log(`[SYNC] Page ${page}: records (${records.length}) < ITEMS_PER_PAGE (${ITEMS_PER_PAGE}), marking complete`);
        break;
      }

      page++;
    }

    const isComplete = lastPageProcessed >= totalPages || (totalFetched > 0 && totalFetched < ITEMS_PER_PAGE);
    const previousSynced = (mode !== "full" && cursor?.total_synced) ? cursor.total_synced : 0;
    const accumulatedSynced = previousSynced + totalUpserted;

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
        last_run_id: runId,
      },
      { onConflict: "module,keycode" }
    );

    const durationMs = Date.now() - startTime;
    await supabase
      .from("sicas_sync_runs")
      .update({
        status: isComplete ? "completed" : "partial",
        records_fetched: totalFetched,
        records_upserted: totalUpserted,
        records_failed: totalErrors,
        pages_requested: lastPageProcessed - startPage + 1,
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
      })
      .eq("run_id", runId);

    const progressPercent = totalPages > 0
      ? Math.round((lastPageProcessed / totalPages) * 100)
      : 100;

    console.log(`[SYNC] ========== BATCH COMPLETE ==========`);
    console.log(`[SYNC] Pages ${startPage}-${lastPageProcessed}/${totalPages} (${progressPercent}%)`);
    console.log(`[SYNC] Fetched: ${totalFetched}, Upserted: ${totalUpserted}, Errors: ${totalErrors}`);
    console.log(`[SYNC] isComplete: ${isComplete}, Duration: ${durationMs}ms`);

    return jsonResponse(200, {
      ok: true,
      isComplete,
      nextPage: isComplete ? null : lastPageProcessed + 1,
      transport: "soap",
      progress: {
        currentPage: lastPageProcessed,
        totalPages,
        percent: progressPercent,
        totalInSicas,
        batchFetched: totalFetched,
        batchUpserted: totalUpserted,
        accumulatedSynced,
        errors: totalErrors,
      },
      stats: {
        recordsFetched: totalFetched,
        documentsUpserted: totalUpserted,
        pagesProcessed: lastPageProcessed - startPage + 1,
        totalInSicas,
        errors: totalErrors,
        durationMs,
        runId,
        keycode,
        startPage,
        endPage: lastPageProcessed,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[SYNC] FATAL ERROR: ${(error as Error).message}`);
    console.error(`[SYNC] Stack: ${(error as Error).stack}`);

    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
      durationMs,
    });
  }
});

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
  const statusLetterMap: Record<string, string> = { V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente" };
  const statusNumMap: Record<string, string> = { "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente" };
  const statusTexto = statusTxt || statusLetterMap[statusRaw] || statusNumMap[statusRaw] || statusRaw || "";

  const tipoDoc = get(["TipoDocto_TXT", "TipoDocto", "Tipo"]);
  const subtipoDoc = get(["SubTipoDocto_TXT", "SubTipoDocto"]);
  const tipoLower = tipoDoc.toLowerCase();
  const isPoliza = tipoLower.includes("poliza") || tipoLower.includes("póliza") || (!tipoLower.includes("fianza") && !tipoLower.includes("orden"));
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
    source_api: "soap",
    raw_data: raw,
    raw_hash: JSON.stringify(raw),
    synced_at: new Date().toISOString(),
  };
}

async function upsertDocuments(
  supabase: ReturnType<typeof createClient>,
  documents: (Record<string, unknown> | null)[],
): Promise<{ upserted: number; errors: number }> {
  const validDocs = documents.filter((d): d is Record<string, unknown> => d !== null && !!d.id_docto);
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
      console.error(`[SYNC] Upsert error: ${upsertError.message}`);
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
    const { error } = await supabase
      .from("sicas_polizas_vigentes")
      .upsert(batch, { onConflict: "id_documento", ignoreDuplicates: false });
    if (error) {
      console.error(`[SYNC] sicas_polizas_vigentes error: ${error.message}`);
    }
  }

  return { upserted: totalUpserted, errors: totalErrors };
}
