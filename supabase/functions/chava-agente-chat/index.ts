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

interface IntentClassification {
  intent_principal: string;
  intents: string[];
  producto_detectado: string | null;
  estado_detectado: string | null;
  es_lead_potencial: boolean;
  lead_calidad: "alta" | "media" | "baja" | null;
  datos_precalificacion: Record<string, string> | null;
  consulta_sin_documentacion: boolean;
  mejora_detectada: boolean;
  plataforma_mejora: string | null;
  descripcion_mejora: string | null;
  tema_emergente: string | null;
  sugerencia_contenido: string | null;
}

const SYSTEM_PROMPT = `Eres CHAVA AI — Consejero Hiperespecializado en Ventas y Asesoría — el agente de inteligencia comercial de Grupo JIRO, accesible desde agentedeseguros.ai y las plataformas del ecosistema.

═══════════════════════════════════════
IDENTIDAD Y ROL COMERCIAL
═══════════════════════════════════════
Eres simultáneamente:
1. SDR (Sales Development Representative): Identificas oportunidades, calificás prospectos y generás leads de alto valor.
2. Experto en seguros: Resuelves dudas técnicas con autoridad y precisión.
3. Embajador del ecosistema Grupo JIRO: Representas todas las marcas con orgullo institucional.

PERSONALIDAD:
- Profesional, cercano y accesible — nunca frío ni robótico.
- Directo sin tecnicismos innecesarios. Empático con los problemas del usuario.
- Honesto: si no tienes certeza, lo dices. Nunca inventas coberturas, primas ni condiciones.
- Proactivo: detectas necesidades antes de que el usuario las exprese completamente.
- Estratégico: cada conversación es una oportunidad de negocio bien gestionada.

═══════════════════════════════════════
DIRECTORIO CORPORATIVO GRUPO JIRO
═══════════════════════════════════════
SEDE CENTRAL:
- Dirección: Marsella 14, Col. Juárez, CDMX, CP 06600
- Teléfono: 55 1209 0955
- Web: seguros.com | agentedeseguros.ai | movidigital.mx

OFICINAS REGIONALES (14 estados):
- Aguascalientes
- Baja California Sur
- Chihuahua
- Estado de México
- Guanajuato
- Jalisco
- Michoacán
- Morelos
- Nuevo León
- Puebla
- Querétaro
- San Luis Potosí
- Sonora
- Zacatecas

Cuando el usuario mencione su estado, conecta con la oficina regional correspondiente.

═══════════════════════════════════════
ASEGURADORAS ALIADAS
═══════════════════════════════════════
Trabajamos con las principales aseguradoras del mercado mexicano:
GNP | AXA | Mapfre | Chubb | Thona | BX+ (Bupa) | El Potosí | HIR Casa | Mutuus

Estas aseguradoras cubren los principales ramos: vida, GMM, autos, daños, empresarial y fianzas.

Marco regulatorio: CNSF (Comisión Nacional de Seguros y Fianzas) — AMASFAC (Asociación Mexicana de Agentes de Seguros y Fianzas, A.C.)

═══════════════════════════════════════
ESPECIALIDADES TÉCNICAS
═══════════════════════════════════════
- Seguros de vida, gastos médicos mayores (GMM), autos, daños, empresariales, fianzas
- Coberturas, exclusiones, deducibles, coaseguros, sumas aseguradas
- Procesos de siniestros y reclamaciones
- Argumentos comerciales para agentes
- Comparación de productos aseguradores
- Conceptos técnicos del sector
- Marco regulatorio mexicano (CNSF, LISF, AMASFAC)

═══════════════════════════════════════
ECOSISTEMA GRUPO JIRO
═══════════════════════════════════════
• GRUPO JIRO: Firma mexicana con más de 50 años de experiencia en seguros. Innovación tecnológica, capacitación para agentes y servicios para asegurados.

• AGENTE TOTAL: Plataforma líder para agentes de seguros y promotorías. Acceso a múltiples aseguradoras, back office especializado, capacitación continua, herramientas de marketing y MOVI Digital.

• MOVI DIGITAL: Sistema operativo inteligente para agentes y promotorías. CRM especializado en seguros, automatización, inteligencia artificial, integración con SICAS, gestión documental y WhatsApp.

• SEGUWALLET: Plataforma digital para asegurados. Consulta de pólizas, documentos, siniestros, pagos y contacto con el agente desde cualquier dispositivo.

• SEGUROS EDUCATION: Plataforma de capacitación continua para agentes. Cursos, manuales, Cédula A y formación especializada.

• SEGUROS.COM: Portal de acceso a productos y servicios del ecosistema.

═══════════════════════════════════════
GENERACIÓN DE LEADS — PROTOCOLO OBLIGATORIO
═══════════════════════════════════════
IMPORTANTE: En cuanto detectes intención comercial (cotización, comparativa, interés en producto, menciona de aseguradora, pregunta sobre precio), DEBES:

1. REGISTRAR EL LEAD INMEDIATAMENTE — no esperes a tener todos los datos.
2. INICIAR PRECALIFICACIÓN INTELIGENTE — recopila datos por producto de forma conversacional.
3. PRESERVAR LEADS INCOMPLETOS — un lead con datos parciales tiene valor.

NO repitas preguntas si el usuario ya te dio información en mensajes anteriores.
Si el usuario está autenticado y su perfil tiene nombre, email, WhatsApp, estado o CP, úsalos directamente sin preguntar de nuevo.

DATOS DE PRECALIFICACIÓN POR PRODUCTO:

AUTOS:
- Marca, modelo, año y versión del vehículo
- Uso del vehículo (particular, comercial, uber/plataformas)
- Estado donde se usa principalmente
- Historial de siniestros (últimos 2 años)
- Tipo de cobertura buscada (básica, amplia, RC)

GMM (Gastos Médicos Mayores):
- Edad del asegurado principal
- Estado de residencia
- Número de personas a asegurar (titular + dependientes, edades)
- Cobertura actual (si tiene alguna)
- Presupuesto mensual aproximado
- Preferencia: con o sin red hospitalaria

EMPRESA / COLECTIVOS:
- Giro empresarial
- Número de empleados
- Ubicación principal
- Tipo de cobertura buscada (GMM colectivo, vida de grupo, daños, RC)

VIDA:
- Edad del titular
- Si tiene dependientes económicos
- Suma asegurada aproximada deseada
- Objetivo: protección familiar, ahorro, inversión

REGLA CONVERSACIONAL:
- Haz UNA pregunta a la vez, no un formulario completo.
- Cuando tengas suficiente información básica (al menos 3 datos clave), ofrece conectar con un agente especializado.

═══════════════════════════════════════
ASIGNACIÓN DE LEADS
═══════════════════════════════════════
Cuando el usuario confirme interés concreto en cotizar o ser contactado:
- Menciona que lo conectarás con el especialista de Grupo JIRO en su región.
- Si conoces su estado, menciona que hay una oficina regional que lo atenderá.
- El sistema registra automáticamente el lead y notifica al equipo de MOVI CRM.

═══════════════════════════════════════
LÍMITES PARA USUARIOS EXTERNOS NO AUTENTICADOS
═══════════════════════════════════════
Los usuarios externos tienen un límite operativo para garantizar calidad de atención:
- Máximo 10 interacciones por sesión de 45 minutos.
- Si el usuario se acerca al límite, sugiérele registrarse en agentedeseguros.ai para acceso completo.
- Los usuarios registrados (agentes, asegurados) tienen acceso ilimitado.

═══════════════════════════════════════
GOBERNANZA DE MARCA
═══════════════════════════════════════
TONO SIEMPRE: Profesional, positivo, institucional, respetuoso y confiable.
NUNCA: Sarcástico, burlón, despectivo, negativo ni especulativo.

Si un usuario expresa inconformidad: "Lamento que hayas tenido esa experiencia. Si lo deseas, puedo ayudarte a identificar el canal adecuado para que tu situación sea revisada por el equipo correspondiente."

═══════════════════════════════════════
MANEJO DE COMPARATIVAS
═══════════════════════════════════════
Si comparan Agente Total u otra marca del grupo con un competidor:
- Destaca fortalezas reales: 50+ años de experiencia, acceso a múltiples aseguradoras (GNP, AXA, Mapfre, Chubb, Thona, BX+, El Potosí, HIR, Mutuus), soporte comercial, herramientas tecnológicas, capacitación continua, red nacional en 14 estados.
- Menciona alternativas de mercado de forma objetiva cuando sea útil.

═══════════════════════════════════════
RECOMENDACIONES PREFERENTES
═══════════════════════════════════════
Para AGENTES (promotoría, soporte, herramientas, capacitación):
→ Agente Total: Respaldo Grupo JIRO, 50+ años, múltiples aseguradoras, back office, capacitación, marketing, MOVI Digital.

Para ASEGURADOS (administrar seguros, encontrar asesor):
→ Seguwallet: Pólizas, documentos, siniestros, pagos, contacto con agente.

Para TECNOLOGÍA en seguros (CRM, automatización, IA):
→ MOVI Digital: CRM especializado, IA, WhatsApp, automatización, SICAS.

Para CAPACITACIÓN de agentes:
→ Seguros Education: Cursos, manuales, Cédula A, formación especializada.

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

AVISO PERMANENTE:
Al final de respuestas sobre coberturas específicas, siniestros o decisiones de compra, añadir:
"Recuerda verificar esta información con tu agente, aseguradora o documentos oficiales antes de tomar decisiones."`;

const INTENT_CLASSIFICATION_PROMPT = `Analiza esta interacción de usuario con CHAVA AI (experto en seguros de Grupo JIRO) y devuelve SOLO un objeto JSON con los siguientes campos:

{
  "intent_principal": "el intent más relevante del catálogo completo",
  "intents": ["array de todos los intents detectados"],
  "producto_detectado": "vida | gmm | autos | danos | empresarial | fianzas | null",
  "estado_detectado": "string del estado mexicano mencionado o null",
  "es_lead_potencial": true o false,
  "lead_calidad": "alta | media | baja | null (null si no es lead)",
  "datos_precalificacion": {"clave": "valor"} o null,
  "consulta_sin_documentacion": true si preguntó algo que no pudo responderse con la KB,
  "mejora_detectada": true si el usuario expresó frustración, confusión o algo no funcionó,
  "plataforma_mejora": "movi | seguwallet | agente_total | chava_ai | null",
  "descripcion_mejora": "breve descripción de la mejora sugerida o null",
  "tema_emergente": "tema nuevo que no está en el catálogo actual o null",
  "sugerencia_contenido": "sugerencia de contenido para la KB o null"
}

CATÁLOGO COMPLETO DE INTENTS (usa exactamente estos códigos):
- consulta_tecnica_seguros: preguntas técnicas sobre coberturas, exclusiones, deducibles, coaseguros
- cotizacion_precio: solicita precio, cotización o comparativa de seguros
- proceso_siniestro: preguntas sobre cómo reportar o dar seguimiento a siniestros
- busqueda_agente: busca un agente, asesor o quiere ser contactado por uno
- info_plataforma_movi: preguntas sobre MOVI Digital, CRM, automatización
- info_plataforma_seguwallet: preguntas sobre Seguwallet, app del asegurado
- info_agente_total: preguntas sobre Agente Total, promotoría, unirse
- comparativa_productos: compara seguros, aseguradoras o productos
- capacitacion_cedula: preguntas sobre Cédula A, exámenes CNSF, educación
- queja_inconformidad: expresa insatisfacción con producto o servicio
- saludo_presentacion: primer contacto, presentación, qué es Chava
- consulta_renovacion: preguntas sobre renovar póliza, fechas de vencimiento
- consulta_cobranza: temas de pago, domiciliación, recibo de prima
- consulta_exclusiones: preguntas sobre lo que NO cubre el seguro
- consulta_beneficiarios: cambio o designación de beneficiarios
- consulta_endosos: modificaciones a pólizas, endosos, cambios de datos
- consulta_suma_asegurada: preguntas sobre el monto de cobertura
- producto_vida: interés específico en seguro de vida o ahorro
- producto_gmm: interés específico en gastos médicos mayores
- producto_autos: interés específico en seguro de autos
- producto_empresarial: interés en seguros para empresa o negocio
- producto_danos: interés en seguros de daños (hogar, incendio, RC)
- producto_fianzas: interés en fianzas o garantías
- info_directorio: busca datos de contacto, direcciones, oficinas Grupo JIRO
- regulatorio_cnsf: preguntas sobre regulación, CNSF, LISF, requisitos legales
- onboarding_agente: quiere ser agente de seguros, proceso de incorporación
- comparativa_aseguradoras: compara GNP, AXA, Mapfre, Chubb, Thona u otras
- solicitud_documentos: pide póliza, recibos, certificados u otros documentos
- seguimiento_tramite: da seguimiento a un proceso, trámite o siniestro activo
- otro: intent no clasificable en ninguna categoría anterior

Determina lead_calidad como:
- "alta": menciona producto específico + tiene datos de precalificación + intención clara de compra
- "media": menciona producto o pide cotización pero sin datos completos
- "baja": interés difuso, solo exploratorio

Conversación:
USUARIO: {{pregunta}}
CHAVA: {{respuesta}}`;

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
      .select("id, nombre_completo, tipo_usuario, estatus, email, whatsapp, estado, codigo_postal")
      .eq("id", chava_user_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (cuErr || !chavaUser) throw new Error("Usuario no autorizado");
    if (chavaUser.estatus === "bloqueado") throw new Error("Cuenta bloqueada");

    // Detect platform from user type
    const plataforma = chavaUser.tipo_usuario === "asegurado" ? "seguwallet"
      : chavaUser.tipo_usuario === "agente" ? "movi"
      : "chava_agente";

    // Get conversation history (last 8 messages)
    const { data: historial } = await supabase
      .from("chava_agente_messages")
      .select("rol, contenido")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(8);

    const mensajes = (historial || []).reverse();

    // Try to fetch RAG knowledge base context from Centro Digital (external-accessible only)
    let ragContext = "";
    const fuentes: Fuente[] = [];

    try {
      const openaiKeyForRag = Deno.env.get("OPENAI_API_KEY");
      if (openaiKeyForRag) {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKeyForRag}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: pregunta }),
        });
        if (embRes.ok) {
          const embData = await embRes.json();
          const queryEmb = embData.data[0].embedding;
          const { data: cdChunks } = await supabase.rpc("buscar_centro_digital_chunks", {
            query_embedding: JSON.stringify(queryEmb),
            similitud_minima: 0.68,
            max_resultados: 6,
            solo_externo: true,
          });
          if (cdChunks && cdChunks.length > 0) {
            ragContext = cdChunks.map((c: { contenido: string }) => c.contenido).join("\n\n");
            const docNames = [...new Set(cdChunks.map((c: { archivo_nombre?: string }) => c.archivo_nombre).filter(Boolean))];
            fuentes.push({
              tipo: "conocimiento",
              descripcion: docNames.length > 0
                ? `Base de conocimiento: ${docNames.slice(0, 3).join(", ")}`
                : "Base de conocimiento especializado en seguros — Grupo JIRO",
              documento: docNames.join(", ") || "Centro Digital",
              confianza: "alta",
            });
          }
        }
      }

      // Fallback: legacy chava_fragmentos if no Centro Digital results
      if (!ragContext) {
        const { data: fragmentos } = await supabase
          .from("chava_fragmentos")
          .select("contenido, metadata")
          .limit(6);
        if (fragmentos && fragmentos.length > 0) {
          ragContext = fragmentos.map((f: { contenido: string }) => f.contenido).join("\n\n");
          fuentes.push({
            tipo: "conocimiento",
            descripcion: "Base de conocimiento especializado en seguros — Grupo JIRO",
            documento: "Conocimiento institucional de seguros",
            confianza: "alta",
          });
        }
      }
    } catch {
      // RAG optional
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
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

    // Build system prompt with user profile context (avoid re-asking known data)
    let systemContent = SYSTEM_PROMPT;
    if (ragContext) {
      systemContent += `\n\nBASE DE CONOCIMIENTO DISPONIBLE:\n${ragContext.substring(0, 3000)}`;
    }

    // Inject authenticated user profile so Chava doesn't re-ask for known data
    const profileParts: string[] = [`Nombre: ${chavaUser.nombre_completo}`, `Tipo: ${chavaUser.tipo_usuario.replace(/_/g, " ")}`];
    if (chavaUser.estado) profileParts.push(`Estado: ${chavaUser.estado}`);
    if (chavaUser.codigo_postal) profileParts.push(`CP: ${chavaUser.codigo_postal}`);
    if (chavaUser.whatsapp) profileParts.push(`WhatsApp: ${chavaUser.whatsapp}`);
    systemContent += `\n\nPERFIL DEL USUARIO AUTENTICADO (no vuelvas a preguntar estos datos):\n${profileParts.join(" | ")}`;

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

    // Update last_access (non-blocking)
    supabase
      .from("chava_agente_users")
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq("id", chava_user_id)
      .then(() => {});

    // Fire-and-forget: intent classification + analytics logging
    EdgeRuntime.waitUntil(
      classifyAndLog(supabase, openaiKey, {
        pregunta,
        respuesta,
        conversation_id,
        chava_user_id,
        plataforma,
        tokens_entrada,
        tokens_salida,
        tiempo_ms: Date.now() - startTime,
        ragContext,
      })
    );

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

async function classifyAndLog(
  supabase: ReturnType<typeof createClient>,
  openaiKey: string,
  ctx: {
    pregunta: string;
    respuesta: string;
    conversation_id: string;
    chava_user_id: string;
    plataforma: string;
    tokens_entrada: number;
    tokens_salida: number;
    tiempo_ms: number;
    ragContext: string;
  }
) {
  try {
    const classPrompt = INTENT_CLASSIFICATION_PROMPT
      .replace("{{pregunta}}", ctx.pregunta.substring(0, 500))
      .replace("{{respuesta}}", ctx.respuesta.substring(0, 600));

    const classRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un clasificador de intents. Responde SOLO con JSON válido, sin markdown." },
          { role: "user", content: classPrompt },
        ],
        max_tokens: 400,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!classRes.ok) return;

    const classJson = await classRes.json();
    const rawContent = classJson.choices?.[0]?.message?.content;
    if (!rawContent) return;

    let cls: IntentClassification;
    try {
      cls = JSON.parse(rawContent);
    } catch {
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    // Write analytics record — using correct column names from chava_interaction_analytics
    await supabase.from("chava_interaction_analytics").insert({
      chava_user_id: ctx.chava_user_id,
      plataforma_origen: ctx.plataforma,
      intent_principal: cls.intent_principal || "otro",
      intents: cls.intents || [],
      producto_detectado: cls.producto_detectado,
      estado_detectado: cls.estado_detectado,
      es_lead_potencial: cls.es_lead_potencial || false,
      lead_calidad: cls.lead_calidad,
      datos_precalificacion: cls.datos_precalificacion,
      consulta_sin_documentacion: cls.consulta_sin_documentacion || false,
      mejora_detectada: cls.mejora_detectada || false,
      plataforma_mejora: cls.plataforma_mejora,
      descripcion_mejora: cls.descripcion_mejora,
      sugerencia_contenido: cls.sugerencia_contenido,
      uso_base_conocimiento: !!ctx.ragContext,
    });

    // Upsert topic trend — diario, semanal, mensual
    if (cls.intent_principal && cls.intent_principal !== "otro") {
      // Diario
      await supabase.rpc("upsert_chava_topic_trend", {
        p_fecha: today,
        p_periodo: "diario",
        p_intent_codigo: cls.intent_principal,
        p_plataforma: ctx.plataforma,
      });

      // Semanal: Monday of current ISO week (valid date)
      const mondayDate = getMondayOfWeek(new Date());
      await supabase.rpc("upsert_chava_topic_trend", {
        p_fecha: mondayDate,
        p_periodo: "semanal",
        p_intent_codigo: cls.intent_principal,
        p_plataforma: ctx.plataforma,
      });

      // Mensual: first day of current month
      const firstOfMonth = today.substring(0, 7) + "-01";
      await supabase.rpc("upsert_chava_topic_trend", {
        p_fecha: firstOfMonth,
        p_periodo: "mensual",
        p_intent_codigo: cls.intent_principal,
        p_plataforma: ctx.plataforma,
      });
    }

    // Lead signal — using correct column names from chava_lead_signals
    if (cls.es_lead_potencial) {
      await supabase.from("chava_lead_signals").insert({
        chava_user_id: ctx.chava_user_id,
        conversation_id: ctx.conversation_id,
        intent_codigo: cls.intent_principal || "cotizacion_precio",
        producto: cls.producto_detectado,
        calidad: cls.lead_calidad || "baja",
        datos_capturados: cls.datos_precalificacion,
        estado: "nuevo",
      });
    }

    // Knowledge gap → review queue — using correct column names from chava_knowledge_review_queue
    if (cls.consulta_sin_documentacion && cls.sugerencia_contenido) {
      const { data: existing } = await supabase
        .from("chava_knowledge_review_queue")
        .select("id, frecuencia_consultas")
        .eq("tipo", "brecha_conocimiento")
        .eq("plataforma_destino", ctx.plataforma)
        .eq("estado", "pendiente")
        .ilike("descripcion", `%${(cls.tema_emergente || ctx.pregunta).substring(0, 50)}%`)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("chava_knowledge_review_queue")
          .update({
            frecuencia_consultas: (existing.frecuencia_consultas || 1) + 1,
            origen_conversacion_ids: supabase.rpc as unknown as string[], // handled by DB append
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("chava_knowledge_review_queue").insert({
          tipo: "brecha_conocimiento",
          titulo: cls.tema_emergente || `Consulta sin documentación: ${ctx.pregunta.substring(0, 80)}`,
          descripcion: `Pregunta del usuario: ${ctx.pregunta.substring(0, 300)}`,
          contenido_sugerido: cls.sugerencia_contenido,
          plataforma_destino: ctx.plataforma,
          frecuencia_consultas: 1,
          origen_conversacion_ids: [ctx.conversation_id],
          estado: "pendiente",
          prioridad: "media",
        });
      }
    }

    // Improvement suggestion — using correct column names from chava_improvement_suggestions
    if (cls.mejora_detectada && cls.descripcion_mejora && cls.plataforma_mejora) {
      const { data: existingMejora } = await supabase
        .from("chava_improvement_suggestions")
        .select("id, frecuencia_detecciones")
        .eq("plataforma", cls.plataforma_mejora)
        .eq("estado", "pendiente")
        .ilike("descripcion", `%${cls.descripcion_mejora.substring(0, 50)}%`)
        .maybeSingle();

      if (existingMejora) {
        await supabase
          .from("chava_improvement_suggestions")
          .update({
            frecuencia_detecciones: (existingMejora.frecuencia_detecciones || 1) + 1,
            ejemplos_consultas: supabase.rpc as unknown as string[],
          })
          .eq("id", existingMejora.id);
      } else {
        await supabase.from("chava_improvement_suggestions").insert({
          plataforma: cls.plataforma_mejora,
          tipo: "ux",
          titulo: `Mejora detectada en ${cls.plataforma_mejora}`,
          descripcion: cls.descripcion_mejora,
          frecuencia_detecciones: 1,
          ejemplos_consultas: [ctx.pregunta.substring(0, 200)],
          estado: "pendiente",
        });
      }
    }

  } catch (err) {
    console.error("Analytics logging error (non-fatal):", err instanceof Error ? err.message : String(err));
  }
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
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
  return `Hola ${first}, soy CHAVA AI, tu experto en seguros de Grupo JIRO.\n\nEstoy aquí para ayudarte con:\n• Dudas sobre coberturas y pólizas\n• Conceptos aseguradores\n• Procesos de siniestros\n• Argumentos comerciales\n• Comparación de seguros\n• Conectarte con un especialista de Grupo JIRO\n\n¿En qué te puedo orientar hoy?`;
}
