import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateTaskRequest {
  agentUserId: string;
  messageIds: string[];
  attachmentIds?: string[];
  task: {
    instrucciones: string;
    tipo_tramite?: string;
    prioridad?: string;
    assigned_to_user_id?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: senderUser } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id, nombre_completo")
      .eq("id", user.id)
      .maybeSingle();

    if (!senderUser || !["Administrador", "Gerente", "Empleado", "Ejecutivo"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para crear tramites");
    }

    const { agentUserId, messageIds, attachmentIds, task } = await req.json() as CreateTaskRequest;

    if (!agentUserId || !messageIds || messageIds.length === 0 || !task) {
      throw new Error("Faltan campos requeridos");
    }

    if (!task.instrucciones) {
      throw new Error("El tramite requiere instrucciones");
    }

    const { data: agent } = await supabase
      .from("usuarios")
      .select("id, oficina_id, nombre_completo")
      .eq("id", agentUserId)
      .maybeSingle();

    if (!agent) throw new Error("Agente no encontrado");

    if (senderUser.rol !== "Administrador" && agent.oficina_id !== senderUser.oficina_id) {
      throw new Error("No tienes permiso para crear tramites para este agente");
    }

    const { data: estatusIniciado } = await supabase
      .from("ticket_estatus")
      .select("id")
      .eq("nombre", "Iniciado")
      .maybeSingle();

    if (!estatusIniciado) throw new Error("No se encontro el estatus Iniciado");

    const { data: folioData, error: folioError } = await supabase.rpc("generate_next_folio");
    if (folioError || !folioData) throw new Error("Error generando folio: " + (folioError?.message || "unknown"));

    const { data: createdTicket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        folio: folioData,
        tipo_tramite: task.tipo_tramite || "registro_actividad",
        estatus_id: estatusIniciado.id,
        prioridad: task.prioridad || "Media",
        instrucciones: task.instrucciones,
        agente_usuario_id: agentUserId,
        creado_por: senderUser.id,
        assigned_to_user_id: task.assigned_to_user_id || senderUser.id,
        cerrado: false,
        metadata: {
          source: "centro_contacto",
          created_from_messages: messageIds.length,
        },
      })
      .select("id, folio")
      .single();

    if (ticketError || !createdTicket) {
      throw new Error(`Error al crear tramite: ${ticketError?.message || "unknown"}`);
    }

    const linkItems: Record<string, unknown>[] = messageIds.map((msgId) => ({
      ticket_id: createdTicket.id,
      contact_center_message_id: msgId,
      agent_user_id: agentUserId,
      added_by_user_id: senderUser.id,
      item_type: "message",
      action_type: "created_task",
      metadata: { folio: createdTicket.folio, created_at: new Date().toISOString() },
    }));

    if (attachmentIds && attachmentIds.length > 0) {
      for (const attId of attachmentIds) {
        linkItems.push({
          ticket_id: createdTicket.id,
          contact_center_attachment_id: attId,
          agent_user_id: agentUserId,
          added_by_user_id: senderUser.id,
          item_type: "attachment",
          action_type: "created_task",
          metadata: { folio: createdTicket.folio, created_at: new Date().toISOString() },
        });

        const { data: attachment } = await supabase
          .from("contact_center_attachments")
          .select("file_name, file_url, file_type, mime_type")
          .eq("id", attId)
          .maybeSingle();

        if (attachment) {
          await supabase.from("ticket_archivos").insert({
            ticket_id: createdTicket.id,
            usuario_id: senderUser.id,
            nombre: attachment.file_name,
            url: attachment.file_url || "",
            tipo: attachment.mime_type || attachment.file_type,
            tamano: 0,
            metadata: {
              source: "centro_contacto",
              contact_center_attachment_id: attId,
            },
          });
        }
      }
    }

    await supabase.from("task_contact_center_items").insert(linkItems);

    await supabase.from("contact_center_audit_log").insert({
      user_id: senderUser.id,
      agent_user_id: agentUserId,
      action: "create_tramite_from_messages",
      task_id: createdTicket.id,
      message_ids: messageIds,
      attachment_ids: attachmentIds || [],
      result: "success",
      metadata: {
        folio: createdTicket.folio,
        agent_name: agent.nombre_completo,
        instrucciones: task.instrucciones.substring(0, 200),
      },
    });

    return new Response(
      JSON.stringify({ success: true, ticket_id: createdTicket.id, folio: createdTicket.folio }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
