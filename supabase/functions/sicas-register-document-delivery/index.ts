import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FUNCTION_VERSION = "2.2.0";

function jsonResponse(data: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

let _createClient: any = null;
let _CryptoJS: any = null;

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
    _CryptoJS = mod.default;
  }
  return _CryptoJS;
}

let CryptoJS: any = null;
let createClient: any = null;

// ============================================================
// DEDICATED HWCAPTURE DOCUMENT REGISTRATION
// This function ONLY registers a document in SICAS via HWCAPTURE.
// It does NOT search, create clients, or do lookups.
//
// SICAS ProcesarWS contract for HWCAPTURE:
// - DataXML must be TripleDES-encrypted (URL-encoded XML -> encrypt -> base64)
// - KeyProcess: DATA, KeyCode: HWCAPTURE, TProc: Save_Data, TypeFormat: XML
// - Encryption: TripleDES/CBC/ZeroPadding, Key fixed, IV = first 8 chars of username
// - Plain XML MUST NEVER be sent - SICAS returns HTTP 400 if it receives
//   unencrypted XML nested inside <tem:DataXML>
// ============================================================

const SICAS_3DES_KEY = "%SOnlineBOGO2001-2015WS#";
const SICAS_DEFAULT_ENDPOINT = "https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx";

const HWCAPTURE_FIELD_MAP: Record<string, string> = {
  FechaInicio: "FDesde",
  FechaFin: "FHasta",
  PrimaTotal: "PrimaNeta",
  IDFPago: "FPago",
  IDEjecutivo: "IDEjecut",
  Estatus: "Status",
  IDSubRamo: "IDSRamo",
};

const DOCUMENT_ID_FIELDS = [
  "IDDocto", "IDDocumento", "ID_Docto", "DocumentoID",
  "NewIDValue", "NewSubIDValue", "RESPONSENBR", "DATA", "ID",
];

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
  url_encoded_data_xml: string;
  encrypted_data_xml_length: number;
  soap_request_redacted: string;
  soap_response: string;
  parsed_response: { response_nbr: number | null; response_txt: string; has_success: boolean; has_error: boolean } | null;
  detected_id_docto: string | null;
  document_stage_status: "not_attempted" | "sent_to_sicas" | "success_with_id" | "success_without_id" | "not_created" | "failed" | "duplicate";
  encryption_used: boolean;
  encryption_method: string;
  encryption_error: string | null;
  iv_used: string;
  error_message: string | null;
  http_status?: number;
  endpoint_used?: string;
  soap_action?: string;
  request_timestamp?: string;
  response_timestamp?: string;
  duration_ms?: number;
  prima_original?: string;
  prima_normalized?: string;
  new_document_id_value: string;
  include_dat_docto_detail: boolean;
  data_xml_send_mode: "encrypted" | "plain_fallback_blocked";
}

// ============================================================
// Helpers
// ============================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function normalizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeSicasAmount(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = String(value).replace(/[$,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return null;
  return num.toFixed(2);
}

function sanitizeField(value: any): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (str === "" || str === "undefined" || str === "null" || str === "NaN" || str === "[object Object]") return null;
  return str;
}

function isValidNumericId(value: string | null | undefined): boolean {
  if (!value) return false;
  const num = parseInt(value);
  return !isNaN(num) && num > 0;
}

function isValidDateFormat(value: string): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value);
}

function parseSoapFault(responseText: string): { faultcode: string; faultstring: string; detail: string } {
  const extractBetween = (xml: string, startTag: string, endTag: string): string => {
    const startIdx = xml.indexOf(startTag);
    if (startIdx === -1) return "";
    const contentStart = startIdx + startTag.length;
    const endIdx = xml.indexOf(endTag, contentStart);
    if (endIdx === -1) return xml.substring(contentStart, contentStart + 500);
    return xml.substring(contentStart, endIdx);
  };
  return {
    faultcode: extractBetween(responseText, "<faultcode>", "</faultcode>"),
    faultstring: extractBetween(responseText, "<faultstring>", "</faultstring>"),
    detail: extractBetween(responseText, "<detail>", "</detail>"),
  };
}

function extractFirstValidId(responseText: string, fieldNames: string[]): string | null {
  const decoded = responseText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  for (const field of fieldNames) {
    const xmlRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
    const xmlMatch = decoded.match(xmlRegex);
    if (xmlMatch?.[1] && parseInt(xmlMatch[1]) > 0) return xmlMatch[1];

    const jsonRegex = new RegExp(`"${field}"\\s*:\\s*"?(\\d+)"?`, "i");
    const jsonMatch = decoded.match(jsonRegex);
    if (jsonMatch?.[1] && parseInt(jsonMatch[1]) > 0) return jsonMatch[1];
  }

  const processDataMatch = decoded.match(/<PROCESSDATA[^>]*>([\s\S]*?)<\/PROCESSDATA>/i);
  if (processDataMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = processDataMatch[1].match(innerRegex);
      if (innerMatch?.[1] && parseInt(innerMatch[1]) > 0) return innerMatch[1];
    }
  }

  const newDataSetMatch = decoded.match(/<NewDataSet[^>]*>([\s\S]*?)<\/NewDataSet>/i);
  if (newDataSetMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = newDataSetMatch[1].match(innerRegex);
      if (innerMatch?.[1] && parseInt(innerMatch[1]) > 0) return innerMatch[1];
    }
  }

  return null;
}

// ============================================================
// DataXML Building & Encryption
// ============================================================

function buildHwcaptureDataXml(sanitizedPayload: Record<string, string>): string {
  const docElements: string[] = [];
  docElements.push(`<IDDocto>-1</IDDocto>`);

  for (const [key, value] of Object.entries(sanitizedPayload)) {
    const hwField = HWCAPTURE_FIELD_MAP[key] || key;
    docElements.push(`<${hwField}>${escapeXml(value)}</${hwField}>`);
  }

  return `<InfoData><DatDocumentos>${docElements.join("")}</DatDocumentos><DatDoctoDetail><IDDocto>-1</IDDocto></DatDoctoDetail></InfoData>`;
}

function encryptDataXml(plainXml: string, username: string): { encrypted: string; method: string; urlEncodedXml: string } {
  // Step 1: URL-encode the XML before encrypting (per SICAS documentation)
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

  return { encrypted: encrypted.toString(), method: "CryptoJS-TripleDES-CBC", urlEncodedXml };
}

// ============================================================
// Catalog Resolution
// ============================================================

interface CatalogRecord {
  id_sicas: string;
  nombre: string;
  raw: Record<string, any> | null;
}

function findCatalogMatch(records: CatalogRecord[], searchTerms: string[]): CatalogRecord | null {
  const normalizedTerms = searchTerms.map(t => normalizeText(t)).filter(t => t.length > 0);

  for (const term of normalizedTerms) {
    const exact = records.find(r => normalizeText(r.nombre) === term);
    if (exact) return exact;
  }
  for (const term of searchTerms) {
    const idMatch = records.find(r => r.id_sicas === term);
    if (idMatch) return idMatch;
  }
  for (const term of normalizedTerms) {
    if (term.length < 2) continue;
    const contains = records.find(r => normalizeText(r.nombre).includes(term));
    if (contains) return contains;
  }
  return null;
}

async function resolveFieldsForHwcapture(
  supabase: any,
  delivery: any,
  defaults: Array<{ field_name: string; default_value: string | null; default_label: string | null }>,
): Promise<{ payload: Record<string, string>; warnings: string[]; resolved_sources: Record<string, string> }> {
  const payload: Record<string, string> = {};
  const warnings: string[] = [];
  const resolved_sources: Record<string, string> = {};

  const getDefault = (fieldName: string): string | null => {
    const def = defaults.find(d => d.field_name === fieldName);
    return def?.default_value || null;
  };

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

  const existingResolved = delivery.sicas_resolved_fields as Record<string, { value: string; source: string }> | null;

  const resolveField = (fieldName: string, catalogTypeId: number, searchTerms: string[], overrideKey: string | null): void => {
    const overrideValue = overrideKey ? delivery[overrideKey] : null;
    if (overrideValue) {
      payload[fieldName] = String(overrideValue);
      resolved_sources[fieldName] = "override";
      return;
    }

    if (existingResolved?.[fieldName]?.value && existingResolved[fieldName].value !== "0" && existingResolved[fieldName].value !== "__auto_create__") {
      payload[fieldName] = existingResolved[fieldName].value;
      resolved_sources[fieldName] = `prev_resolved:${existingResolved[fieldName].source}`;
      return;
    }

    const defaultVal = getDefault(fieldName);
    if (defaultVal) {
      payload[fieldName] = defaultVal;
      resolved_sources[fieldName] = "default";
      return;
    }

    const records = catalogCache[catalogTypeId] || [];
    if (records.length > 0 && searchTerms.length > 0) {
      const match = findCatalogMatch(records, searchTerms);
      if (match) {
        payload[fieldName] = match.id_sicas;
        resolved_sources[fieldName] = "catalog_match";
        return;
      }
    }

    if (records.length === 1) {
      payload[fieldName] = records[0].id_sicas;
      resolved_sources[fieldName] = "single_catalog_item";
      return;
    }

    warnings.push(`${fieldName}: no se pudo resolver (catalogo ${catalogTypeId} tiene ${records.length} items)`);
  };

  resolveField("IDTipoDocto", 24, ["POLIZA", "POLIZAS", "POL"], "sicas_override_tipo_docto");
  resolveField("IDCia", 12, ["QUALITAS", "QUALITAS COMPANIA DE SEGUROS", "QUALITAS COMPANIA", "QUALITAS SEGUROS"], "sicas_override_cia");
  resolveField("IDRamo", 9, ["AUTOS", "AUTOMOVILES", "VEHICULOS", "DANOS AUTOS", "AUTO"], "sicas_override_ramo");
  resolveField("IDSubRamo", 10, ["AUTOMOVILES", "AUTOS RESIDENTES", "AUTO INDIVIDUAL", "AUTOS"], "sicas_override_subramo");
  resolveField("IDMon", 6, ["PESOS", "PESOS MEXICANOS", "MXN", "MONEDA NACIONAL", "M.N."], "sicas_override_moneda");
  resolveField("IDFPago", 8, ["CONTADO", "PAGO DE CONTADO", "ANUAL", "UNA EXHIBICION"], "sicas_override_fpago");
  resolveField("IDGrupo", 62, ["GENERAL"], "sicas_override_grupo");
  resolveField("Estatus", 40, ["VIGENTE", "VIGENTES", "V", "VIG", "ACTIVA"], "sicas_override_estatus");

  // IDEjecutivo
  if (delivery.sicas_override_ejecutivo) {
    payload.IDEjecutivo = delivery.sicas_override_ejecutivo;
    resolved_sources.IDEjecutivo = "override";
  } else if (existingResolved?.IDEjecutivo?.value && existingResolved.IDEjecutivo.value !== "0") {
    payload.IDEjecutivo = existingResolved.IDEjecutivo.value;
    resolved_sources.IDEjecutivo = `prev_resolved:${existingResolved.IDEjecutivo.source}`;
  } else if (getDefault("IDEjecutivo")) {
    payload.IDEjecutivo = getDefault("IDEjecutivo")!;
    resolved_sources.IDEjecutivo = "default";
  } else if (delivery.vendor_sicas_id) {
    payload.IDEjecutivo = String(delivery.vendor_sicas_id);
    resolved_sources.IDEjecutivo = "fallback_vendor_id";
  }

  // IDCli
  const clientId = delivery.sicas_client_id || existingResolved?.IDCli?.value || delivery.sicas_override_cliente;
  if (clientId && clientId !== "0" && clientId !== "__auto_create__") {
    payload.IDCli = String(clientId);
    resolved_sources.IDCli = "existing_client";
  } else {
    warnings.push("IDCli: no se encontro el ID del cliente");
  }

  // IDVend
  const vendorId = delivery.vendor_sicas_id || existingResolved?.IDVend?.value;
  if (vendorId && vendorId !== "0") {
    payload.IDVend = String(vendorId);
    resolved_sources.IDVend = "delivery_vendor";
  }

  // Policy number
  const policyNumber = sanitizeField(delivery.manual_policy_number || delivery.policy_number);
  if (policyNumber) {
    payload.Documento = policyNumber;
    resolved_sources.Documento = "delivery";
  }

  // Dates
  const startDate = normalizeDate(delivery.start_date);
  const endDate = normalizeDate(delivery.end_date);
  if (startDate) { payload.FechaInicio = startDate; resolved_sources.FechaInicio = "delivery"; }
  if (endDate) { payload.FechaFin = endDate; resolved_sources.FechaFin = "delivery"; }

  // Premium - CRITICAL: must remove comma thousands separators
  const rawPremium = sanitizeField(delivery.total_premium || delivery.extracted_data?.primaTotal);
  const normalizedPremium = normalizeSicasAmount(rawPremium);
  if (normalizedPremium) {
    payload.PrimaTotal = normalizedPremium;
    resolved_sources.PrimaTotal = "delivery_normalized";
  }

  // Office
  if (delivery.sicas_office_id) { payload.IDOficina = String(delivery.sicas_office_id); resolved_sources.IDOficina = "delivery"; }

  // Vehicle fields
  if (delivery.vehicle_description) { payload.Descripcion = normalizeText(delivery.vehicle_description); resolved_sources.Descripcion = "delivery"; }
  if (delivery.plates) { payload.Placas = String(delivery.plates).trim(); resolved_sources.Placas = "delivery"; }
  if (delivery.vin) { payload.NumSerie = String(delivery.vin).trim(); resolved_sources.NumSerie = "delivery"; }
  if (delivery.engine) { payload.Motor = String(delivery.engine).trim(); resolved_sources.Motor = "delivery"; }

  return { payload, warnings, resolved_sources };
}

// ============================================================
// Pre-send Validation
// ============================================================

function validatePayloadBeforeSend(payload: Record<string, string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const numericFields = ["IDCli", "IDVend", "IDCia", "IDRamo", "IDSubRamo", "IDMon", "IDFPago", "IDEjecutivo", "IDGrupo", "IDOficina", "IDTipoDocto"];
  for (const field of numericFields) {
    const value = payload[field];
    if (value && !isValidNumericId(value)) {
      errors.push(`${field}: valor "${value}" no es un ID numerico valido`);
    }
  }

  if (!payload.Documento) {
    errors.push("Documento: numero de poliza requerido");
  }

  if (payload.FechaInicio && !isValidDateFormat(payload.FechaInicio)) {
    errors.push(`FechaInicio: formato "${payload.FechaInicio}" invalido (esperado dd/MM/yyyy)`);
  }
  if (payload.FechaFin && !isValidDateFormat(payload.FechaFin)) {
    errors.push(`FechaFin: formato "${payload.FechaFin}" invalido (esperado dd/MM/yyyy)`);
  }

  if (payload.PrimaTotal) {
    const num = parseFloat(payload.PrimaTotal);
    if (isNaN(num) || payload.PrimaTotal.includes(",")) {
      errors.push(`PrimaTotal: valor "${payload.PrimaTotal}" contiene comas o no es numerico`);
    }
  }

  if (!payload.IDCli || payload.IDCli === "0") {
    errors.push("IDCli: ID de cliente requerido");
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// SOAP HWCAPTURE Execution
// ============================================================

async function executeHwcapture(
  payload: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string,
  rawPremium: string | null,
): Promise<{ success: boolean; documentId?: string; noIdReturned?: boolean; error?: string; isDuplicate?: boolean; duplicateId?: string; diagnostics: DocumentRegistrationDiagnostic }> {
  const startTime = Date.now();
  const dataXmlPlain = buildHwcaptureDataXml(payload);

  const fieldMapping: Record<string, string> = {};
  for (const key of Object.keys(payload)) {
    fieldMapping[key] = HWCAPTURE_FIELD_MAP[key] || key;
  }

  const ivUsed = sicasUsername.substring(0, 8).padEnd(8, "\0");
  const requiredFields = ["IDCli", "IDVend", "Documento", "IDCia", "IDRamo", "IDSubRamo", "IDMon", "IDFPago", "IDEjecutivo", "FechaInicio", "FechaFin", "PrimaTotal", "Estatus", "IDTipoDocto"];
  const missingFields = requiredFields.filter(f => !payload[f] || payload[f] === "0" || payload[f] === "");

  // Encrypt DataXML - this MUST succeed, we never send plain XML
  let dataXmlEncrypted: string;
  let encryptionMethod = "none";
  let encryptionError: string | null = null;
  let urlEncodedXml = "";

  try {
    const result = encryptDataXml(dataXmlPlain, sicasUsername);
    dataXmlEncrypted = result.encrypted;
    encryptionMethod = result.method;
    urlEncodedXml = result.urlEncodedXml;
  } catch (encErr: any) {
    encryptionError = encErr.message;
    console.error(`[HWCAPTURE] ENCRYPTION FAILED: ${encErr.message}`);
    console.error(`[HWCAPTURE] BLOCKING - will NOT send plain XML to SICAS (causes HTTP 400)`);

    const diagnostics: DocumentRegistrationDiagnostic = {
      executed: false, method: "ProcesarWS", key_process: "DATA", key_code: "HWCAPTURE",
      tproc: "Save_Data", type_format: "XML", payload_fields: { ...payload },
      missing_fields: missingFields, field_mapping: fieldMapping, plain_data_xml: dataXmlPlain,
      url_encoded_data_xml: "", encrypted_data_xml_length: 0,
      soap_request_redacted: "", soap_response: "",
      parsed_response: null, detected_id_docto: null, document_stage_status: "failed",
      encryption_used: false, encryption_method: "FAILED",
      encryption_error: encryptionError, iv_used: ivUsed,
      error_message: `Cifrado TripleDES fallo: ${encErr.message}. No se envio a SICAS.`,
      endpoint_used: sicasEndpoint, soap_action: "http://tempuri.org/ProcesarWS",
      request_timestamp: new Date().toISOString(), duration_ms: Date.now() - startTime,
      prima_original: rawPremium || undefined, prima_normalized: payload.PrimaTotal || undefined,
      new_document_id_value: "-1", include_dat_docto_detail: true,
      data_xml_send_mode: "plain_fallback_blocked",
    };
    return { success: false, error: `Cifrado TripleDES fallo: ${encErr.message}. Contacte soporte tecnico.`, diagnostics };
  }

  // Password: URL-encode spaces (matching working function)
  const encodedPassword = sicasPassword.replace(/ /g, "%20");

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:ProcesarWS>
      <tem:oDataWS>
        <tem:Credentials>
          <tem:UserName>${escapeXml(sicasUsername)}</tem:UserName>
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

  console.log(`[HWCAPTURE] ========== EXECUTING SICAS HWCAPTURE ==========`);
  console.log(`[HWCAPTURE] Endpoint: ${sicasEndpoint}`);
  console.log(`[HWCAPTURE] SOAPAction: http://tempuri.org/ProcesarWS`);
  console.log(`[HWCAPTURE] Method: ProcesarWS / KeyProcess=DATA / KeyCode=HWCAPTURE / TProc=Save_Data`);
  console.log(`[HWCAPTURE] Username: ${sicasUsername}`);
  console.log(`[HWCAPTURE] Encryption: ${encryptionMethod}, IV: "${ivUsed}"`);
  console.log(`[HWCAPTURE] Payload fields: ${JSON.stringify(payload)}`);
  console.log(`[HWCAPTURE] DataXML (plain): ${dataXmlPlain}`);
  console.log(`[HWCAPTURE] DataXML (URL-encoded, first 200): ${urlEncodedXml.substring(0, 200)}`);
  console.log(`[HWCAPTURE] DataXML (encrypted, first 100): ${dataXmlEncrypted.substring(0, 100)}`);
  console.log(`[HWCAPTURE] DataXML encrypted length: ${dataXmlEncrypted.length}`);
  console.log(`[HWCAPTURE] SOAP envelope size: ${soapEnvelope.length} bytes`);
  console.log(`[HWCAPTURE] Prima original: "${rawPremium}", normalized: "${payload.PrimaTotal}"`);

  if (missingFields.length > 0) {
    console.warn(`[HWCAPTURE] WARNING: Missing fields (will attempt anyway): ${missingFields.join(", ")}`);
  }

  const diagnostics: DocumentRegistrationDiagnostic = {
    executed: true,
    method: "ProcesarWS",
    key_process: "DATA",
    key_code: "HWCAPTURE",
    tproc: "Save_Data",
    type_format: "XML",
    payload_fields: { ...payload },
    missing_fields: missingFields,
    field_mapping: fieldMapping,
    plain_data_xml: dataXmlPlain,
    url_encoded_data_xml: urlEncodedXml.substring(0, 1000),
    encrypted_data_xml_length: dataXmlEncrypted.length,
    soap_request_redacted: soapEnvelope.replace(
      /<tem:Password>[^<]*<\/tem:Password>/,
      "<tem:Password>***REDACTED***</tem:Password>"
    ).substring(0, 3000),
    soap_response: "",
    parsed_response: null,
    detected_id_docto: null,
    document_stage_status: "sent_to_sicas",
    encryption_used: true,
    encryption_method: encryptionMethod,
    encryption_error: null,
    iv_used: ivUsed,
    error_message: null,
    endpoint_used: sicasEndpoint,
    soap_action: "http://tempuri.org/ProcesarWS",
    request_timestamp: new Date().toISOString(),
    prima_original: rawPremium || undefined,
    prima_normalized: payload.PrimaTotal || undefined,
    new_document_id_value: "-1",
    include_dat_docto_detail: true,
    data_xml_send_mode: "encrypted",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ProcesarWS",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    const endTime = Date.now();
    diagnostics.soap_response = responseText.substring(0, 5000);
    diagnostics.http_status = response.status;
    diagnostics.response_timestamp = new Date().toISOString();
    diagnostics.duration_ms = endTime - startTime;

    console.log(`[HWCAPTURE] ========== SICAS RESPONSE ==========`);
    console.log(`[HWCAPTURE] HTTP Status: ${response.status} ${response.statusText}`);
    console.log(`[HWCAPTURE] Duration: ${endTime - startTime}ms`);
    console.log(`[HWCAPTURE] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
    console.log(`[HWCAPTURE] Response body (first 2000):`, responseText.substring(0, 2000));

    if (!response.ok) {
      const fault = parseSoapFault(responseText);
      console.error(`[HWCAPTURE] HTTP ERROR ${response.status}`);
      console.error(`[HWCAPTURE] SOAP Fault code: ${fault.faultcode}`);
      console.error(`[HWCAPTURE] SOAP Fault string: ${fault.faultstring}`);
      console.error(`[HWCAPTURE] SOAP Fault detail: ${fault.detail}`);
      console.error(`[HWCAPTURE] Full response: ${responseText}`);

      let faultMessage: string;
      if (fault.faultstring) {
        faultMessage = `SOAP Fault [${fault.faultcode}]: ${fault.faultstring}`;
        if (fault.detail) faultMessage += ` | Detail: ${fault.detail}`;
      } else {
        faultMessage = `SICAS HTTP ${response.status}: ${response.statusText}`;
        if (responseText.length > 0 && responseText.length < 500) {
          faultMessage += ` | Body: ${responseText}`;
        }
      }

      diagnostics.document_stage_status = "failed";
      diagnostics.error_message = faultMessage;
      return { success: false, error: faultMessage, diagnostics };
    }

    const decoded = responseText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

    const isDuplicate = /duplicad|ya existe|already exists/i.test(decoded);
    if (isDuplicate) {
      const dupIdMatch = decoded.match(/IDDocto["\s:=]*>?(\d+)/i) || decoded.match(/<ID>(\d+)<\/ID>/i);
      diagnostics.document_stage_status = "duplicate";
      diagnostics.detected_id_docto = dupIdMatch?.[1] || null;
      diagnostics.error_message = "Poliza ya existe en SICAS";
      return { success: false, isDuplicate: true, duplicateId: dupIdMatch?.[1] || undefined, error: "Poliza ya existe en SICAS", diagnostics };
    }

    const extractedId = extractFirstValidId(responseText, DOCUMENT_ID_FIELDS);
    const responseNbrMatch = decoded.match(/<RESPONSENBR>\s*(-?\d+)\s*<\/RESPONSENBR>/i);
    const responseNbr = responseNbrMatch ? parseInt(responseNbrMatch[1]) : null;
    const responseTxt = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] || "";

    const hasSuccess = responseNbr === 1 || /SUCESS|SUCCESS|OK|GUARDADO|CREADO|REGISTRADO/i.test(decoded);
    const hasError = (responseNbr !== null && responseNbr <= 0) || (/ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded));

    diagnostics.parsed_response = { response_nbr: responseNbr, response_txt: responseTxt, has_success: hasSuccess, has_error: hasError };
    diagnostics.detected_id_docto = extractedId || null;

    console.log(`[HWCAPTURE] Parsed: RESPONSENBR=${responseNbr}, RESPONSETXT="${responseTxt}", hasSuccess=${hasSuccess}, hasError=${hasError}, extractedId=${extractedId}`);

    if (hasError && !extractedId) {
      const errorMsg = responseTxt ||
        decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
        decoded.match(/<faultstring>(.*?)<\/faultstring>/i)?.[1] ||
        `Error SICAS (RESPONSENBR=${responseNbr}): ${responseText.substring(0, 300)}`;
      diagnostics.document_stage_status = "failed";
      diagnostics.error_message = errorMsg;
      return { success: false, error: errorMsg, diagnostics };
    }

    if (extractedId) {
      diagnostics.document_stage_status = "success_with_id";
      console.log(`[HWCAPTURE] SUCCESS! Document registered with IDDocto=${extractedId}`);
      return { success: true, documentId: extractedId, diagnostics };
    }

    if (hasSuccess) {
      diagnostics.document_stage_status = "success_without_id";
      console.log(`[HWCAPTURE] SUCCESS (no ID returned) - SICAS confirmed save`);
      return { success: true, noIdReturned: true, diagnostics };
    }

    diagnostics.document_stage_status = "failed";
    diagnostics.error_message = `Respuesta SICAS no reconocida: ${responseText.substring(0, 300)}`;
    return { success: false, error: diagnostics.error_message, diagnostics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error.name === "AbortError" ? "Timeout: SICAS no respondio en 45s" : error.message;
    diagnostics.document_stage_status = "failed";
    diagnostics.error_message = msg;
    diagnostics.duration_ms = Date.now() - startTime;
    console.error(`[HWCAPTURE] EXCEPTION: ${msg}`);
    return { success: false, error: msg, diagnostics };
  }
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
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

    // health_check: responds without loading ANY modules
    if (body.health_check === true) {
      return jsonResponse({
        success: true,
        function: "sicas-register-document-delivery",
        status: "ok",
        version: FUNCTION_VERSION,
        imports_loaded: false,
        timestamp: new Date().toISOString(),
      });
    }

    // test_imports: explicitly test if modules can load
    if (body.test_imports === true) {
      try {
        const [createClientFn, cryptoMod] = await Promise.all([
          loadSupabaseClient(),
          loadCryptoJS(),
        ]);
        return jsonResponse({
          success: true,
          stage: "test_imports",
          imports_loaded: true,
          available: {
            supabase_client: typeof createClientFn === "function",
            crypto_js: typeof cryptoMod === "object" || typeof cryptoMod === "function",
          },
        });
      } catch (importErr: any) {
        return jsonResponse({
          success: false,
          stage: "test_imports",
          imports_loaded: false,
          message: importErr.message,
        });
      }
    }

    // ping_sicas: lightweight endpoint check
    if (body.ping_sicas === true) {
      const endpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || SICAS_DEFAULT_ENDPOINT;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const pingResp = await fetch(endpoint, { method: "GET", signal: controller.signal });
        clearTimeout(timeoutId);
        return jsonResponse({ success: true, stage: "ping_sicas", endpoint, http_status: pingResp.status, reachable: true });
      } catch (pingErr: any) {
        return jsonResponse({ success: false, stage: "ping_sicas", endpoint, reachable: false, message: pingErr.name === "AbortError" ? "Timeout (10s)" : pingErr.message });
      }
    }

    // === REAL FLOW: Load heavy modules ===
    createClient = await loadSupabaseClient();
    CryptoJS = await loadCryptoJS();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasUsername = Deno.env.get("SICAS_USERNAME") || Deno.env.get("SICAS_USUARIO") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || SICAS_DEFAULT_ENDPOINT;

    console.log(`[HWCAPTURE] Config: username=${sicasUsername ? 'SET' : 'MISSING'}, password=${sicasPassword ? 'SET' : 'MISSING'}, endpoint=${sicasEndpoint}`);

    if (!sicasUsername || !sicasPassword) {
      return jsonResponse({ success: false, error: "SICAS credentials not configured (SICAS_USERNAME/SICAS_PASSWORD)" }, 500);
    }

    const delivery_id = body.delivery_id || body.policy_delivery_id || body.id;

    if (!delivery_id) {
      return new Response(
        JSON.stringify({ success: false, error: "delivery_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[HWCAPTURE] ========== START: delivery_id=${delivery_id} ==========`);

    // Load the delivery record
    const { data: delivery, error: fetchError } = await supabase
      .from("policy_deliveries")
      .select("*")
      .eq("id", delivery_id)
      .maybeSingle();

    if (fetchError || !delivery) {
      return new Response(
        JSON.stringify({ success: false, error: `Delivery not found: ${fetchError?.message || "no data"}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[HWCAPTURE] Delivery loaded: policy=${delivery.policy_number || delivery.manual_policy_number}, client_id=${delivery.sicas_client_id}, vendor_id=${delivery.vendor_sicas_id}`);

    // Pre-step: Auto-resolve core data fields from multiple sources
    try {
      const autoResolveUrl = `${supabaseUrl}/functions/v1/sicas-auto-resolve-delivery-data`;
      const arResp = await fetch(autoResolveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ delivery_id, save: true, include_local_sicas: true }),
      });
      if (arResp.ok) {
        const arData = await arResp.json();
        if (arData.ok && arData.resolved_values?.sicas_client_id) {
          await supabase.from("policy_deliveries").update({
            sicas_client_id: arData.resolved_values.sicas_client_id,
          }).eq("id", delivery_id).is("sicas_client_id", null);
        }
        // Reload delivery with resolved data
        const { data: refreshed } = await supabase.from("policy_deliveries").select("*").eq("id", delivery_id).maybeSingle();
        if (refreshed) Object.assign(delivery, refreshed);
        console.log(`[HWCAPTURE] Auto-resolve completed: ${arData.ok ? 'success' : 'partial'}, missing=${arData.missing_fields?.length || 0}`);
      }
    } catch (arErr) {
      console.warn(`[HWCAPTURE] Auto-resolve non-blocking error: ${(arErr as Error).message}`);
    }

    // Early validation: check core fields exist before any SICAS call
    const coreValidationMissing: string[] = [];
    if (!delivery.policy_number && !delivery.manual_policy_number) coreValidationMissing.push("policy_number");
    if (!delivery.insured_name) coreValidationMissing.push("insured_name");
    if (!delivery.total_premium) coreValidationMissing.push("premium");
    if (!delivery.start_date) coreValidationMissing.push("start_date");
    if (!delivery.end_date) coreValidationMissing.push("end_date");

    if (coreValidationMissing.length > 0) {
      console.warn(`[HWCAPTURE] BLOCKED: Missing core fields: ${coreValidationMissing.join(", ")}`);

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "document_not_created",
        sicas_error_message: `Faltan datos obligatorios: ${coreValidationMissing.join(", ")}`,
        sicas_error_step: "validate_core_fields",
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          status: "validation_failed",
          document_status: "validation_failed",
          stage: "validate_hwcapture_payload",
          message: "Faltan datos obligatorios para registrar la poliza en SICAS.",
          missing_fields: coreValidationMissing,
          action_required: "resolve_data",
          normalized_delivery: {
            policy_number: delivery.policy_number || delivery.manual_policy_number || null,
            insured_name: delivery.insured_name || null,
            premium: delivery.total_premium || null,
            start_date: delivery.start_date || null,
            end_date: delivery.end_date || null,
            sicas_client_id: delivery.sicas_client_id || null,
          },
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client ID exists
    const clientId = delivery.sicas_client_id ||
      (delivery.sicas_resolved_fields as any)?.IDCli?.value ||
      delivery.sicas_override_cliente;

    if (!clientId || clientId === "0" || clientId === "__auto_create__") {
      const notAttemptedDiag: DocumentRegistrationDiagnostic = {
        executed: false, method: "ProcesarWS", key_process: "DATA", key_code: "HWCAPTURE",
        tproc: "Save_Data", type_format: "XML", payload_fields: {}, missing_fields: ["IDCli"],
        field_mapping: {}, plain_data_xml: "", url_encoded_data_xml: "",
        encrypted_data_xml_length: 0, soap_request_redacted: "", soap_response: "",
        parsed_response: null, detected_id_docto: null, document_stage_status: "not_attempted",
        encryption_used: false, encryption_method: "none", encryption_error: null, iv_used: "",
        error_message: "No existe sicas_client_id. Primero se debe crear/resolver el contacto en SICAS.",
        endpoint_used: sicasEndpoint,
        prima_original: undefined, prima_normalized: undefined,
        new_document_id_value: "-1", include_dat_docto_detail: true,
        data_xml_send_mode: "plain_fallback_blocked",
      };

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "document_not_created",
        sicas_request_debug: { document_registration_diagnostic: notAttemptedDiag },
        sicas_error_message: "IDCli no disponible. Use el flujo completo de registro primero.",
        sicas_error_step: "validate_client_id",
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false, status: "no_client_id",
          error: "No existe sicas_client_id. Primero se debe crear/resolver el contacto en SICAS.",
          document_registration_diagnostic: notAttemptedDiag,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load HWCAPTURE defaults
    const { data: defaultsData } = await supabase
      .from("sicas_hwcapture_defaults")
      .select("field_name, default_value, default_label");
    const defaults = defaultsData || [];

    // Mark as registering
    const attempts = (delivery.sicas_registration_attempts || 0) + 1;
    await supabase.from("policy_deliveries").update({
      sicas_registration_status: "registering",
      sicas_registration_attempts: attempts,
      sicas_last_attempt_at: new Date().toISOString(),
      sicas_error_step: null,
      sicas_error_message: null,
    }).eq("id", delivery_id);

    // Resolve fields
    const { payload, warnings, resolved_sources } = await resolveFieldsForHwcapture(supabase, delivery, defaults);

    console.log(`[HWCAPTURE] Resolved ${Object.keys(payload).length} fields, ${warnings.length} warnings`);
    console.log(`[HWCAPTURE] Payload: ${JSON.stringify(payload)}`);

    // Pre-send validation
    const validation = validatePayloadBeforeSend(payload);
    if (!validation.valid) {
      console.error(`[HWCAPTURE] Pre-send validation FAILED: ${validation.errors.join("; ")}`);

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "document_not_created",
        sicas_error_message: `Validacion fallida: ${validation.errors.join("; ")}`,
        sicas_error_step: "validate_payload",
        sicas_request_debug: { validation_errors: validation.errors, payload, resolved_sources, warnings },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false, status: "validation_failed",
          error: `No se pudo registrar en SICAS porque faltan datos obligatorios: ${validation.errors.join("; ")}`,
          validation_errors: validation.errors,
          warnings,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute HWCAPTURE
    const rawPremium = sanitizeField(delivery.total_premium || delivery.extracted_data?.primaTotal);
    const result = await executeHwcapture(payload, sicasEndpoint, sicasUsername, sicasPassword, rawPremium);

    if (result.success && result.documentId) {
      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "registered",
        sicas_document_id: result.documentId,
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: null,
        sicas_error_step: null,
        sicas_document_status: "created",
        sicas_registration_stage: "completed",
        sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: true, status: "registered",
          message: `Documento registrado en SICAS con ID: ${result.documentId}`,
          document_id: result.documentId,
          document_registration_diagnostic: result.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.success && result.noIdReturned) {
      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "unverified",
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: "SICAS confirmo exito pero no devolvio IDDocto.",
        sicas_error_step: "save_hwcapture",
        sicas_document_status: "unverified",
        sicas_registration_stage: "save_hwcapture",
        sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false, status: "unverified",
          message: "SICAS confirmo exito pero no devolvio IDDocto. Use 'Verificar en SICAS' para buscar.",
          document_registration_diagnostic: result.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.isDuplicate) {
      const docId = result.duplicateId;
      if (docId) {
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: docId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null, sicas_error_step: null,
          sicas_document_status: "created",
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true, status: "registered",
            message: `Poliza ya existia en SICAS con ID: ${docId}`,
            document_id: docId, is_duplicate: true,
            document_registration_diagnostic: result.diagnostics,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "document_not_created",
        sicas_error_message: "Poliza duplicada en SICAS pero no se obtuvo el IDDocto.",
        sicas_error_step: "save_hwcapture",
        sicas_document_status: "duplicate",
        sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false, status: "duplicate_no_id",
          message: "Poliza duplicada en SICAS pero no se obtuvo el IDDocto.",
          document_registration_diagnostic: result.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HWCAPTURE failed - update status so it doesn't stay stuck in "registering"
    await supabase.from("policy_deliveries").update({
      sicas_registration_status: "document_not_created",
      sicas_error_message: result.error || "Error desconocido en HWCAPTURE",
      sicas_error_step: "save_hwcapture",
      sicas_document_status: "failed",
      sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
    }).eq("id", delivery_id);

    return new Response(
      JSON.stringify({
        success: false, status: "document_not_created",
        message: result.error || "Error al registrar documento en SICAS via HWCAPTURE",
        document_registration_diagnostic: result.diagnostics,
        warnings,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[HWCAPTURE] Unhandled error:`, error);

    // Try to update the delivery status so it doesn't stay stuck
    try {
      const delivery_id = body.delivery_id || body.policy_delivery_id || body.id;
      if (delivery_id && createClient) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "document_not_created",
          sicas_error_message: `Error interno: ${error.message}`,
          sicas_error_step: "unhandled_exception",
        }).eq("id", delivery_id);
      }
    } catch (_) { /* ignore cleanup errors */ }

    return jsonResponse({
      success: false,
      stage: "unhandled_edge_function_error",
      message: error.message || "Error interno",
    });
  }
});
