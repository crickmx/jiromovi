import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AddToTaskRequest {
  agentUserId: string;
  taskId: string;
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

    if (!senderUser || !["Administrador", "Gerente", "Empleado"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para modificar tareas");
    }

    const { agentUserId, taskId, messageIds, attachmentIds, commentText } = await req.json() as AddToTaskRequest;

    if (!agentUserId || !taskId || !messageIds || messageIds.length === 0) {
      throw new Error("Faltan campos requeridos: agentUserId, taskId, messageIds");
    }

    // Verify task exists and user has access
    const { data: task } = await supabase
      .from("crm_tareas")
      .select("id, creado_por, board_id")
      .eq("id", taskId)
      .maybeSingle();

    if (!task) throw new Error("Tarea no encontrada");

    // Check permission: creator or admin
    if (senderUser.rol !== "Administrador" && task.creado_por !== senderUser.id) {
      // Check if user is board member with edit access
      if (task.board_id) {
        const { data: membership } = await supabase
          .from("crm_board_members")
          .select("rol")
          .eq("board_id", task.board_id)
          .eq("user_id", senderUser.id)
          .maybeSingle();

        if (!membership || !["owner", "admin", "editor"].includes(membership.rol)) {
          throw new Error("No tienes permiso para modificar esta tarea");
        }
      } else {
        throw new Error("No tienes permiso para modificar esta tarea");
      }
    }

    // Check for duplicates
    const { data: existingLinks } = await supabase
      .from("task_contact_center_items")
      .select("contact_center_message_id")
      .eq("task_id", taskId)
      .in("contact_center_message_id", messageIds);

    const existingMsgIds = new Set((existingLinks || []).map((l) => l.contact_center_message_id));
    const newMessageIds = messageIds.filter((id) => !existingMsgIds.has(id));

    if (newMessageIds.length === 0 && (!attachmentIds || attachmentIds.length === 0)) {
      return new Response(
        JSON.stringify({ success: true, message: "Todos los mensajes ya estaban vinculados a esta tarea", added: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link new messages
    const linkItems: Record<string, unknown>[] = newMessageIds.map((msgId) => ({
      task_id: taskId,
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
          task_id: taskId,
          contact_center_message_id: null,
          contact_center_attachment_id: attId,
          agent_user_id: agentUserId,
          added_by_user_id: senderUser.id,
          item_type: "attachment",
          action_type: "added_to_existing_task",
          metadata: { added_at: new Date().toISOString() },
        });
      }
    }

    if (linkItems.length > 0) {
      await supabase.from("task_contact_center_items").insert(linkItems);
    }

    // Add comment to task description if provided
    if (commentText) {
      const { data: currentTask } = await supabase
        .from("crm_tareas")
        .select("descripcion")
        .eq("id", taskId)
        .single();

      if (currentTask) {
        const updatedDesc = currentTask.descripcion + "\n\n---\n" + commentText;
        await supabase
          .from("crm_tareas")
          .update({ descripcion: updatedDesc })
          .eq("id", taskId);
      }
    }

    // Audit log
    await supabase.from("contact_center_audit_log").insert({
      user_id: senderUser.id,
      agent_user_id: agentUserId,
      action: "add_messages_to_existing_task",
      task_id: taskId,
      message_ids: newMessageIds,
      attachment_ids: attachmentIds || [],
      result: "success",
      metadata: {
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
