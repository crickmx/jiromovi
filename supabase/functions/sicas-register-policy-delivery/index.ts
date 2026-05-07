import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// SICAS Registration Edge Function for Policy Deliveries
// ============================================================

interface PolicyDelivery {
  id: string;
  policy_number: string | null;
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

// Minimum required fields for SICAS registration
const REQUIRED_FIELDS: Array<{ key: keyof PolicyDelivery; label: string }> = [
  { key: "policy_number", label: "Numero de poliza" },
  { key: "insured_name", label: "Nombre del asegurado" },
  { key: "start_date", label: "Inicio de vigencia" },
  { key: "end_date", label: "Fin de vigencia" },
  { key: "vendor_sicas_id", label: "Vendedor SICAS" },
  { key: "cover_file_path", label: "Caratula PDF" },
  { key: "ticket_id", label: "Tramite MOVI" },
];

function validateMinimumData(delivery: PolicyDelivery): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!delivery[field.key]) {
      missing.push(field.label);
    }
  }
  return { valid: missing.length === 0, missing };
}

// Build the XML payload for SICAS HWCAPTURE document registration
function buildSicasPolicyPayload(delivery: PolicyDelivery): string {
  const policyNumber = getPolicyNumberFromDelivery(delivery) || "";
  const idVend = delivery.vendor_sicas_id || "";
  const idGerencia = delivery.sicas_management_id || "";
  const idDespacho = delivery.sicas_office_id || "";

  // Format dates for SICAS (DD/MM/YYYY)
  const formatDateSicas = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const xml = `<InfoData>
  <DatDocumentos>
    <IDDocto>-1</IDDocto>
    <Documento>${escapeXml(policyNumber)}</Documento>
    <IDVend>${escapeXml(idVend)}</IDVend>
    <IDCia>1</IDCia>
    <IDRamo>1</IDRamo>
    <IDSubRamo>1</IDSubRamo>
    <FDesde>${formatDateSicas(delivery.start_date)}</FDesde>
    <FHasta>${formatDateSicas(delivery.end_date)}</FHasta>
    <PrimaNeta>${escapeXml(delivery.net_premium || "0")}</PrimaNeta>
    <PrimaTotal>${escapeXml(delivery.total_premium || "0")}</PrimaTotal>
    <FormaPago>${escapeXml(delivery.payment_method || "")}</FormaPago>
    <Moneda>${escapeXml(delivery.currency || "MXN")}</Moneda>
    <NombreCliente>${escapeXml(delivery.insured_name || "")}</NombreCliente>
    <RFCCliente>${escapeXml(delivery.insured_rfc || "")}</RFCCliente>
    <IDGerencia>${escapeXml(idGerencia)}</IDGerencia>
    <IDDespacho>${escapeXml(idDespacho)}</IDDespacho>
    <Estatus>V</Estatus>
    <Observaciones>Registrado desde MOVI Digital - Entrega de Polizas</Observaciones>
  </DatDocumentos>
  <DatDoctoDetail>
    <Descripcion>${escapeXml(delivery.vehicle_description || "")}</Descripcion>
    <Serie>${escapeXml(delivery.vin || "")}</Serie>
    <Motor>${escapeXml(delivery.engine || "")}</Motor>
    <Placas>${escapeXml(delivery.plates || "")}</Placas>
  </DatDoctoDetail>
</InfoData>`;

  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getPolicyNumberFromDelivery(delivery: PolicyDelivery): string | null {
  if (delivery.policy_number) return delivery.policy_number.trim();
  if (delivery.extracted_data?.numeroPoliza) return delivery.extracted_data.numeroPoliza.trim();
  if (delivery.extracted_data?.poliza) return delivery.extracted_data.poliza.trim();
  return null;
}

// Parse SICAS registration response
function parseSicasRegisterResponse(responseData: any): {
  success: boolean;
  documentId?: string;
  message?: string;
  error?: string;
} {
  try {
    // SICAS typically returns a PROCESSDATA structure
    if (typeof responseData === "string") {
      // Try to extract IDDocto from XML response
      const idMatch = responseData.match(/<IDDocto>(\d+)<\/IDDocto>/);
      const successMatch = responseData.match(/<RESPONSENBR>(\d+)<\/RESPONSENBR>/);
      const messageMatch = responseData.match(/<MESSAGE>(.*?)<\/MESSAGE>/);
      const responseTxt = responseData.match(/<RESPONSETXT>(.*?)<\/RESPONSETXT>/);

      const responseNbr = successMatch ? parseInt(successMatch[1]) : -1;

      if (responseNbr === 0 || responseNbr === 1) {
        return {
          success: true,
          documentId: idMatch?.[1] || undefined,
          message: responseTxt?.[1] || messageMatch?.[1] || "Registro exitoso",
        };
      }

      return {
        success: false,
        error: responseTxt?.[1] || messageMatch?.[1] || "Error desconocido de SICAS",
      };
    }

    // JSON response
    if (responseData.Sucess || responseData.Success) {
      return {
        success: true,
        documentId: responseData.IDDocto || responseData.DocumentId || responseData.Id,
        message: responseData.Message || "Registro exitoso",
      };
    }

    return {
      success: false,
      error: responseData.Error || responseData.Message || "Error de SICAS sin mensaje",
    };
  } catch (err) {
    return {
      success: false,
      error: `Error parsing SICAS response: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

// SICAS token management
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
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
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

// Send document registration to SICAS
async function registerDocumentInSicas(config: {
  baseUrl: string;
  token: string;
  dataXml: string;
}): Promise<any> {
  // Use the Data/SaveData endpoint for document creation
  const response = await fetch(`${config.baseUrl}/Data/SaveData`, {
    method: "POST",
    headers: {
      "Authorization": config.token,
      "Content-Type": "application/json",
      "Prop_KeyCode": "HWCAPTURE",
      "Prop_KeyProcess": "DATA",
      "Prop_TProc": "Save_Data",
    },
    body: JSON.stringify({
      DataXML: config.dataXml,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`SICAS HTTP ${response.status}: ${errBody}`);
  }

  return await response.json();
}

// Upload file to SICAS Centro Digital
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
        "Authorization": config.token,
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

// Check for duplicates in MOVI
async function checkDuplicateInMovi(
  supabase: any,
  delivery: PolicyDelivery
): Promise<{ isDuplicate: boolean; existingId?: string; message?: string }> {
  if (!delivery.policy_number) return { isDuplicate: false };

  // Check if another delivery with same policy number already has a SICAS document ID
  const { data: existing } = await supabase
    .from("policy_deliveries")
    .select("id, sicas_document_id, sicas_registration_status")
    .eq("policy_number", delivery.policy_number)
    .neq("id", delivery.id)
    .not("sicas_document_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      isDuplicate: true,
      existingId: existing.sicas_document_id,
      message: `La poliza ${delivery.policy_number} ya fue registrada en SICAS con IDDocto ${existing.sicas_document_id}`,
    };
  }

  return { isDuplicate: false };
}

// Log an action
async function logAction(
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Auth
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

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token invalido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify role
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

    // Parse request
    const { policy_delivery_id } = await req.json();
    if (!policy_delivery_id) {
      return new Response(
        JSON.stringify({ success: false, error: "policy_delivery_id requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the delivery
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

    // Prevent concurrent requests (check if currently processing)
    if (delivery.sicas_registration_status === "validating" || delivery.sicas_registration_status === "registering" || delivery.sicas_registration_status === "uploading_files") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Ya hay un registro en proceso para esta entrega. Espera a que termine.",
          status: delivery.sicas_registration_status,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log start
    await logAction(supabase, {
      policyDeliveryId: delivery.id,
      ticketId: delivery.ticket_id,
      userId: user.id,
      action: "start_registration",
      status: "started",
    });

    // Mark as validating
    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "validating",
        sicas_last_attempt_at: new Date().toISOString(),
        sicas_registration_attempts: (delivery.sicas_registration_attempts || 0) + 1,
      })
      .eq("id", delivery.id);

    // Resolve policy number from multiple sources
    const resolvedPolicyNumber = getPolicyNumberFromDelivery(delivery as PolicyDelivery);
    if (resolvedPolicyNumber && !delivery.policy_number) {
      await supabase
        .from("policy_deliveries")
        .update({ policy_number: resolvedPolicyNumber })
        .eq("id", delivery.id);
      delivery.policy_number = resolvedPolicyNumber;
    }

    // Validate minimum data
    const validation = validateMinimumData(delivery as PolicyDelivery);
    if (!validation.valid) {
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "manual_review_required",
          sicas_manual_review_reason: validation.missing.join(", "),
          sicas_error_message: `Datos minimos faltantes: ${validation.missing.join(", ")}`,
        })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "validation_failed",
        status: "error",
        errorMessage: `Datos faltantes: ${validation.missing.join(", ")}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `No se puede registrar en SICAS porque faltan datos minimos: ${validation.missing.join(", ")}. Revisa la entrega antes de intentar nuevamente.`,
          missingFields: validation.missing,
          status: "manual_review_required",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicates in MOVI
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

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "duplicate_found",
        status: "blocked",
        errorMessage: duplicateCheck.message,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: duplicateCheck.message || "Se detecto que esta poliza podria existir previamente en SICAS.",
          status: "duplicate_found",
          existingDocumentId: duplicateCheck.existingId,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build SICAS payload
    const dataXml = buildSicasPolicyPayload(delivery as PolicyDelivery);

    await logAction(supabase, {
      policyDeliveryId: delivery.id,
      ticketId: delivery.ticket_id,
      userId: user.id,
      action: "payload_built",
      status: "ready",
      requestPayload: {
        dataXml,
        resolvedPolicyNumber: resolvedPolicyNumber || delivery.policy_number,
        vendorSicasId: delivery.vendor_sicas_id,
        endpoint: `${Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api"}/Data/SaveData`,
      },
    });

    // Save payload and mark as registering
    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "registering",
        sicas_request_payload: { dataXml, timestamp: new Date().toISOString() },
      })
      .eq("id", delivery.id);

    // Get SICAS credentials
    const sicasBaseUrl = Deno.env.get("SICAS_REST_API_URL") || "https://security-services.sicasonline.info/api";
    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");
    const sicasCodeAuth = Deno.env.get("SICAS_CODE_AUTH");

    if (!sicasUsername || !sicasPassword) {
      const errMsg = "Credenciales SICAS no configuradas en el servidor";
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "error",
          sicas_error_message: errMsg,
        })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "sicas_error",
        status: "error",
        errorMessage: errMsg,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg, status: "error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate with SICAS
    let sicasToken: string;
    try {
      sicasToken = await getSicasToken({
        baseUrl: sicasBaseUrl,
        username: sicasUsername,
        password: sicasPassword,
        codeAuth: sicasCodeAuth,
      });
    } catch (authErr) {
      const errMsg = `Error autenticando con SICAS: ${authErr instanceof Error ? authErr.message : "unknown"}`;
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "error",
          sicas_error_message: errMsg,
        })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "sicas_error",
        status: "error",
        errorMessage: errMsg,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg, error_type: "sicas_auth", status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logAction(supabase, {
      policyDeliveryId: delivery.id,
      ticketId: delivery.ticket_id,
      userId: user.id,
      action: "sicas_request_sent",
      status: "sending",
    });

    // Send registration to SICAS
    let sicasResponse: any;
    try {
      sicasResponse = await registerDocumentInSicas({
        baseUrl: sicasBaseUrl,
        token: sicasToken,
        dataXml: dataXml,
      });
    } catch (regErr) {
      const errMsg = `Error enviando a SICAS: ${regErr instanceof Error ? regErr.message : "unknown"}`;
      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: "error",
          sicas_error_message: errMsg,
          sicas_response_raw: { error: errMsg },
        })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "sicas_error",
        status: "error",
        errorMessage: errMsg,
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ success: false, error: errMsg, error_type: "sicas_network", status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse SICAS response
    const parsed = parseSicasRegisterResponse(sicasResponse);

    // Save raw response
    await supabase
      .from("policy_deliveries")
      .update({ sicas_response_raw: sicasResponse })
      .eq("id", delivery.id);

    if (!parsed.success) {
      const errMsg = parsed.error || "SICAS respondio con error";
      const isDocumentoError = errMsg.toLowerCase().includes("no existe") || errMsg.toLowerCase().includes("documento");
      const errorType = isDocumentoError ? "sicas_business_documento" : "sicas_business";

      await supabase
        .from("policy_deliveries")
        .update({
          sicas_registration_status: isDocumentoError ? "manual_review_required" : "error",
          sicas_error_message: errMsg,
          sicas_manual_review_reason: isDocumentoError ? "SICAS no reconoce el numero de documento enviado. Verifica el numero de poliza." : null,
        })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "sicas_business_error",
        status: "error",
        errorMessage: errMsg,
        responseRaw: sicasResponse,
        requestPayload: { dataXml, policyNumber: getPolicyNumberFromDelivery(delivery as PolicyDelivery) },
        durationMs: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: errMsg,
          error_type: errorType,
          status: isDocumentoError ? "manual_review_required" : "error",
          sicasResponse,
          hint: isDocumentoError
            ? "El numero de poliza enviado no fue reconocido por SICAS. Puedes corregirlo manualmente y reintentar."
            : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registration successful
    const documentId = parsed.documentId || "";

    await supabase
      .from("policy_deliveries")
      .update({
        sicas_registration_status: "registered",
        sicas_document_id: documentId,
        sicas_registered_at: new Date().toISOString(),
        sicas_error_message: null,
      })
      .eq("id", delivery.id);

    await logAction(supabase, {
      policyDeliveryId: delivery.id,
      ticketId: delivery.ticket_id,
      userId: user.id,
      action: "sicas_success",
      status: "registered",
      responseRaw: sicasResponse,
    });

    // Attempt to upload files to Centro Digital
    let filesUploaded = false;
    let filesError: string | null = null;
    const filesResponses: any[] = [];

    if (documentId) {
      await supabase
        .from("policy_deliveries")
        .update({ sicas_registration_status: "uploading_files" })
        .eq("id", delivery.id);

      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "file_upload_start",
        status: "uploading",
      });

      // Upload cover file
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

      // Upload additional files
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

      filesUploaded = filesResponses.every((r) => r.success);

      if (filesUploaded) {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_registration_status: "completed",
            sicas_files_upload_status: "success",
            sicas_files_response_raw: filesResponses,
          })
          .eq("id", delivery.id);

        await logAction(supabase, {
          policyDeliveryId: delivery.id,
          ticketId: delivery.ticket_id,
          userId: user.id,
          action: "file_upload_success",
          status: "completed",
          responseRaw: filesResponses,
          durationMs: Date.now() - startTime,
        });
      } else {
        await supabase
          .from("policy_deliveries")
          .update({
            sicas_files_upload_status: "error",
            sicas_files_response_raw: filesResponses,
          })
          .eq("id", delivery.id);

        await logAction(supabase, {
          policyDeliveryId: delivery.id,
          ticketId: delivery.ticket_id,
          userId: user.id,
          action: "file_upload_error",
          status: "partial",
          errorMessage: filesError,
          responseRaw: filesResponses,
          durationMs: Date.now() - startTime,
        });
      }
    } else {
      // No document ID to upload files to, mark as registered (no file upload possible)
      await logAction(supabase, {
        policyDeliveryId: delivery.id,
        ticketId: delivery.ticket_id,
        userId: user.id,
        action: "completed",
        status: "registered_no_files",
        durationMs: Date.now() - startTime,
      });
    }

    const finalStatus = filesUploaded ? "completed" : "registered";
    const durationMs = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        documentId,
        filesUploaded,
        filesError,
        message: filesUploaded
          ? `Poliza registrada correctamente en SICAS. IDDocto: ${documentId}. Los documentos tambien fueron enviados al Centro Digital.`
          : documentId
            ? `Poliza registrada en SICAS con IDDocto ${documentId}, pero algunos archivos no pudieron cargarse al Centro Digital.`
            : "Poliza registrada en SICAS.",
        durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
