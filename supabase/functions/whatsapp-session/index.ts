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
            }
            return json({
              session: session
                ? {
                    ...session,
                    status: statusData.connected ? "connected" : session.status,
                  }
                : { status: "disconnected" },
              server_configured: true,
              provider_configured: true,
            });
          }
        } catch {
          // Server unreachable, return DB state
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
        const { data: convs } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .eq("user_id", user.id)
          .order("last_message_at", { ascending: false });

        return json({ conversations: convs || [] });
      }

      case "get-messages": {
        const conversationId = body.conversationId;
        if (!conversationId) return err("Missing conversationId");

        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(100);

        // Mark as read
        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0 })
          .eq("id", conversationId)
          .eq("user_id", user.id);

        return json({ messages: msgs || [] });
      }

      case "send-message": {
        const { to, message } = body;
        if (!to || !message) return err("Missing to or message");

        if (!serverConfigured) {
          return json({ error: "Server not configured", success: false });
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
              body: JSON.stringify({ to, message }),
            }
          );

          if (sendResp.ok) {
            const sendData = await sendResp.json();

            // Find or create conversation
            const { data: conv } = await supabase
              .from("whatsapp_conversations")
              .select("id")
              .eq("user_id", user.id)
              .eq("remote_phone", to)
              .maybeSingle();

            const convId = conv?.id || crypto.randomUUID();
            if (!conv) {
              await supabase.from("whatsapp_conversations").insert({
                id: convId,
                user_id: user.id,
                remote_phone: to,
                last_message_text: message,
                last_message_at: new Date().toISOString(),
              });
            } else {
              await supabase
                .from("whatsapp_conversations")
                .update({
                  last_message_text: message,
                  last_message_at: new Date().toISOString(),
                })
                .eq("id", convId);
            }

            // Store message
            await supabase.from("whatsapp_messages").insert({
              conversation_id: convId,
              user_id: user.id,
              direction: "outbound",
              message_type: "text",
              content: message,
              status: "sent",
              external_id: sendData.messageId || sendData.id || null,
            });

            return json({ success: true, messageId: sendData.messageId || sendData.id });
          } else {
            return json({ success: false, error: "Failed to send message" });
          }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Unknown error";
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

      default:
        return err(`Unknown action: ${action}`);
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: errorMsg, success: false }, 500);
  }
});
