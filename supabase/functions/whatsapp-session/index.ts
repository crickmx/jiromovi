import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message, success: false }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Missing authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return err("Unauthorized", 401);

    const body = await req.json();
    const action = body.action;

    const WHATSAPP_SERVER_URL = Deno.env.get("WHATSAPP_SERVER_URL") || "";
    const WHATSAPP_SERVER_API_KEY = Deno.env.get("WHATSAPP_SERVER_API_KEY") || "";

    const serverConfigured = !!(WHATSAPP_SERVER_URL && WHATSAPP_SERVER_API_KEY);

    switch (action) {
      case "get-status": {
        const { data: session } = await supabase
          .from("whatsapp_sessions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!serverConfigured) {
          return json({
            session: session || { status: "disconnected" },
            server_configured: false,
            provider_configured: false,
          });
        }

        // Check real status from WhatsApp server
        try {
          const statusResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/status`,
            {
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
            }
          );
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            if (statusData.connected && session) {
              await supabase
                .from("whatsapp_sessions")
                .update({
                  status: "connected",
                  phone_number: statusData.phone || statusData.phone_number || session.phone_number,
                  connected_at: session.connected_at || new Date().toISOString(),
                  last_activity_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", session.id);
            } else if (!statusData.connected && session && session.status !== 'disconnected') {
              // Server says not connected - update DB to reflect reality
              await supabase
                .from("whatsapp_sessions")
                .update({
                  status: "disconnected",
                  disconnected_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", session.id);
            }
            const resolvedStatus = statusData.connected ? "connected" : "disconnected";
            return json({
              session: session
                ? { ...session, status: resolvedStatus }
                : { status: "disconnected" },
              server_configured: true,
              provider_configured: true,
            });
          }
        } catch {
          // Server unreachable - if session is in a transient state, mark as disconnected
          if (session && (session.status === 'qr_pending' || session.status === 'connecting')) {
            const updatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0;
            const staleMs = Date.now() - updatedAt;
            if (staleMs > 120_000) {
              await supabase
                .from("whatsapp_sessions")
                .update({ status: "disconnected", updated_at: new Date().toISOString() })
                .eq("id", session.id);
              return json({
                session: { ...session, status: "disconnected" },
                server_configured: serverConfigured,
                provider_configured: serverConfigured,
              });
            }
          }
        }

        return json({
          session: session || { status: "disconnected" },
          server_configured: serverConfigured,
          provider_configured: serverConfigured,
        });
      }

      case "connect": {
        if (!serverConfigured) {
          return json({
            error: "WhatsApp server not configured",
            success: false,
            server_configured: false,
          });
        }

        // Force-disconnect any stale session first
        try {
          await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/disconnect`,
            {
              method: "POST",
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(5000),
            }
          );
          await new Promise(r => setTimeout(r, 1000));
        } catch {
          // Best effort - continue even if disconnect fails
        }

        // Upsert session record
        const { data: existing } = await supabase
          .from("whatsapp_sessions")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const sessionId = existing?.id || crypto.randomUUID();

        if (existing) {
          await supabase
            .from("whatsapp_sessions")
            .update({
              status: "qr_pending",
              error_message: null,
              session_data: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
        } else {
          await supabase.from("whatsapp_sessions").insert({
            id: sessionId,
            user_id: user.id,
            status: "qr_pending",
          });
        }

        // Request QR from WhatsApp server
        try {
          const connectResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/connect`,
            {
              method: "POST",
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ sessionId: user.id }),
              signal: AbortSignal.timeout(20000),
            }
          );

          if (connectResp.ok) {
            const connectData = await connectResp.json();
            let qrCode = connectData.qrBase64 || connectData.qr_code || connectData.qrCode || connectData.qr || null;

            // If no QR from connect response, the server might still be generating it
            // Wait briefly and check the /qr endpoint
            if (!qrCode && !connectData.connected) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const qrResp = await fetch(
                  `${WHATSAPP_SERVER_URL}/session/${user.id}/qr`,
                  {
                    headers: {
                      "x-api-key": WHATSAPP_SERVER_API_KEY,
                      "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(8000),
                  }
                );
                if (qrResp.ok) {
                  const qrData = await qrResp.json();
                  qrCode = qrData.qrBase64 || qrData.qr_code || qrData.qrCode || qrData.qr || null;
                }
              } catch {
                // Continue without QR
              }
            }

            if (qrCode) {
              await supabase
                .from("whatsapp_sessions")
                .update({
                  session_data: { qr_code: qrCode },
                  status: "qr_pending",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", sessionId);
            }

            await supabase.from("whatsapp_audit_log").insert({
              user_id: user.id,
              action: "qr_generated",
              details: { initiated_from: "mi_whatsapp_ui", had_qr: !!qrCode },
            });

            return json({
              success: true,
              qr_code: qrCode,
              server_configured: true,
              message: qrCode
                ? "QR generado exitosamente"
                : "Esperando QR del servidor...",
            });
          } else {
            const errorText = await connectResp.text();
            await supabase
              .from("whatsapp_sessions")
              .update({
                status: "error",
                error_message: `Server error: ${connectResp.status}`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);

            return json({
              error: `Server returned ${connectResp.status}: ${errorText.slice(0, 200)}`,
              success: false,
              server_configured: true,
            });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
          await supabase
            .from("whatsapp_sessions")
            .update({
              status: "error",
              error_message: `Connection failed: ${errorMsg}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);

          return json({
            error: `Cannot reach WhatsApp server: ${errorMsg}`,
            success: false,
            server_configured: true,
          });
        }
      }

      case "get-qr": {
        if (!serverConfigured) {
          return json({ qr_code: null, connected: false });
        }

        // Poll the server up to 3 times with 2s delay to catch QR generation
        const MAX_ATTEMPTS = 3;
        const DELAY_MS = 2000;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          // Check if already connected
          try {
            const statusResp = await fetch(
              `${WHATSAPP_SERVER_URL}/session/${user.id}/status`,
              {
                headers: {
                  "x-api-key": WHATSAPP_SERVER_API_KEY,
                  "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(8000),
              }
            );

            if (statusResp.ok) {
              const statusData = await statusResp.json();
              if (statusData.connected) {
                await supabase
                  .from("whatsapp_sessions")
                  .update({
                    status: "connected",
                    phone_number: statusData.phone || statusData.phone_number || null,
                    device_name: statusData.name || statusData.device_name || null,
                    connected_at: new Date().toISOString(),
                    session_data: null,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", user.id);

                await supabase.from("whatsapp_audit_log").insert({
                  user_id: user.id,
                  action: "connected",
                  details: { phone: statusData.phone || statusData.phone_number },
                });

                return json({ connected: true, qr_code: null });
              }
            }
          } catch {
            // Server unreachable
          }

          // Try to get fresh QR
          try {
            const qrResp = await fetch(
              `${WHATSAPP_SERVER_URL}/session/${user.id}/qr`,
              {
                headers: {
                  "x-api-key": WHATSAPP_SERVER_API_KEY,
                  "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(8000),
              }
            );

            if (qrResp.ok) {
              const qrData = await qrResp.json();
              const qrCode = qrData.qrBase64 || qrData.qr_code || qrData.qrCode || qrData.qr || null;

              if (qrCode) {
                await supabase
                  .from("whatsapp_sessions")
                  .update({
                    session_data: { qr_code: qrCode },
                    status: "qr_pending",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", user.id);

                return json({ qr_code: qrCode, connected: false });
              }
            }
          } catch {
            // QR endpoint failed
          }

          // If no QR yet and we have retries left, wait before trying again
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise(r => setTimeout(r, DELAY_MS));
          }
        }

        // Fallback: return stored QR from session_data
        const { data: session } = await supabase
          .from("whatsapp_sessions")
          .select("session_data, status")
          .eq("user_id", user.id)
          .maybeSingle();

        const storedQr = session?.session_data?.qr_code || null;
        return json({
          qr_code: storedQr,
          connected: session?.status === "connected",
        });
      }

      case "disconnect": {
        // Tell server to disconnect
        if (serverConfigured) {
          try {
            await fetch(
              `${WHATSAPP_SERVER_URL}/session/${user.id}/disconnect`,
              {
                method: "POST",
                headers: {
                  "x-api-key": WHATSAPP_SERVER_API_KEY,
                  "Content-Type": "application/json",
                },
              }
            );
          } catch {
            // Best effort
          }
        }

        await supabase
          .from("whatsapp_sessions")
          .update({
            status: "disconnected",
            disconnected_at: new Date().toISOString(),
            session_data: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        await supabase.from("whatsapp_audit_log").insert({
          user_id: user.id,
          action: "disconnected",
          details: { initiated_from: "mi_whatsapp_ui" },
        });

        return json({ success: true });
      }

      case "get-conversations": {
        const PAGE_SIZE = 50;
        const convOffset = typeof body.offset === "number" ? body.offset : 0;

        // First get from DB with pagination
        const { data: convs } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .eq("user_id", user.id)
          .order("last_message_at", { ascending: false })
          .range(convOffset, convOffset + PAGE_SIZE - 1);

        // Count total for hasMore
        const { count: totalCount } = await supabase
          .from("whatsapp_conversations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        const hasMore = (totalCount || 0) > convOffset + PAGE_SIZE;

        // If DB has conversations, return them
        if (convs && convs.length > 0) {
          return json({ conversations: convs, hasMore, total: totalCount });
        }

        // If DB is empty and first page, try to fetch live conversations from server
        if (serverConfigured && convOffset === 0) {
          try {
            const liveResp = await fetch(
              `${WHATSAPP_SERVER_URL}/session/${user.id}/conversations`,
              {
                headers: {
                  "x-api-key": WHATSAPP_SERVER_API_KEY,
                  "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(8000),
              }
            );

            if (liveResp.ok) {
              const liveData = await liveResp.json();
              const liveConvs = liveData.conversations || [];

              if (liveConvs.length > 0) {
                // Get session ID
                const { data: sessionRow } = await supabase
                  .from("whatsapp_sessions")
                  .select("id")
                  .eq("user_id", user.id)
                  .maybeSingle();

                if (sessionRow) {
                  // Sync live conversations to DB (insert only new ones)
                  for (const c of liveConvs as { phone: string; name?: string; lastMessage?: string; lastMessageAt?: string; unreadCount?: number }[]) {
                    const { data: existing } = await supabase
                      .from("whatsapp_conversations")
                      .select("id")
                      .eq("user_id", user.id)
                      .eq("remote_phone", c.phone)
                      .maybeSingle();

                    if (!existing) {
                      await supabase.from("whatsapp_conversations").insert({
                        user_id: user.id,
                        session_id: sessionRow.id,
                        remote_phone: c.phone,
                        remote_name: c.name || null,
                        last_message_text: c.lastMessage || null,
                        last_message_at: c.lastMessageAt || new Date().toISOString(),
                        unread_count: c.unreadCount || 0,
                      });
                    }
                  }

                  // Re-fetch from DB with pagination
                  const { data: freshConvs } = await supabase
                    .from("whatsapp_conversations")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("last_message_at", { ascending: false })
                    .range(0, PAGE_SIZE - 1);

                  const { count: freshCount } = await supabase
                    .from("whatsapp_conversations")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", user.id);

                  return json({ conversations: freshConvs || [], hasMore: (freshCount || 0) > PAGE_SIZE, total: freshCount });
                }
              }
            }
          } catch {
            // Server unreachable, return empty
          }
        }

        return json({ conversations: [], hasMore: false, total: 0 });
      }

      case "get-messages": {
        const conversationId = body.conversationId;
        if (!conversationId) return err("Missing conversationId");

        const limit = body.limit || 100;
        const before = body.before; // cursor: load messages before this timestamp

        // Build query - Supabase is primary source
        let query = supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
          .order("message_timestamp", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limit);

        if (before) {
          query = query.lt("message_timestamp", before);
        }

        const { data: dbMsgs } = await query;

        let messages = (dbMsgs || []).reverse();

        // ── Fallback: fetch from whatsapp-server when DB is empty ──────────
        // This happens on first open before messages have been persisted
        if (messages.length === 0 && !before && serverConfigured) {
          try {
            // Get conversation to find remote_phone
            const { data: conv } = await supabase
              .from("whatsapp_conversations")
              .select("remote_phone")
              .eq("id", conversationId)
              .eq("user_id", user.id)
              .maybeSingle();

            if (conv?.remote_phone) {
              const serverResp = await fetch(
                `${WHATSAPP_SERVER_URL}/session/${user.id}/messages/${encodeURIComponent(conv.remote_phone)}?limit=${limit}`,
                {
                  headers: { "x-api-key": WHATSAPP_SERVER_API_KEY },
                  signal: AbortSignal.timeout(8000),
                }
              );

              if (serverResp.ok) {
                const serverData = await serverResp.json();
                const serverMsgs: any[] = serverData.messages || [];

                if (serverMsgs.length > 0) {
                  // Persist to DB so future loads are instant
                  const toInsert = serverMsgs.map((m: any) => ({
                    conversation_id: conversationId,
                    user_id: user.id,
                    direction: m.direction || (m.fromMe ? "outbound" : "inbound"),
                    message_type: m.type || m.message_type || "text",
                    content: m.body || m.content || null,
                    media_url: m.mediaUrl || m.media_url || null,
                    media_mime_type: m.mimetype || m.media_mime_type || null,
                    media_filename: m.filename || m.media_filename || null,
                    media_caption: m.caption || m.media_caption || null,
                    media_thumbnail_url: m.thumbnailUrl || m.media_thumbnail_url || null,
                    wa_message_id: m.id || m.wa_message_id || null,
                    status: m.status || (m.fromMe ? "sent" : "read"),
                    message_timestamp: m.timestamp
                      ? new Date(m.timestamp * 1000).toISOString()
                      : m.message_timestamp || m.created_at || new Date().toISOString(),
                    metadata: m.metadata || null,
                  }));

                  // Upsert to avoid duplicates (wa_message_id is unique per user)
                  const { data: saved } = await supabase
                    .from("whatsapp_messages")
                    .upsert(toInsert, {
                      onConflict: "user_id,wa_message_id",
                      ignoreDuplicates: true,
                    })
                    .select("*");

                  messages = (saved || toInsert).sort((a: any, b: any) => {
                    const ta = a.message_timestamp || a.created_at || "";
                    const tb = b.message_timestamp || b.created_at || "";
                    return ta < tb ? -1 : ta > tb ? 1 : 0;
                  });
                }
              }
            }
          } catch {
            // Server unreachable — return empty, DB messages already in `messages`
          }
        }

        // Mark as read (only on first load, not on pagination)
        if (!before) {
          await supabase
            .from("whatsapp_conversations")
            .update({ unread_count: 0 })
            .eq("id", conversationId)
            .eq("user_id", user.id);
        }

        // Determine if there are older messages available
        const hasMore = messages.length === limit;
        const oldestTimestamp = messages.length > 0
          ? (messages[0].message_timestamp || messages[0].created_at)
          : null;

        return json({
          messages,
          hasMore,
          oldestTimestamp,
          total: messages.length,
        });
      }

      case "send-message": {
        const { to, message, conversationId } = body;
        if (!to || !message) return err("Missing to or message");

        if (!serverConfigured) {
          return json({ error: "Servidor de WhatsApp no configurado", success: false });
        }

        // Normalize phone: remove non-digits, ensure country code
        let normalizedPhone = (to as string).replace(/\D/g, "");
        if (normalizedPhone.startsWith("+")) normalizedPhone = normalizedPhone.slice(1);
        if (normalizedPhone.length === 10) normalizedPhone = `52${normalizedPhone}`;
        if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52") && !normalizedPhone.startsWith("521")) {
          normalizedPhone = `521${normalizedPhone.slice(2)}`;
        }
        if (!normalizedPhone || normalizedPhone.length < 10) {
          return json({ success: false, error: "Numero de telefono invalido" });
        }

        // Verify session is connected before sending
        try {
          const statusResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/status`,
            {
              headers: { "x-api-key": WHATSAPP_SERVER_API_KEY, "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            if (!statusData.connected) {
              return json({ success: false, error: "Tu WhatsApp no esta conectado. Vuelve a escanear el QR para enviar mensajes.", disconnected: true });
            }
          }
        } catch {
          return json({ success: false, error: "No se pudo verificar la conexion de WhatsApp" });
        }

        try {
          const sendResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/send-message`,
            {
              method: "POST",
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ to: normalizedPhone, message }),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (sendResp.ok) {
            const sendData = await sendResp.json();
            const waMessageId = sendData.messageId || sendData.id || null;

            // Find or create conversation
            const { data: conv } = await supabase
              .from("whatsapp_conversations")
              .select("id, session_id")
              .eq("user_id", user.id)
              .eq("remote_phone", normalizedPhone)
              .maybeSingle();

            let convId = conv?.id || conversationId;

            if (!conv) {
              // Get session ID for FK
              const { data: sessionRow } = await supabase
                .from("whatsapp_sessions")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

              convId = convId || crypto.randomUUID();
              await supabase.from("whatsapp_conversations").insert({
                id: convId,
                user_id: user.id,
                session_id: sessionRow?.id || null,
                remote_phone: normalizedPhone,
                last_message_text: message.slice(0, 200),
                last_message_at: new Date().toISOString(),
              });
            } else {
              convId = conv.id;
              await supabase
                .from("whatsapp_conversations")
                .update({
                  last_message_text: message.slice(0, 200),
                  last_message_at: new Date().toISOString(),
                })
                .eq("id", convId);
            }

            // Store message (server also stores via saveOutboundMessage, use wa_message_id for dedup)
            if (waMessageId) {
              await supabase.from("whatsapp_messages").upsert({
                conversation_id: convId,
                user_id: user.id,
                direction: "outbound",
                message_type: "text",
                content: message,
                status: "sent",
                wa_message_id: waMessageId,
                message_timestamp: new Date().toISOString(),
              }, { onConflict: "user_id,wa_message_id", ignoreDuplicates: true });
            }

            return json({ success: true, messageId: waMessageId, conversationId: convId });
          } else {
            const errText = await sendResp.text().catch(() => "");
            return json({ success: false, error: `Error del servidor: ${sendResp.status} ${errText.slice(0, 100)}` });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Error desconocido";
          return json({ success: false, error: errorMsg });
        }
      }

      case "send-media": {
        const { to, mediaBase64, mimeType, filename, caption } = body;
        if (!to || !mediaBase64) return err("Missing to or media");

        if (!serverConfigured) {
          return json({ error: "Server not configured", success: false });
        }

        try {
          const sendResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/send-media`,
            {
              method: "POST",
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ to, mediaBase64, mimeType, filename, caption }),
            }
          );

          if (sendResp.ok) {
            const sendData = await sendResp.json();
            return json({ success: true, messageId: sendData.messageId || sendData.id });
          } else {
            return json({ success: false, error: "Failed to send media" });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
          return json({ success: false, error: errorMsg });
        }
      }

      case "get-contacts": {
        // Return all contacts for this user with resolved names
        const { data: contacts } = await supabase
          .from("whatsapp_contacts")
          .select("phone, display_name, push_name, notify_name, saved_name, local_alias, verified_name, business_name, is_business, profile_pic_url")
          .eq("user_id", user.id);

        // Build a phone->name map for quick lookup
        const contactMap: Record<string, { display_name: string; profile_pic_url: string | null; is_business: boolean }> = {};
        for (const c of contacts || []) {
          contactMap[c.phone] = {
            display_name: c.display_name || c.phone,
            profile_pic_url: c.profile_pic_url,
            is_business: c.is_business || false,
          };
        }

        return json({ contacts: contactMap });
      }

      case "set-contact-alias": {
        const { phone, alias } = body;
        if (!phone) return err("Missing phone");

        const normalizedPhone = (phone as string).replace(/\D/g, "");

        if (alias) {
          // Upsert contact with alias
          await supabase.from("whatsapp_contacts").upsert({
            user_id: user.id,
            phone: normalizedPhone,
            local_alias: alias,
          }, { onConflict: "user_id,phone" });
        } else {
          // Clear alias
          await supabase
            .from("whatsapp_contacts")
            .update({ local_alias: null })
            .eq("user_id", user.id)
            .eq("phone", normalizedPhone);
        }

        return json({ success: true });
      }

      case "retry-message": {
        const { originalMessageId, to: retryTo, message: retryMsg } = body;
        if (!retryTo || !retryMsg) return err("Missing to or message");

        // Delete the failed message
        if (originalMessageId) {
          await supabase
            .from("whatsapp_messages")
            .delete()
            .eq("id", originalMessageId)
            .eq("user_id", user.id);
        }

        // Re-send using the same logic as send-message (redirect internally)
        // Normalize phone
        let retryPhone = (retryTo as string).replace(/\D/g, "");
        if (retryPhone.length === 10) retryPhone = `52${retryPhone}`;
        if (retryPhone.length === 12 && retryPhone.startsWith("52") && !retryPhone.startsWith("521")) {
          retryPhone = `521${retryPhone.slice(2)}`;
        }

        if (!serverConfigured) {
          return json({ success: false, error: "Servidor no configurado" });
        }

        try {
          const sendResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/send-message`,
            {
              method: "POST",
              headers: { "x-api-key": WHATSAPP_SERVER_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ to: retryPhone, message: retryMsg }),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (sendResp.ok) {
            const sendData = await sendResp.json();
            return json({ success: true, messageId: sendData.messageId || sendData.id });
          } else {
            return json({ success: false, error: "Error al reenviar mensaje" });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Error desconocido";
          return json({ success: false, error: errorMsg });
        }
      }

      case "diagnose": {
        const diagnostics: Record<string, unknown> = {
          server_url: WHATSAPP_SERVER_URL ? `${WHATSAPP_SERVER_URL.slice(0, 30)}...` : "NOT SET",
          api_key_set: !!WHATSAPP_SERVER_API_KEY,
          server_configured: serverConfigured,
          user_id: user.id,
          timestamp: new Date().toISOString(),
        };

        if (!serverConfigured) {
          diagnostics.conclusion = "Server NOT configured - env vars missing";
          return json({ diagnostics });
        }

        // 1. Test health endpoint (no auth needed usually)
        try {
          const healthResp = await fetch(`${WHATSAPP_SERVER_URL}/health`, {
            signal: AbortSignal.timeout(10000),
          });
          diagnostics.health_status = healthResp.status;
          if (healthResp.ok) {
            diagnostics.health_body = await healthResp.json();
          } else {
            diagnostics.health_body = await healthResp.text();
          }
        } catch (e: unknown) {
          diagnostics.health_error = e instanceof Error ? e.message : "Unknown";
        }

        // 2. Test status endpoint
        try {
          const statusResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/status`,
            {
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
            }
          );
          diagnostics.status_http = statusResp.status;
          if (statusResp.ok) {
            diagnostics.status_body = await statusResp.json();
          } else {
            diagnostics.status_body = await statusResp.text();
          }
        } catch (e: unknown) {
          diagnostics.status_error = e instanceof Error ? e.message : "Unknown";
        }

        // 3. Test QR endpoint
        try {
          const qrResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/qr`,
            {
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
            }
          );
          diagnostics.qr_http = qrResp.status;
          if (qrResp.ok) {
            const qrData = await qrResp.json();
            diagnostics.qr_keys = Object.keys(qrData);
            diagnostics.qr_has_qr = !!qrData.qr;
            diagnostics.qr_has_qrBase64 = !!qrData.qrBase64;
            diagnostics.qr_status = qrData.status;
            diagnostics.qr_connected = qrData.connected;
            if (qrData.qrBase64) {
              diagnostics.qrBase64_length = qrData.qrBase64.length;
              diagnostics.qrBase64_prefix = qrData.qrBase64.slice(0, 40);
            }
            if (qrData.qr) {
              diagnostics.qr_length = qrData.qr.length;
              diagnostics.qr_prefix = qrData.qr.slice(0, 40);
            }
          } else {
            diagnostics.qr_body = await qrResp.text();
          }
        } catch (e: unknown) {
          diagnostics.qr_error = e instanceof Error ? e.message : "Unknown";
        }

        // 4. Check DB session state
        const { data: dbSession } = await supabase
          .from("whatsapp_sessions")
          .select("id, status, error_message, session_data, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();

        diagnostics.db_session = dbSession ? {
          id: dbSession.id,
          status: dbSession.status,
          error_message: dbSession.error_message,
          has_session_data: !!dbSession.session_data,
          has_qr_in_data: !!dbSession.session_data?.qr_code,
          updated_at: dbSession.updated_at,
        } : null;

        return json({ diagnostics });
      }

      case "sync-history": {
        // Trigger the whatsapp-server to re-sync its in-memory message store to Supabase
        if (!serverConfigured) {
          return json({ success: false, error: "Servidor no configurado" });
        }

        try {
          const syncResp = await fetch(
            `${WHATSAPP_SERVER_URL}/session/${user.id}/sync-history`,
            {
              method: "POST",
              headers: {
                "x-api-key": WHATSAPP_SERVER_API_KEY,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(30000),
            }
          );

          if (syncResp.ok) {
            const syncData = await syncResp.json();
            return json({ success: true, synced: syncData.synced || 0, total: syncData.total || 0 });
          } else {
            const errText = await syncResp.text().catch(() => "");
            return json({ success: false, error: `Server returned ${syncResp.status}: ${errText.slice(0, 100)}` });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
          return json({ success: false, error: errorMsg });
        }
      }

      default:
        return err(`Unknown action: ${action}`);
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: errorMsg, success: false }, 500);
  }
});
