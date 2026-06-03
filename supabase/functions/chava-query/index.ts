import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Reference ID generator ─────────────────────────────────────────────────
function generateRefId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "CHAVA-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Audit logger ───────────────────────────────────────────────────────────
interface ToolCall {
  tool: string;
  input?: any;
  output_summary?: string;
  duration_ms: number;
  error?: string;
}

class AuditLogger {
  private refId: string;
  private toolCalls: ToolCall[] = [];
  private startTime: number;

  constructor(refId: string) {
    this.refId = refId;
    this.startTime = Date.now();
  }

  addToolCall(call: ToolCall) { this.toolCalls.push(call); }
  getRefId() { return this.refId; }
  getToolCalls() { return this.toolCalls; }
  getElapsed() { return Date.now() - this.startTime; }

  async save(supabase: any, params: {
    usuario_id: string;
    conversacion_id: string | null;
    modulo: string;
    ruta: string;
    pregunta: string;
    respuesta?: string;
    fuentes_utilizadas?: any[];
    tokens_entrada?: number;
    tokens_salida?: number;
    modelo?: string;
    tuvo_error?: boolean;
    error_mensaje?: string;
    error_stack?: string;
    error_tipo?: string;
    rol_usuario: string;
    oficina_id: string | null;
  }) {
    try {
      await supabase.from("chava_audit_log").insert({
        ref_id: this.refId,
        usuario_id: params.usuario_id,
        conversacion_id: params.conversacion_id,
        modulo: params.modulo,
        ruta: params.ruta,
        pregunta: params.pregunta,
        respuesta: params.respuesta || null,
        herramientas_llamadas: this.toolCalls,
        fuentes_utilizadas: params.fuentes_utilizadas || [],
        tiempo_respuesta_ms: this.getElapsed(),
        tokens_entrada: params.tokens_entrada || 0,
        tokens_salida: params.tokens_salida || 0,
        modelo: params.modelo || null,
        tuvo_error: params.tuvo_error || false,
        error_mensaje: params.error_mensaje || null,
        error_stack: params.error_stack || null,
        error_tipo: params.error_tipo || null,
        rol_usuario: params.rol_usuario,
        oficina_id: params.oficina_id,
      });
    } catch (e: any) {
      console.error("[Audit] Failed to save log:", e.message);
    }
  }

  async updateToolHealth(supabase: any, tool: string, ok: boolean, durationMs: number, records?: number, errorMsg?: string) {
    if (!supabase) return;
    try {
      if (ok) {
        await supabase.from("chava_tool_health").upsert({
          herramienta: tool, estado: "ok",
          ultimo_ok_at: new Date().toISOString(),
          tiempo_respuesta_ms: durationMs,
          registros_encontrados: records ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "herramienta" });
      } else {
        await supabase.from("chava_tool_health").upsert({
          herramienta: tool, estado: "error",
          ultimo_error_at: new Date().toISOString(),
          ultimo_error: errorMsg || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "herramienta" });
      }
    } catch { /* non-blocking */ }
  }
}

interface QueryRequest {
  mensaje: string;
  conversacion_id?: string;
  modulo?: string;
  ruta?: string;
  parametros?: Record<string, any>;
  file_paths?: string[];
}

// ── Specialist routing ─────────────────────────────────────────────────────
interface Specialist {
  codigo: string;
  nombre: string;
  descripcion: string;
  palabras_clave: string[];
  modulos_relevantes: string[];
}

function detectSpecialists(mensaje: string, ruta: string, specialists: Specialist[]): { primario: string; activados: string[]; confianza: number } {
  const lower = mensaje.toLowerCase();
  const scores: Map<string, number> = new Map();

  for (const sp of specialists) {
    let score = 0;
    for (const kw of sp.palabras_clave) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length > 8 ? 3 : kw.length > 4 ? 2 : 1;
      }
    }
    // Boost if current module matches
    const rutaSlug = ruta.replace(/^\//, "").split("/")[0];
    if (sp.modulos_relevantes.some(m => rutaSlug.includes(m) || m.includes(rutaSlug))) {
      score += 5;
    }
    if (score > 0) scores.set(sp.codigo, score);
  }

  if (scores.size === 0) {
    return { primario: "seguros", activados: ["seguros"], confianza: 0.5 };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const maxScore = sorted[0][1];
  const primario = sorted[0][0];
  // Activate specialists with score >= 40% of max
  const activados = sorted.filter(([, s]) => s >= maxScore * 0.4).map(([c]) => c);
  // Confidence based on score spread
  const confianza = Math.min(0.98, 0.5 + maxScore * 0.04);

  return { primario, activados: activados.slice(0, 3), confianza };
}

// ── SICAS keywords ─────────────────────────────────────────────────────────
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

// ── Fetch file content from storage ────────────────────────────────────────
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

    if (mimeType.includes("text") || mimeType.includes("csv") || mimeType.includes("json") ||
        fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".json") || fileName.endsWith(".md")) {
      const text = await data.text();
      return `[ARCHIVO: ${fileName}]\n${text.substring(0, 8000)}`;
    }

    if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) {
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const extractResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: [
            { type: "text", text: `Extrae y transcribe TODO el texto de este documento PDF. Incluye: tablas, coberturas, sumas aseguradas, deducibles, coaseguros, vigencias, primas, exclusiones, nombres, fechas, importes. Formato: texto estructurado claro. Archivo: ${fileName}` },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
          ]}],
          max_tokens: 4000,
        }),
      });
      if (extractResp.ok) {
        const d = await extractResp.json();
        return `[ARCHIVO PDF: ${fileName}]\n${d.choices?.[0]?.message?.content || ""}`;
      }
      return `[PDF: ${fileName} - extraccion fallida]`;
    }

    if (mimeType.includes("image") || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const ext = fileName.split(".").pop()?.toLowerCase() || "jpeg";
      const mime = mimeType || `image/${ext}`;
      const visionResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: [
            { type: "text", text: `Analiza esta imagen y extrae TODA la informacion visible: texto, tablas, numeros, coberturas, primas, vigencias, datos del cliente, aseguradora, nombre del producto, condiciones, sumas aseguradas, deducibles. Describe y transcribe con precision. Archivo: ${fileName}` },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ]}],
          max_tokens: 2000,
        }),
      });
      if (visionResp.ok) {
        const d = await visionResp.json();
        return `[IMAGEN: ${fileName}]\n${d.choices?.[0]?.message?.content || ""}`;
      }
      return `[IMAGEN: ${fileName} - analisis fallido]`;
    }

    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || fileName.match(/\.(xlsx|xls|ods)$/i)) {
      return `[EXCEL: ${fileName} - Archivo de hoja de calculo adjunto. Solicita al usuario que pegue los datos relevantes como texto si necesitas analizarlos.]`;
    }

    return `[ARCHIVO: ${fileName} (${mimeType}) - adjunto en la conversacion]`;
  } catch (e: any) {
    return `[Error al leer archivo: ${e.message}]`;
  }
}

// ── SICAS context query ────────────────────────────────────────────────────
async function querySicasContext(
  supabase: ReturnType<typeof createClient>,
  mensaje: string,
  usuario: { id: string; rol: string; oficina_id: string | null },
  audit: AuditLogger
): Promise<string> {
  const lower = mensaje.toLowerCase();
  let sicasContext = "";

  try {
    const clienteMatch = mensaje.match(
      /(?:tiene|tiene\s+seguro|polizas?\s+de|seguros?\s+de|busca[r]?\s+a?|cliente|asegurado)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,50})/i
    );
    const isAdmin = ["Administrador", "Gerente"].includes(usuario.rol);

    const getVendorNames = async (userId: string): Promise<string[]> => {
      const { data: mapeo } = await supabase
        .from("sicas_mapeo_vendedor_usuario")
        .select("id_sicas_vendedor")
        .eq("movi_user_id", userId);
      return (mapeo || []).map((m: any) => m.id_sicas_vendedor).filter(Boolean);
    };

    const getOfficeVendorNames = async (oficina_id: string): Promise<string[]> => {
      const { data: usuarios } = await supabase.from("usuarios").select("id").eq("oficina_id", oficina_id);
      if (!usuarios || usuarios.length === 0) return [];
      const { data: mapeo } = await supabase
        .from("sicas_mapeo_vendedor_usuario")
        .select("id_sicas_vendedor")
        .in("movi_user_id", usuarios.map((u: any) => u.id));
      return (mapeo || []).map((m: any) => m.id_sicas_vendedor).filter(Boolean);
    };

    if (lower.includes("vencer") || lower.includes("renovar") || lower.includes("renovacion")) {
      const today = new Date();
      const in60 = new Date(today.getTime() + 60 * 86400000).toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      let query = supabase.from("sicas_documents")
        .select("poliza, cliente, compania, ramo, prima_neta, vigencia_hasta, is_vigente, aseguradora_nombre")
        .gte("vigencia_hasta", todayStr).lte("vigencia_hasta", in60)
        .eq("is_vigente", true).order("vigencia_hasta", { ascending: true }).limit(15);

      if (!isAdmin) {
        const vendorIds = await getVendorNames(usuario.id);
        if (vendorIds.length > 0) query = query.in("vend_nombre", vendorIds);
        else query = query.eq("usuario_id", usuario.id);
      } else if (usuario.rol === "Gerente" && usuario.oficina_id) {
        const vendorIds = await getOfficeVendorNames(usuario.oficina_id);
        if (vendorIds.length > 0) query = query.in("vend_nombre", vendorIds);
      }

      const { data: polizas } = await query;
      if (polizas && polizas.length > 0) {
        sicasContext += `\n=== POLIZAS PROXIMAS A VENCER (60 dias) ===\n`;
        for (const p of polizas) {
          const aseg = p.aseguradora_nombre || p.compania || "-";
          sicasContext += `- ${p.cliente} | ${aseg} | Poliza: ${p.poliza} | Vence: ${p.vigencia_hasta?.split("T")[0] || "-"} | Prima: $${Number(p.prima_neta || 0).toLocaleString("es-MX")} | Ramo: ${p.ramo}\n`;
        }
        sicasContext += `Total: ${polizas.length} polizas proximas a vencer.\n`;
      }
    }

    if (clienteMatch && clienteMatch[1]) {
      const nombreBusqueda = clienteMatch[1].trim();
      const { data: polizasCliente } = await supabase.from("sicas_documents")
        .select("poliza, cliente, compania, aseguradora_nombre, ramo, vigencia_desde, vigencia_hasta, prima_neta, is_vigente, status_codigo, vend_nombre")
        .ilike("cliente", `%${nombreBusqueda}%`)
        .order("vigencia_hasta", { ascending: false }).limit(10);

      if (polizasCliente && polizasCliente.length > 0) {
        sicasContext += `\n=== POLIZAS DE ${nombreBusqueda.toUpperCase()} ===\n`;
        for (const p of polizasCliente) {
          const aseg = p.aseguradora_nombre || p.compania || "-";
          const estatus = p.is_vigente ? "VIGENTE" : (p.status_codigo || "INACTIVA");
          sicasContext += `- ${p.cliente} | ${aseg} | Poliza: ${p.poliza} | Ramo: ${p.ramo} | Vigencia: ${p.vigencia_desde?.split("T")[0] || "-"} - ${p.vigencia_hasta?.split("T")[0] || "-"} | Prima: $${Number(p.prima_neta || 0).toLocaleString("es-MX")} | Estatus: ${estatus}\n`;
        }
      } else {
        sicasContext += `\n=== BUSQUEDA DE CLIENTE: ${nombreBusqueda.toUpperCase()} ===\nNo se encontraron polizas para este cliente en SICAS.\n`;
      }
    }

    if (lower.includes("produccion") || lower.includes("producción") || lower.includes("prima") || lower.includes("cuanto produjo")) {
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      let query = supabase.from("sicas_documents")
        .select("prima_neta, compania, aseguradora_nombre, ramo, vend_nombre")
        .gte("vigencia_desde", firstOfMonth).eq("is_vigente", true);

      if (!isAdmin) {
        const vendorIds = await getVendorNames(usuario.id);
        if (vendorIds.length > 0) query = query.in("vend_nombre", vendorIds);
        else query = query.eq("usuario_id", usuario.id);
      }

      const { data: produccion } = await query;
      if (produccion && produccion.length > 0) {
        const total = produccion.reduce((sum: number, p: any) => sum + Number(p.prima_neta || 0), 0);
        const byAseg: Record<string, number> = {};
        for (const p of produccion) {
          const key = p.aseguradora_nombre || p.compania || "Otra";
          byAseg[key] = (byAseg[key] || 0) + Number(p.prima_neta || 0);
        }
        sicasContext += `\n=== PRODUCCION DEL MES ACTUAL ===\nPrima total: $${total.toLocaleString("es-MX")} | Polizas: ${produccion.length}\nPor aseguradora:\n`;
        for (const [aseg, prima] of Object.entries(byAseg).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 8)) {
          sicasContext += `  - ${aseg}: $${(prima as number).toLocaleString("es-MX")}\n`;
        }
      }
    }

    if (lower.includes("cobranza") || lower.includes("recibo") || lower.includes("pendiente")) {
      let query = supabase.from("sicas_documents")
        .select("poliza, cliente, compania, aseguradora_nombre, prima_neta, vigencia_hasta, vend_nombre")
        .eq("is_vigente", false).not("status_codigo", "is", null).limit(15);

      if (!isAdmin) {
        const vendorIds = await getVendorNames(usuario.id);
        if (vendorIds.length > 0) query = query.in("vend_nombre", vendorIds);
        else query = query.eq("usuario_id", usuario.id);
      }

      const { data: cobranza } = await query;
      if (cobranza && cobranza.length > 0) {
        sicasContext += `\n=== DOCUMENTOS PENDIENTES ===\n`;
        for (const c of cobranza) {
          const aseg = c.aseguradora_nombre || c.compania || "-";
          sicasContext += `- ${c.cliente} | ${aseg} | Poliza: ${c.poliza} | Prima: $${Number(c.prima_neta || 0).toLocaleString("es-MX")}\n`;
        }
        sicasContext += `Total: ${cobranza.length} documentos.\n`;
      }
    }
  } catch (e: any) {
    const errMsg = e?.message || String(e);
    console.error("SICAS query error:", errMsg);
    audit.addToolCall({ tool: "consultar_sicas", duration_ms: 0, error: errMsg });
  }

  return sicasContext;
}

// ── Build CHAVA OS system prompt ───────────────────────────────────────────
function buildSystemPrompt(params: {
  nombreAgente: string;
  rol: string;
  oficinaNombre: string;
  celular: string;
  email: string;
  webUrl: string;
  colorMarca: string;
  primarioEspecialista: string;
  especialistasActivados: string[];
  memoryContext: string;
  fileContext: string;
  sicasContext: string;
  knowledgeContext: string;
}): string {
  const specialistGuidance = buildSpecialistGuidance(params.primarioEspecialista, params.especialistasActivados);

  return `Eres CHAVA — Sistema Operativo Inteligente del ecosistema MOVI Digital / Seguwallet / AgenteDeSeguros.AI.

IDENTIDAD Y ROL:
- Eres el asistente experto central del ecosistema. Internamente activas especialistas según la consulta, pero el usuario siempre interactua con una sola voz: CHAVA.
- Hablas como un profesional del sector asegurador mexicano con 15+ anos de experiencia.
- Usuario actual: ${params.nombreAgente} | Rol: ${params.rol}${params.oficinaNombre ? ` | Oficina: ${params.oficinaNombre}` : ""}
${params.celular ? `- Contacto: ${params.celular}` : ""}
${params.email ? `- Email: ${params.email}` : ""}
${params.webUrl ? `- Web: ${params.webUrl}` : ""}

ESPECIALISTAS ACTIVADOS PARA ESTA CONSULTA:
${specialistGuidance}

REGLAS CRITICAS:
1. NUNCA respondas con vagas como "depende" o "podria considerar" sin dar primero una recomendacion especifica.
2. SIEMPRE da respuestas concretas: aseguradoras reales, productos especificos, coberturas exactas, importes.
3. Si los datos no estan disponibles, indica claramente que modulo tiene la informacion y como llegar.
4. SIEMPRE incluye al final de cada respuesta una seccion "SIGUIENTE PASO" con 1-2 acciones concretas.
5. Para consultas de datos SICAS, revisa PRIMERO el contexto SICAS antes de responder.
6. Cuando sugiereas CTAs, usa el formato: [CTA: label | ruta] — ejemplo: [CTA: Ver mis polizas | /mis-polizas]

NIVEL DE CONFIANZA:
- Indica el nivel de confianza al final de respuestas complejas: [Confianza: Alta/Media/Baja]
- Alta = datos directos de SICAS o Centro Digital
- Media = conocimiento experto aplicado al contexto del usuario
- Baja = estimacion general sin datos especificos del usuario

ASEGURADORAS MEXICANAS:
GNP | AXA | Mapfre | Chubb | Allianz | Zurich | Qualitas | HDI | Afirme | ANA Seguros | Inbursa | BBVA Seguros | Banorte Seguros | Bupa Mexico (BX+) | GNP Empresarial | Thona | El Potosino | Atlas | Chubb Vida | MetLife | Skandia | Sura | Monterrey New York Life

PRODUCTOS POR RAMO:
- GMM/Salud: GNP Plan Empresarial, Bupa Bronze/Silver/Gold, AXA Flex Plus, Allianz Premium, Mapfre Salud, Inbursa Medica Mayor
- Vida: GNP Vida Plus, AXA Vida Flexible, Mapfre Vida Integral, Chubb Vida Temporal, MetLife Proteccion Total
- Autos: Qualitas Total Plus, HDI Full Cobertura, Chubb Auto Premier, Mapfre Autos, AXA Auto, GNP Autos
- Danos/Hogar: GNP Mi Casa Segura, Chubb Hogar Premier, AXA Patrimonial, Allianz Hogar
- Empresarial/RC: Chubb Commercial, Allianz Empresarial, Zurich Commercial, Mapfre RC Profesional

MODULOS MOVI DIGITAL (para orientar al usuario con CTAs):
Dashboard | Mi Produccion SICAS Live (/mi-produccion-sicas-live) | Mis Polizas (/mis-polizas) | Mis Comisiones (/mis-comisiones) | CRM (/crm) | Tramites (/tramites) | Contactos (/contactos) | Centro de Contacto (/centro-contacto) | Mi WhatsApp (/mi-whatsapp) | Centro de Correos (/centro-correos) | Publicidad (/mercadotecnia/publicidad) | Aula Virtual (/seguros-education/aula-virtual) | Cedula A (/cedula-a) | Centro Digital (/centro-digital) | GMM Cotizador (/gmm-cotizador) | Pagina Web (/mercadotecnia/mi-pagina-web) | Seguwallet (/chava-seguwallet)

${params.memoryContext ? `\n=== MEMORIA CONTEXTUAL ===\n${params.memoryContext}\n=== FIN MEMORIA ===\n` : ""}
${params.fileContext}
${params.sicasContext ? `\n=== DATOS SICAS EN TIEMPO REAL ===\n${params.sicasContext}\n=== FIN SICAS ===\n` : ""}
${params.knowledgeContext}`;
}

function buildSpecialistGuidance(primario: string, activados: string[]): string {
  const guideMap: Record<string, string> = {
    seguros: "Modo EXPERTO EN SEGUROS: analiza coberturas, compara productos, genera propuestas, identifica brechas. Nombra aseguradoras y productos especificos.",
    sicas: "Modo EXPERTO SICAS: usa datos de produccion, polizas vigentes, renovaciones, cobranza del contexto SICAS. Presenta datos en formato tabla/lista estructurada.",
    crm: "Modo EXPERTO CRM: ayuda a gestionar contactos, tareas, oportunidades. Sugiere acciones de seguimiento concretas y proximos pasos comerciales.",
    produccion: "Modo EXPERTO PRODUCCION: analiza metricas, comisiones, rankings. Compara periodos, identifica tendencias, sugiere como mejorar la produccion.",
    marketing: "Modo EXPERTO MARKETING: ayuda con pagina web, materiales publicitarios, estrategia digital. Sugiere contenido y canales especificos.",
    capacitacion: "Modo EXPERTO CAPACITACION: orienta sobre cursos, leccion, examen, cedula A. Explica conceptos de seguros para preparacion del examen.",
    tramites: "Modo EXPERTO TRAMITES: ayuda a crear, seguir y resolver tramites. Identifica tramites pendientes, sugiere prioridades y acciones.",
    atencion_clientes: "Modo EXPERTO ATENCION CLIENTES: ayuda con comunicacion con asegurados, mensajes WhatsApp, correos. Sugiere respuestas y flujos de atencion.",
    automatizacion: "Modo EXPERTO AUTOMATIZACION: explica flujos automaticos, notificaciones, integraciones. Sugiere como automatizar procesos repetitivos.",
    documentos: "Modo EXPERTO DOCUMENTOS: ayuda con organizacion de archivos, expedientes, importaciones. Orienta sobre el Centro Digital.",
    investigacion: "Modo EXPERTO INVESTIGACION: busca informacion en la base de conocimiento, legislacion, normativa CNSF, estadisticas del mercado.",
  };

  const lines = [`Especialista primario: ${primario.toUpperCase()}`];
  const guia = guideMap[primario] || "Modo GENERAL: responde con criterio experto en seguros.";
  lines.push(guia);

  const secundarios = activados.filter(a => a !== primario);
  if (secundarios.length > 0) {
    lines.push(`Especialistas secundarios activos: ${secundarios.join(", ")} — integra su perspectiva cuando sea relevante.`);
  }

  return lines.join("\n");
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const refId = generateRefId();
  const audit = new AuditLogger(refId);

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

    const { data: usuario } = await supabase
      .from("usuarios")
      .select(`id, nombre_completo, nombre_publico, email_laboral, celular_laboral, rol, oficina_id, web_slug, mi_logotipo_url, oficinas(nombre, logo_url, accent_color)`)
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Load config
    const { data: configs } = await supabase.from("chava_configuracion").select("clave, valor");
    const config: Record<string, any> = {};
    for (const c of configs || []) config[c.clave] = c.valor;

    const modeloIA = config.modelo_ia || "gpt-4o-mini";
    const temperatura = parseFloat(config.temperatura) || 0.5;
    const maxTokens = parseInt(config.max_tokens) || 3500;
    const ragEnabled = config.rag_habilitado !== false;
    const similitudMinima = parseFloat(config.rag_similitud_minima) || 0.68;
    const maxFragmentos = parseInt(config.contexto_max_fragmentos) || 6;
    const maxHistorial = parseInt(config.max_historial_mensajes) || 20;

    // Load active specialists for routing
    const { data: specialistsData } = await supabase
      .from("chava_specialists")
      .select("codigo, nombre, descripcion, palabras_clave, modulos_relevantes")
      .eq("activo", true);

    const specialists: Specialist[] = specialistsData || [];
    const routeResult = detectSpecialists(mensaje, ruta || "/chava", specialists);

    const oficina = (usuario.oficinas as any);
    const nombreAgente = usuario.nombre_publico || usuario.nombre_completo || "Agente";
    const oficinaNombre = oficina?.nombre || "";
    const webUrl = usuario.web_slug ? `agentedeseguros.website/${usuario.web_slug}` : "";
    const colorMarca = webPage?.primary_color || oficina?.accent_color || "#0891b2";

    // Load user memory context
    let memoryContext = "";
    try {
      const { data: memories } = await supabase
        .from("chava_memory")
        .select("scope, clave, valor, fuente, updated_at")
        .eq("usuario_id", user.id)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("updated_at", { ascending: false })
        .limit(10);

      if (memories && memories.length > 0) {
        memoryContext = memories.map((m: any) =>
          `[${m.scope}/${m.clave}]: ${JSON.stringify(m.valor)}`
        ).join("\n");
      }
    } catch { /* non-blocking */ }

    // Fetch file contents
    let fileContext = "";
    if (file_paths && file_paths.length > 0) {
      const fileContents: string[] = [];
      for (const fp of file_paths) {
        const content = await fetchFileContent(supabase, fp, openaiKey);
        fileContents.push(content);
      }
      fileContext = `\n\n=== DOCUMENTOS ADJUNTOS (${file_paths.length} archivo(s)) ===\n${fileContents.join("\n\n")}\n=== FIN DE DOCUMENTOS ===\n`;
    }

    // Query SICAS if relevant
    let sicasContext = "";
    if (needsSicasQuery(mensaje)) {
      const sicasStart = Date.now();
      sicasContext = await querySicasContext(supabase, mensaje, {
        id: usuario.id, rol: usuario.rol, oficina_id: usuario.oficina_id,
      }, audit);
      const sicasDuration = Date.now() - sicasStart;
      if (sicasContext) {
        audit.addToolCall({ tool: "consultar_sicas", duration_ms: sicasDuration, output_summary: `${sicasContext.length} chars` });
        await audit.updateToolHealth(supabase, "consultar_sicas", true, sicasDuration);
      }
    }

    // RAG search
    let knowledgeContext = "";
    const fuentesUtilizadas: any[] = [];

    if (ragEnabled) {
      try {
        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: mensaje }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const queryEmbedding = embeddingData.data[0].embedding;

          const { data: cdFragments, error: cdError } = await supabase.rpc("buscar_centro_digital_chunks", {
            query_embedding: queryEmbedding,
            similitud_minima: similitudMinima,
            max_resultados: maxFragmentos,
            solo_externo: false,
          });

          if (!cdError && cdFragments && cdFragments.length > 0) {
            knowledgeContext = "\n\n=== BASE DE CONOCIMIENTO (Centro Digital) ===\n";
            for (const frag of cdFragments) {
              knowledgeContext += `\n[${frag.archivo_nombre}${frag.carpeta_nombre ? ` / ${frag.carpeta_nombre}` : ""}]\n${frag.contenido}\n`;
              fuentesUtilizadas.push({
                documento_id: frag.archivo_id, documento_titulo: frag.archivo_nombre,
                carpeta: frag.carpeta_nombre, similitud: frag.similitud, source: "centro_digital",
              });
            }
            knowledgeContext += "\n=== FIN BASE DE CONOCIMIENTO ===\n";
          } else if (cdError) {
            console.error("buscar_centro_digital_chunks error:", cdError.message);
          }

          if (fuentesUtilizadas.length < 3) {
            const { data: legacyFragments, error: legacyError } = await supabase.rpc("buscar_conocimiento_chava", {
              query_embedding: queryEmbedding,
              similitud_minima: similitudMinima,
              max_resultados: maxFragmentos - fuentesUtilizadas.length,
              usuario_rol: usuario.rol,
            });

            if (!legacyError && legacyFragments && legacyFragments.length > 0) {
              if (!knowledgeContext) knowledgeContext = "\n\n=== BASE DE CONOCIMIENTO ===\n";
              else knowledgeContext = knowledgeContext.replace("\n=== FIN BASE DE CONOCIMIENTO ===\n", "");
              for (const frag of legacyFragments) {
                if (fuentesUtilizadas.some((f: any) => f.documento_titulo === frag.documento_titulo)) continue;
                knowledgeContext += `\n[${frag.documento_titulo}${frag.carpeta_nombre ? ` / ${frag.carpeta_nombre}` : ""}]\n${frag.contenido}\n`;
                fuentesUtilizadas.push({
                  documento_id: frag.documento_id, documento_titulo: frag.documento_titulo,
                  carpeta: frag.carpeta_nombre, similitud: frag.similitud, source: "chava_legacy",
                });
              }
              knowledgeContext += "\n=== FIN BASE DE CONOCIMIENTO ===\n";
            } else if (legacyError) {
              console.error("buscar_conocimiento_chava error:", legacyError.message);
            }
          }
        }
      } catch (ragErr: any) {
        const errMsg = ragErr?.message || String(ragErr);
        console.error("RAG search error:", errMsg);
        audit.addToolCall({ tool: "rag_search", duration_ms: 0, error: errMsg });
      }
    }

    // Build final system prompt
    const systemPrompt = buildSystemPrompt({
      nombreAgente,
      rol: usuario.rol,
      oficinaNombre,
      celular: usuario.celular_laboral || "",
      email: usuario.email_laboral || "",
      webUrl,
      colorMarca,
      primarioEspecialista: routeResult.primario,
      especialistasActivados: routeResult.activados,
      memoryContext,
      fileContext,
      sicasContext,
      knowledgeContext,
    });

    // Get or create conversation
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
          .insert({ usuario_id: user.id, titulo: mensaje.substring(0, 60), es_asistente: true, modulo_origen: modulo || "chava" })
          .select("id").single();
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
    await supabase.from("mensajes_chatgpt").insert({ conversacion_id: convId, rol: "user", contenido: mensaje });

    // Load conversation history
    const { data: history } = await supabase
      .from("mensajes_chatgpt")
      .select("rol, contenido")
      .eq("conversacion_id", convId)
      .order("created_at", { ascending: true })
      .limit(maxHistorial);

    const openaiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (const msg of history || []) {
      if (msg.rol === "user" || msg.rol === "assistant") {
        openaiMessages.push({ role: msg.rol, content: msg.contenido });
      }
    }

    const modelToUse = (file_paths && file_paths.length > 0) ? "gpt-4o" : modeloIA;

    const openaiStart = Date.now();
    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelToUse, messages: openaiMessages, temperature: temperatura, max_tokens: maxTokens }),
    });

    if (!completionResponse.ok) {
      const errText = await completionResponse.text();
      audit.addToolCall({ tool: "openai_completion", duration_ms: Date.now() - openaiStart, error: errText });
      throw Object.assign(new Error(`OpenAI error: ${errText}`), { tipo: "openai" });
    }

    const completionData = await completionResponse.json();
    const assistantResponse = completionData.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";
    const tokensEntrada = completionData.usage?.prompt_tokens || 0;
    const tokensSalida = completionData.usage?.completion_tokens || 0;
    audit.addToolCall({ tool: "openai_completion", duration_ms: Date.now() - openaiStart, output_summary: `${tokensEntrada}in/${tokensSalida}out` });

    // Save assistant response
    const { data: savedMsg } = await supabase
      .from("mensajes_chatgpt")
      .insert({
        conversacion_id: convId, rol: "assistant", contenido: assistantResponse,
        tokens_usados: tokensEntrada + tokensSalida,
      })
      .select("id").single();

    await supabase.from("conversaciones_chatgpt").update({ updated_at: new Date().toISOString() }).eq("id", convId);

    // Log specialist routing (non-blocking)
    try {
      await supabase.from("chava_specialist_routes").insert({
        conversacion_id: convId,
        mensaje_id: savedMsg?.id || null,
        usuario_id: user.id,
        especialistas_activados: routeResult.activados,
        especialista_primario: routeResult.primario,
        confianza_enrutamiento: routeResult.confianza,
        tokens_usados: tokensEntrada + tokensSalida,
        latencia_ms: audit.getElapsed(),
      });
    } catch { /* non-blocking */ }

    // Legacy log (non-blocking)
    try {
      await supabase.from("chava_consultas_log").insert({
        usuario_id: user.id, conversacion_id: convId,
        pregunta: mensaje, respuesta: assistantResponse,
        fuentes_utilizadas: fuentesUtilizadas,
        tokens_entrada: tokensEntrada, tokens_salida: tokensSalida,
        modelo: modelToUse, tiempo_respuesta_ms: audit.getElapsed(),
      });
    } catch { /* non-blocking */ }

    // Knowledge gap detection (non-blocking)
    if (fuentesUtilizadas.length === 0 && mensaje.length > 15) {
      try {
        await supabase.from("chava_knowledge_review_queue").insert({
          tipo: "brecha_conocimiento",
          titulo: `Sin RAG: ${mensaje.substring(0, 80)}`,
          descripcion: `Consulta sin RAG.\nUsuario: ${usuario.nombre_completo} (${usuario.rol})\nModulo: ${modulo || "chava"}\nEspecialista: ${routeResult.primario}\nPregunta: ${mensaje.substring(0, 300)}`,
          plataforma_destino: "movi", frecuencia_consultas: 1,
          origen_conversacion_ids: convId ? [convId] : [],
          estado: "pendiente", prioridad: "baja",
        });
      } catch { /* non-blocking */ }
    }

    // Track sources
    if (sicasContext) {
      fuentesUtilizadas.push({ source: "sicas", documento_titulo: "SICAS (Datos en tiempo real)", similitud: 1.0 });
    }
    if (file_paths && file_paths.length > 0) {
      for (const fp of file_paths) {
        fuentesUtilizadas.push({ source: "documento_adjunto", documento_titulo: fp.split("/").pop() || fp, similitud: 1.0 });
      }
    }

    // Save audit log
    await audit.save(supabase, {
      usuario_id: user.id, conversacion_id: convId,
      modulo: modulo || "chava", ruta: ruta || "/chava",
      pregunta: mensaje, respuesta: assistantResponse,
      fuentes_utilizadas: fuentesUtilizadas,
      tokens_entrada: tokensEntrada, tokens_salida: tokensSalida,
      modelo: modelToUse, tuvo_error: false,
      rol_usuario: usuario.rol, oficina_id: usuario.oficina_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ref_id: refId,
        conversacion_id: convId,
        mensaje_id: savedMsg?.id || null,
        respuesta: assistantResponse,
        mensaje: assistantResponse,
        tokens_usados: tokensEntrada + tokensSalida,
        fuentes: fuentesUtilizadas,
        modo_usado: fuentesUtilizadas.length > 0 ? "rag" : "general",
        tiempo_respuesta_ms: audit.getElapsed(),
        especialista: routeResult.primario,
        especialistas_activados: routeResult.activados,
        confianza_enrutamiento: routeResult.confianza,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errStack = err?.stack || null;
    const errTipo: string = err?.tipo || (
      errMsg.includes("OpenAI") ? "openai" :
      errMsg.includes("fetch") || errMsg.includes("network") ? "network" :
      errMsg.includes("timeout") ? "timeout" : "internal"
    );

    console.error(`[${refId}] Chava query error (${errTipo}):`, errMsg);

    try {
      const errorSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await audit.save(errorSupabase, {
        usuario_id: "unknown", conversacion_id: null,
        modulo: "chava", ruta: "/chava", pregunta: "",
        tuvo_error: true, error_mensaje: errMsg, error_stack: errStack, error_tipo: errTipo,
        rol_usuario: "unknown", oficina_id: null,
      });
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: errMsg, ref_id: refId, error_tipo: errTipo }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
