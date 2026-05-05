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
    descripcion: string;
    tipo_actividad: string;
    fecha_vencimiento: string;
    prioridad?: string;
    estatus?: string;
    board_id?: string;
    asignado_a?: string;
    contacto_id?: string;
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

    if (!senderUser || !["Administrador", "Gerente", "Empleado"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para crear tareas");
    }

    const { agentUserId, messageIds, attachmentIds, task } = await req.json() as CreateTaskRequest;

    if (!agentUserId || !messageIds || messageIds.length === 0 || !task) {
      throw new Error("Faltan campos requeridos");
    }

    if (!task.descripcion || !task.tipo_actividad || !task.fecha_vencimiento) {
      throw new Error("La tarea requiere descripcion, tipo_actividad y fecha_vencimiento");
    }

    // Verify agent exists and user has access
    const { data: agent } = await supabase
      .from("usuarios")
      .select("id, oficina_id, nombre_completo")
      .eq("id", agentUserId)
      .maybeSingle();

    if (!agent) throw new Error("Agente no encontrado");

    if (senderUser.rol !== "Administrador" && agent.oficina_id !== senderUser.oficina_id) {
      throw new Error("No tienes permiso para crear tareas para este agente");
    }

    // Create the task
    const { data: createdTask, error: taskError } = await supabase
      .from("crm_tareas")
      .insert({
        descripcion: task.descripcion,
        tipo_actividad: task.tipo_actividad,
        fecha_vencimiento: task.fecha_vencimiento,
        prioridad: task.prioridad || "Media",
        estatus: task.estatus || "Pendiente",
        board_id: task.board_id || null,
        asignado_a: task.asignado_a || null,
        contacto_id: task.contacto_id || null,
        creado_por: senderUser.id,
      })
      .select("id")
      .single();

    if (taskError || !createdTask) {
      throw new Error(`Error al crear tarea: ${taskError?.message || "unknown"}`);
    }

    // Link messages to task
    const linkItems = messageIds.map((msgId) => ({
      task_id: createdTask.id,
      contact_center_message_id: msgId,
      agent_user_id: agentUserId,
      added_by_user_id: senderUser.id,
      item_type: "message",
      action_type: "created_task",
      metadata: { task_created_at: new Date().toISOString() },
    }));

    // Link attachments if any
    if (attachmentIds && attachmentIds.length > 0) {
      for (const attId of attachmentIds) {
        linkItems.push({
          task_id: createdTask.id,
          contact_center_message_id: attId,
          agent_user_id: agentUserId,
          added_by_user_id: senderUser.id,
          item_type: "attachment",
          action_type: "created_task",
          metadata: { task_created_at: new Date().toISOString() },
        });
      }
    }

    await supabase.from("task_contact_center_items").insert(linkItems);

    // Audit log
    await supabase.from("contact_center_audit_log").insert({
      user_id: senderUser.id,
      agent_user_id: agentUserId,
      action: "create_task_from_messages",
      task_id: createdTask.id,
      message_ids: messageIds,
      attachment_ids: attachmentIds || [],
      result: "success",
      metadata: {
        task_descripcion: task.descripcion.substring(0, 200),
        agent_name: agent.nombre_completo,
      },
    });

    return new Response(
      JSON.stringify({ success: true, task_id: createdTask.id }),
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
