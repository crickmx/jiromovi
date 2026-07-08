import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // No se filtra por tipo_tramite: el tipo que dispara reportes de bug es configurable desde
    // Admin > Reportes de Bugs y puede cambiar. La existencia de una fila en bug_reportes es lo
    // que confirma que este ticket es, en efecto, un reporte de bug.
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, folio, instrucciones, creado_por, tipo_tramite")
      .eq("id", ticket_id)
      .maybeSingle();
    const { data: bugReporte } = await supabase
      .from("bug_reportes")
      .select("errores_consola, peticiones_fallidas, rutas_visitadas, user_agent, viewport")
      .eq("ticket_id", ticket_id)
      .maybeSingle();
    if (!ticket || !bugReporte) {
      return new Response(JSON.stringify({ error: "Reporte de bug no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un ingeniero de soporte técnico de una plataforma web interna (React + TypeScript + Supabase) usada por una aseguradora en México. Un usuario reportó un problema. Con el reporte del usuario y el log técnico capturado por el navegador, da un diagnóstico preliminar breve y en español. No inventes causas si el log no da suficiente evidencia — en ese caso dilo claramente. Responde en JSON estricto: {"diagnostico": "..."}. El campo diagnostico debe incluir: 1) Hipótesis de la causa probable, 2) Qué archivo/área del sistema revisar primero si es identificable por la ruta visitada, 3) Nivel de confianza (alto/medio/bajo). Máximo 800 caracteres.`;

    const userPrompt = `Descripción del usuario: ${ticket.instrucciones}

Ruta donde ocurrió: ${bugReporte?.rutas_visitadas?.[bugReporte.rutas_visitadas.length - 1]?.ruta || "desconocida"}
Rutas visitadas antes (más reciente al final): ${JSON.stringify(bugReporte?.rutas_visitadas || [])}
Errores de consola: ${JSON.stringify(bugReporte?.errores_consola || [])}
Peticiones de red fallidas: ${JSON.stringify(bugReporte?.peticiones_fallidas || [])}
Navegador: ${bugReporte?.user_agent || "desconocido"}
Viewport: ${bugReporte?.viewport || "desconocido"}`;

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });
    const completionJson = await completion.json();
    if (!completion.ok) {
      return new Response(JSON.stringify({ error: completionJson.error?.message || "Error de OpenAI" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let diagnostico = "No se pudo generar diagnóstico automático.";
    try {
      diagnostico = JSON.parse(completionJson.choices[0].message.content).diagnostico || diagnostico;
    } catch {
      // deja el mensaje por default
    }

    await supabase
      .from("bug_reportes")
      .update({ diagnostico_ia: diagnostico, diagnostico_ia_generado_en: new Date().toISOString() })
      .eq("ticket_id", ticket_id);

    // Deja constancia en el hilo de comentarios del trámite — visible para el equipo que lo atiende.
    await supabase.from("ticket_comentarios").insert({
      ticket_id,
      usuario_id: ticket.creado_por,
      mensaje: `🤖 Diagnóstico automático (IA)\n\nReporte: ${ticket.instrucciones}\n\nDiagnóstico: ${diagnostico}`,
    });

    // Si el admin configuró a qué estatus pasar tras el diagnóstico, se aplica aquí.
    const { data: bugConfig } = await supabase
      .from("bug_report_config")
      .select("estatus_post_diagnostico_slug")
      .eq("id", 1)
      .maybeSingle();

    if (bugConfig?.estatus_post_diagnostico_slug) {
      const { data: tipoRow } = await supabase
        .from("ticket_tipos")
        .select("id")
        .eq("value", ticket.tipo_tramite)
        .maybeSingle();
      const { data: estatusCampo } = tipoRow
        ? await supabase
            .from("tramite_tipo_campos")
            .select("id, config")
            .eq("tramite_tipo_id", tipoRow.id)
            .eq("tipo", "estatus")
            .maybeSingle()
        : { data: null };

      const opcion = (estatusCampo?.config?.opciones || []).find(
        (o: { slug: string }) => o.slug === bugConfig.estatus_post_diagnostico_slug
      );
      if (estatusCampo && opcion) {
        const color = opcion.clasificacion === "inicio" ? "#3B82F6"
          : opcion.clasificacion === "terminacion" ? "#059669"
          : opcion.clasificacion === "en_espera" ? "#F59E0B"
          : "#6B7280";
        await supabase.from("tickets").update({ custom_estatus_label: opcion.label, custom_estatus_color: color }).eq("id", ticket_id);
        await supabase.from("tramite_respuestas").upsert(
          { tramite_id: ticket_id, campo_id: estatusCampo.id, valor_json: opcion.slug },
          { onConflict: "tramite_id,campo_id" }
        );
      }
    }

    return new Response(JSON.stringify({ diagnostico }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
