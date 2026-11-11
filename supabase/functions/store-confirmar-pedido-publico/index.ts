import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getWhatsappApiKey } from "../_shared/emailCredentials.ts";

/**
 * Confirmación por correo y WhatsApp de un pedido hecho en tienda.movi.digital
 * sin sesión. La dispara el trigger `trg_store_pedido_publico_confirmar`
 * (pg_net) al insertarse el pedido; pg_net la llama después del COMMIT.
 *
 * Se despliega con verify_jwt = false (pg_net no manda sesión). Para que nadie
 * la use para mandar mensajes a terceros: solo actúa sobre pedidos públicos
 * creados hace menos de 15 minutos, una sola vez (se "reclama" el pedido con un
 * UPDATE atómico), y solo escribe a los datos de contacto guardados en el pedido.
 */

const EVENT_KEY = "store_pedido_publico_confirmacion";
const VENTANA_MINUTOS = 15;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Supa = ReturnType<typeof createClient>;

// ── Plantilla por defecto (si no existe o está inactiva la de la BD) ────────
const PLANTILLA_DEFAULT = {
  email_subject_template: "Recibimos tu pedido {{folio}} — MOVI Store",
  email_body_template: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">
<h2 style="color:#164281;margin:0 0 12px;">¡Gracias por tu pedido, {{nombre}}!</h2>
<p>Recibimos tu orden en <strong>MOVI Store</strong>. El equipo de Mercadotecnia la revisará y te contactará por WhatsApp o correo para confirmar el pago y la entrega.</p>
<div style="background:#f3f6fb;border-left:4px solid #164281;border-radius:6px;padding:14px 18px;margin:18px 0;">
<p style="margin:0 0 6px;"><strong>Folio:</strong> {{folio}}</p>
<p style="margin:0 0 6px;"><strong>Fecha:</strong> {{fecha}}</p>
<p style="margin:0;"><strong>Oficina:</strong> {{oficina}}</p>
</div>
{{productos_html}}
<p style="font-size:13px;color:#6b7280;">El total es estimado; el precio final se confirma al validar tu pedido. Conserva tu folio para cualquier aclaración.</p>
</div>`,
  whatsapp_body_template: `Hola {{nombre}} 👋

Recibimos tu pedido en *MOVI Store*.

*Folio:* {{folio}}
*Oficina:* {{oficina}}

{{productos_texto}}
*Total estimado:* {{total}}

Mercadotecnia te contactará para confirmar pago y entrega. ¡Gracias!`,
  resend_channel_id: null as string | null,
  wazzup24_channel_id: null as string | null,
};

// ── Canales (mismo orden que enviar-correo-transaccional) ───────────────────
async function canalCorreo(supabase: Supa, preferido: string | null) {
  const base = () => supabase.from("notification_channels").select("id, config, branding").eq("type", "email_resend").eq("is_active", true);
  const { data } = preferido
    ? await base().eq("id", preferido).maybeSingle()
    : await base().eq("is_default", true).maybeSingle();
  const fila = data?.config?.api_key ? data : (await base().eq("is_default", true).maybeSingle()).data;
  if (fila?.config?.api_key) {
    return {
      api_key: fila.config.api_key as string,
      from: `${fila.config.from_name || fila.branding?.sender_name || "MOVI Digital"} <${fila.config.from_email || "notificaciones@movi.digital"}>`,
      header_html: (fila.branding?.header_html as string) || null,
      footer_html: (fila.branding?.footer_html as string) || null,
    };
  }
  const env = Deno.env.get("RESEND_API_KEY");
  return env ? { api_key: env, from: "MOVI Digital <notificaciones@movi.digital>", header_html: null, footer_html: null } : null;
}

async function canalWhatsApp(supabase: Supa, preferido: string | null) {
  const base = () => supabase.from("notification_channels").select("id, config").eq("type", "whatsapp_wazzup24").eq("is_active", true);
  const { data } = preferido
    ? await base().eq("id", preferido).maybeSingle()
    : await base().eq("is_default", true).maybeSingle();
  const fila = data?.config?.api_key ? data : (await base().eq("is_default", true).maybeSingle()).data;
  if (fila?.config?.api_key && fila?.config?.channel_id) {
    return { api_key: fila.config.api_key as string, channel_id: fila.config.channel_id as string };
  }
  const { data: legacy } = await supabase
    .from("whatsapp_configuracion").select("id, channel_id_uuid").eq("activo", true).maybeSingle();
  const key = legacy ? await getWhatsappApiKey(supabase, legacy.id) : null;
  return key && legacy?.channel_id_uuid ? { api_key: key, channel_id: legacy.channel_id_uuid as string } : null;
}

function normalizarTelefonoMx(tel: string): string {
  let n = tel.replace(/\D/g, "");
  if (n.length === 10) n = "521" + n;
  else if (n.length === 12 && n.startsWith("52")) n = "521" + n.substring(2);
  return n;
}

function render(t: string, vars: Record<string, string>) {
  let out = t;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v ?? "");
  return out.replace(/\{\{[^}]+\}\}/g, "");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

async function registrar(supabase: Supa, canal: "correo" | "whatsapp", destino: string, nombre: string, asunto: string, cuerpo: string, ok: boolean, error: string | null) {
  try {
    await supabase.rpc("registrar_envio_notificacion", {
      p_tipo_notificacion_codigo: EVENT_KEY,
      p_canal_envio: canal,
      p_usuario_id: null,
      p_destinatario_email: canal === "correo" ? destino : "whatsapp@sistema.local",
      p_destinatario_nombre: nombre,
      p_numero_destino: canal === "whatsapp" ? destino : null,
      p_asunto: asunto,
      p_cuerpo_html: cuerpo,
      p_estado: ok ? "enviado" : "fallido",
      p_error_mensaje: error,
      p_enviado_por: null,
      p_evento_id: null,
      p_provider_response: null,
    });
  } catch (e) {
    console.warn("No se pudo registrar el envío:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Método no permitido" }, 405);

  let pedidoId = "";
  try {
    pedidoId = String((await req.json())?.pedido_id || "");
  } catch { /* cuerpo inválido */ }
  if (!/^[0-9a-f-]{36}$/i.test(pedidoId)) return json({ ok: false, error: "pedido_id inválido" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Reclamar el pedido: solo uno público, reciente y sin confirmación previa.
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();
  const { data: pedido, error: claimErr } = await supabase
    .from("store_pedidos")
    .update({ confirmacion_enviada_en: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("es_publico", true)
    .is("confirmacion_enviada_en", null)
    .gte("created_at", desde)
    .select("id, folio_oc, created_at, invitado_nombre, invitado_email, invitado_whatsapp, invitado_oficina_nombre")
    .maybeSingle();
  if (claimErr) return json({ ok: false, error: claimErr.message }, 500);
  if (!pedido) return json({ ok: false, error: "Pedido no elegible (ya confirmado, no público o fuera de tiempo)" }, 409);

  const { data: detalle } = await supabase
    .from("store_pedidos_detalle")
    .select("cantidad, precio_unitario, atributos_seleccionados, producto:store_productos(titulo)")
    .eq("pedido_id", pedido.id);

  const lineas = (detalle ?? []).map((d: any) => {
    const attrs = Object.entries((d.atributos_seleccionados ?? {}) as Record<string, string>)
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const subtotal = Number(d.cantidad) * Number(d.precio_unitario);
    return { titulo: d.producto?.titulo ?? "Producto", attrs, cantidad: Number(d.cantidad), subtotal };
  });
  const total = lineas.reduce((s, l) => s + l.subtotal, 0);

  const productosTexto = lineas
    .map(l => `• ${l.cantidad} × ${l.titulo}${l.attrs ? ` (${l.attrs})` : ""} — ${mxn(l.subtotal)}`)
    .join("\n");
  const productosHtml = `<table style="width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:14px;">
${lineas.map(l => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${l.cantidad} × ${esc(l.titulo)}${l.attrs ? `<br><span style="color:#6b7280;font-size:12px;">${esc(l.attrs)}</span>` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${mxn(l.subtotal)}</td></tr>`).join("\n")}
<tr><td style="padding:10px 0;font-weight:bold;">Total estimado</td><td style="padding:10px 0;text-align:right;font-weight:bold;color:#164281;">${mxn(total)}</td></tr>
</table>`;

  const nombre = pedido.invitado_nombre || "";
  const primerNombre = nombre.split(/\s+/)[0] || nombre;
  const fecha = new Date(pedido.created_at).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City", dateStyle: "long", timeStyle: "short",
  });

  const { data: plantillaBd } = await supabase
    .from("transactional_notification_templates")
    .select("email_subject_template, email_body_template, whatsapp_body_template, resend_channel_id, wazzup24_channel_id")
    .eq("event_key", EVENT_KEY)
    .eq("is_active", true)
    .maybeSingle();
  const plantilla = { ...PLANTILLA_DEFAULT, ...(plantillaBd ?? {}) };

  // Interruptores del tipo de notificación (Configuración → Notificaciones)
  const { data: tipo } = await supabase
    .from("correo_tipos_notificacion")
    .select("activo, enviar_correo, enviar_whatsapp")
    .eq("codigo", EVENT_KEY)
    .maybeSingle();
  const tipoActivo = tipo?.activo !== false;
  const usarCorreo = tipoActivo && tipo?.enviar_correo !== false;
  const usarWhatsApp = tipoActivo && tipo?.enviar_whatsapp !== false;

  const varsTexto: Record<string, string> = {
    nombre: primerNombre,
    nombre_completo: nombre,
    folio: pedido.folio_oc || "",
    oficina: pedido.invitado_oficina_nombre || "",
    fecha,
    total: mxn(total),
    productos_texto: productosTexto,
  };
  const varsHtml: Record<string, string> = {
    ...Object.fromEntries(Object.entries(varsTexto).map(([k, v]) => [k, esc(v)])),
    productos_html: productosHtml,
  };

  // ── Correo ──
  let emailOk = false;
  let emailErr: string | null = null;
  const asunto = render(plantilla.email_subject_template || PLANTILLA_DEFAULT.email_subject_template, varsTexto);
  let cuerpo = render(plantilla.email_body_template || PLANTILLA_DEFAULT.email_body_template, varsHtml);
  if (!usarCorreo) {
    emailErr = "Correo desactivado en la configuración";
  } else if (pedido.invitado_email) {
    const canal = await canalCorreo(supabase, plantilla.resend_channel_id);
    if (!canal) emailErr = "Sin canal de correo configurado";
    else {
      if (canal.header_html || canal.footer_html) {
        cuerpo = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:16px;background-color:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">${canal.header_html ? `<tr><td>${canal.header_html}</td></tr>` : ""}<tr><td style="padding:32px;">${cuerpo}</td></tr>${canal.footer_html ? `<tr><td>${canal.footer_html}</td></tr>` : ""}</table></td></tr></table></body></html>`;
      }
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${canal.api_key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: canal.from, to: [pedido.invitado_email], subject: asunto, html: cuerpo }),
        });
        emailOk = res.ok;
        if (!res.ok) emailErr = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
      } catch (e) {
        emailErr = e instanceof Error ? e.message : "Error de correo";
      }
    }
    await registrar(supabase, "correo", pedido.invitado_email, nombre, asunto, cuerpo, emailOk, emailErr);
  } else {
    emailErr = "Pedido sin correo";
  }

  // ── WhatsApp ──
  let waOk = false;
  let waErr: string | null = null;
  const mensaje = render(plantilla.whatsapp_body_template || PLANTILLA_DEFAULT.whatsapp_body_template, varsTexto);
  if (!usarWhatsApp) {
    waErr = "WhatsApp desactivado en la configuración";
  } else if (pedido.invitado_whatsapp) {
    const canal = await canalWhatsApp(supabase, plantilla.wazzup24_channel_id);
    const chatId = normalizarTelefonoMx(pedido.invitado_whatsapp);
    if (!canal) waErr = "Sin canal de WhatsApp configurado";
    else {
      try {
        const res = await fetch("https://api.wazzup24.com/v3/message", {
          method: "POST",
          headers: { Authorization: `Bearer ${canal.api_key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: canal.channel_id, chatType: "whatsapp", chatId, text: mensaje }),
        });
        waOk = res.ok;
        if (!res.ok) waErr = `Wazzup ${res.status}: ${(await res.text()).slice(0, 300)}`;
      } catch (e) {
        waErr = e instanceof Error ? e.message : "Error de WhatsApp";
      }
    }
    await registrar(supabase, "whatsapp", chatId, nombre, `Pedido ${pedido.folio_oc}`, mensaje, waOk, waErr);
  } else {
    waErr = "Pedido sin WhatsApp";
  }

  await supabase
    .from("store_pedidos")
    .update({
      confirmacion_email_ok: emailOk,
      confirmacion_whatsapp_ok: waOk,
      confirmacion_error: [emailErr && `Correo: ${emailErr}`, waErr && `WhatsApp: ${waErr}`].filter(Boolean).join(" | ") || null,
    })
    .eq("id", pedido.id);

  return json({ ok: emailOk || waOk, email: emailOk, whatsapp: waOk, email_error: emailErr, whatsapp_error: waErr });
});
