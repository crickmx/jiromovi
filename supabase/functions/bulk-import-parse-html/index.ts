import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DOMParser } from "npm:linkedom@0.16.11";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DOWNLOADABLE_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "csv", "txt", "rtf", "odt", "ods", "odp", "zip", "rar",
  "jpg", "jpeg", "png", "gif", "svg", "webp", "tiff",
  "mp4", "mp3", "wav", "avi", "mov",
]);

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  rtf: "application/rtf",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};

interface ParsedCard {
  titulo: string;
  aseguradora: string | null;
  descripcion: string | null;
  categoria: string | null;
  ramo: string | null;
  tags: string[];
  enlaces: ParsedLink[];
}

interface ParsedLink {
  url: string;
  texto: string;
  extension: string | null;
  es_descargable: boolean;
  nombre_archivo: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario || usuario.rol !== "Administrador") {
      return new Response(
        JSON.stringify({ error: "Solo administradores pueden ejecutar importaciones masivas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const htmlFile = formData.get("html_file") as File | null;
    const titulo = (formData.get("titulo") as string) || "Importación Masiva";
    const carpetaDestinoId = formData.get("carpeta_destino_id") as string | null;

    if (!htmlFile) {
      return new Response(
        JSON.stringify({ error: "Se requiere un archivo HTML" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlContent = await htmlFile.text();

    // Create the import job
    const { data: job, error: jobError } = await supabase
      .from("bulk_import_jobs")
      .insert({
        titulo,
        estado: "parsing",
        archivo_html_nombre: htmlFile.name,
        carpeta_destino_id: carpetaDestinoId || null,
        iniciado_por: user.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: `Error al crear job: ${jobError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse HTML
    const cards = parseHtmlCards(htmlContent);
    const allItems: any[] = [];
    let totalDescargables = 0;
    let totalNoDescargables = 0;

    for (const card of cards) {
      for (const enlace of card.enlaces) {
        const item = {
          job_id: job.id,
          titulo: enlace.texto || card.titulo,
          url_original: enlace.url,
          aseguradora: card.aseguradora,
          categoria: card.categoria,
          ramo: card.ramo,
          descripcion: card.descripcion,
          tags: card.tags,
          estado: enlace.es_descargable ? "pending" : "skipped",
          es_descargable: enlace.es_descargable,
          tipo_mime_detectado: enlace.extension ? (MIME_MAP[enlace.extension] || null) : null,
          nombre_archivo_original: enlace.nombre_archivo,
          extension: enlace.extension,
        };

        allItems.push(item);

        if (enlace.es_descargable) {
          totalDescargables++;
        } else {
          totalNoDescargables++;
        }
      }
    }

    // Check for duplicates against existing items in other jobs
    const urls = allItems.filter(i => i.es_descargable).map(i => i.url_original);
    const { data: existingItems } = await supabase
      .from("bulk_import_items")
      .select("url_original")
      .in("url_original", urls.slice(0, 500))
      .in("estado", ["downloaded", "stored", "indexed"]);

    const existingUrls = new Set((existingItems || []).map(i => i.url_original));

    // Also check digital_center_documents for url_original matches
    const { data: existingDocs } = await supabase
      .from("digital_center_documents")
      .select("url_original")
      .in("url_original", urls.slice(0, 500))
      .eq("activo", true);

    const existingDocUrls = new Set((existingDocs || []).map(d => d.url_original));

    let totalDuplicados = 0;
    for (const item of allItems) {
      if (item.es_descargable && (existingUrls.has(item.url_original) || existingDocUrls.has(item.url_original))) {
        item.estado = "duplicate";
        totalDuplicados++;
        totalDescargables--;
      }
    }

    // Insert items in batches of 100
    for (let i = 0; i < allItems.length; i += 100) {
      const batch = allItems.slice(i, i + 100);
      await supabase.from("bulk_import_items").insert(batch);
    }

    // Update job stats
    await supabase
      .from("bulk_import_jobs")
      .update({
        estado: "pending",
        total_links_encontrados: allItems.length,
        total_descargables: totalDescargables,
        total_no_descargables: totalNoDescargables,
        total_duplicados: totalDuplicados,
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        stats: {
          total_cards: cards.length,
          total_links: allItems.length,
          descargables: totalDescargables,
          no_descargables: totalNoDescargables,
          duplicados: totalDuplicados,
          aseguradoras: [...new Set(cards.map(c => c.aseguradora).filter(Boolean))],
          categorias: [...new Set(cards.map(c => c.categoria).filter(Boolean))],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bulk-import-parse-html error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseHtmlCards(html: string): ParsedCard[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const cards: ParsedCard[] = [];

  // Strategy 1: Look for .card elements
  let cardElements = doc.querySelectorAll(".card");

  // Strategy 2: If no .card elements, look for common container patterns
  if (!cardElements || cardElements.length === 0) {
    cardElements = doc.querySelectorAll("[class*='card'], [class*='item'], article, .document, .recurso");
  }

  // Strategy 3: If still nothing, look for structured link lists
  if (!cardElements || cardElements.length === 0) {
    return parseLinksFromDocument(doc);
  }

  for (const card of cardElements) {
    const parsed = parseCard(card);
    if (parsed && parsed.enlaces.length > 0) {
      cards.push(parsed);
    }
  }

  return cards;
}

function parseCard(cardEl: any): ParsedCard | null {
  // Extract title
  const titleEl = cardEl.querySelector("h2, h3, h4, .card-title, .titulo, [class*='title']");
  const titulo = titleEl?.textContent?.trim() || cardEl.querySelector("strong, b")?.textContent?.trim() || "Sin título";

  // Extract aseguradora
  const asegEl = cardEl.querySelector(".card-aseg, .aseguradora, [class*='aseg'], [class*='insurer']");
  const aseguradora = asegEl?.textContent?.trim() || detectInsurerFromContent(cardEl.textContent || "");

  // Extract description
  const descEl = cardEl.querySelector("p, .description, .descripcion, [class*='desc']");
  const descripcion = descEl?.textContent?.trim() || null;

  // Extract category
  const catEl = cardEl.querySelector(".categoria, .category, [class*='categ']");
  const categoria = catEl?.textContent?.trim() || detectCategoryFromContent(cardEl.textContent || "");

  // Extract ramo
  const ramoEl = cardEl.querySelector(".ramo, [class*='ramo'], [class*='line']");
  const ramo = ramoEl?.textContent?.trim() || detectRamoFromContent(cardEl.textContent || "");

  // Extract tags
  const tagEls = cardEl.querySelectorAll(".tag, .badge, [class*='tag'], [class*='keyword']");
  const tags: string[] = [];
  for (const t of tagEls) {
    const text = t.textContent?.trim();
    if (text) tags.push(text);
  }

  // Extract links
  const linkEls = cardEl.querySelectorAll("a[href]");
  const enlaces: ParsedLink[] = [];

  for (const link of linkEls) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;

    const url = normalizeUrl(href);
    if (!url) continue;

    const texto = link.textContent?.trim() || "";
    const extension = getExtensionFromUrl(url);
    const es_descargable = isDownloadableUrl(url, extension);
    const nombre_archivo = extractFilenameFromUrl(url);

    enlaces.push({ url, texto, extension, es_descargable, nombre_archivo });
  }

  if (enlaces.length === 0) return null;

  return { titulo, aseguradora, descripcion, categoria, ramo, tags, enlaces };
}

function parseLinksFromDocument(doc: any): ParsedCard[] {
  const links = doc.querySelectorAll("a[href]");
  const items: ParsedLink[] = [];

  for (const link of links) {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;

    const url = normalizeUrl(href);
    if (!url) continue;

    const texto = link.textContent?.trim() || "";
    const extension = getExtensionFromUrl(url);
    const es_descargable = isDownloadableUrl(url, extension);
    const nombre_archivo = extractFilenameFromUrl(url);

    items.push({ url, texto, extension, es_descargable, nombre_archivo });
  }

  if (items.length === 0) return [];

  return [{
    titulo: "Documentos del HTML",
    aseguradora: null,
    descripcion: null,
    categoria: null,
    ramo: null,
    tags: [],
    enlaces: items,
  }];
}

function normalizeUrl(href: string): string | null {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    if (href.startsWith("//")) {
      return "https:" + href;
    }
    return null;
  } catch {
    return null;
  }
}

function getExtensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop() || "";
    const dotIndex = lastSegment.lastIndexOf(".");
    if (dotIndex === -1) return null;
    return lastSegment.substring(dotIndex + 1).toLowerCase().split("?")[0];
  } catch {
    return null;
  }
}

function isDownloadableUrl(url: string, extension: string | null): boolean {
  if (extension && DOWNLOADABLE_EXTENSIONS.has(extension)) {
    return true;
  }
  // Check URL patterns that indicate downloadable content
  const downloadPatterns = [
    /\/download\//i, /\/descargar\//i, /\/files\//i,
    /\/documentos?\//i, /\/uploads?\//i, /\/assets?\//i,
    /\/content\/dam\//i, /\/wp-content\/uploads/i,
    /\?.*download/i, /\/storage\//i,
  ];
  return downloadPatterns.some(p => p.test(url));
}

function extractFilenameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop();
    if (lastSegment && lastSegment.includes(".")) {
      return decodeURIComponent(lastSegment);
    }
    return null;
  } catch {
    return null;
  }
}

function detectInsurerFromContent(text: string): string | null {
  const insurers = [
    "GNP", "CHUBB", "AXA", "Allianz", "MAPFRE", "ANA Seguros", "ANA",
    "Inbursa", "BUPA", "BX+", "Qualitas", "Afirme", "Zurich", "Atlas",
    "Metlife", "Seguros Monterrey", "HDI", "Banorte", "General de Seguros",
    "CNSF", "AMIS", "Protección Mutua",
  ];
  const upper = text.toUpperCase();
  for (const ins of insurers) {
    if (upper.includes(ins.toUpperCase())) return ins;
  }
  return null;
}

function detectCategoryFromContent(text: string): string | null {
  const categories: Record<string, string[]> = {
    "Condiciones Generales": ["condiciones generales", "cg ", "condiciones"],
    "Beneficios": ["beneficios", "tabla de beneficios"],
    "Tarifas": ["tarifa", "pricing", "cotizacion"],
    "Formularios": ["formulario", "solicitud", "forma"],
    "Capacitación": ["capacitacion", "training", "curso", "guia"],
    "Comparativos": ["comparativo", "versus", "vs "],
    "Legal": ["legal", "reglamento", "ley", "normativa", "circular"],
    "Operaciones": ["operacion", "proceso", "manual de"],
  };
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return null;
}

function detectRamoFromContent(text: string): string | null {
  const ramos: Record<string, string[]> = {
    "GMM": ["gmm", "gastos medicos", "gastos médicos", "salud"],
    "Vida": ["vida", "life"],
    "Autos": ["auto", "vehiculo", "vehículo", "automovil"],
    "Daños": ["daño", "dano", "hogar", "casa", "incendio"],
    "Empresarial": ["empresa", "negocio", "pyme", "comercial"],
    "Accidentes Personales": ["accidente", "ap "],
    "Fianzas": ["fianza"],
    "Agropecuario": ["agropecuario", "agricola", "agrícola"],
    "Responsabilidad Civil": ["responsabilidad civil", "rc "],
    "Transporte": ["transporte", "carga", "mercancia"],
  };
  const lower = text.toLowerCase();
  for (const [ramo, keywords] of Object.entries(ramos)) {
    if (keywords.some(k => lower.includes(k))) return ramo;
  }
  return null;
}
