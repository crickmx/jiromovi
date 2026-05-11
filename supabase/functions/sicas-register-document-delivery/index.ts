import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// DEDICATED HWCAPTURE DOCUMENT REGISTRATION
// This function ONLY registers a document in SICAS via HWCAPTURE.
// It does NOT search, create clients, or do lookups.
// ============================================================

const SICAS_3DES_KEY = "%SOnlineBOGO2001-2015WS#";

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

function sanitizeField(value: any): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  if (str === "" || str === "undefined" || str === "null" || str === "NaN" || str === "[object Object]") return null;
  return str;
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

    const attrRegex = new RegExp(`${field}["\\s:=]*>?(\\d+)`, "i");
    const attrMatch = decoded.match(attrRegex);
    if (attrMatch?.[1] && parseInt(attrMatch[1]) > 0) return attrMatch[1];
  }

  const processDataMatch = decoded.match(/<PROCESSDATA[^>]*>([\s\S]*?)<\/PROCESSDATA>/i);
  if (processDataMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = processDataMatch[1].match(innerRegex);
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

async function encryptDataXml(plainXml: string, username: string): Promise<string> {
  const urlEncodedXml = encodeURIComponent(plainXml);
  const encoder = new TextEncoder();

  const keyStr = SICAS_3DES_KEY;
  const keyBytes = encoder.encode(keyStr);
  const key24 = new Uint8Array(24);
  key24.set(keyBytes.slice(0, Math.min(keyBytes.length, 24)));

  const ivStr = username.substring(0, 8).padEnd(8, "\0");
  const ivBytes = encoder.encode(ivStr);

  const plainBytes = encoder.encode(urlEncodedXml);
  const blockSize = 8;
  const paddedLen = Math.ceil(plainBytes.length / blockSize) * blockSize;
  const padded = new Uint8Array(paddedLen);
  padded.set(plainBytes);

  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key24,
      { name: "DES-EDE3-CBC", length: 192 } as any,
      false,
      ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "DES-EDE3-CBC", iv: ivBytes } as any,
      cryptoKey,
      padded
    );

    const encBytes = new Uint8Array(encrypted);
    let binary = "";
    for (let i = 0; i < encBytes.length; i++) {
      binary += String.fromCharCode(encBytes[i]);
    }
    return btoa(binary);
  } catch (_cryptoError) {
    try {
      const { createCipheriv } = await import("node:crypto");
      const cipher = createCipheriv("des-ede3-cbc", key24, ivBytes);
      cipher.setAutoPadding(false);
      const enc1 = cipher.update(padded);
      const enc2 = cipher.final();
      const result = Buffer.concat([enc1, enc2]);
      return result.toString("base64");
    } catch (nodeError: any) {
      throw new Error(`Encryption failed: WebCrypto and Node crypto both unavailable. ${nodeError.message}`);
    }
  }
}

// ============================================================
// Catalog Resolution (lenient - uses fallbacks aggressively)
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

  // Load catalogs
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

  // Use existing resolved fields if available
  const existingResolved = delivery.sicas_resolved_fields as Record<string, { value: string; source: string }> | null;

  const resolveField = (fieldName: string, catalogTypeId: number, searchTerms: string[], overrideKey: string | null): void => {
    // Priority 1: Override from delivery
    const overrideValue = overrideKey ? delivery[overrideKey] : null;
    if (overrideValue) {
      payload[fieldName] = String(overrideValue);
      resolved_sources[fieldName] = "override";
      return;
    }

    // Priority 2: Previously resolved value
    if (existingResolved?.[fieldName]?.value && existingResolved[fieldName].value !== "0" && existingResolved[fieldName].value !== "__auto_create__") {
      payload[fieldName] = existingResolved[fieldName].value;
      resolved_sources[fieldName] = `prev_resolved:${existingResolved[fieldName].source}`;
      return;
    }

    // Priority 3: Default from sicas_hwcapture_defaults
    const defaultVal = getDefault(fieldName);
    if (defaultVal) {
      payload[fieldName] = defaultVal;
      resolved_sources[fieldName] = "default";
      return;
    }

    // Priority 4: Catalog match
    const records = catalogCache[catalogTypeId] || [];
    if (records.length > 0 && searchTerms.length > 0) {
      const match = findCatalogMatch(records, searchTerms);
      if (match) {
        payload[fieldName] = match.id_sicas;
        resolved_sources[fieldName] = "catalog_match";
        return;
      }
    }

    // Priority 5: First catalog item as last resort
    if (records.length === 1) {
      payload[fieldName] = records[0].id_sicas;
      resolved_sources[fieldName] = "single_catalog_item";
      return;
    }

    warnings.push(`${fieldName}: no se pudo resolver (catalogo ${catalogTypeId} tiene ${records.length} items)`);
  };

  // Resolve each field
  resolveField("IDTipoDocto", 24, ["POLIZA", "POLIZAS", "POL"], "sicas_override_tipo_docto");
  resolveField("IDCia", 12, ["QUALITAS", "QUALITAS COMPANIA DE SEGUROS", "QUALITAS COMPANIA", "QUALITAS SEGUROS"], "sicas_override_cia");
  resolveField("IDRamo", 9, ["AUTOS", "AUTOMOVILES", "VEHICULOS", "DANOS AUTOS", "AUTO"], "sicas_override_ramo");
  resolveField("IDSubRamo", 10, ["AUTOMOVILES", "AUTOS RESIDENTES", "AUTO INDIVIDUAL", "AUTOS"], "sicas_override_subramo");
  resolveField("IDMon", 6, ["PESOS", "PESOS MEXICANOS", "MXN", "MONEDA NACIONAL", "M.N."], "sicas_override_moneda");
  resolveField("IDFPago", 8, ["CONTADO", "PAGO DE CONTADO", "ANUAL", "UNA EXHIBICION"], "sicas_override_fpago");
  resolveField("IDGrupo", 62, ["GENERAL"], "sicas_override_grupo");
  resolveField("Estatus", 40, ["VIGENTE", "VIGENTES", "V", "VIG", "ACTIVA"], "sicas_override_estatus");

  // IDEjecutivo: special handling
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
    payload.IDEjecutivo = delivery.vendor_sicas_id;
    resolved_sources.IDEjecutivo = "fallback_vendor_id";
    warnings.push("IDEjecutivo: usando vendor_sicas_id como fallback");
  } else {
    warnings.push("IDEjecutivo: no se pudo resolver");
  }

  // IDCli: MUST exist (the whole point of this function - client was already created)
  const clientId = delivery.sicas_client_id || existingResolved?.IDCli?.value || delivery.sicas_override_cliente;
  if (clientId && clientId !== "0" && clientId !== "__auto_create__") {
    payload.IDCli = String(clientId);
    resolved_sources.IDCli = "existing_client";
  } else {
    warnings.push("IDCli: no se encontro el ID del cliente en la base de datos");
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

  // Premium
  const premium = sanitizeField(delivery.total_premium || delivery.extracted_data?.primaTotal);
  if (premium && premium !== "0") { payload.PrimaTotal = premium; resolved_sources.PrimaTotal = "delivery"; }

  // Office
  if (delivery.sicas_office_id) { payload.IDOficina = delivery.sicas_office_id; resolved_sources.IDOficina = "delivery"; }

  // Vehicle fields
  if (delivery.vehicle_description) { payload.Descripcion = delivery.vehicle_description; resolved_sources.Descripcion = "delivery"; }
  if (delivery.plates) { payload.Placas = delivery.plates; resolved_sources.Placas = "delivery"; }
  if (delivery.vin) { payload.NumSerie = delivery.vin; resolved_sources.NumSerie = "delivery"; }
  if (delivery.engine) { payload.Motor = delivery.engine; resolved_sources.Motor = "delivery"; }

  return { payload, warnings, resolved_sources };
}

// ============================================================
// SOAP HWCAPTURE Execution
// ============================================================

async function executeHwcapture(
  payload: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string,
): Promise<{ success: boolean; documentId?: string; noIdReturned?: boolean; error?: string; isDuplicate?: boolean; duplicateId?: string; diagnostics: DocumentRegistrationDiagnostic }> {
  const dataXmlPlain = buildHwcaptureDataXml(payload);
  const encodedPassword = sicasPassword.replace(/ /g, "%20");

  let dataXmlEncrypted: string;
  let encryptionMethod = "none";
  try {
    dataXmlEncrypted = await encryptDataXml(dataXmlPlain, sicasUsername);
    encryptionMethod = "TripleDES-CBC-ZeroPad";
  } catch (encErr: any) {
    console.error(`[HWCAPTURE] Encryption failed: ${encErr.message}. Sending plain XML.`);
    dataXmlEncrypted = dataXmlPlain;
    encryptionMethod = "FAILED_PLAIN_FALLBACK";
  }

  const fieldMapping: Record<string, string> = {};
  for (const key of Object.keys(payload)) {
    fieldMapping[key] = HWCAPTURE_FIELD_MAP[key] || key;
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

  console.log(`[HWCAPTURE] Executing SICAS ProcesarWS HWCAPTURE`);
  console.log(`[HWCAPTURE] Endpoint: ${sicasEndpoint}`);
  console.log(`[HWCAPTURE] Fields: ${Object.keys(payload).join(", ")}`);
  console.log(`[HWCAPTURE] IDCli=${payload.IDCli}, IDVend=${payload.IDVend}, Documento=${payload.Documento}`);
  console.log(`[HWCAPTURE] Encryption: ${encryptionMethod}, IV: ${ivUsed}`);
  console.log(`[HWCAPTURE] DataXML plain: ${dataXmlPlain}`);

  const requiredFields = ["IDCli", "IDVend", "Documento", "IDCia", "IDRamo", "IDSubRamo", "IDMon", "IDFPago", "IDEjecutivo", "FechaInicio", "FechaFin", "PrimaTotal", "Estatus", "IDTipoDocto"];
  const missingFields = requiredFields.filter(f => !payload[f] || payload[f] === "0" || payload[f] === "");

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
    encrypted_data_xml_length: dataXmlEncrypted.length,
    soap_request_redacted: soapEnvelope.replace(
      /<tem:Password>[^<]*<\/tem:Password>/,
      "<tem:Password>***REDACTED***</tem:Password>"
    ).substring(0, 3000),
    soap_response: "",
    parsed_response: null,
    detected_id_docto: null,
    document_stage_status: "sent_to_sicas",
    encryption_used: encryptionMethod !== "FAILED_PLAIN_FALLBACK",
    encryption_method: encryptionMethod,
    iv_used: ivUsed,
    error_message: null,
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
    diagnostics.soap_response = responseText.substring(0, 4000);
    console.log(`[HWCAPTURE] Response status: ${response.status}`);
    console.log(`[HWCAPTURE] Response body (first 1500):`, responseText.substring(0, 1500));

    if (!response.ok) {
      const fault = parseSoapFault(responseText);
      const faultMessage = fault.faultstring
        ? `SOAP Fault [${fault.faultcode}]: ${fault.faultstring}`
        : `SICAS HTTP ${response.status}: ${response.statusText}`;
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

    if (hasError && !extractedId) {
      const errorMsg = responseTxt ||
        decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
        decoded.match(/<faultstring>(.*?)<\/faultstring>/i)?.[1] ||
        `Error SICAS (RESPONSENBR=${responseNbr}): ${responseText.substring(0, 200)}`;
      diagnostics.document_stage_status = "failed";
      diagnostics.error_message = errorMsg;
      return { success: false, error: errorMsg, diagnostics };
    }

    if (extractedId) {
      diagnostics.document_stage_status = "success_with_id";
      return { success: true, documentId: extractedId, diagnostics };
    }

    if (hasSuccess) {
      diagnostics.document_stage_status = "success_without_id";
      return { success: true, noIdReturned: true, diagnostics };
    }

    diagnostics.document_stage_status = "failed";
    diagnostics.error_message = `Respuesta SICAS no reconocida: ${responseText.substring(0, 200)}`;
    return { success: false, error: diagnostics.error_message, diagnostics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error.name === "AbortError" ? "Timeout: SICAS no respondio en 45s" : error.message;
    diagnostics.document_stage_status = "failed";
    diagnostics.error_message = msg;
    return { success: false, error: msg, diagnostics };
  }
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sicasUsername = Deno.env.get("SICAS_USERNAME") || "";
    const sicasPassword = Deno.env.get("SICAS_PASSWORD") || "";
    const sicasEndpoint = Deno.env.get("SICAS_SOAP_ENDPOINT") || Deno.env.get("SICAS_ENDPOINT") || "";

    if (!sicasUsername || !sicasPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "SICAS credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!sicasEndpoint) {
      return new Response(
        JSON.stringify({ success: false, error: "SICAS endpoint not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const delivery_id = body.delivery_id || body.policy_delivery_id || body.id;

    if (!delivery_id) {
      return new Response(
        JSON.stringify({ success: false, error: "delivery_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[HWCAPTURE] Starting document registration for delivery_id=${delivery_id}`);

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

    // Check if client ID exists - this is the only hard requirement
    const clientId = delivery.sicas_client_id ||
      (delivery.sicas_resolved_fields as any)?.IDCli?.value ||
      delivery.sicas_override_cliente;

    if (!clientId || clientId === "0" || clientId === "__auto_create__") {
      const notAttemptedDiag: DocumentRegistrationDiagnostic = {
        executed: false,
        method: "ProcesarWS", key_process: "DATA", key_code: "HWCAPTURE",
        tproc: "Save_Data", type_format: "XML",
        payload_fields: {}, missing_fields: ["IDCli"],
        field_mapping: {}, plain_data_xml: "",
        encrypted_data_xml_length: 0, soap_request_redacted: "",
        soap_response: "", parsed_response: null,
        detected_id_docto: null, document_stage_status: "not_attempted",
        encryption_used: false, encryption_method: "none", iv_used: "",
        error_message: "No existe sicas_client_id. Primero se debe crear/resolver el contacto en SICAS.",
      };

      await supabase.from("policy_deliveries").update({
        sicas_request_debug: { document_registration_diagnostic: notAttemptedDiag },
        sicas_error_message: "IDCli no disponible. Use el flujo completo de registro primero.",
        sicas_error_step: "validate_client_id",
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          status: "no_client_id",
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

    // Resolve fields - lenient, uses existing resolved + defaults + catalogs
    const { payload, warnings, resolved_sources } = await resolveFieldsForHwcapture(supabase, delivery, defaults);

    console.log(`[HWCAPTURE] Resolved payload: ${JSON.stringify(payload)}`);
    console.log(`[HWCAPTURE] Warnings: ${JSON.stringify(warnings)}`);
    console.log(`[HWCAPTURE] Missing critical fields: IDCli=${payload.IDCli ? 'OK' : 'MISSING'}, Documento=${payload.Documento ? 'OK' : 'MISSING'}`);

    // Save resolved payload for traceability
    await supabase.from("policy_deliveries").update({
      sicas_request_payload: payload,
    }).eq("id", delivery_id);

    // Execute HWCAPTURE - ALWAYS attempt regardless of missing non-critical fields
    const result = await executeHwcapture(payload, sicasEndpoint, sicasUsername, sicasPassword);

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
          success: true,
          status: "registered",
          message: `Poliza registrada en SICAS con ID: ${result.documentId}`,
          document_id: result.documentId,
          document_registration_diagnostic: result.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.success && result.noIdReturned) {
      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "unverified",
        sicas_error_message: "SICAS confirmo exito pero no devolvio IDDocto.",
        sicas_error_step: "save_hwcapture",
        sicas_document_status: "unverified",
        sicas_registration_stage: "save_hwcapture",
        sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: false,
          status: "unverified",
          message: "SICAS confirmo exito pero no devolvio IDDocto. Use 'Reintentar busqueda' para verificar.",
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
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: "created",
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            status: "registered",
            message: `Poliza ya existia en SICAS con ID: ${docId}`,
            document_id: docId,
            is_duplicate: true,
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
          success: false,
          status: "duplicate_no_id",
          message: "Poliza duplicada en SICAS pero no se obtuvo el IDDocto.",
          document_registration_diagnostic: result.diagnostics,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HWCAPTURE failed
    await supabase.from("policy_deliveries").update({
      sicas_registration_status: "document_not_created",
      sicas_error_message: result.error || "Error desconocido en HWCAPTURE",
      sicas_error_step: "save_hwcapture",
      sicas_document_status: "failed",
      sicas_request_debug: { document_registration_diagnostic: result.diagnostics, resolved_sources, warnings },
    }).eq("id", delivery_id);

    return new Response(
      JSON.stringify({
        success: false,
        status: "document_not_created",
        message: result.error || "Error al registrar documento en SICAS via HWCAPTURE",
        document_registration_diagnostic: result.diagnostics,
        warnings,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[HWCAPTURE] Unhandled error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
