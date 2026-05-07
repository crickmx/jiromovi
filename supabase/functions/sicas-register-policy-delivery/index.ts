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
}

// ============================================================
// Policy Number Extraction - Priority Chain
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

  // Remove invisible characters
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");

  if (cleaned.length === 0) return null;
  return cleaned;
}

// ============================================================
// Date formatting for SICAS
// ============================================================

function formatDateSicas(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
// SICAS SaveData - Multi-format strategy
// ============================================================

interface SaveDataStrategy {
  name: string;
  description: string;
  buildPayload: (policyNumber: string, delivery: PolicyDelivery) => Record<string, string>;
}

// The strategies try different field naming conventions that SICAS might accept
const SAVE_DATA_STRATEGIES: SaveDataStrategy[] = [
  {
    name: "minimal_no_prefix",
    description: "Minimal payload: IDDocto + Documento without table prefix",
    buildPayload: (policyNumber: string) => ({
      IDDocto: "-1",
      Documento: policyNumber,
    }),
  },
  {
    name: "minimal_DatDocumentos",
    description: "Minimal payload: DatDocumentos.IDDocto + DatDocumentos.Documento",
    buildPayload: (policyNumber: string) => ({
      "DatDocumentos.IDDocto": "-1",
      "DatDocumentos.Documento": policyNumber,
    }),
  },
  {
    name: "minimal_DatDocumento_singular",
    description: "Minimal payload: DatDocumento.IDDocto + DatDocumento.Documento (singular)",
    buildPayload: (policyNumber: string) => ({
      "DatDocumento.IDDocto": "-1",
      "DatDocumento.Documento": policyNumber,
    }),
  },
  {
    name: "full_no_prefix",
    description: "Full payload without table prefix on document fields, with prefix on detail",
    buildPayload: (policyNumber: string, delivery: PolicyDelivery) => ({
      IDDocto: "-1",
      Documento: policyNumber,
      IDVend: delivery.vendor_sicas_id || "",
      IDCia: "1",
      IDRamo: "1",
      IDSubRamo: "1",
      FDesde: formatDateSicas(delivery.start_date),
      FHasta: formatDateSicas(delivery.end_date),
      PrimaNeta: delivery.net_premium || "0",
      PrimaTotal: delivery.total_premium || "0",
      FormaPago: delivery.payment_method || "",
      Moneda: delivery.currency || "Pesos",
      NombreCliente: delivery.insured_name || "",
      RFCCliente: delivery.insured_rfc || "",
      IDGerencia: delivery.sicas_management_id || "0",
      IDDespacho: delivery.sicas_office_id || "0",
      Estatus: "V",
      Observaciones: "Registrado desde MOVI Digital",
      "DatDoctoDetail.Descripcion": delivery.vehicle_description || "",
      "DatDoctoDetail.Serie": delivery.vin || "",
      "DatDoctoDetail.Motor": delivery.engine || "",
      "DatDoctoDetail.Placas": delivery.plates || "",
    }),
  },
  {
    name: "full_DatDocumentos_prefix",
    description: "Full payload with DatDocumentos prefix (original approach)",
    buildPayload: (policyNumber: string, delivery: PolicyDelivery) => ({
      "DatDocumentos.IDDocto": "-1",
      "DatDocumentos.Documento": policyNumber,
      "DatDocumentos.IDVend": delivery.vendor_sicas_id || "",
      "DatDocumentos.IDCia": "1",
      "DatDocumentos.IDRamo": "1",
      "DatDocumentos.IDSubRamo": "1",
      "DatDocumentos.FDesde": formatDateSicas(delivery.start_date),
      "DatDocumentos.FHasta": formatDateSicas(delivery.end_date),
      "DatDocumentos.PrimaNeta": delivery.net_premium || "0",
      "DatDocumentos.PrimaTotal": delivery.total_premium || "0",
      "DatDocumentos.FormaPago": delivery.payment_method || "",
      "DatDocumentos.Moneda": delivery.currency || "Pesos",
      "DatDocumentos.NombreCliente": delivery.insured_name || "",
      "DatDocumentos.RFCCliente": delivery.insured_rfc || "",
      "DatDocumentos.IDGerencia": delivery.sicas_management_id || "0",
      "DatDocumentos.IDDespacho": delivery.sicas_office_id || "0",
      "DatDocumentos.Estatus": "V",
      "DatDocumentos.Observaciones": "Registrado desde MOVI Digital",
      "DatDoctoDetail.Descripcion": delivery.vehicle_description || "",
      "DatDoctoDetail.Serie": delivery.vin || "",
      "DatDoctoDetail.Motor": delivery.engine || "",
      "DatDoctoDetail.Placas": delivery.plates || "",
    }),
  },
];

interface StrategyResult {
  strategyName: string;
  description: string;
  httpStatus: number;
  success: boolean;
  payload: Record<string, string>;
  responseRaw: any;
  error?: string;
  documentId?: string;
}

async function tryRegisterWithStrategy(
  baseUrl: string,
  token: string,
  strategy: SaveDataStrategy,
  policyNumber: string,
  delivery: PolicyDelivery
): Promise<StrategyResult> {
  const payload = strategy.buildPayload(policyNumber, delivery);

  console.log(`\n[SICAS] === Strategy: ${strategy.name} ===`);
  console.log(`[SICAS] Description: ${strategy.description}`);
  console.log(`[SICAS] Payload keys: ${Object.keys(payload).join(", ")}`);
  console.log(`[SICAS] Documento value: "${payload.Documento || payload["DatDocumentos.Documento"] || payload["DatDocumento.Documento"]}"`);
  console.log(`[SICAS] Full payload: ${JSON.stringify(payload)}`);

  const headers: Record<string, string> = {
    Authorization: token,
    "Content-Type": "application/json",
    Prop_KeyCode: "HWCAPTURE",
    Prop_KeyProcess: "DATA",
    Prop_TProc: "Save_Data",
  };

  try {
    const response = await fetch(`${baseUrl}/Data/SaveData`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const httpStatus = response.status;

    if (!response.ok) {
      const errBody = await response.text();
      console.log(`[SICAS] Strategy ${strategy.name}: HTTP ${httpStatus} - ${errBody}`);
      return {
        strategyName: strategy.name,
        description: strategy.description,
        httpStatus,
        success: false,
        payload,
        responseRaw: errBody,
        error: `HTTP ${httpStatus}: ${errBody}`,
      };
    }

    const data = await response.json();
    console.log(`[SICAS] Strategy ${strategy.name} response: ${JSON.stringify(data)}`);

    // Check for success
    if (data.Sucess || data.Success) {
      const docId = data.IDDocto || data.DocumentId || data.Id || data.Response?.IDDocto;
      console.log(`[SICAS] Strategy ${strategy.name}: SUCCESS! DocumentId: ${docId}`);
      return {
        strategyName: strategy.name,
        description: strategy.description,
        httpStatus,
        success: true,
        payload,
        responseRaw: data,
        documentId: docId ? String(docId) : undefined,
      };
    }

    // Error from SICAS
    const msg = data.Message || data.Error || JSON.stringify(data);
    console.log(`[SICAS] Strategy ${strategy.name}: SICAS error: ${msg}`);
    return {
      strategyName: strategy.name,
      description: strategy.description,
      httpStatus,
      success: false,
      payload,
      responseRaw: data,
      error: msg,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.log(`[SICAS] Strategy ${strategy.name}: Exception: ${errMsg}`);
    return {
      strategyName: strategy.name,
      description: strategy.description,
      httpStatus: 0,
      success: false,
      payload,
      responseRaw: { exception: errMsg },
      error: errMsg,
    };
  }
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
        JSON.stringify({ success: false, error: "No authorization header" }),
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

    const { policy_delivery_id } = await req.json();
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

    // Prevent re-registration
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
      return new Response(
        JSON.stringify({ success: false, error: "Ya hay un registro en proceso. Espera.", status: "registering" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== RESOLVE POLICY NUMBER =====
    const policyNumber = getPolicyNumberFromDelivery(delivery as PolicyDelivery);

    console.log(`[SICAS] Policy number resolution:`);
    console.log(`  manual_policy_number: "${delivery.manual_policy_number}"`);
    console.log(`  policy_number: "${delivery.policy_number}"`);
    console.log(`  extracted_data.numeroPoliza: "${delivery.extracted_data?.numeroPoliza}"`);
    console.log(`  extracted_data.poliza: "${delivery.extracted_data?.poliza}"`);
    console.log(`  => Resolved: "${policyNumber}"`);

    if (!policyNumber) {
      const errMsg = "Falta numero de poliza/documento. Capturalo antes de registrar en SICAS.";
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "manual_review_required",
          sicas_manual_review_reason: "No se encontro numero de poliza en ningun campo disponible",
          sicas_error_message: errMsg,
        })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "validation_no_policy_number",
        status: "manual_review_required",
        errorMessage: errMsg,
        requestPayload: {
          manual_policy_number: delivery.manual_policy_number,
          policy_number: delivery.policy_number,
          extracted_data_keys: delivery.extracted_data ? Object.keys(delivery.extracted_data) : [],
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          status: "manual_review_required",
          message: errMsg,
          debug: {
            manual_policy_number: delivery.manual_policy_number || null,
            policy_number: delivery.policy_number || null,
            extracted_numeroPoliza: delivery.extracted_data?.numeroPoliza || null,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check duplicates
    const duplicateCheck = await checkDuplicateInMovi(supabase, delivery as PolicyDelivery);
    if (duplicateCheck.isDuplicate) {
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "duplicate_found",
          sicas_duplicate_detected: true,
          sicas_duplicate_document_id: duplicateCheck.existingId || null,
          sicas_duplicate_message: duplicateCheck.message || null,
        })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: duplicateCheck.message,
          status: "duplicate_found",
          existingDocumentId: duplicateCheck.existingId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as registering
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
      sicasToken = await getSicasToken({
        baseUrl: sicasBaseUrl,
        username: sicasUsername,
        password: sicasPassword,
        codeAuth: sicasCodeAuth,
      });
      console.log(`[SICAS] Token obtained successfully`);
    } catch (authErr) {
      const errMsg = `Error autenticando con SICAS: ${authErr instanceof Error ? authErr.message : "unknown"}`;
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "error", sicas_error_message: errMsg })
        .eq("id", delivery.id);

      await logRegistration(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "sicas_auth_error",
        status: "error",
        errorMessage: errMsg,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg, error_type: "sicas_auth", status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== TRY REGISTRATION STRATEGIES =====
    console.log(`\n[SICAS] ========================================`);
    console.log(`[SICAS] Starting registration for delivery: ${delivery.id}`);
    console.log(`[SICAS] Policy number: "${policyNumber}"`);
    console.log(`[SICAS] Vendor SICAS ID: "${delivery.vendor_sicas_id}"`);
    console.log(`[SICAS] Endpoint: ${sicasBaseUrl}/Data/SaveData`);
    console.log(`[SICAS] ========================================\n`);

    const strategyResults: StrategyResult[] = [];
    let successResult: StrategyResult | null = null;

    for (const strategy of SAVE_DATA_STRATEGIES) {
      const result = await tryRegisterWithStrategy(
        sicasBaseUrl,
        sicasToken,
        strategy,
        policyNumber,
        delivery as PolicyDelivery
      );

      strategyResults.push(result);

      if (result.success) {
        successResult = result;
        break;
      }

      // If the error is NOT the "No Existe" document error, stop trying
      // (e.g., auth error, network error, different business error)
      const isDocumentError = result.error &&
        (result.error.includes("No Existe") || result.error.includes("No. de Documento") || result.error.includes("documento"));

      if (!isDocumentError && result.httpStatus !== 0) {
        console.log(`[SICAS] Non-document error encountered, stopping strategies`);
        break;
      }

      // Small delay between strategy attempts
      await new Promise((r) => setTimeout(r, 300));
    }

    // ===== SAVE COMPREHENSIVE LOGS =====
    const logPayload = {
      policy_delivery_id: delivery.id,
      policy_number_detected: policyNumber,
      method_used: "REST_SaveData",
      key_code: "HWCAPTURE",
      type_process: "DATA",
      t_proc: "Save_Data",
      strategies_tried: strategyResults.map((r) => ({
        name: r.strategyName,
        description: r.description,
        success: r.success,
        httpStatus: r.httpStatus,
        error: r.error,
        documentId: r.documentId,
        payload_keys: Object.keys(r.payload),
        payload_contains_Documento: "Documento" in r.payload,
        payload_contains_DatDocumentos_Documento: "DatDocumentos.Documento" in r.payload,
        payload_contains_DatDocumento_Documento: "DatDocumento.Documento" in r.payload,
        payload_contains_IDDocto: "IDDocto" in r.payload || "DatDocumentos.IDDocto" in r.payload || "DatDocumento.IDDocto" in r.payload,
      })),
      successful_strategy: successResult?.strategyName || null,
    };

    await supabase
      .from("policy_deliveries")
      .update({
        sicas_request_payload: logPayload,
        sicas_response_raw: successResult?.responseRaw || strategyResults[strategyResults.length - 1]?.responseRaw || null,
      })
      .eq("id", delivery.id);

    await logRegistration(supabase, {
      policyDeliveryId: delivery.id,
      ticketId: delivery.ticket_id,
      userId: user.id,
      action: successResult ? "sicas_register_success" : "sicas_register_failed",
      status: successResult ? "registered" : "error",
      requestPayload: logPayload,
      responseRaw: strategyResults,
      errorMessage: successResult ? undefined : strategyResults[strategyResults.length - 1]?.error,
      durationMs: Date.now() - startTime,
    });

    // ===== HANDLE FAILURE =====
    if (!successResult) {
      const lastResult = strategyResults[strategyResults.length - 1];
      const sicasMessage = lastResult?.error || "Error desconocido de SICAS";
      const isDocumentError = sicasMessage.includes("No Existe") || sicasMessage.includes("No. de Documento");

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: isDocumentError ? "sicas_rejected" : "error",
          sicas_error_message: sicasMessage,
          sicas_manual_review_reason: isDocumentError
            ? "SICAS no reconoce el numero de documento. Se probaron multiples formatos de campo."
            : null,
        })
        .eq("id", delivery.id);

      return new Response(
        JSON.stringify({
          success: false,
          status: "sicas_rejected",
          message: "SICAS no recibio el numero de documento. Revisa el payload enviado.",
          sicas_message: sicasMessage,
          debug_hint: "Se probaron formatos: Documento, DatDocumentos.Documento, DatDocumento.Documento. Ninguno fue aceptado.",
          strategies_tried: strategyResults.map((r) => ({
            name: r.strategyName,
            success: r.success,
            error: r.error,
          })),
          policy_number_used: policyNumber,
          durationMs: Date.now() - startTime,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SUCCESS - REGISTRATION COMPLETE =====
    const documentId = successResult.documentId || "";

    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "registered",
        sicas_document_id: documentId,
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: null,
        sicas_manual_review_reason: null,
      })
      .eq("id", delivery.id);

    // ===== UPLOAD FILES (only if document was created) =====
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
          baseUrl: sicasBaseUrl,
          token: sicasToken,
          documentId,
          fileUrl: delivery.cover_file_path,
          fileName: delivery.cover_file_name || "caratula.pdf",
        });
        filesResponses.push({ file: "cover", ...coverResult });
        if (!coverResult.success) {
          filesError = coverResult.error || "Error subiendo caratula";
        }
      }

      const additionalFiles = delivery.additional_files || [];
      for (const file of additionalFiles) {
        if (file.path) {
          const result = await uploadFileToCentroDigital({
            baseUrl: sicasBaseUrl,
            token: sicasToken,
            documentId,
            fileUrl: file.path,
            fileName: file.name || "documento.pdf",
          });
          filesResponses.push({ file: file.name, ...result });
          if (!result.success && !filesError) {
            filesError = result.error || `Error subiendo ${file.name}`;
          }
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
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: filesUploaded ? "file_upload_success" : "file_upload_error",
        status: finalStatus,
        responseRaw: filesResponses,
        errorMessage: filesError || undefined,
        durationMs: Date.now() - startTime,
      });
    }

    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        status: filesUploaded ? "completed" : "registered",
        documentId,
        successful_strategy: successResult.strategyName,
        filesUploaded,
        filesError,
        message: filesUploaded
          ? `Poliza registrada en SICAS (IDDocto: ${documentId}). Documentos enviados al Centro Digital.`
          : documentId
            ? `Poliza registrada en SICAS (IDDocto: ${documentId}).${filesError ? " Algunos archivos no se pudieron subir." : ""}`
            : "Poliza registrada en SICAS.",
        durationMs,
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
