import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FUNCTION_VERSION = "2.2.0";

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

let _createClient: any = null;
async function loadSupabaseClient() {
  if (!_createClient) {
    const mod = await import("npm:@supabase/supabase-js@2");
    _createClient = mod.createClient;
  }
  return _createClient;
}

// Field name variants for each core field
const POLICY_FIELDS = ['policy_number', 'manual_policy_number', 'poliza', 'numero_poliza', 'document_number', 'Documento', 'num_poliza', 'policyNo', 'NumPoliza', 'Poliza', 'policy_no'];
const INSURED_FIELDS = ['insured_name', 'asegurado', 'contratante', 'client_name', 'customer_name', 'nombre_cliente', 'nombre_asegurado', 'NombreCompleto', 'Asegurado', 'Contratante', 'policy_holder'];
const PREMIUM_FIELDS = ['total_premium', 'premium', 'prima', 'prima_total', 'prima_neta', 'net_premium', 'PrimaTotal', 'PrimaNeta', 'importe', 'amount', 'total'];
const START_DATE_FIELDS = ['start_date', 'fecha_inicio', 'vigencia_inicio', 'FDesde', 'desde', 'effective_date', 'policy_start_date', 'inicio_vigencia'];
const END_DATE_FIELDS = ['end_date', 'fecha_fin', 'vigencia_fin', 'FHasta', 'hasta', 'expiration_date', 'policy_end_date', 'fin_vigencia'];
const CLIENT_ID_FIELDS = ['sicas_client_id', 'IDCli', 'client_id', 'id_cliente'];
const VENDOR_ID_FIELDS = ['vendor_sicas_id', 'IDVend', 'vendor_id', 'vend_id'];

function isValid(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s !== '' && s !== 'null' && s !== 'undefined' && s !== 'N/A' && s !== '0' && s !== '-1';
}

function isValidId(v: unknown): boolean {
  if (v == null) return false;
  const n = Number(v);
  return !isNaN(n) && n > 0;
}

function normalizePremium(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, '');
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : Math.round(n * 100) / 100;
}

function normalizeDate(v: unknown): string | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s || s === 'N/A') return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // Spanish month abbreviations
  const meses: Record<string, string> = {
    ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
    JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
  };
  const spanishMatch = s.match(/^(\d{1,2})\/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\/(\d{4})$/i);
  if (spanishMatch) {
    const [, day, month, year] = spanishMatch;
    return `${year}-${meses[month.toUpperCase()]}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try native Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);

  return null;
}

function normalizePolicy(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === 'N/A' || s === 'null') return null;
  return s;
}

interface ResolvedField {
  value: string | number | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ResolveResult {
  policy_number: ResolvedField;
  insured_name: ResolvedField;
  premium: ResolvedField;
  start_date: ResolvedField;
  end_date: ResolvedField;
  sicas_client_id: ResolvedField;
  sicas_vendor_id: ResolvedField;
  sicas_executive_id: ResolvedField;
  sicas_group_id: ResolvedField;
  sicas_currency_id: ResolvedField;
  sicas_payment_form_id: ResolvedField;
  status: ResolvedField;
}

function searchInObject(obj: Record<string, unknown> | null | undefined, fieldNames: string[]): { value: unknown; key: string } | null {
  if (!obj) return null;
  for (const name of fieldNames) {
    if (obj[name] != null && isValid(obj[name])) {
      return { value: obj[name], key: name };
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // health_check: responds without loading any modules
    if (body.health_check === true) {
      return jsonResp(200, {
        success: true,
        function: "sicas-auto-resolve-delivery-data",
        status: "ok",
        version: FUNCTION_VERSION,
        imports_loaded: false,
        timestamp: new Date().toISOString(),
      });
    }

    // test_imports
    if (body.test_imports === true) {
      try {
        const createClientFn = await loadSupabaseClient();
        return jsonResp(200, { success: true, stage: "test_imports", imports_loaded: true, available: { supabase_client: typeof createClientFn === "function" } });
      } catch (importErr: any) {
        return jsonResp(200, { success: false, stage: "test_imports", imports_loaded: false, message: importErr.message });
      }
    }

    const { delivery_id, save = true, table_snapshot, include_local_sicas = true } = body;

    if (!delivery_id) {
      return jsonResp(400, { ok: false, error: "delivery_id es requerido" });
    }

    const createClient = await loadSupabaseClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load delivery record
    const { data: delivery, error: deliveryErr } = await supabase
      .from("policy_deliveries")
      .select("*")
      .eq("id", delivery_id)
      .maybeSingle();

    if (deliveryErr || !delivery) {
      return jsonResp(404, { ok: false, error: "Entrega no encontrada" });
    }

    // Load existing resolution
    const { data: existingResolution } = await supabase
      .from("sicas_delivery_resolutions")
      .select("*")
      .eq("delivery_id", delivery_id)
      .maybeSingle();

    // Load registration logs for this delivery
    const { data: regLogs } = await supabase
      .from("sicas_registration_logs")
      .select("action, status, request_payload, response_raw")
      .eq("policy_delivery_id", delivery_id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build data sources in priority order
    const sources: { name: string; data: Record<string, unknown> | null }[] = [];

    // 1. Previous resolution
    if (existingResolution) {
      sources.push({ name: "previous_resolution", data: existingResolution as Record<string, unknown> });
    }

    // 2. Resolved fields on delivery
    if (delivery.sicas_resolved_fields) {
      const resolvedFlat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(delivery.sicas_resolved_fields as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'value' in (v as any)) {
          resolvedFlat[k] = (v as any).value;
        } else {
          resolvedFlat[k] = v;
        }
      }
      sources.push({ name: "delivery.sicas_resolved_fields", data: resolvedFlat });
    }

    // 3. Registration logs
    if (regLogs && regLogs.length > 0) {
      for (const log of regLogs) {
        if (log.response_raw && typeof log.response_raw === 'object') {
          sources.push({ name: `registration_log.${log.action}`, data: log.response_raw as Record<string, unknown> });
        }
      }
    }

    // 4. Table snapshot from frontend
    if (table_snapshot && typeof table_snapshot === 'object') {
      sources.push({ name: "table_snapshot", data: table_snapshot as Record<string, unknown> });
    }

    // 5. Direct delivery fields
    sources.push({ name: "delivery", data: delivery as Record<string, unknown> });

    // 6. Extracted data
    if (delivery.extracted_data) {
      sources.push({ name: "extracted_data", data: delivery.extracted_data as Record<string, unknown> });
    }

    // 7. Client creation response
    if (delivery.sicas_client_create_response_raw) {
      sources.push({ name: "client_response", data: delivery.sicas_client_create_response_raw as Record<string, unknown> });
    }

    // 8. Request debug data
    if (delivery.sicas_request_debug) {
      sources.push({ name: "request_debug", data: delivery.sicas_request_debug as Record<string, unknown> });
    }

    // Resolve each field by iterating sources in priority order
    const resolved: Record<string, ResolvedField> = {};
    const sourcesUsed: Record<string, string> = {};

    // Helper to resolve a text field
    const resolveTextField = (fieldKey: string, fieldNames: string[], normalize?: (v: unknown) => string | null) => {
      for (const src of sources) {
        const found = searchInObject(src.data, fieldNames);
        if (found) {
          const val = normalize ? normalize(found.value) : String(found.value).trim();
          if (val && val !== 'N/A' && val !== 'null') {
            const confidence = src.name.includes('previous_resolution') || src.name.includes('table_snapshot') || src.name === 'delivery'
              ? 'high' : src.name.includes('extracted_data') ? 'medium' : 'medium';
            resolved[fieldKey] = { value: val, source: `${src.name}.${found.key}`, confidence };
            sourcesUsed[fieldKey] = src.name;
            return;
          }
        }
      }
      resolved[fieldKey] = { value: null, source: 'no_encontrado', confidence: 'low' };
    };

    // Helper to resolve numeric ID field
    const resolveIdField = (fieldKey: string, fieldNames: string[], defaultValue?: number) => {
      for (const src of sources) {
        const found = searchInObject(src.data, fieldNames);
        if (found && isValidId(found.value)) {
          const confidence = src.name.includes('previous_resolution') || src.name === 'delivery' ? 'high' : 'medium';
          resolved[fieldKey] = { value: Number(found.value), source: `${src.name}.${found.key}`, confidence };
          sourcesUsed[fieldKey] = src.name;
          return;
        }
      }
      if (defaultValue != null) {
        resolved[fieldKey] = { value: defaultValue, source: 'default', confidence: 'high' };
        sourcesUsed[fieldKey] = 'default';
      } else {
        resolved[fieldKey] = { value: null, source: 'no_encontrado', confidence: 'low' };
      }
    };

    // Resolve core fields
    resolveTextField('policy_number', POLICY_FIELDS, normalizePolicy);
    resolveTextField('insured_name', INSURED_FIELDS);
    resolveTextField('start_date', START_DATE_FIELDS, normalizeDate);
    resolveTextField('end_date', END_DATE_FIELDS, normalizeDate);

    // Premium needs special normalization
    for (const src of sources) {
      const found = searchInObject(src.data, PREMIUM_FIELDS);
      if (found) {
        const val = normalizePremium(found.value);
        if (val) {
          const confidence = src.name.includes('previous_resolution') || src.name === 'delivery' ? 'high' : 'medium';
          resolved['premium'] = { value: val, source: `${src.name}.${found.key}`, confidence };
          sourcesUsed['premium'] = src.name;
          break;
        }
      }
    }
    if (!resolved['premium']) {
      resolved['premium'] = { value: null, source: 'no_encontrado', confidence: 'low' };
    }

    // Resolve IDs
    resolveIdField('sicas_client_id', CLIENT_ID_FIELDS);
    resolveIdField('sicas_vendor_id', VENDOR_ID_FIELDS);
    resolveIdField('sicas_executive_id', ['sicas_executive_id', 'IDEjecutivo', 'executive_id']);
    resolveIdField('sicas_group_id', ['sicas_group_id', 'IDGrupo', 'group_id'], 25);
    resolveIdField('sicas_currency_id', ['sicas_currency_id', 'IDMon', 'currency_id'], 1);
    resolveIdField('sicas_payment_form_id', ['sicas_payment_form_id', 'IDFPago', 'payment_form_id'], 1);
    resolved['status'] = { value: 'V', source: 'default', confidence: 'high' };

    // If executive not found, use vendor as fallback
    if (!isValidId(resolved['sicas_executive_id']?.value) && isValidId(resolved['sicas_vendor_id']?.value)) {
      resolved['sicas_executive_id'] = { value: resolved['sicas_vendor_id'].value, source: 'fallback_from_vendor_id', confidence: 'medium' };
      sourcesUsed['sicas_executive_id'] = 'fallback_from_vendor_id';
    }

    // 9. Search local SICAS documents for matching policy
    if (include_local_sicas && resolved['policy_number']?.value) {
      const policyNum = String(resolved['policy_number'].value);
      const { data: localDoc } = await supabase
        .from("sicas_documents")
        .select("id_docto, poliza, cliente, prima_total, prima_neta, importe, vigencia_desde, vigencia_hasta, vend_id")
        .or(`poliza.eq.${policyNum},poliza.ilike.%${policyNum}%`)
        .limit(1)
        .maybeSingle();

      if (localDoc) {
        // Fill missing fields from local SICAS document
        if (!resolved['insured_name']?.value && localDoc.cliente) {
          resolved['insured_name'] = { value: localDoc.cliente, source: 'local_sicas_document', confidence: 'high' };
          sourcesUsed['insured_name'] = 'local_sicas_document';
        }
        if (!resolved['premium']?.value) {
          const localPremium = normalizePremium(localDoc.prima_total || localDoc.prima_neta || localDoc.importe);
          if (localPremium) {
            resolved['premium'] = { value: localPremium, source: 'local_sicas_document', confidence: 'high' };
            sourcesUsed['premium'] = 'local_sicas_document';
          }
        }
        if (!resolved['start_date']?.value && localDoc.vigencia_desde) {
          const d = normalizeDate(localDoc.vigencia_desde);
          if (d) {
            resolved['start_date'] = { value: d, source: 'local_sicas_document', confidence: 'high' };
            sourcesUsed['start_date'] = 'local_sicas_document';
          }
        }
        if (!resolved['end_date']?.value && localDoc.vigencia_hasta) {
          const d = normalizeDate(localDoc.vigencia_hasta);
          if (d) {
            resolved['end_date'] = { value: d, source: 'local_sicas_document', confidence: 'high' };
            sourcesUsed['end_date'] = 'local_sicas_document';
          }
        }
        if (!isValidId(resolved['sicas_vendor_id']?.value) && isValidId(localDoc.vend_id)) {
          resolved['sicas_vendor_id'] = { value: Number(localDoc.vend_id), source: 'local_sicas_document', confidence: 'high' };
          sourcesUsed['sicas_vendor_id'] = 'local_sicas_document';
        }
      }
    }

    // Also search by insured name if policy not found
    if (include_local_sicas && !isValidId(resolved['sicas_client_id']?.value) && resolved['insured_name']?.value) {
      const insuredName = String(resolved['insured_name'].value).toUpperCase().trim();
      const { data: clientMatch } = await supabase
        .from("sicas_documents")
        .select("raw_data")
        .ilike("cliente", `%${insuredName.substring(0, 20)}%`)
        .limit(1)
        .maybeSingle();

      if (clientMatch?.raw_data && typeof clientMatch.raw_data === 'object') {
        const raw = clientMatch.raw_data as Record<string, unknown>;
        const clientId = raw['IDCli'] || raw['id_cli'] || raw['IdCli'];
        if (isValidId(clientId)) {
          resolved['sicas_client_id'] = { value: Number(clientId), source: 'local_sicas_document_client_match', confidence: 'medium' };
          sourcesUsed['sicas_client_id'] = 'local_sicas_document_client_match';
        }
      }
    }

    // Determine missing fields and overall status
    const missingFields: string[] = [];
    if (!resolved['policy_number']?.value) missingFields.push('policy_number');
    if (!resolved['insured_name']?.value) missingFields.push('insured_name');
    if (!resolved['premium']?.value) missingFields.push('premium');
    if (!resolved['start_date']?.value) missingFields.push('start_date');
    if (!resolved['end_date']?.value) missingFields.push('end_date');

    const coreComplete = missingFields.length === 0;
    const hasClientId = isValidId(resolved['sicas_client_id']?.value);
    const hasVendorId = isValidId(resolved['sicas_vendor_id']?.value);

    let resolutionStatus: string;
    if (coreComplete && hasClientId && hasVendorId) {
      resolutionStatus = 'ready_for_hwcapture';
    } else if (coreComplete && !hasClientId) {
      resolutionStatus = 'needs_client';
    } else {
      resolutionStatus = 'needs_data';
    }

    // Save resolution if requested
    if (save) {
      const resolutionRow = {
        delivery_id,
        policy_number: resolved['policy_number']?.value ? String(resolved['policy_number'].value) : null,
        insured_name: resolved['insured_name']?.value ? String(resolved['insured_name'].value) : null,
        premium: resolved['premium']?.value ? Number(resolved['premium'].value) : null,
        start_date: resolved['start_date']?.value ? String(resolved['start_date'].value) : null,
        end_date: resolved['end_date']?.value ? String(resolved['end_date'].value) : null,
        sicas_client_id: isValidId(resolved['sicas_client_id']?.value) ? Number(resolved['sicas_client_id'].value) : null,
        sicas_vendor_id: isValidId(resolved['sicas_vendor_id']?.value) ? Number(resolved['sicas_vendor_id'].value) : null,
        sicas_executive_id: isValidId(resolved['sicas_executive_id']?.value) ? Number(resolved['sicas_executive_id'].value) : null,
        sicas_group_id: isValidId(resolved['sicas_group_id']?.value) ? Number(resolved['sicas_group_id'].value) : 25,
        sicas_currency_id: isValidId(resolved['sicas_currency_id']?.value) ? Number(resolved['sicas_currency_id'].value) : 1,
        sicas_payment_form_id: isValidId(resolved['sicas_payment_form_id']?.value) ? Number(resolved['sicas_payment_form_id'].value) : 1,
        status: 'V',
        sources_json: sourcesUsed,
        confidence_json: Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, v.confidence])),
        missing_fields_json: missingFields,
        auto_resolved: true,
        resolution_status: resolutionStatus,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("sicas_delivery_resolutions")
        .upsert(resolutionRow, { onConflict: "delivery_id" });

      // Also update delivery's sicas_resolved_fields for backward compat
      const resolvedFieldsForDelivery: Record<string, { value: string | number | null; source: string }> = {};
      for (const [k, v] of Object.entries(resolved)) {
        if (v.value != null) {
          resolvedFieldsForDelivery[k] = { value: v.value, source: v.source };
        }
      }
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_resolved_fields: {
            ...(delivery.sicas_resolved_fields || {}),
            ...resolvedFieldsForDelivery,
            _auto_resolved_at: new Date().toISOString(),
          },
        })
        .eq("id", delivery_id);
    }

    // Build response
    const resolvedValues: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(resolved)) {
      resolvedValues[k] = v.value;
    }

    return jsonResp(200, {
      ok: true,
      status: resolutionStatus,
      resolved_values: resolvedValues,
      resolved_details: resolved,
      missing_fields: missingFields,
      sources: sourcesUsed,
      confidence: Object.fromEntries(Object.entries(resolved).map(([k, v]) => [k, v.confidence])),
      core_complete: coreComplete,
      has_client_id: hasClientId,
      has_vendor_id: hasVendorId,
    });
  } catch (error) {
    console.error("[AUTO-RESOLVE] Error:", (error as Error).message);
    return jsonResp(500, { ok: false, error: (error as Error).message });
  }
});
