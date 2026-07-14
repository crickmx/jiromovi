import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Yeastar-Token",
};

const TIPO_NOTIFICACION_CODIGO = "llamada_perdida";

interface PlantillaLlamadaPerdida {
  notificacion_titulo: string | null;
  notificacion_cuerpo: string | null;
  whatsapp_plantilla: string | null;
  enviar_notificacion: boolean | null;
  enviar_whatsapp: boolean | null;
  wazzup24_channel_id: string | null;
}

interface ResolvedWhatsAppChannel {
  api_key: string;
  channel_id_uuid: string;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val ?? "");
  }
  return out;
}

function onlyDigits(value: string): string {
  return (value || "").replace(/[^0-9]/g, "");
}

function last10Digits(value: string): string {
  return onlyDigits(value).slice(-10);
}

// Mismo criterio que enviar-whatsapp / seguwallet-send-welcome: MX, debe iniciar con 521
function normalizePhoneMX(phone: string): string {
  const p = onlyDigits(phone);
  if (p.startsWith("521") && p.length === 13) return p;
  if (p.startsWith("52") && p.length === 12) return "521" + p.substring(2);
  if (p.length === 10) return "521" + p;
  if (p.startsWith("1") && p.length === 11) return "52" + p;
  return p;
}

async function resolveWhatsAppChannel(
  supabase: ReturnType<typeof createClient>,
  preferredChannelId?: string | null
): Promise<ResolvedWhatsAppChannel | null> {
  if (preferredChannelId) {
    const { data } = await supabase
      .from("notification_channels")
      .select("config, is_active")
      .eq("id", preferredChannelId)
      .eq("type", "whatsapp_wazzup24")
      .eq("is_active", true)
      .maybeSingle();
    if (data?.config?.api_key && data?.config?.channel_id) {
      return { api_key: data.config.api_key, channel_id_uuid: data.config.channel_id };
    }
  }

  const { data: def } = await supabase
    .from("notification_channels")
    .select("config, is_active")
    .eq("type", "whatsapp_wazzup24")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def?.config?.api_key && def?.config?.channel_id) {
    return { api_key: def.config.api_key, channel_id_uuid: def.config.channel_id };
  }

  // Fallback legado (mismo que enviar-whatsapp / seguwallet-send-welcome)
  const { data: legacy } = await supabase
    .from("whatsapp_configuracion")
    .select("api_key, channel_id_uuid, activo")
    .eq("activo", true)
    .maybeSingle();
  if (legacy?.api_key) {
    return { api_key: legacy.api_key, channel_id_uuid: legacy.channel_id_uuid || "" };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("YEASTAR_WEBHOOK_SECRET");
    const tokenHeader = req.headers.get("X-Yeastar-Token");

    if (webhookSecret && tokenHeader !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Yeastar webhook received:", JSON.stringify(body));

    const extension =
      body.extension || body.callee || body.to;
    const callerNumber =
      body.caller || body.from || body.callernum || "Desconocido";
    const timestamp = body.timestamp
      ? new Date(body.timestamp * 1000).toISOString()
      : new Date().toISOString();

    if (!extension) {
      return new Response(
        JSON.stringify({ error: "No extension in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: usuario } = await adminClient
      .from("usuarios")
      .select("id, nombre, nombre_completo, nombre_publico, celular_laboral")
      .eq("extension_telefonica", extension)
      .single();

    const usuarioId = usuario?.id || null;

    await adminClient.from("llamadas_perdidas").insert({
      extension,
      caller_number: callerNumber,
      timestamp,
      usuario_id: usuarioId,
      estado: "pendiente",
    });

    if (usuarioId) {
      const callerPhone10 = last10Digits(callerNumber) || callerNumber;

      // Nombre del caller: busca en la libreta de contactos del dueño de la extensión
      let callerName = "Número desconocido";
      try {
        if (callerPhone10.length === 10) {
          const { data: contacto } = await adminClient
            .from("contactos")
            .select("nombre, apellido")
            .eq("usuario_id", usuarioId)
            .ilike("celular", `%${callerPhone10}%`)
            .limit(1)
            .maybeSingle();
          if (contacto?.nombre) {
            callerName = [contacto.nombre, contacto.apellido].filter(Boolean).join(" ");
          }
        }
      } catch (lookupErr: any) {
        console.error("Error buscando nombre del caller:", lookupErr.message);
      }

      const nombreUsuario =
        usuario?.nombre_publico?.trim() ||
        usuario?.nombre_completo ||
        usuario?.nombre ||
        "Usuario";

      const vars: Record<string, string> = {
        caller_name: callerName,
        caller_phone: callerNumber,
        caller_phone_10: callerPhone10,
        nombre_usuario: nombreUsuario,
        extension: String(extension),
      };

      // Plantilla configurable desde /admin/transaccionales; si no existe, se usan los textos de siempre
      let plantilla: PlantillaLlamadaPerdida | null = null;
      try {
        const { data: tipo } = await adminClient
          .from("correo_tipos_notificacion")
          .select("id, activo")
          .eq("codigo", TIPO_NOTIFICACION_CODIGO)
          .maybeSingle();

        if (tipo?.activo) {
          const { data: tpl } = await adminClient
            .from("correo_plantillas")
            .select(
              "notificacion_titulo, notificacion_cuerpo, whatsapp_plantilla, enviar_notificacion, enviar_whatsapp, wazzup24_channel_id"
            )
            .eq("tipo_notificacion_id", tipo.id)
            .eq("es_plantilla_default", true)
            .maybeSingle();
          plantilla = tpl;
        }
      } catch (tplErr: any) {
        console.error("Error cargando plantilla de llamada perdida:", tplErr.message);
      }

      const enviarNotificacion = plantilla?.enviar_notificacion !== false;
      const titulo =
        enviarNotificacion && plantilla?.notificacion_titulo
          ? renderTemplate(plantilla.notificacion_titulo, vars)
          : "Llamada perdida";
      const cuerpo =
        enviarNotificacion && plantilla?.notificacion_cuerpo
          ? renderTemplate(plantilla.notificacion_cuerpo, vars)
          : `Llamada perdida de ${callerNumber}`;

      if (enviarNotificacion) {
        await adminClient.from("notificaciones").insert({
          tipo: "llamada_perdida",
          modulo: "telefonia",
          titulo,
          cuerpo,
          accion_url: "/admin/telefonia",
          leida: false,
          usuario_id: usuarioId,
        });

        // Send Web Push notification
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              usuario_id: usuarioId,
              title: titulo,
              body: cuerpo,
              url: "/admin/telefonia",
              tag: "missed-call",
            }),
          });
        } catch (pushErr: any) {
          console.error("Push notification error:", pushErr.message);
        }
      }

      // WhatsApp: solo si el admin lo activó en la plantilla y hay celular_laboral
      if (plantilla?.enviar_whatsapp && plantilla?.whatsapp_plantilla && usuario?.celular_laboral) {
        try {
          const waChannel = await resolveWhatsAppChannel(adminClient, plantilla.wazzup24_channel_id);
          if (!waChannel) {
            console.warn(
              "WhatsApp de llamada perdida activo pero sin canal Wazzup24 configurado; se omite el envío."
            );
          } else {
            const waMessage = renderTemplate(plantilla.whatsapp_plantilla, vars);
            const chatId = normalizePhoneMX(usuario.celular_laboral);
            const waRes = await fetch("https://api.wazzup24.com/v3/message", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${waChannel.api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                channelId: waChannel.channel_id_uuid,
                chatType: "whatsapp",
                chatId,
                text: waMessage,
              }),
            });
            if (!waRes.ok) {
              console.error("Error enviando WhatsApp de llamada perdida:", await waRes.text());
            }
          }
        } catch (waErr: any) {
          console.error("Error en envío de WhatsApp de llamada perdida:", waErr.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, extension, caller: callerNumber }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
