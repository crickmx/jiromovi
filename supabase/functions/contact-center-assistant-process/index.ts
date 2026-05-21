import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── MOVI IA Signature ─────────────────────────────────────────────────────────
const MOVI_IA_SIGNATURE = "- 🤖 MOVI IA";
const SIGNATURE_VARIANTS = [MOVI_IA_SIGNATURE, "🤖 MOVI IA", "- MOVI IA", "MOVI IA"];

function appendMoviIaSignature(message: string): string {
  if (!message?.trim()) return message;
  const clean = message.trim();
  if (SIGNATURE_VARIANTS.some(v => clean.endsWith(v))) return clean;
  return `${clean}\n\n${MOVI_IA_SIGNATURE}`;
}

interface AssistantField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_required: boolean;
  priority: string;
  capture_order: number;
  prompt_text: string | null;
  fallback_message: string | null;
  example_value: string | null;
  synonyms: string[];
  skip_if_contact_has: string | null;
  options: unknown[];
}

interface CapturedField {
  field_key: string;
  field_label: string;
  value_text: string | null;
  confidence_score: number;
  source: string;
  requires_human_review: boolean;
  status: string;
  failed_attempts: number;
  field_id?: string;
}

interface ExtractionResult {
  extracted_fields: Record<string, { value: string; confidence: number; source: string }>;
  is_correction: boolean;
  corrected_field?: string;
  is_skip_request: boolean;
  skipped_reason?: string;
  is_confirmation: boolean | null;
}

// ─── AI EXTRACTION ────────────────────────────────────────────────────────────

async function extractWithAI(
  openaiKey: string,
  userMessage: string,
  pendingFields: AssistantField[],
  capturedData: CapturedField[],
  assistantName: string,
  contactPhone: string | null,
  contactName: string | null,
  currentField: AssistantField | null,
  failedAttempts: number,
  currentStage: string
): Promise<ExtractionResult> {
  const capturedSummary = capturedData.filter(d => d.value_text).map(d => `${d.field_key}: "${d.value_text}"`).join(", ");
  const pendingList = pendingFields.slice(0, 8).map(f =>
    `- ${f.field_key} (${f.priority}): ${f.label}${f.example_value ? ` [ej: ${f.example_value}]` : ""}${f.synonyms?.length ? ` [sin.: ${f.synonyms.join(", ")}]` : ""}`
  ).join("\n");

  const systemPrompt = `Eres un extractor de datos para "${assistantName}" de MOVI Seguros.
DATOS YA CAPTURADOS: ${capturedSummary || "ninguno"}
CONTACTO: tel=${contactPhone || "?"}, nombre=${contactName || "?"}
CAMPOS PENDIENTES:\n${pendingList}
CAMPO ACTUAL: ${currentField ? `${currentField.field_key} (${currentField.label})` : "ninguno"}
ETAPA: ${currentStage} | REINTENTOS: ${failedAttempts}

REGLAS:
1. Extrae TODOS los datos útiles del mensaje aunque no se hayan pedido aún.
2. Si dice "no sé/no tengo/después/no aplica": is_skip_request=true.
3. Si corrige ("perdón, no es X sino Y"): is_correction=true, corrected_field=clave.
4. Si confirma resumen (sí/ok/adelante/registra/va/correcto): is_confirmation=true.
5. Si rechaza resumen (no/corregir/cambiar): is_confirmation=false.
6. Confidence: 0.9+ muy claro, 0.7-0.9 razonable, 0.5-0.7 probable. Mínimo 0.5.
7. Normaliza: "20 millones/20 mdp"→"20000000", "mañana"→"próximo día", "CDMX"→"Ciudad de México".
8. El teléfono del contacto ya está en el sistema: NO lo extraigas como campo nuevo.`;

  const userPrompt = `Mensaje: "${userMessage}"
Responde SOLO JSON:
{"extracted_fields":{"campo":{"value":"valor","confidence":0.9,"source":"user_message"}},"is_correction":false,"corrected_field":null,"is_skip_request":false,"skipped_reason":null,"is_confirmation":null}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return {
      extracted_fields: parsed.extracted_fields || {},
      is_correction: !!parsed.is_correction,
      corrected_field: parsed.corrected_field || undefined,
      is_skip_request: !!parsed.is_skip_request,
      skipped_reason: parsed.skipped_reason || undefined,
      is_confirmation: parsed.is_confirmation ?? null,
    };
  } catch {
    return ruleBased(userMessage, pendingFields, capturedData, currentField, failedAttempts);
  }
}

function ruleBased(
  message: string,
  _pendingFields: AssistantField[],
  _capturedData: CapturedField[],
  currentField: AssistantField | null,
  _failedAttempts: number
): ExtractionResult {
  const lower = message.toLowerCase().trim();

  if (["no sé", "no se", "no tengo", "después", "despues", "luego", "no aplica", "n/a", "ahorita no", "no cuento"].some(w => lower.includes(w))) {
    return { extracted_fields: {}, is_correction: false, is_skip_request: true, skipped_reason: message, is_confirmation: null };
  }

  const yesWords = ["si", "sí", "yes", "ok", "correcto", "adelante", "registra", "va", "listo", "dale", "así está", "está bien"];
  if (yesWords.some(w => lower === w || lower.startsWith(w + " ") || lower.startsWith(w + ","))) {
    return { extracted_fields: {}, is_correction: false, is_skip_request: false, is_confirmation: true };
  }
  if (["no", "corregir", "cambiar", "incorrecto", "está mal"].some(w => lower === w || lower.startsWith(w + " "))) {
    return { extracted_fields: {}, is_correction: false, is_skip_request: false, is_confirmation: false };
  }

  if (["perdón", "perdon", "no es", "corrijo", "quise decir", "me equivoqué"].some(w => lower.includes(w)) && currentField) {
    return { extracted_fields: { [currentField.field_key]: { value: message.trim(), confidence: 0.7, source: "correction_fallback" } }, is_correction: true, corrected_field: currentField.field_key, is_skip_request: false, is_confirmation: null };
  }

  if (currentField) {
    return { extracted_fields: { [currentField.field_key]: { value: message.trim(), confidence: 0.65, source: "rule_based" } }, is_correction: false, is_skip_request: false, is_confirmation: null };
  }
  return { extracted_fields: {}, is_correction: false, is_skip_request: false, is_confirmation: null };
}

function buildSummary(capturedData: CapturedField[]): string {
  const items = capturedData.filter(d => d.value_text && d.status !== "skipped");
  if (!items.length) return "(sin datos)";
  return items.map(d => `• *${d.field_label}:* ${d.value_text}${d.requires_human_review ? " _(revisar)_" : ""}`).join("\n");
}

function getNextQuestion(field: AssistantField, attempt: number): string {
  if (attempt === 0) return field.prompt_text || `¿${field.label}?`;
  if (attempt === 1) {
    if (field.fallback_message) return field.fallback_message;
    return field.example_value ? `Solo necesito ${field.label.toLowerCase()}. Ej: ${field.example_value}` : `¿Me pasas ${field.label.toLowerCase()}?`;
  }
  return ""; // signal to accept as-is
}

function isContactField(key: string): boolean {
  return ["nombre_cliente", "nombre", "nombre_completo", "nombre_asegurado", "telefono", "telefono_contacto", "whatsapp", "celular", "phone"].includes(key.toLowerCase());
}

// ─── BLOCK QUESTIONS ──────────────────────────────────────────────────────────
// Groups pending fields into conversational blocks of 2-3 fields

function buildBlockQuestion(fields: AssistantField[], blockSize: number): string {
  if (fields.length === 0) return "";
  const block = fields.slice(0, blockSize);
  if (block.length === 1) {
    return block[0].prompt_text || `¿${block[0].label}?`;
  }
  const lines = block.map((f, i) => {
    const label = f.label;
    const ex = f.example_value ? ` _(ej: ${f.example_value})_` : "";
    const optional = f.priority !== "required" ? " _(puedes omitir)_" : "";
    return `${i + 1}. ${label}${ex}${optional}`;
  });
  return `Para avanzar, compárteme:\n${lines.join("\n")}`;
}

function buildOptionalBlockQuestion(fields: AssistantField[], blockSize: number): string {
  if (fields.length === 0) return "";
  const block = fields.slice(0, Math.min(blockSize, fields.length));
  const labels = block.map(f => f.label.toLowerCase());
  const listStr = labels.length === 1 ? labels[0] : labels.slice(0, -1).join(", ") + " y " + labels[labels.length - 1];
  return `Opcional: ¿${listStr}? Puedes escribir "omitir" si no lo tienes.`;
}

// ─── RESOLVE RESPONSIBLE EMPLOYEE ─────────────────────────────────────────────

interface ResponsibleEmployee {
  id: string;
  name: string;
  role: string;
}

async function resolveResponsibleEmployee(
  supabase: ReturnType<typeof createClient>,
  agentUserId: string,
  activatedBy: string | null,
  assistantTramiteAssignedTo: string | null,
  officeId: string | null
): Promise<ResponsibleEmployee | null> {
  // Priority 1: Activated by (operator who started auto mode)
  if (activatedBy) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .eq("id", activatedBy).maybeSingle();
    if (data) {
      const name = (data.nombre_publico as string)?.trim() ||
        (data.nombre_completo as string)?.trim() ||
        [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
        "Agente";
      return { id: data.id, name, role: data.rol || "Empleado" };
    }
  }

  // Priority 2: Assistant's assigned user
  if (assistantTramiteAssignedTo) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .eq("id", assistantTramiteAssignedTo).maybeSingle();
    if (data) {
      const name = (data.nombre_publico as string)?.trim() ||
        (data.nombre_completo as string)?.trim() ||
        [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
        "Agente";
      return { id: data.id, name, role: data.rol || "Empleado" };
    }
  }

  // Priority 3: The agent user themselves
  if (agentUserId) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .eq("id", agentUserId).maybeSingle();
    if (data) {
      const name = (data.nombre_publico as string)?.trim() ||
        (data.nombre_completo as string)?.trim() ||
        [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
        "Agente";
      return { id: data.id, name, role: data.rol || "Empleado" };
    }
  }

  // Priority 4: Any admin/gerente in the office (fix: use estado='activo' not activo=true)
  if (officeId) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .eq("oficina_id", officeId)
      .in("rol", ["Administrador", "Gerente"])
      .eq("estado", "activo")
      .order("rol") // Gerente before Administrador alphabetically — both fine
      .limit(1).maybeSingle();
    if (data) {
      const name = (data.nombre_publico as string)?.trim() ||
        (data.nombre_completo as string)?.trim() ||
        [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
        "Agente";
      return { id: data.id, name, role: data.rol || "Gerente" };
    }
  }

  // Priority 5: Any active admin in the system (last resort)
  {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .in("rol", ["Administrador", "Gerente"])
      .eq("estado", "activo")
      .limit(1).maybeSingle();
    if (data) {
      const name = (data.nombre_publico as string)?.trim() ||
        (data.nombre_completo as string)?.trim() ||
        [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
        "Agente";
      return { id: data.id, name, role: data.rol || "Administrador" };
    }
  }

  return null;
}

const BASE_APP_URL = "https://app.movi.digital";

interface CreateTramiteResult {
  ticket_id: string | null;
  error: string | null;
  folio: string | null;
}

async function createTramite(
  supabase: ReturnType<typeof createClient>,
  session: {
    id: string;
    agent_user_id: string;
    activated_by?: string | null;
    contact_phone_prefilled?: string | null;
    contact_name_prefilled?: string | null;
  },
  assistant: {
    id: string;
    nombre: string;
    tramite_tipo?: string | null;
    tramite_prioridad?: string | null;
    tramite_assigned_to_user_id?: string | null;
    tramite_estatus_slug?: string | null;
    office_id?: string | null;
    form_title?: string | null;
    handoff_after_creation?: boolean | null;
  },
  capturedData: CapturedField[],
  pendingRequired: AssistantField[],
  idempotencyKey: string,
  messageId?: string | null
): Promise<CreateTramiteResult> {
  // ── Idempotency check ─────────────────────────────────────────────────────
  const { data: existingSession } = await supabase
    .from("contact_center_assistant_sessions")
    .select("ticket_id, tramite_creation_error")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingSession?.ticket_id) {
    console.log("[cc-process] Tramite already exists for idempotency key, reusing:", existingSession.ticket_id);
    const { data: existing } = await supabase.from("tickets").select("id, folio").eq("id", existingSession.ticket_id).maybeSingle();
    return { ticket_id: existingSession.ticket_id, error: null, folio: existing?.folio || null };
  }

  // ── Mark idempotency key to prevent race conditions ───────────────────────
  await supabase.from("contact_center_assistant_sessions")
    .update({ idempotency_key: idempotencyKey })
    .eq("id", session.id);

  try {
    const captured = capturedData.filter(d => d.value_text && d.status !== "skipped");
    const pendingLines = pendingRequired.map(f => `• ${f.label}: PENDIENTE`);
    const reviewLines = capturedData.filter(d => d.requires_human_review && d.value_text)
      .map(d => `• ${d.field_label}: "${d.value_text}" (revisar)`);

    // Build instrucciones
    let instrucciones = `Solicitud capturada vía Agente Automático (${assistant.form_title || assistant.nombre}):\n\nDATOS CAPTURADOS:\n`;
    instrucciones += captured.map(d => `• ${d.field_label}: ${d.value_text}`).join("\n") || "(ninguno)";
    if (pendingLines.length) instrucciones += `\n\nDATOS PENDIENTES:\n${pendingLines.join("\n")}`;
    if (reviewLines.length) instrucciones += `\n\nREQUIERE REVISIÓN HUMANA:\n${reviewLines.join("\n")}`;
    instrucciones += `\n\nOrigen: Centro de Contacto / WhatsApp`;
    if (session.contact_phone_prefilled) instrucciones += `\nTeléfono contacto: ${session.contact_phone_prefilled}`;
    if (session.contact_name_prefilled) instrucciones += `\nNombre contacto: ${session.contact_name_prefilled}`;

    // Extract some campos into ticket columns for quick search
    const clientField = captured.find(d => ["nombre_cliente", "nombre_asegurado", "nombre_completo", "nombre"].includes(d.field_key));
    const polizaField = captured.find(d => ["numero_poliza", "poliza", "no_poliza"].includes(d.field_key));
    const aseguradoraField = captured.find(d => ["aseguradora", "compania", "company"].includes(d.field_key));

    // Resolve estatus_id
    const estatusSlug = pendingRequired.length > 0 ? "Iniciado" : (assistant.tramite_estatus_slug || "Iniciado");
    const { data: estatusRow } = await supabase.from("ticket_estatus")
      .select("id").eq("nombre", estatusSlug).maybeSingle();
    const { data: fallbackEstatus } = await supabase.from("ticket_estatus")
      .select("id").eq("nombre", "Iniciado").maybeSingle();
    const estatusId = estatusRow?.id || fallbackEstatus?.id;
    if (!estatusId) throw new Error("No se encontró estatus Iniciado");

    // Resolve assigned_to_user_id: assistant default > activated_by
    const assignedTo = assistant.tramite_assigned_to_user_id || session.activated_by || null;

    // Resolve agente_id (the agent/contact this tramite is about)
    const agentId = session.agent_user_id;

    // Resolve creado_por (must be non-null per schema)
    const creadoPor = session.activated_by || assignedTo || session.agent_user_id;

    const { data: folioData } = await supabase.rpc("generate_next_folio");
    const folio = folioData || `CC-${Date.now()}`;

    const { data: ticket, error } = await supabase.from("tickets").insert({
      folio,
      instrucciones,
      tipo_tramite: assistant.tramite_tipo || "formulario_cotizacion",
      prioridad: assistant.tramite_prioridad || "Media",
      estatus_id: estatusId,
      agente_id: agentId,
      assigned_to_user_id: assignedTo,
      creado_por: creadoPor,
      cerrado: false,
      registro_cliente: clientField?.value_text || session.contact_name_prefilled || null,
      registro_numero_poliza: polizaField?.value_text || null,
      registro_aseguradora: aseguradoraField?.value_text || null,
      metadata: {
        automation_session_id: session.id,
        assistant_id: assistant.id,
        assistant_name: assistant.nombre,
        form_title: assistant.form_title || null,
        source: "modo_automatico",
        channel: "whatsapp",
        contact_phone: session.contact_phone_prefilled || null,
        contact_name: session.contact_name_prefilled || null,
        captured_count: captured.length,
        pending_count: pendingRequired.length,
        requires_review: reviewLines.length > 0,
        confirmation_message_id: messageId || null,
        idempotency_key: idempotencyKey,
      },
    }).select("id, folio").single();

    if (error) {
      console.error("[cc-process] tramite insert error:", error);
      await supabase.from("contact_center_assistant_sessions")
        .update({ tramite_creation_error: error.message }).eq("id", session.id);
      return { ticket_id: null, error: error.message, folio: null };
    }

    // Update session with ticket_id and creation time
    await supabase.from("contact_center_assistant_sessions")
      .update({ ticket_id: ticket.id, tramite_created_at: new Date().toISOString(), tramite_creation_error: null })
      .eq("id", session.id);

    // Add ticket_comment linking conversation data
    await supabase.from("ticket_comentarios").insert({
      ticket_id: ticket.id,
      autor_id: creadoPor,
      contenido: `Trámite creado automáticamente desde Centro de Contacto.\nSesión: ${session.id}\nContacto: ${session.contact_name_prefilled || "?"} (${session.contact_phone_prefilled || "?"})`,
      tipo: "sistema",
    }).maybeSingle();

    return { ticket_id: ticket.id, error: null, folio: ticket.folio };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cc-process] tramite ex:", msg);
    await supabase.from("contact_center_assistant_sessions")
      .update({ tramite_creation_error: msg }).eq("id", session.id);
    return { ticket_id: null, error: msg, folio: null };
  }
}

async function sendHandoffNotification(
  supabase: ReturnType<typeof createClient>,
  ticketId: string,
  folio: string,
  responsible: ResponsibleEmployee | null,
  activatedBy: string | null,
  assistantName: string,
  capturedData: CapturedField[],
  pendingRequired: AssistantField[],
  contactName: string | null,
  contactPhone: string | null
): Promise<void> {
  const recipientId = responsible?.id || activatedBy;
  if (!recipientId) return;

  try {
    const captured = capturedData.filter(d => d.value_text && d.status !== "skipped");
    const datosCapturados = captured.map(d => `• ${d.field_label}: ${d.value_text}`).join("\n") || "(ninguno)";
    const datosPendientes = pendingRequired.length > 0
      ? pendingRequired.map(f => `• ${f.label}`).join("\n")
      : "(ninguno)";
    const tramiteUrl = `/tramites/${ticketId}`;

    await supabase.from("notificaciones").insert({
      usuario_id: recipientId,
      tipo: "tramite",
      titulo: `Nuevo trámite desde Agente Automático: #${folio}`,
      mensaje: [
        `Formulario: ${assistantName}`,
        `Contacto: ${contactName || "?"} (${contactPhone || "?"})`,
        `\nDatos capturados:\n${datosCapturados}`,
        datosPendientes !== "(ninguno)" ? `\nDatos pendientes:\n${datosPendientes}` : null,
        `\nTrámite: ${BASE_APP_URL}${tramiteUrl}`,
      ].filter(Boolean).join("\n"),
      url: tramiteUrl,
      leida: false,
    });
  } catch (err) {
    console.error("[cc-process] handoff notification error:", err);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
    const body = await req.json();
    const { action } = body;

    // ── START SESSION ─────────────────────────────────────────────────────────
    if (action === "start_session") {
      const { agent_user_id, assistant_id } = body;
      if (!agent_user_id || !assistant_id) return jsonResponse(400, { error: "agent_user_id and assistant_id required" });

      const { data: existing } = await supabase.from("contact_center_assistant_sessions")
        .select("id, status").eq("agent_user_id", agent_user_id).in("status", ["active", "paused"]).maybeSingle();
      if (existing) return jsonResponse(409, { error: "Ya existe una sesión activa", session_id: existing.id });

      const { data: assistant } = await supabase.from("contact_center_assistants")
        .select("*, contact_center_assistant_fields(*)").eq("id", assistant_id).eq("is_active", true).maybeSingle();
      if (!assistant) return jsonResponse(404, { error: "Asistente no encontrado o inactivo" });

      // Get contact info from recent messages
      const { data: lastMsg } = await supabase.from("contact_center_messages")
        .select("contact_phone, contact_name").eq("agent_user_id", agent_user_id)
        .not("contact_phone", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();

      const contactPhone = lastMsg?.contact_phone || null;
      const contactName = lastMsg?.contact_name || null;

      const authHeader = req.headers.get("Authorization") || "";
      const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

      // Resolve responsible employee before creating session
      const responsible = await resolveResponsibleEmployee(
        supabase,
        agent_user_id,
        authUser?.id || null,
        (assistant as any).tramite_assigned_to_user_id || null,
        assistant.office_id || null
      );

      // Determine if this assistant has an online form option
      const formTypeSlug: string | null = (assistant as any).form_type_slug || null;
      const hasOnlineForm = !!formTypeSlug;

      // Initial stage: if assistant has form_type_slug, start with entry_choice
      const initialStage = hasOnlineForm ? "entry_choice" : (assistant.consent_message ? "consent" : "capturing");

      const { data: session, error: sessionErr } = await supabase.from("contact_center_assistant_sessions")
        .insert({
          assistant_id, agent_user_id,
          activated_by: authUser?.id || null,
          status: "active",
          current_stage: initialStage,
          current_field_index: 0,
          contact_phone_prefilled: contactPhone,
          contact_name_prefilled: contactName,
          conversation_context: {},
          responsible_employee_id: responsible?.id || null,
          responsible_employee_name: responsible?.name || null,
          responsible_role: responsible?.role || null,
          ambiguous_entry_attempts: 0,
        }).select().single();
      if (sessionErr) return jsonResponse(500, { error: sessionErr.message });

      // Pre-fill contact fields
      const fields: AssistantField[] = assistant.contact_center_assistant_fields || [];
      const prefills: unknown[] = [];
      for (const f of fields) {
        if (isContactField(f.field_key) && f.skip_if_contact_has === "contact_phone" && contactPhone) {
          prefills.push({ session_id: session.id, field_id: f.id, field_key: f.field_key, field_label: f.label, value_text: contactPhone, confidence_score: 1.0, source: "whatsapp_contact", status: "prefilled", requires_human_review: false, confirmed_by_user: true, failed_attempts: 0 });
        }
        if (isContactField(f.field_key) && f.skip_if_contact_has === "contact_name" && contactName) {
          prefills.push({ session_id: session.id, field_id: f.id, field_key: f.field_key, field_label: f.label, value_text: contactName, confidence_score: 1.0, source: "whatsapp_contact", status: "prefilled", requires_human_review: false, confirmed_by_user: true, failed_attempts: 0 });
        }
      }
      if (prefills.length) await supabase.from("contact_center_assistant_session_data").insert(prefills);

      await supabase.from("contact_center_conversation_modes").upsert({
        agent_user_id, mode: "automatic", active_session_id: session.id,
        assigned_assistant_id: assistant_id, updated_by: authUser?.id || null, updated_at: new Date().toISOString(),
      }, { onConflict: "agent_user_id" });

      await supabase.from("contact_center_assistant_events").insert({
        session_id: session.id, event_type: "session_started", actor_type: "operator",
        actor_id: authUser?.id || null, message: `Sesión: ${assistant.nombre}`,
        metadata: { has_online_form: hasOnlineForm, form_type_slug: formTypeSlug, responsible_name: responsible?.name || null },
      });

      // Build welcome message
      let welcomeMsg: string;
      if (hasOnlineForm) {
        // New entry choice message — always shown first when form is available
        welcomeMsg = appendMoviIaSignature(`Hola, puedo ayudarte de dos formas:\n1️⃣ Llenar el formulario en línea\n2️⃣ Responder las preguntas por aquí\n¿Qué prefieres?`);
      } else {
        welcomeMsg = appendMoviIaSignature(assistant.consent_message || assistant.welcome_message ||
          `Hola, soy el asistente de MOVI para *${assistant.nombre}*. ¿Podemos comenzar?`);
      }

      return jsonResponse(200, {
        ok: true,
        session_id: session.id,
        stage: initialStage,
        welcome_message: welcomeMsg,
        assistant_name: assistant.nombre,
        total_fields: fields.length,
        has_online_form: hasOnlineForm,
        form_type_slug: formTypeSlug,
        responsible_name: responsible?.name || null,
        // Quick reply buttons for WhatsApp
        quick_replies: hasOnlineForm ? ["Llenar formulario", "Responder por aquí"] : null,
      });
    }

    // ── PROCESS MESSAGE ───────────────────────────────────────────────────────
    if (action === "process_message") {
      const { session_id, message, message_id } = body;
      if (!session_id || !message) return jsonResponse(400, { error: "session_id and message required" });

      const { data: session } = await supabase.from("contact_center_assistant_sessions")
        .select("*, contact_center_assistants(*)").eq("id", session_id).maybeSingle();
      if (!session) return jsonResponse(404, { error: "Sesión no encontrada" });
      if (session.status !== "active") return jsonResponse(400, { error: `Sesión en estado: ${session.status}` });

      const assistant = session.contact_center_assistants;
      const maxRetries: number = assistant.max_retries_per_field ?? 2;
      const allowIncomplete: boolean = assistant.allow_incomplete_submission ?? true;
      const skipContactFields: boolean = assistant.skip_contact_fields ?? true;
      const blockSize: number = (assistant as any).question_block_size ?? 2;
      const mentionResponsible: boolean = (assistant as any).mention_responsible_name !== false;
      const contactPhone: string | null = session.contact_phone_prefilled || null;
      const contactName: string | null = session.contact_name_prefilled || null;
      const responsibleName: string | null = (session as any).responsible_employee_name || null;

      const { data: fieldsRaw } = await supabase.from("contact_center_assistant_fields")
        .select("*").eq("assistant_id", assistant.id).order("capture_order");
      const fields: AssistantField[] = (fieldsRaw || []).map(f => ({ ...f, synonyms: Array.isArray(f.synonyms) ? f.synonyms : [], priority: f.priority || "recommended" }));

      const { data: capturedRaw } = await supabase.from("contact_center_assistant_session_data")
        .select("*").eq("session_id", session_id);
      const capturedData: CapturedField[] = capturedRaw || [];
      const capturedKeys = new Set(capturedData.map(d => d.field_key));

      // Fields to skip: contact fields already known or prefilled
      const skipKeys = new Set<string>();
      if (skipContactFields) {
        for (const f of fields) {
          if (isContactField(f.field_key) && ((f.skip_if_contact_has === "contact_phone" && contactPhone) || (f.skip_if_contact_has === "contact_name" && contactName))) {
            skipKeys.add(f.field_key);
          }
        }
      }

      const requiredFields = fields.filter(f => f.priority === "required" && !skipKeys.has(f.field_key));
      const allAskable = fields.filter(f => !skipKeys.has(f.field_key) && f.field_type !== "file");
      const allPending = allAskable.filter(f => !capturedKeys.has(f.field_key));
      const currentField = allPending[0] || null;
      const currentCaptured = currentField ? capturedData.find(d => d.field_key === currentField.field_key) : null;
      const failedAttempts = currentCaptured?.failed_attempts || 0;

      let responseMessage = "";
      let newStage = session.current_stage;
      let sessionEnded = false;

      // ── ENTRY CHOICE ──────────────────────────────────────────────────────────
      if (session.current_stage === "entry_choice") {
        const lower = message.toLowerCase().trim();
        const formTypeSlug: string | null = (assistant as any).form_type_slug || null;

        // Detect "online form" intent
        const formKeywords = [
          "formulario", "form", "link", "enlace", "en línea", "en linea",
          "llenar", "llenarlo", "llenar formulario", "mándame", "mandame",
          "manda", "el link", "el formato", "formato", "opción 1", "opcion 1",
        ];
        const wantsForm = formKeywords.some(kw => lower.includes(kw)) || lower === "1";

        // Detect "guided questions" intent
        const questionKeywords = [
          "preguntas", "por aquí", "por aqui", "whatsapp", "responder",
          "vamos por aquí", "vamos por aqui", "aquí", "aqui",
          "opción 2", "opcion 2", "por aquí mismo", "por chat",
        ];
        const wantsQuestions = questionKeywords.some(kw => lower.includes(kw)) || lower === "2" || lower === "dale";

        if (wantsForm && formTypeSlug) {
          // ── PATH A: ONLINE FORM ──
          // Look up the agent's personalized shared link for this form type
          let formLink = "";
          const { data: sharedLink } = await supabase
            .from("shared_quote_form_links")
            .select("slug, public_url")
            .eq("agent_id", session.agent_user_id)
            .eq("form_type", formTypeSlug)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sharedLink?.public_url) {
            formLink = sharedLink.public_url;
          } else if (sharedLink?.slug) {
            formLink = `https://agentedeseguros.website/cotizar/${sharedLink.slug}`;
          } else {
            // Fallback: use the internal route (better than nothing)
            formLink = `${BASE_APP_URL}/tramites/formularios/nuevo/${formTypeSlug}`;
          }
          const displayName = responsibleName || "nuestro equipo";

          // Mark session as form_link_sent and deactivate auto mode
          await supabase.from("contact_center_assistant_sessions").update({
            entry_choice: "online_form",
            form_link_sent_at: new Date().toISOString(),
            status: "completed",
            current_stage: "completion",
            completed_at: new Date().toISOString(),
          }).eq("id", session_id);

          await supabase.from("contact_center_conversation_modes").upsert({
            agent_user_id: session.agent_user_id,
            mode: "normal",
            active_session_id: null,
            assigned_assistant_id: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "agent_user_id" });

          await supabase.from("contact_center_assistant_events").insert([
            {
              session_id, event_type: "entry_choice_selected", actor_type: "contact",
              message: "Eligió formulario en línea",
              metadata: { form_type_slug: formTypeSlug, form_link: formLink },
            },
            {
              session_id, event_type: "form_link_sent", actor_type: "system",
              message: `Link enviado: ${formLink}`,
              metadata: { form_type_slug: formTypeSlug },
            },
            {
              session_id, event_type: "session_completed", actor_type: "system",
              message: "Modo automático desactivado — eligió formulario en línea",
            },
          ]);

          const formMsg = appendMoviIaSignature(`Perfecto, puedes llenar el formulario aquí:\n${formLink}\n\nCuando lo envíes, ${displayName} dará seguimiento a tu solicitud por este medio.`);
          return jsonResponse(200, {
            ok: true,
            stage: "completion",
            response_message: formMsg,
            entry_choice: "online_form",
            form_link: formLink,
            responsible_name: responsibleName,
            session_ended: true,
            deactivate_auto_mode: true,
          });

        } else if (wantsQuestions) {
          // ── PATH B: GUIDED QUESTIONS ──
          const nextStage = assistant.consent_message ? "consent" : "capturing";

          await supabase.from("contact_center_assistant_sessions").update({
            entry_choice: "whatsapp_questions",
            guided_questions_started_at: new Date().toISOString(),
            current_stage: nextStage,
          }).eq("id", session_id);

          await supabase.from("contact_center_assistant_events").insert({
            session_id, event_type: "entry_choice_selected", actor_type: "contact",
            message: "Eligió responder preguntas por WhatsApp",
          });

          // Send the first question or consent
          const freshAllPending = allAskable.filter(f => !capturedKeys.has(f.field_key));
          if (nextStage === "consent") {
            responseMessage = appendMoviIaSignature(assistant.consent_message!);
          } else if (freshAllPending.length === 0) {
            newStage = "summary";
            responseMessage = appendMoviIaSignature(`Tengo esto:\n${buildSummary(capturedData)}\n\n¿Lo registro así?`);
          } else {
            responseMessage = appendMoviIaSignature(`Perfecto, lo hacemos por aquí.\n${buildBlockQuestion(freshAllPending, blockSize)}`);
          }
          newStage = nextStage;

        } else {
          // ── AMBIGUOUS ──
          const ambiguousCount = (session.ambiguous_entry_attempts || 0) + 1;
          await supabase.from("contact_center_assistant_sessions").update({
            ambiguous_entry_attempts: ambiguousCount,
          }).eq("id", session_id);

          if (ambiguousCount >= 2) {
            // Default to guided questions after second ambiguous response
            const nextStage = assistant.consent_message ? "consent" : "capturing";
            await supabase.from("contact_center_assistant_sessions").update({
              entry_choice: "whatsapp_questions_default_after_ambiguous",
              guided_questions_started_at: new Date().toISOString(),
              current_stage: nextStage,
            }).eq("id", session_id);

            await supabase.from("contact_center_assistant_events").insert({
              session_id, event_type: "entry_choice_selected", actor_type: "system",
              message: "Preguntas por defecto tras respuesta ambigua",
            });

            const freshAllPending = allAskable.filter(f => !capturedKeys.has(f.field_key));
            if (nextStage === "consent") {
              responseMessage = appendMoviIaSignature(assistant.consent_message!);
            } else if (freshAllPending.length === 0) {
              newStage = "summary";
              responseMessage = appendMoviIaSignature(`Tengo esto:\n${buildSummary(capturedData)}\n\n¿Lo registro así?`);
            } else {
              responseMessage = appendMoviIaSignature(`Perfecto, lo hacemos por aquí.\n${buildBlockQuestion(freshAllPending, blockSize)}`);
            }
            newStage = nextStage;
          } else {
            // Re-ask once
            responseMessage = appendMoviIaSignature(`¿Prefieres llenar el formulario en línea o responder por aquí?\n\n1️⃣ Llenar formulario\n2️⃣ Responder por WhatsApp`);
            newStage = "entry_choice";
          }
        }

        if (responseMessage) {
          await supabase.from("contact_center_assistant_sessions")
            .update({ current_stage: newStage, last_message_at: new Date().toISOString(), messages_received: session.messages_received + 1 }).eq("id", session_id);
          return jsonResponse(200, {
            ok: true, stage: newStage, response_message: responseMessage, session_ended: false,
            quick_replies: newStage === "entry_choice" ? ["Llenar formulario", "Responder por aquí"] : null,
          });
        }
      }

      // ── CONSENT ──
      if (session.current_stage === "consent") {
        const lower = message.toLowerCase().trim();
        const accepted = ["si", "sí", "yes", "acepto", "ok", "de acuerdo", "adelante", "claro", "dale", "bueno"].some(w => lower.includes(w));
        const refused = ["no", "cancelar", "cancel"].some(w => lower === w);

        if (accepted) {
          await supabase.from("contact_center_assistant_sessions")
            .update({ consent_given: true, consent_at: new Date().toISOString() }).eq("id", session_id);
          newStage = "capturing";

          // Also try to extract data from this first message
          const freshPending = allAskable.filter(f => !capturedKeys.has(f.field_key));
          if (freshPending.length === 0) {
            newStage = "summary";
            responseMessage = appendMoviIaSignature(`Tengo esto:\n${buildSummary(capturedData)}\n\n¿Lo registro así?`);
          } else {
            responseMessage = appendMoviIaSignature(buildBlockQuestion(freshPending, blockSize));
          }
        } else if (refused) {
          await supabase.from("contact_center_assistant_sessions").update({ status: "cancelled" }).eq("id", session_id);
          await supabase.from("contact_center_conversation_modes").upsert({ agent_user_id: session.agent_user_id, mode: "normal", active_session_id: null, assigned_assistant_id: null, updated_at: new Date().toISOString() }, { onConflict: "agent_user_id" });
          return jsonResponse(200, { ok: true, stage: "cancelled", response_message: appendMoviIaSignature("Entendido, cancelamos. Un agente puede asistirte."), session_ended: true });
        } else {
          responseMessage = appendMoviIaSignature(assistant.consent_message || "Para continuar, ¿aceptas? (Sí / No)");
        }
      }

      // ── CAPTURING ──
      else if (session.current_stage === "capturing") {
        let extraction: ExtractionResult;
        if (openaiKey && assistant.use_ai_extraction !== false) {
          extraction = await extractWithAI(openaiKey, message, allPending, capturedData, assistant.nombre, contactPhone, contactName, currentField, failedAttempts, session.current_stage);
        } else {
          extraction = ruleBased(message, allPending, capturedData, currentField, failedAttempts);
        }

        // Handle skip
        if (extraction.is_skip_request && currentField) {
          if (!capturedKeys.has(currentField.field_key)) {
            await supabase.from("contact_center_assistant_session_data").insert({
              session_id, field_id: currentField.id, field_key: currentField.field_key, field_label: currentField.label,
              value_text: null, confidence_score: 0, source: "user_skipped", status: "pending",
              requires_human_review: currentField.priority === "required",
              field_notes: extraction.skipped_reason || "No disponible", failed_attempts: 0, confirmed_by_user: false,
            });
            capturedKeys.add(currentField.field_key);
          }
        }

        // Handle correction
        if (extraction.is_correction && extraction.corrected_field) {
          const corrKey = extraction.corrected_field;
          const corrVal = extraction.extracted_fields[corrKey];
          if (corrVal) {
            const existsAlready = capturedData.find(d => d.field_key === corrKey);
            if (existsAlready) {
              await supabase.from("contact_center_assistant_session_data")
                .update({ value_text: corrVal.value, confidence_score: corrVal.confidence, source: "user_correction", requires_human_review: corrVal.confidence < 0.6, field_notes: "Corregido por usuario" })
                .eq("session_id", session_id).eq("field_key", corrKey);
            }
            delete extraction.extracted_fields[corrKey];
          }
        }

        // Save all newly extracted fields
        for (const [fieldKey, ext] of Object.entries(extraction.extracted_fields)) {
          if (capturedKeys.has(fieldKey)) continue;
          const matchedField = fields.find(f => f.field_key === fieldKey);
          if (!matchedField || skipKeys.has(fieldKey)) continue;
          const requiresReview = ext.confidence < 0.6;
          await supabase.from("contact_center_assistant_session_data").insert({
            session_id, field_id: matchedField.id, field_key: fieldKey, field_label: matchedField.label,
            value_text: ext.value, confidence_score: ext.confidence, source: ext.source,
            status: requiresReview ? "low_confidence" : "captured",
            requires_human_review: requiresReview, confirmed_by_user: false, failed_attempts: 0,
          });
          capturedKeys.add(fieldKey);
        }

        const gotSomething = Object.keys(extraction.extracted_fields).length > 0 || extraction.is_skip_request || extraction.is_correction;

        // Handle failed attempts on current field
        if (!gotSomething && currentField && extraction.is_confirmation === null) {
          const newAttempts = failedAttempts + 1;
          if (newAttempts > maxRetries) {
            // Accept as-is
            await supabase.from("contact_center_assistant_session_data").insert({
              session_id, field_id: currentField.id, field_key: currentField.field_key, field_label: currentField.label,
              value_text: message.trim(), confidence_score: 0.4, source: "fallback_after_retry",
              status: "low_confidence", requires_human_review: true,
              field_notes: `Aceptado tras ${newAttempts} intentos`, failed_attempts: newAttempts, confirmed_by_user: false,
            });
            capturedKeys.add(currentField.field_key);
          } else {
            // Retry
            const question = getNextQuestion(currentField, newAttempts);
            await supabase.from("contact_center_assistant_sessions")
              .update({ last_message_at: new Date().toISOString(), messages_received: session.messages_received + 1 }).eq("id", session_id);
            return jsonResponse(200, { ok: true, stage: "capturing", response_message: appendMoviIaSignature(question), session_ended: false });
          }
        }

        // Reload fresh state
        const { data: freshCaptured } = await supabase.from("contact_center_assistant_session_data").select("*").eq("session_id", session_id);
        const freshKeys = new Set((freshCaptured || []).map((d: CapturedField) => d.field_key));

        const pendingRequiredNow = requiredFields.filter(f => !freshKeys.has(f.field_key));
        const stillPending = allAskable.filter(f => !freshKeys.has(f.field_key));

        if (pendingRequiredNow.length === 0) {
          // All required done — ask important optional fields not yet captured, then summary
          const freshCapturedKeys = new Set((freshCaptured || []).map((d: CapturedField) => d.field_key));
          const pendingImportant = fields.filter(f =>
            f.priority === "recommended" &&
            !skipKeys.has(f.field_key) &&
            f.field_type !== "file" &&
            !freshCapturedKeys.has(f.field_key)
          );

          if (pendingImportant.length > 0 && !allowIncomplete) {
            // Ask remaining recommended fields in a block (once, with skip option)
            responseMessage = appendMoviIaSignature(buildOptionalBlockQuestion(pendingImportant, blockSize));
          } else {
            newStage = "summary";
            responseMessage = appendMoviIaSignature(`Tengo esto:\n${buildSummary(freshCaptured || [])}\n\n¿Lo registro así?`);
          }
        } else {
          responseMessage = appendMoviIaSignature(buildBlockQuestion(pendingRequiredNow, blockSize));
        }
      }

      // ── SUMMARY ──
      else if (session.current_stage === "summary") {
        let extraction: ExtractionResult;
        if (openaiKey) {
          extraction = await extractWithAI(openaiKey, message, [], capturedData, assistant.nombre, contactPhone, contactName, null, 0, "summary");
        } else {
          extraction = ruleBased(message, [], capturedData, null, 0);
        }

        if (extraction.is_confirmation === true) {
          const { data: freshCaptured } = await supabase.from("contact_center_assistant_session_data").select("*").eq("session_id", session_id);
          const freshData: CapturedField[] = freshCaptured || [];
          const pendingReqNow = requiredFields.filter(f => !freshData.find((d: CapturedField) => d.field_key === f.field_key && d.value_text));

          let ticketId: string | null = null;
          let folio: string | null = null;
          let creationError: string | null = null;

          if (assistant.auto_create_tramite) {
            // Build idempotency key: session_id + assistant_id + message_id(if any)
            const idempKey = `${session_id}:${assistant.id}:${body.message_id || "confirm"}`;
            const result = await createTramite(
              supabase,
              {
                id: session_id,
                agent_user_id: session.agent_user_id,
                activated_by: session.activated_by || null,
                contact_phone_prefilled: session.contact_phone_prefilled || null,
                contact_name_prefilled: session.contact_name_prefilled || null,
              },
              {
                id: assistant.id,
                nombre: assistant.nombre,
                tramite_tipo: assistant.tramite_tipo || null,
                tramite_prioridad: assistant.tramite_prioridad || null,
                tramite_assigned_to_user_id: (assistant as any).tramite_assigned_to_user_id || null,
                tramite_estatus_slug: (assistant as any).tramite_estatus_slug || "Iniciado",
                office_id: assistant.office_id || null,
                form_title: assistant.form_title || null,
                handoff_after_creation: (assistant as any).handoff_after_creation ?? true,
              },
              freshData,
              pendingReqNow,
              idempKey,
              body.message_id || null
            );
            ticketId = result.ticket_id;
            folio = result.folio;
            creationError = result.error;
          }

          // If tramite creation failed, do NOT deactivate auto-mode yet
          if (assistant.auto_create_tramite && !ticketId) {
            await supabase.from("contact_center_assistant_sessions")
              .update({ last_message_at: new Date().toISOString() }).eq("id", session_id);
            await supabase.from("contact_center_assistant_events").insert({
              session_id, event_type: "tramite_creation_failed", actor_type: "system",
              message: creationError || "Error desconocido",
            });
            // Resolve responsible to give a named fallback message
            const errResponsible = await resolveResponsibleEmployee(
              supabase,
              session.agent_user_id,
              session.activated_by || null,
              (assistant as any).tramite_assigned_to_user_id || null,
              assistant.office_id || null
            );
            const errRespName = errResponsible?.name || responsibleName;
            const errorMsg = appendMoviIaSignature(errRespName
              ? `Tuve un problema al registrar tu solicitud. ${errRespName} te dará seguimiento por este medio.`
              : "Tuve un problema al registrar tu solicitud. El equipo de atención te dará seguimiento por este medio.");
            return jsonResponse(200, { ok: true, stage: "error", response_message: errorMsg, ticket_id: null, session_ended: false, error: creationError });
          }

          // Success — deactivate auto mode and send handoff
          await supabase.from("contact_center_assistant_sessions")
            .update({ status: "completed", current_stage: "completion", ticket_id: ticketId, completed_at: new Date().toISOString() }).eq("id", session_id);
          await supabase.from("contact_center_conversation_modes")
            .upsert({ agent_user_id: session.agent_user_id, mode: "normal", active_session_id: null, assigned_assistant_id: null, updated_at: new Date().toISOString() }, { onConflict: "agent_user_id" });
          await supabase.from("contact_center_assistant_events").insert({
            session_id, event_type: "session_completed", actor_type: "system",
            message: ticketId ? `Trámite: ${folio || ticketId}` : "Completado sin trámite",
            metadata: { ticket_id: ticketId, folio },
          });

          // Resolve responsible employee for reply message and handoff
          const responsible = await resolveResponsibleEmployee(
            supabase,
            session.agent_user_id,
            session.activated_by || null,
            (assistant as any).tramite_assigned_to_user_id || null,
            assistant.office_id || null
          );
          const respName = responsible?.name || responsibleName;

          // Send handoff notification to responsible employee
          if (ticketId && (assistant as any).handoff_after_creation !== false) {
            EdgeRuntime.waitUntil(
              sendHandoffNotification(
                supabase, ticketId, folio || ticketId,
                responsible, session.activated_by || null,
                assistant.form_title || assistant.nombre,
                freshData, pendingReqNow,
                session.contact_name_prefilled || null,
                session.contact_phone_prefilled || null
              )
            );
          }

          // Build reply message with direct link to tramite and responsible name
          let replyMsg: string;
          const displayName = respName || "nuestro equipo";
          const followupLine = mentionResponsible
            ? `${displayName} revisará la información y te dará seguimiento por este medio.`
            : "El equipo de atención te dará seguimiento por este medio.";

          if (ticketId) {
            const tramiteLink = `${BASE_APP_URL}/tramites/${ticketId}`;
            if (assistant.completion_message && !assistant.completion_message.includes("app.movi.digital")) {
              // Replace variables in custom message
              replyMsg = assistant.completion_message
                .replace(/\{\{nombre_responsable\}\}/g, displayName)
                .replace(/\{\{responsable_nombre\}\}/g, displayName)
                .replace(/\{\{empleado_responsable\}\}/g, displayName)
                .replace(/\{\{link_tramite\}\}/g, tramiteLink);
              if (!replyMsg.includes("tramites/")) {
                replyMsg += `\n\nPuedes consultar tu trámite aquí:\n${tramiteLink}`;
              }
            } else {
              replyMsg = `Listo, ya registré tu solicitud.\n${followupLine}\n\nPuedes consultar tu trámite aquí:\n${tramiteLink}`;
            }
          } else {
            const base = assistant.completion_message || "Listo, ya registré tu solicitud.";
            replyMsg = base
              .replace(/\{\{nombre_responsable\}\}/g, respName || "")
              .replace(/\{\{responsable_nombre\}\}/g, respName || "")
              .replace(/\{\{empleado_responsable\}\}/g, respName || "");
            replyMsg += `\n${followupLine}`;
          }

          return jsonResponse(200, { ok: true, stage: "completion", response_message: appendMoviIaSignature(replyMsg), ticket_id: ticketId, folio, responsible_name: respName, session_ended: true });

        } else if (extraction.is_confirmation === false) {
          await supabase.from("contact_center_assistant_session_data")
            .delete().eq("session_id", session_id)
            .not("source", "eq", "whatsapp_contact").not("source", "eq", "prefilled");
          newStage = "capturing";
          const first = allAskable[0];
          responseMessage = appendMoviIaSignature(first ? (first.prompt_text || `¿${first.label}?`) : "Dime qué quieres corregir.");
        } else {
          responseMessage = appendMoviIaSignature(`${buildSummary(capturedData)}\n\n¿Lo registro así?`);
        }
      }

      // Persist stage update
      await supabase.from("contact_center_assistant_sessions")
        .update({ current_stage: newStage, last_message_at: new Date().toISOString(), messages_received: session.messages_received + 1 }).eq("id", session_id);
      await supabase.from("contact_center_assistant_events").insert({
        session_id, event_type: "message_received", actor_type: "contact",
        message: message.substring(0, 200), metadata: { message_id: message_id || null },
      });

      const { data: cnt } = await supabase.from("contact_center_assistant_session_data").select("field_key").eq("session_id", session_id);
      return jsonResponse(200, { ok: true, stage: newStage, response_message: responseMessage, progress: { captured: cnt?.length || 0, total: fields.length }, session_ended: sessionEnded });
    }

    // ── GET SESSION STATE ─────────────────────────────────────────────────────
    if (action === "get_session_state") {
      const { agent_user_id } = body;
      if (!agent_user_id) return jsonResponse(400, { error: "agent_user_id required" });
      const { data: mode } = await supabase.from("contact_center_conversation_modes")
        .select(`*, contact_center_assistant_sessions!active_session_id(id,status,current_stage,consent_given,started_at,messages_received,contact_phone_prefilled,contact_name_prefilled,ticket_id,tramite_creation_error,contact_center_assistants(id,nombre,model),contact_center_assistant_session_data(field_key,field_label,value_text,confidence_score,status,requires_human_review,contact_center_assistant_fields(priority,label)))`)
        .eq("agent_user_id", agent_user_id).maybeSingle();
      if (!mode) return jsonResponse(200, { mode: "normal", active_session: null });
      return jsonResponse(200, { mode: mode.mode, assigned_assistant_id: mode.assigned_assistant_id, active_session: mode.contact_center_assistant_sessions || null });
    }

    if (action === "pause_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });
      await supabase.from("contact_center_assistant_sessions").update({ status: "paused" }).eq("id", session_id).in("status", ["active"]);
      await supabase.from("contact_center_assistant_events").insert({ session_id, event_type: "session_paused", actor_type: "operator" });
      return jsonResponse(200, { ok: true, status: "paused" });
    }

    if (action === "resume_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });
      await supabase.from("contact_center_assistant_sessions").update({ status: "active" }).eq("id", session_id).in("status", ["paused"]);
      await supabase.from("contact_center_assistant_events").insert({ session_id, event_type: "session_resumed", actor_type: "operator" });
      return jsonResponse(200, { ok: true, status: "active" });
    }

    if (action === "transfer") {
      const { session_id, transfer_reason, transfer_to } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });
      const { data: s } = await supabase.from("contact_center_assistant_sessions").select("agent_user_id, contact_center_assistants(transfer_message)").eq("id", session_id).maybeSingle();
      await supabase.from("contact_center_assistant_sessions").update({ status: "transferred", transferred_to: transfer_to || null, transfer_reason: transfer_reason || "Transferido" }).eq("id", session_id);
      await supabase.from("contact_center_assistant_events").insert({ session_id, event_type: "session_transferred", actor_type: "operator", message: transfer_reason || null, metadata: { transfer_to } });
      if (s?.agent_user_id) await supabase.from("contact_center_conversation_modes").upsert({ agent_user_id: s.agent_user_id, mode: "normal", active_session_id: null, assigned_assistant_id: null, updated_at: new Date().toISOString() }, { onConflict: "agent_user_id" });
      const msg = appendMoviIaSignature((s?.contact_center_assistants as { transfer_message?: string })?.transfer_message || "Un agente continuará atendiéndote. ¡Gracias!");
      return jsonResponse(200, { ok: true, status: "transferred", transfer_message: msg });
    }

    if (action === "cancel_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });
      const { data: s } = await supabase.from("contact_center_assistant_sessions").select("agent_user_id").eq("id", session_id).maybeSingle();
      await supabase.from("contact_center_assistant_sessions").update({ status: "cancelled" }).eq("id", session_id);
      await supabase.from("contact_center_assistant_events").insert({ session_id, event_type: "session_cancelled", actor_type: "operator" });
      if (s?.agent_user_id) await supabase.from("contact_center_conversation_modes").upsert({ agent_user_id: s.agent_user_id, mode: "normal", active_session_id: null, assigned_assistant_id: null, updated_at: new Date().toISOString() }, { onConflict: "agent_user_id" });
      return jsonResponse(200, { ok: true, status: "cancelled" });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });

  } catch (err) {
    console.error("[cc-assistant-process] error:", err);
    return jsonResponse(500, { error: String(err) });
  }
});
