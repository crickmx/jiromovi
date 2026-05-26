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
    | "send-media"
    | "get-conversations"
    | "get-messages";
  conversationId?: string;
  to?: string;
  message?: string;
  messageType?: string;
  mediaBase64?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  quotedMessageId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Invalid token" }, 401);
    }

    const userId = user.id;
    const body: RequestBody = await req.json();
    const { action } = body;

    // WhatsApp server connection details
    const waServerUrl = Deno.env.get("WHATSAPP_SERVER_URL");
    const waServerKey = Deno.env.get("WHATSAPP_SERVER_API_KEY");
    const serverConfigured = Boolean(waServerUrl && waServerKey);

    switch (action) {
      case "get-status": {
        if (!serverConfigured) {
          // Check DB directly for session record
          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          return json({
            status: session?.status || "no_session",
            session,
            server_configured: false,
          });
        }

        // Ask the WhatsApp server for real status
        const resp = await callServer(waServerUrl!, waServerKey!, `session/${userId}/status`);
        if (!resp) {
          return json({ status: "server_unreachable", session: null, server_configured: true });
        }

        // Also fetch DB record for extra fields
        const { data: dbSession } = await supabase
          .from("whatsapp_sessions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        return json({
          status: resp.status || "no_session",
          session: dbSession,
          connected: resp.connected,
          phone: resp.phone,
          server_configured: true,
        });
      }

      case "connect": {
        if (!serverConfigured) {
          return json({
            success: false,
            server_configured: false,
            error: "WhatsApp server no configurado. Configure WHATSAPP_SERVER_URL y WHATSAPP_SERVER_API_KEY.",
          });
        }

        const resp = await callServerPost(waServerUrl!, waServerKey!, `session/${userId}/connect`, {});
        if (!resp) {
          return json({ success: false, error: "No se pudo conectar al servidor WhatsApp" }, 500);
        }

        return json({
          success: true,
          qr_code: resp.qrBase64 || null,
          status: resp.status,
          connected: resp.connected,
          server_configured: true,
        });
      }

      case "get-qr": {
        if (!serverConfigured) {
          return json({ qr_code: null, server_configured: false });
        }

        const resp = await callServer(waServerUrl!, waServerKey!, `session/${userId}/qr`);
        if (!resp) {
          return json({ qr_code: null, error: "Server unreachable" }, 500);
        }

        return json({
          qr_code: resp.qrBase64 || null,
          connected: resp.connected || false,
          status: resp.status,
        });
      }

      case "disconnect": {
        if (serverConfigured) {
          await callServerPost(waServerUrl!, waServerKey!, `session/${userId}/disconnect`, {});
        }

        await supabase
          .from("whatsapp_sessions")
          .update({
            status: "disconnected",
            disconnected_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return json({ success: true });
      }

      case "send-message": {
        const { to, message, quotedMessageId } = body;
        if (!to || !message) {
          return json({ error: "Missing 'to' or 'message'" }, 400);
        }

        if (serverConfigured) {
          const resp = await callServerPost(
            waServerUrl!,
            waServerKey!,
            `session/${userId}/send-message`,
            { to, message, quotedMessageId }
          );
          if (!resp || resp.error) {
            return json({ success: false, error: resp?.error || "Send failed" }, 500);
          }
          return json({ success: true, messageId: resp.messageId });
        }

        // Fallback: save to DB without actually sending
        let phone = to.replace(/\D/g, "");
        if (phone.length === 10) phone = `52${phone}`;

        let { data: conv } = await supabase
          .from("whatsapp_conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("remote_phone", phone)
          .maybeSingle();

        if (!conv) {
          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
          if (!session) return json({ error: "No session" }, 400);

          const { data: nc } = await supabase
            .from("whatsapp_conversations")
            .insert({
              user_id: userId,
              session_id: session.id,
              remote_phone: phone,
              last_message_text: message,
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          conv = nc;
        } else {
          await supabase
            .from("whatsapp_conversations")
            .update({ last_message_text: message, last_message_at: new Date().toISOString() })
            .eq("id", conv!.id);
        }

        const { data: msg } = await supabase
          .from("whatsapp_messages")
          .insert({
            conversation_id: conv!.id,
            user_id: userId,
            direction: "outbound",
            message_type: "text",
            content: message,
            status: "pending",
          })
          .select("id")
          .single();

        return json({ success: true, messageId: msg?.id, delivered: false });
      }

      case "send-media": {
        const { to, mediaBase64, mimeType, filename, caption } = body;
        if (!to || !mediaBase64 || !mimeType) {
          return json({ error: "Missing required fields" }, 400);
        }

        if (!serverConfigured) {
          return json({ error: "WhatsApp server required for media" }, 400);
        }

        const resp = await callServerPost(
          waServerUrl!,
          waServerKey!,
          `session/${userId}/send-media`,
          { to, mediaBase64, mimeType, filename, caption }
        );
        if (!resp || resp.error) {
          return json({ success: false, error: resp?.error || "Send media failed" }, 500);
        }
        return json({ success: true, messageId: resp.messageId });
      }

      case "get-conversations": {
        if (serverConfigured) {
          const resp = await callServer(waServerUrl!, waServerKey!, `session/${userId}/conversations`);
          if (resp?.conversations?.length) {
            return json({ conversations: resp.conversations, source: "server" });
          }
        }

        // Fallback: get from DB
        const { data: convs } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(50);

        return json({ conversations: convs || [], source: "database" });
      }

      case "get-messages": {
        const { conversationId } = body;
        if (!conversationId) {
          return json({ error: "Missing conversationId" }, 400);
        }

        // Get from DB (server syncs there)
        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(100);

        await supabase
          .from("whatsapp_conversations")
          .update({ unread_count: 0 })
          .eq("id", conversationId)
          .eq("user_id", userId);

        return json({ messages: msgs || [] });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

async function callServer(baseUrl: string, apiKey: string, path: string) {
  try {
    const resp = await fetch(`${baseUrl}/${path}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function callServerPost(baseUrl: string, apiKey: string, path: string, body: unknown) {
  try {
    const resp = await fetch(`${baseUrl}/${path}`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
