import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  pregunta: string;
  conversacion_id: string;
  customer_id: string;
  poliza_contexto?: string | null;
  context_extra?: Record<string, unknown> | null;
}

interface Fuente {
  tipo: "seguwallet" | "sicas" | "movi" | "conocimiento" | "internet" | "ia";
  descripcion: string;
  modulo?: string;
  documento?: string;
  url?: string;
  fecha_actualizacion?: string;
  confianza: "alta" | "media" | "baja";
}

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
    const { pregunta, conversacion_id, customer_id, poliza_contexto, context_extra } = body;

    if (!pregunta?.trim()) {
      return new Response(JSON.stringify({ error: "Pregunta requerida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify customer belongs to this auth user
    const { data: customer, error: custError } = await supabase
      .from("seguwallet_customers")
      .select("id, full_name, email, phone, whatsapp, agent_user_id")
      .eq("id", customer_id)
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (custError || !customer) throw new Error("Cliente no autorizado");

    // Track which sources we actually loaded
    const fuentes: Fuente[] = [];
    const now = new Date();
    const nowIso = now.toISOString();
    const nowStr = now.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    // Gather customer context in parallel
    const [polizasRes, cobranzaRes, docsRes, agentRes, sicasRes] = await Promise.all([
      supabase.from("seguwallet_external_policies")
        .select("insurer_name,ramo,policy_number,status,start_date,end_date,total_premium,currency,payment_frequency,insured_name,beneficiaries")
        .eq("seguwallet_customer_id", customer_id)
        .is("deleted_at", null)
        .order("end_date", { ascending: true }),

      customer.agent_user_id
        ? supabase.from("sicas_cobranza_pendiente")
            .select("no_poliza,importe_pendiente,fecha_limite,dias_vencidos,status")
            .eq("usuario_id", customer.agent_user_id)
            .order("fecha_limite", { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [] }),

      supabase.from("seguwallet_customer_documents")
        .select("nombre_archivo,tipo_documento,descripcion")
        .eq("seguwallet_customer_id", customer_id)
        .limit(20),

      customer.agent_user_id
        ? supabase.from("usuarios")
            .select("nombre,apellidos,celular_laboral,celular_personal,email_laboral,url_web_jiro,oficina_id,imagen_perfil_url")
            .eq("id", customer.agent_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),

      customer.agent_user_id
        ? supabase.from("sicas_polizas_vigentes")
            .select("no_poliza,aseguradora,ramo,contratante,asegurado,vigencia_desde,vigencia_hasta,prima_total")
            .eq("usuario_id", customer.agent_user_id)
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    const polizas = polizasRes.data || [];
    const cobranza = cobranzaRes.data || [];
    const documentos = docsRes.data || [];
    const agente = agentRes.data;
    const sicasPolizas = sicasRes.data || [];

    // Register Seguwallet as source if we have user data
    if (polizas.length > 0) {
      fuentes.push({
        tipo: "seguwallet",
        descripcion: `${polizas.length} póliza${polizas.length !== 1 ? "s" : ""} registrada${polizas.length !== 1 ? "s" : ""} en tu cuenta`,
        modulo: "Mis Pólizas",
        fecha_actualizacion: nowIso,
        confianza: "alta",
      });
    }
    if (documentos.length > 0) {
      fuentes.push({
        tipo: "seguwallet",
        descripcion: `${documentos.length} documento${documentos.length !== 1 ? "s" : ""} en tu expediente`,
        modulo: "Documentos",
        fecha_actualizacion: nowIso,
        confianza: "alta",
      });
    }

    // Register SICAS as source if we have data
    if (cobranza.length > 0) {
      fuentes.push({
        tipo: "sicas",
        descripcion: `${cobranza.length} recibo${cobranza.length !== 1 ? "s" : ""} de cobranza pendiente${cobranza.length !== 1 ? "s" : ""}`,
        modulo: "Cobranza",
        fecha_actualizacion: nowIso,
        confianza: "alta",
      });
    }
    if (sicasPolizas.length > 0) {
      fuentes.push({
        tipo: "sicas",
        descripcion: `${sicasPolizas.length} póliza${sicasPolizas.length !== 1 ? "s" : ""} vigente${sicasPolizas.length !== 1 ? "s" : ""} en sistema de la aseguradora`,
        modulo: "Pólizas SICAS",
        fecha_actualizacion: nowIso,
        confianza: "alta",
      });
    }

    // Get office info
    let oficina: Record<string, unknown> | null = null;
    if (agente?.oficina_id) {
      const { data: of } = await supabase
        .from("oficinas")
        .select("nombre,telefono,email,whatsapp,sitio_web,domicilio,logo_url")
        .eq("id", agente.oficina_id)
        .maybeSingle();
      oficina = of;
    }

    if (agente || oficina) {
      fuentes.push({
        tipo: "movi",
        descripcion: `Datos del agente ${agente ? `${agente.nombre} ${agente.apellidos}` : oficina?.nombre}`,
        modulo: "Directorio",
        fecha_actualizacion: nowIso,
        confianza: "alta",
      });
    }

    // Get RAG knowledge base context from Centro Digital (external-accessible folders only)
    let ragContext = "";
    let ragDocs: { titulo?: string; fuente?: string }[] = [];
    try {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        // Use vector search with embeddings
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: pregunta }),
        });
        if (embRes.ok) {
          const embData = await embRes.json();
          const queryEmb = embData.data[0].embedding;
          const { data: cdChunks } = await supabase.rpc("buscar_centro_digital_chunks", {
            query_embedding: JSON.stringify(queryEmb),
            similitud_minima: 0.70,
            max_resultados: 5,
            solo_externo: true,
          });
          if (cdChunks && cdChunks.length > 0) {
            ragContext = cdChunks.map((c: { contenido: string }) => c.contenido).join("\n\n");
            ragDocs = cdChunks.map((c: { archivo_nombre?: string; carpeta_nombre?: string }) => ({
              titulo: c.archivo_nombre, fuente: c.carpeta_nombre
            }));
          }
        }
      }
      // Fallback: simple text query if no embeddings
      if (!ragContext) {
        const { data: fragmentos } = await supabase
          .from("centro_digital_chunks")
          .select("contenido,metadata")
          .limit(5);
        if (fragmentos && fragmentos.length > 0) {
          ragContext = fragmentos.map((f: { contenido: string }) => f.contenido).join("\n\n");
          ragDocs = fragmentos.map((f: { metadata?: { archivo_nombre?: string; carpeta_nombre?: string } }) => ({
            titulo: f.metadata?.archivo_nombre, fuente: f.metadata?.carpeta_nombre
          }));
        }
      }
    } catch {
      // RAG is optional
    }

    if (ragContext) {
      const docNames = ragDocs
        .map(d => d.titulo || d.fuente || "")
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");
      fuentes.push({
        tipo: "conocimiento",
        descripcion: docNames
          ? `Base de conocimiento: ${docNames}`
          : "Base de conocimiento de seguros",
        documento: docNames || "Base de conocimiento",
        confianza: "media",
      });
    }

    const agenteNombre = agente ? `${agente.nombre} ${agente.apellidos}` : oficina?.nombre || "tu agente";

    let systemPrompt = `Eres Chava, la asistente digital de seguros de ${agenteNombre}${oficina ? ` (${oficina.nombre})` : ""}. Hoy es ${nowStr}.

PERSONALIDAD:
- Habla de forma clara, amable y humana
- Evita tecnicismos innecesarios
- Sé directa y útil
- No inventes datos, solo usa la información disponible
- Si no tienes certeza, di: "Te recomiendo confirmar esto con tu agente"

CLIENTE:
- Nombre: ${customer.full_name}
- Email: ${customer.email}
- Teléfono: ${customer.phone || "No registrado"}

AGENTE ASIGNADO:
- Nombre: ${agenteNombre}
- Teléfono: ${agente?.celular_laboral || oficina?.telefono || "No disponible"}
- Email: ${agente?.email_laboral || oficina?.email || "No disponible"}
- WhatsApp: ${agente?.celular_laboral || oficina?.whatsapp || "No disponible"}
- Web: ${agente?.url_web_jiro || oficina?.sitio_web || "No disponible"}
${oficina ? `- Oficina: ${oficina.nombre}\n- Dirección: ${oficina.domicilio || "No disponible"}` : ""}

PÓLIZAS DEL CLIENTE (${polizas.length} póliza${polizas.length !== 1 ? "s" : ""}):
${polizas.length === 0 ? "No hay pólizas registradas." : polizas.map(p => {
  const dias = Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000);
  return `• ${p.insurer_name} - ${p.ramo} | Póliza: ${p.policy_number} | Estado: ${p.status} | Vigencia: ${new Date(p.start_date).toLocaleDateString("es-MX")} al ${new Date(p.end_date).toLocaleDateString("es-MX")} (${dias < 0 ? `vencida hace ${Math.abs(dias)} días` : `${dias} días restantes`}) | Prima: $${p.total_premium || "N/D"} ${p.currency || "MXN"}`;
}).join("\n")}

COBRANZA PENDIENTE (${cobranza.length} recibo${cobranza.length !== 1 ? "s" : ""}):
${cobranza.length === 0 ? "Sin pagos pendientes." : cobranza.map(c =>
  `• Póliza ${c.no_poliza} | Importe: $${c.importe_pendiente} MXN | Límite: ${new Date(c.fecha_limite).toLocaleDateString("es-MX")} | ${c.dias_vencidos > 0 ? `VENCIDA ${c.dias_vencidos} días` : "Pendiente"}`
).join("\n")}

DOCUMENTOS (${documentos.length}):
${documentos.length === 0 ? "Sin documentos registrados." : documentos.map(d => `• ${d.nombre_archivo} (${d.tipo_documento})`).join("\n")}

INFORMACIÓN SICAS (${sicasPolizas.length} pólizas):
${sicasPolizas.length === 0 ? "Sin información SICAS disponible." : sicasPolizas.slice(0, 10).map(s =>
  `• ${s.aseguradora} - ${s.ramo} | ${s.no_poliza} | ${s.contratante || s.asegurado}`
).join("\n")}`;

    if (ragContext) {
      systemPrompt += `\n\nBASE DE CONOCIMIENTO:\n${ragContext.substring(0, 2000)}`;
    }

    if (poliza_contexto) {
      systemPrompt += `\n\nCONTEXTO ACTIVO: El cliente está preguntando sobre la póliza ${poliza_contexto}.`;
    }

    systemPrompt += `

REGLAS IMPORTANTES:
1. Solo muestra información del cliente autenticado
2. No confirmes coberturas sin respaldo en los datos
3. Para siniestros, da pasos generales y recomienda llamar a la aseguradora
4. Si el cliente pide hablar con un humano, muestra los datos del agente
5. Responde siempre en español
6. Usa formato claro con saltos de línea cuando sea útil
7. Nunca menciones datos de otros clientes`;

    // Get conversation history
    const { data: historial } = await supabase
      .from("seguwallet_chava_messages")
      .select("rol,contenido")
      .eq("conversacion_id", conversacion_id)
      .order("created_at", { ascending: false })
      .limit(8);

    const mensajesHistorial = (historial || []).reverse();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      const fallback = buildFallbackResponse(pregunta, customer.full_name, polizas, cobranza, agente, agenteNombre, oficina);
      // For fallback, mark as IA inference with low confidence
      fuentes.push({
        tipo: "ia",
        descripcion: "Respuesta generada sin modelo de IA (modo fallback)",
        confianza: "baja",
      });
      return new Response(JSON.stringify({
        respuesta: fallback,
        fuentes,
        confianza_general: "baja",
        modo: "fallback",
        tiempo_ms: Date.now() - startTime,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...mensajesHistorial.slice(-6).map((m: { rol: string; contenido: string }) => ({
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
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const respuesta = aiJson.choices?.[0]?.message?.content || "No pude generar una respuesta. Por favor intenta de nuevo.";
    const tokens_entrada = aiJson.usage?.prompt_tokens || 0;
    const tokens_salida = aiJson.usage?.completion_tokens || 0;

    // Determine if the answer relied heavily on real data vs AI inference
    const hasRealData = polizas.length > 0 || cobranza.length > 0 || sicasPolizas.length > 0;
    const q = pregunta.toLowerCase();
    const asksAboutGeneral = q.includes("cómo") || q.includes("qué es") || q.includes("explica") || q.includes("significado");

    // Add AI source if answer likely includes inference
    if (!hasRealData || asksAboutGeneral) {
      fuentes.push({
        tipo: "ia",
        descripcion: "Conocimiento general de seguros (GPT-4o mini)",
        confianza: hasRealData ? "media" : "baja",
      });
    }

    // Compute overall confidence
    const confianza_general: "alta" | "media" | "baja" =
      fuentes.every(f => f.confianza === "alta") ? "alta"
      : fuentes.some(f => f.confianza === "alta") ? "media"
      : "baja";

    // Continuous learning: detect knowledge gaps when RAG found nothing relevant
    if (fuentes.filter(f => f.tipo === "conocimiento").length === 0 && pregunta.length > 15) {
      try {
        await supabase.from("chava_knowledge_review_queue").insert({
          tipo: "faq",
          titulo: `Sin RAG (Seguwallet): ${pregunta.substring(0, 80)}`,
          descripcion: `Consulta de cliente Seguwallet sin resultados de base de conocimiento.\nCliente: ${customer.full_name}\nAgente: ${agenteNombre}\nPregunta: ${pregunta.substring(0, 300)}`,
          contenido_sugerido: null,
          plataforma_destino: "seguwallet",
          frecuencia_consultas: 1,
          origen_conversacion_ids: conversacion_id ? [conversacion_id] : [],
          estado: "pendiente",
          prioridad: "baja",
        });
      } catch {
        // Non-blocking
      }
    }

    return new Response(JSON.stringify({
      respuesta,
      fuentes,
      confianza_general,
      modelo: "gpt-4o-mini",
      tokens_entrada,
      tokens_salida,
      tiempo_ms: Date.now() - startTime,
      modo: "ai",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("seguwallet-chava error:", message);
    return new Response(JSON.stringify({
      error: "Hubo un problema al procesar tu pregunta. Por favor intenta de nuevo.",
      detail: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildFallbackResponse(
  pregunta: string,
  nombreCliente: string,
  polizas: Record<string, unknown>[],
  cobranza: Record<string, unknown>[],
  agente: Record<string, unknown> | null,
  agenteNombre: string,
  oficina: Record<string, unknown> | null
): string {
  const q = pregunta.toLowerCase();
  const firstName = nombreCliente.split(" ")[0];

  if (q.includes("póliza") || q.includes("seguro") || q.includes("poliza")) {
    if (polizas.length === 0) {
      return `${firstName}, no encontré pólizas registradas en tu cuenta. Contacta a tu agente para verificar si hay información pendiente de sincronizar.`;
    }
    return `${firstName}, tienes **${polizas.length} póliza${polizas.length !== 1 ? "s" : ""}** registradas:\n\n${polizas.map((p: Record<string, unknown>) =>
      `• **${p.insurer_name} - ${p.ramo}**: Póliza ${p.policy_number}`
    ).join("\n")}\n\n¿Quieres saber más sobre alguna de ellas?`;
  }

  if (q.includes("pago") || q.includes("cobr") || q.includes("recibo") || q.includes("venc")) {
    if (cobranza.length === 0) {
      return `¡Buenas noticias, ${firstName}! No tienes pagos pendientes en este momento. Tus seguros están al corriente.`;
    }
    const total = cobranza.reduce((s, c) => s + Number(c.importe_pendiente || 0), 0);
    return `${firstName}, tienes **${cobranza.length} recibo${cobranza.length !== 1 ? "s" : ""}** pendientes por un total de $${total.toLocaleString("es-MX")} MXN. Te recomiendo contactar a tu agente para coordinar el pago.`;
  }

  if (q.includes("agente") || q.includes("contactar") || q.includes("teléfono") || q.includes("llamar")) {
    const tel = (agente?.celular_laboral as string) || (oficina?.telefono as string);
    const email = (agente?.email_laboral as string) || (oficina?.email as string);
    return `Tu agente es **${agenteNombre}**${oficina ? ` de ${oficina.nombre}` : ""}.\n\n${tel ? `Teléfono: ${tel}\n` : ""}${email ? `Email: ${email}\n` : ""}\nPuedes contactarlo directamente para cualquier consulta sobre tus seguros.`;
  }

  if (q.includes("siniestro") || q.includes("accidente") || q.includes("reportar")) {
    return `En caso de siniestro, ${firstName}:\n\n1. Mantén la calma y verifica que todos estén seguros\n2. Documenta el incidente con fotos si es posible\n3. Contacta a tu aseguradora directamente usando el número de emergencias de tu póliza\n4. Notifica a tu agente **${agenteNombre}**\n5. No admitas responsabilidad antes de hablar con tu aseguradora\n\n¿Quieres que te dé el teléfono de tu aseguradora?`;
  }

  return `Hola ${firstName}, soy Chava. Estoy aquí para ayudarte con tus seguros.\n\nPuedo ayudarte con:\n• Información de tus pólizas\n• Pagos y cobranza\n• Contacto con tu agente\n• Procedimientos de siniestros\n\n¿En qué puedo ayudarte?`;
}
