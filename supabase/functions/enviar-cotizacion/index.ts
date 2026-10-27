// Envía una cotización guardada (tabla `cotizaciones`) al cliente, por correo
// o WhatsApp, desde las cuentas de SEGUWALLET ("Resend Seguwallet" y
// "WhatsApp Seguwallet" en notification_channels). El mensaje dice qué asesor
// la manda y su WhatsApp a 10 dígitos para contactarlo.
//
// El PDF se genera en el navegador (jsPDF) y llega en base64. Para WhatsApp,
// Wazzup necesita una URL: se sube al bucket privado `cotizaciones` y se manda
// una URL firmada.
//
// Se despliega desde el dashboard: todo vive en esta carpeta, sin _shared.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const URL_FIRMADA_SEGUNDOS = 60 * 60 * 24 * 7; // una semana para que el cliente lo abra

interface Peticion {
  cotizacion_id: string;
  canal: "correo" | "whatsapp";
  destino: string;
  mensaje?: string;
  pdf_base64: string;
  filename: string;
}

function chatIdMX(tel: string): string {
  const p = tel.replace(/\D/g, "");
  if (p.length === 10) return "521" + p;
  if (p.length === 12 && p.startsWith("52") && !p.startsWith("521")) return "521" + p.slice(2);
  return p;
}

const diezDigitos = (tel: string | null | undefined) => {
  const d = (tel ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};
const telLegible = (d: string) => `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PRODUCTOS: Record<string, string> = {
  gmm_multi: "Gastos Médicos Mayores",
  auna_onco: "Oncosalud Plus (Auna)",
};

async function canal(supabase: ReturnType<typeof createClient>, tipo: "email_resend" | "whatsapp_wazzup24") {
  const { data } = await supabase
    .from("notification_channels")
    .select("id, name, config")
    .eq("type", tipo)
    .eq("is_active", true)
    .ilike("name", "%seguwallet%")
    .limit(1)
    .maybeSingle();
  return data as { id: string; name: string; config: Record<string, string> } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Cliente con la sesión de quien envía: la RLS decide si puede ver la cotización.
    const comoUsuario = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ success: false, error: "Sesión no válida" }, 401);

    const p = (await req.json()) as Peticion;
    if (!p.cotizacion_id || !p.destino || !p.pdf_base64) return json({ success: false, error: "Faltan datos" }, 400);

    const { data: cot, error: cotErr } = await comoUsuario
      .from("cotizaciones")
      .select("id, folio, cotizador, usuario_id, cliente_nombre, envios")
      .eq("id", p.cotizacion_id)
      .maybeSingle();
    if (cotErr || !cot) return json({ success: false, error: "No tienes acceso a esta cotización" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);

    // El asesor es el dueño de la cotización, no necesariamente quien la envía.
    const { data: asesor } = await admin
      .from("usuarios")
      .select("nombre, apellidos, nombre_publico, celular_laboral, celular_personal")
      .eq("id", cot.usuario_id)
      .maybeSingle();
    const nombreAsesor = (asesor?.nombre_publico || `${asesor?.nombre ?? ""} ${asesor?.apellidos ?? ""}`).trim();
    const telAsesor = diezDigitos(asesor?.celular_laboral) || diezDigitos(asesor?.celular_personal);
    if (!nombreAsesor || !telAsesor) {
      return json({
        success: false,
        error: `El perfil de ${nombreAsesor || "el asesor"} no tiene celular a 10 dígitos. Agrégalo en su perfil para poder enviar.`,
      }, 400);
    }

    const producto = PRODUCTOS[cot.cotizador] ?? "seguro";
    const nombreCliente = (cot.cliente_nombre || "").split(" ")[0] || "";
    const waAsesor = `https://wa.me/52${telAsesor}`;
    const filename = (p.filename || `Cotizacion-${cot.folio}.pdf`).replace(/[^\w.\-()]/g, "") || "cotizacion.pdf";
    const notaLibre = (p.mensaje ?? "").trim();

    if (p.canal === "correo") {
      const ch = await canal(admin, "email_resend");
      const apiKey = ch?.config?.api_key || Deno.env.get("RESEND_API_KEY");
      if (!apiKey) return json({ success: false, error: "No hay cuenta de correo de Seguwallet configurada" }, 500);
      const fromEmail = ch?.config?.from_email || "seguwallet@movi.digital";

      const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1C37E0;padding:20px 28px;color:#fff;font-size:18px;font-weight:bold;">Seguwallet</td></tr>
<tr><td style="padding:28px;color:#0f172a;font-size:15px;line-height:1.6;">
<p style="margin:0 0 14px;">Hola ${escapar(nombreCliente)},</p>
<p style="margin:0 0 14px;"><b>${escapar(nombreAsesor)}</b>, tu asesor de seguros, te envía tu cotización de <b>${escapar(producto)}</b> (folio ${escapar(cot.folio)}). La encontrarás adjunta en PDF.</p>
${notaLibre ? `<p style="margin:0 0 14px;padding:12px 16px;background:#f1f5f9;border-radius:8px;white-space:pre-line;">${escapar(notaLibre)}</p>` : ""}
<p style="margin:0 0 20px;">Si tienes dudas o quieres contratar, contáctalo directamente a su WhatsApp:</p>
<p style="margin:0 0 24px;"><a href="${waAsesor}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;">WhatsApp ${telLegible(telAsesor)}</a></p>
<p style="margin:0;font-size:12px;color:#64748b;">Los precios son una estimación preliminar sujeta a suscripción de la aseguradora.</p>
</td></tr></table></td></tr></table></body></html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${nombreAsesor} vía Seguwallet <${fromEmail}>`,
          to: [p.destino.trim()],
          subject: `${nombreAsesor} te envía tu cotización ${cot.folio}`,
          html,
          attachments: [{ filename, content: p.pdf_base64 }],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return json({ success: false, error: `El correo no salió: ${t.slice(0, 200)}` }, 502);
      }
    } else {
      const ch = await canal(admin, "whatsapp_wazzup24");
      if (!ch?.config?.api_key || !ch?.config?.channel_id) {
        return json({ success: false, error: "No hay WhatsApp de Seguwallet configurado" }, 500);
      }
      const chatId = chatIdMX(p.destino);
      if (chatId.length < 12) return json({ success: false, error: "Número de WhatsApp inválido" }, 400);

      // Subir el PDF para que Wazzup lo pueda descargar.
      const ruta = `${cot.id}/${Date.now()}-${filename}`;
      const bytes = Uint8Array.from(atob(p.pdf_base64), c => c.charCodeAt(0));
      const { error: upErr } = await admin.storage.from("cotizaciones").upload(ruta, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) return json({ success: false, error: `No se pudo preparar el PDF: ${upErr.message}` }, 500);
      const { data: firmada } = await admin.storage.from("cotizaciones").createSignedUrl(ruta, URL_FIRMADA_SEGUNDOS);
      if (!firmada?.signedUrl) return json({ success: false, error: "No se pudo generar el enlace del PDF" }, 500);

      const texto = [
        `Hola ${nombreCliente}, ${nombreAsesor}, tu asesor de seguros, te envía tu cotización de ${producto} (folio ${cot.folio}).`,
        notaLibre,
        `Para dudas o contratarla, contáctalo a su WhatsApp: ${telAsesor}`,
        waAsesor,
      ].filter(Boolean).join("\n\n");

      const enviar = (body: Record<string, string>) => fetch("https://api.wazzup24.com/v3/message", {
        method: "POST",
        headers: { Authorization: `Bearer ${ch.config.api_key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: ch.config.channel_id, chatType: "whatsapp", chatId, ...body }),
      });

      const r1 = await enviar({ text: texto });
      if (!r1.ok) return json({ success: false, error: `WhatsApp rechazó el mensaje: ${(await r1.text()).slice(0, 200)}` }, 502);
      await new Promise(r => setTimeout(r, 500));
      // Wazzup no acepta text y contentUri juntos (INVALID_MESSAGE_DATA): van separados.
      const r2 = await enviar({ contentUri: firmada.signedUrl, fileName: filename });
      if (!r2.ok) return json({ success: false, error: `Se envió el mensaje pero no el PDF: ${(await r2.text()).slice(0, 200)}` }, 502);
    }

    const destino = p.destino.trim();
    const envios = [...((cot.envios as unknown[]) ?? []), { canal: p.canal, destino, at: new Date().toISOString(), usuario_id: user.id }];
    await admin
      .from("cotizaciones")
      .update(p.canal === "correo" ? { envios, cliente_email: destino } : { envios, cliente_telefono: destino })
      .eq("id", cot.id);

    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
