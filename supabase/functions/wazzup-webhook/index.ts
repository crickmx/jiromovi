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
        logs.push(`msg_${msg.messageId}_status=${msg.status}_echo=${msg.isEcho}_inbound=${isInbound}_outEcho=${isOutboundEcho}`);

        if (!isInbound && !isOutboundEcho) {
          if (["sent", "delivered", "read"].includes(msg.status)) {
            await supabase
              .from("contact_center_messages")
              .update({ status: msg.status, updated_at: new Date().toISOString() })
              .eq("provider_message_id", msg.messageId);
            logs.push(`updated_outbound_${msg.messageId}`);
          }
          continue;
        }

        // Find user by phone - get last 10 digits
        const chatDigits = (msg.chatId || "").replace(/\D/g, "");
        const last10 = chatDigits.slice(-10);
        logs.push(`chatId=${msg.chatId}_last10=${last10}`);

        let agentUserId: string | null = null;
        let agentName: string | null = null;

        if (last10.length === 10) {
          const { data: users, error: userErr } = await supabase
            .from("usuarios")
            .select("id, nombre_completo, celular_laboral, celular_personal")
            .eq("activo", true);

          if (userErr) {
            logs.push(`user_query_error=${userErr.message}`);
          } else {
            logs.push(`users_fetched=${users?.length || 0}`);
            const match = users?.find((u: { celular_laboral?: string; celular_personal?: string }) => {
              const cel1 = (u.celular_laboral || "").replace(/\D/g, "");
              const cel2 = (u.celular_personal || "").replace(/\D/g, "");
              return cel1.slice(-10) === last10 || cel2.slice(-10) === last10;
            });
            if (match) {
              agentUserId = match.id;
              agentName = match.nombre_completo;
              logs.push(`matched_user=${match.id}_${match.nombre_completo}`);
            } else {
              logs.push(`no_user_match_for_${last10}`);
            }
          }
        }

        // For external contacts (no registered user match), store with contact_phone
        let contactPhone: string | null = null;
        let contactNameFromMsg: string | null = msg.contact?.name || null;
        if (!agentUserId) {
          if (last10.length === 10) {
            // Store as external contact conversation using full chatId digits
            contactPhone = chatDigits || last10;
            logs.push(`external_contact_phone=${contactPhone}`);
          } else {
            logs.push(`skipping_no_agent_no_phone`);
            continue;
          }
        }

        // Check duplicates
        const { data: existing } = await supabase
          .from("contact_center_messages")
          .select("id")
          .eq("provider_message_id", msg.messageId)
          .maybeSingle();

        if (existing) {
          logs.push(`duplicate_${msg.messageId}`);
          continue;
        }

        const hasMedia = !!msg.contentUri && msg.type !== "text";
        const mediaTypeLabels: Record<string, string> = {
          image: "Imagen",
          video: "Video",
          audio: "Audio",
          document: "Documento",
          sticker: "Sticker",
          voice: "Audio",
        };
        const mediaLabel = mediaTypeLabels[msg.type] || msg.type;
        const messageBody = msg.text || (hasMedia ? `[${mediaLabel}]` : "");

        const direction = isInbound ? "inbound" : "outbound";
        const status = isInbound ? "received" : "sent";
        const senderType = isInbound ? "user" : "system";

        const attachmentUrls = hasMedia ? [{ url: msg.contentUri, type: msg.type, name: msg.fileName || `${mediaLabel}` }] : null;

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
        } else {
          logs.push(`inserted_${msg.messageId}`);

          // Insert attachment record for media messages
          if (hasMedia && insertedMsg?.id) {
            const fileTypeMap: Record<string, string> = {
              image: "image",
              video: "video",
              audio: "audio",
              voice: "audio",
              document: "document",
              sticker: "image",
            };
            const fileName = msg.fileName || `${mediaLabel}_${Date.now()}`;
            const { error: attErr } = await supabase
              .from("contact_center_attachments")
              .insert({
                message_id: insertedMsg.id,
                agent_user_id: agentUserId,
                provider: "wazzup",
                provider_file_id: msg.messageId,
                file_name: fileName,
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
            if (attErr) {
              logs.push(`att_insert_error=${attErr.message}`);
            } else {
              logs.push(`att_inserted_for_${msg.messageId}`);
            }
          }

          // Notify relevant employees for inbound messages
          if (isInbound) {
            const displayName = agentName || contactNameFromMsg || contactPhone || "Contacto externo";
            const preview = messageBody.length > 60 ? messageBody.slice(0, 60) + "..." : messageBody;
            const notifiedIds = new Set<string>();

            if (agentUserId) {
              // Registered user: notify employees handling open tramites for this agent
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
            } else {
              // External contact: notify all Administrador and Gerente users
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

              const { error: notifErr } = await supabase
                .from("notificaciones")
                .insert(notifications);

              logs.push(`notified_${notifiedIds.size}_users${notifErr ? `_err=${notifErr.message}` : ""}`);
            }
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
