import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseSicasResponse, parseSoapResponse, checkSoapError } from "../_shared/sicasParser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// HWCAPTURE required catalog types mapped to their DB IDs and SICAS enum names
const HWCAPTURE_CATALOGS = [
  { catalog_type_id: 24, enum_name: "eTiposDocumento", label: "Tipos de Documento" },
  { catalog_type_id: 12, enum_name: "eAseguradoras", label: "Aseguradoras" },
  { catalog_type_id: 9, enum_name: "eRamos", label: "Ramos" },
  { catalog_type_id: 10, enum_name: "eSubRamos", label: "SubRamos" },
  { catalog_type_id: 6, enum_name: "eMonedas", label: "Monedas" },
  { catalog_type_id: 8, enum_name: "eFormasPago", label: "Formas de Pago" },
  { catalog_type_id: 16, enum_name: "eEjecutivos", label: "Ejecutivos" },
  { catalog_type_id: 62, enum_name: "eGrupos", label: "Grupos" },
  { catalog_type_id: 40, enum_name: "eEstatus", label: "Estatus" },
];

interface CatalogSyncResult {
  catalog_type_id: number;
  label: string;
  enum_name: string;
  status: "success" | "not_available" | "error";
  records_found: number;
  records_inserted: number;
  records_updated: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT");

    if (!sicasUsername || !sicasPassword) {
      throw new Error("SICAS credentials not configured (SICAS_USERNAME / SICAS_PASSWORD)");
    }

    if (!sicasEndpoint) {
      throw new Error("Falta configurar SICAS_SOAP_ENDPOINT o SICAS_ENDPOINT en secrets de Supabase.");
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch { /* empty body is fine */ }

    // Allow syncing a subset of catalogs
    const onlyIds: number[] | null = body?.catalog_type_ids || null;
    const catalogsToSync = onlyIds
      ? HWCAPTURE_CATALOGS.filter((c) => onlyIds.includes(c.catalog_type_id))
      : HWCAPTURE_CATALOGS;

    console.log(`[HWCAPTURE Sync] Syncing ${catalogsToSync.length} catalogs...`);

    const results: CatalogSyncResult[] = [];

    for (const catalog of catalogsToSync) {
      console.log(`[HWCAPTURE Sync] --- ${catalog.label} (${catalog.enum_name}) ---`);

      try {
        const result = await syncSingleCatalog(
          supabase,
          catalog,
          sicasUsername,
          sicasPassword,
          sicasEndpoint
        );
        results.push(result);
        console.log(`[HWCAPTURE Sync] ${catalog.label}: ${result.status} (${result.records_found} records)`);
      } catch (error: any) {
        console.error(`[HWCAPTURE Sync] ${catalog.label} FAILED:`, error.message);
        results.push({
          catalog_type_id: catalog.catalog_type_id,
          label: catalog.label,
          enum_name: catalog.enum_name,
          status: "error",
          records_found: 0,
          records_inserted: 0,
          records_updated: 0,
          error: error.message,
        });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter((r) => r.status === "success").length,
      not_available: results.filter((r) => r.status === "not_available").length,
      errors: results.filter((r) => r.status === "error").length,
      total_records: results.reduce((sum, r) => sum + r.records_found, 0),
    };

    console.log(`[HWCAPTURE Sync] DONE. Summary:`, JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[HWCAPTURE Sync] Fatal error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function syncSingleCatalog(
  supabase: any,
  catalog: { catalog_type_id: number; enum_name: string; label: string },
  username: string,
  password: string,
  endpoint: string
): Promise<CatalogSyncResult> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>${catalog.enum_name}</tem:PropertyTypeReadData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${username}</tem:UserName>
        <tem:Password>${password}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ReadInfoData",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const responseText = await response.text();

  // Check for SOAP-level errors
  const errorCheck = checkSoapError(responseText);
  if (errorCheck.hasError) {
    throw new Error(errorCheck.errorMessage);
  }

  // Check for PROCESSDATA (catalog not available)
  const decoded = responseText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  const isNotAvailable =
    /<PROCESSDATA>/i.test(decoded) &&
    /<RESPONSETXT>\s*SUCESS\s*<\/RESPONSETXT>/i.test(decoded) &&
    /<RESPONSENBR>\s*0\s*<\/RESPONSENBR>/i.test(decoded);

  if (isNotAvailable) {
    return {
      catalog_type_id: catalog.catalog_type_id,
      label: catalog.label,
      enum_name: catalog.enum_name,
      status: "not_available",
      records_found: 0,
      records_inserted: 0,
      records_updated: 0,
      error: "Catalog not available in SICAS",
    };
  }

  // Parse the SOAP response
  let parsedData: any;
  try {
    parsedData = parseSoapResponse(responseText);
  } catch (e: any) {
    if (/Error en Ejecución|Proceso Interno|SICASOnline/i.test(e.message)) {
      return {
        catalog_type_id: catalog.catalog_type_id,
        label: catalog.label,
        enum_name: catalog.enum_name,
        status: "not_available",
        records_found: 0,
        records_inserted: 0,
        records_updated: 0,
        error: e.message,
      };
    }
    throw e;
  }

  if (parsedData?.__empty_catalog) {
    return {
      catalog_type_id: catalog.catalog_type_id,
      label: catalog.label,
      enum_name: catalog.enum_name,
      status: "not_available",
      records_found: 0,
      records_inserted: 0,
      records_updated: 0,
      error: parsedData.message || "Empty catalog",
    };
  }

  // Parse records using the universal parser
  const parseResult = parseSicasResponse(parsedData, catalog.label);

  if (parseResult.kind === "not_available") {
    return {
      catalog_type_id: catalog.catalog_type_id,
      label: catalog.label,
      enum_name: catalog.enum_name,
      status: "not_available",
      records_found: 0,
      records_inserted: 0,
      records_updated: 0,
      error: parseResult.message,
    };
  }

  const records = parseResult.records;
  if (records.length === 0) {
    return {
      catalog_type_id: catalog.catalog_type_id,
      label: catalog.label,
      enum_name: catalog.enum_name,
      status: "not_available",
      records_found: 0,
      records_inserted: 0,
      records_updated: 0,
      error: "No records returned",
    };
  }

  // Upsert records into sicas_catalogos
  let recordsInserted = 0;
  let recordsUpdated = 0;

  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    // Check which records already exist
    const { data: existing } = await supabase
      .from("sicas_catalogos")
      .select("id, id_sicas")
      .eq("catalog_type_id", catalog.catalog_type_id)
      .in("id_sicas", batch.map((r) => r.id_sicas));

    const existingIds = new Set((existing || []).map((r: any) => r.id_sicas));
    const existingMap = new Map((existing || []).map((r: any) => [r.id_sicas, r.id]));

    const toInsert = batch.filter((r) => !existingIds.has(r.id_sicas));
    const toUpdate = batch.filter((r) => existingIds.has(r.id_sicas));

    // Insert new records
    if (toInsert.length > 0) {
      const { error } = await supabase.from("sicas_catalogos").insert(
        toInsert.map((r) => ({
          catalog_type_id: catalog.catalog_type_id,
          id_sicas: r.id_sicas,
          nombre: r.nombre,
          raw: r.raw,
          metadata: { sync_method: "soap_hwcapture", enum_name: catalog.enum_name },
          last_sync_at: new Date().toISOString(),
        }))
      );
      if (!error) {
        recordsInserted += toInsert.length;
      } else {
        console.error(`[HWCAPTURE Sync] Insert error for ${catalog.label}:`, error.message);
      }
    }

    // Update existing records
    for (const record of toUpdate) {
      const id = existingMap.get(record.id_sicas);
      if (id) {
        await supabase
          .from("sicas_catalogos")
          .update({
            nombre: record.nombre,
            raw: record.raw,
            metadata: { sync_method: "soap_hwcapture", enum_name: catalog.enum_name },
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", id);
        recordsUpdated++;
      }
    }
  }

  return {
    catalog_type_id: catalog.catalog_type_id,
    label: catalog.label,
    enum_name: catalog.enum_name,
    status: "success",
    records_found: records.length,
    records_inserted: recordsInserted,
    records_updated: recordsUpdated,
  };
}
