import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ModuleSnapshot {
  usuario: { nombre: string; rol: string; oficina?: string };
  sicas: {
    polizas_vigentes: number;
    fianzas_vigentes: number;
    prima_vigente: number;
    polizas_emitidas: number;
    mes_emisiones: number;
    mes_prima_total: number;
    renovaciones_7dias: number;
    renovaciones_15dias: number;
    renovaciones_30dias: number;
    prima_renovar: number;
    cancelaciones: number;
    variacion_mes_anterior: number;
    clientes_total: number;
    top_ramo: string;
    top_aseguradora: string;
    top_cliente: string;
  } | null;
  tickets: {
    abiertos: number;
    en_proceso: number;
    cerrados_mes: number;
    total_mes: number;
    vencidos: number;
  } | null;
  comisiones: {
    total_periodo_actual: number;
    total_periodo_anterior: number;
    batches_cerrados: number;
    variacion_porcentaje: number;
  } | null;
  crm: {
    contactos_total: number;
    prospectos: number;
    clientes: number;
    cotizaciones_activas: number;
    tareas_pendientes: number;
    tareas_vencidas: number;
    contactos_recientes_30d: number;
  } | null;
  webLeads: {
    leads_total: number;
    leads_mes: number;
    leads_sin_seguimiento: number;
    tiene_pagina_web: boolean;
  } | null;
  gamificacion: {
    nivel_actual: number;
    dias_racha: number;
    posicion_ranking: number | null;
  } | null;
  comunicados: { sin_leer: number } | null;
}

function buildChatGPTPrompt(snapshot: ModuleSnapshot, periodo: string): string {
  const nombre = snapshot.usuario.nombre.split(" ")[0];
  const sections: string[] = [];

  if (snapshot.sicas) {
    const s = snapshot.sicas;
    const lines: string[] = [];
    if (s.polizas_vigentes > 0)
      lines.push(`Polizas vigentes: ${s.polizas_vigentes}`);
    if (s.prima_vigente > 0)
      lines.push(`Prima vigente total: $${fmtNum(s.prima_vigente)}`);
    if (s.mes_emisiones > 0)
      lines.push(
        `Emisiones este mes: ${s.mes_emisiones}, prima emitida: $${fmtNum(s.mes_prima_total)}`
      );
    if (s.renovaciones_7dias > 0)
      lines.push(`Renovaciones urgentes (7 dias): ${s.renovaciones_7dias}`);
    if (s.renovaciones_15dias > 0)
      lines.push(`Renovaciones proximas (15 dias): ${s.renovaciones_15dias}`);
    if (s.renovaciones_30dias > 0)
      lines.push(
        `Renovaciones 30 dias: ${s.renovaciones_30dias}, prima a renovar: $${fmtNum(s.prima_renovar)}`
      );
    if (s.cancelaciones > 0) lines.push(`Cancelaciones: ${s.cancelaciones}`);
    if (s.variacion_mes_anterior !== 0)
      lines.push(
        `Variacion vs mes anterior: ${s.variacion_mes_anterior > 0 ? "+" : ""}${s.variacion_mes_anterior.toFixed(1)}%`
      );
    if (s.clientes_total > 0)
      lines.push(`Clientes en cartera: ${s.clientes_total}`);
    if (s.top_ramo) lines.push(`Ramo principal: ${s.top_ramo}`);
    if (s.top_aseguradora)
      lines.push(`Aseguradora principal: ${s.top_aseguradora}`);
    if (lines.length > 0)
      sections.push(`PRODUCCION SICAS:\n${lines.join("\n")}`);
  }

  if (snapshot.tickets) {
    const t = snapshot.tickets;
    const lines: string[] = [];
    if (t.abiertos > 0) lines.push(`Tramites abiertos: ${t.abiertos}`);
    if (t.en_proceso > 0) lines.push(`Tramites en proceso: ${t.en_proceso}`);
    if (t.cerrados_mes > 0)
      lines.push(`Cerrados este mes: ${t.cerrados_mes}`);
    if (t.vencidos > 0)
      lines.push(`Sin actualizacion en 7+ dias: ${t.vencidos}`);
    if (lines.length > 0)
      sections.push(`TRAMITES Y TICKETS:\n${lines.join("\n")}`);
  }

  if (snapshot.comisiones) {
    const c = snapshot.comisiones;
    const lines: string[] = [];
    if (c.total_periodo_actual > 0)
      lines.push(
        `Comisiones periodo actual: $${fmtNum(c.total_periodo_actual)}`
      );
    if (c.total_periodo_anterior > 0)
      lines.push(
        `Comisiones periodo anterior: $${fmtNum(c.total_periodo_anterior)}`
      );
    if (c.variacion_porcentaje !== 0)
      lines.push(
        `Variacion: ${c.variacion_porcentaje > 0 ? "+" : ""}${c.variacion_porcentaje.toFixed(1)}%`
      );
    if (lines.length > 0) sections.push(`COMISIONES:\n${lines.join("\n")}`);
  }

  if (snapshot.crm) {
    const crm = snapshot.crm;
    const lines: string[] = [];
    if (crm.contactos_total > 0)
      lines.push(`Contactos totales: ${crm.contactos_total}`);
    if (crm.prospectos > 0) lines.push(`Prospectos activos: ${crm.prospectos}`);
    if (crm.clientes > 0) lines.push(`Clientes: ${crm.clientes}`);
    if (crm.cotizaciones_activas > 0)
      lines.push(`Cotizaciones activas: ${crm.cotizaciones_activas}`);
    if (crm.tareas_pendientes > 0)
      lines.push(`Tareas pendientes: ${crm.tareas_pendientes}`);
    if (crm.tareas_vencidas > 0)
      lines.push(`Tareas vencidas: ${crm.tareas_vencidas}`);
    if (crm.contactos_recientes_30d > 0)
      lines.push(`Nuevos contactos (30d): ${crm.contactos_recientes_30d}`);
    if (lines.length > 0) sections.push(`CRM:\n${lines.join("\n")}`);
  }

  if (snapshot.webLeads) {
    const w = snapshot.webLeads;
    const lines: string[] = [];
    if (w.leads_mes > 0)
      lines.push(`Leads desde pagina web este mes: ${w.leads_mes}`);
    if (w.leads_sin_seguimiento > 0)
      lines.push(`Leads sin seguimiento: ${w.leads_sin_seguimiento}`);
    if (!w.tiene_pagina_web)
      lines.push("Pagina web publica: no configurada");
    if (lines.length > 0)
      sections.push(`MI PAGINA WEB / LEADS:\n${lines.join("\n")}`);
  }

  if (snapshot.comunicados && snapshot.comunicados.sin_leer > 0) {
    sections.push(`COMUNICADOS:\nSin leer: ${snapshot.comunicados.sin_leer}`);
  }

  if (snapshot.gamificacion) {
    const g = snapshot.gamificacion;
    const lines: string[] = [];
    if (g.nivel_actual > 0) lines.push(`Nivel actual: ${g.nivel_actual}`);
    if (g.dias_racha > 0) lines.push(`Dias de racha: ${g.dias_racha}`);
    if (lines.length > 0)
      sections.push(`GAMIFICACION:\n${lines.join("\n")}`);
  }

  const dataBlock =
    sections.length > 0
      ? sections.join("\n\n")
      : "No hay datos suficientes de los modulos en este momento.";

  return `Eres un consultor de negocios experto en seguros y promotorias en Mexico. Tu trabajo es generar un breve mensaje de analisis personalizado para un agente o gerente de seguros basandote en los datos reales de su plataforma de trabajo MOVI Digital.

INSTRUCCIONES ESTRICTAS:
1. Escribe en lenguaje natural, fluido y profesional, como un mentor que habla directamente al usuario.
2. Maximo 2 parrafos cortos (3-5 oraciones en total). Se conciso y directo.
3. NO uses listas, viñetas, markdown, negritas, asteriscos ni formato especial. Solo texto plano.
4. NO enumeres metricas una por una. Interpreta y sintetiza: que significan los datos, que señales positivas o de atencion hay, y que conviene hacer.
5. Si hay datos de varios modulos, integralos naturalmente en el mensaje. No los separes por seccion.
6. Prioriza: alertas urgentes (renovaciones, tareas vencidas, tramites rezagados) > oportunidades (leads, prospectos, crecimiento) > contexto general.
7. Siempre menciona el nombre del usuario al inicio.
8. Si hay poco o ningun dato, genera un mensaje amable y motivador indicando que conforme use la plataforma vera analisis mas completos.
9. NUNCA inventes datos o cifras que no esten en la informacion proporcionada.
10. Todos los textos en español.

Ademas, responde con un JSON asi:
{"message": "tu mensaje en texto plano", "tone": "positive|neutral|attention"}

Donde tone es:
- "positive": produccion creciente, buenas metricas, buen ritmo
- "attention": hay pendientes urgentes, retrasos, caidas, o temas que requieren accion inmediata
- "neutral": situacion estable o datos insuficientes para emitir juicio

USUARIO: ${nombre} (${snapshot.usuario.rol}${snapshot.usuario.oficina ? `, oficina: ${snapshot.usuario.oficina}` : ""})
PERIODO: ${periodo}

DATOS DE SUS MODULOS:
${dataBlock}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

function hasAnyData(snapshot: ModuleSnapshot): boolean {
  return !!(
    snapshot.sicas ||
    snapshot.tickets ||
    snapshot.comisiones ||
    snapshot.crm ||
    snapshot.webLeads ||
    snapshot.gamificacion ||
    snapshot.comunicados
  );
}

function generateFallbackMessage(snapshot: ModuleSnapshot): {
  message: string;
  tone: "positive" | "neutral" | "attention";
} {
  const nombre = snapshot.usuario.nombre.split(" ")[0];
  const parts: string[] = [];
  let tone: "positive" | "neutral" | "attention" = "neutral";

  const s = snapshot.sicas;
  if (s) {
    if (s.mes_prima_total > 0) {
      parts.push(
        `${nombre}, este mes llevas $${fmtNum(s.mes_prima_total)} en prima emitida con ${s.mes_emisiones} emisiones`
      );
      tone = "positive";
    } else if (s.polizas_vigentes > 0) {
      parts.push(
        `${nombre}, tienes ${s.polizas_vigentes} polizas vigentes en tu cartera`
      );
    }
    if (s.renovaciones_7dias > 0) {
      parts.push(
        `Tienes ${s.renovaciones_7dias} renovacion${s.renovaciones_7dias > 1 ? "es" : ""} proxima${s.renovaciones_7dias > 1 ? "s" : ""} en los siguientes 7 dias que conviene gestionar cuanto antes`
      );
      tone = "attention";
    } else if (s.renovaciones_30dias > 0) {
      parts.push(
        `Hay ${s.renovaciones_30dias} renovacion${s.renovaciones_30dias > 1 ? "es" : ""} en los proximos 30 dias por un total de $${fmtNum(s.prima_renovar)}`
      );
    }
  }

  const t = snapshot.tickets;
  if (t && t.abiertos + t.en_proceso > 0) {
    const pending = t.abiertos + t.en_proceso;
    parts.push(
      `En tramites, tienes ${pending} pendiente${pending > 1 ? "s" : ""} de atencion`
    );
    if (t.vencidos > 0) {
      parts.push(
        `${t.vencidos} de ellos lleva${t.vencidos > 1 ? "n" : ""} mas de una semana sin actualizacion`
      );
      tone = "attention";
    }
  }

  const crm = snapshot.crm;
  if (crm) {
    if (crm.tareas_vencidas > 0) {
      parts.push(
        `En tu CRM hay ${crm.tareas_vencidas} tarea${crm.tareas_vencidas > 1 ? "s" : ""} vencida${crm.tareas_vencidas > 1 ? "s" : ""} que requiere${crm.tareas_vencidas > 1 ? "n" : ""} seguimiento`
      );
      tone = "attention";
    } else if (crm.prospectos > 0 && crm.tareas_pendientes > 0) {
      parts.push(
        `Tienes ${crm.prospectos} prospecto${crm.prospectos > 1 ? "s" : ""} activo${crm.prospectos > 1 ? "s" : ""} y ${crm.tareas_pendientes} tarea${crm.tareas_pendientes > 1 ? "s" : ""} pendiente${crm.tareas_pendientes > 1 ? "s" : ""} en CRM`
      );
    }
  }

  const c = snapshot.comisiones;
  if (c && c.total_periodo_actual > 0) {
    if (c.variacion_porcentaje > 10) {
      parts.push(
        `Tus comisiones muestran un crecimiento de ${c.variacion_porcentaje.toFixed(0)}% respecto al periodo anterior`
      );
      tone = "positive";
    } else if (c.variacion_porcentaje < -10) {
      parts.push(
        `Tus comisiones bajaron ${Math.abs(c.variacion_porcentaje).toFixed(0)}% respecto al periodo anterior`
      );
    }
  }

  const web = snapshot.webLeads;
  if (web && web.leads_sin_seguimiento > 0) {
    parts.push(
      `Tienes ${web.leads_sin_seguimiento} lead${web.leads_sin_seguimiento > 1 ? "s" : ""} de tu pagina web sin seguimiento`
    );
  }

  if (parts.length === 0) {
    if (!parts.length) {
      parts.push(
        `${nombre}, aun no hay suficiente actividad consolidada para generar un analisis mas detallado, pero conforme se registren mas movimientos en tus modulos de MOVI, aqui veras observaciones y sugerencias personalizadas para ayudarte a dar mejor seguimiento a tu operacion comercial`
      );
    }
  }

  return { message: parts.join(". ") + ".", tone };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const snapshot: ModuleSnapshot = body.snapshot;
    const periodo: string = body.periodo || "";

    if (!snapshot || !snapshot.usuario) {
      throw new Error("Invalid request: missing snapshot");
    }

    if (!hasAnyData(snapshot) || !openaiApiKey) {
      const fallback = generateFallbackMessage(snapshot);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildChatGPTPrompt(snapshot, periodo);

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: prompt },
            {
              role: "user",
              content: `Genera el mensaje de analisis personalizado para el periodo ${periodo}. Solo responde con el JSON {"message": "...", "tone": "..."}, nada mas.`,
            },
          ],
          temperature: 0.5,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!openaiResponse.ok) {
      console.error(
        "OpenAI error:",
        openaiResponse.status,
        await openaiResponse.text()
      );
      const fallback = generateFallbackMessage(snapshot);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      const fallback = generateFallbackMessage(snapshot);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error(
        "Failed to parse ChatGPT JSON:",
        rawContent.substring(0, 300)
      );
      const fallback = generateFallbackMessage(snapshot);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message =
      typeof parsed.message === "string" && parsed.message.length > 0
        ? parsed.message.slice(0, 1000)
        : generateFallbackMessage(snapshot).message;

    const tone = ["positive", "neutral", "attention"].includes(parsed.tone)
      ? parsed.tone
      : "neutral";

    return new Response(
      JSON.stringify({
        success: true,
        analysis: { message, tone },
        source: "chatgpt",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
