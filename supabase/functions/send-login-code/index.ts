import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

function generateMagicToken(): string {
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "");
}

function formatPhoneForWhatsApp(phone: string): string {
  const clean = normalizePhone(phone);
  if (clean.length === 10) {
    return "521" + clean;
  }
  if (clean.startsWith("52") && clean.length === 12) {
    return "521" + clean.substring(2);
  }
  if (clean.startsWith("521") && clean.length === 13) {
    return clean;
  }
  if (clean.length > 10) {
    return clean;
  }
  return "521" + clean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, platform } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const targetPlatform = platform || "movi";

    // Find user by email in usuarios table
    const { data: usuario, error: userError } = await supabase
      .from("usuarios")
      .select(
        "id, nombre, email, celular_laboral, celular_personal, activo, is_deleted, estado"
      )
      .eq("email", email)
      .eq("is_deleted", false)
      .maybeSingle();

    if (userError || !usuario) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check user can login
    const { data: loginCheck } = await supabase.rpc("check_user_can_login", {
      user_id_to_check: usuario.id,
    });

    if (loginCheck && !loginCheck.can_login) {
      return new Response(
        JSON.stringify({
          error: loginCheck.error,
          error_code: loginCheck.error_code,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting: max 1 code per 30 seconds
    const { data: recentToken } = await supabase
      .from("passwordless_login_tokens")
      .select("id, created_at")
      .eq("user_id", usuario.id)
      .eq("platform", targetPlatform)
      .is("used_at", null)
      .gt("created_at", new Date(Date.now() - 30000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentToken) {
      return new Response(
        JSON.stringify({
          error: "Ya se envió un código recientemente. Espera 30 segundos.",
          error_code: "RATE_LIMITED",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate code and magic token
    const code = generateCode();
    const magicToken = generateMagicToken();
    const codeHash = await hashString(code);
    const magicTokenHash = await hashString(magicToken);

    // Determine phone number (prefer celular_laboral)
    const phone = usuario.celular_laboral || usuario.celular_personal || "";

    // Store token
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("passwordless_login_tokens")
      .insert({
        user_id: usuario.id,
        platform: targetPlatform,
        email: email,
        phone: phone,
        code_hash: codeHash,
        magic_token_hash: magicTokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Error al generar código" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send code via WhatsApp using wazzup configuration from DB
    let whatsappSent = false;
    let whatsappError: string | null = null;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone && normalizedPhone.length >= 10) {
      try {
        const { data: wazzupConfig } = await supabase
          .from("whatsapp_configuracion")
          .select("api_key, channel_id_uuid")
          .eq("activo", true)
          .limit(1)
          .maybeSingle();

        if (wazzupConfig?.api_key && wazzupConfig?.channel_id_uuid) {
          const whatsappPhone = formatPhoneForWhatsApp(normalizedPhone);
          const platformName =
            targetPlatform === "seguwallet" ? "Seguwallet" : "MOVI Digital";
          const messageText = `ㅤ Tu código de acceso a *${platformName}* es: *${code}* _Válido por 10 minutos. Un solo uso._ ㅤ ㅤ ㅤㅤ\n\nㅤㅤㅤㅤㅤㅤㅤㅤㅤ`;

          const wazzupResponse = await fetch(
            "https://api.wazzup24.com/v3/message",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${wazzupConfig.api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channelId: wazzupConfig.channel_id_uuid,
                chatId: whatsappPhone,
                chatType: "whatsapp",
                text: messageText,
              }),
            }
          );

          if (wazzupResponse.ok) {
            whatsappSent = true;
          } else {
            const errBody = await wazzupResponse.text();
            whatsappError = `WhatsApp send failed: ${wazzupResponse.status}`;
            console.error("Wazzup send error:", errBody);
          }
        } else {
          whatsappError = "WhatsApp no configurado";
        }
      } catch (e) {
        whatsappError = e.message;
        console.error("WhatsApp send exception:", e);
      }
    } else {
      whatsappError = "Número de teléfono no disponible o inválido";
    }

    // ALWAYS send code via email as fallback
    let emailSent = false;
    try {
      const emailResponse = await fetch(
        `${supabaseUrl}/functions/v1/enviar-correo-transaccional`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_key: `login_code_${targetPlatform}_email`,
            to_email: email,
            variables: {
              code: code,
              user_name: usuario.nombre || "Usuario",
              expiration_minutes: "10",
            },
          }),
        }
      );

      if (emailResponse.ok) {
        emailSent = true;
      } else {
        console.error("Email send error:", await emailResponse.text());
      }
    } catch (e) {
      console.error("Email send exception:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        magic_token: magicToken,
        phone_masked: phone
          ? phone.slice(0, 2) + "****" + phone.slice(-4)
          : null,
        email_masked: email.replace(/(.{2})(.*)(@.*)/, "$1****$3"),
        channels: {
          whatsapp: whatsappSent,
          email: emailSent,
        },
        whatsapp_error: whatsappError,
        expires_in_seconds: 600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
