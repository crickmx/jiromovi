import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FUNCTION_VERSION = "2.3.2";

function jsonResponse(data: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Lazy-loaded modules (populated on first real request)
let _createClient: any = null;
let _CryptoJS: any = null;
let _createSicasRequestManager: any = null;

async function loadSupabaseClient() {
  if (!_createClient) {
    const mod = await import("npm:@supabase/supabase-js@2");
    _createClient = mod.createClient;
  }
  return _createClient;
}

async function loadCryptoJS() {
  if (!_CryptoJS) {
    const mod = await import("npm:crypto-js@4.2.0");
    _CryptoJS = mod.default || mod;
    if (!_CryptoJS?.TripleDES || !_CryptoJS?.enc?.Latin1) {
      throw new Error(
        `CryptoJS loaded but missing required methods. ` +
        `TripleDES=${!!_CryptoJS?.TripleDES}, enc.Latin1=${!!_CryptoJS?.enc?.Latin1}, ` +
        `mode.CBC=${!!_CryptoJS?.mode?.CBC}, pad.ZeroPadding=${!!_CryptoJS?.pad?.ZeroPadding}. ` +
        `Keys: ${Object.keys(_CryptoJS || {}).join(",")}`
      );
    }
  }
  return _CryptoJS;
}

async function loadSicasRequestManager() {
  if (!_createSicasRequestManager) {
    const mod = await import("../_shared/sicasRequestManager.ts");
    _createSicasRequestManager = mod.createSicasRequestManager;
  }
  return _createSicasRequestManager;
}

// Shorthand used by existing code after lazy load
let CryptoJS: any = null;
let createClient: any = null;

// ============================================================
// SICAS SOAP Contract Definitions
// ============================================================
// SICAS WS has two distinct Procesar_String contracts:
//
// 1. CONTACT CREATION: Uses PropertyTypeData with enum value "WS_Contactos"
//    - PropertyTypeProcess: WS_SaveData
//    - PropertyTypeData: WS_Contactos (the ONLY valid value for this field)
//    - PropertyWhatMakeExist: WS_UsarloNoUpdate
//    - PropertyVerifyContact: WS_NombreCompleto
//    - Data prefix: CatContactos.*
//
// 2. DOCUMENT REGISTRATION: Does NOT use PropertyTypeData at all.
//    The document entity type is implied by the DatDocumentos.* field prefix.
//    - PropertyTypeProcess: WS_SaveData
//    - NO PropertyTypeData (sending WS_Documentos/WS_Poliza causes enum error)
//    - Data prefix: DatDocumentos.*
//
// CRITICAL: Never send values starting with "WS_" in PropertyTypeData
// EXCEPT for "WS_Contactos" which is the only proven valid enum value.
// ============================================================

const SICAS_CONTACT_TYPE_DATA = "WS_Contactos" as const;

function validateNoWsPrefix(fieldName: string, value: string): void {
  if (value.startsWith("WS_") && value !== SICAS_CONTACT_TYPE_DATA) {
    throw new Error(
      `Contrato SOAP invalido: ${fieldName} no puede recibir operaciones internas WS_*. ` +
      `Valor recibido: "${value}". Solo "WS_Contactos" es valido como PropertyTypeData. ` +
      `Para documentos/polizas, PropertyTypeData no debe enviarse.`
    );
  }
}

// ============================================================
// Constants and Configuration
// ============================================================

const SICAS_3DES_KEY = "%SOnlineBOGO2001-2015WS#";
const SICAS_DEFAULT_ENDPOINT = "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx";

// Map of standard field names to SICAS HWCAPTURE field names
const HWCAPTURE_FIELD_MAP: Record<string, string> = {
  FechaInicio: "FDesde",
  FechaFin: "FHasta",
  PrimaTotal: "PrimaNeta",
  IDFPago: "FPago",
  IDEjecutivo: "IDEjecut",
  Estatus: "Status",
  IDSubRamo: "IDSRamo",
};

// Fields that might contain the SICAS document ID in responses
const DOCUMENT_ID_FIELDS = [
  "IDDocto", "IDDocumento", "ID_Docto", "DocumentoID",
  "NewIDValue", "NewSubIDValue", "RESPONSENBR", "DATA", "ID",
];

// Required fields for HWCAPTURE registration
const HWCAPTURE_REQUIRED_FIELDS = [
  "IDCli", "IDVend", "Documento", "IDCia", "IDRamo", "IDSubRamo",
  "IDMon", "IDFPago", "IDEjecutivo", "FechaInicio", "FechaFin",
  "PrimaTotal", "Estatus", "IDTipoDocto",
];

// ============================================================
// Type Definitions
// ============================================================

type RegistrationStep =
  | "start"
  | "authenticate_sicas"
  | "resolve_required_fields"
  | "create_contact"
  | "validate_payload"
  | "save_hwcapture"
  | "verify_document"
  | "completed";

interface StepError {
  step: RegistrationStep;
  message: string;
  details?: any;
}

interface HwcaptureDefault {
  field_name: string;
  default_value: string | null;
  default_label: string | null;
}

interface ResolvedField {
  value: string;
  source: string;
  label?: string;
}

interface FieldResolution {
  resolved: Record<string, ResolvedField>;
  missing: string[];
  warnings: string[];
  logs: string[];
}

interface CatalogRecord {
  id_sicas: string;
  nombre: string;
  catalog_type_id: number;
  raw?: any;
  metadata?: any;
}

interface ContactCreateResult {
  success: boolean;
  clientId?: string;
  rawResponse?: string;
  error?: string;
  noIdReturned?: boolean;
}

// ============================================================
// XML Utilities
// ============================================================

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractXmlValueDeep(xml: string, tag: string): string | null {
  // Try exact match first
  const exact = extractXmlValue(xml, tag);
  if (exact) return exact;
  // Try case-insensitive search
  const lowerTag = tag.toLowerCase();
  const lowerXml = xml.toLowerCase();
  const startIdx = lowerXml.indexOf(`<${lowerTag}`);
  if (startIdx === -1) return null;
  const closeTag = `</${lowerTag}>`;
  const endIdx = lowerXml.indexOf(closeTag, startIdx);
  if (endIdx === -1) return null;
  const contentStart = xml.indexOf(">", startIdx) + 1;
  return xml.substring(contentStart, endIdx).trim();
}

// ============================================================
// SOAP Request Builders
// ============================================================

function buildContactSoapEnvelope(
  contactData: Record<string, string>,
  sicasUsername: string,
  sicasPassword: string,
  verifyMethod: string = "WS_NombreCompleto",
  whatMakeExist: string = "WS_UsarloNoUpdate"
): string {
  const encodedPassword = sicasPassword.replace(/ /g, "%20");

  let dataFields = "";
  for (const [key, value] of Object.entries(contactData)) {
    dataFields += `<tem:${key}>${escapeXml(value)}</tem:${key}>\n`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Procesar_String>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${sicasUsername}</tem:UserName>
          <tem:Password>${encodedPassword}</tem:Password>
        </tem:Credentials>
        <tem:PropertyTypeProcess>WS_SaveData</tem:PropertyTypeProcess>
        <tem:PropertyTypeData>${SICAS_CONTACT_TYPE_DATA}</tem:PropertyTypeData>
        <tem:PropertyWhatMakeExist>${whatMakeExist}</tem:PropertyWhatMakeExist>
        <tem:PropertyVerifyContact>${verifyMethod}</tem:PropertyVerifyContact>
        <tem:Data>
          <tem:CatContactos>
            ${dataFields}
          </tem:CatContactos>
        </tem:Data>
      </tem:oDataWS>
    </tem:Procesar_String>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function buildHwcaptureDataXml(sanitizedPayload: Record<string, string>): string {
  const docElements: string[] = [];
  const fieldMapping: Record<string, string> = {};

  for (const [key, value] of Object.entries(sanitizedPayload)) {
    const hwField = HWCAPTURE_FIELD_MAP[key] || key;
    fieldMapping[key] = hwField;
    docElements.push(`<${hwField}>${escapeXml(value)}</${hwField}>`);
  }

  return `<InfoData><DatDocumentos>${docElements.join("")}</DatDocumentos><DatDoctoDetail><IDDocto>-1</IDDocto></DatDoctoDetail></InfoData>`;
}

function getFieldMapping(sanitizedPayload: Record<string, string>): Record<string, string> {
  const fieldMapping: Record<string, string> = {};
  for (const key of Object.keys(sanitizedPayload)) {
    fieldMapping[key] = HWCAPTURE_FIELD_MAP[key] || key;
  }
  return fieldMapping;
}

// ============================================================
// Contact Creation (SICAS Procesar_String / WS_Contactos)
// ============================================================

async function createSicasContact(
  contactData: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<ContactCreateResult> {
  try {
    const soapEnvelope = buildContactSoapEnvelope(
      contactData, sicasUsername, sicasPassword
    );

    console.log(`[SICAS Contact] Creating contact with data: ${JSON.stringify(contactData)}`);
    console.log(`[SICAS Contact] Endpoint: ${sicasEndpoint}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/Procesar_String",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    console.log(`[SICAS Contact] Response status: ${response.status}`);
    console.log(`[SICAS Contact] Response: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      return {
        success: false,
        error: `SICAS returned HTTP ${response.status}: ${responseText.substring(0, 200)}`,
        rawResponse: responseText,
      };
    }

    // Parse response to find client ID
    const responseNbrMatch = responseText.match(/RESPONSENBR[^>]*>(\d+)/i);
    const responseTxtMatch = responseText.match(/RESPONSETXT[^>]*>([^<]*)/i);

    const responseNbr = responseNbrMatch ? parseInt(responseNbrMatch[1]) : null;
    const responseTxt = responseTxtMatch ? responseTxtMatch[1] : "";

    // Look for the client ID in various possible fields
    let clientId: string | null = null;
    for (const field of ["IDContacto", "IDCli", "NewIDValue", "ID", "RESPONSENBR"]) {
      const val = extractXmlValue(responseText, field);
      if (val && val !== "0" && val !== "-1") {
        clientId = val;
        break;
      }
    }

    // Also check for responseNbr as client ID (common pattern)
    if (!clientId && responseNbr && responseNbr > 0) {
      clientId = String(responseNbr);
    }

    if (clientId) {
      console.log(`[SICAS Contact] Successfully created/found contact: ${clientId}`);
      return { success: true, clientId, rawResponse: responseText };
    }

    // Success response but no ID found
    if (responseNbr === 0 || responseTxt.toLowerCase().includes("exito") || responseTxt.toLowerCase().includes("ok")) {
      console.log(`[SICAS Contact] Contact created but no ID returned. responseTxt=${responseTxt}`);
      return { success: true, noIdReturned: true, rawResponse: responseText };
    }

    return {
      success: false,
      error: `SICAS contact creation returned unexpected response: ${responseTxt || responseText.substring(0, 200)}`,
      rawResponse: responseText,
    };
  } catch (err: any) {
    console.error(`[SICAS Contact] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============================================================
// Catalog Resolution Helpers
// ============================================================

async function lookupCatalog(
  supabase: any,
  catalogTypeId: number,
  searchTerm: string
): Promise<CatalogRecord | null> {
  if (!searchTerm) return null;

  // Try exact match on id_sicas first
  const { data: exactMatch } = await supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre, catalog_type_id, raw, metadata")
    .eq("catalog_type_id", catalogTypeId)
    .eq("id_sicas", searchTerm)
    .eq("is_active", true)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  // Try nombre match
  const { data: nameMatch } = await supabase
    .from("sicas_catalogos")
    .select("id_sicas, nombre, catalog_type_id, raw, metadata")
    .eq("catalog_type_id", catalogTypeId)
    .ilike("nombre", `%${searchTerm}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return nameMatch || null;
}

async function lookupVendedor(
  supabase: any,
  vendedorKey: string | null,
  vendedorName: string | null
): Promise<{ id_sicas: string; nombre: string } | null> {
  if (!vendedorKey && !vendedorName) return null;

  if (vendedorKey) {
    const { data } = await supabase
      .from("sicas_vendedores")
      .select("id_sicas, nombre")
      .or(`id_sicas.eq.${vendedorKey},clave.eq.${vendedorKey}`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  if (vendedorName) {
    const { data } = await supabase
      .from("sicas_vendedores")
      .select("id_sicas, nombre")
      .ilike("nombre", `%${vendedorName}%`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function lookupEjecutivo(
  supabase: any,
  moviUserId: string | null
): Promise<string | null> {
  if (!moviUserId) return null;

  const { data } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .select("sicas_vendedor_id")
    .eq("movi_user_id", moviUserId)
    .maybeSingle();

  return data?.sicas_vendedor_id || null;
}

// ============================================================
// Field Resolution: resolveSicasHwcaptureRequiredFields
// ============================================================

async function resolveSicasHwcaptureRequiredFields(
  supabase: any,
  delivery: any,
  defaults: HwcaptureDefault[]
): Promise<FieldResolution> {
  const resolved: Record<string, ResolvedField> = {};
  const missing: string[] = [];
  const warnings: string[] = [];
  const logs: string[] = [];

  const extracted = (delivery.extracted_data || {}) as Record<string, any>;
  const overrides = {
    IDTipoDocto: delivery.sicas_override_tipo_docto,
    IDCia: delivery.sicas_override_cia,
    IDRamo: delivery.sicas_override_ramo,
    IDSubRamo: delivery.sicas_override_subramo,
    IDMon: delivery.sicas_override_moneda,
    IDFPago: delivery.sicas_override_fpago,
    IDEjecutivo: delivery.sicas_override_ejecutivo,
    IDGrupo: delivery.sicas_override_grupo,
    IDCli: delivery.sicas_override_cliente,
    Estatus: delivery.sicas_override_estatus,
  };

  const defaultsMap: Record<string, HwcaptureDefault> = {};
  for (const d of defaults) {
    defaultsMap[d.field_name] = d;
  }

  // Helper: resolve with priority override > extracted > catalog > default
  function resolveField(
    fieldName: string,
    overrideValue: string | null | undefined,
    extractedValue: string | null | undefined,
    catalogValue: string | null | undefined,
    catalogSource: string = "catalog"
  ): void {
    if (overrideValue && overrideValue !== "0" && overrideValue !== "") {
      resolved[fieldName] = { value: overrideValue, source: "override" };
      logs.push(`${fieldName}: override=${overrideValue}`);
      return;
    }
    if (extractedValue && extractedValue !== "0" && extractedValue !== "") {
      resolved[fieldName] = { value: extractedValue, source: "extracted" };
      logs.push(`${fieldName}: extracted=${extractedValue}`);
      return;
    }
    if (catalogValue && catalogValue !== "0" && catalogValue !== "") {
      resolved[fieldName] = { value: catalogValue, source: catalogSource };
      logs.push(`${fieldName}: ${catalogSource}=${catalogValue}`);
      return;
    }
    // Try defaults
    const def = defaultsMap[fieldName];
    if (def?.default_value && def.default_value !== "0" && def.default_value !== "") {
      resolved[fieldName] = { value: def.default_value, source: "default", label: def.default_label || undefined };
      logs.push(`${fieldName}: default=${def.default_value} (${def.default_label})`);
      return;
    }
    missing.push(`${fieldName} (no source found)`);
    logs.push(`${fieldName}: MISSING`);
  }

  // --- Resolve IDTipoDocto ---
  resolveField("IDTipoDocto", overrides.IDTipoDocto, null, null);

  // --- Resolve IDCia (Insurance Company) ---
  let ciaId: string | null = null;
  if (overrides.IDCia) {
    ciaId = overrides.IDCia;
  } else if (extracted.insurance_company || extracted.aseguradora) {
    const companyName = extracted.insurance_company || extracted.aseguradora;
    const cia = await lookupCatalog(supabase, 1, companyName);
    if (cia) {
      ciaId = cia.id_sicas;
      logs.push(`IDCia: catalog lookup for "${companyName}" => ${cia.id_sicas} (${cia.nombre})`);
    }
  }
  resolveField("IDCia", overrides.IDCia, ciaId, null);

  // --- Resolve IDRamo ---
  let ramoId: string | null = null;
  if (!overrides.IDRamo && (extracted.ramo || extracted.branch)) {
    const ramoName = extracted.ramo || extracted.branch;
    const ramo = await lookupCatalog(supabase, 3, ramoName);
    if (ramo) {
      ramoId = ramo.id_sicas;
      logs.push(`IDRamo: catalog lookup for "${ramoName}" => ${ramo.id_sicas} (${ramo.nombre})`);
    }
  }
  resolveField("IDRamo", overrides.IDRamo, ramoId, null);

  // --- Resolve IDSubRamo ---
  let subRamoId: string | null = null;
  if (!overrides.IDSubRamo && (extracted.subramo || extracted.sub_branch)) {
    const subRamoName = extracted.subramo || extracted.sub_branch;
    const subRamo = await lookupCatalog(supabase, 4, subRamoName);
    if (subRamo) {
      subRamoId = subRamo.id_sicas;
      logs.push(`IDSubRamo: catalog lookup for "${subRamoName}" => ${subRamo.id_sicas} (${subRamo.nombre})`);
    }
  }
  resolveField("IDSubRamo", overrides.IDSubRamo, subRamoId, null);

  // --- Resolve IDMon (Currency) ---
  let monId: string | null = null;
  if (!overrides.IDMon && delivery.currency) {
    const currencyMap: Record<string, string> = {
      "MXN": "1", "Pesos": "1", "pesos": "1", "MN": "1",
      "USD": "2", "Dolares": "2", "dolares": "2",
      "EUR": "3", "Euros": "3",
    };
    monId = currencyMap[delivery.currency] || null;
    if (!monId) {
      const monCat = await lookupCatalog(supabase, 5, delivery.currency);
      if (monCat) monId = monCat.id_sicas;
    }
  }
  resolveField("IDMon", overrides.IDMon, monId, null);

  // --- Resolve IDFPago (Payment Method) ---
  let fpagoId: string | null = null;
  if (!overrides.IDFPago && delivery.payment_method) {
    const paymentMap: Record<string, string> = {
      "Contado": "1", "contado": "1", "Anual": "1",
      "Semestral": "2", "semestral": "2",
      "Trimestral": "3", "trimestral": "3",
      "Mensual": "4", "mensual": "4",
    };
    fpagoId = paymentMap[delivery.payment_method] || null;
    if (!fpagoId) {
      const fpagoCat = await lookupCatalog(supabase, 6, delivery.payment_method);
      if (fpagoCat) fpagoId = fpagoCat.id_sicas;
    }
  }
  resolveField("IDFPago", overrides.IDFPago, fpagoId, null);

  // --- Resolve IDEjecutivo ---
  let ejecutivoId: string | null = null;
  if (!overrides.IDEjecutivo) {
    // Try mapping from movi_user_id
    ejecutivoId = await lookupEjecutivo(supabase, delivery.movi_user_id);
    if (!ejecutivoId && delivery.vendor_sicas_id) {
      ejecutivoId = delivery.vendor_sicas_id;
    }
  }
  resolveField("IDEjecutivo", overrides.IDEjecutivo, ejecutivoId, null);

  // --- Resolve IDVend (Vendor/Seller) ---
  let vendId: string | null = null;
  if (delivery.vendor_sicas_id) {
    vendId = delivery.vendor_sicas_id;
  } else if (delivery.vendor_sicas_key || delivery.vendor_sicas_name) {
    const vend = await lookupVendedor(supabase, delivery.vendor_sicas_key, delivery.vendor_sicas_name);
    if (vend) vendId = vend.id_sicas;
  }
  if (vendId) {
    resolved["IDVend"] = { value: vendId, source: delivery.vendor_sicas_id ? "delivery" : "lookup" };
    logs.push(`IDVend: ${delivery.vendor_sicas_id ? "delivery" : "lookup"}=${vendId}`);
  } else {
    missing.push("IDVend (no vendor_sicas_id or lookup match)");
    logs.push("IDVend: MISSING");
  }

  // --- Resolve Documento (Policy Number) ---
  const policyNumber = delivery.manual_policy_number || delivery.policy_number || extracted.policy_number || extracted.numero_poliza;
  if (policyNumber && policyNumber !== "") {
    resolved["Documento"] = { value: policyNumber, source: delivery.manual_policy_number ? "manual" : "delivery" };
    logs.push(`Documento: ${delivery.manual_policy_number ? "manual" : "delivery"}=${policyNumber}`);
  } else {
    missing.push("Documento (policy_number not found)");
    logs.push("Documento: MISSING");
  }

  // --- Resolve Estatus ---
  resolveField("Estatus", overrides.Estatus, null, null);

  // --- Resolve IDGrupo ---
  resolveField("IDGrupo", overrides.IDGrupo, null, null);

  // --- Resolve FechaInicio (Start Date) ---
  const startDate = delivery.start_date || extracted.start_date || extracted.fecha_inicio || extracted.vigencia_desde;
  if (startDate) {
    resolved["FechaInicio"] = { value: formatSicasDate(startDate), source: "delivery" };
    logs.push(`FechaInicio: delivery=${startDate}`);
  } else {
    missing.push("FechaInicio (start_date not found)");
    logs.push("FechaInicio: MISSING");
  }

  // --- Resolve FechaFin (End Date) ---
  const endDate = delivery.end_date || extracted.end_date || extracted.fecha_fin || extracted.vigencia_hasta;
  if (endDate) {
    resolved["FechaFin"] = { value: formatSicasDate(endDate), source: "delivery" };
    logs.push(`FechaFin: delivery=${endDate}`);
  } else {
    missing.push("FechaFin (end_date not found)");
    logs.push("FechaFin: MISSING");
  }

  // --- Resolve PrimaTotal ---
  const premium = delivery.total_premium || delivery.net_premium || extracted.total_premium || extracted.prima_total;
  if (premium && premium !== "" && premium !== "0") {
    // Clean up: remove currency symbols, commas, etc.
    const cleanPremium = String(premium).replace(/[$,]/g, "").trim();
    resolved["PrimaTotal"] = { value: cleanPremium, source: "delivery" };
    logs.push(`PrimaTotal: delivery=${cleanPremium}`);
  } else {
    missing.push("PrimaTotal (premium not found)");
    logs.push("PrimaTotal: MISSING");
  }

  // --- Resolve IDCli (Client) ---
  if (overrides.IDCli && overrides.IDCli !== "0" && overrides.IDCli !== "") {
    resolved["IDCli"] = { value: overrides.IDCli, source: "override" };
    logs.push(`IDCli: override=${overrides.IDCli}`);
  } else if (delivery.sicas_client_id && delivery.sicas_client_id !== "0") {
    resolved["IDCli"] = { value: delivery.sicas_client_id, source: "previously_resolved" };
    logs.push(`IDCli: previously_resolved=${delivery.sicas_client_id}`);
  } else {
    // Mark for auto-creation
    resolved["IDCli"] = { value: "__auto_create__", source: "needs_creation" };
    logs.push("IDCli: needs_creation (will auto-create contact)");
  }

  return { resolved, missing, warnings, logs };
}

// ============================================================
// Date Formatting
// ============================================================

function formatSicasDate(dateStr: string): string {
  if (!dateStr) return "";
  // If already in dd/MM/yyyy format, return as-is
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // Try to parse ISO or yyyy-MM-dd format
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

// ============================================================
// Payload Validation
// ============================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedPayload: Record<string, string>;
}

function validatePayload(
  resolved: Record<string, ResolvedField>,
  delivery: any
): ValidationResult {
  const errors: string[] = [];
  const sanitizedPayload: Record<string, string> = {};

  // Build sanitized payload from resolved fields
  for (const [fieldName, field] of Object.entries(resolved)) {
    if (!field || !field.value || field.value === "__auto_create__") continue;
    if (field.value === "0" && fieldName === "IDCli") continue; // Skip zero client IDs
    sanitizedPayload[fieldName] = String(field.value);
  }

  // Ensure IDDocto is set to -1 (new document)
  if (!sanitizedPayload["IDDocto"]) {
    sanitizedPayload["IDDocto"] = "-1";
  }

  // Validate required fields
  for (const field of HWCAPTURE_REQUIRED_FIELDS) {
    const val = sanitizedPayload[field];
    if (!val || val === "" || val === "0") {
      // IDCli=0 is OK if it will be auto-created
      if (field === "IDCli" && resolved["IDCli"]?.source === "needs_creation") continue;
      if (field === "IDCli" && resolved["IDCli"]?.source === "auto_created") continue;
      if (field === "IDCli" && resolved["IDCli"]?.source === "created_no_id") continue;
      errors.push(`${field} is missing or zero`);
    }
  }

  // Validate date formats
  for (const dateField of ["FechaInicio", "FechaFin"]) {
    const val = sanitizedPayload[dateField];
    if (val && !/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      // Try to fix the format
      const fixed = formatSicasDate(val);
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fixed)) {
        sanitizedPayload[dateField] = fixed;
      } else {
        errors.push(`${dateField} has invalid date format: ${val} (expected dd/MM/yyyy)`);
      }
    }
  }

  // Validate numeric fields
  for (const numField of ["PrimaTotal"]) {
    const val = sanitizedPayload[numField];
    if (val && isNaN(parseFloat(val))) {
      errors.push(`${numField} is not a valid number: ${val}`);
    }
  }

  return { valid: errors.length === 0, errors, sanitizedPayload };
}

// ============================================================
// SICAS Contact Auto-Creation Logic
// ============================================================

function buildContactDataFromDelivery(delivery: any): Record<string, string> {
  const contactData: Record<string, string> = {};
  const extracted = (delivery.extracted_data || {}) as Record<string, any>;

  // Name
  const insuredName = delivery.insured_name || extracted.insured_name || extracted.nombre_asegurado || "";
  if (insuredName) {
    // Try to split into first/last names
    const parts = insuredName.trim().split(/\s+/);
    if (parts.length >= 3) {
      contactData["Nombre"] = parts[0];
      contactData["ApPat"] = parts[1];
      contactData["ApMat"] = parts.slice(2).join(" ");
    } else if (parts.length === 2) {
      contactData["Nombre"] = parts[0];
      contactData["ApPat"] = parts[1];
    } else {
      contactData["Nombre"] = insuredName;
    }
    contactData["NombreCompleto"] = insuredName;
  }

  // RFC
  const rfc = delivery.insured_rfc || extracted.rfc || "";
  if (rfc) {
    contactData["RFC"] = rfc;
  }

  // Type (default to individual)
  contactData["TipoContacto"] = "F"; // Persona Fisica

  return contactData;
}

async function autoCreateContact(
  delivery: any,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<ContactCreateResult> {
  const contactData = buildContactDataFromDelivery(delivery);

  if (!contactData["Nombre"] && !contactData["NombreCompleto"]) {
    return {
      success: false,
      error: "No insured name available to create contact",
    };
  }

  console.log(`[SICAS Auto-Create] Creating contact for: ${contactData["NombreCompleto"] || contactData["Nombre"]}`);
  return createSicasContact(contactData, sicasEndpoint, sicasUsername, sicasPassword);
}

// ============================================================
// SICAS Lookup Functions
// ============================================================

async function lookupSicasDocument(
  supabase: any,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string,
  policyNumber: string,
  _ciaId: string
): Promise<{ found: boolean; documentId?: string; rawResponse?: string; error?: string }> {
  try {
    const encodedPassword = sicasPassword.replace(/ /g, "%20");

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${sicasUsername}</tem:UserName>
          <tem:Password>${encodedPassword}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>DATA</tem:KeyProcess>
        <tem:KeyCode>HWCAPTURE</tem:KeyCode>
        <tem:TProc>Get_Data</tem:TProc>
        <tem:DataXML><![CDATA[<InfoData><DatDocumentos><Documento>${escapeXml(policyNumber)}</Documento></DatDocumentos></InfoData>]]></tem:DataXML>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;

    console.log(`[SICAS Lookup] Searching for document: ${policyNumber}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ProcesarWS",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseText = await response.text();

    if (!response.ok) {
      return { found: false, error: `HTTP ${response.status}`, rawResponse: responseText };
    }

    // Look for document ID in response
    for (const field of DOCUMENT_ID_FIELDS) {
      const val = extractXmlValueDeep(responseText, field);
      if (val && val !== "0" && val !== "-1") {
        console.log(`[SICAS Lookup] Found document: ${val}`);
        return { found: true, documentId: val, rawResponse: responseText };
      }
    }

    return { found: false, rawResponse: responseText };
  } catch (err: any) {
    console.error(`[SICAS Lookup] Error: ${err.message}`);
    return { found: false, error: err.message };
  }
}

// ============================================================
// Unique Missing Fields Helper
// ============================================================

function uniqueMissingFields(missing: string[]): string[] {
  const seen = new Set<string>();
  return missing.filter((m) => {
    const key = m.split(" ")[0]; // Use the field name part
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// Encryption Function
// ============================================================

function encryptDataXmlFallback(plainXml: string, username: string): string {
  if (!CryptoJS?.TripleDES?.encrypt) {
    throw new Error("CryptoJS.TripleDES.encrypt is not available");
  }
  if (!CryptoJS?.enc?.Latin1?.parse) {
    throw new Error("CryptoJS.enc.Latin1.parse is not available");
  }

  // URL-encode the XML before encrypting (per SICAS docs)
  const urlEncodedXml = encodeURIComponent(plainXml);

  // Key: exactly 24 bytes for TripleDES (192-bit) - parse as Latin1 word array
  const key = CryptoJS.enc.Latin1.parse(SICAS_3DES_KEY);

  // IV: first 8 characters of username, padded with null bytes
  const ivStr = username.substring(0, 8).padEnd(8, "\0");
  const iv = CryptoJS.enc.Latin1.parse(ivStr);

  // Encrypt using TripleDES CBC with ZeroPadding
  const encrypted = CryptoJS.TripleDES.encrypt(
    urlEncodedXml,
    key,
    { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding }
  );

  const result = encrypted.toString();

  // Verify encryption actually produced base64 output different from input
  if (!result || result.length < 10 || result.includes("<InfoData>") || result.includes("<DatDocumentos>")) {
    throw new Error(
      `Encryption produced invalid output (plain XML detected in result). ` +
      `Result length: ${result?.length}, starts with: ${result?.substring(0, 30)}`
    );
  }

  return result;
}

// ============================================================
// Document Registration Diagnostics Interface
// ============================================================

interface DocumentRegistrationDiagnostic {
  executed: boolean;
  method: string;
  key_process: string;
  key_code: string;
  tproc: string;
  type_format: string;
  payload_fields: Record<string, string>;
  missing_fields: string[];
  field_mapping: Record<string, string>;
  plain_data_xml: string;
  encrypted_data_xml_length: number;
  soap_request_redacted: string;
  soap_response: string;
  parsed_response: { response_nbr: number | null; response_txt: string; has_success: boolean; has_error: boolean } | null;
  detected_id_docto: string | null;
  document_stage_status: "not_attempted" | "sent_to_sicas" | "success_with_id" | "success_without_id" | "not_created" | "failed" | "duplicate";
  encryption_used: boolean;
  encryption_method: string;
  iv_used: string;
  error_message: string | null;
}

interface RegisterDocumentResult {
  success: boolean;
  documentId?: string;
  noIdReturned?: boolean;
  rawResponse?: string;
  error?: string;
  stage?: string;
  stepError?: StepError;
  isDuplicate?: boolean;
  duplicateId?: string;
  duplicateMessage?: string;
  diagnostics?: DocumentRegistrationDiagnostic | any;
}

// ============================================================
// Document Registration (HWCAPTURE ProcesarWS)
// ============================================================

async function registerDocument(
  sanitizedPayload: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<RegisterDocumentResult> {
  const dataXmlPlain = buildHwcaptureDataXml(sanitizedPayload);
  const fieldMapping = getFieldMapping(sanitizedPayload);
  const encodedPassword = sicasPassword.replace(/ /g, "%20");

  // Encrypt DataXML per SICAS V3 requirements
  let dataXmlEncrypted: string;
  let encryptionMethod = "none";
  try {
    dataXmlEncrypted = encryptDataXmlFallback(dataXmlPlain, sicasUsername);
    encryptionMethod = "CryptoJS-TripleDES-CBC";
  } catch (encErr: any) {
    console.error(`[SICAS Register] Encryption failed: ${encErr.message}. BLOCKING - will NOT send plain XML.`);
    return {
      success: false,
      stage: "document_registration",
      error: `Cifrado TripleDES fallo: ${encErr.message}. Contacte soporte tecnico.`,
      diagnostics: { encryption_error: encErr.message, encryption_method: "FAILED" },
    };
  }

  const ivUsed = sicasUsername.substring(0, 8).padEnd(8, "\0");

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${sicasUsername}</tem:UserName>
          <tem:Password>${encodedPassword}</tem:Password>
        </tem:Credentials>
        <tem:TypeFormat>XML</tem:TypeFormat>
        <tem:KeyProcess>DATA</tem:KeyProcess>
        <tem:KeyCode>HWCAPTURE</tem:KeyCode>
        <tem:TProc>Save_Data</tem:TProc>
        <tem:DataXML>${dataXmlEncrypted}</tem:DataXML>
      </tem:oDataWS>
    </tem:ProcesarWS>
  </soapenv:Body>
</soapenv:Envelope>`;

  console.log(`[SICAS Register] SOAP Method: ProcesarWS`);
  console.log(`[SICAS Register] KeyProcess: DATA`);
  console.log(`[SICAS Register] KeyCode: HWCAPTURE`);
  console.log(`[SICAS Register] TProc: Save_Data`);
  console.log(`[SICAS Register] TypeFormat: XML`);
  console.log(`[SICAS Register] Encryption: ${encryptionMethod}`);
  console.log(`[SICAS Register] IV (username prefix): ${ivUsed}`);
  console.log(`[SICAS Register] Endpoint: ${sicasEndpoint}`);
  console.log(`[SICAS Register] Fields count: ${Object.keys(sanitizedPayload).length}`);
  console.log(`[SICAS Register] Field mapping: ${JSON.stringify(fieldMapping)}`);
  console.log(`[SICAS Register] DataXML plain: ${dataXmlPlain}`);
  console.log(`[SICAS Register] DataXML encrypted length: ${dataXmlEncrypted.length}`);
  console.log(`[SICAS Register] DataXML encrypted preview: ${dataXmlEncrypted.substring(0, 80)}...`);

  const requiredFields = ["IDCli", "IDVend", "Documento", "IDCia", "IDRamo", "IDSubRamo", "IDMon", "IDFPago", "IDEjecutivo", "FechaInicio", "FechaFin", "PrimaTotal", "Estatus", "IDTipoDocto"];
  const missingFields = requiredFields.filter(f => !sanitizedPayload[f] || sanitizedPayload[f] === "0" || sanitizedPayload[f] === "");

  const baseDiagnostics: DocumentRegistrationDiagnostic = {
    executed: true,
    method: "ProcesarWS",
    key_process: "DATA",
    key_code: "HWCAPTURE",
    tproc: "Save_Data",
    type_format: "XML",
    payload_fields: { ...sanitizedPayload },
    missing_fields: missingFields,
    field_mapping: fieldMapping,
    plain_data_xml: dataXmlPlain,
    encrypted_data_xml_length: dataXmlEncrypted.length,
    soap_request_redacted: soapEnvelope.replace(/<tem:Password>[^<]*<\/tem:Password>/, "<tem:Password>***</tem:Password>"),
    soap_response: "",
    parsed_response: null,
    detected_id_docto: null,
    document_stage_status: "not_attempted",
    encryption_used: encryptionMethod !== "none",
    encryption_method: encryptionMethod,
    iv_used: ivUsed,
    error_message: null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ProcesarWS",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    baseDiagnostics.soap_response = responseText;
    baseDiagnostics.document_stage_status = "sent_to_sicas";

    console.log(`[SICAS Register] Response status: ${response.status}`);
    console.log(`[SICAS Register] Response length: ${responseText.length}`);
    console.log(`[SICAS Register] Response preview: ${responseText.substring(0, 300)}`);

    if (!response.ok) {
      baseDiagnostics.document_stage_status = "failed";
      baseDiagnostics.error_message = `HTTP ${response.status}`;
      return {
        success: false,
        error: `SICAS returned HTTP ${response.status}`,
        rawResponse: responseText,
        diagnostics: baseDiagnostics,
        stepError: { step: "save_hwcapture", message: `SICAS HTTP ${response.status}`, details: responseText.substring(0, 500) },
      };
    }

    // Parse response - supports two SICAS response formats:
    // 1. Procesar_String: RESPONSENBR / RESPONSETXT
    // 2. ProcesarWS: Sucess / MsgError (inside DATAINFO)
    const responseNbrMatch = responseText.match(/RESPONSENBR[^>]*>(-?\d+)/i);
    const responseTxtMatch = responseText.match(/RESPONSETXT[^>]*>([^<]*)/i);
    const sucessMatch = responseText.match(/Sucess[^>]*>(\d+)/i);
    const msgErrorMatch = responseText.match(/MsgError[^>]*>([^<]*)/i);

    const responseNbr = responseNbrMatch ? parseInt(responseNbrMatch[1]) : null;
    const responseTxt = responseTxtMatch ? responseTxtMatch[1] : "";
    const sucessValue = sucessMatch ? parseInt(sucessMatch[1]) : null;
    const msgError = msgErrorMatch ? msgErrorMatch[1].trim() : null;

    // ProcesarWS uses Sucess=0 for success (0 errors), MsgError empty = no error
    const isProcesarWsSuccess = sucessValue === 0 && (!msgError || msgError === "");
    const isProcesarWsError = sucessValue !== null && sucessValue !== 0;

    baseDiagnostics.parsed_response = {
      response_nbr: responseNbr,
      response_txt: responseTxt || msgError || "",
      sucess_value: sucessValue,
      msg_error: msgError,
      has_success: isProcesarWsSuccess || responseTxt.toLowerCase().includes("exito") || responseTxt.toLowerCase().includes("ok") || (responseNbr !== null && responseNbr >= 0),
      has_error: isProcesarWsError || responseTxt.toLowerCase().includes("error") || (responseNbr !== null && responseNbr < 0) || (!!msgError && msgError.length > 0),
    };

    // Check for duplicate
    if (responseTxt.toLowerCase().includes("duplicad") || responseTxt.toLowerCase().includes("ya existe") || responseTxt.toLowerCase().includes("already exist")) {
      // Try to extract existing document ID
      let dupId: string | null = null;
      for (const field of DOCUMENT_ID_FIELDS) {
        const val = extractXmlValueDeep(responseText, field);
        if (val && val !== "0" && val !== "-1") {
          dupId = val;
          break;
        }
      }
      baseDiagnostics.document_stage_status = "duplicate";
      baseDiagnostics.detected_id_docto = dupId;
      return {
        success: true,
        isDuplicate: true,
        duplicateId: dupId || undefined,
        duplicateMessage: responseTxt,
        documentId: dupId || undefined,
        rawResponse: responseText,
        diagnostics: baseDiagnostics,
      };
    }

    // Look for document ID in response
    let documentId: string | null = null;
    for (const field of DOCUMENT_ID_FIELDS) {
      const val = extractXmlValueDeep(responseText, field);
      if (val && val !== "0" && val !== "-1") {
        documentId = val;
        break;
      }
    }

    // Also try responseNbr as document ID
    if (!documentId && responseNbr && responseNbr > 0) {
      documentId = String(responseNbr);
    }

    baseDiagnostics.detected_id_docto = documentId;

    if (documentId) {
      baseDiagnostics.document_stage_status = "success_with_id";
      console.log(`[SICAS Register] Document registered successfully: ${documentId}`);
      return {
        success: true,
        documentId,
        rawResponse: responseText,
        diagnostics: baseDiagnostics,
      };
    }

    // Success response but no document ID
    if (baseDiagnostics.parsed_response.has_success && !baseDiagnostics.parsed_response.has_error) {
      baseDiagnostics.document_stage_status = "success_without_id";
      console.log(`[SICAS Register] Document registration succeeded but no ID returned. Response: ${responseTxt}`);
      return {
        success: true,
        noIdReturned: true,
        rawResponse: responseText,
        diagnostics: baseDiagnostics,
      };
    }

    // Error
    baseDiagnostics.document_stage_status = "failed";
    baseDiagnostics.error_message = responseTxt || "Unknown error from SICAS";
    return {
      success: false,
      error: `SICAS error: ${responseTxt || "No response text"}`,
      rawResponse: responseText,
      diagnostics: baseDiagnostics,
      stepError: { step: "save_hwcapture", message: responseTxt || "SICAS error", details: responseText.substring(0, 500) },
    };
  } catch (fetchErr: any) {
    baseDiagnostics.document_stage_status = "failed";
    baseDiagnostics.error_message = fetchErr.message;
    console.error(`[SICAS Register] Fetch error: ${fetchErr.message}`);
    return {
      success: false,
      error: `Error de conexion SICAS: ${fetchErr.message}`,
      diagnostics: baseDiagnostics,
      stepError: { step: "save_hwcapture", message: fetchErr.message },
    };
  }
}

// ============================================================
// Main Deno.serve Handler
// ============================================================

Deno.serve(async (req: Request) => {
  // === CORS preflight: respond IMMEDIATELY, no imports ===
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    let body: Record<string, any> = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    // === health_check: no imports needed ===
    if (body.health_check === true) {
      return jsonResponse({
        success: true,
        function: "sicas-register-policy-delivery",
        status: "ok",
        version: FUNCTION_VERSION,
        imports_loaded: false,
        timestamp: new Date().toISOString(),
      });
    }

    // === test_imports: load all modules and report ===
    if (body.test_imports === true) {
      const importResults: Record<string, any> = {};
      try {
        await loadSupabaseClient();
        importResults.supabase = { success: true };
      } catch (e: any) {
        importResults.supabase = { success: false, error: e.message };
      }
      try {
        await loadCryptoJS();
        importResults.crypto_js = {
          success: true,
          has_TripleDES: !!_CryptoJS?.TripleDES,
          has_enc_Latin1: !!_CryptoJS?.enc?.Latin1,
          has_mode_CBC: !!_CryptoJS?.mode?.CBC,
          has_pad_ZeroPadding: !!_CryptoJS?.pad?.ZeroPadding,
        };
      } catch (e: any) {
        importResults.crypto_js = { success: false, error: e.message };
      }
      try {
        await loadSicasRequestManager();
        importResults.sicas_request_manager = { success: true };
      } catch (e: any) {
        importResults.sicas_request_manager = { success: false, error: e.message };
      }
      return jsonResponse({
        success: Object.values(importResults).every((r: any) => r.success),
        function: "sicas-register-policy-delivery",
        version: FUNCTION_VERSION,
        imports: importResults,
        timestamp: new Date().toISOString(),
      });
    }

    // === ping_sicas: test SICAS endpoint reachability ===
    if (body.ping_sicas === true) {
      const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || SICAS_DEFAULT_ENDPOINT;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(sicasEndpoint, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return jsonResponse({
          success: true,
          function: "sicas-register-policy-delivery",
          sicas_endpoint: sicasEndpoint,
          sicas_status: resp.status,
          sicas_reachable: true,
          timestamp: new Date().toISOString(),
        });
      } catch (e: any) {
        return jsonResponse({
          success: false,
          function: "sicas-register-policy-delivery",
          sicas_endpoint: sicasEndpoint,
          sicas_reachable: false,
          sicas_error: e.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // === REAL FLOW: Load all heavy modules ===
    createClient = await loadSupabaseClient();
    CryptoJS = await loadCryptoJS();

    let currentStep: RegistrationStep = "start";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Circuit breaker check (non-blocking: if import fails, skip check)
    try {
      const createSicasRequestManager = await loadSicasRequestManager();
      const requestManager = createSicasRequestManager(supabase);
      const cbState = await requestManager.checkCircuitBreaker();
      if (cbState.is_open) {
        return jsonResponse({
          success: false,
          step: "start",
          error: "SICAS esta respondiendo con errores o lentitud. Proceso pausado temporalmente.",
          circuit_breaker: cbState,
        }, 503);
      }
    } catch (cbErr: any) {
      console.warn(`[SICAS] Circuit breaker check skipped: ${cbErr.message}`);
    }

    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || "";

    // === Step: authenticate_sicas ===
    currentStep = "authenticate_sicas";
    if (!sicasUsername || !sicasPassword) {
      throw new Error("SICAS credentials not configured (SICAS_USERNAME / SICAS_PASSWORD)");
    }
    if (!sicasEndpoint) {
      throw new Error("SICAS endpoint not configured (SICAS_SOAP_ENDPOINT or SICAS_ENDPOINT)");
    }
    const { action = "resolve" } = body;
    const debugOptions = body.debug_options || {};
    const skipAutoCreateClient = debugOptions.skip_auto_create_client === true;
    const delivery_id = body.delivery_id || body.policy_delivery_id || body.policyDeliveryId || body.deliveryId || body.id;

    console.log(`[SICAS] action=${action}, delivery_id=${delivery_id}, skipAutoCreate=${skipAutoCreateClient}`);

    if (!delivery_id) {
      return new Response(
        JSON.stringify({
          success: false,
          step: currentStep,
          error: "delivery_id is required",
          debug_received_keys: Object.keys(body),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: delivery, error: fetchError } = await supabase
      .from("policy_deliveries")
      .select("*")
      .eq("id", delivery_id)
      .maybeSingle();

    if (fetchError || !delivery) {
      throw new Error(`Policy delivery not found: ${fetchError?.message || "no data"}`);
    }

    const { data: defaultsData } = await supabase
      .from("sicas_hwcapture_defaults")
      .select("field_name, default_value, default_label");
    const defaults: HwcaptureDefault[] = defaultsData || [];

    // === RESOLVE action ===
    if (action === "resolve") {
      currentStep = "resolve_required_fields";
      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);
      const dedupedMissing = uniqueMissingFields(resolution.missing);

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_resolved_fields: resolution.resolved,
          sicas_resolution_warnings: resolution.warnings,
          sicas_registration_status: dedupedMissing.length === 0 ? "ready_to_register" : "pending_fields",
        })
        .eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: true,
          action,
          status: dedupedMissing.length === 0 ? "ready_to_register" : "pending_fields",
          resolved: resolution.resolved,
          missing: dedupedMissing,
          warnings: resolution.warnings,
          logs: resolution.logs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REGISTER action: register document only (assumes fields already resolved) ===
    if (action === "register") {
      currentStep = "resolve_required_fields";
      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);
      const dedupedMissing = uniqueMissingFields(resolution.missing);

      if (dedupedMissing.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "pending_fields",
            message: `Cannot register: missing fields: ${dedupedMissing.join(", ")}`,
            missing: dedupedMissing,
            resolved: resolution.resolved,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      currentStep = "validate_payload";
      const validation = validatePayload(resolution.resolved, delivery);

      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "validation_failed",
            message: `Payload invalido: ${validation.errors.join("; ")}`,
            validation_errors: validation.errors,
            resolved: resolution.resolved,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      currentStep = "save_hwcapture";
      const hwResult = await registerDocument(
        validation.sanitizedPayload,
        sicasEndpoint,
        sicasUsername,
        sicasPassword
      );

      if (hwResult.success && hwResult.documentId) {
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: hwResult.isDuplicate ? "duplicate" : "created",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action,
            status: "registered",
            document_id: hwResult.documentId,
            is_duplicate: hwResult.isDuplicate || false,
            diagnostics: hwResult.diagnostics,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registration failed
      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "failed",
        sicas_error_step: "save_hwcapture",
        sicas_error_message: hwResult.error || "Document registration failed",
        sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          action,
          status: "failed",
          error: hwResult.error,
          diagnostics: hwResult.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === AUTO action: full flow - resolve, create contact, validate, register ===
    if (action === "auto") {
      const steps: Array<{ step: string; status: string; detail?: string }> = [];

      // Step: resolve_required_fields
      currentStep = "resolve_required_fields";
      steps.push({ step: currentStep, status: "in_progress" });

      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);
      const dedupedMissing = uniqueMissingFields(resolution.missing);

      steps[steps.length - 1].status = "completed";
      steps[steps.length - 1].detail = `${Object.keys(resolution.resolved).length} campos resueltos, ${dedupedMissing.length} faltantes`;

      // Step: create_contact (if needed)
      let clientNeedsCreation = false;
      if (resolution.resolved.IDCli?.value === "__auto_create__" || resolution.resolved.IDCli?.source === "needs_creation") {
        clientNeedsCreation = true;
      }

      if (clientNeedsCreation && !skipAutoCreateClient) {
        currentStep = "create_contact";
        steps.push({ step: currentStep, status: "in_progress" });

        const contactResult = await autoCreateContact(
          delivery, sicasEndpoint, sicasUsername, sicasPassword
        );

        if (contactResult.success && contactResult.clientId) {
          resolution.resolved.IDCli = { value: contactResult.clientId, source: "auto_created" };
          resolution.missing = resolution.missing.filter((m: string) => !m.includes("IDCli"));
          steps[steps.length - 1].status = "completed";
          steps[steps.length - 1].detail = `Contact created: ${contactResult.clientId}`;

          // Store the client ID
          await supabase.from("policy_deliveries").update({
            sicas_client_id: contactResult.clientId,
            sicas_client_auto_created: true,
            sicas_client_created_at: new Date().toISOString(),
            sicas_client_create_response_raw: contactResult.rawResponse ? { raw: contactResult.rawResponse } : null,
            sicas_contact_status: "created",
            sicas_contact_response: contactResult.rawResponse ? { raw: contactResult.rawResponse } : null,
          }).eq("id", delivery_id);
        } else if (contactResult.success && contactResult.noIdReturned) {
          resolution.resolved.IDCli = { value: "0", source: "created_no_id" };
          steps[steps.length - 1].status = "completed";
          steps[steps.length - 1].detail = "Contact created but no ID returned";

          await supabase.from("policy_deliveries").update({
            sicas_client_auto_created: true,
            sicas_client_created_at: new Date().toISOString(),
            sicas_client_create_response_raw: contactResult.rawResponse ? { raw: contactResult.rawResponse } : null,
            sicas_contact_status: "created_no_id",
          }).eq("id", delivery_id);
        } else {
          resolution.resolved.IDCli = { value: "0", source: "fallback_create_failed" };
          steps[steps.length - 1].status = "failed";
          steps[steps.length - 1].detail = contactResult.error || "Contact creation failed";

          await supabase.from("policy_deliveries").update({
            sicas_contact_status: "creation_failed",
            sicas_error_message: `Contact creation failed: ${contactResult.error}`,
          }).eq("id", delivery_id);
        }
      }

      // Step: validate_payload
      currentStep = "validate_payload";
      steps.push({ step: currentStep, status: "in_progress" });

      const validation = validatePayload(resolution.resolved, delivery);

      if (!validation.valid) {
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].detail = validation.errors.join("; ");

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "manual_review_required",
          sicas_error_step: "validate_payload",
          sicas_error_message: `Payload invalido: ${validation.errors.join("; ")}`,
          sicas_request_debug: {
            document_registration_diagnostic: {
              executed: false,
              method: "ProcesarWS",
              key_process: "DATA",
              key_code: "HWCAPTURE",
              tproc: "Save_Data",
              type_format: "XML",
              payload_fields: validation.sanitizedPayload || {},
              missing_fields: validation.errors || [],
              field_mapping: {},
              plain_data_xml: "",
              encrypted_data_xml_length: 0,
              soap_request_redacted: "",
              soap_response: "",
              parsed_response: null,
              detected_id_docto: null,
              document_stage_status: "not_attempted",
              encryption_used: false,
              encryption_method: "none",
              iv_used: "",
              error_message: `Payload invalido: ${validation.errors.join("; ")}`,
            },
            validation_errors: validation.errors,
          },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "payload_invalid",
            step: "validate_payload",
            message: `Payload invalido: ${validation.errors.join("; ")}`,
            steps,
            validation_errors: validation.errors,
            sanitized_payload: validation.sanitizedPayload,
            resolved: resolution.resolved,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      steps[steps.length - 1].status = "completed";
      steps[steps.length - 1].detail = `${Object.keys(validation.sanitizedPayload).length} campos validados`;

      // Step: save_hwcapture
      currentStep = "save_hwcapture";
      steps.push({ step: currentStep, status: "in_progress" });

      const attempts = (delivery.sicas_registration_attempts || 0) + 1;
      // Determine contact status early so we track it before HWCAPTURE
      let contactStatus: string;
      if (!clientNeedsCreation) {
        contactStatus = resolution.resolved.IDCli?.value && resolution.resolved.IDCli.value !== "0" ? "existing" : "not_attempted";
      } else if (resolution.resolved.IDCli?.source === "auto_created") {
        contactStatus = "created";
      } else if (resolution.resolved.IDCli?.source === "created_no_id") {
        contactStatus = "created_no_id";
      } else if (resolution.resolved.IDCli?.source === "fallback_create_failed") {
        contactStatus = "creation_failed";
      } else {
        contactStatus = "existing";
      }

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "registering",
        sicas_registration_stage: "save_hwcapture",
        sicas_registration_attempts: attempts,
        sicas_last_attempt_at: new Date().toISOString(),
        sicas_resolved_fields: resolution.resolved,
        sicas_request_payload: validation.sanitizedPayload,
        sicas_contact_status: contactStatus,
        sicas_error_step: null,
        sicas_error_message: null,
      }).eq("id", delivery_id);

      console.log(`[SICAS Register] Proceeding to HWCAPTURE. IDCli=${validation.sanitizedPayload.IDCli || "0"}, contactStatus=${contactStatus}, fields=${Object.keys(validation.sanitizedPayload).length}`);

      const hwResult = await registerDocument(
        validation.sanitizedPayload,
        sicasEndpoint,
        sicasUsername,
        sicasPassword
      );

      if (hwResult.success && hwResult.documentId) {
        // FULL SUCCESS: SICAS returned a valid document ID
        currentStep = "completed";
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = `Documento SICAS: ${hwResult.documentId}`;

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_contact_status: contactStatus,
          sicas_document_status: "created",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action,
            overall_status: "success",
            status: "registered",
            document_id: hwResult.documentId,
            is_duplicate: hwResult.isDuplicate || false,
            duplicate_message: hwResult.duplicateMessage || null,
            contact_status: contactStatus,
            client_id: validation.sanitizedPayload.IDCli,
            steps,
            resolved: resolution.resolved,
            sanitized_payload: validation.sanitizedPayload,
            logs: resolution.logs,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (hwResult.success && hwResult.noIdReturned) {
        // PARTIAL SUCCESS: SICAS accepted but no ID
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = "SICAS acepto el documento pero no devolvio ID";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered_no_id",
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_contact_status: contactStatus,
          sicas_document_status: "created_no_id",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action,
            overall_status: "partial_success",
            status: "registered_no_id",
            document_id: null,
            no_id_returned: true,
            contact_status: contactStatus,
            client_id: validation.sanitizedPayload.IDCli,
            steps,
            resolved: resolution.resolved,
            sanitized_payload: validation.sanitizedPayload,
            logs: resolution.logs,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (hwResult.isDuplicate) {
        // DUPLICATE: SICAS says document already exists
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = `Duplicado detectado: ${hwResult.duplicateId || "sin ID"}`;

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.duplicateId || null,
          sicas_registered_at: new Date().toISOString(),
          sicas_duplicate_detected: true,
          sicas_duplicate_document_id: hwResult.duplicateId || null,
          sicas_duplicate_message: hwResult.duplicateMessage || null,
          sicas_document_status: "duplicate",
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action,
            overall_status: "duplicate",
            status: "duplicate",
            document_id: hwResult.duplicateId,
            duplicate_message: hwResult.duplicateMessage,
            contact_status: contactStatus,
            steps,
            resolved: resolution.resolved,
            sanitized_payload: validation.sanitizedPayload,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // FAILURE: SICAS returned an error
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].detail = hwResult.error || "SICAS registration failed";

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "failed",
        sicas_error_step: "save_hwcapture",
        sicas_error_message: hwResult.error || "Document registration failed",
        sicas_contact_status: contactStatus,
        sicas_document_status: "failed",
        sicas_registration_stage: "save_hwcapture",
        sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          action,
          overall_status: "failed",
          status: "document_registration_failed",
          step: "save_hwcapture",
          error: hwResult.error,
          contact_status: contactStatus,
          client_id: validation.sanitizedPayload.IDCli,
          steps,
          step_error: hwResult.stepError || null,
          resolved: resolution.resolved,
          sanitized_payload: validation.sanitizedPayload,
          logs: resolution.logs,
          document_registration_diagnostic: hwResult.diagnostics || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === RETRY_DOCUMENT action: retry only the document step using existing resolved data ===
    if (action === "retry_document") {
      const steps: Array<{ step: string; status: string; detail?: string }> = [];

      let existingPayload = delivery.sicas_request_payload as Record<string, string> | null;

      // If no payload exists from a previous attempt, re-resolve fields using existing client ID
      if (!existingPayload || Object.keys(existingPayload).length === 0) {
        currentStep = "resolve_required_fields";
        steps.push({ step: "resolve_required_fields", status: "in_progress" });

        const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);

        // Use previously stored client ID if available
        const storedClientId = delivery.sicas_client_id || (delivery.sicas_resolved_fields as any)?.IDCli?.value;
        if (storedClientId && storedClientId !== "0" && storedClientId !== "__auto_create__") {
          resolution.resolved.IDCli = { value: storedClientId, source: "previously_resolved" };
          resolution.missing = resolution.missing.filter((m: string) => !m.includes("IDCli"));
        }

        // Remove missing IDCli - the point of retry_document is that client already exists
        resolution.missing = resolution.missing.filter((m: string) => !m.includes("IDCli"));

        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = `${Object.keys(resolution.resolved).length} campos resueltos`;

        // Validate and build payload
        const validation = validatePayload(resolution.resolved, delivery);
        if (!validation.valid) {
          await supabase.from("policy_deliveries").update({
            sicas_registration_status: "manual_review_required",
            sicas_error_step: "validate_payload",
            sicas_error_message: `Payload invalido: ${validation.errors.join("; ")}`,
            sicas_resolved_fields: resolution.resolved,
            sicas_request_debug: {
              document_registration_diagnostic: {
                executed: false,
                method: "ProcesarWS",
                key_process: "DATA",
                key_code: "HWCAPTURE",
                tproc: "Save_Data",
                type_format: "XML",
                payload_fields: validation.sanitizedPayload || {},
                missing_fields: validation.errors,
                field_mapping: {},
                plain_data_xml: "",
                encrypted_data_xml_length: 0,
                soap_request_redacted: "",
                soap_response: "",
                parsed_response: null,
                detected_id_docto: null,
                document_stage_status: "not_attempted",
                encryption_used: false,
                encryption_method: "none",
                iv_used: "",
                error_message: `Validacion fallida: ${validation.errors.join("; ")}`,
              },
            },
          }).eq("id", delivery_id);

          return new Response(
            JSON.stringify({
              success: false,
              action: "retry_document",
              overall_status: "partial_success",
              status: "validation_failed",
              step: "validate_payload",
              document_status: "validation_failed",
              message: `Contacto/cliente resuelto, pero faltan datos para registrar la poliza. ${validation.errors.join("; ")}`,
              missing_fields: validation.errors,
              steps,
              resolved: resolution.resolved,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        existingPayload = validation.sanitizedPayload;

        // Save the newly built payload for future retries
        await supabase.from("policy_deliveries").update({
          sicas_request_payload: existingPayload,
          sicas_resolved_fields: resolution.resolved,
          sicas_registration_status: "registering",
          sicas_registration_attempts: (delivery.sicas_registration_attempts || 0) + 1,
          sicas_last_attempt_at: new Date().toISOString(),
          sicas_error_step: null,
          sicas_error_message: null,
        }).eq("id", delivery_id);

        steps.push({ step: "validate_payload", status: "completed", detail: `${Object.keys(existingPayload).length} campos reconstruidos` });
      } else {
        // Re-validate payload from previous attempt
        currentStep = "validate_payload";
        steps.push({ step: "validate_payload", status: "completed", detail: `${Object.keys(existingPayload).length} campos del intento anterior` });

        const attempts = (delivery.sicas_registration_attempts || 0) + 1;
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registering",
          sicas_registration_attempts: attempts,
          sicas_last_attempt_at: new Date().toISOString(),
          sicas_error_step: null,
          sicas_error_message: null,
        }).eq("id", delivery_id);
      }

      // Step: save_hwcapture (retry)
      currentStep = "save_hwcapture";
      steps.push({ step: currentStep, status: "in_progress" });

      const hwResult = await registerDocument(
        existingPayload!,
        sicasEndpoint,
        sicasUsername,
        sicasPassword
      );

      if (hwResult.success && hwResult.documentId) {
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = `Documento SICAS: ${hwResult.documentId}`;

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: hwResult.isDuplicate ? "duplicate" : "created",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
          sicas_duplicate_detected: hwResult.isDuplicate || false,
          sicas_duplicate_document_id: hwResult.isDuplicate ? hwResult.duplicateId : null,
          sicas_duplicate_message: hwResult.duplicateMessage || null,
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_document",
            overall_status: "success",
            status: "registered",
            document_id: hwResult.documentId,
            is_duplicate: hwResult.isDuplicate || false,
            steps,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (hwResult.success && hwResult.noIdReturned) {
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = "SICAS acepto pero no devolvio ID";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered_no_id",
          sicas_registered_at: new Date().toISOString(),
          sicas_document_status: "created_no_id",
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_document",
            overall_status: "partial_success",
            status: "registered_no_id",
            no_id_returned: true,
            steps,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Failure
      steps[steps.length - 1].status = "failed";
      steps[steps.length - 1].detail = hwResult.error || "Registration failed";

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "failed",
        sicas_error_step: "save_hwcapture",
        sicas_error_message: hwResult.error || "Document registration failed",
        sicas_document_status: "failed",
        sicas_registration_stage: "save_hwcapture",
        sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          action: "retry_document",
          overall_status: "failed",
          status: "document_registration_failed",
          step: "save_hwcapture",
          error: hwResult.error,
          steps,
          step_error: hwResult.stepError || null,
          document_registration_diagnostic: hwResult.diagnostics || null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === RETRY_LOOKUP action: look up document by policy number in SICAS ===
    if (action === "retry_lookup") {
      const policyNumber = delivery.policy_number || delivery.manual_policy_number;
      const ciaId = delivery.sicas_override_cia || (delivery.sicas_resolved_fields as any)?.IDCia?.value || "3";

      if (!policyNumber) {
        return new Response(
          JSON.stringify({
            success: false,
            action: "retry_lookup",
            error: "No policy number available for lookup",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const lookupAttempts = (delivery.sicas_document_lookup_attempts || 0) + 1;
      await supabase.from("policy_deliveries").update({
        sicas_document_lookup_attempts: lookupAttempts,
        sicas_last_lookup_at: new Date().toISOString(),
      }).eq("id", delivery_id);

      const lookupResult = await lookupSicasDocument(
        supabase, sicasEndpoint, sicasUsername, sicasPassword,
        policyNumber, ciaId
      );

      if (lookupResult.found && lookupResult.documentId) {
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: lookupResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_document_status: "found_via_lookup",
          sicas_document_resolution_method: "retry_lookup",
          sicas_document_lookup_response: lookupResult.rawResponse ? { raw: lookupResult.rawResponse } : null,
          sicas_error_message: null,
          sicas_error_step: null,
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_lookup",
            status: "found",
            document_id: lookupResult.documentId,
            resolution_method: "lookup",
            lookup_attempts: lookupAttempts,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("policy_deliveries").update({
        sicas_document_lookup_response: lookupResult.rawResponse ? { raw: lookupResult.rawResponse } : null,
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          action: "retry_lookup",
          status: "not_found",
          error: lookupResult.error || "Document not found in SICAS",
          lookup_attempts: lookupAttempts,
          policy_number: policyNumber,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL_CAPTURE action: mark delivery as manually captured ===
    if (action === "manual_capture") {
      const manualDocId = body.document_id || body.manual_document_id;
      const manualNote = body.note || body.reason || "";

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: manualDocId ? "registered" : "manual_review_required",
        sicas_document_id: manualDocId || null,
        sicas_registered_at: manualDocId ? new Date().toISOString() : null,
        sicas_document_status: manualDocId ? "manual_capture" : "pending_manual",
        sicas_document_resolution_method: "manual_capture",
        sicas_manual_review_reason: manualNote || "Captura manual solicitada por usuario",
        sicas_error_step: null,
        sicas_error_message: null,
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "manual_capture",
          status: manualDocId ? "registered" : "pending_manual",
          document_id: manualDocId || null,
          message: manualDocId
            ? `Documento ${manualDocId} registrado manualmente`
            : "Marcado para revision manual",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        success: false,
        error: `Unknown action: ${action}`,
        valid_actions: ["resolve", "register", "auto", "retry_document", "retry_lookup", "manual_capture"],
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[SICAS] Unhandled error: ${error.message}`);
    console.error(error.stack);

    // Try to update the delivery status if we have enough context
    try {
      if (createClient) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Try to extract delivery_id from the body
        let body2: Record<string, any> = {};
        try {
          // body is already consumed, but we might have the delivery_id from earlier scope
        } catch (_) { /* ignore */ }

        // We can't reliably get delivery_id here, so just log
        console.error(`[SICAS] Could not update delivery status after unhandled error`);
      }
    } catch (_) { /* ignore cleanup errors */ }

    return jsonResponse({
      success: false,
      stage: "unhandled_edge_function_error",
      message: error.message,
      version: FUNCTION_VERSION,
      stack: error.stack?.split("\n").slice(0, 5),
    }, 500);
  }
});
