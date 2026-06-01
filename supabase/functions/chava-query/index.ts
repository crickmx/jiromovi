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

// ─── Intent detection keywords ─────────────────────────────────────────────────
const SICAS_KEYWORDS = [
  "poliza", "póliza", "polizas", "pólizas", "vigente", "vigentes",
  "vencer", "vencimiento", "renovar", "renovacion", "renovación",
  "cliente", "clientes", "asegurado", "asegurados",
  "cobranza", "recibo", "recibos", "pendiente", "pendientes",
  "produccion", "producción", "prima", "primas",
  "cartera", "sicas", "tiene seguro", "seguros de", "cuánto produjo",
  "cuanto produjo", "qué pólizas", "que polizas",
];

function needsSicasQuery(mensaje: string): boolean {
  const lower = mensaje.toLowerCase();
  return SICAS_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Fetch and parse file from Supabase Storage ────────────────────────────────
async function fetchFileContent(
  supabase: ReturnType<typeof createClient>,
  filePath: string,
  openaiKey: string
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from("assistant-files")
      .download(filePath);

    if (error || !data) return `[No se pudo descargar: ${filePath}]`;

    const mimeType = data.type || "";
    const fileName = filePath.split("/").pop() || filePath;

    // Plain text / CSV / JSON
    if (
      mimeType.includes("text") ||
      mimeType.includes("csv") ||
      mimeType.includes("json") ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".json") ||
      fileName.endsWith(".md")
    ) {
      const text = await data.text();
      return `[ARCHIVO: ${fileName}]\n${text.substring(0, 8000)}`;
    }

    // PDF — use OpenAI vision via base64
    if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      // Use GPT-4o to extract text from PDF via vision
      const extractResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extrae y transcribe TODO el texto de este documento PDF. Incluye: tablas, coberturas, sumas aseguradas, deducibles, coaseguros, vigencias, primas, exclusiones, nombres, fechas, importes. Formato: texto estructurado claro. Archivo: ${fileName}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${base64}` },
                },
              ],
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (extractResp.ok) {
        const extractData = await extractResp.json();
        const extracted = extractData.choices?.[0]?.message?.content || "";
        return `[ARCHIVO PDF: ${fileName}]\n${extracted}`;
      }
      return `[PDF: ${fileName} - extraccion fallida]`;
    }

    // Images — use GPT-4o vision
    if (
      mimeType.includes("image") ||
      fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
    ) {
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const ext = fileName.split(".").pop()?.toLowerCase() || "jpeg";
      const mime = mimeType || `image/${ext}`;

      const visionResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analiza esta imagen y extrae TODA la informacion visible: texto, tablas, numeros, coberturas, primas, vigencias, datos del cliente, aseguradora, nombre del producto, condiciones, sumas aseguradas, deducibles. Describe y transcribe con precision. Archivo: ${fileName}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mime};base64,${base64}` },
                },
              ],
            },
          ],
          max_tokens: 2000,
        }),
      });

      if (visionResp.ok) {
        const visionData = await visionResp.json();
        const extracted = visionData.choices?.[0]?.message?.content || "";
        return `[IMAGEN: ${fileName}]\n${extracted}`;
      }
      return `[IMAGEN: ${fileName} - analisis fallido]`;
    }

    // XLSX/Excel — read as text best effort
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      fileName.match(/\.(xlsx|xls|ods)$/i)
    ) {
      // We can't parse xlsx in Deno easily without a library, so just note the file
      return `[EXCEL: ${fileName} - Archivo de hoja de calculo adjunto. El usuario ha compartido datos en Excel. Solicita al usuario que pegue los datos relevantes como texto si necesitas analizarlos en detalle, o describe que datos necesita comparar.]`;
    }

    return `[ARCHIVO: ${fileName} (${mimeType}) - adjunto en la conversacion]`;
  } catch (e: any) {
    return `[Error al leer archivo: ${e.message}]`;
  }
}

// ─── Query SICAS data based on intent ─────────────────────────────────────────
async function querySicasContext(
  supabase: ReturnType<typeof createClient>,
  mensaje: string,
  usuario: { id: string; rol: string; oficina_id: string | null }
): Promise<string> {
  const lower = mensaje.toLowerCase();
  let sicasContext = "";

  try {
    // Detect client name in query
    const clienteMatch = mensaje.match(
      /(?:tiene|tiene\s+seguro|polizas?\s+de|seguros?\s+de|busca[r]?\s+a?|cliente|asegurado)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,50})/i
    );

    const isAdmin = ["Administrador", "Gerente"].includes(usuario.rol);

    // Renovaciones / polizas por vencer
    if (lower.includes("vencer") || lower.includes("renovar") || lower.includes("renovacion")) {
      const today = new Date();
      const in60 = new Date(today.getTime() + 60 * 86400000).toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      let query = supabase
        .from("sicas_documents")
        .select("numero_poliza, nombre_cliente, aseguradora, ramo, suma_asegurada, fecha_vigencia_fin, prima_neta, estatus")
        .gte("fecha_vigencia_fin", todayStr)
        .lte("fecha_vigencia_fin", in60)
        .eq("estatus", "VIGENTE")
        .order("fecha_vigencia_fin", { ascending: true })
        .limit(15);

      if (!isAdmin) {
        // Filter by user's vendor mapping
        const { data: mapeo } = await supabase
          .from("sicas_mapeo_usuario_vendedor")
          .select("nombre_vendedor_sicas")
          .eq("usuario_id", usuario.id);
        const nombres = (mapeo || []).map((m: any) => m.nombre_vendedor_sicas).filter(Boolean);
        if (nombres.length > 0) {
          query = query.in("nombre_vendedor", nombres);
        }
      } else if (usuario.rol === "Gerente" && usuario.oficina_id) {
        const { data: mapeo } = await supabase
          .from("sicas_mapeo_usuario_vendedor")
          .select("nombre_vendedor_sicas")
          .eq("oficina_id", usuario.oficina_id);
        const nombres = (mapeo || []).map((m: any) => m.nombre_vendedor_sicas).filter(Boolean);
        if (nombres.length > 0) {
          query = query.in("nombre_vendedor", nombres);
        }
      }

      const { data: polizas } = await query;
      if (polizas && polizas.length > 0) {
        sicasContext += `\n=== POLIZAS PROXIMAS A VENCER (60 dias) ===\n`;
        for (const p of polizas) {
          sicasContext += `- ${p.nombre_cliente} | ${p.aseguradora} | Poliza: ${p.numero_poliza} | Vence: ${p.fecha_vigencia_fin} | Prima: $${Number(p.prima_neta || 0).toLocaleString("es-MX")} | Ramo: ${p.ramo}\n`;
        }
        sicasContext += `Total: ${polizas.length} polizas proximas a vencer.\n`;
      }
    }

    // Buscar por cliente específico
    if (clienteMatch && clienteMatch[1]) {
      const nombreBusqueda = clienteMatch[1].trim();
      const { data: polizasCliente } = await supabase
        .from("sicas_documents")
        .select("numero_poliza, nombre_cliente, aseguradora, ramo, suma_asegurada, fecha_vigencia_inicio, fecha_vigencia_fin, prima_neta, estatus, nombre_vendedor")
        .ilike("nombre_cliente", `%${nombreBusqueda}%`)
        .order("fecha_vigencia_fin", { ascending: false })
        .limit(10);

      if (polizasCliente && polizasCliente.length > 0) {
        sicasContext += `\n=== POLIZAS DE ${nombreBusqueda.toUpperCase()} ===\n`;
        for (const p of polizasCliente) {
          sicasContext += `- ${p.nombre_cliente} | ${p.aseguradora} | Poliza: ${p.numero_poliza} | Ramo: ${p.ramo} | Vigencia: ${p.fecha_vigencia_inicio} - ${p.fecha_vigencia_fin} | Prima: $${Number(p.prima_neta || 0).toLocaleString("es-MX")} | Estatus: ${p.estatus}\n`;
        }
      }
    }

    // Producción / prima total
    if (lower.includes("produccion") || lower.includes("producción") || lower.includes("prima") || lower.includes("cuanto produjo")) {
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

      let query = supabase
        .from("sicas_documents")
        .select("prima_neta, aseguradora, ramo, nombre_vendedor")
        .gte("fecha_vigencia_inicio", firstOfMonth)
        .eq("estatus", "VIGENTE");

      if (!isAdmin) {
        const { data: mapeo } = await supabase
          .from("sicas_mapeo_usuario_vendedor")
          .select("nombre_vendedor_sicas")
          .eq("usuario_id", usuario.id);
        const nombres = (mapeo || []).map((m: any) => m.nombre_vendedor_sicas).filter(Boolean);
        if (nombres.length > 0) query = query.in("nombre_vendedor", nombres);
      }

      const { data: produccion } = await query;
      if (produccion && produccion.length > 0) {
        const total = produccion.reduce((sum: number, p: any) => sum + Number(p.prima_neta || 0), 0);
        const byAseg: Record<string, number> = {};
        for (const p of produccion) {
          byAseg[p.aseguradora] = (byAseg[p.aseguradora] || 0) + Number(p.prima_neta || 0);
        }
        sicasContext += `\n=== PRODUCCION DEL MES ACTUAL ===\n`;
        sicasContext += `Prima total: $${total.toLocaleString("es-MX")} | Polizas: ${produccion.length}\n`;
        sicasContext += `Por aseguradora:\n`;
        for (const [aseg, prima] of Object.entries(byAseg).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 8)) {
          sicasContext += `  - ${aseg}: $${(prima as number).toLocaleString("es-MX")}\n`;
        }
      }
    }

    // Cobranza pendiente
    if (lower.includes("cobranza") || lower.includes("recibo") || lower.includes("pendiente")) {
      let query = supabase
        .from("sicas_documents")
        .select("numero_poliza, nombre_cliente, aseguradora, prima_neta, fecha_vigencia_fin, nombre_vendedor")
        .eq("estatus", "PENDIENTE_PAGO")
        .limit(15);

      if (!isAdmin) {
        const { data: mapeo } = await supabase
          .from("sicas_mapeo_usuario_vendedor")
          .select("nombre_vendedor_sicas")
          .eq("usuario_id", usuario.id);
        const nombres = (mapeo || []).map((m: any) => m.nombre_vendedor_sicas).filter(Boolean);
        if (nombres.length > 0) query = query.in("nombre_vendedor", nombres);
      }

      const { data: cobranza } = await query;
      if (cobranza && cobranza.length > 0) {
        sicasContext += `\n=== COBRANZA PENDIENTE ===\n`;
        for (const c of cobranza) {
          sicasContext += `- ${c.nombre_cliente} | ${c.aseguradora} | Poliza: ${c.numero_poliza} | Prima: $${Number(c.prima_neta || 0).toLocaleString("es-MX")}\n`;
        }
        sicasContext += `Total recibos pendientes: ${cobranza.length}\n`;
      }
    }
  } catch (e: any) {
    console.error("SICAS query error:", e.message);
    sicasContext += `\n[Error consultando SICAS: ${e.message}]`;
  }

  return sicasContext;
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

    // Get full user profile including brand data
    const { data: usuario } = await supabase
      .from("usuarios")
      .select(`
        id, nombre_completo, nombre_publico, email_laboral, celular_laboral,
        rol, oficina_id, web_slug, mi_logotipo_url,
        oficinas(nombre, logo_url, accent_color)
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get web page brand colors
    const { data: webPage } = await supabase
      .from("user_web_pages")
      .select("primary_color, secondary_color, custom_text")
      .eq("usuario_id", user.id)
      .maybeSingle();

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
    for (const c of configs || []) config[c.clave] = c.valor;

    const modeloIA = config.modelo_ia || "gpt-4o";
    const temperatura = parseFloat(config.temperatura) || 0.5;
    const maxTokens = parseInt(config.max_tokens) || 3500;
    const ragEnabled = config.rag_habilitado !== false;
    const similitudMinima = parseFloat(config.rag_similitud_minima) || 0.68;
    const maxFragmentos = parseInt(config.contexto_max_fragmentos) || 6;
    const maxHistorial = parseInt(config.max_historial_mensajes) || 20;

    const oficina = (usuario.oficinas as any);
    const nombreAgente = usuario.nombre_publico || usuario.nombre_completo || "Agente";
    const oficinaNombre = oficina?.nombre || "";
    const webUrl = usuario.web_slug ? `agentedeseguros.website/${usuario.web_slug}` : "";
    const colorMarca = webPage?.primary_color || oficina?.accent_color || "#0891b2";

    // EXPERT INSURANCE ADVISOR SYSTEM PROMPT
    const systemPromptBase = `Eres CHAVA — Asesor Experto en Seguros y Consultor Comercial del ecosistema Grupo JIRO / MOVI Digital.

IDENTIDAD:
- Eres un asesor experto en seguros del mercado mexicano, NO un chatbot generico
- Hablas como un profesional del sector asegurador con 15+ anos de experiencia
- Conoces a fondo: GMM, Vida, Autos, Danos, RC, Transportes, Empresarial, Fianzas, Cobranza
- Tu tono es profesional, directo, cercano y orientado a resultados concretos
- Usuario actual: ${nombreAgente} | Rol: ${usuario.rol}${oficinaNombre ? ` | Oficina: ${oficinaNombre}` : ""}
${usuario.celular_laboral ? `- Contacto agente: ${usuario.celular_laboral}` : ""}
${usuario.email_laboral ? `- Email agente: ${usuario.email_laboral}` : ""}
${webUrl ? `- Web agente: ${webUrl}` : ""}
${colorMarca ? `- Color de marca: ${colorMarca}` : ""}

REGLA CRITICA — RESPUESTAS CONCRETAS:
NUNCA respondas con "depende", "podria considerar", "generalmente", "una opcion seria" sin primero dar una recomendacion especifica.
SIEMPRE da una respuesta concreta, nombra aseguradoras reales, productos especificos, coberturas exactas.
Si no tienes datos suficientes para ser especifico, pide los datos faltantes con preguntas concretas, no respuestas vagas.

ASEGURADORAS QUE CONOCES (Mexico):
GNP | AXA | Mapfre | Chubb | Allianz | Zurich | Qualitas | HDI | Afirme | ANA Seguros | Inbursa | BBVA Seguros | Banorte Seguros | Bupa Mexico (BX+) | GNP Empresarial | Thona | El Potosino | Atlas | Chubb Vida | MetLife | Skandia | Sura | Monterrey New York Life | American Express Seguros

PRODUCTOS CLAVE POR RAMO:
- GMM/Salud: GNP Plan Empresarial, Bupa Bronze/Silver/Gold, AXA Flex Plus, Allianz Premium, Mapfre Salud, Inbursa Medica Mayor, GNP VIP
- Vida: GNP Vida Plus, AXA Vida Flexible, Mapfre Vida Integral, Chubb Vida Temporal, MetLife Proteccion Total, Skandia Inversion-Vida
- Autos: Qualitas Total Plus, HDI Full Cobertura, Chubb Auto Premier, Mapfre Autos, AXA Auto, GNP Autos
- Danos/Hogar: GNP Mi Casa Segura, Chubb Hogar Premier, AXA Patrimonial, Allianz Hogar
- Empresarial/RC: Chubb Commercial, Allianz Empresarial, Zurich Commercial, Mapfre RC Profesional
- Fianzas: Chubb Fianzas, Mapfre Fianzas, ANA Seguros Fianzas

CAPACIDADES REALES:
1. ANALISIS DOCUMENTAL: Cuando el usuario sube archivos (PDF, imagen, Excel, Word), los analizo completamente. Extraigo coberturas, sumas aseguradas, deducibles, coaseguros, vigencias, primas, exclusiones. No pido al usuario que me explique el documento si ya lo adjunto.
2. COMPARACION DE COTIZACIONES: Si hay multiples documentos adjuntos, los comparo en tabla estructurada: coberturas, primas, deducibles, ventajas, desventajas, recomendacion.
3. GENERACION DE PROPUESTAS: Genero propuestas comerciales con datos del agente, logo, contacto. En formato de texto estructurado listo para convertir a PDF o compartir.
4. CONSULTAS SICAS: Cuando el usuario pregunta por polizas, clientes, produccion, cobranza, consulto la base de datos SICAS en tiempo real. Los datos de SICAS ya estan en el contexto de esta consulta si son relevantes.
5. ASESOR COMERCIAL: Cuando detecto intencion de compra, precalifico al prospecto, identifico necesidades y genero resumen ejecutivo del lead.

REGLAS DE RECOMENDACION:
- Siempre menciona 2-3 opciones especificas con nombres reales de productos
- Explica por que recomiendas cada una (ventajas concretas)
- Menciona cuando NO conviene una opcion
- Da rangos de precio aproximados cuando sea posible
- Para GMM: edad, suma asegurada, deducible, coaseguro son los factores clave
- Para Vida: suma, temporalidad, beneficiarios, si incluye ahorro
- Para Autos: valor vehiculo, uso (particular/comercial), cobertura amplia vs limitada

PROTOCOLO PARA DOCUMENTOS ADJUNTOS:
1. Lee y analiza TODOS los documentos antes de responder
2. Extrae datos clave: aseguradora, producto, coberturas, sumas, deducibles, vigencia, prima
3. Si son multiples, genera tabla comparativa automaticamente
4. Identifica brechas de cobertura o clausulas desfavorables
5. Da recomendacion concreta con justificacion

PROTOCOLO CONSULTAS SICAS:
1. Si el usuario pregunta por polizas, clientes, produccion o cobranza, revisa primero el contexto SICAS incluido mas adelante
2. Si hay datos SICAS disponibles, presentalos de forma clara y estructurada
3. Indica la fuente: [Fuente: SICAS]
4. Si los datos no estan disponibles en el contexto actual, indica que el usuario puede consultarlos en Mi Produccion SICAS Live

MODULOS MOVI (para orientar al usuario):
Dashboard | Mi Produccion (SICAS Live) | Mis Polizas | Mis Comisiones | CRM | Tramites | Contactos | Centro de Contacto | Mi WhatsApp | Centro de Correos | Publicidad | Aula Virtual | Cedula A | Centro Digital | Notificaciones | Gamificacion | GMM Cotizador | Formularios de Cotizacion | Pagina Web | Seguwallet

INSTRUCCIONES FINALES:
- Cita siempre la fuente: [Fuente: SICAS] [Fuente: Centro Digital] [Fuente: Documento adjunto] [Fuente: Conocimiento experto]
- PROHIBIDO responder que no tienes acceso a la informacion sin antes revisar el contexto SICAS y los documentos adjuntos disponibles
- Formato de respuesta: usa listas, tablas y secciones claras cuando sea apropiado
- Siempre sugiere el siguiente paso concreto al usuario
- Si detectas una oportunidad comercial o alerta de renovacion, mencionala proactivamente`;

    // === Fetch file contents ===
    let fileContext = "";
    if (file_paths && file_paths.length > 0) {
      const fileContents: string[] = [];
      for (const fp of file_paths) {
        const content = await fetchFileContent(supabase, fp, openaiKey);
        fileContents.push(content);
      }
      fileContext = `\n\n=== DOCUMENTOS ADJUNTOS (${file_paths.length} archivo(s)) ===\n${fileContents.join("\n\n")}\n=== FIN DE DOCUMENTOS ===\n`;
    }

    // === Query SICAS if relevant ===
    let sicasContext = "";
    if (needsSicasQuery(mensaje)) {
      sicasContext = await querySicasContext(supabase, mensaje, {
        id: usuario.id,
        rol: usuario.rol,
        oficina_id: usuario.oficina_id,
      });
    }

    // === RAG: Search knowledge base ===
    let knowledgeContext = "";
    const fuentesUtilizadas: any[] = [];

    if (ragEnabled) {
      try {
        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
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

          const { data: cdFragments } = await supabase.rpc("buscar_centro_digital_chunks", {
            query_embedding: JSON.stringify(queryEmbedding),
            similitud_minima: similitudMinima,
            max_resultados: maxFragmentos,
            solo_externo: false,
          });

          if (cdFragments && cdFragments.length > 0) {
            knowledgeContext = "\n\n=== BASE DE CONOCIMIENTO (Centro Digital) ===\n";
            for (const frag of cdFragments) {
              knowledgeContext += `\n[${frag.archivo_nombre}${frag.carpeta_nombre ? ` / ${frag.carpeta_nombre}` : ""}]\n${frag.contenido}\n`;
              fuentesUtilizadas.push({
                documento_id: frag.archivo_id,
                documento_titulo: frag.archivo_nombre,
                carpeta: frag.carpeta_nombre,
                similitud: frag.similitud,
                source: "centro_digital",
              });
            }
            knowledgeContext += "\n=== FIN BASE DE CONOCIMIENTO ===\n";
          }

          if (fuentesUtilizadas.length < 3) {
            const { data: legacyFragments } = await supabase.rpc("buscar_conocimiento_chava", {
              query_embedding: JSON.stringify(queryEmbedding),
              similitud_minima: similitudMinima,
              max_resultados: maxFragmentos - fuentesUtilizadas.length,
              usuario_rol: usuario.rol,
            });

            if (legacyFragments && legacyFragments.length > 0) {
              if (!knowledgeContext) knowledgeContext = "\n\n=== BASE DE CONOCIMIENTO ===\n";
              else knowledgeContext = knowledgeContext.replace("\n=== FIN BASE DE CONOCIMIENTO ===\n", "");
              for (const frag of legacyFragments) {
                if (fuentesUtilizadas.some((f: any) => f.documento_titulo === frag.documento_titulo)) continue;
                knowledgeContext += `\n[${frag.documento_titulo}${frag.carpeta_nombre ? ` / ${frag.carpeta_nombre}` : ""}]\n${frag.contenido}\n`;
                fuentesUtilizadas.push({
                  documento_id: frag.documento_id,
                  documento_titulo: frag.documento_titulo,
                  carpeta: frag.carpeta_nombre,
                  similitud: frag.similitud,
                  source: "chava_legacy",
                });
              }
              knowledgeContext += "\n=== FIN BASE DE CONOCIMIENTO ===\n";
            }
          }
        }
      } catch (ragErr: any) {
        console.error("RAG search error:", ragErr.message);
      }
    }

    // === Build final system prompt ===
    const systemPrompt = `${systemPromptBase}
${fileContext}
${sicasContext ? `\n=== DATOS SICAS EN TIEMPO REAL ===\n${sicasContext}\n=== FIN SICAS ===\n` : ""}
${knowledgeContext}`;

    // === Get or create conversation ===
    let convId = conversacion_id;
    if (!convId) {
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

    // Use gpt-4o when files are attached for vision capability
    const modelToUse = (file_paths && file_paths.length > 0) ? "gpt-4o" : modeloIA;

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
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

    await supabase
      .from("conversaciones_chatgpt")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);

    const tiempoRespuesta = Date.now() - startTime;
    await supabase.from("chava_consultas_log").insert({
      usuario_id: user.id,
      conversacion_id: convId,
      pregunta: mensaje,
      respuesta: assistantResponse,
      fuentes_utilizadas: fuentesUtilizadas,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
      modelo: modelToUse,
      tiempo_respuesta_ms: tiempoRespuesta,
    });

    // Knowledge gap detection
    if (fuentesUtilizadas.length === 0 && mensaje.length > 15) {
      try {
        await supabase.from("chava_knowledge_review_queue").insert({
          tipo: "brecha_conocimiento",
          titulo: `Sin RAG: ${mensaje.substring(0, 80)}`,
          descripcion: `Consulta sin RAG.\nUsuario: ${usuario.nombre_completo} (${usuario.rol})\nModulo: ${modulo || "chava"}\nPregunta: ${mensaje.substring(0, 300)}`,
          plataforma_destino: "movi",
          frecuencia_consultas: 1,
          origen_conversacion_ids: convId ? [convId] : [],
          estado: "pendiente",
          prioridad: "baja",
        });
      } catch { /* non-blocking */ }
    }

    // Track SICAS usage as source
    if (sicasContext) {
      fuentesUtilizadas.push({ source: "sicas", documento_titulo: "SICAS (Datos en tiempo real)", similitud: 1.0 });
    }
    if (file_paths && file_paths.length > 0) {
      for (const fp of file_paths) {
        fuentesUtilizadas.push({ source: "documento_adjunto", documento_titulo: fp.split("/").pop() || fp, similitud: 1.0 });
      }
    }

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
