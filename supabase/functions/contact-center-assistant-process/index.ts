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

interface ProcessRequest {
  action:
    | "start_session"
    | "process_message"
    | "pause_session"
    | "resume_session"
    | "transfer"
    | "cancel_session"
    | "get_session_state";
  agent_user_id?: string;
  assistant_id?: string;
  session_id?: string;
  message?: string;
  message_id?: string;
  transfer_to?: string;
  transfer_reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const body = (await req.json()) as ProcessRequest;
    const { action } = body;

    // ─── START SESSION ─────────────────────────────────────────────────────────
    if (action === "start_session") {
      const { agent_user_id, assistant_id } = body;
      if (!agent_user_id || !assistant_id) {
        return jsonResponse(400, { error: "agent_user_id and assistant_id required" });
      }

      // Prevent duplicate active session
      const { data: existing } = await supabase
        .from("contact_center_assistant_sessions")
        .select("id, status")
        .eq("agent_user_id", agent_user_id)
        .in("status", ["active", "paused"])
        .maybeSingle();

      if (existing) {
        return jsonResponse(409, {
          error: "Ya existe una sesión activa para este contacto",
          session_id: existing.id,
        });
      }

      const { data: assistant } = await supabase
        .from("contact_center_assistants")
        .select("*, contact_center_assistant_fields(*)")
        .eq("id", assistant_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!assistant) {
        return jsonResponse(404, { error: "Asistente no encontrado o inactivo" });
      }

      // Get auth user to set activated_by
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: authUser } } = await supabase.auth.getUser(token);

      const { data: session, error: sessionErr } = await supabase
        .from("contact_center_assistant_sessions")
        .insert({
          assistant_id,
          agent_user_id,
          activated_by: authUser?.id || null,
          status: "active",
          current_stage: assistant.consent_message ? "consent" : "capturing",
          current_field_index: 0,
        })
        .select()
        .single();

      if (sessionErr) {
        return jsonResponse(500, { error: sessionErr.message });
      }

      // Upsert conversation mode
      await supabase
        .from("contact_center_conversation_modes")
        .upsert({
          agent_user_id,
          mode: "automatic",
          active_session_id: session.id,
          assigned_assistant_id: assistant_id,
          updated_by: authUser?.id || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "agent_user_id" });

      // Log event
      await supabase.from("contact_center_assistant_events").insert({
        session_id: session.id,
        event_type: "session_started",
        actor_type: "operator",
        actor_id: authUser?.id || null,
        message: `Sesión iniciada con asistente: ${assistant.nombre}`,
      });

      // Update assistant session counter (non-critical)
      try {
        await supabase.rpc("increment_assistant_counter", {
          p_assistant_id: assistant_id,
          p_field: "total_sessions",
        });
      } catch { /* RPC may not exist */ }

      // Build welcome message
      let welcomeMsg = assistant.welcome_message ||
        `Hola, soy el asistente virtual. Voy a ayudarte con tu solicitud de ${assistant.nombre}.`;
      if (assistant.consent_message) {
        welcomeMsg = assistant.consent_message;
      }

      return jsonResponse(200, {
        ok: true,
        session_id: session.id,
        stage: session.current_stage,
        welcome_message: welcomeMsg,
        assistant_name: assistant.nombre,
        total_fields: (assistant.contact_center_assistant_fields || []).length,
      });
    }

    // ─── PROCESS MESSAGE ───────────────────────────────────────────────────────
    if (action === "process_message") {
      const { session_id, message, message_id } = body;
      if (!session_id || !message) {
        return jsonResponse(400, { error: "session_id and message required" });
      }

      const { data: session } = await supabase
        .from("contact_center_assistant_sessions")
        .select(`
          *,
          contact_center_assistants(*),
          contact_center_assistant_session_data(*)
        `)
        .eq("id", session_id)
        .maybeSingle();

      if (!session) return jsonResponse(404, { error: "Sesión no encontrada" });
      if (session.status !== "active") {
        return jsonResponse(400, { error: `Sesión en estado: ${session.status}` });
      }

      const assistant = session.contact_center_assistants;

      // Load fields ordered by capture_order
      const { data: fields } = await supabase
        .from("contact_center_assistant_fields")
        .select("*")
        .eq("assistant_id", assistant.id)
        .order("capture_order");

      const capturedData = session.contact_center_assistant_session_data || [];
      const capturedKeys = new Set(capturedData.map((d: { field_key: string }) => d.field_key));

      let responseMessage = "";
      let newStage = session.current_stage;
      let newFieldIndex = session.current_field_index;

      // ── Stage: consent ──
      if (session.current_stage === "consent") {
        const lower = message.toLowerCase().trim();
        const accepted = ["si", "sí", "yes", "acepto", "ok", "de acuerdo", "adelante"].some(
          (w) => lower.includes(w)
        );
        const refused = ["no", "cancelar", "cancel"].some((w) => lower === w);

        if (accepted) {
          await supabase
            .from("contact_center_assistant_sessions")
            .update({ consent_given: true, consent_at: new Date().toISOString() })
            .eq("id", session_id);

          await supabase.from("contact_center_assistant_events").insert({
            session_id,
            event_type: "consent_given",
            actor_type: "contact",
            message: "Consentimiento otorgado",
          });

          newStage = "capturing";
          newFieldIndex = 0;

          const firstField = (fields || [])[0];
          responseMessage = firstField
            ? firstField.prompt_text || `Por favor, proporciona tu ${firstField.label}:`
            : (assistant.completion_message || "¡Gracias! Ya tenemos toda la información necesaria.");
        } else if (refused) {
          await supabase
            .from("contact_center_assistant_sessions")
            .update({ status: "cancelled" })
            .eq("id", session_id);

          await supabase.from("contact_center_assistant_events").insert({
            session_id,
            event_type: "consent_refused",
            actor_type: "contact",
          });

          await supabase
            .from("contact_center_conversation_modes")
            .upsert({
              agent_user_id: session.agent_user_id,
              mode: "normal",
              active_session_id: null,
              assigned_assistant_id: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "agent_user_id" });

          return jsonResponse(200, {
            ok: true,
            stage: "cancelled",
            response_message: "Entendido. La sesión automática ha sido cancelada. Un agente puede asistirte.",
            session_ended: true,
          });
        } else {
          responseMessage =
            assistant.consent_message ||
            "Para continuar necesito tu consentimiento para procesar tus datos. ¿Aceptas? (Si/No)";
        }
      }
      // ── Stage: capturing ──
      else if (session.current_stage === "capturing" && fields && fields.length > 0) {
        const pendingFields = fields.filter((f: { field_key: string }) => !capturedKeys.has(f.field_key));

        if (pendingFields.length === 0) {
          // All captured → summary
          newStage = "summary";
          const summary = buildSummary(capturedData, fields);
          responseMessage = `✅ *Resumen de tu solicitud:*\n\n${summary}\n\n¿Es correcta esta información? (Si/No)`;
        } else {
          const currentField = pendingFields[0];

          // Use AI to extract value if OpenAI key is available
          let extractedValue: string | null = null;
          if (openaiKey) {
            extractedValue = await extractFieldValue(
              openaiKey,
              message,
              currentField,
              assistant.language || "es"
            );
          } else {
            extractedValue = message.trim();
          }

          if (extractedValue && extractedValue !== "__unclear__") {
            // Save captured value
            await supabase.from("contact_center_assistant_session_data").insert({
              session_id,
              field_id: currentField.id,
              field_key: currentField.field_key,
              field_label: currentField.label,
              value_text: extractedValue,
              confirmed_by_user: false,
            });

            await supabase.from("contact_center_assistant_events").insert({
              session_id,
              event_type: "field_captured",
              actor_type: "contact",
              field_key: currentField.field_key,
              value_preview: extractedValue.substring(0, 50),
            });

            capturedKeys.add(currentField.field_key);
            const remaining = pendingFields.slice(1);

            if (remaining.length === 0) {
              newStage = "summary";
              // reload captured
              const { data: freshData } = await supabase
                .from("contact_center_assistant_session_data")
                .select("*")
                .eq("session_id", session_id);
              const summary = buildSummary(freshData || [], fields);
              responseMessage = `✅ *Resumen de tu solicitud:*\n\n${summary}\n\n¿Es correcta esta información? (Si/No)`;
            } else {
              const next = remaining[0];
              responseMessage = next.prompt_text || `Gracias. Ahora necesito tu ${next.label}:`;
              newFieldIndex = fields.indexOf(next);
            }
          } else {
            // Not clear - rephrase
            responseMessage =
              `No entendí bien tu respuesta. Por favor, proporciona ${currentField.label} claramente:`;
          }
        }
      }
      // ── Stage: summary (confirmation) ──
      else if (session.current_stage === "summary") {
        const lower = message.toLowerCase().trim();
        const confirmed = ["si", "sí", "yes", "correcto", "ok", "confirmo"].some((w) =>
          lower.includes(w)
        );
        const rejected = ["no", "corregir", "cambiar"].some((w) => lower.includes(w));

        if (confirmed) {
          // Auto-create tramite if configured
          let ticketId: string | null = null;
          if (assistant.auto_create_tramite) {
            ticketId = await createTramite(supabase, session, assistant, capturedData, fields || []);
          }

          await supabase
            .from("contact_center_assistant_sessions")
            .update({
              status: "completed",
              current_stage: "completion",
              ticket_id: ticketId,
              completed_at: new Date().toISOString(),
            })
            .eq("id", session_id);

          await supabase.from("contact_center_assistant_events").insert({
            session_id,
            event_type: "session_completed",
            actor_type: "system",
            message: ticketId ? `Trámite creado: ${ticketId}` : "Sesión completada sin trámite",
          });

          if (ticketId) {
            await supabase.from("contact_center_assistant_events").insert({
              session_id,
              event_type: "tramite_created",
              actor_type: "system",
              metadata: { ticket_id: ticketId },
            });
          }

          await supabase
            .from("contact_center_conversation_modes")
            .upsert({
              agent_user_id: session.agent_user_id,
              mode: "normal",
              active_session_id: null,
              assigned_assistant_id: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "agent_user_id" });

          newStage = "completion";
          responseMessage =
            assistant.completion_message ||
            `¡Excelente! Tu solicitud ha sido registrada.${ticketId ? " Un agente te contactará pronto." : ""}`;

          return jsonResponse(200, {
            ok: true,
            stage: "completion",
            response_message: responseMessage,
            ticket_id: ticketId,
            session_ended: true,
          });
        } else if (rejected) {
          // Go back to capturing
          await supabase
            .from("contact_center_assistant_session_data")
            .delete()
            .eq("session_id", session_id);

          newStage = "capturing";
          newFieldIndex = 0;

          const firstField = (fields || [])[0];
          responseMessage = firstField
            ? `Vamos a empezar de nuevo. ${firstField.prompt_text || `Por favor, proporciona tu ${firstField.label}:`}`
            : "Vamos a corregir la información.";
        } else {
          // Reload summary
          const { data: freshData } = await supabase
            .from("contact_center_assistant_session_data")
            .select("*")
            .eq("session_id", session_id);
          const summary = buildSummary(freshData || [], fields || []);
          responseMessage = `Resumen de tu solicitud:\n\n${summary}\n\n¿Es correcta esta información? (Si/No)`;
        }
      }

      // Update session stage
      if (newStage !== session.current_stage || newFieldIndex !== session.current_field_index) {
        await supabase
          .from("contact_center_assistant_sessions")
          .update({
            current_stage: newStage,
            current_field_index: newFieldIndex,
            last_message_at: new Date().toISOString(),
            messages_received: session.messages_received + 1,
          })
          .eq("id", session_id);

        if (newStage !== session.current_stage) {
          await supabase.from("contact_center_assistant_events").insert({
            session_id,
            event_type: "stage_changed",
            actor_type: "system",
            stage_from: session.current_stage,
            stage_to: newStage,
          });
        }
      } else {
        await supabase
          .from("contact_center_assistant_sessions")
          .update({
            last_message_at: new Date().toISOString(),
            messages_received: session.messages_received + 1,
          })
          .eq("id", session_id);
      }

      // Log message event
      await supabase.from("contact_center_assistant_events").insert({
        session_id,
        event_type: "message_received",
        actor_type: "contact",
        message: message.substring(0, 200),
        metadata: { message_id: message_id || null },
      });

      // Count pending fields for progress
      const { data: freshCaptured } = await supabase
        .from("contact_center_assistant_session_data")
        .select("field_key")
        .eq("session_id", session_id);
      const capturedCount = freshCaptured?.length || 0;
      const totalFields = fields?.length || 0;

      return jsonResponse(200, {
        ok: true,
        stage: newStage,
        response_message: responseMessage,
        progress: { captured: capturedCount, total: totalFields },
        session_ended: false,
      });
    }

    // ─── GET SESSION STATE ─────────────────────────────────────────────────────
    if (action === "get_session_state") {
      const { agent_user_id } = body;
      if (!agent_user_id) {
        return jsonResponse(400, { error: "agent_user_id required" });
      }

      const { data: mode } = await supabase
        .from("contact_center_conversation_modes")
        .select(`
          *,
          contact_center_assistant_sessions!active_session_id(
            id, status, current_stage, current_field_index,
            consent_given, started_at, messages_received,
            contact_center_assistants(id, nombre, model),
            contact_center_assistant_session_data(field_key, field_label, value_text)
          )
        `)
        .eq("agent_user_id", agent_user_id)
        .maybeSingle();

      if (!mode) {
        return jsonResponse(200, { mode: "normal", active_session: null });
      }

      return jsonResponse(200, {
        mode: mode.mode,
        assigned_assistant_id: mode.assigned_assistant_id,
        active_session: mode.contact_center_assistant_sessions || null,
      });
    }

    // ─── PAUSE SESSION ─────────────────────────────────────────────────────────
    if (action === "pause_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });

      await supabase
        .from("contact_center_assistant_sessions")
        .update({ status: "paused" })
        .eq("id", session_id)
        .in("status", ["active"]);

      await supabase.from("contact_center_assistant_events").insert({
        session_id,
        event_type: "session_paused",
        actor_type: "operator",
      });

      return jsonResponse(200, { ok: true, status: "paused" });
    }

    // ─── RESUME SESSION ────────────────────────────────────────────────────────
    if (action === "resume_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });

      await supabase
        .from("contact_center_assistant_sessions")
        .update({ status: "active" })
        .eq("id", session_id)
        .in("status", ["paused"]);

      await supabase.from("contact_center_assistant_events").insert({
        session_id,
        event_type: "session_resumed",
        actor_type: "operator",
      });

      return jsonResponse(200, { ok: true, status: "active" });
    }

    // ─── TRANSFER ──────────────────────────────────────────────────────────────
    if (action === "transfer") {
      const { session_id, transfer_reason, transfer_to } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });

      const { data: session } = await supabase
        .from("contact_center_assistant_sessions")
        .select("agent_user_id, contact_center_assistants(transfer_message)")
        .eq("id", session_id)
        .maybeSingle();

      await supabase
        .from("contact_center_assistant_sessions")
        .update({
          status: "transferred",
          transferred_to: transfer_to || null,
          transfer_reason: transfer_reason || "Transferido manualmente",
        })
        .eq("id", session_id);

      await supabase.from("contact_center_assistant_events").insert({
        session_id,
        event_type: "session_transferred",
        actor_type: "operator",
        message: transfer_reason || null,
        metadata: { transfer_to },
      });

      if (session?.agent_user_id) {
        await supabase
          .from("contact_center_conversation_modes")
          .upsert({
            agent_user_id: session.agent_user_id,
            mode: "normal",
            active_session_id: null,
            assigned_assistant_id: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "agent_user_id" });
      }

      const transferMsg =
        (session?.contact_center_assistants as { transfer_message?: string })?.transfer_message ||
        "Un agente humano continuará atendiéndote. ¡Gracias por tu paciencia!";

      return jsonResponse(200, { ok: true, status: "transferred", transfer_message: transferMsg });
    }

    // ─── CANCEL SESSION ────────────────────────────────────────────────────────
    if (action === "cancel_session") {
      const { session_id } = body;
      if (!session_id) return jsonResponse(400, { error: "session_id required" });

      const { data: session } = await supabase
        .from("contact_center_assistant_sessions")
        .select("agent_user_id")
        .eq("id", session_id)
        .maybeSingle();

      await supabase
        .from("contact_center_assistant_sessions")
        .update({ status: "cancelled" })
        .eq("id", session_id);

      await supabase.from("contact_center_assistant_events").insert({
        session_id,
        event_type: "session_cancelled",
        actor_type: "operator",
      });

      if (session?.agent_user_id) {
        await supabase
          .from("contact_center_conversation_modes")
          .upsert({
            agent_user_id: session.agent_user_id,
            mode: "normal",
            active_session_id: null,
            assigned_assistant_id: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "agent_user_id" });
      }

      return jsonResponse(200, { ok: true, status: "cancelled" });
    }

    return jsonResponse(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("[cc-assistant-process] error:", err);
    return jsonResponse(500, { error: String(err) });
  }
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function buildSummary(capturedData: Array<{ field_label: string; value_text?: string | null }>, _fields: unknown[]): string {
  if (!capturedData || capturedData.length === 0) return "(sin datos capturados)";
  return capturedData
    .map((d) => `• *${d.field_label}:* ${d.value_text || "(sin valor)"}`)
    .join("\n");
}

async function extractFieldValue(
  openaiKey: string,
  userMessage: string,
  field: { field_key: string; label: string; field_type: string; options?: unknown[] },
  language: string
): Promise<string> {
  try {
    const prompt = `You are a data extraction assistant. The user is in a conversation in ${language}.
The field being captured is: "${field.label}" (type: ${field.field_type}).
${field.options && Array.isArray(field.options) && field.options.length > 0 ? `Valid options: ${JSON.stringify(field.options)}` : ""}

User message: "${userMessage}"

Extract the value for "${field.label}" from the message. Return ONLY the extracted value as plain text.
If the message is unclear or doesn't contain the value, return exactly: __unclear__
Do not include explanations.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!res.ok) return userMessage.trim();

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "__unclear__";
  } catch {
    return userMessage.trim();
  }
}

async function createTramite(
  supabase: ReturnType<typeof createClient>,
  session: {
    agent_user_id: string;
    activated_by?: string | null;
    id: string;
  },
  assistant: { nombre: string; tramite_tipo?: string; tramite_prioridad?: string },
  capturedData: Array<{ field_label: string; value_text?: string | null }>,
  _fields: unknown[]
): Promise<string | null> {
  try {
    const summary = buildSummary(capturedData, _fields);
    const instrucciones = `Solicitud capturada vía Modo Automático (${assistant.nombre}):\n\n${summary}`;

    // Get folio
    const { data: folioData } = await supabase.rpc("generate_next_folio");
    const folio = folioData || `AUTO-${Date.now()}`;

    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        folio,
        instrucciones,
        tipo_tramite: assistant.tramite_tipo || "formulario_cotizacion",
        prioridad: assistant.tramite_prioridad || "Media",
        agente_id: session.agent_user_id,
        creado_por: session.activated_by || null,
        metadata: {
          automation_session_id: session.id,
          assistant_name: assistant.nombre,
          source: "modo_automatico",
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[cc-assistant-process] createTramite error:", error);
      return null;
    }

    return ticket.id;
  } catch (err) {
    console.error("[cc-assistant-process] createTramite exception:", err);
    return null;
  }
}
