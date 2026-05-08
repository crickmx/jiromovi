import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const contactData: string[] = [];
  contactData.push(`CliNombre|${cleanedName}`);
  if (clientRfc) {
    const rfcClean = sanitizeField(clientRfc);
    if (rfcClean && rfcClean.length >= 10 && rfcClean.length <= 13) {
      contactData.push(`CliRFC|${rfcClean.toUpperCase()}`);
    }
  }

  const email = sanitizeField(delivery.extracted_data?.email || delivery.extracted_data?.correo);
  const phone = sanitizeField(delivery.extracted_data?.telefono || delivery.extracted_data?.phone);
  if (email) contactData.push(`CliEmail|${email}`);
  if (phone) contactData.push(`CliTelefono|${phone}`);

  const isEmpresa = /^(S\.?A\.?|S\.?C\.?|S\.? DE R\.?L\.?|SOCIEDAD|EMPRESA|CORPORAT|CIA|COMPAÑIA)/i.test(cleanedName);
  contactData.push(`CliTipoPersona|${isEmpresa ? "M" : "F"}`);

  // XML-escape the entire PropertyData content to prevent malformed SOAP XML
  const dataString = escapeXml(contactData.join("\n"));

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:Procesar_String>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(sicasUsername)}</tem:UserName>
        <tem:Password>${escapeXml(sicasPassword)}</tem:Password>
      </tem:oConfigAuth>
      <tem:oConfigData>
        <tem:PropertyNameTransaction>WS_SaveData_Contacto</tem:PropertyNameTransaction>
        <tem:PropertyTypeData>Data_XML</tem:PropertyTypeData>
        <tem:PropertyData>${dataString}</tem:PropertyData>
      </tem:oConfigData>
    </tem:Procesar_String>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log(`[SICAS Client] POST ${sicasEndpoint} (Contacto)`);
    console.log(`[SICAS Client] Full SOAP Request:`, soapEnvelope);
    console.log(`[SICAS Client] Payload fields: ${contactData.join(", ")}`);

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
        payloadSanitized: Object.fromEntries(contactData.map(f => { const [k, v] = f.split("|"); return [k, v]; })),
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

  const premium = sanitizeField(delivery.total_premium || delivery.extracted_data?.primaTotal);
  if (premium && premium !== "0") sanitizedPayload.PrimaTotal = premium;

  if (delivery.sicas_office_id) sanitizedPayload.IDOficina = delivery.sicas_office_id;
  if (delivery.vehicle_description) sanitizedPayload.Descripcion = delivery.vehicle_description;
  if (delivery.plates) sanitizedPayload.Placas = delivery.plates;
  if (delivery.vin) sanitizedPayload.NumSerie = delivery.vin;
  if (delivery.engine) sanitizedPayload.Motor = delivery.engine;

  return { valid: errors.length === 0, errors, sanitizedPayload };
}

// ============================================================
// SICAS Document Registration via SOAP WS_SaveData
// ============================================================

async function registerDocument(
  sanitizedPayload: Record<string, string>,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<{ success: boolean; documentId?: string; error?: string; stepError?: StepError; isDuplicate?: boolean; duplicateId?: string; duplicateMessage?: string }> {
  const docFields: string[] = [];
  for (const [key, value] of Object.entries(sanitizedPayload)) {
    docFields.push(`${key}|${value}`);
  }

  // XML-escape the entire PropertyData content to prevent malformed SOAP XML
  const dataString = escapeXml(docFields.join("\n"));

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:Procesar_String>
      <tem:oConfigAuth>
        <tem:UserName>${escapeXml(sicasUsername)}</tem:UserName>
        <tem:Password>${escapeXml(sicasPassword)}</tem:Password>
      </tem:oConfigAuth>
      <tem:oConfigData>
        <tem:PropertyNameTransaction>WS_SaveData_Documento</tem:PropertyNameTransaction>
        <tem:PropertyTypeData>Data_XML</tem:PropertyTypeData>
        <tem:PropertyData>${dataString}</tem:PropertyData>
      </tem:oConfigData>
    </tem:Procesar_String>
  </soap:Body>
</soap:Envelope>`;

  console.log(`[SICAS Register] POST ${sicasEndpoint} (Documento)`);
  console.log(`[SICAS Register] Full SOAP Request:`, soapEnvelope);
  console.log(`[SICAS Register] Payload: ${docFields.join(", ")}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
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
    console.log(`[SICAS Register] Response status: ${response.status}`);
    console.log(`[SICAS Register] Response body (first 800):`, responseText.substring(0, 800));

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

      console.error(`[SICAS Register] SOAP Fault: code=${fault.faultcode}, string=${fault.faultstring}, detail=${fault.detail}`);
      return { success: false, error: faultMessage, stepError };
    }

    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    const isDuplicate = /duplicad|ya existe|already exists/i.test(decoded);
    if (isDuplicate) {
      const dupIdMatch = decoded.match(/IDDocto["\s:=]*>?(\d+)/i) || decoded.match(/<ID>(\d+)<\/ID>/i);
      return {
        success: false,
        isDuplicate: true,
        duplicateId: dupIdMatch?.[1] || undefined,
        duplicateMessage: "Poliza ya existe en SICAS",
      };
    }

    const docIdMatch = decoded.match(/<IDDocto>(\d+)<\/IDDocto>/i) ||
                       decoded.match(/<RESPONSENBR>\s*(\d+)\s*<\/RESPONSENBR>/i) ||
                       decoded.match(/<ID>(\d+)<\/ID>/i) ||
                       decoded.match(/IDDocto["\s:=]*>?(\d+)/i);

    const hasSuccess = /SUCESS|SUCCESS|OK|GUARDADO|CREADO|REGISTRADO/i.test(decoded);
    const hasError = /ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded);

    if (hasError) {
      const errorMsg = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] ||
                       decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       decoded.match(/<faultstring>(.*?)<\/faultstring>/i)?.[1] ||
                       `Error SICAS: ${responseText.substring(0, 200)}`;
      const stepError = buildStepError("save_hwcapture", errorMsg, {
        endpoint: sicasEndpoint,
        statusCode: response.status,
        responseBody: responseText.substring(0, 3000),
        payloadSanitized: sanitizedPayload,
      });
      return { success: false, error: errorMsg, stepError };
    }

    if (docIdMatch?.[1] && parseInt(docIdMatch[1]) > 0) {
      return { success: true, documentId: docIdMatch[1] };
    }

    if (hasSuccess) {
      return { success: true };
    }

    const responseNbr = decoded.match(/<RESPONSENBR>\s*(-?\d+)\s*<\/RESPONSENBR>/i);
    if (responseNbr && parseInt(responseNbr[1]) > 0) {
      return { success: true, documentId: responseNbr[1] };
    }
    if (responseNbr && parseInt(responseNbr[1]) === 0) {
      const txt = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] || "SICAS retorno 0";
      return { success: false, error: txt };
    }

    return { success: false, error: `Respuesta SICAS no reconocida: ${responseText.substring(0, 200)}` };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const msg = error.name === "AbortError" ? "Timeout: SICAS no respondio en 45s" : error.message;
    return { success: false, error: msg };
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
            if (createResult.stepError) {
              await supabase.from("policy_deliveries").update({
                sicas_error_step: "create_client_if_needed",
                sicas_error_message: createResult.error,
                sicas_request_debug: createResult.stepError,
                sicas_registration_status: "client_creation_failed",
              }).eq("id", delivery_id);

              steps[steps.length - 1].status = "failed";
              steps[steps.length - 1].detail = createResult.error;

              return new Response(
                JSON.stringify({
                  success: false,
                  action,
                  status: "client_creation_failed",
                  step: "create_client_if_needed",
                  message: `No se pudo crear Cliente SICAS. ${createResult.error}`,
                  steps,
                  step_error: createResult.stepError,
                  resolved: resolution.resolved,
                  logs: resolution.logs,
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            resolution.resolved.IDCli = { value: "0", source: "fallback_create_failed", label: resolution.resolved.IDCli?.label || "Cliente no creado" };
            resolution.warnings.push(`IDCli: Auto-creacion fallo (${createResult.error}). Se registra con cliente generico (0).`);
            steps[steps.length - 1].status = "warning";
            steps[steps.length - 1].detail = `Fallo: ${createResult.error}. Usando fallback 0.`;

            await supabase.from("policy_deliveries").update({
              sicas_client_match_method: "fallback_zero",
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
          sicas_request_debug: { validation_errors: validation.errors, sanitized_payload: validation.sanitizedPayload },
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
      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "registering",
        sicas_registration_attempts: attempts,
        sicas_last_attempt_at: new Date().toISOString(),
        sicas_resolved_fields: resolution.resolved,
        sicas_request_payload: validation.sanitizedPayload,
        sicas_error_step: null,
        sicas_error_message: null,
      }).eq("id", delivery_id);

      const hwResult = await registerDocument(
        validation.sanitizedPayload,
        sicasEndpoint,
        sicasUsername,
        sicasPassword
      );

      if (hwResult.success) {
        currentStep = "completed";
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = hwResult.documentId ? `Documento SICAS: ${hwResult.documentId}` : "Registro exitoso";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId || null,
          sicas_registered_at: new Date().toISOString(),
          sicas_error_message: null,
          sicas_error_step: null,
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action,
            status: "registered",
            step: "completed",
            message: "Poliza registrada en SICAS correctamente.",
            document_id: hwResult.documentId,
            steps,
            resolved: resolution.resolved,
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

        const errorData: Record<string, any> = {
          sicas_registration_status: "error",
          sicas_error_message: hwResult.error,
          sicas_error_step: "save_hwcapture",
        };

        if (hwResult.stepError) {
          errorData.sicas_request_debug = hwResult.stepError;
        }

        await supabase.from("policy_deliveries").update(errorData).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action,
            status: "sicas_error",
            step: "save_hwcapture",
            message: hwResult.error || "Error al registrar en SICAS",
            steps,
            step_error: hwResult.stepError || null,
            resolved: resolution.resolved,
            sanitized_payload: validation.sanitizedPayload,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    throw new Error(`Unknown action: ${action}. Use "resolve", "register", or "auto".`);
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
