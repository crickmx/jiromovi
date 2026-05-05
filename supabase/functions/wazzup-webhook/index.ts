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
        logs.push(`msg_${msg.messageId}_status=${msg.status}_echo=${msg.isEcho}_inbound=${isInbound}`);

        if (!isInbound) {
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

        if (!agentUserId) {
          logs.push(`skipping_no_agent`);
          continue;
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

        const messageBody = msg.text || (msg.contentUri ? `[${msg.type}]` : `[${msg.type}]`);

        const { error: insertErr } = await supabase
          .from("contact_center_messages")
          .insert({
            agent_user_id: agentUserId,
            sender_type: "user",
            channel: "whatsapp",
            message_type: "manual",
            direction: "inbound",
            body: messageBody,
            status: "received",
            provider: "wazzup",
            provider_message_id: msg.messageId,
            provider_response: msg,
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
            },
          });

        if (insertErr) {
          logs.push(`insert_error=${insertErr.message}`);
        } else {
          logs.push(`inserted_${msg.messageId}`);

          // Notify employees/admins related to this agent's open tramites
          const displayName = agentName || "Agente";
          const { data: asignaciones } = await supabase
            .from("ticket_asignaciones")
            .select("ejecutivo_id, ticket_id, tickets!inner(cerrado, agente_usuario_id)")
            .eq("tickets.agente_usuario_id", agentUserId)
            .eq("tickets.cerrado", false);

          const notifiedIds = new Set<string>();

          if (asignaciones && asignaciones.length > 0) {
            for (const asig of asignaciones) {
              if (asig.ejecutivo_id && !notifiedIds.has(asig.ejecutivo_id)) {
                notifiedIds.add(asig.ejecutivo_id);
              }
            }
          }

          // Also notify admins from the agent's office
          if (agentUserId) {
            const { data: agentInfo } = await supabase
              .from("usuarios")
              .select("oficina_id")
              .eq("id", agentUserId)
              .maybeSingle();

            if (agentInfo?.oficina_id) {
              const { data: admins } = await supabase
                .from("usuarios")
                .select("id")
                .eq("oficina_id", agentInfo.oficina_id)
                .in("rol", ["Administrador", "Gerente"])
                .eq("activo", true);

              if (admins) {
                for (const admin of admins) {
                  if (!notifiedIds.has(admin.id)) {
                    notifiedIds.add(admin.id);
                  }
                }
              }
            }
          }

          // Insert bell notifications
          if (notifiedIds.size > 0) {
            const preview = messageBody.length > 60 ? messageBody.slice(0, 60) + "..." : messageBody;
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
              metadata: { agent_user_id: agentUserId, message_id: msg.messageId },
            }));

            const { error: notifErr } = await supabase
              .from("notificaciones")
              .insert(notifications);

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
