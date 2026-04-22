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

function parseSicasDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  // dd/mm/yyyy -> yyyy-mm-dd
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // yyyy-mm-dd already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "full";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load config
    const { data: configRow } = await supabase
      .from("sicas_production_config")
      .select("*")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();

    const keyCode = configRow?.report_keycode_all || "HWS_DOCTOS";
    const pageSize = 500;
    const maxPages = action === "incremental" ? 10 : 100;

    // Create sync run
    const { data: run, error: runErr } = await supabase
      .from("sicas_sync_runs")
      .insert({
        module: "documents",
        keycode: keyCode,
        report_name: action === "full" ? "Sync Completa" : "Sync Incremental",
        items_per_page: pageSize,
        status: "running",
      })
      .select()
      .single();

    if (runErr) throw runErr;
    const runId = run.run_id;
    console.log(`[SyncLocal] Run ${runId} creado, action=${action}, keyCode=${keyCode}`);

    // Init SICAS REST client
    const sicasUsername = Deno.env.get("SICAS_REST_USERNAME") || Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_REST_PASSWORD") || Deno.env.get("SICAS_PASSWORD");
    const sicasCodeAuth = Deno.env.get("SICAS_REST_CODEAUTH") || Deno.env.get("SICAS_CODEAUTH") || "";
    const sicasEndpoint =
      Deno.env.get("SICAS_REST_ENDPOINT") ||
      "https://security-services.sicasonline.info/api";

    if (!sicasUsername || !sicasPassword) {
      throw new Error("Credenciales SICAS no configuradas (SICAS_REST_USERNAME / SICAS_REST_PASSWORD)");
    }

    const client = new SicasRestClient({
      baseUrl: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
      codeAuth: sicasCodeAuth,
    });

    // Build date conditions for incremental
    let conditions = "";
    let conditionsDirect = "";
    if (action === "incremental") {
      const now = new Date();
      const from = new Date(now);
      from.setDate(now.getDate() - 30);
      const fmtDate = (d: Date) => `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
      conditionsDirect = `DatDocumentos.FCaptura >= '${fmtDate(from)}'`;
    }

    // Fetch all pages
    const allRecords: Record<string, unknown>[] = [];
    let page = 1;
    let totalInSicas = 0;

    while (page <= maxPages) {
      console.log(`[SyncLocal] Fetching page ${page}...`);

      const response = await client.readReport({
        keyCode,
        pageRequested: page,
        itemsForPage: pageSize,
        conditions: conditions || undefined,
        conditionsDirect: conditionsDirect || undefined,
        sortFields: "DatDocumentos.FDesde DESC",
      });

      const records = response.Response?.[0]?.TableInfo || [];
      const control = response.Response?.[0]?.TableControl?.[0];

      if (page === 1) {
        totalInSicas = control?.MaxRecords || records.length;
        const totalPages = control?.Pages || 1;
        console.log(`[SyncLocal] Total en SICAS: ${totalInSicas}, Pages: ${totalPages}`);
      }

      if (records.length === 0) {
        console.log("[SyncLocal] Pagina vacia, terminando paginacion");
        break;
      }

      allRecords.push(...records);

      const totalPages = control?.Pages || 1;
      if (page >= totalPages) {
        console.log("[SyncLocal] Ultima pagina alcanzada");
        break;
      }
      page++;
    }

    console.log(`[SyncLocal] Total registros: ${allRecords.length} en ${page} paginas`);

    // Load vendor/despacho mappings
    const [vendorMappingsR, despachoMappingsR] = await Promise.all([
      supabase.from("sicas_mapeo_vendedor_usuario").select("id_sicas_vendedor, movi_user_id"),
      supabase.from("sicas_mapeo_despacho_oficina").select("id_sicas_despacho, movi_oficina_id"),
    ]);

    const vendorToUser = new Map<string, string>();
    for (const m of vendorMappingsR.data || []) {
      vendorToUser.set(String(m.id_sicas_vendedor), m.movi_user_id);
    }

    // Also check usuarios.id_sicas
    const { data: usuariosConSicas } = await supabase
      .from("usuarios")
      .select("id, id_sicas, oficina_id")
      .not("id_sicas", "is", null)
      .neq("id_sicas", "");

    const userOficinaMap = new Map<string, string>();
    for (const u of usuariosConSicas || []) {
      if (u.id_sicas && !vendorToUser.has(u.id_sicas)) {
        vendorToUser.set(u.id_sicas, u.id);
      }
      if (u.oficina_id) userOficinaMap.set(u.id, u.oficina_id);
    }

    const despachoToOficina = new Map<string, string>();
    for (const m of despachoMappingsR.data || []) {
      despachoToOficina.set(String(m.id_sicas_despacho), m.movi_oficina_id);
    }

    console.log(`[SyncLocal] Mappings: ${vendorToUser.size} vendedores, ${despachoToOficina.size} despachos`);

    // Map records to sicas_documents schema
    let upsertedCount = 0;
    let errorCount = 0;

    if (allRecords.length > 0) {
      const str = (raw: Record<string, unknown>, keys: string[]): string => {
        for (const k of keys) {
          const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
          if (val !== undefined && val !== null && val !== "") return String(val);
        }
        return "";
      };
      const num = (raw: Record<string, unknown>, keys: string[]): number => {
        const v = str(raw, keys);
        if (!v) return 0;
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      const statusLetterMap: Record<string, string> = { V: "Vigente", C: "Cancelada", X: "Vencida", N: "No Vigente", P: "Pendiente" };
      const statusNumMap: Record<string, string> = { "1": "Vigente", "2": "Renovada", "3": "Cancelada", "4": "No Vigente", "5": "Pendiente" };

      const documents = allRecords.map((raw: any) => {
        const vendId = str(raw, ["IDVend", "VendId", "Vend_Id"]) || "0";
        const despId = str(raw, ["IDDesp", "DespId"]) || "0";
        const userId = vendorToUser.get(vendId) || null;
        let oficinaId = despachoToOficina.get(despId) || null;
        if (!oficinaId && userId) {
          oficinaId = userOficinaMap.get(userId) || null;
        }

        const statusRaw = str(raw, ["Status", "Estatus", "StatusDoc"]);
        const statusTxt = str(raw, ["Status_TXT", "Estatus_TXT"]);
        const resolvedStatus = statusTxt || statusLetterMap[statusRaw] || statusNumMap[statusRaw] || statusRaw || "";

        const tipo = str(raw, ["TipoDocto_TXT", "TipoDocto", "Tipo"]);
        const tipoLower = tipo.toLowerCase();
        const isPoliza = !tipoLower.includes("fianza");
        const isFianza = tipoLower.includes("fianza");
        const isVigente = resolvedStatus.toLowerCase() === "vigente";
        const isCancelada = resolvedStatus.toLowerCase() === "cancelada";

        const vigDesde = parseSicasDate(str(raw, ["FDesde", "Fdesde", "FechaDesde"]));
        const vigHasta = parseSicasDate(str(raw, ["FHasta", "Fhasta", "FechaHasta"]));

        let renewalDays: number | null = null;
        let isRenewable = false;
        if (vigHasta && isVigente) {
          const hasta = new Date(vigHasta);
          const today = new Date();
          renewalDays = Math.ceil((hasta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          isRenewable = renewalDays >= 0 && renewalDays <= 90;
        }

        const idDocto = str(raw, ["IDDocto", "IdDocto", "Id_Docto", "iddocto"]);
        if (!idDocto) return null;

        return {
          id_docto: idDocto,
          vend_id: vendId,
          vend_nombre: str(raw, ["VendNombre", "Vendedor", "VendAbreviacion"]) || null,
          usuario_id: userId,
          oficina_id: oficinaId,
          desp_nombre: str(raw, ["DespNombre", "Despacho"]) || null,
          ramo: str(raw, ["RamosNombre", "Ramo", "RamosAbreviacion"]) || null,
          subramo: str(raw, ["SRamoNombre", "SubRamo", "SRamoAbreviacion"]) || null,
          compania: str(raw, ["CiaAbreviacion", "CiaNombre", "Aseguradora"]) || null,
          aseguradora_nombre: str(raw, ["CiaNombre", "CiaAbreviacion", "Aseguradora"]) || null,
          poliza: str(raw, ["Documento", "NoDocumento", "DAnterior"]) || null,
          cliente: str(raw, ["NombreCompleto", "Nombre_Completo", "Cliente", "Contratante"]) || null,
          fecha_captura: parseSicasDate(str(raw, ["FCaptura", "FechaCaptura"])),
          fecha_emision: parseSicasDate(str(raw, ["FEmision", "FechaEmision"])),
          vigencia_desde: vigDesde,
          vigencia_hasta: vigHasta,
          importe: num(raw, ["Importe", "PrimaTotal", "ImporteTotal"]),
          prima_neta: num(raw, ["PrimaNeta", "Prima_Neta", "ImporteNeto"]),
          prima_total: num(raw, ["PrimaTotal", "Prima_Total", "ImporteTotal", "Importe"]),
          derechos: num(raw, ["Derechos", "DerPoliza"]),
          impuestos: num(raw, ["Impuestos", "IVA"]),
          recargos: num(raw, ["Recargos"]),
          moneda: str(raw, ["Moneda", "MonedaTXT"]) || "MXN",
          status_codigo: statusRaw,
          status_texto: resolvedStatus,
          status_cobro: str(raw, ["StatusCobro", "Status_Cobro", "EstatusCobro"]),
          tipo_documento: tipo,
          subtipo_documento: str(raw, ["SubTipoDocto_TXT", "SubTipoDocto"]),
          sicas_id_agente: str(raw, ["IDAgente", "AgenteId", "CAgente"]),
          agente_nombre: str(raw, ["AgenteNombre", "Agente", "NombreAgente"]),
          is_poliza: isPoliza,
          is_fianza: isFianza,
          is_vigente: isVigente,
          is_cancelada: isCancelada,
          is_renewable: isRenewable,
          renewal_days_remaining: renewalDays,
          source_keycode: keyCode,
          raw_data: raw,
          raw_hash: JSON.stringify(raw),
          synced_at: new Date().toISOString(),
        };
      }).filter(Boolean);

      // Upsert in batches
      const batchSize = 200;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const { error: upsertErr, data: upserted } = await supabase
          .from("sicas_documents")
          .upsert(batch, { onConflict: "id_docto", ignoreDuplicates: false })
          .select("id");

        if (upsertErr) {
          console.error(`[SyncLocal] Batch ${Math.floor(i / batchSize) + 1} error:`, upsertErr.message);
          errorCount += batch.length;
        } else {
          upsertedCount += upserted?.length || batch.length;
        }
      }

      console.log(`[SyncLocal] Upserted: ${upsertedCount}, Errors: ${errorCount}`);
    }

    // Compute duration
    const startedAt = new Date(run.started_at).getTime();
    const durationMs = Date.now() - startedAt;

    // Update sync run
    await supabase
      .from("sicas_sync_runs")
      .update({
        status: "completed",
        records_fetched: allRecords.length,
        records_upserted: upsertedCount,
        records_failed: errorCount,
        finished_at: new Date().toISOString(),
        duration_seconds: Math.round(durationMs / 1000),
      })
      .eq("run_id", runId);

    // Update cursor
    await supabase.from("sicas_sync_cursors").upsert(
      {
        module: "documents",
        keycode: keyCode,
        last_success_at: new Date().toISOString(),
        last_cursor_date: new Date().toISOString(),
        total_synced: upsertedCount,
        last_run_id: runId,
      },
      { onConflict: "module,keycode" }
    );

    return jsonResponse(200, {
      ok: true,
      stats: {
        documentsUpserted: upsertedCount,
        records_upserted: upsertedCount,
        recordsFetched: allRecords.length,
        recordsFailed: errorCount,
        pagesProcessed: page,
        totalInSicas,
        durationMs,
        runId,
      },
    });
  } catch (error) {
    console.error("[SyncLocal] Error:", error);
    return jsonResponse(500, {
      ok: false,
      error: (error as Error).message,
    });
  }
});
