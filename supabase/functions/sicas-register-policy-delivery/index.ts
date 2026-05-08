import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

// ============================================================
// Text Normalization
// ============================================================

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

// ============================================================
// Catalog Matching
// ============================================================

function findCatalogMatch(records: CatalogRecord[], searchTerms: string[]): CatalogRecord | null {
  const normalizedTerms = searchTerms.map(t => normalizeText(t)).filter(t => t.length > 0);

  // Exact match on nombre first
  for (const term of normalizedTerms) {
    const exact = records.find(r => normalizeText(r.nombre) === term);
    if (exact) return exact;
  }

  // Exact match on id_sicas
  for (const term of searchTerms) {
    const idMatch = records.find(r => r.id_sicas === term);
    if (idMatch) return idMatch;
  }

  // Contains match
  for (const term of normalizedTerms) {
    if (term.length < 2) continue;
    const contains = records.find(r => normalizeText(r.nombre).includes(term));
    if (contains) return contains;
  }

  // Bidirectional contains
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

  // Exact match
  const exact = ejecutivos.find(r => normalizeText(r.nombre) === normalizedVendor);
  if (exact) return exact;

  // Try matching with name parts reordered
  const vendorParts = normalizedVendor.split(" ").filter(p => p.length > 1);
  if (vendorParts.length >= 3) {
    for (const ej of ejecutivos) {
      const ejNorm = normalizeText(ej.nombre);
      const ejParts = ejNorm.split(" ").filter(p => p.length > 1);
      if (ejParts.length >= 3) {
        const vendorSet = new Set(vendorParts);
        const ejSet = new Set(ejParts);
        const intersection = [...vendorSet].filter(p => ejSet.has(p));
        // If at least 80% of parts match, consider it a strong match
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

  // === 5. IDMon (Moneda) ===
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

  // === 6. IDFPago (Forma de Pago) ===
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
        warnings.push(`IDFPago: Se extrajo "${extractedFPago}" pero no se encontro en catalogo SICAS.`);
      }
    } else if (getDefault("IDFPago")) {
      resolved.IDFPago = { value: getDefault("IDFPago")!, source: "default" };
    } else {
      const contadoMatch = findCatalogMatch(fpagos, ["CONTADO", "PAGO DE CONTADO", "ANUAL", "UNA EXHIBICION", "1 PAGO", "UN PAGO", "UN SOLO PAGO"]);
      if (contadoMatch) {
        resolved.IDFPago = { value: contadoMatch.id_sicas, source: "catalog_match_contado", label: contadoMatch.nombre };
        warnings.push(`IDFPago: No se detecto forma de pago en documento. Se asigno "${contadoMatch.nombre}" por defecto.`);
      } else {
        missing.push("Forma de Pago (IDFPago)");
      }
    }
  }

  // === 7. IDGrupo - ALWAYS assign GENERAL ===
  logs.grupo = { searched_group_name: "GENERAL" };

  if (delivery.sicas_override_grupo) {
    resolved.IDGrupo = { value: delivery.sicas_override_grupo, source: "override" };
    logs.grupo.source = "override";
  } else {
    const grupos = catalogCache[62] || [];
    // Search for GENERAL in catalog
    const generalMatch = grupos.find(g => normalizeText(g.nombre) === "GENERAL");
    if (generalMatch) {
      resolved.IDGrupo = { value: generalMatch.id_sicas, source: "catalog_match_general", label: generalMatch.nombre };
      logs.grupo.group_match_found = true;
      logs.grupo.IDGrupo = generalMatch.id_sicas;
      logs.grupo.matched_nombre = generalMatch.nombre;
    } else if (getDefault("IDGrupo")) {
      resolved.IDGrupo = { value: getDefault("IDGrupo")!, source: "default" };
      logs.grupo.group_match_found = false;
      logs.grupo.source = "default";
    } else {
      missing.push("Grupo (IDGrupo)");
      logs.grupo.group_match_found = false;
      warnings.push("No se encontro el grupo GENERAL en el catalogo SICAS. Sincroniza catalogos o configuralo como default.");
    }
  }

  // === 8. IDEjecutivo - Match by vendor name ===
  logs.ejecutivo = { vendor_name: delivery.vendor_sicas_name || "" };

  if (delivery.sicas_override_ejecutivo) {
    resolved.IDEjecutivo = { value: delivery.sicas_override_ejecutivo, source: "override" };
    logs.ejecutivo.source = "override";
  } else {
    const ejecutivos = catalogCache[16] || [];
    const vendorName = delivery.vendor_sicas_name || "";
    logs.ejecutivo.normalized_vendor_name = normalizeText(vendorName);

    // Priority 1: Match executive by vendor name
    const nameMatch = findExecutiveByVendorName(ejecutivos, vendorName);
    if (nameMatch) {
      resolved.IDEjecutivo = { value: nameMatch.id_sicas, source: "matched_to_vendor_name", label: nameMatch.nombre };
      logs.ejecutivo.executive_match_found = true;
      logs.ejecutivo.IDEjecutivo = nameMatch.id_sicas;
      logs.ejecutivo.matched_nombre = nameMatch.nombre;
    }
    // Priority 2: Vendor raw data IDEjecutivo (if non-zero)
    else if (vendorData?.raw?.IDEjecutivo && String(vendorData.raw.IDEjecutivo) !== "0") {
      const ejId = String(vendorData.raw.IDEjecutivo);
      const ejRecord = ejecutivos.find(e => e.id_sicas === ejId);
      resolved.IDEjecutivo = { value: ejId, source: "vendor", label: ejRecord?.nombre };
      logs.ejecutivo.executive_match_found = true;
      logs.ejecutivo.source = "vendor_raw_data";
      logs.ejecutivo.IDEjecutivo = ejId;
    }
    // Priority 3: Vendor raw IDEjecut field
    else if (vendorData?.raw?.IDEjecut && String(vendorData.raw.IDEjecut) !== "0") {
      const ejId = String(vendorData.raw.IDEjecut);
      const ejRecord = ejecutivos.find(e => e.id_sicas === ejId);
      resolved.IDEjecutivo = { value: ejId, source: "vendor", label: ejRecord?.nombre };
      logs.ejecutivo.executive_match_found = true;
      logs.ejecutivo.source = "vendor_raw_idejecut";
      logs.ejecutivo.IDEjecutivo = ejId;
    }
    // Priority 4: Default
    else if (getDefault("IDEjecutivo")) {
      resolved.IDEjecutivo = { value: getDefault("IDEjecutivo")!, source: "default" };
      logs.ejecutivo.executive_match_found = false;
      logs.ejecutivo.source = "default";
    }
    // Priority 5: Fallback to vendor's own ID as ejecutivo
    else if (delivery.vendor_sicas_id) {
      resolved.IDEjecutivo = { value: delivery.vendor_sicas_id, source: "fallback_vendor_id", label: vendorName || undefined };
      logs.ejecutivo.executive_match_found = false;
      logs.ejecutivo.source = "fallback_vendor_id";
      warnings.push(`IDEjecutivo: Se asigno el ID del vendedor (${delivery.vendor_sicas_id}) como ejecutivo.`);
    }
    // Priority 6: Last resort - mark as missing (should rarely reach here)
    else {
      missing.push("Ejecutivo (IDEjecutivo)");
      logs.ejecutivo.executive_match_found = false;
      warnings.push(`IDEjecutivo: No se encontro ejecutivo con nombre "${vendorName}" y no hay vendedor asignado.`);
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

  // === 10. IDCli (Cliente) - Auto search/create ===
  logs.cliente = {};

  if (delivery.sicas_override_cliente) {
    resolved.IDCli = { value: delivery.sicas_override_cliente, source: "override" };
    logs.cliente.source = "override";
  } else if (delivery.sicas_client_id) {
    // Already resolved from a previous attempt
    resolved.IDCli = { value: delivery.sicas_client_id, source: "previously_resolved" };
    logs.cliente.source = "previously_resolved";
  } else {
    const rfcToSearch = delivery.insured_rfc || delivery.extracted_data?.rfcAsegurado || delivery.extracted_data?.rfc || delivery.extracted_data?.RFCCliente;
    const nameToSearch = delivery.insured_name || delivery.extracted_data?.nombreCliente || delivery.extracted_data?.asegurado || delivery.extracted_data?.contratante || delivery.extracted_data?.customer_name;

    logs.cliente.client_search_rfc = rfcToSearch || null;
    logs.cliente.client_search_name = nameToSearch || null;

    let clientFound = false;

    // Search by RFC in local contacts catalog (type 17)
    if (rfcToSearch) {
      const rfcNormalized = rfcToSearch.trim().toUpperCase().replace(/[-\s]/g, "");
      const { data: byRfc } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .ilike("raw->>RFC", rfcNormalized)
        .limit(5);

      if (byRfc && byRfc.length === 1) {
        resolved.IDCli = { value: byRfc[0].id_sicas, source: "matched_by_rfc", label: byRfc[0].nombre };
        logs.cliente.selected_client_id = byRfc[0].id_sicas;
        logs.cliente.candidates_count = 1;
        logs.cliente.auto_created = false;
        clientFound = true;
      } else if (byRfc && byRfc.length > 1) {
        logs.cliente.candidates_count = byRfc.length;
        warnings.push(`IDCli: RFC "${rfcToSearch}" tiene ${byRfc.length} coincidencias en SICAS. Requiere seleccion manual.`);
        missing.push("Cliente SICAS (IDCli)");
        clientFound = true;
      }
    }

    // Search by name in local contacts
    if (!clientFound && nameToSearch) {
      const normalizedName = normalizeText(nameToSearch);
      const { data: byName } = await supabase
        .from("sicas_catalogos")
        .select("id_sicas, nombre, raw")
        .eq("catalog_type_id", 17)
        .limit(500);

      if (byName && byName.length > 0) {
        const exactMatch = byName.find((r: CatalogRecord) => normalizeText(r.nombre) === normalizedName);
        if (exactMatch) {
          resolved.IDCli = { value: exactMatch.id_sicas, source: "matched_by_name", label: exactMatch.nombre };
          logs.cliente.selected_client_id = exactMatch.id_sicas;
          logs.cliente.candidates_count = 1;
          logs.cliente.auto_created = false;
          clientFound = true;
        } else {
          const partialMatches = byName.filter((r: CatalogRecord) => {
            const normalized = normalizeText(r.nombre);
            return normalized.includes(normalizedName) || normalizedName.includes(normalized);
          });
          if (partialMatches.length === 1) {
            resolved.IDCli = { value: partialMatches[0].id_sicas, source: "matched_by_name_partial", label: partialMatches[0].nombre };
            logs.cliente.selected_client_id = partialMatches[0].id_sicas;
            logs.cliente.auto_created = false;
            clientFound = true;
            warnings.push(`IDCli: Match parcial por nombre "${nameToSearch}" -> "${partialMatches[0].nombre}".`);
          } else if (partialMatches.length > 1) {
            logs.cliente.candidates_count = partialMatches.length;
            missing.push("Cliente SICAS (IDCli)");
            warnings.push(`IDCli: Nombre "${nameToSearch}" tiene ${partialMatches.length} coincidencias parciales. Requiere seleccion manual.`);
            clientFound = true;
          }
        }
      }
    }

    // If no local results, mark for auto-creation attempt
    if (!clientFound) {
      if (nameToSearch) {
        logs.cliente.auto_create_eligible = true;
        logs.cliente.auto_create_name = nameToSearch;
        logs.cliente.auto_create_rfc = rfcToSearch || null;
        // Do NOT push to missing - auto-creation will handle it
        resolved.IDCli = { value: "__auto_create__", source: "auto_create_pending", label: nameToSearch };
        warnings.push(`IDCli: No se encontro cliente SICAS. Se creara automaticamente al registrar.`);
      } else {
        missing.push("Cliente SICAS (IDCli)");
        logs.cliente.auto_create_eligible = false;
        warnings.push(`IDCli: No hay nombre de cliente disponible para buscar o crear en SICAS.`);
      }
    }
  }

  // === 11. IDVend (Agente/Vendedor) ===
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
): Promise<{ success: boolean; clientId?: string; clientName?: string; error?: string; responseRaw?: any }> {
  try {
  const clientName = delivery.insured_name || delivery.extracted_data?.nombreCliente || delivery.extracted_data?.contratante || delivery.extracted_data?.customer_name || delivery.extracted_data?.asegurado || "";
  const clientRfc = delivery.insured_rfc || delivery.extracted_data?.rfcAsegurado || delivery.extracted_data?.rfc || delivery.extracted_data?.RFCCliente || "";

  if (!clientName.trim()) {
    return { success: false, error: "No hay nombre de cliente para crear" };
  }

  if (!sicasEndpoint) {
    return { success: false, error: "SICAS endpoint no configurado. No se puede crear cliente." };
  }

  console.log(`[SICAS Client] Attempting auto-create: name="${clientName}", rfc="${clientRfc}"`);

  // Build the SOAP request for creating a contact/client
  // Using Procesar_String with WS_SaveData approach
  const contactData: string[] = [];
  contactData.push(`CliNombre|${clientName.trim()}`);
  if (clientRfc) contactData.push(`CliRFC|${clientRfc.trim().toUpperCase()}`);

  // Add optional fields if available
  const email = delivery.extracted_data?.email || delivery.extracted_data?.correo || "";
  const phone = delivery.extracted_data?.telefono || delivery.extracted_data?.phone || "";
  const address = delivery.extracted_data?.direccion || delivery.extracted_data?.domicilio || "";
  const cp = delivery.extracted_data?.codigoPostal || delivery.extracted_data?.cp || "";

  if (email) contactData.push(`CliEmail|${email}`);
  if (phone) contactData.push(`CliTelefono|${phone}`);
  if (address) contactData.push(`CliDomicilio|${address}`);
  if (cp) contactData.push(`CliCP|${cp}`);

  // Tipo Persona (default Fisica unless empresa-like name)
  const isEmpresa = /^(S\.?A\.?|S\.?C\.?|S\.? DE R\.?L\.?|SOCIEDAD|EMPRESA|CORPORAT|CIA|COMPAÑIA)/i.test(clientName.trim());
  contactData.push(`CliTipoPersona|${isEmpresa ? "M" : "F"}`);

  const dataString = contactData.join("\n");

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soap:Header/>
  <soap:Body>
    <tem:Procesar_String>
      <tem:oConfigAuth>
        <tem:UserName>${sicasUsername}</tem:UserName>
        <tem:Password>${sicasPassword}</tem:Password>
      </tem:oConfigAuth>
      <tem:oConfigData>
        <tem:PropertyNameTransaction>WS_SaveData</tem:PropertyNameTransaction>
        <tem:PropertyTypeData>Contacto</tem:PropertyTypeData>
        <tem:PropertyData>${dataString}</tem:PropertyData>
      </tem:oConfigData>
    </tem:Procesar_String>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const responseText = await response.text();
    console.log(`[SICAS Client] Create response (first 500 chars):`, responseText.substring(0, 500));

    // Parse the response to get the new client ID
    const decoded = responseText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // Look for success indicators and the new ID
    const idMatch = decoded.match(/<IDContacto>(\d+)<\/IDContacto>/i) ||
                    decoded.match(/<IDCli>(\d+)<\/IDCli>/i) ||
                    decoded.match(/<ID>(\d+)<\/ID>/i) ||
                    decoded.match(/<RESPONSENBR>\s*(\d+)\s*<\/RESPONSENBR>/i);

    const hasSuccess = /SUCESS|SUCCESS|OK|GUARDADO|CREADO/i.test(decoded);
    const hasError = /ERROR|FALLO|FAILED/i.test(decoded) && !/SUCESS/i.test(decoded);

    if (hasError) {
      const errorMsg = decoded.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/i)?.[1] ||
                       decoded.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       "Error desconocido de SICAS";
      return { success: false, error: errorMsg, responseRaw: { raw: responseText.substring(0, 2000) } };
    }

    if (idMatch && idMatch[1] && parseInt(idMatch[1]) > 0) {
      const newClientId = idMatch[1];
      console.log(`[SICAS Client] Created successfully: ID=${newClientId}`);
      return {
        success: true,
        clientId: newClientId,
        clientName: clientName.trim(),
        responseRaw: { raw: responseText.substring(0, 2000) },
      };
    }

    if (hasSuccess) {
      // Success but couldn't extract ID - may need to search for the new client
      console.log(`[SICAS Client] Success indicated but no ID extracted. Searching...`);
      // Try searching by RFC to find the newly created client
      if (clientRfc) {
        const { data: newlyCreated } = await supabase
          .from("sicas_catalogos")
          .select("id_sicas, nombre")
          .eq("catalog_type_id", 17)
          .ilike("raw->>RFC", clientRfc.trim().toUpperCase())
          .limit(1);
        if (newlyCreated && newlyCreated.length > 0) {
          return {
            success: true,
            clientId: newlyCreated[0].id_sicas,
            clientName: newlyCreated[0].nombre,
            responseRaw: { raw: responseText.substring(0, 2000) },
          };
        }
      }
      return { success: false, error: "SICAS indico exito pero no se pudo obtener el ID del nuevo cliente", responseRaw: { raw: responseText.substring(0, 2000) } };
    }

    return { success: false, error: "Respuesta de SICAS no reconocida", responseRaw: { raw: responseText.substring(0, 2000) } };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
  }
  } catch (outerError: any) {
    console.error("[SICAS Client] Unexpected error in attemptClientAutoCreate:", outerError.message);
    return { success: false, error: `Error inesperado: ${outerError.message}` };
  }
}

// ============================================================
// HWCAPTURE Registration (form-urlencoded)
// ============================================================

async function registerWithHwcapture(
  resolved: Record<string, ResolvedField>,
  delivery: PolicyDelivery,
  sicasEndpoint: string,
  sicasUsername: string,
  sicasPassword: string
): Promise<{ success: boolean; documentId?: string; error?: string; responseRaw?: string; isDuplicate?: boolean; duplicateId?: string; duplicateMessage?: string }> {
  const policyNumber = delivery.manual_policy_number || delivery.policy_number || "";
  const startDate = normalizeDate(delivery.start_date);
  const endDate = normalizeDate(delivery.end_date);
  const premium = delivery.total_premium || delivery.extracted_data?.primaTotal || "0";

  const formData = new URLSearchParams();
  formData.append("UserName", sicasUsername);
  formData.append("Password", sicasPassword);
  formData.append("IDTipoDocto", resolved.IDTipoDocto?.value || "");
  formData.append("IDCia", resolved.IDCia?.value || "");
  formData.append("IDRamo", resolved.IDRamo?.value || "");
  formData.append("IDSubRamo", resolved.IDSubRamo?.value || "");
  formData.append("IDMon", resolved.IDMon?.value || "");
  formData.append("IDFPago", resolved.IDFPago?.value || "");
  formData.append("IDEjecutivo", resolved.IDEjecutivo?.value || "");
  formData.append("IDGrupo", resolved.IDGrupo?.value || "");
  formData.append("IDCli", resolved.IDCli?.value || "");
  formData.append("IDVend", resolved.IDVend?.value || "");
  formData.append("Estatus", resolved.Estatus?.value || "V");
  formData.append("Documento", policyNumber);
  formData.append("FechaInicio", startDate);
  formData.append("FechaFin", endDate);
  formData.append("PrimaTotal", premium);

  // Add office if available
  if (delivery.sicas_office_id) {
    formData.append("IDOficina", delivery.sicas_office_id);
  }

  const hwcaptureEndpoint = sicasEndpoint.replace(/\/[^/]*$/, "/") + "HWCAPTURE";
  const targetEndpoint = /HWCAPTURE/i.test(sicasEndpoint) ? sicasEndpoint : hwcaptureEndpoint;

  console.log(`[SICAS HWCAPTURE] POST to ${targetEndpoint}`);
  console.log(`[SICAS HWCAPTURE] Payload: ${formData.toString().substring(0, 500)}...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Prop_KeyCode": "HWCAPTURE",
      },
      body: formData.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseText = await response.text();
    console.log(`[SICAS HWCAPTURE] Response (${response.status}):`, responseText.substring(0, 800));

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}`, responseRaw: responseText };
    }

    // Check for duplicate
    const isDuplicate = /duplicad|ya existe|already exists/i.test(responseText);
    if (isDuplicate) {
      const dupIdMatch = responseText.match(/IDDocto["\s:=]+(\d+)/i) || responseText.match(/<ID>(\d+)<\/ID>/i);
      return {
        success: false,
        isDuplicate: true,
        duplicateId: dupIdMatch?.[1] || undefined,
        duplicateMessage: "Poliza ya existe en SICAS",
        responseRaw: responseText,
      };
    }

    // Check for success
    const docIdMatch = responseText.match(/IDDocto["\s:=]+(\d+)/i) ||
                       responseText.match(/<IDDocto>(\d+)<\/IDDocto>/i) ||
                       responseText.match(/"IDDocto"\s*:\s*"?(\d+)"?/i);

    const hasSuccess = /success|exito|guardado|ok/i.test(responseText);
    const hasError = /error|fallo|failed/i.test(responseText) && !hasSuccess;

    if (hasError) {
      const errorMsg = responseText.match(/<Message>(.*?)<\/Message>/i)?.[1] ||
                       responseText.match(/"Error"\s*:\s*"([^"]+)"/i)?.[1] ||
                       responseText.substring(0, 300);
      return { success: false, error: errorMsg, responseRaw: responseText };
    }

    if (docIdMatch?.[1]) {
      return { success: true, documentId: docIdMatch[1], responseRaw: responseText };
    }

    if (hasSuccess) {
      return { success: true, responseRaw: responseText };
    }

    return { success: false, error: "Respuesta no reconocida", responseRaw: responseText };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return { success: false, error: error.message };
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
      throw new Error("SICAS credentials not configured");
    }

    const body = await req.json();
    const { action = "resolve" } = body;
    const delivery_id = body.delivery_id || body.policy_delivery_id || body.policyDeliveryId || body.deliveryId || body.id;

    console.log(`[SICAS Register] Received body keys: ${Object.keys(body).join(", ")}`);
    console.log(`[SICAS Register] Resolved delivery_id: ${delivery_id}, action: ${action}`);

    if (!delivery_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "delivery_id is required. Send delivery_id, policy_delivery_id, policyDeliveryId, deliveryId, or id in the request body.",
          debug_received_keys: Object.keys(body),
          debug_body_preview: JSON.stringify(body).substring(0, 500),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the policy delivery
    const { data: delivery, error: fetchError } = await supabase
      .from("policy_deliveries")
      .select("*")
      .eq("id", delivery_id)
      .maybeSingle();

    if (fetchError || !delivery) {
      throw new Error(`Policy delivery not found: ${fetchError?.message || "no data"}`);
    }

    // Fetch defaults
    const { data: defaultsData } = await supabase
      .from("sicas_hwcapture_defaults")
      .select("field_name, default_value, default_label");
    const defaults: HwcaptureDefault[] = defaultsData || [];

    // === RESOLVE action ===
    if (action === "resolve") {
      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);

      // Save resolution state to delivery
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_resolved_fields: resolution.resolved,
          sicas_resolution_warnings: resolution.warnings,
          sicas_registration_status: resolution.missing.length === 0 ? "ready_to_register" : "pending_fields",
        })
        .eq("id", delivery_id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "resolve",
          resolved: resolution.resolved,
          missing: resolution.missing,
          warnings: resolution.warnings,
          logs: resolution.logs,
          policy_number: delivery.manual_policy_number || delivery.policy_number,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REGISTER action ===
    if (action === "register") {
      // Re-resolve to make sure everything is up to date
      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);

      // If client is missing but auto-create eligible, attempt creation
      const clientNeedsAutoCreate = (resolution.resolved.IDCli?.value === "__auto_create__") || (resolution.missing.includes("Cliente SICAS (IDCli)") && resolution.logs.cliente?.auto_create_eligible);
      if (clientNeedsAutoCreate) {
        console.log("[SICAS] Client needs auto-creation. Attempting...");

        const createResult = await attemptClientAutoCreate(supabase, delivery, sicasEndpoint, sicasUsername, sicasPassword);

        if (createResult.success && createResult.clientId) {
          resolution.resolved.IDCli = { value: createResult.clientId, source: "auto_created", label: createResult.clientName };
          resolution.missing = resolution.missing.filter(m => !m.includes("IDCli"));

          // Save client info to delivery
          await supabase
            .from("policy_deliveries")
            .update({
              sicas_client_id: createResult.clientId,
              sicas_client_name: createResult.clientName,
              sicas_client_auto_created: true,
              sicas_client_created_at: new Date().toISOString(),
              sicas_client_create_response_raw: createResult.responseRaw,
              sicas_client_match_method: "auto_created",
              sicas_client_match_confidence: "high",
            })
            .eq("id", delivery_id);

          console.log(`[SICAS] Client auto-created successfully: ID=${createResult.clientId}`);
        } else {
          console.error(`[SICAS] Client auto-creation failed: ${createResult.error}`);
          resolution.warnings.push(`IDCli: Auto-creacion fallo: ${createResult.error}`);
          resolution.missing.push("Cliente SICAS (IDCli)");

          // Save the failure info
          await supabase
            .from("policy_deliveries")
            .update({
              sicas_client_create_response_raw: createResult.responseRaw || { error: createResult.error },
              sicas_client_match_method: "auto_create_failed",
            })
            .eq("id", delivery_id);
        }
      }

      // Check if all required fields are resolved (also check sentinel)
      if (resolution.missing.length > 0 || resolution.resolved.IDCli?.value === "__auto_create__") {
        if (resolution.resolved.IDCli?.value === "__auto_create__") {
          resolution.missing.push("Cliente SICAS (IDCli)");
        }
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_resolved_fields: resolution.resolved,
            sicas_resolution_warnings: resolution.warnings,
            sicas_registration_status: "pending_fields",
            sicas_error_message: `Campos faltantes: ${resolution.missing.join(", ")}`,
          })
          .eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "register",
            error: "missing_fields",
            missing: resolution.missing,
            warnings: resolution.warnings,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // All fields resolved - proceed to HWCAPTURE registration
      const attempts = (delivery.sicas_registration_attempts || 0) + 1;

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "registering",
          sicas_registration_attempts: attempts,
          sicas_last_attempt_at: new Date().toISOString(),
          sicas_resolved_fields: resolution.resolved,
          sicas_request_payload: resolution.resolved,
        })
        .eq("id", delivery_id);

      const hwResult = await registerWithHwcapture(
        resolution.resolved,
        delivery,
        sicasEndpoint,
        sicasUsername,
        sicasPassword
      );

      if (hwResult.success) {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_registration_status: "registered",
            sicas_document_id: hwResult.documentId || null,
            sicas_registered_at: new Date().toISOString(),
            sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
            sicas_error_message: null,
          })
          .eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "register",
            document_id: hwResult.documentId,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hwResult.isDuplicate) {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_registration_status: "duplicate",
            sicas_duplicate_detected: true,
            sicas_duplicate_document_id: hwResult.duplicateId || null,
            sicas_duplicate_message: hwResult.duplicateMessage,
            sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
          })
          .eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "register",
            error: "duplicate",
            duplicate_id: hwResult.duplicateId,
            message: hwResult.duplicateMessage,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_registration_status: "error",
            sicas_error_message: hwResult.error,
            sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
          })
          .eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "register",
            error: hwResult.error,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // === AUTO action: Full automatic flow (resolve + client + register) ===
    if (action === "auto") {
      const steps: Array<{ step: string; status: string; detail?: string }> = [];
      let finalStatus = "unknown";

      // Step 1: Resolve all fields
      steps.push({ step: "resolving", status: "in_progress" });
      await supabase.from("policy_deliveries").update({ sicas_registration_status: "resolving" }).eq("id", delivery_id);

      const resolution = await resolveSicasHwcaptureRequiredFields(supabase, delivery, defaults);
      steps[steps.length - 1].status = "completed";
      steps[steps.length - 1].detail = `${Object.keys(resolution.resolved).length} campos resueltos, ${resolution.missing.length} pendientes`;

      // Step 2: Handle client resolution/creation
      const clientNeedsCreation = resolution.resolved.IDCli?.value === "__auto_create__" || resolution.missing.includes("Cliente SICAS (IDCli)");
      if (clientNeedsCreation) {
        if (resolution.logs.cliente?.auto_create_eligible) {
          steps.push({ step: "creating_client", status: "in_progress" });
          await supabase.from("policy_deliveries").update({ sicas_registration_status: "creating_client" }).eq("id", delivery_id);

          const createResult = await attemptClientAutoCreate(supabase, delivery, sicasEndpoint, sicasUsername, sicasPassword);

          if (createResult.success && createResult.clientId) {
            resolution.resolved.IDCli = { value: createResult.clientId, source: "auto_created", label: createResult.clientName };
            resolution.missing = resolution.missing.filter(m => !m.includes("IDCli"));

            await supabase.from("policy_deliveries").update({
              sicas_client_id: createResult.clientId,
              sicas_client_name: createResult.clientName,
              sicas_client_auto_created: true,
              sicas_client_created_at: new Date().toISOString(),
              sicas_client_create_response_raw: createResult.responseRaw,
              sicas_client_match_method: "auto_created",
              sicas_client_match_confidence: "high",
            }).eq("id", delivery_id);

            steps[steps.length - 1].status = "completed";
            steps[steps.length - 1].detail = `Cliente creado: ${createResult.clientName} (ID: ${createResult.clientId})`;
          } else {
            steps[steps.length - 1].status = "failed";
            steps[steps.length - 1].detail = createResult.error || "Error desconocido";

            await supabase.from("policy_deliveries").update({
              sicas_client_create_response_raw: createResult.responseRaw || { error: createResult.error },
              sicas_client_match_method: "auto_create_failed",
            }).eq("id", delivery_id);

            resolution.warnings.push(`Cliente: Auto-creacion fallo: ${createResult.error}`);
            resolution.missing.push("Cliente SICAS (IDCli)");
          }
        } else if (resolution.logs.cliente?.candidates_count > 1) {
          steps.push({ step: "client_ambiguous", status: "manual_required", detail: `${resolution.logs.cliente.candidates_count} candidatos encontrados` });
          resolution.missing.push("Cliente SICAS (IDCli)");
        } else {
          steps.push({ step: "client_missing", status: "manual_required", detail: "No hay datos de cliente para buscar o crear" });
          resolution.missing.push("Cliente SICAS (IDCli)");
        }
      } else if (resolution.resolved.IDCli) {
        steps.push({ step: "client_found", status: "completed", detail: `${resolution.resolved.IDCli.label || resolution.resolved.IDCli.value} (${resolution.resolved.IDCli.source})` });
      }

      // Step 3: Check if we can proceed to registration (also check for sentinel values)
      if (resolution.missing.length > 0 || resolution.resolved.IDCli?.value === "__auto_create__") {
        if (resolution.resolved.IDCli?.value === "__auto_create__") {
          resolution.missing.push("Cliente SICAS (IDCli)");
        }
        finalStatus = "manual_review_required";
        await supabase.from("policy_deliveries").update({
          sicas_resolved_fields: resolution.resolved,
          sicas_resolution_warnings: resolution.warnings,
          sicas_registration_status: "manual_review_required",
          sicas_error_message: `Campos faltantes: ${resolution.missing.join(", ")}`,
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "auto",
            status: "manual_review_required",
            message: `No se pudo completar el registro. Campos faltantes: ${resolution.missing.join(", ")}`,
            steps,
            missing: resolution.missing,
            warnings: resolution.warnings,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 4: Register with HWCAPTURE
      steps.push({ step: "registering", status: "in_progress" });
      const attempts = (delivery.sicas_registration_attempts || 0) + 1;

      await supabase.from("policy_deliveries").update({
        sicas_registration_status: "registering",
        sicas_registration_attempts: attempts,
        sicas_last_attempt_at: new Date().toISOString(),
        sicas_resolved_fields: resolution.resolved,
        sicas_request_payload: resolution.resolved,
      }).eq("id", delivery_id);

      const hwResult = await registerWithHwcapture(resolution.resolved, delivery, sicasEndpoint, sicasUsername, sicasPassword);

      if (hwResult.success) {
        finalStatus = "registered";
        steps[steps.length - 1].status = "completed";
        steps[steps.length - 1].detail = hwResult.documentId ? `Documento SICAS: ${hwResult.documentId}` : "Registro exitoso";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "registered",
          sicas_document_id: hwResult.documentId || null,
          sicas_registered_at: new Date().toISOString(),
          sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
          sicas_error_message: null,
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: true,
            action: "auto",
            status: "registered",
            message: "Poliza registrada en SICAS correctamente.",
            document_id: hwResult.documentId,
            steps,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (hwResult.isDuplicate) {
        finalStatus = "duplicate_found";
        steps[steps.length - 1].status = "duplicate";
        steps[steps.length - 1].detail = "La poliza ya existe en SICAS";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "duplicate",
          sicas_duplicate_detected: true,
          sicas_duplicate_document_id: hwResult.duplicateId || null,
          sicas_duplicate_message: hwResult.duplicateMessage,
          sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "auto",
            status: "duplicate_found",
            message: "La poliza ya existe en SICAS.",
            duplicate_id: hwResult.duplicateId,
            steps,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        finalStatus = "error";
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].detail = hwResult.error || "Error desconocido";

        await supabase.from("policy_deliveries").update({
          sicas_registration_status: "error",
          sicas_error_message: hwResult.error,
          sicas_response_raw: { raw: hwResult.responseRaw?.substring(0, 5000) },
        }).eq("id", delivery_id);

        return new Response(
          JSON.stringify({
            success: false,
            action: "auto",
            status: "error",
            message: hwResult.error || "Error al registrar en SICAS",
            steps,
            resolved: resolution.resolved,
            logs: resolution.logs,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    throw new Error(`Unknown action: ${action}. Use "resolve", "register", or "auto".`);
  } catch (error: any) {
    console.error("[SICAS Register] Fatal error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, status: "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
