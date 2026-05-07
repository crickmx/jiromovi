import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// Types
// ============================================================

interface PolicyDelivery {
  id: string;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  insured_rfc: string | null;
  start_date: string | null;
  end_date: string | null;
  vendor_sicas_id: string | null;
  vendor_sicas_key: string | null;
  vendor_sicas_name: string | null;
  sicas_office_id: string | null;
  sicas_office_name: string | null;
  sicas_management_id: string | null;
  sicas_management_name: string | null;
  vehicle_description: string | null;
  plates: string | null;
  vin: string | null;
  engine: string | null;
  payment_method: string | null;
  currency: string | null;
  net_premium: string | null;
  total_premium: string | null;
  cover_file_path: string | null;
  cover_file_name: string | null;
  additional_files: any[] | null;
  ticket_id: string | null;
  ticket_folio: string | null;
  extracted_data: Record<string, any> | null;
  sicas_registration_status: string | null;
  sicas_document_id: string | null;
  sicas_registration_attempts: number;
  sicas_last_attempt_at: string | null;
  sicas_override_tipo_docto: string | null;
  sicas_override_cia: string | null;
  sicas_override_ramo: string | null;
  sicas_override_subramo: string | null;
  sicas_override_moneda: string | null;
  sicas_override_fpago: string | null;
  sicas_override_ejecutivo: string | null;
  sicas_override_grupo: string | null;
  sicas_override_cliente: string | null;
  sicas_override_estatus: string | null;
  sicas_resolved_fields: Record<string, any> | null;
}

interface HwcaptureDefault {
  field_name: string;
  field_label: string;
  default_value: string | null;
  is_required: boolean;
}

interface CatalogRecord {
  id_sicas: string;
  nombre: string;
  raw: any;
}

interface ResolvedField {
  value: string;
  source: string;
  label?: string;
}

interface ResolutionResult {
  resolved: Record<string, ResolvedField>;
  missing: string[];
  warnings: string[];
}

// ============================================================
// Helpers
// ============================================================

function getPolicyNumberFromDelivery(delivery: PolicyDelivery): string | null {
  const candidates: Array<string | null | undefined> = [
    delivery.manual_policy_number,
    delivery.policy_number,
    delivery.extracted_data?.manual_policy_number,
    delivery.extracted_data?.sicas_policy_number,
    delivery.extracted_data?.policy_number,
    delivery.extracted_data?.policyNumber,
    delivery.extracted_data?.numero_poliza,
    delivery.extracted_data?.numeroPoliza,
    delivery.extracted_data?.poliza,
    delivery.extracted_data?.documento,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string") {
      const cleaned = cleanPolicyNumber(candidate);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function cleanPolicyNumber(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw
    .replace(/^(P[oó]liza|Documento|No\.?|Num\.?|N[uú]mero)\s*:?\s*/i, "")
    .replace(/[\t\r\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");

  if (cleaned.length === 0) return null;
  if (looksLikeMoviFolio(cleaned)) return null;
  return cleaned;
}

const MOVI_FOLIO_PATTERNS = [
  /^[A-Z]{2,4}-\d{4}-\d{3,6}$/i,
];

function looksLikeMoviFolio(value: string): boolean {
  return MOVI_FOLIO_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeSicasAmount(value: string | null): string {
  if (!value) return "0";
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return num.toFixed(2);
}

function formatSicasDate(dateStr: string | null): string {
  if (!dateStr) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

  const monthMap: Record<string, string> = {
    ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
    JAN: "01", APR: "04", AUG: "08", DEC: "12",
  };
  const mmmMatch = dateStr.match(/^(\d{1,2})\/([A-Z]{3})\/(\d{4})$/i);
  if (mmmMatch) {
    const dd = mmmMatch[1].padStart(2, "0");
    const mm = monthMap[mmmMatch[2].toUpperCase()] || "01";
    return `${dd}/${mm}/${mmmMatch[3]}`;
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  return dateStr;
}

function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCatalogMatch(records: CatalogRecord[], searchTerms: string[]): CatalogRecord | null {
  const normalizedTerms = searchTerms.map(t => normalizeText(t));

  // Exact match first
  for (const term of normalizedTerms) {
    const exact = records.find(r => normalizeText(r.nombre) === term);
    if (exact) return exact;
  }

  // Contains match
  for (const term of normalizedTerms) {
    const contains = records.find(r => normalizeText(r.nombre).includes(term));
    if (contains) return contains;
  }

  // Any record contains any term
  for (const term of normalizedTerms) {
    for (const r of records) {
      const normalized = normalizeText(r.nombre);
      if (normalized.includes(term) || term.includes(normalized)) return r;
    }
  }

  return null;
}

// ============================================================
// Auto-Resolution Logic
// ============================================================

async function resolveSicasHwcaptureRequiredFields(
  supabase: any,
  delivery: PolicyDelivery,
  defaults: HwcaptureDefault[]
): Promise<ResolutionResult> {
  const resolved: Record<string, ResolvedField> = {};
  const missing: string[] = [];
  const warnings: string[] = [];

  // Load all needed catalogs in parallel
  const catalogTypeIds = [24, 12, 9, 10, 6, 8, 16, 62, 40];
  const catalogCache: Record<number, CatalogRecord[]> = {};

  const catalogPromises = catalogTypeIds.map(async (ctId) => {
    const { data } = await supabase
      .from("sicas_catalogos")
      .select("id_sicas, nombre, raw")
      .eq("catalog_type_id", ctId)
      .order("nombre");
    catalogCache[ctId] = data || [];
  });
  await Promise.all(catalogPromises);

  const getDefault = (fieldName: string): string | null => {
    const def = defaults.find(d => d.field_name === fieldName);
    return def?.default_value || null;
  };

  // Load vendor data if available
  let vendorData: any = null;
  if (delivery.vendor_sicas_id) {
    const { data } = await supabase
      .from("sicas_catalogos")
      .select("id_sicas, nombre, raw")
      .eq("catalog_type_id", 32) // Vendedores
      .eq("id_sicas", delivery.vendor_sicas_id)
      .maybeSingle();
    vendorData = data;
  }

  // === 1. IDTipoDocto ===
  if (delivery.sicas_override_tipo_docto) {
    resolved.IDTipoDocto = { value: delivery.sicas_override_tipo_docto, source: "override" };
  } else if (getDefault("IDTipoDocto")) {
    resolved.IDTipoDocto = { value: getDefault("IDTipoDocto")!, source: "default" };
  } else {
    const tipoDoctos = catalogCache[24] || [];
    const match = findCatalogMatch(tipoDoctos, ["POLIZA", "POLIZAS", "POL"]);
    if (match) {
      resolved.IDTipoDocto = { value: match.id_sicas, source: "catalog_match_poliza", label: match.nombre };
    } else if (tipoDoctos.length === 1) {
      resolved.IDTipoDocto = { value: tipoDoctos[0].id_sicas, source: "single_catalog_item", label: tipoDoctos[0].nombre };
      warnings.push(`IDTipoDocto: Solo existe un tipo de documento en catalogo (${tipoDoctos[0].nombre}), se uso automaticamente.`);
    } else {
      missing.push("Tipo de Documento (IDTipoDocto)");
    }
  }

  // === 2. IDCia (Aseguradora) ===
  if (delivery.sicas_override_cia) {
    resolved.IDCia = { value: delivery.sicas_override_cia, source: "override" };
  } else if (getDefault("IDCia")) {
    resolved.IDCia = { value: getDefault("IDCia")!, source: "default" };
  } else {
    const cias = catalogCache[12] || [];
    // Since this module is for Qualitas policies, try matching Qualitas
    const qualitasMatch = findCatalogMatch(cias, ["QUALITAS", "QUALITAS COMPANIA", "QUALITAS COMPANIA DE SEGUROS"]);
    if (qualitasMatch) {
      resolved.IDCia = { value: qualitasMatch.id_sicas, source: "catalog_match_qualitas", label: qualitasMatch.nombre };
    } else {
      // Try extracted data
      const extractedCia = delivery.extracted_data?.aseguradora || delivery.extracted_data?.compania;
      if (extractedCia && cias.length > 0) {
        const extractedMatch = findCatalogMatch(cias, [extractedCia]);
        if (extractedMatch) {
          resolved.IDCia = { value: extractedMatch.id_sicas, source: "catalog_match_extracted", label: extractedMatch.nombre };
        } else {
          missing.push("Aseguradora (IDCia)");
          warnings.push(`IDCia: Se extrajo "${extractedCia}" pero no se encontro en catalogo SICAS.`);
        }
      } else {
        missing.push("Aseguradora (IDCia)");
      }
    }
  }

  // === 3. IDRamo ===
  if (delivery.sicas_override_ramo) {
    resolved.IDRamo = { value: delivery.sicas_override_ramo, source: "override" };
  } else if (getDefault("IDRamo")) {
    resolved.IDRamo = { value: getDefault("IDRamo")!, source: "default" };
  } else {
    const ramos = catalogCache[9] || [];
    // Detect if vehicle data exists -> assume Autos
    const hasVehicleData = !!(delivery.vehicle_description || delivery.plates || delivery.vin || delivery.engine);
    const searchTerms = hasVehicleData
      ? ["AUTOS", "AUTOMOVILES", "VEHICULOS", "DANOS AUTOS", "AUTO"]
      : ["AUTOS", "AUTOMOVILES"];

    const ramoMatch = findCatalogMatch(ramos, searchTerms);
    if (ramoMatch) {
      resolved.IDRamo = { value: ramoMatch.id_sicas, source: hasVehicleData ? "inferred_from_vehicle_data" : "catalog_match_autos", label: ramoMatch.nombre };
    } else {
      missing.push("Ramo (IDRamo)");
    }
  }

  // === 4. IDSubRamo ===
  if (delivery.sicas_override_subramo) {
    resolved.IDSubRamo = { value: delivery.sicas_override_subramo, source: "override" };
  } else if (getDefault("IDSubRamo")) {
    resolved.IDSubRamo = { value: getDefault("IDSubRamo")!, source: "default" };
  } else {
    const subRamos = catalogCache[10] || [];
    const subRamoMatch = findCatalogMatch(subRamos, ["AUTOS", "AUTOMOVILES", "VEHICULOS", "AUTO INDIVIDUAL", "RESIDENTES", "AUTOS RESIDENTES"]);
    if (subRamoMatch) {
      resolved.IDSubRamo = { value: subRamoMatch.id_sicas, source: "catalog_match_autos", label: subRamoMatch.nombre };
    } else if (subRamos.length === 1) {
      resolved.IDSubRamo = { value: subRamos[0].id_sicas, source: "single_catalog_item", label: subRamos[0].nombre };
    } else {
      missing.push("SubRamo (IDSubRamo)");
    }
  }

  // === 5. IDMon (Moneda) ===
  if (delivery.sicas_override_moneda) {
    resolved.IDMon = { value: delivery.sicas_override_moneda, source: "override" };
  } else if (getDefault("IDMon")) {
    resolved.IDMon = { value: getDefault("IDMon")!, source: "default" };
  } else {
    const monedas = catalogCache[6] || [];
    // Check extracted currency text
    const extractedCurrency = delivery.currency || delivery.extracted_data?.moneda;
    let searchTermsMoneda = ["PESOS", "MXN", "M.N.", "MONEDA NACIONAL", "MN"];
    if (extractedCurrency) {
      searchTermsMoneda = [extractedCurrency, ...searchTermsMoneda];
    }
    const monedaMatch = findCatalogMatch(monedas, searchTermsMoneda);
    if (monedaMatch) {
      resolved.IDMon = { value: monedaMatch.id_sicas, source: extractedCurrency ? "catalog_match_extracted" : "catalog_match_pesos", label: monedaMatch.nombre };
    } else if (monedas.length === 1) {
      resolved.IDMon = { value: monedas[0].id_sicas, source: "single_catalog_item", label: monedas[0].nombre };
    } else {
      missing.push("Moneda (IDMon)");
    }
  }

  // === 6. IDFPago (Forma de Pago) ===
  if (delivery.sicas_override_fpago) {
    resolved.IDFPago = { value: delivery.sicas_override_fpago, source: "override" };
  } else {
    const fpagos = catalogCache[8] || [];
    const extractedFPago = delivery.payment_method || delivery.extracted_data?.formaPago || delivery.extracted_data?.forma_pago;

    if (extractedFPago) {
      const fpagoMatch = findCatalogMatch(fpagos, [extractedFPago, extractedFPago.toUpperCase()]);
      if (fpagoMatch) {
        resolved.IDFPago = { value: fpagoMatch.id_sicas, source: "catalog_match_extracted", label: fpagoMatch.nombre };
      } else if (getDefault("IDFPago")) {
        resolved.IDFPago = { value: getDefault("IDFPago")!, source: "default" };
        warnings.push(`IDFPago: Se extrajo "${extractedFPago}" pero no se encontro en catalogo. Se uso default.`);
      } else {
        missing.push("Forma de Pago (IDFPago)");
        warnings.push(`IDFPago: Se extrajo "${extractedFPago}" pero no se encontro en catalogo SICAS.`);
      }
    } else if (getDefault("IDFPago")) {
      resolved.IDFPago = { value: getDefault("IDFPago")!, source: "default" };
    } else {
      // Try common defaults
      const contadoMatch = findCatalogMatch(fpagos, ["CONTADO", "ANUAL", "UN SOLO PAGO"]);
      if (contadoMatch) {
        resolved.IDFPago = { value: contadoMatch.id_sicas, source: "catalog_match_contado", label: contadoMatch.nombre };
        warnings.push(`IDFPago: No se detecto forma de pago en documento. Se asigno "${contadoMatch.nombre}" por defecto.`);
      } else {
        missing.push("Forma de Pago (IDFPago)");
      }
    }
  }

  // === 7. IDGrupo ===
  if (delivery.sicas_override_grupo) {
    resolved.IDGrupo = { value: delivery.sicas_override_grupo, source: "override" };
  } else if (vendorData?.raw?.IDGrupo) {
    resolved.IDGrupo = { value: String(vendorData.raw.IDGrupo), source: "vendor" };
  } else if (vendorData?.raw?.Grupo) {
    resolved.IDGrupo = { value: String(vendorData.raw.Grupo), source: "vendor" };
  } else if (getDefault("IDGrupo")) {
    resolved.IDGrupo = { value: getDefault("IDGrupo")!, source: "default" };
  } else {
    const grupos = catalogCache[62] || [];
    if (grupos.length === 1) {
      resolved.IDGrupo = { value: grupos[0].id_sicas, source: "single_catalog_item", label: grupos[0].nombre };
    } else {
      missing.push("Grupo (IDGrupo)");
    }
  }

  // === 8. IDEjecutivo ===
  if (delivery.sicas_override_ejecutivo) {
    resolved.IDEjecutivo = { value: delivery.sicas_override_ejecutivo, source: "override" };
  } else if (vendorData?.raw?.IDEjecutivo) {
    resolved.IDEjecutivo = { value: String(vendorData.raw.IDEjecutivo), source: "vendor" };
  } else if (vendorData?.raw?.Ejecutivo) {
    resolved.IDEjecutivo = { value: String(vendorData.raw.Ejecutivo), source: "vendor" };
  } else if (getDefault("IDEjecutivo")) {
    resolved.IDEjecutivo = { value: getDefault("IDEjecutivo")!, source: "default" };
  } else {
    const ejecutivos = catalogCache[16] || [];
    if (ejecutivos.length === 1) {
      resolved.IDEjecutivo = { value: ejecutivos[0].id_sicas, source: "single_catalog_item", label: ejecutivos[0].nombre };
    } else {
      missing.push("Ejecutivo (IDEjecutivo)");
    }
  }

  // === 9. Estatus ===
  if (delivery.sicas_override_estatus) {
    resolved.Estatus = { value: delivery.sicas_override_estatus, source: "override" };
  } else if (getDefault("Estatus")) {
    resolved.Estatus = { value: getDefault("Estatus")!, source: "default" };
  } else {
    const estatuses = catalogCache[40] || [];
    const estatusMatch = findCatalogMatch(estatuses, ["VIGENTE", "V", "ACTIVA", "EN VIGOR"]);
    if (estatusMatch) {
      resolved.Estatus = { value: estatusMatch.id_sicas, source: "catalog_match_vigente", label: estatusMatch.nombre };
    } else {
      missing.push("Estatus");
    }
  }

  // === 10. IDCli (Cliente) - Most complex ===
  if (delivery.sicas_override_cliente) {
    resolved.IDCli = { value: delivery.sicas_override_cliente, source: "override" };
  } else {
    // Try to find client by RFC in SICAS contacts catalog (type 17)
    const rfcToSearch = delivery.insured_rfc || delivery.extracted_data?.rfcAsegurado || delivery.extracted_data?.rfc;
    const nameToSearch = delivery.insured_name || delivery.extracted_data?.nombreCliente || delivery.extracted_data?.contratante;

    let clientFound = false;

    if (rfcToSearch) {
      // Search contacts by RFC in raw data
      const { data: byRfc } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17) // Contactos
        .ilike("raw->>RFC", rfcToSearch.trim())
        .limit(5);

      if (byRfc && byRfc.length === 1) {
        resolved.IDCli = { value: byRfc[0].id_sicas, source: "matched_by_rfc", label: byRfc[0].nombre };
        clientFound = true;
      } else if (byRfc && byRfc.length > 1) {
        missing.push("Cliente SICAS (IDCli)");
        warnings.push(`IDCli: RFC "${rfcToSearch}" tiene ${byRfc.length} coincidencias en SICAS. Requiere seleccion manual.`);
        clientFound = true; // Not resolved but handled
      }
    }

    if (!clientFound && nameToSearch) {
      const normalizedName = normalizeText(nameToSearch);
      const { data: byName } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .limit(200);

      if (byName && byName.length > 0) {
        const exactMatch = byName.find((r: CatalogRecord) => normalizeText(r.nombre) === normalizedName);
        if (exactMatch) {
          resolved.IDCli = { value: exactMatch.id_sicas, source: "matched_by_name", label: exactMatch.nombre };
          clientFound = true;
        } else {
          // Partial match
          const partialMatches = byName.filter((r: CatalogRecord) => {
            const normalized = normalizeText(r.nombre);
            return normalized.includes(normalizedName) || normalizedName.includes(normalized);
          });
          if (partialMatches.length === 1) {
            resolved.IDCli = { value: partialMatches[0].id_sicas, source: "matched_by_name_partial", label: partialMatches[0].nombre };
            warnings.push(`IDCli: Match parcial por nombre "${nameToSearch}" -> "${partialMatches[0].nombre}".`);
            clientFound = true;
          } else if (partialMatches.length > 1) {
            missing.push("Cliente SICAS (IDCli)");
            warnings.push(`IDCli: Nombre "${nameToSearch}" tiene ${partialMatches.length} coincidencias parciales. Requiere seleccion manual.`);
            clientFound = true;
          }
        }
      }
    }

    if (!clientFound) {
      missing.push("Cliente SICAS (IDCli)");
      if (rfcToSearch || nameToSearch) {
        warnings.push(`IDCli: No se encontro cliente SICAS para RFC="${rfcToSearch || ""}" nombre="${nameToSearch || ""}". Sincronice catalogo de contactos o ingrese ID manualmente.`);
      }
    }
  }

  // === 11. IDVend (Agente/Vendedor) - from delivery directly ===
  if (delivery.vendor_sicas_id) {
    resolved.IDVend = { value: delivery.vendor_sicas_id, source: "policy_delivery" };
  } else {
    missing.push("Agente/Vendedor (IDVend)");
  }

  return { resolved, missing, warnings };
}

// ============================================================
// Build form payload from resolution result
// ============================================================

function buildFormPayloadFromResolution(
  delivery: PolicyDelivery,
  policyNumber: string,
  resolution: ResolutionResult
): { payload: URLSearchParams; fieldValues: Record<string, string> } {
  const fieldValues: Record<string, string> = {};

  fieldValues["Documento"] = policyNumber;
  fieldValues["IDDocto"] = "-1";

  // Add all resolved fields
  for (const [fieldName, field] of Object.entries(resolution.resolved)) {
    fieldValues[fieldName] = field.value;
  }

  // Optional fields
  const fDesde = formatSicasDate(delivery.start_date);
  const fHasta = formatSicasDate(delivery.end_date);
  if (fDesde) fieldValues["FDesde"] = fDesde;
  if (fHasta) fieldValues["FHasta"] = fHasta;

  fieldValues["PrimaNeta"] = normalizeSicasAmount(delivery.net_premium);
  fieldValues["PrimaTotal"] = normalizeSicasAmount(delivery.total_premium);

  if (delivery.sicas_office_id) fieldValues["IDDespacho"] = delivery.sicas_office_id;
  if (delivery.sicas_management_id && delivery.sicas_management_id !== "0") {
    fieldValues["IDGerencia"] = delivery.sicas_management_id;
  }

  if (delivery.insured_name) fieldValues["NombreCliente"] = delivery.insured_name;
  if (delivery.insured_rfc) fieldValues["RFCCliente"] = delivery.insured_rfc;

  fieldValues["Observaciones"] = "Registrado desde MOVI Digital";

  if (delivery.vehicle_description) fieldValues["Descripcion"] = delivery.vehicle_description;
  if (delivery.vin) fieldValues["Serie"] = delivery.vin;
  if (delivery.engine) fieldValues["Motor"] = delivery.engine;
  if (delivery.plates) fieldValues["Placas"] = delivery.plates;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fieldValues)) {
    params.append(key, value);
  }

  return { payload: params, fieldValues };
}

// ============================================================
// SICAS Authentication
// ============================================================

async function getSicasToken(config: {
  baseUrl: string;
  username: string;
  password: string;
  codeAuth?: string;
}): Promise<string> {
  const params = new URLSearchParams({
    sUserName: config.username,
    sPassword: config.password,
  });
  if (config.codeAuth) params.append("sCodeAuth", config.codeAuth);

  const res = await fetch(`${config.baseUrl}/Security/GetToken?${params.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SICAS auth failed: ${res.status} - ${body}`);
  }

  const data = await res.json();
  if (!data.Sucess || !data.Token) {
    throw new Error(`SICAS auth rejected: ${data.Message || "No token received"}`);
  }

  return data.Token;
}

// ============================================================
// SICAS Centro Digital Upload
// ============================================================

async function uploadFileToCentroDigital(config: {
  baseUrl: string;
  token: string;
  documentId: string;
  fileUrl: string;
  fileName: string;
}): Promise<{ success: boolean; error?: string; response?: any }> {
  try {
    const response = await fetch(`${config.baseUrl}/DigitalCenter/UploadFile`, {
      method: "POST",
      headers: {
        Authorization: config.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        TypeDestinoCDigital: "DOCUMENT",
        IDValuePK: config.documentId,
        FolderDestino: "Documentos",
        ListFilesURL: config.fileUrl,
        FileName: config.fileName,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errBody}` };
    }

    const data = await response.json();
    if (data.Sucess || data.Success) {
      return { success: true, response: data };
    }
    return { success: false, error: data.Error || data.Message || "Upload failed", response: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Upload error" };
  }
}

// ============================================================
// Logging helper
// ============================================================

async function logRegistration(
  supabase: any,
  params: {
    policyDeliveryId: string;
    ticketId?: string | null;
    userId: string;
    action: string;
    status?: string;
    requestPayload?: any;
    responseRaw?: any;
    errorMessage?: string;
    durationMs?: number;
  }
) {
  try {
    await supabase.from("sicas_registration_logs").insert({
      policy_delivery_id: params.policyDeliveryId,
      ticket_id: params.ticketId || null,
      user_id: params.userId,
      action: params.action,
      status: params.status || null,
      request_payload: params.requestPayload || null,
      response_raw: params.responseRaw || null,
      error_message: params.errorMessage || null,
      duration_ms: params.durationMs || null,
    });
  } catch (err) {
    console.error("[SICAS] Error logging:", err);
  }
}

// ============================================================
// Duplicate check
// ============================================================

async function checkDuplicateInMovi(
  supabase: any,
  delivery: PolicyDelivery
): Promise<{ isDuplicate: boolean; existingId?: string; message?: string }> {
  const policyNumber = getPolicyNumberFromDelivery(delivery);
  if (!policyNumber) return { isDuplicate: false };

  const { data: existing } = await supabase
    .from("policy_deliveries")
    .select("id, sicas_document_id, sicas_registration_status")
    .eq("policy_number", policyNumber)
    .neq("id", delivery.id)
    .not("sicas_document_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      isDuplicate: true,
      existingId: existing.sicas_document_id,
      message: `La poliza ${policyNumber} ya fue registrada en SICAS con IDDocto ${existing.sicas_document_id}`,
    };
  }

  return { isDuplicate: false };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header requerido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token invalido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, rol, nombre, apellidos")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario || usuario.rol === "Agente") {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permisos para registrar en SICAS" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { policy_delivery_id, resolve_only } = body;

    if (!policy_delivery_id) {
      return new Response(
        JSON.stringify({ success: false, error: "policy_delivery_id requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from("policy_deliveries")
      .select("*")
      .eq("id", policy_delivery_id)
      .maybeSingle();

    if (deliveryError || !delivery) {
      return new Response(
        JSON.stringify({ success: false, error: "Entrega no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== RESOLVE POLICY NUMBER =====
    const policyNumber = getPolicyNumberFromDelivery(delivery as PolicyDelivery);

    console.log(`[SICAS] Policy number resolution:`);
    console.log(`  manual_policy_number: "${delivery.manual_policy_number}"`);
    console.log(`  policy_number: "${delivery.policy_number}"`);
    console.log(`  => Resolved: "${policyNumber}"`);

    if (!policyNumber) {
      const errMsg = "No se pudo resolver un numero de poliza valido. Verifica el numero de poliza.";
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "manual_review_required",
          sicas_error_message: errMsg,
          sicas_manual_review_reason: "No se detecto un numero de poliza valido en los datos de la entrega.",
        })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({ success: false, error: errMsg, status: "manual_review_required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LOAD HWCAPTURE DEFAULTS =====
    const { data: defaults } = await supabase
      .from("sicas_hwcapture_defaults")
      .select("field_name, field_label, default_value, is_required");

    const hwcaptureDefaults: HwcaptureDefault[] = defaults || [];

    // ===== AUTO-RESOLVE REQUIRED FIELDS =====
    console.log(`[SICAS] Running auto-resolution for delivery ${delivery.id}...`);
    const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery as PolicyDelivery, hwcaptureDefaults);

    console.log(`[SICAS] Resolution result: ${Object.keys(resolution.resolved).length} resolved, ${resolution.missing.length} missing`);
    console.log(`[SICAS] Resolved fields:`, JSON.stringify(Object.fromEntries(
      Object.entries(resolution.resolved).map(([k, v]) => [k, `${v.value} (${v.source})`])
    )));
    if (resolution.missing.length > 0) {
      console.log(`[SICAS] Missing fields:`, resolution.missing);
    }
    if (resolution.warnings.length > 0) {
      console.log(`[SICAS] Warnings:`, resolution.warnings);
    }

    // Save resolution to DB for audit
    await supabase
      .from("policy_deliveries")
      .update({
        sicas_resolved_fields: resolution.resolved,
        sicas_resolution_warnings: resolution.warnings.length > 0 ? resolution.warnings : null,
      })
      .eq("id", delivery.id);

    // ===== RESOLVE-ONLY MODE =====
    if (resolve_only) {
      const allResolved = resolution.missing.length === 0;
      if (allResolved) {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_registration_status: "ready_to_register",
            sicas_error_message: null,
            sicas_manual_review_reason: null,
          })
          .eq("id", delivery.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          resolve_only: true,
          all_resolved: allResolved,
          resolved_count: Object.keys(resolution.resolved).length,
          missing_count: resolution.missing.length,
          missing: resolution.missing,
          resolved: Object.fromEntries(
            Object.entries(resolution.resolved).map(([k, v]) => [k, { value: v.value, source: v.source, label: v.label }])
          ),
          warnings: resolution.warnings,
          policy_number: policyNumber,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CHECK IF ALL REQUIRED FIELDS RESOLVED =====
    if (resolution.missing.length > 0) {
      const missingList = resolution.missing.join(", ");
      const errMsg = `Faltan datos obligatorios: ${missingList}. Configura los defaults en Configuracion SICAS o completa los datos manualmente.`;

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "manual_review_required",
          sicas_error_message: errMsg,
          sicas_manual_review_reason: `Campos faltantes: ${missingList}`,
        })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "validation_failed",
        status: "manual_review_required",
        requestPayload: {
          missing_fields: resolution.missing,
          resolved_fields: resolution.resolved,
          warnings: resolution.warnings,
          policy_number: policyNumber,
        },
        errorMessage: errMsg,
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: "manual_review_required",
          error: errMsg,
          missing_fields: resolution.missing,
          resolved_count: Object.keys(resolution.resolved).length,
          warnings: resolution.warnings,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== PREVENT RE-REGISTRATION =====
    if (delivery.sicas_registration_status === "registered" || delivery.sicas_registration_status === "completed") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Esta poliza ya fue registrada en SICAS (IDDocto: ${delivery.sicas_document_id})`,
          status: delivery.sicas_registration_status,
          documentId: delivery.sicas_document_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent concurrent
    if (delivery.sicas_registration_status === "registering") {
      const lastAttempt = delivery.sicas_last_attempt_at ? new Date(delivery.sicas_last_attempt_at).getTime() : 0;
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
      if (lastAttempt > threeMinutesAgo) {
        return new Response(
          JSON.stringify({ success: false, error: "Ya hay un registro en proceso. Espera.", status: "registering" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== CHECK DUPLICATES IN MOVI =====
    const dupCheck = await checkDuplicateInMovi(supabase, delivery as PolicyDelivery);
    if (dupCheck.isDuplicate) {
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "duplicate_found",
          sicas_duplicate_detected: true,
          sicas_duplicate_document_id: dupCheck.existingId || null,
          sicas_error_message: dupCheck.message || "Duplicado detectado en MOVI",
        })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({ success: false, error: dupCheck.message, status: "duplicate_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== BUILD PAYLOAD FROM RESOLUTION =====
    const { payload, fieldValues } = buildFormPayloadFromResolution(delivery as PolicyDelivery, policyNumber, resolution);

    // ===== MARK AS REGISTERING =====
    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "registering",
        sicas_last_attempt_at: new Date().toISOString(),
        sicas_registration_attempts: (delivery.sicas_registration_attempts || 0) + 1,
      })
      .eq("id", delivery.id);

    // ===== AUTHENTICATE WITH SICAS =====
    const sicasBaseUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");
    const sicasCodeAuth = Deno.env.get("SICAS_CODE_AUTH");

    if (!sicasUsername || !sicasPassword) {
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "error", sicas_error_message: "Credenciales SICAS no configuradas" })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({ success: false, error: "Credenciales SICAS no configuradas en el servidor", status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sicasToken: string;
    try {
      sicasToken = await getSicasToken({ baseUrl: sicasBaseUrl, username: sicasUsername, password: sicasPassword, codeAuth: sicasCodeAuth });
      console.log(`[SICAS] Token obtained successfully`);
    } catch (authErr) {
      const errMsg = `Error autenticando con SICAS: ${authErr instanceof Error ? authErr.message : "unknown"}`;
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "error", sicas_error_message: errMsg })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id, ticketId: delivery.ticket_id, userId: user.id,
        action: "sicas_auth_error", status: "error", errorMessage: errMsg,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg, error_type: "sicas_auth", status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SEND REGISTRATION (form-urlencoded ONLY) =====
    console.log(`\n[SICAS] ========================================`);
    console.log(`[SICAS] Starting registration for delivery: ${delivery.id}`);
    console.log(`[SICAS] Policy number: "${policyNumber}"`);
    console.log(`[SICAS] Content-Type: application/x-www-form-urlencoded`);
    console.log(`[SICAS] Payload fields: ${Object.keys(fieldValues).join(", ")}`);
    console.log(`[SICAS] Payload values: ${JSON.stringify(fieldValues)}`);
    console.log(`[SICAS] Resolution sources: ${JSON.stringify(Object.fromEntries(Object.entries(resolution.resolved).map(([k, v]) => [k, v.source])))}`);
    console.log(`[SICAS] ========================================\n`);

    const saveDataHeaders: Record<string, string> = {
      Authorization: sicasToken,
      "Content-Type": "application/x-www-form-urlencoded",
      Prop_KeyCode: "HWCAPTURE",
      Prop_KeyProcess: "DATA",
      Prop_TProc: "Save_Data",
    };

    let saveResponse: Response;
    try {
      saveResponse = await fetch(`${sicasBaseUrl}/Data/SaveData`, {
        method: "POST",
        headers: saveDataHeaders,
        body: payload.toString(),
      });
    } catch (fetchErr) {
      const errMsg = `Error de conexion con SICAS: ${fetchErr instanceof Error ? fetchErr.message : "unknown"}`;
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "error", sicas_error_message: errMsg })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({ success: false, error: errMsg, status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const httpStatus = saveResponse.status;
    let responseData: any;

    try {
      responseData = await saveResponse.json();
    } catch {
      const rawText = await saveResponse.text();
      responseData = { raw_text: rawText };
    }

    console.log(`[SICAS] Response HTTP ${httpStatus}: ${JSON.stringify(responseData).substring(0, 500)}`);

    const logPayload = {
      content_type: "application/x-www-form-urlencoded",
      form_body: fieldValues,
      resolution_sources: Object.fromEntries(Object.entries(resolution.resolved).map(([k, v]) => [k, v.source])),
      policy_number: policyNumber,
      vendor_sicas_id: delivery.vendor_sicas_id,
      office_sicas_id: delivery.sicas_office_id,
      http_status: httpStatus,
      sicas_response: responseData,
    };

    await supabase
      .from("policy_deliveries")
      .update({
        sicas_request_payload: logPayload,
        sicas_response_raw: responseData,
      })
      .eq("id", delivery.id);

    // ===== PARSE SICAS RESPONSE =====
    const sicasSuccess = responseData?.Sucess === true || responseData?.Success === true;
    const sicasMessage = responseData?.Message || responseData?.Error || "";

    if (!sicasSuccess && sicasMessage.includes("Ya existe el Registro")) {
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "duplicate_found",
          sicas_duplicate_detected: true,
          sicas_error_message: `SICAS: ${sicasMessage}`,
        })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id, ticketId: delivery.ticket_id, userId: user.id,
        action: "sicas_duplicate_found", status: "duplicate_found",
        requestPayload: logPayload, responseRaw: responseData, durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: false, status: "duplicate_found",
          error: `La poliza ya existe en SICAS. No se creo un nuevo documento para evitar duplicados.`,
          sicas_message: sicasMessage,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sicasSuccess) {
      const userError = sicasMessage
        ? `SICAS respondio: "${sicasMessage}"`
        : `SICAS no acepto el registro (HTTP ${httpStatus}). Revisa los datos enviados.`;

      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "error", sicas_error_message: userError })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id, ticketId: delivery.ticket_id, userId: user.id,
        action: "sicas_register_failed", status: "error",
        requestPayload: logPayload, responseRaw: responseData, errorMessage: userError, durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: false, status: "error", error: userError,
          sicas_message: sicasMessage, http_status: httpStatus,
          fields_sent: Object.keys(fieldValues), policy_number_used: policyNumber,
          durationMs: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SUCCESS =====
    const documentId = responseData.IDDocto || responseData.DocumentId || responseData.Id || responseData.Response?.IDDocto || "";

    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "registered",
        sicas_document_id: documentId ? String(documentId) : null,
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: null,
        sicas_manual_review_reason: null,
      })
      .eq("id", delivery.id);

    await logRegistration(supabase, {
      policyDeliveryId: delivery.id, ticketId: delivery.ticket_id, userId: user.id,
      action: "sicas_register_success", status: "registered",
      requestPayload: logPayload, responseRaw: responseData, durationMs: Date.now() - startTime,
    });

    // ===== UPLOAD FILES =====
    let filesUploaded = false;
    let filesError: string | null = null;
    const filesResponses: any[] = [];

    if (documentId) {
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "uploading_files" })
        .eq("id", delivery.id);

      if (delivery.cover_file_path) {
        const coverResult = await uploadFileToCentroDigital({
          baseUrl: sicasBaseUrl, token: sicasToken,
          documentId: String(documentId), fileUrl: delivery.cover_file_path,
          fileName: delivery.cover_file_name || "caratula.pdf",
        });
        filesResponses.push({ file: "cover", ...coverResult });
        if (!coverResult.success) filesError = coverResult.error || "Error subiendo caratula";
      }

      const additionalFiles = delivery.additional_files || [];
      for (const file of additionalFiles) {
        if (file.path) {
          const result = await uploadFileToCentroDigital({
            baseUrl: sicasBaseUrl, token: sicasToken,
            documentId: String(documentId), fileUrl: file.path,
            fileName: file.name || "documento.pdf",
          });
          filesResponses.push({ file: file.name, ...result });
          if (!result.success && !filesError) filesError = result.error || `Error subiendo ${file.name}`;
        }
      }

      filesUploaded = filesResponses.length > 0 && filesResponses.every((r) => r.success);

      const finalStatus = filesUploaded ? "completed" : "registered";
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: finalStatus,
          sicas_files_upload_status: filesUploaded ? "success" : (filesResponses.length > 0 ? "error" : null),
          sicas_files_response_raw: filesResponses.length > 0 ? filesResponses : null,
        })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id, ticketId: delivery.ticket_id, userId: user.id,
        action: filesUploaded ? "file_upload_success" : "file_upload_error",
        status: finalStatus, responseRaw: filesResponses,
        errorMessage: filesError || undefined, durationMs: Date.now() - startTime,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: filesUploaded ? "completed" : "registered",
        documentId: documentId ? String(documentId) : null,
        filesUploaded, filesError,
        resolution_sources: Object.fromEntries(Object.entries(resolution.resolved).map(([k, v]) => [k, v.source])),
        message: documentId
          ? `Poliza registrada en SICAS (IDDocto: ${documentId}).${filesUploaded ? " Documentos subidos al Centro Digital." : ""}${filesError ? " Algunos archivos no se pudieron subir." : ""}`
          : "Poliza registrada en SICAS.",
        durationMs: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    console.error("[SICAS] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
