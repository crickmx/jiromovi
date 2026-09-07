import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Catalog-Import-Token",
};

const SOURCE = "qualitas_official";
const IMPORT_SHEETS = ["AUTOS", "PICKUPS-CARGA", "PICKUPS-PART"];

type RawRow = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function integer(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authorized(req: Request, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const authorization = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const importToken = Deno.env.get("QUALITAS_CATALOG_IMPORT_TOKEN") || "";
  const suppliedToken = req.headers.get("X-Catalog-Import-Token") || "";
  if (authorization === `Bearer ${serviceRoleKey}`) return true;
  if (importToken && suppliedToken === importToken) return true;
  if (!suppliedToken) return false;
  const { data, error } = await supabase.rpc("verify_qualitas_catalog_sync_token", {
    p_token_hash: await sha256(suppliedToken),
  });
  return !error && data === true;
}

function normalizeRows(workbook: XLSX.WorkBook, syncId: string, fileDate: string) {
  const rows: Record<string, unknown>[] = [];
  for (const sheetName of IMPORT_SHEETS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
    for (const raw of rawRows) {
      const categoria = text(raw.CATE);
      const clave = text(raw.CVE);
      const marcaCodigo = text(raw.MR).toUpperCase();
      const marca = text(raw.MARCA).toUpperCase();
      const modelo = text(raw.TIPO).toUpperCase();
      const version = text(raw.DESCRIPCION).toUpperCase();
      const anio = integer(raw.MOD);
      if (!categoria || !clave || !marca || !modelo || !version || !anio) continue;
      const sourceKey = `${sheetName}|${categoria}|${clave}|${marcaCodigo}|${anio}`;
      rows.push({
        marca,
        modelo,
        anio,
        version,
        descripcion_completa: `${marca} ${modelo} ${anio} ${version}`,
        clave_amis: clave,
        valor_referencia: 0,
        carroceria: sheetName.startsWith("PICKUPS") ? "PICKUP" : null,
        metadata_aseguradoras: {
          qualitas_categoria: categoria,
          qualitas_clave: clave,
          qualitas_marca_codigo: marcaCodigo,
          qualitas_hoja: sheetName,
          qualitas_fuente: "EMICAT",
        },
        catalog_source: SOURCE,
        source_key: sourceKey,
        source_file_date: fileDate,
        source_updated_at: new Date().toISOString(),
        source_sync_id: syncId,
        active: true,
      });
    }
  }
  return rows;
}

function normalizeImportedRows(rawRows: RawRow[], syncId: string, fileDate: string) {
  const rows: Record<string, unknown>[] = [];
  for (const raw of rawRows) {
    const sheetName = text(raw.sheetName).toUpperCase();
    const categoria = text(raw.CATE);
    const clave = text(raw.CVE);
    const marcaCodigo = text(raw.MR).toUpperCase();
    const marca = text(raw.MARCA).toUpperCase();
    const modelo = text(raw.TIPO).toUpperCase();
    const version = text(raw.DESCRIPCION).toUpperCase();
    const anio = integer(raw.MOD);
    if (!IMPORT_SHEETS.includes(sheetName) || !categoria || !clave || !marca || !modelo || !version || !anio) continue;
    rows.push({
      marca,
      modelo,
      anio,
      version,
      descripcion_completa: `${marca} ${modelo} ${anio} ${version}`,
      clave_amis: clave,
      valor_referencia: 0,
      carroceria: sheetName.startsWith("PICKUPS") ? "PICKUP" : null,
      metadata_aseguradoras: {
        qualitas_categoria: categoria,
        qualitas_clave: clave,
        qualitas_marca_codigo: marcaCodigo,
        qualitas_hoja: sheetName,
        qualitas_fuente: "EMICAT",
      },
      catalog_source: SOURCE,
      source_key: `${sheetName}|${categoria}|${clave}|${marcaCodigo}|${anio}`,
      source_file_date: fileDate,
      source_updated_at: new Date().toISOString(),
      source_sync_id: syncId,
      active: true,
    });
  }
  return rows;
}

async function setStatus(supabase: ReturnType<typeof createClient>, values: Record<string, unknown>) {
  await supabase.from("multi_autos_catalog_sync_status").upsert({
    source: SOURCE,
    updated_at: new Date().toISOString(),
    ...values,
  }, { onConflict: "source" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!await authorized(req, supabase)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const requestType = req.headers.get("Content-Type") || "";
    let action = "sync";
    let fileName = "qualitas-catalog.xlsx";
    let fileDate = new Date().toISOString().slice(0, 10);
    let bytes: Uint8Array | null = null;

    if (requestType.includes("multipart/form-data")) {
      const form = await req.formData();
      action = "import";
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Archivo XLSX requerido");
      fileName = file.name;
      fileDate = text(form.get("sourceFileDate")) || fileDate;
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      action = text(body.action) || "sync";
      fileName = text(body.fileName) || fileName;
      fileDate = text(body.sourceFileDate) || fileDate;

      if (action === "start") {
        const syncId = text(body.syncId) || crypto.randomUUID();
        await setStatus(supabase, {
          status: "running",
          last_attempt_at: new Date().toISOString(),
          last_error: null,
          source_file: fileName,
          source_file_date: fileDate,
          row_count: 0,
          sync_id: syncId,
        });
        return new Response(JSON.stringify({ success: true, syncId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "import_rows") {
        const syncId = text(body.syncId);
        const rawRows = Array.isArray(body.rows) ? body.rows as RawRow[] : [];
        if (!syncId || rawRows.length === 0 || rawRows.length > 500) throw new Error("Lote inválido");
        const rows = normalizeImportedRows(rawRows, syncId, fileDate);
        const { error } = await supabase
          .from("multi_autos_catalogo_vehiculos")
          .upsert(rows, { onConflict: "catalog_source,source_key" });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, accepted: rows.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "finalize") {
        const syncId = text(body.syncId);
        if (!syncId) throw new Error("syncId requerido");
        const { count, error: countError } = await supabase
          .from("multi_autos_catalogo_vehiculos")
          .select("id", { count: "exact", head: true })
          .eq("catalog_source", SOURCE)
          .eq("source_sync_id", syncId);
        if (countError) throw countError;
        if (!count || count < 1000) throw new Error(`Catálogo incompleto: sólo ${count || 0} registros`);
        const { error: deactivateError } = await supabase
          .from("multi_autos_catalogo_vehiculos")
          .update({ active: false, source_updated_at: new Date().toISOString() })
          .eq("catalog_source", SOURCE)
          .neq("source_sync_id", syncId);
        if (deactivateError) throw deactivateError;
        await setStatus(supabase, {
          status: "success",
          last_success_at: new Date().toISOString(),
          last_error: null,
          source_file: fileName,
          source_file_date: fileDate,
          row_count: count,
          sync_id: syncId,
        });
        return new Response(JSON.stringify({ success: true, updated: true, rowCount: count }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "sync") {
      const sourceUrl = Deno.env.get("QUALITAS_CATALOG_XLSX_URL") || "";
      if (!sourceUrl) {
        await setStatus(supabase, {
          status: "awaiting_source",
          last_attempt_at: new Date().toISOString(),
          last_error: "Falta QUALITAS_CATALOG_XLSX_URL vigente; se conserva el último catálogo válido.",
        });
        return new Response(JSON.stringify({
          success: true,
          updated: false,
          status: "awaiting_source",
          message: "Último catálogo válido conservado",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        await setStatus(supabase, {
          status: "awaiting_source",
          last_attempt_at: new Date().toISOString(),
          last_error: `La fuente configurada ya no está disponible (HTTP ${response.status}); se conserva el último catálogo válido.`,
        });
        return new Response(JSON.stringify({
          success: true,
          updated: false,
          status: "awaiting_source",
          message: "Último catálogo válido conservado",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      bytes = new Uint8Array(await response.arrayBuffer());
      fileName = sourceUrl.split("/").pop() || fileName;
    }

    if (!bytes?.length) throw new Error("Catálogo vacío");
    const syncId = crypto.randomUUID();
    await setStatus(supabase, {
      status: "running",
      last_attempt_at: new Date().toISOString(),
      last_error: null,
      sync_id: syncId,
    });

    const workbook = XLSX.read(bytes, { type: "array" });
    const rows = normalizeRows(workbook, syncId, fileDate);
    if (rows.length < 1000) throw new Error(`Catálogo incompleto: sólo ${rows.length} registros válidos`);

    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await supabase
        .from("multi_autos_catalogo_vehiculos")
        .upsert(rows.slice(offset, offset + 500), { onConflict: "catalog_source,source_key" });
      if (error) throw error;
    }

    const { error: deactivateError } = await supabase
      .from("multi_autos_catalogo_vehiculos")
      .update({ active: false, source_updated_at: new Date().toISOString() })
      .eq("catalog_source", SOURCE)
      .neq("source_sync_id", syncId);
    if (deactivateError) throw deactivateError;

    await setStatus(supabase, {
      status: "success",
      last_success_at: new Date().toISOString(),
      last_error: null,
      source_file: fileName,
      source_file_date: fileDate,
      row_count: rows.length,
      sync_id: syncId,
    });

    return new Response(JSON.stringify({ success: true, updated: true, rowCount: rows.length, fileName, fileDate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    await setStatus(supabase, {
      status: "failed",
      last_attempt_at: new Date().toISOString(),
      last_error: (error as Error).message.substring(0, 1000),
    });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
