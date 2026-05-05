import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AddToTaskRequest {
  agentUserId: string;
  ticketId?: string;
  taskId?: string;
  messageIds: string[];
  attachmentIds?: string[];
  commentText?: string;
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
      throw new Error("No tienes permiso para modificar tramites");
    }

    const body = await req.json() as AddToTaskRequest;
    const agentUserId = body.agentUserId;
    const ticketId = body.ticketId || body.taskId;
    const messageIds = body.messageIds;
    const attachmentIds = body.attachmentIds;
    const commentText = body.commentText;

    if (!agentUserId || !ticketId || !messageIds || messageIds.length === 0) {
      throw new Error("Faltan campos requeridos: agentUserId, ticketId, messageIds");
    }

    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, folio, creado_por, agente_usuario_id, assigned_to_user_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticket) throw new Error("Tramite no encontrado");

    if (senderUser.rol !== "Administrador") {
      const isCreator = ticket.creado_por === senderUser.id;
      const isAssigned = ticket.assigned_to_user_id === senderUser.id;
      if (!isCreator && !isAssigned) {
        const { data: agentData } = await supabase
          .from("usuarios")
          .select("oficina_id")
          .eq("id", ticket.agente_usuario_id)
          .maybeSingle();

        if (!agentData || agentData.oficina_id !== senderUser.oficina_id) {
          throw new Error("No tienes permiso para modificar este tramite");
        }
      }
    }

    const { data: existingLinks } = await supabase
      .from("task_contact_center_items")
      .select("contact_center_message_id")
      .eq("ticket_id", ticketId)
      .in("contact_center_message_id", messageIds);

    const existingMsgIds = new Set((existingLinks || []).map((l) => l.contact_center_message_id));
    const newMessageIds = messageIds.filter((id) => !existingMsgIds.has(id));

    if (newMessageIds.length === 0 && (!attachmentIds || attachmentIds.length === 0)) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos los mensajes ya estaban vinculados a este tramite", added: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const linkItems: Record<string, unknown>[] = newMessageIds.map((msgId) => ({
      ticket_id: ticketId,
      contact_center_message_id: msgId,
      agent_user_id: agentUserId,
      added_by_user_id: senderUser.id,
      item_type: "message",
      action_type: "added_to_existing_task",
      metadata: { added_at: new Date().toISOString() },
    }));

    if (attachmentIds && attachmentIds.length > 0) {
      for (const attId of attachmentIds) {
        linkItems.push({
          ticket_id: ticketId,
          contact_center_attachment_id: attId,
          agent_user_id: agentUserId,
          added_by_user_id: senderUser.id,
          item_type: "attachment",
          action_type: "added_to_existing_task",
          metadata: { added_at: new Date().toISOString() },
        });

        const { data: attachment } = await supabase
          .from("contact_center_attachments")
          .select("file_name, file_url, file_type, mime_type")
          .eq("id", attId)
          .maybeSingle();

        if (attachment) {
          await supabase.from("ticket_archivos").insert({
            ticket_id: ticketId,
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

    if (linkItems.length > 0) {
      await supabase.from("task_contact_center_items").insert(linkItems);
    }

    if (commentText) {
      await supabase.from("ticket_comentarios").insert({
        ticket_id: ticketId,
        usuario_id: senderUser.id,
        mensaje: commentText,
      });
    }

    await supabase.from("contact_center_audit_log").insert({
      user_id: senderUser.id,
      agent_user_id: agentUserId,
      action: "add_messages_to_existing_tramite",
      task_id: ticketId,
      message_ids: newMessageIds,
      attachment_ids: attachmentIds || [],
      result: "success",
      metadata: {
        folio: ticket.folio,
        total_added: linkItems.length,
        duplicates_skipped: messageIds.length - newMessageIds.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        added: linkItems.length,
        duplicates_skipped: messageIds.length - newMessageIds.length,
      }),
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
