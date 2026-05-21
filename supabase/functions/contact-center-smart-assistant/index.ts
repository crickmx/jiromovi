import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_APP_URL = "https://app.movi.digital";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MOVI_IA_SIGNATURE = "- 🤖 MOVI IA";
const SIGNATURE_VARIANTS = [MOVI_IA_SIGNATURE, "🤖 MOVI IA", "- MOVI IA", "MOVI IA"];

function appendMoviIaSignature(message: string): string {
  if (!message?.trim()) return message;
  const clean = message.trim();
  if (SIGNATURE_VARIANTS.some(v => clean.endsWith(v))) return clean;
  return `${clean}\n\n${MOVI_IA_SIGNATURE}`;
}

// ── Intent detection ──────────────────────────────────────────────────────────

interface IntentMatch {
  intent: string;
  confidence: number;
  form_type_slug: string;
  assistant_id?: string;
}

interface AnalysisResult {
  should_act: boolean;
  action: "activate_automatic_agent" | "suggest_internal_actions" | "stop_assistant" | "pause_assistant" | "none";
  intent?: string;
  confidence: number;
  matched_assistant_id?: string;
  matched_form_slug?: string;
  reason: string;
  requires_internal_confirmation: boolean;
  suggested_actions?: Array<{ label: string; assistant_id?: string; form_slug?: string; action?: string }>;
  stop_message?: string;
}

const STOP_PHRASES_CONTACT = [
  "quiero hablar con", "me atiende alguien", "no quiero bot", "detén el bot", "detener bot",
  "quiero un ejecutivo", "prefiero hablar con", "quiero un asesor", "hablar con persona",
  "ya no quiero responder", "quiero una persona", "pon a alguien", "comunícame con",
  "comunícame", "agente humano", "persona real",
];

const STOP_PHRASES_OPERATOR = [
  "yo lo atiendo", "detener asistente", "pausar asistente", "desactivar asistente",
  "deja de responder", "para el bot", "detén el asistente",
];

const SOCIAL_PHRASES = [
  "gracias", "ok", "va", "perfecto", "listo", "claro", "de acuerdo", "entendido",
  "hola", "buenos días", "buenas tardes", "buenas noches", "hasta luego", "bye",
  "adiós", "adios", "saludos",
];

const COTIZACION_TRIGGERS = [
  "quiero cotizar", "me cotizas", "necesito cotización", "necesito cotizacion",
  "quiero asegurar", "busco seguro", "me ayudas con un seguro", "necesito una póliza",
  "necesito una poliza", "quiero renovar", "quiero contratar", "cuánto cuesta asegurar",
  "cuanto cuesta asegurar", "quiero un seguro", "necesito seguro", "cotización",
  "cotizacion", "quiero saber el precio", "precio de seguro", "quiero una fianza",
  "quiero reportar",
];

// Keyword → intent map with confidence boost keywords
const INTENT_MAP: Array<{
  intent: string;
  form_type_slug: string;
  keywords: string[];
  boost_keywords: string[];
}> = [
  {
    intent: "cotizacion_auto",
    form_type_slug: "auto_alta_gama",
    keywords: ["auto", "coche", "carro", "vehículo", "vehiculo", "automóvil", "automovil", "moto", "motocicleta", "autos"],
    boost_keywords: ["seguro de auto", "cotizar auto", "asegurar carro", "cotizar coche"],
  },
  {
    intent: "gmm_individual",
    form_type_slug: "gmm_individual",
    keywords: ["gastos médicos", "gastos medicos", "gmm", "salud", "médico", "medico", "hospital", "enfermedades", "médica", "medica"],
    boost_keywords: ["seguro de salud", "gastos médicos mayores", "gmm individual", "seguro médico"],
  },
  {
    intent: "hogar",
    form_type_slug: "hogar_casa_habitacion",
    keywords: ["casa", "hogar", "habitación", "habitacion", "departamento", "vivienda", "inmueble", "propiedad"],
    boost_keywords: ["seguro de casa", "asegurar casa", "seguro hogar", "seguro para mi casa"],
  },
  {
    intent: "empresarial",
    form_type_slug: "empresa_paquete",
    keywords: ["empresa", "negocio", "comercio", "pyme", "compañía", "compania", "local", "tienda", "oficina"],
    boost_keywords: ["seguro empresarial", "seguro para mi negocio", "pyme", "asegurar empresa"],
  },
  {
    intent: "transporte_carga",
    form_type_slug: "transporte_carga",
    keywords: ["transporte", "carga", "mercancía", "mercancia", "flete", "camión", "camion", "traslado", "envío", "envio"],
    boost_keywords: ["seguro de carga", "seguro transporte", "asegurar mercancía"],
  },
  {
    intent: "rc_general",
    form_type_slug: "rc_general",
    keywords: ["responsabilidad civil", "rc", "daños a terceros", "danos a terceros", "terceros"],
    boost_keywords: ["responsabilidad civil", "seguro de rc"],
  },
];

function detectIntent(text: string): IntentMatch | null {
  const lower = text.toLowerCase();

  // Check if it even mentions insurance/quote at all
  const hasCotizacionTrigger = COTIZACION_TRIGGERS.some(t => lower.includes(t));
  if (!hasCotizacionTrigger) return null;

  let bestMatch: IntentMatch | null = null;

  for (const entry of INTENT_MAP) {
    let score = 0;

    // Check boost keywords first (high confidence match)
    const boostHit = entry.boost_keywords.some(kw => lower.includes(kw));
    if (boostHit) score += 0.55;

    // Check regular keywords
    const keywordHits = entry.keywords.filter(kw => lower.includes(kw)).length;
    score += keywordHits * 0.15;

    // Normalize to 0-1
    const confidence = Math.min(score, 1.0);

    if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { intent: entry.intent, confidence, form_type_slug: entry.form_type_slug };
    }
  }

  return bestMatch;
}

function detectStopRequest(text: string, actor: "contact" | "operator"): boolean {
  const lower = text.toLowerCase();
  const phrases = actor === "contact" ? STOP_PHRASES_CONTACT : STOP_PHRASES_OPERATOR;
  return phrases.some(p => lower.includes(p));
}

function isSocialMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SOCIAL_PHRASES.some(p => lower === p || lower.startsWith(p + " ") || lower.endsWith(" " + p));
}

// ── Resolve responsible employee ─────────────────────────────────────────────

async function resolveResponsibleEmployee(
  supabase: ReturnType<typeof createClient>,
  agentUserId: string,
  activatedBy: string | null,
  officeId: string | null
): Promise<{ id: string; name: string; role: string } | null> {
  const buildName = (data: Record<string, unknown>) =>
    ((data.nombre_publico as string)?.trim() ||
      (data.nombre_completo as string)?.trim() ||
      [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") ||
      "tu asesor");

  if (activatedBy) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
      .eq("id", activatedBy).maybeSingle();
    if (data) return { id: data.id, name: buildName(data as Record<string, unknown>), role: data.rol || "Empleado" };
  }

  if (agentUserId) {
    const { data } = await supabase.from("usuarios")
      .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol, oficina_id")
      .eq("id", agentUserId).maybeSingle();
    if (data) {
      const resolvedOfficeId = officeId || (data.oficina_id as string) || null;
      // Prefer the gerente of the office
      if (resolvedOfficeId) {
        const { data: gerente } = await supabase.from("usuarios")
          .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
          .eq("oficina_id", resolvedOfficeId)
          .in("rol", ["Gerente", "Administrador"])
          .eq("estado", "activo")
          .limit(1).maybeSingle();
        if (gerente) return { id: gerente.id, name: buildName(gerente as Record<string, unknown>), role: gerente.rol };
      }
      return { id: data.id, name: buildName(data as Record<string, unknown>), role: data.rol || "Empleado" };
    }
  }

  // Last resort: any active admin
  const { data } = await supabase.from("usuarios")
    .select("id, nombre_publico, nombre_completo, nombre, apellido_paterno, apellido_materno, rol")
    .in("rol", ["Administrador", "Gerente"])
    .eq("estado", "activo")
    .limit(1).maybeSingle();
  if (data) return { id: data.id, name: buildName(data as Record<string, unknown>), role: data.rol };

  return null;
}

// ── Main analysis function ────────────────────────────────────────────────────

async function analyzeConversation(
  supabase: ReturnType<typeof createClient>,
  agentUserId: string,
  recentMessages: Array<{ text: string; sender_type: string; created_at: string; id?: string }>,
  settings: { auto_activate_threshold: number; suggest_threshold: number },
  hasActiveSession: boolean,
  lastProcessedMessageId: string | null
): Promise<AnalysisResult> {
  // Don't act if there's already an automatic session active
  if (hasActiveSession) {
    return { should_act: false, action: "none", confidence: 0, reason: "Agente automático ya activo", requires_internal_confirmation: false };
  }

  // Filter to recent contact messages (last 5 minutes or last 3 messages)
  const contactMessages = recentMessages.filter(m => m.sender_type === "contact").slice(-5);
  const operatorMessages = recentMessages.filter(m => m.sender_type === "operator").slice(-3);

  if (contactMessages.length === 0) {
    return { should_act: false, action: "none", confidence: 0, reason: "No hay mensajes del contacto", requires_internal_confirmation: false };
  }

  const latestContact = contactMessages[contactMessages.length - 1];

  // Skip if already processed
  if (lastProcessedMessageId && latestContact.id === lastProcessedMessageId) {
    return { should_act: false, action: "none", confidence: 0, reason: "Mensaje ya procesado", requires_internal_confirmation: false };
  }

  // Check if contact is requesting a human
  if (detectStopRequest(latestContact.text, "contact")) {
    return {
      should_act: true,
      action: "stop_assistant",
      confidence: 0.99,
      reason: "El contacto solicitó atención humana",
      requires_internal_confirmation: false,
    };
  }

  // Check if operator is requesting stop
  const latestOperator = operatorMessages[operatorMessages.length - 1];
  if (latestOperator && detectStopRequest(latestOperator.text, "operator")) {
    return {
      should_act: true,
      action: "pause_assistant",
      confidence: 0.99,
      reason: "El usuario interno solicitó detener el asistente",
      requires_internal_confirmation: false,
    };
  }

  // Check if operator sent a message recently (human intervention)
  if (operatorMessages.length > 0) {
    const lastOpTime = new Date(operatorMessages[operatorMessages.length - 1].created_at).getTime();
    const lastContactTime = new Date(latestContact.created_at).getTime();
    if (lastOpTime > lastContactTime - 60000) {
      // Operator messaged after (or very close to) contact — human in control
      return {
        should_act: true,
        action: "pause_assistant",
        confidence: 0.9,
        reason: "Usuario interno envió mensaje manualmente",
        requires_internal_confirmation: false,
      };
    }
  }

  // Skip social messages
  if (isSocialMessage(latestContact.text)) {
    return { should_act: false, action: "none", confidence: 0.1, reason: "Mensaje social sin intención operativa", requires_internal_confirmation: false };
  }

  // Analyze intent from the full recent contact text context
  const contextText = contactMessages.map(m => m.text).join(" ");
  const match = detectIntent(contextText);

  if (!match) {
    return { should_act: false, action: "none", confidence: 0, reason: "No se detectó intención de seguro/trámite", requires_internal_confirmation: false };
  }

  // Look up matching assistant
  const { data: assistants } = await supabase.from("contact_center_assistants")
    .select("id, nombre, form_type_slug")
    .eq("is_active", true)
    .eq("form_type_slug", match.form_type_slug)
    .limit(1);

  const matchedAssistant = assistants && assistants.length > 0 ? assistants[0] : null;

  if (match.confidence >= settings.auto_activate_threshold && matchedAssistant) {
    return {
      should_act: true,
      action: "activate_automatic_agent",
      intent: match.intent,
      confidence: match.confidence,
      matched_assistant_id: matchedAssistant.id,
      matched_form_slug: match.form_type_slug,
      reason: `Detecté con alta confianza: ${match.intent} (${Math.round(match.confidence * 100)}%)`,
      requires_internal_confirmation: false,
    };
  }

  if (match.confidence >= settings.suggest_threshold) {
    // Build suggestions from multiple possible intents
    const suggestions: Array<{ label: string; assistant_id?: string; form_slug?: string; action?: string }> = [];
    for (const entry of INTENT_MAP) {
      const entryText = contextText.toLowerCase();
      const hasKeyword = entry.keywords.some(k => entryText.includes(k));
      if (!hasKeyword) continue;

      const { data: entryAssistants } = await supabase.from("contact_center_assistants")
        .select("id, nombre").eq("is_active", true).eq("form_type_slug", entry.form_type_slug).limit(1);
      const entryAssistant = entryAssistants && entryAssistants.length > 0 ? entryAssistants[0] : null;
      if (entryAssistant) {
        suggestions.push({ label: entryAssistant.nombre, assistant_id: entryAssistant.id, form_slug: entry.form_type_slug });
      }
    }

    if (suggestions.length === 0 && matchedAssistant) {
      suggestions.push({ label: matchedAssistant.nombre, assistant_id: matchedAssistant.id, form_slug: match.form_type_slug });
    }
    suggestions.push({ label: "Crear trámite manual", action: "create_manual_task" });
    suggestions.push({ label: "Ignorar", action: "dismiss" });

    return {
      should_act: true,
      action: "suggest_internal_actions",
      intent: match.intent,
      confidence: match.confidence,
      reason: `Posible solicitud de ${match.intent} (${Math.round(match.confidence * 100)}% confianza)`,
      requires_internal_confirmation: true,
      suggested_actions: suggestions.slice(0, 5),
    };
  }

  return {
    should_act: false,
    action: "none",
    confidence: match.confidence,
    reason: `Confianza insuficiente para actuar (${Math.round(match.confidence * 100)}%)`,
    requires_internal_confirmation: false,
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action, agent_user_id } = body;

    if (!agent_user_id) return jsonResponse(400, { error: "agent_user_id required" });

    const authHeader = req.headers.get("Authorization") || "";
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    // ── TOGGLE SMART ASSISTANT ────────────────────────────────────────────────
    if (action === "toggle") {
      const { enabled } = body;
      const now = new Date().toISOString();

      const { data: existing } = await supabase.from("contact_center_smart_assistant_config")
        .select("id").eq("agent_user_id", agent_user_id).maybeSingle();

      if (existing) {
        await supabase.from("contact_center_smart_assistant_config").update({
          smart_assistant_enabled: enabled,
          smart_assistant_status: enabled ? "active" : "inactive",
          paused_until: enabled ? null : undefined,
          pause_reason: enabled ? null : undefined,
          activated_by: enabled ? (authUser?.id || null) : undefined,
          deactivated_by: !enabled ? (authUser?.id || null) : undefined,
          updated_at: now,
        }).eq("agent_user_id", agent_user_id);
      } else {
        await supabase.from("contact_center_smart_assistant_config").insert({
          agent_user_id,
          smart_assistant_enabled: enabled,
          smart_assistant_status: enabled ? "active" : "inactive",
          activated_by: enabled ? (authUser?.id || null) : null,
          updated_at: now,
        });
      }

      await supabase.from("contact_center_smart_assistant_events").insert({
        agent_user_id,
        event_type: enabled ? "smart_assistant_activated" : "smart_assistant_deactivated",
        actor_type: "operator",
        actor_id: authUser?.id || null,
        reason: enabled ? "Activado manualmente" : "Desactivado manualmente",
      });

      return jsonResponse(200, { ok: true, enabled, status: enabled ? "active" : "inactive" });
    }

    // ── GET STATE ─────────────────────────────────────────────────────────────
    if (action === "get_state") {
      const { data: config } = await supabase.from("contact_center_smart_assistant_config")
        .select("*").eq("agent_user_id", agent_user_id).maybeSingle();

      const { data: convMode } = await supabase.from("contact_center_conversation_modes")
        .select("mode, active_session_id").eq("agent_user_id", agent_user_id).maybeSingle();

      return jsonResponse(200, {
        config: config || { smart_assistant_enabled: false, smart_assistant_status: "inactive" },
        has_active_auto_session: convMode?.mode === "automatic",
        active_session_id: convMode?.active_session_id || null,
      });
    }

    // ── ANALYZE MESSAGE ────────────────────────────────────────────────────────
    if (action === "analyze_message") {
      const { message_text, message_id, messages_context } = body;
      if (!message_text) return jsonResponse(400, { error: "message_text required" });

      // Load smart assistant config
      const { data: config } = await supabase.from("contact_center_smart_assistant_config")
        .select("*").eq("agent_user_id", agent_user_id).maybeSingle();

      if (!config?.smart_assistant_enabled) {
        return jsonResponse(200, { should_act: false, action: "none", reason: "Asistente inteligente desactivado" });
      }

      // Check if paused
      if (config.paused_until && new Date(config.paused_until) > new Date()) {
        return jsonResponse(200, { should_act: false, action: "none", reason: "Asistente pausado temporalmente", paused_until: config.paused_until });
      }

      // Prevent duplicate processing
      if (config.last_processed_message_id === message_id) {
        return jsonResponse(200, { should_act: false, action: "none", reason: "Mensaje ya procesado" });
      }

      // Prevent concurrent processing
      if (config.is_processing) {
        return jsonResponse(200, { should_act: false, action: "none", reason: "Procesamiento en curso" });
      }

      // Lock processing
      await supabase.from("contact_center_smart_assistant_config")
        .update({ is_processing: true }).eq("agent_user_id", agent_user_id);

      try {
        // Load settings
        const { data: globalSettings } = await supabase.from("contact_center_smart_assistant_settings")
          .select("*").is("office_id", null).maybeSingle();
        const settings = {
          auto_activate_threshold: config.auto_activate_threshold ?? globalSettings?.auto_activate_threshold ?? 0.85,
          suggest_threshold: config.suggest_threshold ?? globalSettings?.suggest_threshold ?? 0.55,
          pause_on_human_message: config.pause_on_human_message ?? globalSettings?.pause_on_human_message ?? true,
          human_pause_minutes: config.human_pause_minutes ?? globalSettings?.human_pause_minutes ?? 20,
        };

        // Check active auto session
        const { data: convMode } = await supabase.from("contact_center_conversation_modes")
          .select("mode, active_session_id").eq("agent_user_id", agent_user_id).maybeSingle();
        const hasActiveSession = convMode?.mode === "automatic";

        // Build context messages
        const contextMessages: Array<{ text: string; sender_type: string; created_at: string; id?: string }> =
          (messages_context || [{ text: message_text, sender_type: "contact", created_at: new Date().toISOString(), id: message_id }]);

        const result = await analyzeConversation(
          supabase, agent_user_id, contextMessages, settings, hasActiveSession,
          config.last_processed_message_id
        );

        // Resolve responsible employee
        const responsible = await resolveResponsibleEmployee(supabase, agent_user_id, authUser?.id || null, null);
        const responsibleName = responsible?.name || "nuestro equipo";

        // Handle pause/stop actions
        if (result.action === "stop_assistant" || result.action === "pause_assistant") {
          const pauseMinutes = settings.human_pause_minutes;
          const pauseUntil = result.action === "pause_assistant"
            ? new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString()
            : null;

          await supabase.from("contact_center_smart_assistant_config").update({
            smart_assistant_status: result.action === "stop_assistant" ? "inactive" : "paused",
            smart_assistant_enabled: result.action === "stop_assistant" ? false : config.smart_assistant_enabled,
            paused_until: pauseUntil,
            pause_reason: result.reason,
            pause_reason_type: result.action === "stop_assistant" ? "contact_request" : "human_intervention",
            last_processed_message_id: message_id,
            is_processing: false,
            updated_at: new Date().toISOString(),
          }).eq("agent_user_id", agent_user_id);

          // If stop, also cancel any active auto session
          if (result.action === "stop_assistant" && hasActiveSession && convMode?.active_session_id) {
            await supabase.from("contact_center_assistant_sessions")
              .update({ status: "cancelled", completed_at: new Date().toISOString() })
              .eq("id", convMode.active_session_id);
            await supabase.from("contact_center_conversation_modes")
              .upsert({ agent_user_id, mode: "normal", active_session_id: null, assigned_assistant_id: null, updated_at: new Date().toISOString() }, { onConflict: "agent_user_id" });
          }

          await supabase.from("contact_center_smart_assistant_events").insert({
            agent_user_id,
            event_type: result.action === "stop_assistant" ? "stop_requested_by_contact" : "human_intervention_detected",
            detected_intent: result.intent,
            confidence: result.confidence,
            action_taken: result.action,
            actor_type: "system",
            reason: result.reason,
            message_id,
            message_text: message_text?.substring(0, 200),
          });

          const stopMsg = result.action === "stop_assistant"
            ? appendMoviIaSignature(`Claro, ${responsibleName} te atenderá por este medio.`)
            : null;

          return jsonResponse(200, { ...result, stop_message: stopMsg, responsible_name: responsibleName });
        }

        // Handle activate agent
        if (result.action === "activate_automatic_agent" && result.matched_assistant_id) {
          // Store pending state — actual activation is done by frontend calling contact-center-assistant-process
          await supabase.from("contact_center_smart_assistant_config").update({
            smart_assistant_status: "agent_active",
            last_analysis_at: new Date().toISOString(),
            last_action_at: new Date().toISOString(),
            last_detected_intent: result.intent,
            last_detected_confidence: result.confidence,
            last_processed_message_id: message_id,
            is_processing: false,
            updated_at: new Date().toISOString(),
          }).eq("agent_user_id", agent_user_id);

          await supabase.from("contact_center_smart_assistant_events").insert({
            agent_user_id,
            event_type: "agent_auto_activated",
            detected_intent: result.intent,
            confidence: result.confidence,
            action_taken: "activate_automatic_agent",
            matched_assistant_id: result.matched_assistant_id,
            actor_type: "system",
            reason: result.reason,
            message_id,
            message_text: message_text?.substring(0, 200),
            metadata: { form_slug: result.matched_form_slug },
          });

          return jsonResponse(200, { ...result, responsible_name: responsibleName });
        }

        // Handle suggest
        if (result.action === "suggest_internal_actions") {
          await supabase.from("contact_center_smart_assistant_config").update({
            smart_assistant_status: "awaiting_confirmation",
            last_analysis_at: new Date().toISOString(),
            last_detected_intent: result.intent,
            last_detected_confidence: result.confidence,
            last_processed_message_id: message_id,
            pending_suggestion: result as unknown as Record<string, unknown>,
            is_processing: false,
            updated_at: new Date().toISOString(),
          }).eq("agent_user_id", agent_user_id);

          await supabase.from("contact_center_smart_assistant_events").insert({
            agent_user_id,
            event_type: "suggestion_shown",
            detected_intent: result.intent,
            confidence: result.confidence,
            action_taken: "suggest_internal_actions",
            actor_type: "system",
            reason: result.reason,
            message_id,
            message_text: message_text?.substring(0, 200),
            metadata: { suggested_actions: result.suggested_actions },
          });

          return jsonResponse(200, { ...result, responsible_name: responsibleName });
        }

        // No action
        await supabase.from("contact_center_smart_assistant_config").update({
          last_analysis_at: new Date().toISOString(),
          last_detected_intent: result.intent || null,
          last_detected_confidence: result.confidence,
          last_processed_message_id: message_id,
          is_processing: false,
          updated_at: new Date().toISOString(),
        }).eq("agent_user_id", agent_user_id);

        if (result.confidence > 0) {
          await supabase.from("contact_center_smart_assistant_events").insert({
            agent_user_id,
            event_type: "no_action_taken",
            detected_intent: result.intent,
            confidence: result.confidence,
            action_taken: "none",
            actor_type: "system",
            reason: result.reason,
            message_id,
          });
        }

        return jsonResponse(200, { ...result, responsible_name: responsibleName });

      } catch (err) {
        // Release lock on error
        await supabase.from("contact_center_smart_assistant_config")
          .update({ is_processing: false }).eq("agent_user_id", agent_user_id);
        throw err;
      }
    }

    // ── DISMISS SUGGESTION ─────────────────────────────────────────────────────
    if (action === "dismiss_suggestion") {
      await supabase.from("contact_center_smart_assistant_config").update({
        smart_assistant_status: "active",
        pending_suggestion: null,
        updated_at: new Date().toISOString(),
      }).eq("agent_user_id", agent_user_id);

      await supabase.from("contact_center_smart_assistant_events").insert({
        agent_user_id,
        event_type: "suggestion_dismissed",
        actor_type: "operator",
        actor_id: authUser?.id || null,
        reason: "Sugerencia ignorada por usuario interno",
      });

      return jsonResponse(200, { ok: true });
    }

    // ── ACCEPT SUGGESTION ──────────────────────────────────────────────────────
    if (action === "accept_suggestion") {
      const { assistant_id, intent } = body;

      await supabase.from("contact_center_smart_assistant_config").update({
        smart_assistant_status: "agent_active",
        pending_suggestion: null,
        updated_at: new Date().toISOString(),
      }).eq("agent_user_id", agent_user_id);

      await supabase.from("contact_center_smart_assistant_events").insert({
        agent_user_id,
        event_type: "suggestion_accepted",
        detected_intent: intent,
        matched_assistant_id: assistant_id || null,
        actor_type: "operator",
        actor_id: authUser?.id || null,
        reason: "Sugerencia aceptada por usuario interno",
      });

      return jsonResponse(200, { ok: true, assistant_id });
    }

    // ── RESUME ─────────────────────────────────────────────────────────────────
    if (action === "resume") {
      await supabase.from("contact_center_smart_assistant_config").update({
        smart_assistant_status: "active",
        paused_until: null,
        pause_reason: null,
        pause_reason_type: null,
        updated_at: new Date().toISOString(),
      }).eq("agent_user_id", agent_user_id);

      await supabase.from("contact_center_smart_assistant_events").insert({
        agent_user_id,
        event_type: "smart_assistant_resumed",
        actor_type: "operator",
        actor_id: authUser?.id || null,
        reason: "Reactivado manualmente",
      });

      return jsonResponse(200, { ok: true, status: "active" });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });

  } catch (err) {
    console.error("[smart-assistant]", err);
    return jsonResponse(500, { error: String(err) });
  }
});
