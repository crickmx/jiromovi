import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QueryRequest {
  mensaje: string;
  conversacion_id?: string;
  modulo?: string;
  ruta?: string;
  parametros?: Record<string, any>;
  file_paths?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, email_laboral, rol, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: QueryRequest = await req.json();
    const { mensaje, conversacion_id, modulo, ruta, parametros, file_paths } = body;

    if (!mensaje || !mensaje.trim()) {
      return new Response(
        JSON.stringify({ error: "mensaje is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load Chava configuration
    const { data: configs } = await supabase
      .from("chava_configuracion")
      .select("clave, valor");

    const config: Record<string, any> = {};
    for (const c of configs || []) {
      config[c.clave] = typeof c.valor === "string" ? JSON.parse(c.valor) : c.valor;
    }

    const modeloIA = config.modelo_ia || "gpt-4o-mini";
    const temperatura = config.temperatura || 0.7;
    const maxTokens = config.max_tokens || 2500;
    const ragEnabled = config.rag_habilitado !== false;
    const similitudMinima = config.rag_similitud_minima || 0.72;
    const maxFragmentos = config.contexto_max_fragmentos || 5;
    const maxHistorial = config.max_historial_mensajes || 20;
    const systemPromptBase = config.system_prompt_base ||
      `Eres Chava, el copiloto inteligente oficial de MOVI Digital, Seguwallet y Grupo JIRO. Eres un experto consultor en seguros, fianzas, operacion de promotorias, administracion de agentes de seguros, marketing digital, automatizacion, CRM, produccion, comisiones, SICAS, tramites y procesos internos del ecosistema MOVI.

IDENTIDAD Y PERSONALIDAD:
- Eres un miembro activo del equipo MOVI, no un chatbot generico
- Tu tono es profesional, amigable, cercano, proactivo y directo
- Tratas al usuario por su nombre cuando es posible
- Usas lenguaje natural en espanol, evitando tecnicismos innecesarios
- Eres conciso pero completo: das respuestas utiles, no largas ni vacias

ORDEN DE PRIORIDAD PARA RESPONDER:
1. CONTEXTO ACTUAL: Si el usuario pego texto, adjunto archivos, o proporciono datos, analiza eso primero
2. DATOS DEL USUARIO: Usa el rol, oficina y perfil del usuario para personalizar la respuesta
3. BASE DE CONOCIMIENTO (RAG): Si hay fragmentos relevantes, usaelos como fuente principal
4. CONOCIMIENTO MOVI/JIRO: Procesos, modulos, catalogo de productos de seguros
5. CONOCIMIENTO GENERAL DE SEGUROS: Marco legal CNSF, coberturas, ramos, calculo de primas
6. HISTORIAL DE CONVERSACION: Mantiene continuidad y coherencia
7. CONOCIMIENTO GENERAL IA: Solo si no tienes informacion especifica

CAPACIDADES:
- Analizar documentos: resumen ejecutivo, puntos clave, comparativas, extraccion de datos
- Analizar imagenes: describir, extraer texto (OCR), identificar datos relevantes
- Generar entregables: propuestas comerciales, scripts de venta, resumenes de polizas, reportes
- Modo consultor: diagnosticar problemas operativos y sugerir soluciones concretas
- Modo proactivo: detectar oportunidades, alertas, acciones pendientes basadas en el contexto del usuario
- Automatizacion: guiar en uso de modulos MOVI, tramites, comisiones, CRM, produccion

MODULOS MOVI QUE CONOCES:
Dashboard, Mi Produccion (SICAS Live), Mis Polizas, Mis Comisiones, CRM, Tramites, Contactos, Centro de Contacto, Mi WhatsApp, Centro de Correos, Firmas de Email, Publicidad, Aula Virtual, Cedula A, Centro Digital, Notificaciones, Configuracion, Gamificacion, Registro de Actividades, GMM Cotizador, Formularios de Cotizacion, Pagina Web Publica, Espacio Jiro, Seguwallet

GENERACION DE CONTENIDO VISUAL:
Cuando generes propuestas, reportes o documentos, usa la identidad de marca del agente/oficina si esta disponible en el contexto del usuario. Usa colores corporativos de MOVI (azul #0891b2 como acento principal) cuando no haya marca especifica.

INSTRUCCIONES CLAVE:
- Cita las fuentes de la base de conocimiento cuando las uses
- Si no tienes suficiente informacion, dilo con honestidad y sugiere como obtenerla
- Sugiere siempre acciones y proximos pasos concretos
- Cuando detectes una oportunidad o alerta relevante para el usuario, mencionala proactivamente
- Para tramites o procesos MOVI, indica el modulo exacto donde realizarlos`;


    // === RAG: Search knowledge base ===
    let knowledgeContext = "";
    const fuentesUtilizadas: any[] = [];

    if (ragEnabled) {
      try {
        // Generate embedding for the query
        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: mensaje,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;

          // Search similar fragments
          const { data: fragments } = await supabase.rpc("buscar_conocimiento_chava", {
            query_embedding: JSON.stringify(queryEmbedding),
            similitud_minima: similitudMinima,
            max_resultados: maxFragmentos,
            usuario_rol: usuario.rol,
          });

          if (fragments && fragments.length > 0) {
            knowledgeContext = "\n\n=== INFORMACION DE LA BASE DE CONOCIMIENTO ===\n";
            for (const frag of fragments) {
              knowledgeContext += `\n[Fuente: ${frag.documento_titulo}${frag.carpeta_nombre ? ` / ${frag.carpeta_nombre}` : ""}]\n${frag.contenido}\n`;
              fuentesUtilizadas.push({
                documento_id: frag.documento_id,
                documento_titulo: frag.documento_titulo,
                carpeta: frag.carpeta_nombre,
                similitud: frag.similitud,
              });
            }
            knowledgeContext += "\n=== FIN DE INFORMACION ===\n";
          }
        }
      } catch (ragErr: any) {
        console.error("RAG search error:", ragErr.message);
      }
    }

    // === Build system prompt ===
    const systemPrompt = `${systemPromptBase}

INFORMACION DEL USUARIO:
- Nombre: ${usuario.nombre_completo || "Usuario"}
- Email: ${usuario.email_laboral || ""}
- Rol: ${usuario.rol}
- Modulo actual: ${modulo || "general"}
- Ruta: ${ruta || "/chava"}

INSTRUCCIONES IMPORTANTES:
- Si tienes informacion de la base de conocimiento relevante, usala como prioridad para responder.
- Cita las fuentes cuando uses informacion de la base de conocimiento.
- Si no tienes informacion suficiente en la base de conocimiento, responde con tu conocimiento general.
- Siempre responde en espanol.
- Se conciso pero completo.
- Sugiere acciones y proximos pasos cuando sea apropiado.
- Comportate como un miembro del equipo MOVI, no como un chatbot generico.
${knowledgeContext}`;

    // === Get or create conversation ===
    let convId = conversacion_id;
    if (!convId) {
      // Find recent conversation for this module
      const { data: recentConv } = await supabase
        .from("conversaciones_chatgpt")
        .select("id")
        .eq("usuario_id", user.id)
        .eq("es_asistente", true)
        .eq("modulo_origen", modulo || "chava")
        .gte("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentConv) {
        convId = recentConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversaciones_chatgpt")
          .insert({
            usuario_id: user.id,
            titulo: mensaje.substring(0, 60),
            es_asistente: true,
            modulo_origen: modulo || "chava",
          })
          .select("id")
          .single();
        convId = newConv?.id;
      }
    }

    if (!convId) {
      return new Response(
        JSON.stringify({ error: "Could not create conversation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save user message
    await supabase.from("mensajes_chatgpt").insert({
      conversacion_id: convId,
      rol: "user",
      contenido: mensaje,
    });

    // Load conversation history
    const { data: history } = await supabase
      .from("mensajes_chatgpt")
      .select("rol, contenido")
      .eq("conversacion_id", convId)
      .order("created_at", { ascending: true })
      .limit(maxHistorial);

    // Build messages for OpenAI
    const openaiMessages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of history || []) {
      if (msg.rol === "user" || msg.rol === "assistant") {
        openaiMessages.push({ role: msg.rol, content: msg.contenido });
      }
    }

    // Call OpenAI
    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modeloIA,
        messages: openaiMessages,
        temperature: temperatura,
        max_tokens: maxTokens,
      }),
    });

    if (!completionResponse.ok) {
      const errText = await completionResponse.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const completionData = await completionResponse.json();
    const assistantResponse = completionData.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";
    const tokensEntrada = completionData.usage?.prompt_tokens || 0;
    const tokensSalida = completionData.usage?.completion_tokens || 0;

    // Save assistant response
    const { data: savedMsg } = await supabase
      .from("mensajes_chatgpt")
      .insert({
        conversacion_id: convId,
        rol: "assistant",
        contenido: assistantResponse,
        tokens_usados: tokensEntrada + tokensSalida,
      })
      .select("id")
      .single();

    // Update conversation timestamp
    await supabase
      .from("conversaciones_chatgpt")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    // Log the query
    const tiempoRespuesta = Date.now() - startTime;
    await supabase.from("chava_consultas_log").insert({
      usuario_id: user.id,
      conversacion_id: convId,
      pregunta: mensaje,
      respuesta: assistantResponse,
      fuentes_utilizadas: fuentesUtilizadas,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      modelo: modeloIA,
      tiempo_respuesta_ms: tiempoRespuesta,
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversacion_id: convId,
        mensaje_id: savedMsg?.id || null,
        respuesta: assistantResponse,
        mensaje: assistantResponse,
        tokens_usados: tokensEntrada + tokensSalida,
        fuentes: fuentesUtilizadas,
        modo_usado: fuentesUtilizadas.length > 0 ? "rag" : "general",
        tiempo_respuesta_ms: tiempoRespuesta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Chava query error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
