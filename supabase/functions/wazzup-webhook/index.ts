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
  isEcho?: boolean;
  contact?: { name?: string; avatarUri?: string; phone?: string };
  quotedMessage?: unknown;
  isEdited?: boolean;
  isDeleted?: boolean;
}

interface WazzupWebhookPayload {
  test?: boolean;
  messages?: WazzupMessage[];
  statuses?: unknown[];
}

function normalizePhoneMx(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("+")) digits = digits.substring(1);
  if (digits.length === 10) return "52" + digits;
  if (digits.length === 13 && digits.startsWith("521")) {
    return "52" + digits.substring(3);
  }
  if (digits.length === 12 && digits.startsWith("52")) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return "52" + digits.substring(1);
  return digits;
}

function normalizeForComparison(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("52")) return digits.substring(2);
  if (digits.length === 13 && digits.startsWith("521")) return digits.substring(3);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function detectFileType(
  wazzupType: string
): { file_type: string; mime_type: string } {
  switch (wazzupType) {
    case "image":
      return { file_type: "image", mime_type: "image/jpeg" };
    case "audio":
      return { file_type: "audio", mime_type: "audio/mpeg" };
    case "video":
      return { file_type: "video", mime_type: "video/mp4" };
    case "document":
      return { file_type: "document", mime_type: "application/pdf" };
    case "vcard":
      return { file_type: "document", mime_type: "text/vcard" };
    default:
      return { file_type: "document", mime_type: "application/octet-stream" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WazzupWebhookPayload = await req.json();

    // Wazzup sends test request on webhook registration
    if (payload.test) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload.messages || payload.messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    const errors: string[] = [];

    // Pre-fetch all users with phones for matching
    const { data: usersWithPhones } = await supabase
      .from("usuarios")
      .select("id, celular_laboral, celular_personal, oficina_id, nombre_completo, activo")
      .or("celular_laboral.neq.,celular_personal.neq.")
      .eq("activo", true);

    const phoneIndex = new Map<string, string>();
    if (usersWithPhones) {
      for (const u of usersWithPhones) {
        if (u.celular_laboral) {
          phoneIndex.set(normalizeForComparison(u.celular_laboral), u.id);
        }
        if (u.celular_personal) {
          phoneIndex.set(normalizeForComparison(u.celular_personal), u.id);
        }
      }
    }

    for (const msg of payload.messages) {
      try {
        // Skip outgoing echoes
        if (msg.isEcho) continue;
        // Only process inbound messages
        if (msg.status !== "inbound") continue;
        // Skip deleted messages
        if (msg.isDeleted) continue;

        const senderPhone = msg.chatId;
        const normalizedSender = normalizeForComparison(senderPhone);
        const matchedAgentId = phoneIndex.get(normalizedSender) || null;

        const messageBody = msg.text || "";
        const hasAttachment = !!msg.contentUri;

        // If no agent matched, use a placeholder UUID for "unassigned"
        // We'll create a virtual agent record or use a null-safe approach
        let agentId = matchedAgentId;

        if (!agentId) {
          // Check if there's already a "virtual" unassigned user for this phone
          const { data: existingUnassigned } = await supabase
            .from("contact_center_messages")
            .select("agent_user_id")
            .eq("metadata->>sender_phone", normalizedSender)
            .is("agent_user_id", null)
            .limit(1)
            .maybeSingle();

          // For unassigned, we need a valid agent_user_id (NOT NULL constraint)
          // Use a deterministic UUID based on phone number as placeholder
          // Actually, agent_user_id has NOT NULL + FK constraint, so we need a real user
          // Strategy: find any admin user as temporary holder, store real phone in metadata
          if (!existingUnassigned) {
            const { data: adminUser } = await supabase
              .from("usuarios")
              .select("id")
              .eq("rol", "Administrador")
              .eq("activo", true)
              .limit(1)
              .maybeSingle();

            if (adminUser) {
              agentId = adminUser.id;
            } else {
              errors.push(`No admin user found to hold unassigned message from ${senderPhone}`);
              continue;
            }
          } else {
            agentId = existingUnassigned.agent_user_id;
          }
        }

        // Insert message
        const { data: insertedMsg, error: insertError } = await supabase
          .from("contact_center_messages")
          .insert({
            agent_user_id: agentId,
            sender_user_id: null,
            sender_type: "system",
            channel: "whatsapp",
            message_type: "manual",
            direction: "inbound",
            body: messageBody || (hasAttachment ? `[${msg.type}]` : "[mensaje vacío]"),
            status: "received",
            provider: "wazzup",
            provider_message_id: msg.messageId,
            provider_response: msg as unknown as Record<string, unknown>,
            metadata: {
              sender_phone: normalizedSender,
              sender_phone_raw: senderPhone,
              sender_name: msg.contact?.name || null,
              sender_avatar: msg.contact?.avatarUri || null,
              wazzup_channel_id: msg.channelId,
              wazzup_type: msg.type,
              is_assigned: !!matchedAgentId,
            },
          })
          .select("id")
          .single();

        if (insertError) {
          errors.push(`Insert error for ${msg.messageId}: ${insertError.message}`);
          continue;
        }

        // Handle attachment if present
        if (hasAttachment && insertedMsg) {
          const { file_type, mime_type } = detectFileType(msg.type);
          await supabase.from("contact_center_attachments").insert({
            message_id: insertedMsg.id,
            agent_user_id: agentId,
            provider: "wazzup",
            provider_file_id: msg.messageId,
            file_name: `${msg.type}_${msg.messageId.substring(0, 8)}`,
            file_type,
            mime_type,
            file_url: msg.contentUri,
            direction: "inbound",
            metadata: {
              wazzup_type: msg.type,
              sender_phone: normalizedSender,
            },
          });
        }

        processed++;
      } catch (msgErr) {
        const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        errors.push(`Error processing ${msg.messageId}: ${errMsg}`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
