import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import CryptoJS from "npm:crypto-js@4.2.0";
import { createSicasRequestManager } from "../_shared/sicasRequestManager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
// Types
// ============================================================

interface PolicyDelivery {
  id: string;
  policy_number: string | null;
  manual_policy_number: string | null;
  insured_name: string | null;
  insured_rfc: string | null;
  vendor_sicas_id: string | null;
  vendor_sicas_name: string | null;
  sicas_office_id: string | null;
  start_date: string | null;
  end_date: string | null;
  total_premium: string | null;
  currency: string | null;
  payment_method: string | null;
  vehicle_description: string | null;
  plates: string | null;
  vin: string | null;
  engine: string | null;
  extracted_data: Record<string, any> | null;
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
  sicas_client_id: string | null;
  sicas_registration_attempts: number | null;
}

interface CatalogRecord {
  id_sicas: string;
  nombre: string;
  raw: Record<string, any> | null;
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

interface ResolutionResult {
  resolved: Record<string, ResolvedField>;
  missing: string[];
  warnings: string[];
  logs: Record<string, any>;
}

type RegistrationStep =
  | "start"
  | "authenticate_sicas"
  | "resolve_required_fields"
  | "search_client"
  | "create_client_if_needed"
  | "build_hwcapture_payload"
  | "validate_payload"
  | "save_hwcapture"
  | "completed";

interface StepError {
  step: RegistrationStep;
  endpoint?: string;
  contentType?: string;
  statusCode?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  payloadSanitized?: Record<string, string>;
  message: string;
}

// ============================================================
// Helpers
// ============================================================

function uniqueMissingFields(fields: string[]): string[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = field.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function normalizeSicasAmount(value: string | null | undefined): string | null {
  if (!value) return null;
  let str = String(value).trim();
  if (!str || str === "0") return null;
  // Remove thousands separators (commas) but preserve decimal point
  // "15,231.80" → "15231.80", "1,000,000.50" → "1000000.50"
  str = str.replace(/,(?=\d{3}(\.|,|\b))/g, "");
  // If result is not a valid number, return null
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0) return null;
  // Return with 2 decimal places
  return num.toFixed(2);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanClientName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .substring(0, 200);
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

function buildStepError(step: RegistrationStep, message: string, details?: Partial<StepError>): StepError {
  return { step, message, ...details };
}


// ============================================================
// Catalog Matching
// ============================================================

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

  for (const term of normalizedTerms) {
    if (term.length < 3) continue;
    for (const r of records) {
      const normalized = normalizeText(r.nombre);
      if (normalized.includes(term) || term.includes(normalized)) return r;
    }
  }

  return null;
}

function findExecutiveByVendorName(ejecutivos: CatalogRecord[], vendorName: string): CatalogRecord | null {
  if (!vendorName) return null;
  const normalizedVendor = normalizeText(vendorName);
  if (!normalizedVendor) return null;

  const exact = ejecutivos.find(r => normalizeText(r.nombre) === normalizedVendor);
  if (exact) return exact;

  const vendorParts = normalizedVendor.split(" ").filter(p => p.length > 1);
  if (vendorParts.length >= 3) {
    for (const ej of ejecutivos) {
      const ejNorm = normalizeText(ej.nombre);
      const ejParts = ejNorm.split(" ").filter(p => p.length > 1);
      if (ejParts.length >= 3) {
        const vendorSet = new Set(vendorParts);
        const ejSet = new Set(ejParts);
        const intersection = [...vendorSet].filter(p => ejSet.has(p));
        const matchRatio = intersection.length / Math.max(vendorParts.length, ejParts.length);
        if (matchRatio >= 0.8) return ej;
      }
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
  const logs: Record<string, any> = {};

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

  let vendorData: any = null;
  if (delivery.vendor_sicas_id) {
    const { data } = await supabase
      .from("sicas_catalogos")
      .select("id_sicas, nombre, raw")
      .eq("catalog_type_id", 32)
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
    } else {
      missing.push("Tipo de Documento (IDTipoDocto)");
    }
  }

  // === 2. IDCia ===
  if (delivery.sicas_override_cia) {
    resolved.IDCia = { value: delivery.sicas_override_cia, source: "override" };
  } else if (getDefault("IDCia")) {
    resolved.IDCia = { value: getDefault("IDCia")!, source: "default" };
  } else {
    const cias = catalogCache[12] || [];
    const qualitasMatch = findCatalogMatch(cias, ["QUALITAS", "QUALITAS COMPANIA DE SEGUROS", "QUALITAS COMPANIA", "QUALITAS SEGUROS", "QCS", "QUALITAS CIA"]);
    if (qualitasMatch) {
      resolved.IDCia = { value: qualitasMatch.id_sicas, source: "catalog_match_qualitas", label: qualitasMatch.nombre };
    } else {
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
    const hasVehicleData = !!(delivery.vehicle_description || delivery.plates || delivery.vin || delivery.engine);
    const searchTerms = hasVehicleData
      ? ["AUTOS", "AUTOMOVILES", "VEHICULOS", "DANOS AUTOS", "AUTO", "AUTO INDIVIDUAL", "AUTOS RESIDENTES"]
      : ["AUTOS", "AUTOMOVILES", "VEHICULOS"];
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
    const subRamoMatch = findCatalogMatch(subRamos, ["AUTOMOVILES", "AUTOS RESIDENTES", "AUTO INDIVIDUAL", "AUTOS", "VEHICULOS", "RESIDENTES", "AUTOS IND"]);
    if (subRamoMatch) {
      resolved.IDSubRamo = { value: subRamoMatch.id_sicas, source: "catalog_match_autos", label: subRamoMatch.nombre };
    } else if (subRamos.length === 1) {
      resolved.IDSubRamo = { value: subRamos[0].id_sicas, source: "single_catalog_item", label: subRamos[0].nombre };
    } else {
      missing.push("SubRamo (IDSubRamo)");
    }
  }

  // === 5. IDMon ===
  if (delivery.sicas_override_moneda) {
    resolved.IDMon = { value: delivery.sicas_override_moneda, source: "override" };
  } else if (getDefault("IDMon")) {
    resolved.IDMon = { value: getDefault("IDMon")!, source: "default" };
  } else {
    const monedas = catalogCache[6] || [];
    const extractedCurrency = delivery.currency || delivery.extracted_data?.moneda;
    let searchTermsMoneda = ["PESOS", "PESOS MEXICANOS", "PESO MEXICANO", "MXN", "MONEDA NACIONAL", "M.N.", "MN", "NACIONAL"];
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

  // === 6. IDFPago ===
  if (delivery.sicas_override_fpago) {
    resolved.IDFPago = { value: delivery.sicas_override_fpago, source: "override" };
  } else {
    const fpagos = catalogCache[8] || [];
    const extractedFPago = delivery.payment_method || delivery.extracted_data?.formaPago || delivery.extracted_data?.forma_pago;

    if (extractedFPago) {
      const fpagoMatch = findCatalogMatch(fpagos, [extractedFPago, "CONTADO", "PAGO DE CONTADO", "ANUAL", "UNA EXHIBICION", "SEMESTRAL", "TRIMESTRAL", "MENSUAL"]);
      if (fpagoMatch) {
        resolved.IDFPago = { value: fpagoMatch.id_sicas, source: "catalog_match_extracted", label: fpagoMatch.nombre };
      } else if (getDefault("IDFPago")) {
        resolved.IDFPago = { value: getDefault("IDFPago")!, source: "default" };
        warnings.push(`IDFPago: Se extrajo "${extractedFPago}" pero no se encontro en catalogo. Se uso default.`);
      } else {
        missing.push("Forma de Pago (IDFPago)");
      }
    } else if (getDefault("IDFPago")) {
      resolved.IDFPago = { value: getDefault("IDFPago")!, source: "default" };
    } else {
      const contadoMatch = findCatalogMatch(fpagos, ["CONTADO", "PAGO DE CONTADO", "ANUAL", "UNA EXHIBICION", "1 PAGO", "UN PAGO"]);
      if (contadoMatch) {
        resolved.IDFPago = { value: contadoMatch.id_sicas, source: "catalog_match_contado", label: contadoMatch.nombre };
      } else {
        missing.push("Forma de Pago (IDFPago)");
      }
    }
  }

  // === 7. IDGrupo ===
  if (delivery.sicas_override_grupo) {
    resolved.IDGrupo = { value: delivery.sicas_override_grupo, source: "override" };
  } else {
    const grupos = catalogCache[62] || [];
    const generalMatch = grupos.find(g => normalizeText(g.nombre) === "GENERAL");
    if (generalMatch) {
      resolved.IDGrupo = { value: generalMatch.id_sicas, source: "catalog_match_general", label: generalMatch.nombre };
    } else if (getDefault("IDGrupo")) {
      resolved.IDGrupo = { value: getDefault("IDGrupo")!, source: "default" };
    } else {
      missing.push("Grupo (IDGrupo)");
    }
  }

  // === 8. IDEjecutivo ===
  logs.ejecutivo = { vendor_name: delivery.vendor_sicas_name || "" };

  if (delivery.sicas_override_ejecutivo) {
    resolved.IDEjecutivo = { value: delivery.sicas_override_ejecutivo, source: "override" };
  } else {
    const ejecutivos = catalogCache[16] || [];
    const vendorName = delivery.vendor_sicas_name || "";

    const nameMatch = findExecutiveByVendorName(ejecutivos, vendorName);
    if (nameMatch) {
      resolved.IDEjecutivo = { value: nameMatch.id_sicas, source: "matched_to_vendor_name", label: nameMatch.nombre };
    } else if (vendorData?.raw?.IDEjecutivo && String(vendorData.raw.IDEjecutivo) !== "0") {
      const ejId = String(vendorData.raw.IDEjecutivo);
      const ejRecord = ejecutivos.find(e => e.id_sicas === ejId);
      resolved.IDEjecutivo = { value: ejId, source: "vendor", label: ejRecord?.nombre };
    } else if (vendorData?.raw?.IDEjecut && String(vendorData.raw.IDEjecut) !== "0") {
      const ejId = String(vendorData.raw.IDEjecut);
      const ejRecord = ejecutivos.find(e => e.id_sicas === ejId);
      resolved.IDEjecutivo = { value: ejId, source: "vendor", label: ejRecord?.nombre };
    } else if (getDefault("IDEjecutivo")) {
      resolved.IDEjecutivo = { value: getDefault("IDEjecutivo")!, source: "default" };
    } else if (delivery.vendor_sicas_id) {
      resolved.IDEjecutivo = { value: delivery.vendor_sicas_id, source: "fallback_vendor_id", label: vendorName || undefined };
      warnings.push(`IDEjecutivo: Se asigno el ID del vendedor (${delivery.vendor_sicas_id}) como ejecutivo.`);
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
    const estatusMatch = findCatalogMatch(estatuses, ["VIGENTE", "VIGENTES", "V", "VIG", "ACTIVA", "EN VIGOR"]);
    if (estatusMatch) {
      resolved.Estatus = { value: estatusMatch.id_sicas, source: "catalog_match_vigente", label: estatusMatch.nombre };
    } else {
      missing.push("Estatus");
    }
  }

  // === 10. IDCli (Cliente) ===
  logs.cliente = {};

  if (delivery.sicas_override_cliente) {
    resolved.IDCli = { value: delivery.sicas_override_cliente, source: "override" };
  } else if (delivery.sicas_client_id) {
    resolved.IDCli = { value: delivery.sicas_client_id, source: "previously_resolved" };
  } else {
    const nameToSearch = delivery.insured_name
      || delivery.extracted_data?.nombreCliente
      || delivery.extracted_data?.insured_name
      || delivery.extracted_data?.asegurado
      || delivery.extracted_data?.contratante
      || delivery.extracted_data?.cliente
      || delivery.extracted_data?.customer_name
      || delivery.extracted_data?.titular
      || delivery.extracted_data?.nombre_asegurado
      || "";

    const rfcToSearch = delivery.insured_rfc
      || delivery.extracted_data?.rfcAsegurado
      || delivery.extracted_data?.insured_rfc
      || delivery.extracted_data?.rfc
      || delivery.extracted_data?.RFCCliente
      || delivery.extracted_data?.rfc_asegurado
      || "";

    logs.cliente.client_search_rfc = rfcToSearch || null;
    logs.cliente.client_search_name = nameToSearch || null;

    let clientFound = false;

    if (rfcToSearch) {
      const rfcNormalized = rfcToSearch.trim().toUpperCase().replace(/[-\s]/g, "");
      if (rfcNormalized.length >= 10) {
        const { data: byRfc } = await supabase
          .from("sicas_catalogos")
          .select("id_sicas, nombre, raw")
          .eq("catalog_type_id", 17)
          .ilike("raw->>RFC", rfcNormalized)
          .limit(5);

        if (byRfc && byRfc.length >= 1) {
          resolved.IDCli = { value: byRfc[0].id_sicas, source: "matched_by_rfc", label: byRfc[0].nombre };
          logs.cliente.selected_client_id = byRfc[0].id_sicas;
          logs.cliente.candidates_count = byRfc.length;
          clientFound = true;
          if (byRfc.length > 1) {
            warnings.push(`IDCli: RFC "${rfcToSearch}" tiene ${byRfc.length} coincidencias. Se selecciono: "${byRfc[0].nombre}".`);
          }
        }
      }
    }

    if (!clientFound && nameToSearch.trim()) {
      const normalizedName = normalizeText(nameToSearch);
      if (normalizedName.length >= 3) {
        const { data: byName } = await supabase
          .from("sicas_catalogos")
          .select("id_sicas, nombre, raw")
          .eq("catalog_type_id", 17)
          .limit(500);

        if (byName && byName.length > 0) {
          const exactMatch = byName.find((r: CatalogRecord) => normalizeText(r.nombre) === normalizedName);
          if (exactMatch) {
            resolved.IDCli = { value: exactMatch.id_sicas, source: "matched_by_name", label: exactMatch.nombre };
            clientFound = true;
          } else {
            const partialMatches = byName.filter((r: CatalogRecord) => {
              const normalized = normalizeText(r.nombre);
              return normalized.includes(normalizedName) || normalizedName.includes(normalized);
            });
            if (partialMatches.length >= 1) {
              resolved.IDCli = { value: partialMatches[0].id_sicas, source: "matched_by_name_partial", label: partialMatches[0].nombre };
              clientFound = true;
              if (partialMatches.length > 1) {
                warnings.push(`IDCli: "${nameToSearch}" tiene ${partialMatches.length} coincidencias. Se selecciono: "${partialMatches[0].nombre}".`);
              }
            }
          }
        }
      }
    }

    if (!clientFound) {
      if (nameToSearch.trim()) {
        logs.cliente.auto_create_eligible = true;
        logs.cliente.auto_create_name = nameToSearch.trim();
        resolved.IDCli = { value: "__auto_create__", source: "auto_create_pending", label: nameToSearch.trim() };
        warnings.push(`IDCli: No se encontro cliente. Se creara automaticamente.`);
      } else {
        resolved.IDCli = { value: "0", source: "fallback_no_name", label: "Sin cliente identificado" };
        warnings.push(`IDCli: No hay nombre de cliente disponible. Se registrara con cliente generico (0).`);
      }
    }
  }

  // === 11. IDVend ===
  if (delivery.vendor_sicas_id) {
    resolved.IDVend = { value: delivery.vendor_sicas_id, source: "policy_delivery" };
  } else {
    missing.push("Agente/Vendedor (IDVend)");
  }

  return { resolved, missing, warnings, logs };
}

// ============================================================
// Client Auto-Creation via SICAS SOAP
// ============================================================

async function attemptClientAutoCreate(
  supabase: any,
  delivery: PolicyDelivery,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<{ success: boolean; clientId?: string; clientName?: string; error?: string; stepError?: StepError }> {
  const clientName = delivery.insured_name
    || delivery.extracted_data?.nombreCliente
    || delivery.extracted_data?.insured_name
    || delivery.extracted_data?.asegurado
    || delivery.extracted_data?.contratante
    || delivery.extracted_data?.cliente
    || delivery.extracted_data?.customer_name
    || delivery.extracted_data?.titular
    || delivery.extracted_data?.nombre_asegurado
    || "";
  const clientRfc = delivery.insured_rfc
    || delivery.extracted_data?.rfcAsegurado
    || delivery.extracted_data?.insured_rfc
    || delivery.extracted_data?.rfc
    || delivery.extracted_data?.RFCCliente
    || delivery.extracted_data?.rfc_asegurado
    || "";

  if (!clientName.trim()) {
    return { success: false, error: "No hay nombre de cliente para crear" };
  }

  if (!sicasEndpoint) {
    return { success: false, error: "SICAS endpoint no configurado" };
  }

  const cleanedName = cleanClientName(clientName);

  // Pre-validation: name must be at least 3 characters
  if (cleanedName.length < 3) {
    return {
      success: false,
      error: `Nombre de cliente muy corto: "${cleanedName}" (minimo 3 caracteres)`,
      stepError: buildStepError("create_client_if_needed", `Nombre de cliente muy corto: "${cleanedName}"`, {
        payloadSanitized: { CliNombre: cleanedName },
      }),
    };
  }

  // Pre-validation: RFC format if provided
  if (clientRfc) {
    const rfcClean = clientRfc.trim().toUpperCase().replace(/[-\s]/g, "");
    if (rfcClean.length > 0 && (rfcClean.length < 10 || rfcClean.length > 13)) {
      console.warn(`[SICAS Client] RFC con longitud invalida (${rfcClean.length}): "${rfcClean}". Se omitira.`);
    }
  }

  console.log(`[SICAS Client] Creating: name="${cleanedName}", rfc="${clientRfc || "N/A"}"`);

  const isEmpresa = /^(S\.?A\.?|S\.?C\.?|S\.? DE R\.?L\.?|SOCIEDAD|EMPRESA|CORPORAT|CIA|COMPAÑIA)/i.test(cleanedName);

  // Build CatContactos fields for Procesar_String WS 2.0
  // Per documentation: PropertyTypeProcess=WS_SaveData, PropertyTypeData=WS_Contactos
  const nameParts = cleanedName.split(/\s+/);
  let apellidoP = "";
  let apellidoM = "";
  let nombre = "";
  if (nameParts.length === 1) {
    nombre = nameParts[0];
  } else if (nameParts.length === 2) {
    nombre = nameParts[0];
    apellidoP = nameParts[1];
  } else if (nameParts.length === 3) {
    nombre = nameParts[0];
    apellidoP = nameParts[1];
    apellidoM = nameParts[2];
  } else {
    apellidoM = nameParts[nameParts.length - 1];
    apellidoP = nameParts[nameParts.length - 2];
    nombre = nameParts.slice(0, nameParts.length - 2).join(" ");
  }

  const catContactosFields: string[] = [];
  catContactosFields.push(`CatContactos.TipoEnt|${isEmpresa ? "1" : "0"}`);
  catContactosFields.push(`CatContactos.ApellidoP|${apellidoP}`);
  if (apellidoM) catContactosFields.push(`CatContactos.ApellidoM|${apellidoM}`);
  catContactosFields.push(`CatContactos.Nombre|${nombre}`);

  const rfcForSicas = clientRfc || "XXXX000000XXX";
  catContactosFields.push(`CatContactos.RFC|${rfcForSicas}`);

  const emailVal = sanitizeField(delivery.extracted_data?.email || delivery.extracted_data?.correo);
  const phoneVal = sanitizeField(delivery.extracted_data?.telefono || delivery.extracted_data?.phone);
  if (phoneVal) catContactosFields.push(`CatContactos.Telefono3|Celular|${phoneVal}`);
  if (emailVal) catContactosFields.push(`CatContactos.EMail1|${emailVal}`);

  const oDataString = catContactosFields.join(",");

  // Defensive validation: only WS_Contactos is valid for PropertyTypeData
  validateNoWsPrefix("PropertyTypeData", SICAS_CONTACT_TYPE_DATA);

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Procesar_String>
      <tem:oDataString><![CDATA[${oDataString}]]></tem:oDataString>
      <tem:oConfigData>
        <tem:PropertyTypeProcess>WS_SaveData</tem:PropertyTypeProcess>
        <tem:PropertyTypeData>${SICAS_CONTACT_TYPE_DATA}</tem:PropertyTypeData>
        <tem:PropertyWhatMakeExist>WS_UsarloNoUpdate</tem:PropertyWhatMakeExist>
        <tem:PropertyVerifyContact>WS_NombreCompleto</tem:PropertyVerifyContact>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(sicasUsername)}</tem:UserName>
        <tem:Password>${escapeXml(sicasPassword)}</tem:Password>
      </tem:oConfigAuth>
    </tem:Procesar_String>
  </soapenv:Body>
</soapenv:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log(`[SICAS Client] SOAP Method: Procesar_String`);
    console.log(`[SICAS Client] PropertyTypeProcess: WS_SaveData`);
    console.log(`[SICAS Client] PropertyTypeData: ${SICAS_CONTACT_TYPE_DATA}`);
    console.log(`[SICAS Client] Endpoint: ${sicasEndpoint}`);
    console.log(`[SICAS Client] Fields count: ${catContactosFields.length}`);
    console.log(`[SICAS Client] Full SOAP Request:`, soapEnvelope);
    console.log(`[SICAS Client] Payload fields: ${catContactosFields.join(", ")}`);

    const response = await fetch(sicasEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/Procesar_String",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log(`[SICAS Client] Response status: ${response.status}`);
    console.log(`[SICAS Client] Response body (first 500):`, responseText.substring(0, 500));

    if (!response.ok) {
      const fault = parseSoapFault(responseText);
      const faultMessage = fault.faultstring
        ? `SOAP Fault [${fault.faultcode}]: ${fault.faultstring}`
        : `SICAS HTTP ${response.status}: ${response.statusText}`;

      const stepError = buildStepError("create_client_if_needed", faultMessage, {
        endpoint: sicasEndpoint,
        contentType: "text/xml; charset=utf-8",
        statusCode: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 3000),
        payloadSanitized: Object.fromEntries(catContactosFields.map(f => { const [k, v] = f.split("|"); return [k, v]; })),
      });

      console.error(`[SICAS Client] SOAP Fault: code=${fault.faultcode}, string=${fault.faultstring}, detail=${fault.detail}`);
      return { success: false, error: faultMessage, stepError };
    }

    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const idMatch = decoded.match(/<IDContacto>(\d+)<\/IDContacto>/i) ||
                    decoded.match(/<IDCli>(\d+)<\/IDCli>/i) ||
                    decoded.match(/<ID>(\d+)<\/ID>/i) ||
                    decoded.match(/<RESPONSENBR>\s*(\d+)\s*<\/RESPONSENBR>/i);

    const hasSuccess = /SUCESS|SUCCESS|OK|GUARDADO|CREADO/i.test(decoded);
    const hasError = /ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded);

    if (hasError) {
      const errorMsg = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] ||
                       decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       "Error SICAS al crear cliente";
      return { success: false, error: errorMsg };
    }

    if (idMatch && idMatch[1] && parseInt(idMatch[1]) > 0) {
      return { success: true, clientId: idMatch[1], clientName: cleanedName };
    }

    if (hasSuccess) {
      return { success: true, clientId: undefined, clientName: cleanedName };
    }

    return { success: false, error: `Respuesta SICAS no reconocida: ${responseText.substring(0, 200)}` };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error.name === "AbortError" ? "Timeout: SICAS no respondio en 30s" : error.message;
    return { success: false, error: msg };
  }
}

// ============================================================
// Payload Validation
// ============================================================

function validatePayload(resolved: Record<string, ResolvedField>, delivery: PolicyDelivery): { valid: boolean; errors: string[]; sanitizedPayload: Record<string, string> } {
  const errors: string[] = [];
  const sanitizedPayload: Record<string, string> = {};

  const requiredFields = ["IDTipoDocto", "IDCia", "IDRamo", "IDSubRamo", "IDMon", "IDFPago", "IDEjecutivo", "IDGrupo", "Estatus"];

  for (const field of requiredFields) {
    const val = resolved[field]?.value;
    const clean = sanitizeField(val);
    if (!clean) {
      errors.push(`${field} tiene valor invalido: "${val}"`);
    } else {
      sanitizedPayload[field] = clean;
    }
  }

  if (resolved.IDCli?.value && resolved.IDCli.value !== "__auto_create__") {
    const cliClean = sanitizeField(resolved.IDCli.value);
    if (cliClean) sanitizedPayload.IDCli = cliClean;
  }
  if (resolved.IDVend?.value) {
    const vendClean = sanitizeField(resolved.IDVend.value);
    if (vendClean) sanitizedPayload.IDVend = vendClean;
  }

  const policyNumber = sanitizeField(delivery.manual_policy_number || delivery.policy_number);
  if (policyNumber) sanitizedPayload.Documento = policyNumber;

  const startDate = normalizeDate(delivery.start_date);
  const endDate = normalizeDate(delivery.end_date);
  if (startDate) sanitizedPayload.FechaInicio = startDate;
  if (endDate) sanitizedPayload.FechaFin = endDate;

  const rawPremium = sanitizeField(delivery.total_premium || delivery.extracted_data?.primaTotal);
  const premium = normalizeSicasAmount(rawPremium);
  if (premium) sanitizedPayload.PrimaTotal = premium;

  if (delivery.sicas_office_id) sanitizedPayload.IDOficina = delivery.sicas_office_id;
  if (delivery.vehicle_description) sanitizedPayload.Descripcion = delivery.vehicle_description;
  if (delivery.plates) sanitizedPayload.Placas = delivery.plates;
  if (delivery.vin) sanitizedPayload.NumSerie = delivery.vin;
  if (delivery.engine) sanitizedPayload.Motor = delivery.engine;

  return { valid: errors.length === 0, errors, sanitizedPayload };
}

// ============================================================
// Enhanced Document ID Extraction
// ============================================================

function extractFirstValidId(responseText: string, fieldNames: string[]): string | null {
  const decoded = responseText
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

  for (const field of fieldNames) {
    // XML tag format: <FieldName>12345</FieldName>
    const xmlRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
    const xmlMatch = decoded.match(xmlRegex);
    if (xmlMatch?.[1] && parseInt(xmlMatch[1]) >= MIN_VALID_DOCUMENT_ID) return xmlMatch[1];

    // JSON format: "FieldName": "12345" or "FieldName": 12345
    const jsonRegex = new RegExp(`"${field}"\\s*:\\s*"?(\\d+)"?`, "i");
    const jsonMatch = decoded.match(jsonRegex);
    if (jsonMatch?.[1] && parseInt(jsonMatch[1]) >= MIN_VALID_DOCUMENT_ID) return jsonMatch[1];

    // Attribute format: FieldName="12345"
    const attrRegex = new RegExp(`${field}["\s:=]*>?(\\d+)`, "i");
    const attrMatch = decoded.match(attrRegex);
    if (attrMatch?.[1] && parseInt(attrMatch[1]) >= MIN_VALID_DOCUMENT_ID) return attrMatch[1];
  }

  // Also check for PROCESSDATA or NewDataSet wrappers
  const processDataMatch = decoded.match(/<PROCESSDATA[^>]*>([\s\S]*?)<\/PROCESSDATA>/i);
  if (processDataMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = processDataMatch[1].match(innerRegex);
      if (innerMatch?.[1] && parseInt(innerMatch[1]) >= MIN_VALID_DOCUMENT_ID) return innerMatch[1];
    }
  }

  const newDataSetMatch = decoded.match(/<NewDataSet[^>]*>([\s\S]*?)<\/NewDataSet>/i);
  if (newDataSetMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = newDataSetMatch[1].match(innerRegex);
      if (innerMatch?.[1] && parseInt(innerMatch[1]) >= MIN_VALID_DOCUMENT_ID) return innerMatch[1];
    }
  }

  // Check DATAINFO wrapper
  const dataInfoMatch = decoded.match(/<DATAINFO[^>]*>([\s\S]*?)<\/DATAINFO>/i);
  if (dataInfoMatch) {
    for (const field of fieldNames) {
      const innerRegex = new RegExp(`<${field}>\\s*(\\d+)\\s*</${field}>`, "i");
      const innerMatch = dataInfoMatch[1].match(innerRegex);
      if (innerMatch?.[1] && parseInt(innerMatch[1]) >= MIN_VALID_DOCUMENT_ID) return innerMatch[1];
    }
  }

  return null;
}

const DOCUMENT_ID_FIELDS = [
  "IDDocto",
  "IDDocumento",
  "ID_Docto",
  "DocumentoID",
  "NewIDValue",
  "NewSubIDValue",
  "ID",
];

// Minimum threshold for a valid document ID (small numbers like 1-10 are likely response codes, not document IDs)
const MIN_VALID_DOCUMENT_ID = 100;

// ============================================================
// Post-Save Document Lookup via SICAS ReadInfoData
// ============================================================

interface LookupResult {
  found: boolean;
  documentId?: string;
  documentData?: Record<string, string>;
  rawResponse?: string;
  error?: string;
  method?: string;
  score?: number;
  diagnostics?: StrategyDiagnostic[];
  multipleMatches?: ScoredMatch[];
}

interface StrategyDiagnostic {
  strategy: string;
  request_summary: Record<string, string>;
  results_count: number;
  best_match_score: number;
  matched_id_docto: string | null;
  error?: string;
  duration_ms?: number;
}

interface ScoredMatch {
  id_docto: string;
  documento: string;
  cliente: string;
  score: number;
  method: string;
}

interface LookupContext {
  policyNumber: string;
  clientId: string | null;
  vendorId: string | null;
  insuredName: string | null;
  premium: string | null;
  startDate: string | null;
  registrationDate: string | null;
}

function normalizePolicyNumber(pn: string): string {
  return pn.replace(/[\s\-_.\/\\]/g, "").toUpperCase();
}

function scoreSicasDocumentMatch(ctx: LookupContext, doc: Record<string, string>): number {
  let score = 0;

  const docPoliza = doc.Documento || doc.NumPoliza || doc.Poliza || "";
  if (docPoliza && ctx.policyNumber) {
    const normDoc = normalizePolicyNumber(docPoliza);
    const normCtx = normalizePolicyNumber(ctx.policyNumber);
    if (normDoc === normCtx) {
      score += 60;
    } else if (normDoc.endsWith(normCtx) || normCtx.endsWith(normDoc)) {
      score += 45;
    } else if (normDoc.includes(normCtx) || normCtx.includes(normDoc)) {
      score += 35;
    }
  }

  const docCliente = doc.CliNombre || doc.Cliente || doc.Asegurado || doc.Nombre || "";
  if (docCliente && ctx.insuredName) {
    const normDocCli = normalizeText(docCliente);
    const normCtxCli = normalizeText(ctx.insuredName);
    if (normDocCli === normCtxCli) {
      score += 30;
    } else {
      const docParts = normDocCli.split(" ").filter(p => p.length > 2);
      const ctxParts = normCtxCli.split(" ").filter(p => p.length > 2);
      if (docParts.length > 0 && ctxParts.length > 0) {
        const common = docParts.filter(p => ctxParts.includes(p));
        const ratio = common.length / Math.max(docParts.length, ctxParts.length);
        if (ratio >= 0.6) score += 20;
        else if (ratio >= 0.3) score += 10;
      }
    }
  }

  const docPrima = doc.PrimaNeta || doc.Prima || doc.PrimaTotal || "";
  if (docPrima && ctx.premium) {
    const normDocP = parseFloat(docPrima.replace(/[,$]/g, "")) || 0;
    const normCtxP = parseFloat(ctx.premium.replace(/[,$]/g, "")) || 0;
    if (normDocP > 0 && normCtxP > 0) {
      const tolerance = Math.max(normDocP, normCtxP) * 0.02;
      if (Math.abs(normDocP - normCtxP) <= tolerance) score += 20;
    }
  }

  const docVendor = doc.IDVend || doc.Vendedor || "";
  if (docVendor && ctx.vendorId) {
    if (docVendor === ctx.vendorId) score += 20;
  }

  const docFCaptura = doc.FCaptura || doc.FechaCaptura || doc.FEmision || "";
  if (docFCaptura && ctx.registrationDate) {
    try {
      const docDate = new Date(docFCaptura.includes("/") ? docFCaptura.split("/").reverse().join("-") : docFCaptura);
      const regDate = new Date(ctx.registrationDate);
      const diffDays = Math.abs((docDate.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) score += 15;
      else if (diffDays <= 3) score += 10;
      else if (diffDays <= 7) score += 5;
    } catch { /* ignore parse errors */ }
  }

  const docVigIni = doc.VigIni || doc.FVigIni || doc.VigenciaInicio || "";
  if (docVigIni && ctx.startDate) {
    try {
      const docVig = new Date(docVigIni.includes("/") ? docVigIni.split("/").reverse().join("-") : docVigIni);
      const ctxVig = new Date(ctx.startDate);
      const diffDays = Math.abs((docVig.getTime() - ctxVig.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) score += 15;
      else if (diffDays <= 7) score += 8;
    } catch { /* ignore */ }
  }

  return score;
}

async function findSicasDocumentAfterSave(
  policyNumber: string,
  clientId: string | null,
  vendorId: string | null,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string,
  extraContext?: { insuredName?: string; premium?: string; startDate?: string; registrationDate?: string },
): Promise<LookupResult> {
  if (!policyNumber) {
    return { found: false, error: "No policy number to search", diagnostics: [] };
  }

  const ctx: LookupContext = {
    policyNumber,
    clientId,
    vendorId,
    insuredName: extraContext?.insuredName || null,
    premium: extraContext?.premium || null,
    startDate: extraContext?.startDate || null,
    registrationDate: extraContext?.registrationDate || null,
  };

  const diagnostics: StrategyDiagnostic[] = [];
  const allScoredMatches: ScoredMatch[] = [];

  // Strategy 1: Search documents by client
  if (clientId && clientId !== "0") {
    const t0 = Date.now();
    console.log(`[SICAS Lookup] Strategy 1: eDocumentos_Cliente for IDCli=${clientId}...`);
    const byClientResult = await readDocumentsByClient(clientId, sicasEndpoint, sicasUsername, sicasPassword);
    const duration = Date.now() - t0;

    let bestScore = 0;
    let bestMatch: Record<string, string> | null = null;

    for (const doc of byClientResult.documents) {
      const docScore = scoreSicasDocumentMatch(ctx, doc);
      if (docScore > bestScore) {
        bestScore = docScore;
        bestMatch = doc;
      }
      if (doc.IDDocto && docScore >= 60) {
        allScoredMatches.push({
          id_docto: doc.IDDocto,
          documento: doc.Documento || doc.NumPoliza || "",
          cliente: doc.CliNombre || doc.Cliente || "",
          score: docScore,
          method: "client_documents",
        });
      }
    }

    diagnostics.push({
      strategy: "read_documents_by_client",
      request_summary: { property_type_read_data: "eDocumentos_Cliente", property_id_data: clientId },
      results_count: byClientResult.documents.length,
      best_match_score: bestScore,
      matched_id_docto: bestMatch?.IDDocto || null,
      duration_ms: duration,
    });

    if (bestMatch && bestScore >= 80 && bestMatch.IDDocto) {
      console.log(`[SICAS Lookup] Strategy 1 match: IDDocto=${bestMatch.IDDocto}, score=${bestScore}`);
      return {
        found: true,
        documentId: bestMatch.IDDocto,
        documentData: bestMatch,
        rawResponse: byClientResult.rawResponse,
        method: "client_documents",
        score: bestScore,
        diagnostics,
      };
    }
  }

  // Strategy 2: Report-based search (H03117) with date range
  {
    const t0 = Date.now();
    console.log(`[SICAS Lookup] Strategy 2: Report H03117 for "${policyNumber}"...`);
    const reportResult = await searchDocumentByReportEnhanced(
      policyNumber, vendorId, ctx, sicasEndpoint, sicasUsername, sicasPassword,
    );
    const duration = Date.now() - t0;

    let bestScore = 0;
    let bestMatch: Record<string, string> | null = null;

    for (const doc of reportResult.documents) {
      const docScore = scoreSicasDocumentMatch(ctx, doc);
      if (docScore > bestScore) {
        bestScore = docScore;
        bestMatch = doc;
      }
      if (doc.IDDocto && docScore >= 60) {
        allScoredMatches.push({
          id_docto: doc.IDDocto,
          documento: doc.Documento || doc.NumPoliza || "",
          cliente: doc.CliNombre || doc.Cliente || "",
          score: docScore,
          method: "report_h03117",
        });
      }
    }

    diagnostics.push({
      strategy: "report_h03117",
      request_summary: { key_code: "H03117", policy_number: policyNumber, conditions: reportResult.conditionsUsed || "" },
      results_count: reportResult.documents.length,
      best_match_score: bestScore,
      matched_id_docto: bestMatch?.IDDocto || null,
      error: reportResult.error || undefined,
      duration_ms: duration,
    });

    if (bestMatch && bestScore >= 80 && bestMatch.IDDocto) {
      console.log(`[SICAS Lookup] Strategy 2 match: IDDocto=${bestMatch.IDDocto}, score=${bestScore}`);
      return {
        found: true,
        documentId: bestMatch.IDDocto,
        documentData: bestMatch,
        rawResponse: reportResult.rawResponse,
        method: "report_h03117",
        score: bestScore,
        diagnostics,
      };
    }
  }

  // Strategy 3: Alternate report (HWS03668_WS)
  {
    const t0 = Date.now();
    console.log(`[SICAS Lookup] Strategy 3: Report HWS03668_WS for "${policyNumber}"...`);
    const altResult = await searchDocumentByAlternateReport(
      policyNumber, vendorId, ctx, sicasEndpoint, sicasUsername, sicasPassword,
    );
    const duration = Date.now() - t0;

    let bestScore = 0;
    let bestMatch: Record<string, string> | null = null;

    for (const doc of altResult.documents) {
      const docScore = scoreSicasDocumentMatch(ctx, doc);
      if (docScore > bestScore) {
        bestScore = docScore;
        bestMatch = doc;
      }
      if (doc.IDDocto && docScore >= 60) {
        allScoredMatches.push({
          id_docto: doc.IDDocto,
          documento: doc.Documento || doc.NumPoliza || "",
          cliente: doc.CliNombre || doc.Cliente || "",
          score: docScore,
          method: "report_hws03668",
        });
      }
    }

    diagnostics.push({
      strategy: "report_hws03668_ws",
      request_summary: { key_code: "HWS03668_WS", policy_number: policyNumber },
      results_count: altResult.documents.length,
      best_match_score: bestScore,
      matched_id_docto: bestMatch?.IDDocto || null,
      error: altResult.error || undefined,
      duration_ms: duration,
    });

    if (bestMatch && bestScore >= 80 && bestMatch.IDDocto) {
      console.log(`[SICAS Lookup] Strategy 3 match: IDDocto=${bestMatch.IDDocto}, score=${bestScore}`);
      return {
        found: true,
        documentId: bestMatch.IDDocto,
        documentData: bestMatch,
        rawResponse: altResult.rawResponse,
        method: "report_hws03668",
        score: bestScore,
        diagnostics,
      };
    }
  }

  // Check for possible matches (60-79)
  const possibleMatches = allScoredMatches.filter(m => m.score >= 60).sort((a, b) => b.score - a.score);
  if (possibleMatches.length > 0) {
    return {
      found: false,
      error: `Documento no confirmado. Se encontraron ${possibleMatches.length} posible(s) coincidencia(s) con score < 80.`,
      method: "possible_matches_below_threshold",
      diagnostics,
      multipleMatches: possibleMatches,
    };
  }

  return {
    found: false,
    error: `Documento con poliza "${policyNumber}" no encontrado en SICAS`,
    method: "exhausted_all_methods",
    diagnostics,
  };
}

interface ReadDocumentsResult {
  documents: Record<string, string>[];
  rawResponse?: string;
}

async function readDocumentsByClient(
  clientId: string,
  endpoint: string,
  username: string,
  password: string,
): Promise<ReadDocumentsResult> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>eDocumentos_Cliente</tem:PropertyTypeReadData>
        <tem:PropertyIDData>${escapeXml(clientId)}</tem:PropertyIDData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(username)}</tem:UserName>
        <tem:Password>${escapeXml(password)}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ReadInfoData",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    if (!response.ok) {
      console.error(`[SICAS Lookup] ReadInfoData HTTP ${response.status}`);
      return { documents: [], rawResponse: responseText.substring(0, 2000) };
    }

    const decoded = responseText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const documents = parseDocumentRecords(decoded);

    console.log(`[SICAS Lookup] ReadInfoData eDocumentos_Cliente returned ${documents.length} documents`);
    return { documents, rawResponse: responseText.substring(0, 3000) };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[SICAS Lookup] ReadInfoData error: ${error.message}`);
    return { documents: [] };
  }
}

interface ReportSearchResult {
  documents: Record<string, string>[];
  rawResponse?: string;
  error?: string;
  conditionsUsed?: string;
}

async function searchDocumentByReportEnhanced(
  policyNumber: string,
  vendorId: string | null,
  ctx: LookupContext,
  endpoint: string,
  username: string,
  password: string,
): Promise<ReportSearchResult> {
  // Build conditions with date range if registration date is available
  let conditions = `Documento|${escapeXml(policyNumber)}`;

  if (ctx.registrationDate) {
    try {
      const regDate = new Date(ctx.registrationDate);
      const fromDate = new Date(regDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      const toDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const fmtFrom = `${String(fromDate.getDate()).padStart(2, "0")}/${String(fromDate.getMonth() + 1).padStart(2, "0")}/${fromDate.getFullYear()}`;
      const fmtTo = `${String(toDate.getDate()).padStart(2, "0")}/${String(toDate.getMonth() + 1).padStart(2, "0")}/${toDate.getFullYear()}`;
      conditions = `Poliza;0;0;${escapeXml(policyNumber)};${escapeXml(policyNumber)};0;0;DatDocumentos.Documento,FCaptura;0;0;${fmtFrom};${fmtTo};0;0;DatDocumentos.FCaptura`;
    } catch {
      // Fallback to simple condition
    }
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ProcesarWS>
      <tem:oConfigData>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>H03117</tem:KeyCode>
        <tem:ConditionsAdd>${conditions}</tem:ConditionsAdd>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>20</tem:ItemForPage>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(username)}</tem:UserName>
        <tem:Password>${escapeXml(password)}</tem:Password>
      </tem:oConfigAuth>
    </tem:ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
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
    if (!response.ok) {
      return { documents: [], error: `HTTP ${response.status}`, rawResponse: responseText.substring(0, 2000), conditionsUsed: conditions };
    }

    const decoded = responseText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const documents = parseDocumentRecords(decoded);

    console.log(`[SICAS Lookup] Report H03117 returned ${documents.length} documents`);
    return { documents, rawResponse: responseText.substring(0, 3000), conditionsUsed: conditions };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { documents: [], error: error.message, conditionsUsed: conditions };
  }
}

async function searchDocumentByAlternateReport(
  policyNumber: string,
  vendorId: string | null,
  ctx: LookupContext,
  endpoint: string,
  username: string,
  password: string,
): Promise<ReportSearchResult> {
  const conditions = `Documento|${escapeXml(policyNumber)}`;

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ProcesarWS>
      <tem:oConfigData>
        <tem:KeyProcess>REPORT</tem:KeyProcess>
        <tem:KeyCode>HWS03668_WS</tem:KeyCode>
        <tem:ConditionsAdd>${conditions}</tem:ConditionsAdd>
        <tem:Page>1</tem:Page>
        <tem:ItemForPage>20</tem:ItemForPage>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(username)}</tem:UserName>
        <tem:Password>${escapeXml(password)}</tem:Password>
      </tem:oConfigAuth>
    </tem:ProcesarWS>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
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
    if (!response.ok) {
      return { documents: [], error: `HTTP ${response.status}`, rawResponse: responseText.substring(0, 2000), conditionsUsed: conditions };
    }

    const decoded = responseText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const documents = parseDocumentRecords(decoded);

    console.log(`[SICAS Lookup] Report HWS03668_WS returned ${documents.length} documents`);
    return { documents, rawResponse: responseText.substring(0, 3000), conditionsUsed: conditions };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { documents: [], error: error.message, conditionsUsed: conditions };
  }
}

function parseDocumentRecords(decoded: string): Record<string, string>[] {
  const documents: Record<string, string>[] = [];

  // Try Table_N format
  const tableRegex = /<Table[_\d]*>([\s\S]*?)<\/Table[_\d]*>/g;
  let match;

  while ((match = tableRegex.exec(decoded)) !== null) {
    const recordXml = match[1];
    const doc: Record<string, string> = {};

    // Extract all fields from the record
    const fieldRegex = /<(\w+)>(.*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(recordXml)) !== null) {
      doc[fieldMatch[1]] = fieldMatch[2].trim();
    }

    if (doc.IDDocto || doc.IDDocumento || doc.ID_Docto) {
      doc.IDDocto = doc.IDDocto || doc.IDDocumento || doc.ID_Docto;
      documents.push(doc);
    }
  }

  // Try DatDocumentos format
  if (documents.length === 0) {
    const datRegex = /<DatDocumentos>([\s\S]*?)<\/DatDocumentos>/g;
    while ((match = datRegex.exec(decoded)) !== null) {
      const recordXml = match[1];
      const doc: Record<string, string> = {};

      const fieldRegex = /<(\w+)>(.*?)<\/\1>/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(recordXml)) !== null) {
        doc[fieldMatch[1]] = fieldMatch[2].trim();
      }

      if (doc.IDDocto || doc.IDDocumento) {
        doc.IDDocto = doc.IDDocto || doc.IDDocumento;
        documents.push(doc);
      }
    }
  }

  return documents;
}

// ============================================================
// Verify Document by ID via ReadInfoData eDocumentos_Unico
// ============================================================

async function verifyDocumentById(
  documentId: string,
  endpoint: string,
  username: string,
  password: string,
): Promise<{ valid: boolean; documentData?: Record<string, string>; rawResponse?: string; error?: string }> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:ReadInfoData>
      <tem:oConfigData>
        <tem:PropertyTypeReadData>eDocumentos_Unico</tem:PropertyTypeReadData>
        <tem:PropertyIDData>${escapeXml(documentId)}</tem:PropertyIDData>
        <tem:PropertyData_TypeDataReturn>Data_XML</tem:PropertyData_TypeDataReturn>
      </tem:oConfigData>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(username)}</tem:UserName>
        <tem:Password>${escapeXml(password)}</tem:Password>
      </tem:oConfigAuth>
    </tem:ReadInfoData>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "http://tempuri.org/ReadInfoData",
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}`, rawResponse: responseText.substring(0, 2000) };
    }

    const decoded = responseText.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const documents = parseDocumentRecords(decoded);

    if (documents.length > 0 && documents[0].IDDocto) {
      return { valid: true, documentData: documents[0], rawResponse: responseText.substring(0, 2000) };
    }

    // Check if the ID appears in the response at all
    if (decoded.includes(documentId)) {
      return { valid: true, rawResponse: responseText.substring(0, 2000) };
    }

    return { valid: false, error: "Documento no encontrado con ese ID", rawResponse: responseText.substring(0, 2000) };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { valid: false, error: error.message };
  }
}

// ============================================================
// SICAS Document Registration via ProcesarWS + HWCAPTURE
// ============================================================
// Correct method for creating documents in SICAS:
// - SOAP Method: ProcesarWS (NOT Procesar_String)
// - KeyProcess: DATA
// - KeyCode: HWCAPTURE
// - TProc: Save_Data
// - TypeFormat: XML
// - DataXML: TripleDES-encrypted XML containing DatDocumentos + DatDoctoDetail
// - Encryption: TripleDES/CBC/ZeroPadding, Key fixed, IV = first 8 chars of username
// ============================================================

// Map from internal payload field names to SICAS HWCAPTURE XML element names
const HWCAPTURE_FIELD_MAP: Record<string, string> = {
  FechaInicio: "FDesde",
  FechaFin: "FHasta",
  PrimaTotal: "PrimaNeta",
  IDFPago: "FPago",
  IDEjecutivo: "IDEjecut",
  Estatus: "Status",
  IDSubRamo: "IDSRamo",
};

// SICAS TripleDES encryption key (from official documentation)
const SICAS_3DES_KEY = "%SOnlineBOGO2001-2015WS#";

function buildHwcaptureDataXml(sanitizedPayload: Record<string, string>): string {
  const docElements: string[] = [];
  docElements.push(`<IDDocto>-1</IDDocto>`);

  for (const [key, value] of Object.entries(sanitizedPayload)) {
    const hwField = HWCAPTURE_FIELD_MAP[key] || key;
    docElements.push(`<${hwField}>${escapeXml(value)}</${hwField}>`);
  }

  return `<InfoData><DatDocumentos>${docElements.join("")}</DatDocumentos><DatDoctoDetail><IDDocto>-1</IDDocto></DatDoctoDetail></InfoData>`;
}

// TripleDES encryption using crypto-js (pure JS, works in Deno/Edge Functions)
function encryptDataXmlFallback(plainXml: string, username: string): string {
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

  return encrypted.toString();
}

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
  stepError?: StepError;
  isDuplicate?: boolean;
  duplicateId?: string;
  duplicateMessage?: string;
  diagnostics?: DocumentRegistrationDiagnostic;
}

async function registerDocument(
  sanitizedPayload: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<RegisterDocumentResult> {
  const dataXmlPlain = buildHwcaptureDataXml(sanitizedPayload);
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
      error: `Cifrado TripleDES falló: ${encErr.message}. Contacte soporte técnico.`,
      diagnostics: { encryption_error: encErr.message, encryption_method: "FAILED" },
    };
  }

  // Build field mapping for diagnostics
  const fieldMapping: Record<string, string> = {};
  for (const key of Object.keys(sanitizedPayload)) {
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
    soap_request_redacted: "",
    soap_response: "",
    parsed_response: null,
    detected_id_docto: null,
    document_stage_status: "sent_to_sicas",
    encryption_used: encryptionMethod !== "FAILED_PLAIN_FALLBACK",
    encryption_method: encryptionMethod,
    iv_used: ivUsed,
    error_message: null,
  };

  // Build redacted SOAP request (hide password)
  baseDiagnostics.soap_request_redacted = soapEnvelope.replace(
    /<tem:Password>[^<]*<\/tem:Password>/,
    "<tem:Password>***REDACTED***</tem:Password>"
  ).substring(0, 3000);

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
    baseDiagnostics.soap_response = responseText.substring(0, 4000);
    console.log(`[SICAS Register] Response status: ${response.status}`);
    console.log(`[SICAS Register] Response body (first 1500):`, responseText.substring(0, 1500));

    if (!response.ok) {
      const fault = parseSoapFault(responseText);
      const faultMessage = fault.faultstring
        ? `SOAP Fault [${fault.faultcode}]: ${fault.faultstring}`
        : `SICAS HTTP ${response.status}: ${response.statusText}`;

      const stepError = buildStepError("save_hwcapture", faultMessage, {
        endpoint: sicasEndpoint,
        contentType: "text/xml; charset=utf-8",
        statusCode: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 3000),
        payloadSanitized: sanitizedPayload,
      });

      baseDiagnostics.document_stage_status = "failed";
      baseDiagnostics.error_message = faultMessage;

      console.error(`[SICAS Register] SOAP Fault: code=${fault.faultcode}, string=${fault.faultstring}, detail=${fault.detail}`);
      return { success: false, error: faultMessage, stepError, diagnostics: baseDiagnostics };
    }

    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const isDuplicate = /duplicad|ya existe|already exists/i.test(decoded);
    if (isDuplicate) {
      const dupIdMatch = decoded.match(/IDDocto["\s:=]*>?(\d+)/i) || decoded.match(/<ID>(\d+)<\/ID>/i);
      baseDiagnostics.document_stage_status = "duplicate";
      baseDiagnostics.detected_id_docto = dupIdMatch?.[1] || null;
      baseDiagnostics.error_message = "Poliza ya existe en SICAS";
      return {
        success: false,
        isDuplicate: true,
        duplicateId: dupIdMatch?.[1] || undefined,
        duplicateMessage: "Poliza ya existe en SICAS",
        diagnostics: baseDiagnostics,
      };
    }

    // Use enhanced multi-format ID extraction
    const extractedId = extractFirstValidId(responseText, DOCUMENT_ID_FIELDS);

    // ProcesarWS responses have RESPONSENBR: 1 = success, 0 or negative = error
    const responseNbrMatch = decoded.match(/<RESPONSENBR>\s*(-?\d+)\s*<\/RESPONSENBR>/i);
    const responseNbr = responseNbrMatch ? parseInt(responseNbrMatch[1]) : null;
    const responseTxt = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] || "";

    const hasSuccess = responseNbr === 1 || /SUCESS|SUCCESS|OK|GUARDADO|CREADO|REGISTRADO/i.test(decoded);
    const hasError = (responseNbr !== null && responseNbr <= 0) || (/ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded));

    baseDiagnostics.parsed_response = { response_nbr: responseNbr, response_txt: responseTxt, has_success: hasSuccess, has_error: hasError };
    baseDiagnostics.detected_id_docto = extractedId || null;

    if (hasError && !extractedId) {
      const errorMsg = responseTxt ||
                       decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       decoded.match(/<faultstring>(.*?)<\/faultstring>/i)?.[1] ||
                       `Error SICAS (RESPONSENBR=${responseNbr}): ${responseText.substring(0, 200)}`;
      const stepError = buildStepError("save_hwcapture", errorMsg, {
        endpoint: sicasEndpoint,
        statusCode: response.status,
        responseBody: responseText.substring(0, 3000),
        payloadSanitized: sanitizedPayload,
      });
      baseDiagnostics.document_stage_status = "failed";
      baseDiagnostics.error_message = errorMsg;
      return { success: false, error: errorMsg, stepError, diagnostics: baseDiagnostics };
    }

    if (extractedId) {
      console.log(`[SICAS Register] Document ID extracted: ${extractedId}`);
      baseDiagnostics.document_stage_status = "success_with_id";
      return { success: true, documentId: extractedId, rawResponse: responseText.substring(0, 3000), diagnostics: baseDiagnostics };
    }

    if (hasSuccess) {
      console.warn(`[SICAS Register] SUCCESS but no IDDocto in response. RESPONSENBR=${responseNbr}, RESPONSETXT=${responseTxt}`);
      baseDiagnostics.document_stage_status = "success_without_id";
      return { success: true, noIdReturned: true, rawResponse: responseText.substring(0, 3000), diagnostics: baseDiagnostics };
    }

    baseDiagnostics.document_stage_status = "failed";
    baseDiagnostics.error_message = `Respuesta SICAS no reconocida: ${responseText.substring(0, 200)}`;
    return { success: false, error: baseDiagnostics.error_message, rawResponse: responseText.substring(0, 3000), diagnostics: baseDiagnostics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error.name === "AbortError" ? "Timeout: SICAS no respondio en 45s" : error.message;
    baseDiagnostics.document_stage_status = "failed";
    baseDiagnostics.error_message = msg;
    return { success: false, error: msg, diagnostics: baseDiagnostics };
  }
}

// ============================================================
// Main Handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let currentStep: RegistrationStep = "start";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Circuit breaker check
    const requestManager = createSicasRequestManager(supabase);
    const cbState = await requestManager.checkCircuitBreaker();
    if (cbState.is_open) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "start",
          error: "SICAS esta respondiendo con errores o lentitud. Proceso pausado temporalmente.",
          circuit_breaker: cbState,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const body = await req.json();
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
          action: "resolve",
          step: currentStep,
          resolved: resolution.resolved,
          missing: dedupedMissing,
          warnings: resolution.warnings,
          logs: resolution.logs,
          policy_number: delivery.manual_policy_number || delivery.policy_number,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REGISTER or AUTO action ===
    if (action === "register" || action === "auto") {
      const steps: Array<{ step: string; status: string; detail?: string }> = [];

      // Step: resolve_required_fields
      currentStep = "resolve_required_fields";
      steps.push({ step: currentStep, status: "in_progress" });
      await supabase.from("policy_deliveries").update({ sicas_registration_status: "resolving" }).eq("id", delivery_id);

      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);
      steps[steps.length - 1].status = "completed";
      steps[steps.length - 1].detail = `${Object.keys(resolution.resolved).length} campos resueltos, ${resolution.missing.length} pendientes`;

      // Step: search_client / create_client_if_needed
      currentStep = "search_client";
      const clientNeedsCreation = resolution.resolved.IDCli?.value === "__auto_create__";

      if (clientNeedsCreation) {
        if (skipAutoCreateClient) {
          resolution.resolved.IDCli = { value: "0", source: "skipped_debug_mode", label: "Auto-creacion omitida (debug)" };
          resolution.warnings.push("IDCli: Auto-creacion omitida por debug_options.skip_auto_create_client.");
          steps.push({ step: "create_client_if_needed", status: "skipped", detail: "skip_auto_create_client=true" });
        } else {
          currentStep = "create_client_if_needed";
          steps.push({ step: currentStep, status: "in_progress" });
          await supabase.from("policy_deliveries").update({ sicas_registration_status: "creating_client" }).eq("id", delivery_id);

          const createResult = await attemptClientAutoCreate(supabase, delivery, sicasEndpoint, sicasUsername, sicasPassword);

          if (createResult.success && createResult.clientId) {
            resolution.resolved.IDCli = { value: createResult.clientId, source: "auto_created", label: createResult.clientName };
            steps[steps.length - 1].status = "completed";
            steps[steps.length - 1].detail = `Cliente creado: ${createResult.clientName} (ID: ${createResult.clientId})`;

            await supabase.from("policy_deliveries").update({
              sicas_client_id: createResult.clientId,
              sicas_client_name: createResult.clientName,
              sicas_client_auto_created: true,
              sicas_client_created_at: new Date().toISOString(),
              sicas_client_match_method: "auto_created",
              sicas_client_match_confidence: "high",
            }).eq("id", delivery_id);
          } else if (createResult.success && !createResult.clientId) {
            resolution.resolved.IDCli = { value: "0", source: "created_no_id", label: createResult.clientName || "Cliente creado sin ID" };
            steps[steps.length - 1].status = "warning";
            steps[steps.length - 1].detail = `Cliente creado pero sin ID. Se usara 0.`;
            resolution.warnings.push("IDCli: SICAS confirmo creacion pero no devolvio ID. Se registra con 0.");
          } else {
            // Client creation failed - but DO NOT block HWCAPTURE.
            // Per requirement: always proceed to document registration with IDCli=0 as fallback.
            resolution.resolved.IDCli = { value: "0", source: "fallback_create_failed", label: resolution.resolved.IDCli?.label || "Cliente no creado" };
            resolution.warnings.push(`IDCli: Auto-creacion fallo (${createResult.error}). Se registra con cliente generico (0).`);
            steps[steps.length - 1].status = "warning";
            steps[steps.length - 1].detail = `Fallo: ${createResult.error}. Continuando con IDCli=0.`;

            await supabase.from("policy_deliveries").update({
              sicas_client_match_method: "fallback_zero",
              sicas_contact_status: "creation_failed",
              sicas_error_message: createResult.error || null,
            }).eq("id", delivery_id);
          }
        }
      } else if (resolution.resolved.IDCli) {
        steps.push({ step: "client_found", status: "completed", detail: `${resolution.resolved.IDCli.label || resolution.resolved.IDCli.value} (${resolution.resolved.IDCli.source})` });
      }

      // Ensure IDCli never blocks
      if (resolution.resolved.IDCli?.value === "__auto_create__") {
        resolution.resolved.IDCli = { value: "0", source: "fallback_sentinel_cleanup" };
      }
      resolution.missing = resolution.missing.filter(m => !m.includes("IDCli"));

      const dedupedMissing = uniqueMissingFields(resolution.missing);
      if (dedupedMissing.length > 0) {
        await supabase.from("policy_deliveries").update({
          sicas_resolved_fields: resolution.resolved,
          sicas_resolution_warnings: resolution.warnings,
          sicas_registration_status: "manual_review_required",
          sicas_error_message: `Campos faltantes: ${dedupedMissing.join(", ")}`,
          sicas_error_step: "resolve_required_fields",
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "manual_review_required",
            step: "resolve_required_fields",
            message: `Campos faltantes: ${dedupedMissing.join(", ")}`,
            steps,
            missing: dedupedMissing,
            warnings: resolution.warnings,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step: validate_payload
      currentStep = "validate_payload";
      steps.push({ step: "validate_payload", status: "in_progress" });

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
            step: "completed",
            message: "Poliza registrada en SICAS correctamente.",
            contact_status: contactStatus,
            document_status: "created",
            document_id: hwResult.documentId,
            sicas_contact_id: resolution.resolved.IDCli?.value || null,
            sicas_client_id: resolution.resolved.IDCli?.value || null,
            sicas_document_id: hwResult.documentId,
            steps,
            resolved: resolution.resolved,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hwResult.success && hwResult.noIdReturned) {
        // SICAS said "success" but no document ID. Attempt post-save lookup.
        steps[steps.length - 1].status = "warning";
        steps[steps.length - 1].detail = "SICAS confirmo exito sin IDDocto, buscando...";

        const policyNumber = validation.sanitizedPayload.Documento || delivery.manual_policy_number || delivery.policy_number || "";
        const clientIdForLookup = resolution.resolved.IDCli?.value || delivery.sicas_client_id || null;
        const vendorIdForLookup = validation.sanitizedPayload.IDVend || delivery.vendor_sicas_id || null;

        const lookupResult = await findSicasDocumentAfterSave(
          policyNumber,
          clientIdForLookup,
          vendorIdForLookup,
          sicasEndpoint,
          sicasUsername,
          sicasPassword,
          {
            insuredName: delivery.insured_name || null,
            premium: delivery.total_premium || validation.sanitizedPayload.PrimaNeta || null,
            startDate: delivery.start_date || null,
            registrationDate: new Date().toISOString(),
          },
        );

        if (lookupResult.found && lookupResult.documentId) {
          // Post-save lookup found the document
          currentStep = "completed";
          steps.push({ step: "post_save_lookup", status: "completed", detail: `Documento encontrado: ${lookupResult.documentId} (${lookupResult.method})` });

          await supabase.from("policy_deliveries").update({
            sicas_registration_status: "registered",
            sicas_document_id: lookupResult.documentId,
            sicas_registered_at: new Date().toISOString(),
            sicas_error_message: null,
            sicas_error_step: null,
            sicas_contact_status: contactStatus,
            sicas_document_status: "created",
            sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
            sicas_document_resolution_method: "post_save_lookup",
            sicas_document_lookup_attempts: 1,
            sicas_last_lookup_at: new Date().toISOString(),
            sicas_document_lookup_response: lookupResult.rawResponse ? { raw: lookupResult.rawResponse, method: lookupResult.method } : null,
            sicas_registration_stage: "completed",
            sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics ? { ...hwResult.diagnostics, document_stage_status: "success_with_id", detected_id_docto: lookupResult.documentId } : null },
          }).eq("id", delivery_id);

          return new Response(
            JSON.stringify({
              success: true,
              action,
              overall_status: "success",
              status: "registered",
              step: "completed",
              message: "Poliza registrada en SICAS correctamente.",
              contact_status: contactStatus,
              document_status: "created",
              document_id: lookupResult.documentId,
              resolution_method: "post_save_lookup",
              sicas_document_id: lookupResult.documentId,
              steps,
              resolved: resolution.resolved,
              diagnostic: "SICAS no devolvio IDDocto en la respuesta, pero el documento fue encontrado por busqueda posterior.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Lookup failed - all strategies returned 0, document was NOT created
        steps.push({ step: "post_save_lookup", status: "failed", detail: lookupResult.error || "0 resultados en todas las estrategias" });

        const docNotCreatedStatus = "document_not_created";
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: docNotCreatedStatus,
          sicas_document_id: null,
          sicas_error_message: "El contacto/cliente existe pero la poliza no aparece en SICAS. El documento no fue creado.",
          sicas_error_step: "save_hwcapture",
          sicas_contact_status: contactStatus,
          sicas_document_status: docNotCreatedStatus,
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_document_resolution_method: "not_found_after_success",
          sicas_document_lookup_attempts: 1,
          sicas_last_lookup_at: new Date().toISOString(),
          sicas_document_lookup_response: lookupResult.rawResponse
            ? { raw: lookupResult.rawResponse, method: lookupResult.method, diagnostics: lookupResult.diagnostics, search_context: { policy_number: policyNumber, client_id: clientIdForLookup, vendor_id: vendorIdForLookup } }
            : { diagnostics: lookupResult.diagnostics, search_context: { policy_number: policyNumber, client_id: clientIdForLookup, vendor_id: vendorIdForLookup } },
          sicas_registration_stage: "save_hwcapture",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics ? { ...hwResult.diagnostics, document_stage_status: "not_created" } : null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            overall_status: "partial_success",
            status: docNotCreatedStatus,
            step: "save_hwcapture",
            message: "El contacto/cliente fue creado, pero la poliza no aparece en SICAS. El documento no fue creado.",
            contact_status: contactStatus,
            document_status: docNotCreatedStatus,
            sicas_contact_id: resolution.resolved.IDCli?.value || null,
            sicas_document_id: null,
            next_action: "retry_document_registration",
            resolution_method: "not_found_after_success",
            steps,
            resolved: resolution.resolved,
            sanitized_payload: validation.sanitizedPayload,
            document_registration_diagnostic: hwResult.diagnostics || null,
            lookup_diagnostics: lookupResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hwResult.isDuplicate) {
        steps[steps.length - 1].status = "duplicate";
        steps[steps.length - 1].detail = "Poliza ya existe en SICAS";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "duplicate",
          sicas_duplicate_detected: true,
          sicas_duplicate_document_id: hwResult.duplicateId || null,
          sicas_duplicate_message: hwResult.duplicateMessage,
          sicas_error_step: "save_hwcapture",
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "duplicate_found",
            step: "save_hwcapture",
            message: "La poliza ya existe en SICAS.",
            duplicate_id: hwResult.duplicateId,
            steps,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].detail = hwResult.error || "Error desconocido";

        // Document registration failed but contact may have been created
        const hasContact = contactStatus === "created" || contactStatus === "existing";
        const overallStatus = hasContact ? "partial_success" : "error";

        const errorData: Record<string, any> = {
          sicas_registration_status: overallStatus === "partial_success" ? "partial_success" : "error",
          sicas_error_message: hwResult.error,
          sicas_error_step: "save_hwcapture",
          sicas_contact_status: contactStatus,
          sicas_document_status: "failed",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "save_hwcapture",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null, step_error: hwResult.stepError || null },
        };

        await supabase.from("policy_deliveries").update(errorData).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            overall_status: overallStatus,
            status: overallStatus === "partial_success" ? "partial_success" : "sicas_error",
            step: "save_hwcapture",
            message: hasContact
              ? `Contacto creado en SICAS, pero la poliza no fue registrada. ${hwResult.error || ""}`
              : (hwResult.error || "Error al registrar en SICAS"),
            contact_status: contactStatus,
            document_status: "failed",
            sicas_contact_id: resolution.resolved.IDCli?.value || null,
            sicas_document_id: null,
            next_action: hasContact ? "retry_document" : "retry",
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
        currentStep = "completed";
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = `Documento SICAS: ${hwResult.documentId}`;

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: "created",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_registration_stage: "completed",
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_document",
            overall_status: "success",
            status: "registered",
            step: "completed",
            message: "Poliza registrada en SICAS correctamente.",
            contact_status: delivery.sicas_contact_status || "existing",
            document_status: "created",
            document_id: hwResult.documentId,
            steps,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hwResult.success && hwResult.noIdReturned) {
        steps[steps.length - 1].status = "warning";
        steps[steps.length - 1].detail = "SICAS confirmo exito sin IDDocto, buscando...";

        // Attempt post-save lookup
        const policyNumber = existingPayload.Documento || delivery.manual_policy_number || delivery.policy_number || "";
        const clientIdForLookup = existingPayload.IDCli || delivery.sicas_client_id || null;
        const vendorIdForLookup = existingPayload.IDVend || delivery.vendor_sicas_id || null;
        const prevAttempts = (delivery as any).sicas_document_lookup_attempts || 0;

        const lookupResult = await findSicasDocumentAfterSave(
          policyNumber, clientIdForLookup, vendorIdForLookup,
          sicasEndpoint, sicasUsername, sicasPassword,
          {
            insuredName: delivery.insured_name || null,
            premium: delivery.total_premium || existingPayload.PrimaNeta || null,
            startDate: delivery.start_date || null,
            registrationDate: new Date().toISOString(),
          },
        );

        if (lookupResult.found && lookupResult.documentId) {
          steps.push({ step: "post_save_lookup", status: "completed", detail: `Encontrado: ${lookupResult.documentId}` });

          await supabase.from("policy_deliveries").update({
            sicas_registration_status: "registered",
            sicas_document_id: lookupResult.documentId,
            sicas_registered_at: new Date().toISOString(),
            sicas_error_message: null,
            sicas_error_step: null,
            sicas_document_status: "created",
            sicas_document_resolution_method: "post_save_lookup",
            sicas_document_lookup_attempts: prevAttempts + 1,
            sicas_last_lookup_at: new Date().toISOString(),
            sicas_document_lookup_response: lookupResult.rawResponse ? { raw: lookupResult.rawResponse, method: lookupResult.method } : null,
            sicas_registration_stage: "completed",
          }).eq("id", delivery_id);

          return new Response(
            JSON.stringify({
              success: true,
              action: "retry_document",
              overall_status: "success",
              status: "registered",
              step: "completed",
              message: "Poliza registrada en SICAS correctamente.",
              document_status: "created",
              document_id: lookupResult.documentId,
              resolution_method: "post_save_lookup",
              steps,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        steps.push({ step: "post_save_lookup", status: "failed", detail: lookupResult.error || "No encontrado" });

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "unverified",
          sicas_error_message: "SICAS confirmo exito pero no se pudo verificar el documento.",
          sicas_error_step: "save_hwcapture",
          sicas_document_status: "unverified",
          sicas_document_resolution_method: "not_found_after_success",
          sicas_document_lookup_attempts: prevAttempts + 1,
          sicas_last_lookup_at: new Date().toISOString(),
          sicas_document_lookup_response: lookupResult.rawResponse ? { raw: lookupResult.rawResponse, method: lookupResult.method } : null,
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "retry_document",
            overall_status: "unverified",
            status: "unverified",
            step: "save_hwcapture",
            message: "SICAS confirmo exito, pero MOVI no pudo verificar el documento.",
            document_status: "unverified",
            next_action: "retry_lookup",
            steps,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].detail = hwResult.error || "Error desconocido";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "partial_success",
          sicas_error_message: hwResult.error,
          sicas_error_step: "save_hwcapture",
          sicas_document_status: "failed",
          sicas_document_response: hwResult.rawResponse ? { raw: hwResult.rawResponse } : null,
          sicas_request_debug: { document_registration_diagnostic: hwResult.diagnostics || null, step_error: hwResult.stepError || null },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "retry_document",
            overall_status: "partial_success",
            status: "partial_success",
            step: "save_hwcapture",
            message: hwResult.error || "Error al registrar documento en SICAS",
            document_status: "failed",
            next_action: "retry_document",
            steps,
            step_error: hwResult.stepError || null,
            document_registration_diagnostic: hwResult.diagnostics || null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // === RETRY_LOOKUP action: search for document without re-registering ===
    if (action === "retry_lookup") {
      const existingPayload = delivery.sicas_request_payload as Record<string, string> | null;
      const policyNumber = existingPayload?.Documento || delivery.manual_policy_number || delivery.policy_number || "";
      const clientIdForLookup = existingPayload?.IDCli || delivery.sicas_client_id || null;
      const vendorIdForLookup = existingPayload?.IDVend || delivery.vendor_sicas_id || null;
      const prevAttempts = (delivery as any).sicas_document_lookup_attempts || 0;

      if (!policyNumber) {
        return new Response(
          JSON.stringify({ success: false, action: "retry_lookup", status: "error", message: "No hay numero de poliza para buscar." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const extraContext = {
        insuredName: delivery.insured_name || existingPayload?.Asegurado || null,
        premium: delivery.total_premium || existingPayload?.PrimaNeta || null,
        startDate: delivery.start_date || null,
        registrationDate: (delivery as any).sicas_registered_at || (delivery as any).updated_at || null,
      };

      // Strategy 4 (local): search in sicas_documents table first
      let localMatch: { id_docto: string; score: number } | null = null;
      if (policyNumber) {
        const normalizedPn = normalizePolicyNumber(policyNumber);
        const { data: localDocs } = await supabase
          .from("sicas_documents")
          .select("id_sicas, raw")
          .or(`numero_poliza.ilike.%${policyNumber}%,documento.ilike.%${policyNumber}%`)
          .limit(10);

        if (localDocs && localDocs.length > 0) {
          for (const ld of localDocs) {
            const ldDoc = ld.raw || {};
            ldDoc.IDDocto = ldDoc.IDDocto || ld.id_sicas;
            const ldScore = scoreSicasDocumentMatch(
              { policyNumber, clientId: clientIdForLookup, vendorId: vendorIdForLookup, insuredName: extraContext.insuredName, premium: extraContext.premium, startDate: extraContext.startDate, registrationDate: extraContext.registrationDate },
              ldDoc
            );
            if (ldScore >= 80 && ld.id_sicas) {
              localMatch = { id_docto: ld.id_sicas, score: ldScore };
              break;
            }
          }
        }
      }

      if (localMatch) {
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: localMatch.id_docto,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: "created",
          sicas_document_resolution_method: "local_table_match",
          sicas_document_lookup_attempts: prevAttempts + 1,
          sicas_last_lookup_at: new Date().toISOString(),
          sicas_document_lookup_response: { method: "local_table_match", score: localMatch.score },
          sicas_registration_stage: "completed",
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_lookup",
            status: "registered",
            message: `Poliza encontrada en tabla local sincronizada (score: ${localMatch.score}).`,
            document_id: localMatch.id_docto,
            resolution_method: "local_table_match",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Search via SICAS SOAP
      const lookupResult = await findSicasDocumentAfterSave(
        policyNumber, clientIdForLookup, vendorIdForLookup,
        sicasEndpoint, sicasUsername, sicasPassword, extraContext,
      );

      if (lookupResult.found && lookupResult.documentId) {
        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: lookupResult.documentId,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
          sicas_document_status: "created",
          sicas_document_resolution_method: lookupResult.method || "post_save_lookup",
          sicas_document_lookup_attempts: prevAttempts + 1,
          sicas_last_lookup_at: new Date().toISOString(),
          sicas_document_lookup_response: {
            method: lookupResult.method,
            score: lookupResult.score,
            diagnostics: lookupResult.diagnostics,
          },
          sicas_registration_stage: "completed",
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "retry_lookup",
            status: "registered",
            message: `Poliza encontrada en SICAS (${lookupResult.method}, score: ${lookupResult.score}).`,
            document_id: lookupResult.documentId,
            resolution_method: lookupResult.method,
            score: lookupResult.score,
            diagnostics: lookupResult.diagnostics,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not found - save diagnostics
      const lookupResponse = {
        method: lookupResult.method,
        diagnostics: lookupResult.diagnostics,
        multiple_matches: lookupResult.multipleMatches || null,
        search_context: {
          policy_number: policyNumber,
          client_id: clientIdForLookup,
          vendor_id: vendorIdForLookup,
          insured_name: extraContext.insuredName,
          premium: extraContext.premium,
          start_date: extraContext.startDate,
          registration_date: extraContext.registrationDate,
        },
      };

      await supabase.from("policy_deliveries").update({
        sicas_document_lookup_attempts: prevAttempts + 1,
        sicas_last_lookup_at: new Date().toISOString(),
        sicas_document_lookup_response: lookupResponse,
      }).eq("id", delivery_id);

      const hasMultiple = lookupResult.multipleMatches && lookupResult.multipleMatches.length > 0;

      return new Response(
        JSON.stringify({
          success: false,
          action: "retry_lookup",
          status: hasMultiple ? "multiple_matches" : "unverified",
          message: hasMultiple
            ? `Se encontraron ${lookupResult.multipleMatches!.length} posible(s) coincidencia(s) pero ninguna con score >= 80.`
            : (lookupResult.error || "Documento no encontrado en SICAS."),
          next_action: "retry_lookup",
          lookup_attempts: prevAttempts + 1,
          diagnostics: lookupResult.diagnostics,
          matches: lookupResult.multipleMatches || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL_CAPTURE action: validate and save a manually entered IDDocto ===
    if (action === "manual_capture") {
      const manualId = body.sicas_document_id || body.document_id || body.id_docto;

      if (!manualId || !/^\d+$/.test(String(manualId))) {
        return new Response(
          JSON.stringify({ success: false, action: "manual_capture", status: "error", message: "IDDocto debe ser un numero valido." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const docId = String(manualId);
      if (parseInt(docId) <= 0) {
        return new Response(
          JSON.stringify({ success: false, action: "manual_capture", status: "error", message: "IDDocto debe ser mayor a 0." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate document exists in SICAS
      const verification = await verifyDocumentById(docId, sicasEndpoint, sicasUsername, sicasPassword);

      if (!verification.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            action: "manual_capture",
            status: "error",
            message: verification.error || `Documento con ID ${docId} no encontrado en SICAS.`,
            raw_response: verification.rawResponse,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Score the match against delivery data
      const existingPayload = delivery.sicas_request_payload as Record<string, string> | null;
      const policyNumber = existingPayload?.Documento || delivery.manual_policy_number || delivery.policy_number || "";
      let matchWarning: string | null = null;
      let matchScore = 0;

      if (verification.documentData) {
        const ctx: LookupContext = {
          policyNumber,
          clientId: existingPayload?.IDCli || delivery.sicas_client_id || null,
          vendorId: existingPayload?.IDVend || delivery.vendor_sicas_id || null,
          insuredName: delivery.insured_name || null,
          premium: delivery.total_premium || existingPayload?.PrimaNeta || null,
          startDate: delivery.start_date || null,
          registrationDate: (delivery as any).sicas_registered_at || null,
        };
        matchScore = scoreSicasDocumentMatch(ctx, verification.documentData);

        if (matchScore < 60) {
          const docNum = verification.documentData.Documento || verification.documentData.NumPoliza || "";
          matchWarning = `Advertencia: Coincidencia baja (score: ${matchScore}). SICAS poliza="${docNum}", entrega poliza="${policyNumber}". Verifica que sea el documento correcto.`;
        } else if (matchScore < 80) {
          matchWarning = `Coincidencia parcial (score: ${matchScore}). Documento guardado pero revisar datos.`;
        }
      }

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "registered",
        sicas_document_id: docId,
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: null,
        sicas_error_step: null,
        sicas_document_status: "created",
        sicas_document_resolution_method: "manual_verified",
        sicas_document_lookup_response: {
          raw: verification.rawResponse,
          method: "manual_verify",
          score: matchScore,
          document_data: verification.documentData || null,
        },
        sicas_registration_stage: "completed",
      }).eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "manual_capture",
          overall_status: "success",
          status: "registered",
          message: matchWarning
            ? `Documento ${docId} verificado y guardado. ${matchWarning}`
            : `Documento ${docId} verificado en SICAS y guardado correctamente (score: ${matchScore}).`,
          document_id: docId,
          resolution_method: "manual_verified",
          score: matchScore,
          document_data: verification.documentData || null,
          warning: matchWarning,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}. Use "resolve", "register", "auto", "retry_document", "retry_lookup", or "manual_capture".`);
  } catch (error: any) {
    console.error(`[SICAS] Fatal error at step "${currentStep}":`, error.message);
    return new Response(
      JSON.stringify({
        success: false,
        status: "sicas_error",
        step: currentStep,
        message: error.message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
