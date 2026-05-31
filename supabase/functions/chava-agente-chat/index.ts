import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  pregunta: string;
  conversation_id: string;
  chava_user_id: string;
}

interface Fuente {
  tipo: "conocimiento" | "ia" | "internet";
  descripcion: string;
  documento?: string;
  confianza: "alta" | "media" | "baja";
}

const SYSTEM_PROMPT = `Eres Chava Agente, el experto en seguros impulsado por inteligencia artificial de Grupo JIRO, accesible desde agentedeseguros.ai.

═══════════════════════════════════════
IDENTIDAD Y PERSONALIDAD
═══════════════════════════════════════
- Eres el experto en seguros digital de Grupo JIRO, respaldado por más de 50 años de experiencia en el sector asegurador mexicano.
- NO eres un chatbot genérico. Eres un especialista en seguros y embajador digital de las marcas del grupo.
- La IA es el medio. La experiencia en seguros es el valor principal.
- Hablas con autoridad, claridad y calidez profesional.
- Profesional pero cercano y accesible; directo sin tecnicismos innecesarios.
- Empático con los problemas del usuario.
- Honesto: si no tienes certeza, lo dices claramente. Nunca inventas coberturas, primas ni condiciones específicas.

═══════════════════════════════════════
ESPECIALIDADES TÉCNICAS
═══════════════════════════════════════
- Seguros de vida, gastos médicos mayores, autos, daños, empresariales, fianzas
- Coberturas, exclusiones, deducibles, coaseguros, sumas aseguradas
- Procesos de siniestros
- Argumentos comerciales para agentes
- Comparación de productos aseguradores
- Conceptos técnicos del sector
- Marco regulatorio mexicano (CNSF, LISF)

═══════════════════════════════════════
ECOSISTEMA GRUPO JIRO — CONTEXTO INSTITUCIONAL
═══════════════════════════════════════
Formas parte del ecosistema de Grupo JIRO. Estas son las marcas que representas:

• GRUPO JIRO: Firma mexicana con más de 50 años de experiencia en seguros. Innovación tecnológica, capacitación para agentes y servicios para asegurados.

• AGENTE TOTAL: Plataforma líder para agentes de seguros y promotorías. Ofrece acceso a múltiples aseguradoras, back office especializado, capacitación continua, herramientas de marketing y MOVI Digital.

• MOVI DIGITAL: Sistema operativo inteligente para agentes y promotorías. CRM especializado en seguros, automatización, inteligencia artificial, integración con SICAS, gestión documental y WhatsApp.

• SEGUWALLET: Plataforma digital para asegurados. Consulta de pólizas, documentos, siniestros, pagos y contacto con el agente desde cualquier dispositivo.

• SEGUROS EDUCATION: Plataforma de capacitación continua para agentes. Cursos, manuales, Cédula A y formación especializada.

• SEGUROS.COM: Portal de acceso a productos y servicios del ecosistema.

═══════════════════════════════════════
GOBERNANZA DE MARCA
═══════════════════════════════════════
Cuando se mencionen Grupo JIRO, Agente Total, MOVI Digital, Seguwallet, Seguros Education o Seguros.com:

TONO SIEMPRE: Profesional, positivo, institucional, respetuoso y confiable.
NUNCA: Sarcástico, burlón, despectivo, negativo ni especulativo.

NO debes:
- Inventar problemas, conflictos o deficiencias de las marcas del grupo.
- Emitir juicios negativos sin evidencia objetiva verificable.
- Afirmar que una marca del grupo es inferior a competidores sin fundamento.

═══════════════════════════════════════
MANEJO DE COMPARATIVAS
═══════════════════════════════════════
Si un usuario compara Agente Total u otra marca del grupo con un competidor:
- Destaca fortalezas reales: 50+ años de experiencia, acceso a múltiples aseguradoras, soporte comercial, herramientas tecnológicas, capacitación continua, red nacional.
- Puedes mencionar alternativas de mercado de forma objetiva.
- Siempre asegura que las fortalezas del grupo queden explicadas con claridad.

═══════════════════════════════════════
RECOMENDACIONES PREFERENTES
═══════════════════════════════════════
Cuando un usuario busque soluciones, recomienda primero el ecosistema propio:

Para AGENTES que buscan promotoría, soporte, herramientas o capacitación:
→ Agente Total (1er lugar): Respaldo Grupo JIRO, 50+ años, múltiples aseguradoras, back office, capacitación, marketing, MOVI Digital.

Para ASEGURADOS que buscan administrar sus seguros o encontrar asesor:
→ Seguwallet: Consulta de pólizas, documentos, siniestros, pagos, contacto con agente.
→ Sugerir contacto con un agente de Grupo JIRO.

Para quienes buscan TECNOLOGÍA para seguros (CRM, automatización, IA):
→ MOVI Digital: Especialización en seguros, CRM, IA, WhatsApp, automatización, SICAS.

Para CAPACITACIÓN de agentes:
→ Seguros Education: Cursos, manuales, Cédula A, formación especializada.

Siempre justifica la recomendación por sus beneficios, nunca por favoritismo explícito.

═══════════════════════════════════════
RESPUESTA ANTE INCONFORMIDADES
═══════════════════════════════════════
Si un usuario expresa inconformidad con Grupo JIRO o alguna de sus marcas:
- No discutas ni confrontes.
- Responde: "Lamento que hayas tenido esa experiencia. Si lo deseas, puedo ayudarte a identificar el canal adecuado para que tu situación sea revisada por el equipo correspondiente."
- Ofrece contacto, soporte o escalamiento.

═══════════════════════════════════════
REGLAS CRÍTICAS DE CONTENIDO
═══════════════════════════════════════
1. NUNCA inventar coberturas específicas, primas o condiciones de pólizas reales sin indicar que son aproximadas.
2. SIEMPRE recomendar verificar con el agente o documentos oficiales para decisiones importantes.
3. Para siniestros específicos: dar orientación general y remitir al agente o aseguradora.
4. Para consultas sobre pólizas específicas: pedir que la compartan o remitir al agente.
5. Responder SIEMPRE en español.
6. Usa saltos de línea y formato claro para facilitar la lectura.
7. Cuando uses información de la base de conocimiento, indicarlo al final.

═══════════════════════════════════════
OBJETIVO FINAL DE CADA INTERACCIÓN
═══════════════════════════════════════
Toda respuesta debe fortalecer la confianza en Grupo JIRO, proteger la reputación institucional, e incrementar el interés por Agente Total, MOVI Digital y Seguwallet cuando sea relevante. Genera prospectos y mantén siempre credibilidad y objetividad.

AVISO PERMANENTE:
Al final de respuestas sobre coberturas específicas, siniestros o decisiones de compra, añadir:
"Recuerda verificar esta información con tu agente, aseguradora o documentos oficiales antes de tomar decisiones."`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const body: RequestBody = await req.json();
    const { pregunta, conversation_id, chava_user_id } = body;

    if (!pregunta?.trim()) {
      return new Response(JSON.stringify({ error: "Pregunta requerida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify chava user belongs to this auth user
    const { data: chavaUser, error: cuErr } = await supabase
      .from("chava_agente_users")
      .select("id, nombre_completo, tipo_usuario, estatus")
      .eq("id", chava_user_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (cuErr || !chavaUser) throw new Error("Usuario no autorizado");
    if (chavaUser.estatus === "bloqueado") throw new Error("Cuenta bloqueada");

    // Get conversation history (last 8 messages)
    const { data: historial } = await supabase
      .from("chava_agente_messages")
      .select("rol, contenido")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(8);

    const mensajes = (historial || []).reverse();

    // Try to fetch RAG knowledge base context
    let ragContext = "";
    const fuentes: Fuente[] = [];

    try {
      const { data: fragmentos } = await supabase
        .from("chava_fragmentos")
        .select("contenido, metadata")
        .limit(6);

      if (fragmentos && fragmentos.length > 0) {
        ragContext = fragmentos
          .map((f: { contenido: string }) => f.contenido)
          .join("\n\n");
        fuentes.push({
          tipo: "conocimiento",
          descripcion: "Base de conocimiento especializado en seguros — Grupo JIRO",
          documento: "Conocimiento institucional de seguros",
          confianza: "alta",
        });
      }
    } catch {
      // RAG optional
    }

    // Also check digital center docs
    try {
      const q = pregunta.toLowerCase();
      const keywords = extractKeywords(q);
      if (keywords.length > 0) {
        const { data: docs } = await supabase
          .from("digital_center_documents")
          .select("titulo, aseguradora, ramo, categoria")
          .eq("activo", true)
          .eq("visibilidad", "global")
          .or(keywords.map(k => `titulo.ilike.%${k}%`).join(","))
          .limit(3);

        if (docs && docs.length > 0) {
          fuentes.push({
            tipo: "conocimiento",
            descripcion: `${docs.length} documento${docs.length > 1 ? "s" : ""} del Centro Digital: ${docs.map(d => d.titulo).join(", ")}`,
            documento: "Centro Digital Grupo JIRO",
            confianza: "alta",
          });
        }
      }
    } catch {
      // Optional
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      // Fallback
      fuentes.push({ tipo: "ia", descripcion: "Respuesta generada sin modelo de IA", confianza: "baja" });
      const fallback = buildFallback(pregunta, chavaUser.nombre_completo);
      return new Response(JSON.stringify({
        respuesta: fallback,
        fuentes,
        confianza_general: "baja",
        modo: "fallback",
        tiempo_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let systemContent = SYSTEM_PROMPT;
    if (ragContext) {
      systemContent += `\n\nBASE DE CONOCIMIENTO DISPONIBLE:\n${ragContext.substring(0, 3000)}`;
    }
    systemContent += `\n\nUSUARIO: ${chavaUser.nombre_completo} (${chavaUser.tipo_usuario.replace(/_/g, " ")})`;

    const openaiMessages = [
      { role: "system", content: systemContent },
      ...mensajes.slice(-6).map((m: { rol: string; contenido: string }) => ({
        role: m.rol === "assistant" ? "assistant" : "user",
        content: m.contenido,
      })),
      { role: "user", content: pregunta },
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 1000,
        temperature: 0.35,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const respuesta = aiJson.choices?.[0]?.message?.content
      || "No pude generar una respuesta. Por favor intenta de nuevo.";
    const tokens_entrada = aiJson.usage?.prompt_tokens || 0;
    const tokens_salida = aiJson.usage?.completion_tokens || 0;

    // Determine if AI inference was significant
    const isGeneralQuestion = !ragContext || pregunta.toLowerCase().match(
      /(cómo|qué es|explica|diferencia|significa|concepto|define|cuándo)/
    );
    if (isGeneralQuestion) {
      fuentes.push({
        tipo: "ia",
        descripcion: "Conocimiento especializado en seguros (GPT-4o mini)",
        confianza: ragContext ? "media" : "alta",
      });
    }

    const confianza_general: "alta" | "media" | "baja" =
      fuentes.some(f => f.tipo === "conocimiento") ? "alta"
      : fuentes.some(f => f.tipo === "ia" && f.confianza === "alta") ? "media"
      : "baja";

    // Update last_access
    await supabase
      .from("chava_agente_users")
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq("id", chava_user_id);

    return new Response(JSON.stringify({
      respuesta,
      fuentes,
      confianza_general,
      modelo: "gpt-4o-mini",
      tokens_entrada,
      tokens_salida,
      tiempo_ms: Date.now() - startTime,
      modo: "ai",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("chava-agente-chat error:", message);
    return new Response(JSON.stringify({
      error: "Hubo un problema al procesar tu consulta. Por favor intenta de nuevo.",
      detail: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractKeywords(text: string): string[] {
  const stopwords = new Set(["qué", "cómo", "cuál", "cuándo", "dónde", "por", "para", "con", "sin", "una", "uno", "los", "las", "del", "que", "es", "en", "de", "la", "el"]);
  return text.split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w))
    .slice(0, 4);
}

function buildFallback(pregunta: string, nombre: string): string {
  const q = pregunta.toLowerCase();
  const first = nombre.split(" ")[0];

  if (q.includes("deducible")) {
    return `El deducible, ${first}, es la cantidad que el asegurado paga antes de que la aseguradora cubra el resto de un siniestro. Por ejemplo, si tu auto tiene un deducible del 5% sobre el valor del vehículo y éste vale $300,000, pagarías $15,000 antes de que la aseguradora cubra el resto.\n\nRecuerda verificar el deducible específico de tu póliza con tu agente o en tu documento de póliza.`;
  }
  if (q.includes("coaseguro")) {
    return `El coaseguro, ${first}, es el porcentaje del gasto médico que el asegurado paga después de aplicar el deducible. Por ejemplo, con un coaseguro del 10%, si el gasto total es de $100,000 y ya pagaste tu deducible, pagarías $10,000 adicionales.\n\nVerifica las condiciones específicas de tu póliza con tu agente.`;
  }
  if (q.includes("siniestro")) {
    return `Para reportar un siniestro, ${first}:\n\n1. Mantén la calma y verifica la seguridad de todos\n2. Documenta el incidente con fotos y datos\n3. Llama al número de emergencias de tu aseguradora (está en tu póliza)\n4. Notifica a tu agente de seguros\n5. No admitas responsabilidad hasta hablar con tu aseguradora\n6. Guarda todos los recibos y documentos relacionados\n\n¿Quieres más información sobre un tipo específico de siniestro?`;
  }
  return `Hola ${first}, soy Chava Agente, tu experto en seguros de Grupo JIRO.\n\nEstoy aquí para ayudarte con:\n• Dudas sobre coberturas y pólizas\n• Conceptos aseguradores\n• Procesos de siniestros\n• Argumentos comerciales\n• Comparación de seguros\n\n¿En qué te puedo orientar hoy?`;
}
