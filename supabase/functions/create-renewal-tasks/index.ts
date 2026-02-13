import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[Renewal-Tasks] Iniciando creación de tareas de renovación");

    const { data: renovaciones, error: renovacionesError } = await supabase
      .from('sicas_renovaciones_proximas')
      .select('*')
      .lte('dias_para_vencer', 60)
      .order('dias_para_vencer', { ascending: true });

    if (renovacionesError) {
      throw renovacionesError;
    }

    console.log(`[Renewal-Tasks] ${renovaciones.length} renovaciones encontradas`);

    const tasksCreated = {
      prioridad_alta: 0,
      prioridad_media: 0,
      prioridad_baja: 0,
    };

    for (const renovacion of renovaciones) {
      const { data: mapeo } = await supabase
        .from('sicas_mapeo_vendedor_usuario')
        .select('movi_user_id')
        .eq('id_sicas_vendedor', renovacion.vend_id)
        .single();

      if (!mapeo?.movi_user_id) {
        console.log(`[Renewal-Tasks] Sin mapeo para vendedor ${renovacion.vend_id}`);
        continue;
      }

      const taskTitle = `Renovación: ${renovacion.contratante} - ${renovacion.no_poliza}`;
      const taskDescription = `
**Póliza por renovar**

**Aseguradora:** ${renovacion.aseguradora}
**Ramo:** ${renovacion.ramo}
**Contratante:** ${renovacion.contratante}
**Vencimiento:** ${new Date(renovacion.vigencia_hasta).toLocaleDateString('es-MX')}
**Prima:** $${renovacion.prima_total?.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
**Días para vencer:** ${renovacion.dias_para_vencer}

**Acciones sugeridas:**
1. Contactar al cliente
2. Revisar condiciones actuales
3. Preparar cotización renovación
4. Enviar propuesta
      `.trim();

      const { data: existingTask } = await supabase
        .from('crm_tareas')
        .select('id')
        .eq('usuario_id', mapeo.movi_user_id)
        .eq('titulo', taskTitle)
        .eq('estado', 'pendiente')
        .maybeSingle();

      if (existingTask) {
        console.log(`[Renewal-Tasks] Tarea ya existe: ${taskTitle}`);
        continue;
      }

      const prioridad = renovacion.prioridad_renovacion === 'alta' ? 'alta' :
                       renovacion.prioridad_renovacion === 'media' ? 'media' : 'baja';

      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + renovacion.dias_para_vencer);

      const { error: insertError } = await supabase
        .from('crm_tareas')
        .insert({
          usuario_id: mapeo.movi_user_id,
          titulo: taskTitle,
          descripcion: taskDescription,
          fecha_vencimiento: fechaVencimiento.toISOString(),
          prioridad,
          estado: 'pendiente',
          categoria: 'renovacion',
        });

      if (insertError) {
        console.error(`[Renewal-Tasks] Error al crear tarea:`, insertError);
        continue;
      }

      if (prioridad === 'alta') tasksCreated.prioridad_alta++;
      else if (prioridad === 'media') tasksCreated.prioridad_media++;
      else tasksCreated.prioridad_baja++;

      console.log(`[Renewal-Tasks] Tarea creada: ${taskTitle} (${prioridad})`);

      if (renovacion.dias_para_vencer <= 7 || renovacion.dias_para_vencer === 15 || renovacion.dias_para_vencer === 30) {
        try {
          const { data: usuario } = await supabase
            .from('usuarios')
            .select('nombre_completo, email_laboral, celular_laboral')
            .eq('id', mapeo.movi_user_id)
            .single();

          if (usuario) {
            await supabase.rpc('enviar_notificacion_completa', {
              p_tipo: 'renovacion_proxima',
              p_destinatario_id: mapeo.movi_user_id,
              p_titulo: `Renovación en ${renovacion.dias_para_vencer} días`,
              p_mensaje: `La póliza ${renovacion.no_poliza} de ${renovacion.contratante} vence en ${renovacion.dias_para_vencer} días.`,
              p_url: '/mi-crm?tab=tareas',
              p_variables: {
                nombre_usuario: usuario.nombre_completo,
                poliza: renovacion.no_poliza,
                cliente: renovacion.contratante,
                aseguradora: renovacion.aseguradora,
                dias_vencimiento: renovacion.dias_para_vencer.toString(),
                fecha_vencimiento: new Date(renovacion.vigencia_hasta).toLocaleDateString('es-MX'),
                prima: `$${renovacion.prima_total?.toLocaleString('es-MX')}`,
                url_tareas: `${Deno.env.get("SUPABASE_URL")}/mi-crm?tab=tareas`,
              },
            });

            console.log(`[Renewal-Tasks] Notificación enviada para ${renovacion.no_poliza}`);
          }
        } catch (notifError) {
          console.error(`[Renewal-Tasks] Error al enviar notificación:`, notifError);
        }
      }
    }

    const totalTasksCreated = tasksCreated.prioridad_alta + tasksCreated.prioridad_media + tasksCreated.prioridad_baja;

    console.log(`[Renewal-Tasks] Proceso completado: ${totalTasksCreated} tareas creadas`);

    return new Response(
      JSON.stringify({
        success: true,
        tasks_created: totalTasksCreated,
        by_priority: tasksCreated,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Renewal-Tasks] Error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
