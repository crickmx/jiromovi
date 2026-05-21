import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, status: "webhook active" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const logs: string[] = [];
  const receivedAt = new Date().toISOString();
  let rawBody = "";
  let parsedPayload: Record<string, unknown> | null = null;

  try {
    rawBody = await req.text();
    logs.push(`received_at=${receivedAt} body_length=${rawBody.length} method=${req.method}`);

    if (!rawBody || rawBody.trim() === "") {
      await logWebhookEvent(supabase, { receivedAt, method: req.method, bodyRaw: rawBody, payload: null, messagesCount: 0, statusesCount: 0, logs, error: null });
      return new Response(JSON.stringify({ ok: true, logs }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    parsedPayload = JSON.parse(rawBody);
    logs.push(`keys=${Object.keys(parsedPayload!).join(",")}`);

    // Handle status updates
    if (parsedPayload!.statuses && Array.isArray(parsedPayload!.statuses)) {
      const statuses = parsedPayload!.statuses as Array<{ status: string; messageId: string }>;
      for (const s of statuses) {
        if (["sent", "delivered", "read"].includes(s.status)) {
          await supabase
            .from("contact_center_messages")
            .update({ status: s.status, updated_at: new Date().toISOString() })
            .eq("provider_message_id", s.messageId);
        }
      }
      logs.push(`statuses_processed=${statuses.length}`);
    }

    const statusesCount = Array.isArray(parsedPayload!.statuses) ? (parsedPayload!.statuses as unknown[]).length : 0;
    const messagesCount = Array.isArray(parsedPayload!.messages) ? (parsedPayload!.messages as unknown[]).length : 0;

    // Load all active users once for phone matching
    const { data: allUsersData } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, celular_laboral, celular_personal, oficina_id")
      .eq("activo", true);
    const allUsers: Array<{ id: string; nombre_completo: string; celular_laboral?: string; celular_personal?: string; oficina_id?: string }> = allUsersData || [];

    const findUserByPhone = (phone: string) => {
      const digits = phone.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      if (last10.length < 10) return null;
      return allUsers.find((u) => {
        const c1 = (u.celular_laboral || "").replace(/\D/g, "").slice(-10);
        const c2 = (u.celular_personal || "").replace(/\D/g, "").slice(-10);
        return c1 === last10 || c2 === last10;
      }) || null;
    };

    // Find the agent who should "own" a conversation with this chatId
    // Prefers manual messages (not automated notifications) and most recent
    const findAgentForChatId = async (chatId: string): Promise<{ agentUserId: string | null; source: string }> => {
      // Strategy 1: Look for manual outbound messages by chat_id metadata
      const { data: manualByChatId } = await supabase
        .from("contact_center_messages")
        .select("agent_user_id")
        .eq("metadata->>chat_id", chatId)
        .eq("direction", "outbound")
        .eq("message_type", "manual")
        .not("agent_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (manualByChatId?.agent_user_id) {
        return { agentUserId: manualByChatId.agent_user_id, source: "manual_chat_id" };
      }

      // Strategy 2: manual outbound by normalized_phone (legacy records before chat_id was added)
      const { data: manualByPhone } = await supabase
        .from("contact_center_messages")
        .select("agent_user_id")
        .eq("metadata->>normalized_phone", chatId)
        .eq("direction", "outbound")
        .eq("message_type", "manual")
        .not("agent_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (manualByPhone?.agent_user_id) {
        return { agentUserId: manualByPhone.agent_user_id, source: "manual_norm_phone" };
      }

      // Strategy 3: any outbound by chat_id (including automated, but as fallback)
      const { data: anyByChatId } = await supabase
        .from("contact_center_messages")
        .select("agent_user_id")
        .eq("metadata->>chat_id", chatId)
        .eq("direction", "outbound")
        .not("agent_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyByChatId?.agent_user_id) {
        return { agentUserId: anyByChatId.agent_user_id, source: "any_chat_id" };
      }

      // Strategy 4: any outbound by normalized_phone (legacy fallback)
      const { data: anyByPhone } = await supabase
        .from("contact_center_messages")
        .select("agent_user_id")
        .eq("metadata->>normalized_phone", chatId)
        .eq("direction", "outbound")
        .not("agent_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyByPhone?.agent_user_id) {
        return { agentUserId: anyByPhone.agent_user_id, source: "any_norm_phone" };
      }

      // Strategy 5: Try alternate phone formats (521X vs 52X vs last 10 digits)
      const digits = chatId.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      const alternates: string[] = [];
      if (digits.startsWith("521") && digits.length === 13) {
        alternates.push("52" + digits.slice(3)); // 52XXXXXXXXXX
      } else if (digits.startsWith("52") && digits.length === 12) {
        alternates.push("521" + digits.slice(2)); // 521XXXXXXXXXX
      }
      if (last10.length === 10 && !alternates.includes("521" + last10)) {
        alternates.push("521" + last10);
      }

      for (const alt of alternates) {
        const { data: altMatch } = await supabase
          .from("contact_center_messages")
          .select("agent_user_id")
          .eq("metadata->>chat_id", alt)
          .eq("direction", "outbound")
          .not("agent_user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (altMatch?.agent_user_id) {
          return { agentUserId: altMatch.agent_user_id, source: "alt_phone_format" };
        }
      }

      // Strategy 6: Match by usuarios phone directly (for first-time conversations)
      const userByPhone = findUserByPhone(digits);
      if (userByPhone) {
        return { agentUserId: userByPhone.id, source: "user_phone_direct" };
      }

      return { agentUserId: null, source: "no_match" };
    };

    // Handle messages
    if (parsedPayload!.messages && Array.isArray(parsedPayload!.messages)) {
      logs.push(`messages_count=${messagesCount}`);

      for (const msg of (parsedPayload!.messages as Array<Record<string, unknown>>)) {
        if (msg.isDeleted || msg.isEdited) {
          logs.push(`skip_${msg.messageId}_deleted_or_edited`);
          continue;
        }

        const isInbound = msg.status === "inbound" && !msg.isEcho;
        const isOutboundEcho = msg.isEcho === true;

        logs.push(`msg_${msg.messageId}_status=${msg.status}_echo=${msg.isEcho}_inbound=${isInbound}_type=${msg.type}`);

        // Non-echo outbound: just update status
        if (!isInbound && !isOutboundEcho) {
          if (["sent", "delivered", "read"].includes(msg.status as string)) {
            await supabase
              .from("contact_center_messages")
              .update({ status: msg.status, updated_at: new Date().toISOString() })
              .eq("provider_message_id", msg.messageId);
            logs.push(`updated_outbound_status_${msg.messageId}`);
          }
          continue;
        }

        // Duplicate check
        const { data: existing } = await supabase
          .from("contact_center_messages")
          .select("id")
          .eq("provider_message_id", msg.messageId)
          .maybeSingle();

        if (existing) {
          logs.push(`duplicate_${msg.messageId}`);
          continue;
        }

        const chatDigits = ((msg.chatId as string) || "").replace(/\D/g, "");
        const contactNameFromMsg: string | null = (msg.contact as Record<string, string> | null)?.name || null;

        const hasMedia = !!msg.contentUri && msg.type !== "text";
        const mediaTypeLabels: Record<string, string> = {
          image: "Imagen", video: "Video", audio: "Audio",
          document: "Documento", sticker: "Sticker", voice: "Audio",
        };
        const mediaLabel = mediaTypeLabels[msg.type as string] || String(msg.type);
        const messageBody = (msg.text as string) || (hasMedia ? `[${mediaLabel}]` : "");
        const attachmentUrls = hasMedia
          ? [{ url: msg.contentUri, type: msg.type, name: msg.fileName || mediaLabel }]
          : null;

        let agentUserId: string | null = null;
        let agentName: string | null = null;
        let contactPhone: string | null = null;
        let direction: string;
        let status: string;
        let senderType: string;

        if (isOutboundEcho) {
          // Outbound echo: chatId is the RECIPIENT (agent/user phone)
          const matched = findUserByPhone(chatDigits);
          if (matched) {
            agentUserId = matched.id;
            agentName = matched.nombre_completo;
            logs.push(`echo_matched_agent=${matched.id}`);
          } else {
            // Try prior outbound message lookup
            const { agentUserId: priorAgent } = await findAgentForChatId(msg.chatId as string);
            if (priorAgent) {
              agentUserId = priorAgent;
              logs.push(`echo_matched_via_prior_msg=${agentUserId}`);
            } else {
              contactPhone = chatDigits || null;
              logs.push(`echo_external_contact_phone=${contactPhone}`);
            }
          }
          direction = "outbound";
          status = "sent";
          senderType = "user";
        } else {
          // INBOUND: chatId is the SENDER (client phone)
          // Find agent who manages this client's phone (via prior outbound messages)
          const { agentUserId: foundAgent, source } = await findAgentForChatId(msg.chatId as string);
          if (foundAgent) {
            agentUserId = foundAgent;
            const agentRecord = allUsers.find(u => u.id === foundAgent);
            agentName = agentRecord?.nombre_completo || null;
            logs.push(`inbound_agent_found_${source}=${foundAgent}`);
          } else {
            // No agent found — store as external/unassigned contact, never drop the message
            contactPhone = chatDigits || null;
            logs.push(`inbound_external_unassigned_phone=${contactPhone}`);
          }
          direction = "inbound";
          status = "received";
          senderType = "contact";
        }

        // Always store the message — even if no agent and no contactPhone (use chatId as fallback)
        if (!agentUserId && !contactPhone) {
          contactPhone = chatDigits || (msg.chatId as string) || "unknown";
          logs.push(`fallback_contact_phone=${contactPhone}`);
        }

        const { data: insertedMsg, error: insertErr } = await supabase
          .from("contact_center_messages")
          .insert({
            agent_user_id: agentUserId,
            contact_phone: contactPhone,
            contact_name: contactNameFromMsg,
            sender_type: senderType,
            channel: "whatsapp",
            message_type: "manual",
            direction,
            body: messageBody,
            status,
            provider: "wazzup",
            provider_message_id: msg.messageId,
            provider_response: msg,
            attachment_urls: attachmentUrls,
            created_at: msg.dateTime || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              chat_id: msg.chatId,
              channel_id: msg.channelId,
              chat_type: msg.chatType,
              message_type: msg.type,
              content_uri: msg.contentUri || null,
              contact_name: contactNameFromMsg,
              sender_phone: msg.chatId,
              source: isOutboundEcho ? "wazzup_echo" : "whatsapp_inbound",
            },
          })
          .select("id")
          .maybeSingle();

        if (insertErr) {
          logs.push(`insert_error=${insertErr.message}`);
          continue;
        }

        logs.push(`inserted_${msg.messageId}_dir=${direction}_agent=${agentUserId || "none"}_phone=${contactPhone || "none"}`);

        // Insert attachment record
        if (hasMedia && insertedMsg?.id) {
          const fileTypeMap: Record<string, string> = {
            image: "image", video: "video", audio: "audio",
            voice: "audio", document: "document", sticker: "image",
          };
          await supabase.from("contact_center_attachments").insert({
            message_id: insertedMsg.id,
            agent_user_id: agentUserId,
            provider: "wazzup",
            provider_file_id: msg.messageId,
            file_name: msg.fileName || `${mediaLabel}_${Date.now()}`,
            file_type: fileTypeMap[msg.type as string] || "document",
            mime_type: msg.mimeType || null,
            file_url: msg.contentUri,
            direction,
            metadata: {
              content_uri: msg.contentUri,
              wazzup_type: msg.type,
              channel_id: msg.channelId,
            },
          });
        }

        // ── Automatic mode: process inbound through assistant if session active ──
        if (isInbound && agentUserId && insertedMsg?.id && messageBody.trim()) {
          try {
            const { data: convMode } = await supabase
              .from("contact_center_conversation_modes")
              .select("mode, active_session_id, assigned_assistant_id")
              .eq("agent_user_id", agentUserId)
              .eq("mode", "automatic")
              .maybeSingle();

            if (convMode?.active_session_id) {
              logs.push(`auto_mode_session=${convMode.active_session_id}`);

              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

              // Call the assistant process function
              const processRes = await fetch(
                `${supabaseUrl}/functions/v1/contact-center-assistant-process`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${serviceKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    action: "process_message",
                    session_id: convMode.active_session_id,
                    message: messageBody.trim(),
                    message_id: insertedMsg.id,
                  }),
                }
              );

              const processData = await processRes.json();
              logs.push(`auto_mode_result=status:${processRes.status}_stage:${processData.stage || "?"}_ended:${processData.session_ended}_err:${processData.error || "none"}`);

              const replyText: string | null = processData.response_message || null;

              if (replyText) {
                // Get WhatsApp config to send the reply
                const { data: waCfg } = await supabase
                  .from("whatsapp_configuracion")
                  .select("api_key, channel_id_uuid, numero_remitente, activo")
                  .eq("activo", true)
                  .maybeSingle();

                if (waCfg?.api_key && waCfg?.channel_id_uuid) {
                  const chatId = (msg.chatId as string) || chatDigits;
                  const wazzupRes = await fetch("https://api.wazzup24.com/v3/message", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${waCfg.api_key}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      channelId: waCfg.channel_id_uuid,
                      chatId,
                      chatType: "whatsapp",
                      text: replyText,
                    }),
                  });

                  const wazzupBody = await wazzupRes.json();
                  const sentMessageId: string | null = wazzupBody?.messageId || null;
                  logs.push(`auto_mode_sent=${sentMessageId || "no_id"}_status=${wazzupRes.status}`);

                  // Store the reply as outbound message
                  await supabase.from("contact_center_messages").insert({
                    agent_user_id: agentUserId,
                    sender_type: "system",
                    channel: "whatsapp",
                    message_type: "automatic",
                    direction: "outbound",
                    body: replyText,
                    status: sentMessageId ? "sent" : "error",
                    provider: "wazzup",
                    provider_message_id: sentMessageId,
                    provider_response: wazzupBody,
                    automation_mode: true,
                    active_session_id: convMode.active_session_id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: {
                      chat_id: chatId,
                      channel_id: waCfg.channel_id_uuid,
                      chat_type: "whatsapp",
                      message_type: "text",
                      source: "auto_mode_reply",
                      session_id: convMode.active_session_id,
                      stage: processData.stage,
                    },
                  });
                } else {
                  logs.push("auto_mode_no_wa_config");
                }
              }
            } else {
              // ── Smart Assistant: analyze inbound when no automatic session active ──
              // Check if smart assistant is enabled for this conversation
              const { data: saConfig } = await supabase
                .from("contact_center_smart_assistant_config")
                .select("smart_assistant_enabled, smart_assistant_status, paused_until, last_processed_message_id, is_processing")
                .eq("agent_user_id", agentUserId)
                .maybeSingle();

              const saEnabled = saConfig?.smart_assistant_enabled ?? false;
              const saPaused = saConfig?.paused_until && new Date(saConfig.paused_until) > new Date();
              const saStatus = saConfig?.smart_assistant_status || "inactive";

              if (saEnabled && !saPaused && saStatus === "active" && !saConfig?.is_processing) {
                logs.push("smart_assistant_triggering_analysis");

                // Load last 5 messages for context
                const { data: contextMsgs } = await supabase
                  .from("contact_center_messages")
                  .select("id, body, sender_type, created_at")
                  .eq("agent_user_id", agentUserId)
                  .order("created_at", { ascending: false })
                  .limit(10);

                const messagesContext = (contextMsgs || []).reverse().map((m: Record<string, unknown>) => ({
                  id: m.id as string,
                  text: (m.body as string) || "",
                  sender_type: (m.sender_type as string) || "contact",
                  created_at: (m.created_at as string) || new Date().toISOString(),
                }));

                const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

                const saRes = await fetch(
                  `${supabaseUrl}/functions/v1/contact-center-smart-assistant`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${serviceKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      action: "analyze_message",
                      agent_user_id: agentUserId,
                      message_text: messageBody.trim(),
                      message_id: insertedMsg.id,
                      messages_context: messagesContext,
                    }),
                  }
                );

                const saData = await saRes.json();
                logs.push(`smart_assistant_result=action:${saData.action || "none"}_conf:${saData.confidence || 0}_intent:${saData.intent || "none"}`);

                // If stop was requested, send the stop message via WhatsApp
                if (saData.action === "stop_assistant" && saData.stop_message) {
                  const { data: waCfg } = await supabase
                    .from("whatsapp_configuracion")
                    .select("api_key, channel_id_uuid, activo")
                    .eq("activo", true)
                    .maybeSingle();

                  if (waCfg?.api_key && waCfg?.channel_id_uuid) {
                    const chatId = (msg.chatId as string) || chatDigits;
                    const stopRes = await fetch("https://api.wazzup24.com/v3/message", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${waCfg.api_key}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        channelId: waCfg.channel_id_uuid,
                        chatId,
                        chatType: "whatsapp",
                        text: saData.stop_message,
                      }),
                    });

                    const stopBody = await stopRes.json();
                    logs.push(`smart_assistant_stop_sent=${stopBody?.messageId || "no_id"}`);

                    await supabase.from("contact_center_messages").insert({
                      agent_user_id: agentUserId,
                      sender_type: "system",
                      channel: "whatsapp",
                      message_type: "automatic",
                      direction: "outbound",
                      body: saData.stop_message,
                      status: stopBody?.messageId ? "sent" : "error",
                      provider: "wazzup",
                      provider_message_id: stopBody?.messageId || null,
                      provider_response: stopBody,
                      automation_mode: true,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      metadata: {
                        chat_id: chatId,
                        channel_id: waCfg.channel_id_uuid,
                        chat_type: "whatsapp",
                        message_type: "text",
                        source: "smart_assistant_stop",
                      },
                    });
                  }
                }

                // If auto-activate, start the automatic agent session
                if (saData.action === "activate_automatic_agent" && saData.matched_assistant_id) {
                  const { data: waCfg } = await supabase
                    .from("whatsapp_configuracion")
                    .select("api_key, channel_id_uuid, activo")
                    .eq("activo", true)
                    .maybeSingle();

                  if (waCfg?.api_key && waCfg?.channel_id_uuid) {
                    // Load global settings for first message template
                    const { data: globalSettings } = await supabase
                      .from("smart_assistant_global_settings")
                      .select("response_first_message, ai_message_signature_enabled, ai_message_signature_text")
                      .limit(1)
                      .maybeSingle();

                    let firstMsg = globalSettings?.response_first_message ||
                      "Hola, puedo ayudarte de dos formas:\n1. Llenar el formulario en línea\n2. Responder las preguntas por aquí\n¿Qué prefieres?";

                    // Append signature
                    if (globalSettings?.ai_message_signature_enabled !== false) {
                      const sig = globalSettings?.ai_message_signature_text || "- 🤖 MOVI IA";
                      if (!firstMsg.trim().endsWith(sig)) {
                        firstMsg = `${firstMsg.trim()}\n\n${sig}`;
                      }
                    }

                    // Activate the automatic agent session
                    const activateRes = await fetch(
                      `${supabaseUrl}/functions/v1/contact-center-assistant-process`,
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${serviceKey}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          action: "start_session",
                          agent_user_id: agentUserId,
                          assistant_id: saData.matched_assistant_id,
                        }),
                      }
                    );

                    const activateData = await activateRes.json();
                    logs.push(`smart_assistant_activated_session=${activateData.session_id || "error"}`);

                    // Send first message via WhatsApp
                    const chatId = (msg.chatId as string) || chatDigits;
                    const firstRes = await fetch("https://api.wazzup24.com/v3/message", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${waCfg.api_key}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        channelId: waCfg.channel_id_uuid,
                        chatId,
                        chatType: "whatsapp",
                        text: firstMsg,
                      }),
                    });

                    const firstBody = await firstRes.json();
                    logs.push(`smart_assistant_first_msg_sent=${firstBody?.messageId || "no_id"}`);

                    await supabase.from("contact_center_messages").insert({
                      agent_user_id: agentUserId,
                      sender_type: "system",
                      channel: "whatsapp",
                      message_type: "automatic",
                      direction: "outbound",
                      body: firstMsg,
                      status: firstBody?.messageId ? "sent" : "error",
                      provider: "wazzup",
                      provider_message_id: firstBody?.messageId || null,
                      provider_response: firstBody,
                      automation_mode: true,
                      active_session_id: activateData.session_id || null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      metadata: {
                        chat_id: chatId,
                        channel_id: waCfg.channel_id_uuid,
                        chat_type: "whatsapp",
                        message_type: "text",
                        source: "smart_assistant_auto_activate",
                        intent: saData.intent,
                        confidence: saData.confidence,
                      },
                    });
                  }
                }
              } else {
                logs.push(`smart_assistant_skip_enabled=${saEnabled}_paused=${saPaused}_status=${saStatus}`);
              }
            }
          } catch (autoErr) {
            logs.push(`auto_mode_error=${autoErr instanceof Error ? autoErr.message : String(autoErr)}`);
          }
        }

        // Notify staff for inbound messages
        if (isInbound) {
          const displayName = agentName || contactNameFromMsg || contactPhone || "Contacto externo";
          const preview = messageBody.length > 60 ? messageBody.slice(0, 60) + "..." : messageBody;
          const notifiedIds = new Set<string>();

          if (agentUserId) {
            // Notify employees/ejecutivos with open tramites for this agent
            const { data: asignaciones } = await supabase
              .from("ticket_asignaciones")
              .select("ejecutivo_id, ticket_id, tickets!inner(cerrado, agente_usuario_id)")
              .eq("tickets.agente_usuario_id", agentUserId)
              .eq("tickets.cerrado", false);

            if (asignaciones) {
              for (const asig of asignaciones) {
                if (asig.ejecutivo_id) notifiedIds.add(asig.ejecutivo_id);
              }
            }
            // Also notify admins and gerentes
            const { data: officeAdmins } = await supabase
              .from("usuarios")
              .select("id")
              .in("rol", ["Administrador", "Gerente"])
              .eq("activo", true);
            if (officeAdmins) {
              for (const a of officeAdmins) notifiedIds.add(a.id);
            }
          } else {
            // External/unassigned: notify all Admins and Gerentes
            const { data: admins } = await supabase
              .from("usuarios")
              .select("id")
              .in("rol", ["Administrador", "Gerente"])
              .eq("activo", true);
            if (admins) {
              for (const a of admins) notifiedIds.add(a.id);
            }
          }

          if (notifiedIds.size > 0) {
            const notifications = [...notifiedIds].map(uid => ({
              usuario_id: uid,
              titulo: `WhatsApp de ${displayName}`,
              mensaje: preview,
              tipo: "info",
              modulo: "Centro de Contacto",
              accion_url: "/centro-contacto",
              accion_texto: "Ver conversacion",
              leida: false,
              prioridad: "normal",
              metadata: { agent_user_id: agentUserId, contact_phone: contactPhone, message_id: msg.messageId },
            }));
            const { error: notifErr } = await supabase.from("notificaciones").insert(notifications);
            logs.push(`notified_${notifiedIds.size}_users${notifErr ? `_err=${notifErr.message}` : ""}`);
          }
        }
      }
    }

    await logWebhookEvent(supabase, {
      receivedAt,
      method: req.method,
      bodyRaw: rawBody.length > 10000 ? rawBody.substring(0, 10000) + "...[truncated]" : rawBody,
      payload: parsedPayload,
      messagesCount: Array.isArray(parsedPayload?.messages) ? (parsedPayload!.messages as unknown[]).length : 0,
      statusesCount: Array.isArray(parsedPayload?.statuses) ? (parsedPayload!.statuses as unknown[]).length : 0,
      logs,
      error: null,
    });

    return new Response(JSON.stringify({ ok: true, logs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logs.push(`catch_error=${errMsg}`);

    await logWebhookEvent(supabase, {
      receivedAt,
      method: req.method,
      bodyRaw: rawBody.length > 10000 ? rawBody.substring(0, 10000) + "...[truncated]" : rawBody,
      payload: parsedPayload,
      messagesCount: 0,
      statusesCount: 0,
      logs,
      error: errMsg,
    });

    return new Response(JSON.stringify({ ok: true, error: errMsg, logs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  opts: {
    receivedAt: string;
    method: string;
    bodyRaw: string;
    payload: Record<string, unknown> | null;
    messagesCount: number;
    statusesCount: number;
    logs: string[];
    error: string | null;
  }
) {
  try {
    await supabase.from("wazzup_webhook_logs").insert({
      received_at: opts.receivedAt,
      method: opts.method,
      body_raw: opts.bodyRaw,
      payload: opts.payload,
      messages_count: opts.messagesCount,
      statuses_count: opts.statusesCount,
      processing_logs: opts.logs,
      error: opts.error,
    });
  } catch {
    // Never throw from logging — fail silently
  }
}
