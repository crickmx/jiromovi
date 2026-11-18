import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getWhatsappApiKey } from "../_shared/emailCredentials.ts";
import { readWazzupResponse } from "../_shared/wazzupDelivery.ts";
// ===== Guardia de autenticación MOVI (2026-11-17) =====
// Uso, al inicio del handler (después de OPTIONS):
//   const __denied = await __moviGuard(req, { roles: [...], allowService: true });
//   if (__denied) return __denied;
// roles: valores de usuarios.rol permitidos para llamadas con sesión ([] = ninguna).
// allowService: acepta llamadas internas (cron/SQL/otras funciones) con la service key
//   legacy (== SUPABASE_SERVICE_ROLE_KEY) o con una llave sb_secret_ válida
//   (se valida contra /auth/v1/admin y se cachea en memoria).
const __moviOkSecrets = new Set<string>();
async function __moviGuard(req: Request, opts: { roles: string[]; allowService: boolean }): Promise<Response | null> {
  const h = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
  const deny = (status: number, msg: string) => new Response(JSON.stringify({ success: false, error: msg }), { status, headers: h });
  const url = Deno.env.get("SUPABASE_URL")!;
  const legacyService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikeyHdr = (req.headers.get("apikey") ?? "").trim();
  if (opts.allowService) {
    for (const k of [bearer, apikeyHdr]) {
      if (!k) continue;
      if (legacyService && k === legacyService) return null;
      if (k.startsWith("sb_secret_")) {
        if (__moviOkSecrets.has(k)) return null;
        const r = await fetch(`${url}/auth/v1/admin/users?per_page=1`, { headers: { apikey: k } });
        await r.body?.cancel();
        if (r.ok) { __moviOkSecrets.add(k); return null; }
      }
    }
    // El gateway convierte las llaves sb_secret_ en un JWT temporal con role=service_role.
    // Se valida la firma pidiéndole a Auth un endpoint de admin con ese JWT.
    if (bearer.startsWith("eyJ")) {
      let role = "";
      try {
        const b64 = bearer.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        role = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)))?.role ?? "";
      } catch { /* no es JWT */ }
      if (role === "service_role") {
        if (__moviOkSecrets.has(bearer)) return null;
        const r = await fetch(`${url}/auth/v1/admin/users?per_page=1`, { headers: { Authorization: `Bearer ${bearer}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? bearer } });
        await r.body?.cancel();
        if (r.ok) { __moviOkSecrets.add(bearer); return null; }
      }
    }
  }
  if (!bearer || !bearer.startsWith("eyJ")) return deny(401, "No autenticado");
  if (opts.roles.length === 0) return deny(403, "No autorizado");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? legacyService;
  const ur = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${bearer}`, apikey: anon } });
  if (!ur.ok) { await ur.body?.cancel(); return deny(401, "No autenticado"); }
  const user = await ur.json();
  if (!user?.id) return deny(401, "No autenticado");
  const q = await fetch(`${url}/rest/v1/usuarios?id=eq.${encodeURIComponent(user.id)}&select=rol,activo,is_deleted`, { headers: { Authorization: `Bearer ${legacyService}`, apikey: legacyService } });
  const rows = q.ok ? await q.json() : [];
  const me = Array.isArray(rows) ? rows[0] : null;
  if (!me || me.activo === false || me.is_deleted === true || !opts.roles.includes(me.rol)) return deny(403, "No autorizado");
  return null;
}
// ===== fin guardia =====

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppPayload {
  // Legacy format (direct)
  phone?: string;
  message?: string;
  documents?: Array<{ fileName: string; filePath: string }>;
  ticket_id?: string;
  // DB-function format
  tipo?: string;
  numero?: string;
  datos?: {
    nombre?: string;
    apellidos?: string;
    titulo?: string;
    mensaje?: string;
    accion_url?: string;
    [key: string]: unknown;
  };
  evento_id?: string;
}

async function getSignedUrl(
  supabase: ReturnType<typeof createClient>,
  filePath: string
): Promise<string | null> {
  // For full URLs, extract storage path and create a signed URL (bucket is private)
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const publicMatch = filePath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (publicMatch) {
      const bucket = publicMatch[1];
      const path = decodeURIComponent(publicMatch[2]);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    }
    // Already a signed URL or external URL - return as-is
    return filePath;
  }
  const { data } = await supabase.storage
    .from("ticket-archivos")
    .createSignedUrl(filePath, 3600);
  return data?.signedUrl || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  const __denied = await __moviGuard(req, { roles: ["Administrador","Gerente","Ejecutivo","Empleado"], allowService: true });
  if (__denied) return __denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WhatsAppPayload = await req.json();
    const { documents, ticket_id } = payload;

    // Support both { phone, message } (direct) and { tipo, numero, datos } (from DB functions)
    let phone: string;
    let message: string;

    if (payload.numero && payload.datos) {
      phone = payload.numero;
      const d = payload.datos;
      const nombre = [d.nombre, d.apellidos].filter(Boolean).join(' ') || 'Usuario';
      const accion = d.accion_url ? `\n\n🔗 ${d.accion_url}` : '';
      message = `📲 *${d.titulo || 'Notificación'}*\n\n${d.mensaje || ''}${accion}`;
    } else {
      phone = payload.phone || '';
      message = payload.message || '';
    }

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "phone/numero and message/datos are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp configuration
    const { data: config } = await supabase
      .from("whatsapp_configuracion")
      .select("id, channel_id_uuid, activo")
      .eq("activo", true)
      .maybeSingle();
    const apiKey = config ? await getWhatsappApiKey(supabase, config.id) : null;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp not configured or inactive" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let normalizedPhone = phone.replace(/[^0-9]/g, "");
    if (normalizedPhone.length === 10) {
      normalizedPhone = "521" + normalizedPhone;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith("52")) {
      normalizedPhone = "521" + normalizedPhone.substring(2);
    } else if (normalizedPhone.length === 13 && !normalizedPhone.startsWith("521")) {
      normalizedPhone = "521" + normalizedPhone.substring(3);
    }
    const chatId = normalizedPhone;

    // Send text message
    const msgRes = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId: config.channel_id_uuid,
        chatType: "whatsapp",
        chatId,
        text: message,
      }),
    });

    const { text: msgText, messageId: providerMessageId } = await readWazzupResponse(msgRes);
    if (!msgRes.ok) {
      const errText = msgText;
      return new Response(
        JSON.stringify({ success: false, error: `Wazzup ${msgRes.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send documents if provided
    let documentsSent = 0;
    const failedDocuments: string[] = [];

    const docsToSend = documents || [];

    // If ticket_id provided and no explicit documents, fetch from ticket_archivos
    if (docsToSend.length === 0 && ticket_id) {
      const { data: files } = await supabase
        .from("ticket_archivos")
        .select("nombre, url")
        .eq("ticket_id", ticket_id)
        .order("fecha_subida", { ascending: false })
        .limit(10);

      if (files) {
        for (const f of files) {
          docsToSend.push({ fileName: f.nombre || "documento", filePath: f.url || "" });
        }
      }
    }

    for (const doc of docsToSend) {
      try {
        let url = doc.filePath;
        if (!url.startsWith("http")) {
          const signed = await getSignedUrl(supabase, url);
          if (!signed) {
            failedDocuments.push(doc.fileName);
            continue;
          }
          url = signed;
        }

        const docRes = await fetch("https://api.wazzup24.com/v3/message", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: config.channel_id_uuid,
            chatType: "whatsapp",
            chatId,
            contentUri: url,
            fileName: doc.fileName,
          }),
        });

        if (docRes.ok) {
          documentsSent++;
        } else {
          failedDocuments.push(doc.fileName);
        }
      } catch {
        failedDocuments.push(doc.fileName);
      }
    }

    try {
      const { data: historialId } = await supabase.rpc('registrar_envio_notificacion', {
        p_tipo_notificacion_codigo: 'whatsapp_directo',
        p_canal_envio: 'whatsapp',
        p_usuario_id: null,
        p_destinatario_email: 'whatsapp@sistema.local',
        p_destinatario_nombre: null,
        p_numero_destino: chatId,
        p_asunto: 'Mensaje WhatsApp',
        p_cuerpo_html: message,
        p_estado: 'enviado',
        p_error_mensaje: null,
        p_enviado_por: null,
        p_evento_id: payload.evento_id || null,
        p_provider_response: { messageId: providerMessageId, documents_sent: documentsSent, documents_failed: failedDocuments }
      });
      // Para que el webhook pueda marcarlo como fallido si WhatsApp lo rechaza después.
      if (historialId && providerMessageId) {
        await supabase.from('correo_historial_envios').update({ provider_message_id: providerMessageId, proveedor: 'wazzup24' }).eq('id', historialId);
      }
    } catch (logErr) {
      console.error('enviar-whatsapp: error logging send:', logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_sent: true,
        documents_sent: documentsSent,
        documents_failed: failedDocuments.length,
        failed_documents: failedDocuments,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("enviar-whatsapp error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
