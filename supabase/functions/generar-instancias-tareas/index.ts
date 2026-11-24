import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayOfWeek = now.getDay();   // 0=dom..6=sab
    const dayOfMonth = now.getDate(); // 1-31

    // Recurrencias activas dentro de su rango de fechas
    const { data: recurrencias, error: rErr } = await supabase
      .from('ticket_tipos_recurrencia')
      .select('*')
      .eq('activo', true)
      .lte('fecha_inicio', todayDate)
      .or(`fecha_fin.is.null,fecha_fin.gte.${todayDate}`);

    if (rErr) throw rErr;

    if (!recurrencias?.length) {
      return new Response(JSON.stringify({ ok: true, procesadas: 0, tickets_creados: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cargar tipos de trámite y estatus fallback en batch
    const tipoIds = [...new Set(recurrencias.map((r: any) => r.ticket_tipo_id))];
    const [{ data: tiposData }, { data: estatusFallback }] = await Promise.all([
      supabase.from('ticket_tipos').select('id, value').in('id', tipoIds),
      supabase.from('ticket_estatus').select('id').eq('activo', true).order('orden', { ascending: true }).limit(1).maybeSingle(),
    ]);

    const tiposMap: Record<string, string> = {};
    for (const t of tiposData ?? []) tiposMap[t.id] = t.value;

    const fallbackEstatusId: string | null = estatusFallback?.id ?? null;

    let totalCreados = 0;

    for (const rec of recurrencias) {
      // ¿Corresponde hoy según la frecuencia?
      const corresponde =
        rec.frecuencia === 'diaria' ||
        (rec.frecuencia === 'semanal' && (rec.dias_semana ?? []).includes(dayOfWeek)) ||
        (rec.frecuencia === 'mensual' && rec.dia_mes === dayOfMonth);

      if (!corresponde) continue;

      // Evitar duplicados (el cron puede dispararse más de una vez por día)
      const { data: yaHecho } = await supabase
        .from('ticket_recurrencia_log')
        .select('id')
        .eq('recurrencia_id', rec.id)
        .eq('fecha_generada', todayDate)
        .maybeSingle();

      if (yaHecho) continue;

      const tipoValue = tiposMap[rec.ticket_tipo_id];
      const estatusId = rec.estatus_id_inicial ?? fallbackEstatusId;

      if (!tipoValue || !estatusId) {
        console.error(`Recurrencia ${rec.id}: tipo o estatus no encontrado, saltando`);
        continue;
      }

      const fechaVence = new Date(now);
      fechaVence.setDate(fechaVence.getDate() + (rec.dias_para_vencer ?? 1));

      const ticketBase = {
        folio: '',  // trigger DB lo reemplaza automáticamente
        tipo_tramite: tipoValue,
        prioridad: 'Media',
        instrucciones: '',
        estatus_id: estatusId,
        creado_por: rec.created_by ?? null,
        recurrencia_id: rec.id,
        fecha_vencimiento_tarea: fechaVence.toISOString().slice(0, 10),
      };

      let creados = 0;

      if (rec.asignacion_tipo === 'pool') {
        const { error } = await supabase.from('tickets').insert({
          ...ticketBase,
          grupo_asignado_id: rec.grupo_id,
        });
        if (!error) creados = 1;
        else console.error(`pool insert [rec=${rec.id}]:`, error.message);

      } else if (rec.asignacion_tipo === 'todos_del_grupo') {
        const { data: miembros } = await supabase
          .from('tramites_grupos_miembros')
          .select('usuario_id')
          .eq('grupo_id', rec.grupo_id);

        for (const m of miembros ?? []) {
          const { error } = await supabase.from('tickets').insert({
            ...ticketBase,
            grupo_asignado_id: rec.grupo_id,
            assigned_to_user_id: m.usuario_id,
            agente_id: m.usuario_id,
          });
          if (!error) creados++;
          else console.error(`member insert [rec=${rec.id}, user=${m.usuario_id}]:`, error.message);
        }

      } else if (rec.asignacion_tipo === 'usuario_especifico') {
        const { error } = await supabase.from('tickets').insert({
          ...ticketBase,
          assigned_to_user_id: rec.usuario_id,
          agente_id: rec.usuario_id,
          grupo_asignado_id: rec.grupo_id,
        });
        if (!error) creados = 1;
        else console.error(`user insert [rec=${rec.id}]:`, error.message);
      }

      if (creados > 0) {
        await supabase.from('ticket_recurrencia_log').insert({
          recurrencia_id: rec.id,
          fecha_generada: todayDate,
          tickets_creados: creados,
        });
        totalCreados += creados;
        console.log(`Recurrencia ${rec.id} (${rec.nombre}): ${creados} tickets`);
      }
    }

    console.log(`generar-instancias-tareas [${todayDate}]: ${recurrencias.length} evaluadas, ${totalCreados} tickets creados`);

    return new Response(
      JSON.stringify({ ok: true, procesadas: recurrencias.length, tickets_creados: totalCreados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: any) {
    console.error('generar-instancias-tareas:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
