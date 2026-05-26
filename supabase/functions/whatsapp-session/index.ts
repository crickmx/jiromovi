import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  action:
    | "get-status"
    | "connect"
    | "disconnect"
    | "get-qr"
    | "send-message"
    | "get-conversations"
    | "get-messages";
  sessionId?: string;
  conversationId?: string;
  to?: string;
  message?: string;
  messageType?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user from the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const body: RequestBody = await req.json();
    const { action } = body;

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const hasEvolution = Boolean(evolutionUrl && evolutionKey);

    const instanceName = `movi_${userId.replace(/-/g, "").slice(0, 16)}`;

    switch (action) {
      case "get-status": {
        const { data: session } = await supabase
          .from("whatsapp_sessions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!session) {
          return json({ status: "no_session", session: null, provider_configured: hasEvolution });
        }

        // If Evolution API is configured, check real status
        if (hasEvolution && session.status === "connected") {
          try {
            const resp = await fetch(
              `${evolutionUrl}/instance/connectionState/${instanceName}`,
              { headers: { apikey: evolutionKey! } }
            );
            if (resp.ok) {
              const state = await resp.json();
              const realStatus = state.instance?.state === "open" ? "connected" : "disconnected";
              if (realStatus !== session.status) {
                await supabase.from("whatsapp_sessions").update({
                  status: realStatus,
                  ...(realStatus === "disconnected" ? { disconnected_at: new Date().toISOString() } : {}),
                }).eq("id", session.id);
                session.status = realStatus;
              }
            }
          } catch { /* ignore check errors */ }
        }

        return json({ status: session.status, session, provider_configured: hasEvolution });
      }

      case "connect": {
        // Create or update session
        const { data: existing } = await supabase
          .from("whatsapp_sessions")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          await supabase.from("whatsapp_sessions").update({
            status: "qr_pending",
            error_message: null,
          }).eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_sessions").insert({
            user_id: userId,
            status: "qr_pending",
          });
        }

        // Log audit
        await supabase.from("whatsapp_audit_log").insert({
          user_id: userId,
          action: "qr_generated",
          details: { provider: hasEvolution ? "evolution" : "demo" },
        });

        if (hasEvolution) {
          // Create Evolution API instance
          try {
            // Check if instance exists
            const checkResp = await fetch(
              `${evolutionUrl}/instance/connectionState/${instanceName}`,
              { headers: { apikey: evolutionKey! } }
            );

            if (!checkResp.ok || checkResp.status === 404) {
              // Create instance
              await fetch(`${evolutionUrl}/instance/create`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: evolutionKey!,
                },
                body: JSON.stringify({
                  instanceName,
                  qrcode: true,
                  integration: "WHATSAPP-BAILEYS",
                }),
              });
            }

            // Connect instance to get QR
            const connectResp = await fetch(
              `${evolutionUrl}/instance/connect/${instanceName}`,
              { headers: { apikey: evolutionKey! } }
            );

            if (connectResp.ok) {
              const connectData = await connectResp.json();
              const qrCode = connectData.base64 || connectData.qrcode?.base64 || null;
              return json({
                success: true,
                qr_code: qrCode,
                provider: "evolution",
              });
            }
          } catch (err) {
            await supabase.from("whatsapp_sessions").update({
              status: "error",
              error_message: `Error connecting to Evolution API: ${(err as Error).message}`,
            }).eq("user_id", userId);
            return json({ success: false, error: (err as Error).message }, 500);
          }
        }

        // Demo mode: generate a placeholder QR
        return json({
          success: true,
          qr_code: null,
          provider: "demo",
          message: "Evolution API no configurada. Configure EVOLUTION_API_URL y EVOLUTION_API_KEY para habilitar conexiones reales de WhatsApp.",
        });
      }

      case "get-qr": {
        if (!hasEvolution) {
          return json({
            qr_code: null,
            provider: "demo",
            message: "Configure Evolution API para obtener codigo QR real",
          });
        }

        try {
          const resp = await fetch(
            `${evolutionUrl}/instance/connect/${instanceName}`,
            { headers: { apikey: evolutionKey! } }
          );
          if (resp.ok) {
            const data = await resp.json();
            const qrCode = data.base64 || data.qrcode?.base64 || null;

            // Check if already connected (no QR means connected)
            if (!qrCode) {
              const stateResp = await fetch(
                `${evolutionUrl}/instance/connectionState/${instanceName}`,
                { headers: { apikey: evolutionKey! } }
              );
              if (stateResp.ok) {
                const state = await stateResp.json();
                if (state.instance?.state === "open") {
                  // Update session as connected
                  await supabase.from("whatsapp_sessions").update({
                    status: "connected",
                    connected_at: new Date().toISOString(),
                    error_message: null,
                  }).eq("user_id", userId);

                  await supabase.from("whatsapp_audit_log").insert({
                    user_id: userId,
                    action: "connect",
                    details: { provider: "evolution", instance: instanceName },
                  });

                  return json({ qr_code: null, connected: true });
                }
              }
            }

            return json({ qr_code: qrCode, connected: false });
          }
          return json({ qr_code: null, error: "Could not fetch QR" }, 500);
        } catch (err) {
          return json({ qr_code: null, error: (err as Error).message }, 500);
        }
      }

      case "disconnect": {
        await supabase.from("whatsapp_sessions").update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
          session_data: null,
        }).eq("user_id", userId);

        await supabase.from("whatsapp_audit_log").insert({
          user_id: userId,
          action: "disconnect",
          details: { instance: instanceName },
        });

        if (hasEvolution) {
          try {
            await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
              method: "DELETE",
              headers: { apikey: evolutionKey! },
            });
          } catch { /* best effort */ }
        }

        return json({ success: true });
      }

      case "send-message": {
        const { to, message, messageType = "text" } = body;
        if (!to || !message) {
          return json({ error: "Missing 'to' or 'message'" }, 400);
        }

        // Normalize phone number
        let phone = to.replace(/\D/g, "");
        if (phone.length === 10) phone = `52${phone}`;
        if (!phone.startsWith("52")) phone = `52${phone}`;

        // Save message to DB
        // Find or create conversation
        let { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("id, session_id")
          .eq("user_id", userId)
          .eq("remote_phone", phone)
          .maybeSingle();

        if (!conv) {
          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!session) {
            return json({ error: "No active session" }, 400);
          }

          const { data: newConv } = await supabase
            .from("whatsapp_conversations")
            .insert({
              user_id: userId,
              session_id: session.id,
              remote_phone: phone,
              last_message_text: message,
              last_message_at: new Date().toISOString(),
            })
            .select("id, session_id")
            .single();
          conv = newConv;
        } else {
          await supabase.from("whatsapp_conversations").update({
            last_message_text: message,
            last_message_at: new Date().toISOString(),
          }).eq("id", conv!.id);
        }

        const msgStatus = hasEvolution ? "pending" : "sent";
        const { data: savedMsg } = await supabase
          .from("whatsapp_messages")
          .insert({
            conversation_id: conv!.id,
            user_id: userId,
            direction: "outbound",
            message_type: messageType,
            content: message,
            status: msgStatus,
          })
          .select("id")
          .single();

        // Send via Evolution API if configured
        if (hasEvolution) {
          try {
            const sendResp = await fetch(
              `${evolutionUrl}/message/sendText/${instanceName}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: evolutionKey!,
                },
                body: JSON.stringify({
                  number: phone,
                  text: message,
                }),
              }
            );

            if (sendResp.ok) {
              const sendData = await sendResp.json();
              await supabase.from("whatsapp_messages").update({
                status: "sent",
                wa_message_id: sendData.key?.id || null,
              }).eq("id", savedMsg!.id);
            } else {
              await supabase.from("whatsapp_messages").update({
                status: "failed",
              }).eq("id", savedMsg!.id);
            }
          } catch {
            await supabase.from("whatsapp_messages").update({
              status: "failed",
            }).eq("id", savedMsg!.id);
          }
        }

        // Update session last activity
        await supabase.from("whatsapp_sessions").update({
          last_activity_at: new Date().toISOString(),
        }).eq("user_id", userId);

        await supabase.from("whatsapp_audit_log").insert({
          user_id: userId,
          action: "send_message",
          details: { to: phone, message_id: savedMsg?.id },
        });

        return json({ success: true, message_id: savedMsg?.id });
      }

      case "get-conversations": {
        const { data: convs } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(50);

        return json({ conversations: convs || [] });
      }

      case "get-messages": {
        const { conversationId } = body;
        if (!conversationId) {
          return json({ error: "Missing conversationId" }, 400);
        }

        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(100);

        // Mark as read
        await supabase.from("whatsapp_conversations").update({
          unread_count: 0,
        }).eq("id", conversationId).eq("user_id", userId);

        return json({ messages: msgs || [] });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
