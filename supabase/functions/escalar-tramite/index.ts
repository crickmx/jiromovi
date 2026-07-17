import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { ticket_id, destinatario, comentario } = await req.json() as {
    ticket_id: string;
    destinatario: "supervisor" | "director" | "ambos";
    comentario: string;
  };

  // 1. Ticket info
  const { data: ticket } = await supabase
    .from("tickets")
    .select("folio, tipo_tramite, grupo_asignado_id, instrucciones, agente_usuario_id, attending_user_id, custom_estatus_label")
    .eq("id", ticket_id)
    .single();

  if (!ticket) return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: corsHeaders });

  // 2. Find supervisor/director in the team
  const rolesQuery = destinatario === "supervisor"
    ? ["supervisor"]
    : destinatario === "director"
    ? ["director"]
    : ["supervisor", "director"];

  const { data: miembros } = await supabase
    .from("tramites_grupos_miembros")
    .select("usuario_id")
    .eq("grupo_id", ticket.grupo_asignado_id)
    .in("rol_en_equipo", rolesQuery)
    .eq("activo", true);

  if (!miembros || miembros.length === 0) {
    return new Response(JSON.stringify({ ok: true, notified: 0 }), { headers: corsHeaders });
  }

  // 3. Get contact info for each recipient
  const userIds = miembros.map((m: { usuario_id: string }) => m.usuario_id);
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nombre, apellidos, email, telefono")
    .in("id", userIds);

  if (!usuarios || usuarios.length === 0) {
    return new Response(JSON.stringify({ ok: true, notified: 0 }), { headers: corsHeaders });
  }

  // 4. Build message
  const mensaje =
    `🔔 *Escalación de trámite — ${ticket.folio}*\n\n` +
    `Tipo: ${ticket.tipo_tramite ?? "—"}\n` +
    `Estatus: ${ticket.custom_estatus_label ?? "—"}\n\n` +
    `*Comentario del ejecutivo:*\n${comentario}\n\n` +
    `Ver trámite: https://app.movi.digital/tramites/${ticket_id}`;

  const subject = `Escalación — Trámite ${ticket.folio}`;
  const htmlBody =
    `<p><strong>Escalación de trámite: ${ticket.folio}</strong></p>` +
    `<p>Tipo: ${ticket.tipo_tramite ?? "—"}<br>Estatus: ${ticket.custom_estatus_label ?? "—"}</p>` +
    `<p><strong>Comentario del ejecutivo:</strong><br>${comentario.replace(/\n/g, "<br>")}</p>` +
    `<p><a href="https://app.movi.digital/tramites/${ticket_id}">Ver trámite</a></p>`;

  // 5. Send notifications
  let notified = 0;
  const origin = req.headers.get("origin") ?? Deno.env.get("SUPABASE_URL")!;

  for (const u of usuarios as { id: string; nombre: string; apellidos: string; email: string | null; telefono: string | null }[]) {
    // WhatsApp
    if (u.telefono) {
      await supabase.functions.invoke("send-direct-whatsapp", {
        body: { to: u.telefono, message: mensaje },
      });
    }

    // Email
    if (u.email) {
      await supabase.functions.invoke("send-direct-email", {
        body: { to: u.email, subject, html: htmlBody },
      });
    }

    // In-app notification
    await supabase.rpc("crear_notificacion", {
      p_usuario_id: u.id,
      p_tipo: "escalacion_tramite",
      p_titulo: `Escalación — ${ticket.folio}`,
      p_mensaje: comentario.slice(0, 200),
      p_url: `/tramites/${ticket_id}`,
    }).maybeSingle();

    notified++;
  }

  return new Response(JSON.stringify({ ok: true, notified }), { headers: corsHeaders });
});
