import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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

const VENDORS_PER_BATCH = 30;
const ITEMS_PER_PAGE = 100;
const MAX_PAGES_PER_VENDOR = 20;
const CURSOR_MODULE = "documents_by_vendor";
const CURSOR_KEYCODE = "HWS_DOCTOS";

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
      return jsonResponse(400, {
        ok: false,
        error: "No se encontraron vendedores en sicas_catalogos (type 32)",
        vendorCount: 0,
      });
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
      return jsonResponse(200, {
        ok: true,
        isComplete: true,
        filterWorking: null,
        message: "Todos los vendedores ya fueron procesados. Usa mode=full para reiniciar.",
        stats: {
          totalVendors: allVendors.length,
          totalSynced: cursor?.total_synced || 0,
        },
      });
    }

    const vendorBatch = allVendors.slice(startIdx, startIdx + VENDORS_PER_BATCH);
    console.log(`[VENDOR-SYNC] Procesando vendedores ${startIdx + 1}-${startIdx + vendorBatch.length} de ${allVendors.length}`);

    // 4. Get baseline: call without filter to know the "default" IDs
    const client = new SicasRestClient({
      baseUrl: Deno.env.get("SICAS_REST_API_URL") || undefined,
      username: Deno.env.get("SICAS_USERNAME") || undefined,
      password: Deno.env.get("SICAS_PASSWORD") || undefined,
      sCodeAuth: Deno.env.get("SICAS_CODE_AUTH") || undefined,
    });

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

    // 5. Load mapping helpers
    const despachoNameToOffice = await loadDespachoNameMap(supabase);
    const { vendorToUser, vendorToOficina } = await loadVendorMaps(supabase);

    // 6. Process each vendor
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

    for (const vendor of vendorBatch) {
      const vendorId = String(vendor.id_sicas);
      const conditions = `;0;0;${vendorId};Vendedor;0;0;DatDocumentos.IDVend`;

      let vendorRecordCount = 0;
      let vendorNewRecords = 0;
      let vendorPages = 0;

      try {
        // Renew token periodically
        if (vendorsProcessed > 0 && vendorsProcessed % 5 === 0) {
          try {
            await client.getValidToken();
          } catch (e) {
            console.warn(`[VENDOR-SYNC] Token renewal warning: ${(e as Error).message}`);
          }
        }

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

          const records = resp.Response?.[0]?.TableInfo || [];
          const control = resp.Response?.[1]?.TableControl?.[0]
            || resp.Response?.[0]?.TableControl?.[0];

          if (page === 1 && control) {
            totalPages = control.Pages || 1;
          }

          if (records.length === 0) break;

          vendorRecordCount += records.length;
          totalFetched += records.length;
          vendorPages++;

          // Check if these are different from baseline
          for (const r of records) {
            const id = r.IDDocto || r.IdDocto || r.iddocto;
            if (id) {
              const idStr = String(id);
              allDocIds.add(idStr);
              if (!baselineIds.has(idStr)) {
                vendorNewRecords++;
                newDocsFound++;
              }
            }
          }

          // Map and upsert documents
          const documents = records
            .map((raw: Record<string, unknown>) =>
              mapDocument(raw, keycode, despachoNameToOffice, vendorToUser, vendorToOficina)
            )
            .filter((d: any) => d !== null && d?.id_docto);

          if (documents.length > 0) {
            const { upserted, errors } = await upsertDocuments(supabase, documents);
            totalUpserted += upserted;
            totalErrors += errors;
          }

          page++;
        }

        if (vendorRecordCount > 0) vendorsWithData++;

        // Detect if filter is working
        if (filterWorking === null && vendorsProcessed >= 2) {
          if (allDocIds.size > baselineCount && newDocsFound > 0) {
            filterWorking = true;
          } else if (vendorsProcessed >= 5 && newDocsFound === 0 && allDocIds.size <= baselineCount) {
            filterWorking = false;
          }
        }
      } catch (err) {
        console.error(`[VENDOR-SYNC] Error vendor ${vendorId}: ${(err as Error).message}`);
        totalErrors++;
      }

      vendorsProcessed++;
      vendorResults.push({
        id_sicas: vendorId,
        nombre: vendor.nombre || "",
        records: vendorRecordCount,
        newRecords: vendorNewRecords,
        pages: vendorPages,
      });

      console.log(
        `[VENDOR-SYNC] Vendor ${vendorId} (${vendor.nombre}): ${vendorRecordCount} records, ${vendorNewRecords} new, ${vendorPages} pages`
      );
    }

    // If we still haven't determined, make final assessment
    if (filterWorking === null) {
      filterWorking = newDocsFound > 0 && allDocIds.size > baselineCount;
    }

    // 7. Update cursor
    const lastProcessedVendor = vendorBatch[vendorBatch.length - 1];
    const isComplete = startIdx + vendorBatch.length >= allVendors.length;
    const previousSynced = cursor?.total_synced || 0;
    const accumulatedSynced = previousSynced + totalUpserted;

    await supabase.from("sicas_sync_cursors").upsert(
      {
        module: CURSOR_MODULE,
        keycode: CURSOR_KEYCODE,
        last_page: startIdx + vendorBatch.length,
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
      ((startIdx + vendorBatch.length) / allVendors.length) * 100
    );

    console.log(`[VENDOR-SYNC] ========== BATCH COMPLETE ==========`);
    console.log(`[VENDOR-SYNC] Vendors: ${vendorsProcessed}, WithData: ${vendorsWithData}`);
    console.log(`[VENDOR-SYNC] Fetched: ${totalFetched}, Upserted: ${totalUpserted}, NewDocs: ${newDocsFound}`);
    console.log(`[VENDOR-SYNC] FilterWorking: ${filterWorking}, Duration: ${durationMs}ms`);

    return jsonResponse(200, {
      ok: true,
      isComplete,
      filterWorking,
      progress: {
        vendorsProcessed,
        vendorsWithData,
        vendorsTotal: allVendors.length,
        vendorStart: startIdx + 1,
        vendorEnd: startIdx + vendorBatch.length,
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
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[VENDOR-SYNC] FATAL ERROR: ${(error as Error).message}`);
    console.error(`[VENDOR-SYNC] Stack: ${(error as Error).stack}`);

    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
      filterWorking: false,
      durationMs,
    });
  }
});

// ===== Helper functions (duplicated from sicas-sync-local-documents, no cross-deps) =====

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
    raw_data: raw,
    raw_hash: JSON.stringify(raw),
    synced_at: new Date().toISOString(),
  };
}

async function upsertDocuments(
  supabase: ReturnType<typeof createClient>,
  documents: Record<string, unknown>[],
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
      console.error(`[VENDOR-SYNC] Upsert error: ${upsertError.message}`);
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
      console.error(`[VENDOR-SYNC] sicas_polizas_vigentes error: ${error.message}`);
    }
  }

  return { upserted: totalUpserted, errors: totalErrors };
}
