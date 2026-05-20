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
    return new Response(JSON.stringify({ ok: true }), {
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

  try {
    const rawBody = await req.text();
    logs.push(`body_length=${rawBody.length}`);

    if (!rawBody || rawBody.trim() === "") {
      return new Response(JSON.stringify({ ok: true, logs }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    logs.push(`keys=${Object.keys(payload).join(",")}`);

    // Handle status updates
    if (payload.statuses && Array.isArray(payload.statuses)) {
      for (const s of payload.statuses) {
        if (["sent", "delivered", "read"].includes(s.status)) {
          await supabase
            .from("contact_center_messages")
            .update({ status: s.status, updated_at: new Date().toISOString() })
            .eq("provider_message_id", s.messageId);
        }
      }
      logs.push(`statuses_processed=${payload.statuses.length}`);
    }

    // Load all active users once for phone matching (outbound echo only)
    let allUsers: Array<{ id: string; nombre_completo: string; celular_laboral?: string; celular_personal?: string }> = [];
    {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nombre_completo, celular_laboral, celular_personal")
        .eq("activo", true);
      allUsers = data || [];
    }

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

    // Handle messages
    if (payload.messages && Array.isArray(payload.messages)) {
      logs.push(`messages_count=${payload.messages.length}`);

      for (const msg of payload.messages) {
        if (msg.isDeleted || msg.isEdited) {
          logs.push(`skip_${msg.messageId}_deleted_or_edited`);
          continue;
        }

        const isInbound = msg.status === "inbound" && !msg.isEcho;
        const isOutboundEcho = msg.isEcho === true;

        logs.push(`msg_${msg.messageId}_status=${msg.status}_echo=${msg.isEcho}_inbound=${isInbound}`);

        // Non-echo outbound status updates only
        if (!isInbound && !isOutboundEcho) {
          if (["sent", "delivered", "read"].includes(msg.status)) {
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

        const chatDigits = (msg.chatId || "").replace(/\D/g, "");
        const contactNameFromMsg: string | null = msg.contact?.name || null;

        const hasMedia = !!msg.contentUri && msg.type !== "text";
        const mediaTypeLabels: Record<string, string> = {
          image: "Imagen", video: "Video", audio: "Audio",
          document: "Documento", sticker: "Sticker", voice: "Audio",
        };
        const mediaLabel = mediaTypeLabels[msg.type] || msg.type;
        const messageBody = msg.text || (hasMedia ? `[${mediaLabel}]` : "");
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
          // Match recipient to a registered user
          const matched = findUserByPhone(chatDigits);
          if (matched) {
            agentUserId = matched.id;
            agentName = matched.nombre_completo;
            logs.push(`echo_matched_agent=${matched.id}_${matched.nombre_completo}`);
          } else {
            // No user match for echo — try finding by prior outbound message to same chatId
            const { data: priorMsg } = await supabase
              .from("contact_center_messages")
              .select("agent_user_id, contact_phone")
              .eq("metadata->>chat_id", msg.chatId)
              .not("agent_user_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (priorMsg?.agent_user_id) {
              agentUserId = priorMsg.agent_user_id;
              logs.push(`echo_matched_via_prior_msg_agent=${agentUserId}`);
            } else {
              // Store as external contact echo
              contactPhone = chatDigits || null;
              logs.push(`echo_external_contact_phone=${contactPhone}`);
            }
          }
          direction = "outbound";
          status = "sent";
          senderType = "user";
        } else {
          // INBOUND: chatId is the SENDER (client/customer phone)
          // Strategy: look for prior outbound messages TO this chatId → that's the agent
          const { data: priorOutbound } = await supabase
            .from("contact_center_messages")
            .select("agent_user_id, contact_phone")
            .eq("metadata->>chat_id", msg.chatId)
            .eq("direction", "outbound")
            .not("agent_user_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (priorOutbound?.agent_user_id) {
            // This client has received outbound messages for this agent → link to that agent
            agentUserId = priorOutbound.agent_user_id;
            const agentRecord = allUsers.find(u => u.id === agentUserId);
            agentName = agentRecord?.nombre_completo || null;
            logs.push(`inbound_matched_agent_via_prior_outbound=${agentUserId}`);
          } else {
            // Check if chatId matches a registered user (agent replying from their own phone)
            const matchedUser = findUserByPhone(chatDigits);
            if (matchedUser) {
              agentUserId = matchedUser.id;
              agentName = matchedUser.nombre_completo;
              logs.push(`inbound_matched_registered_user=${matchedUser.id}`);
            } else {
              // Unknown sender → store as external contact
              contactPhone = chatDigits || null;
              logs.push(`inbound_external_contact_phone=${contactPhone}`);
            }
          }
          direction = "inbound";
          status = "received";
          senderType = "user";
        }

        // Skip if no agent and no phone to store with
        if (!agentUserId && !contactPhone) {
          logs.push(`skip_no_agent_no_phone_${msg.messageId}`);
          continue;
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
              contact_name: msg.contact?.name || null,
              sender_phone: msg.chatId,
              source: isOutboundEcho ? "wazzup_direct" : "whatsapp_inbound",
            },
          })
          .select("id")
          .maybeSingle();

        if (insertErr) {
          logs.push(`insert_error=${insertErr.message}`);
          continue;
        }

        logs.push(`inserted_${msg.messageId}_dir=${direction}`);

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
            file_type: fileTypeMap[msg.type] || "document",
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

        // Notify employees for inbound messages
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
            // Also notify admins and gerentes of the agent's office
            const agentRecord = allUsers.find(u => u.id === agentUserId);
            if (agentRecord) {
              const { data: officeAdmins } = await supabase
                .from("usuarios")
                .select("id, oficina_id")
                .in("rol", ["Administrador", "Gerente"])
                .eq("activo", true);
              if (officeAdmins) {
                for (const a of officeAdmins) notifiedIds.add(a.id);
              }
            }
          } else {
            // External contact: notify all Admins and Gerentes
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
              titulo: `Mensaje de WhatsApp de ${displayName}`,
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

    return new Response(JSON.stringify({ ok: true, logs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logs.push(`catch_error=${errMsg}`);
    return new Response(JSON.stringify({ ok: true, error: errMsg, logs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
