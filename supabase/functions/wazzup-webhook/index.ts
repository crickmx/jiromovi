import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WazzupMessage {
  messageId: string;
  channelId: string;
  chatType: string;
  chatId: string;
  dateTime: string;
  type: string;
  status: string;
  text?: string;
  contentUri?: string;
  contact?: {
    name?: string;
    avatarUri?: string;
    phone?: string;
    username?: string;
  };
  isEcho?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  authorName?: string;
}

interface WazzupWebhookPayload {
  messages?: WazzupMessage[];
  statuses?: Array<{
    messageId: string;
    status: string;
    dateTime: string;
  }>;
}

function normalizePhone(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants: string[] = [digits];

  if (digits.startsWith("521") && digits.length === 13) {
    variants.push(digits.slice(3));
    variants.push(digits.slice(2));
  } else if (digits.startsWith("52") && digits.length === 12) {
    variants.push(digits.slice(2));
    variants.push("1" + digits.slice(2));
  } else if (digits.length === 10) {
    variants.push("52" + digits);
    variants.push("521" + digits);
  }

  return [...new Set(variants)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WazzupWebhookPayload = await req.json();

    if (payload.statuses && payload.statuses.length > 0) {
      for (const statusUpdate of payload.statuses) {
        if (
          statusUpdate.status === "delivered" ||
          statusUpdate.status === "read" ||
          statusUpdate.status === "sent"
        ) {
          await supabase
            .from("contact_center_messages")
            .update({
              status: statusUpdate.status,
              updated_at: new Date().toISOString(),
            })
            .eq("provider_message_id", statusUpdate.messageId);
        }
      }
    }

    if (payload.messages && payload.messages.length > 0) {
      for (const msg of payload.messages) {
        if (msg.isDeleted || msg.isEdited) continue;

        const isInbound = msg.status === "inbound" && !msg.isEcho;

        if (!isInbound) {
          if (msg.status === "sent" || msg.status === "delivered" || msg.status === "read") {
            await supabase
              .from("contact_center_messages")
              .update({
                status: msg.status,
                updated_at: new Date().toISOString(),
              })
              .eq("provider_message_id", msg.messageId);
          }
          continue;
        }

        const phoneVariants = normalizePhone(msg.chatId);

        let agentUserId: string | null = null;
        let agentName: string | null = null;

        for (const variant of phoneVariants) {
          const { data: user } = await supabase
            .from("usuarios")
            .select("id, nombre_completo")
            .or(
              `celular_laboral.eq.${variant},celular_personal.eq.${variant}`
            )
            .maybeSingle();

          if (user) {
            agentUserId = user.id;
            agentName = user.nombre_completo;
            break;
          }
        }

        if (!agentUserId) {
          const { data: user } = await supabase
            .from("usuarios")
            .select("id, nombre_completo")
            .or(
              phoneVariants
                .map(
                  (v) =>
                    `celular_laboral.like.%${v.slice(-10)},celular_personal.like.%${v.slice(-10)}`
                )
                .join(",")
            )
            .maybeSingle();

          if (user) {
            agentUserId = user.id;
            agentName = user.nombre_completo;
          }
        }

        if (!agentUserId) continue;

        const { data: existing } = await supabase
          .from("contact_center_messages")
          .select("id")
          .eq("provider_message_id", msg.messageId)
          .maybeSingle();

        if (existing) continue;

        const messageBody = msg.text || (msg.contentUri ? `[${msg.type}]` : "");

        await supabase.from("contact_center_messages").insert({
          agent_user_id: agentUserId,
          sender_user_id: null,
          sender_type: "user",
          channel: "whatsapp",
          message_type: "manual",
          direction: "inbound",
          body: messageBody,
          status: "received",
          provider: "wazzup",
          provider_message_id: msg.messageId,
          provider_response: msg as unknown as Record<string, unknown>,
          created_at: msg.dateTime || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            chat_id: msg.chatId,
            channel_id: msg.channelId,
            chat_type: msg.chatType,
            message_type: msg.type,
            content_uri: msg.contentUri || null,
            contact_name: msg.contact?.name || agentName,
            sender_name: msg.contact?.name || agentName,
          },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("wazzup-webhook error:", errMsg);
    return new Response(JSON.stringify({ ok: true, error: errMsg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
