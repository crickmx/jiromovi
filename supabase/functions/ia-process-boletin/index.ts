import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORIA_ASEGURADORAS_ID = "9cf4a22e-22a4-4b88-8ca1-f90bc2cf265d";

const FALLBACK_BACKGROUNDS = [
  "https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/5849577/pexels-photo-5849577.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/6863183/pexels-photo-6863183.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/7821487/pexels-photo-7821487.jpeg?auto=compress&cs=tinysrgb&w=1200",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada. Se requiere para generar articulos." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      bandeja_id?: string;
      bandeja_ids?: string[];
      limit?: number;
      creado_por?: string;
    };

    const limit = Math.min(body.limit || 5, 10);

    const { data: robot } = await supabase
      .from("ia_robots")
      .select("id")
      .eq("codigo", "comunicados_aseguradoras")
      .single();

    if (!robot) {
      return new Response(JSON.stringify({ error: "Robot comunicados_aseguradoras no encontrado." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let creadoPor = body.creado_por;
    if (!creadoPor) {
      const { data: adminUser } = await supabase
        .from("usuarios")
        .select("id")
        .eq("rol", "Administrador")
        .eq("estado", "activo")
        .is("deleted_at", null)
        .limit(1)
        .single();
      creadoPor = adminUser?.id;
    }

    if (!creadoPor) {
      return new Response(JSON.stringify({ error: "No se encontro un usuario administrador para atribuir la creacion." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all active insurers for matching
    const { data: insurers } = await supabase
      .from("seguwallet_insurers")
      .select("id, name, logo_url, primary_color")
      .eq("is_active", true);

    let query = supabase
      .from("ia_bandeja")
      .select("id, asunto, remitente, cuerpo_texto, cuerpo_html, adjuntos, fecha_correo")
      .eq("robot_id", robot.id)
      .eq("estado_procesamiento", "completado")
      .is("comunicado_borrador_id", null)
      .order("fecha_correo", { ascending: false })
      .limit(limit);

    if (body.bandeja_id) {
      query = supabase
        .from("ia_bandeja")
        .select("id, asunto, remitente, cuerpo_texto, cuerpo_html, adjuntos, fecha_correo")
        .eq("id", body.bandeja_id)
        .is("comunicado_borrador_id", null);
    } else if (body.bandeja_ids && body.bandeja_ids.length > 0) {
      query = supabase
        .from("ia_bandeja")
        .select("id, asunto, remitente, cuerpo_texto, cuerpo_html, adjuntos, fecha_correo")
        .in("id", body.bandeja_ids)
        .is("comunicado_borrador_id", null);
    }

    const { data: emails, error: emailErr } = await query;
    if (emailErr) {
      return new Response(JSON.stringify({ error: "Error obteniendo emails.", detail: emailErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No hay boletines pendientes de procesar.", processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { bandeja_id: string; comunicado_id: string; titulo: string; success: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        const matchedInsurer = matchInsurer(email.remitente, email.asunto, insurers || []);
        const article = await generateArticle(openaiKey, email, matchedInsurer?.name || "");

        const imageUrl = await generateBrandedThumbnail(
          openaiKey,
          article,
          matchedInsurer,
          supabase,
        );

        const { data: comunicado, error: insertErr } = await supabase
          .from("comunicados_publicaciones")
          .insert({
            titulo: article.titulo,
            contenido_html: article.contenido_html,
            imagen_principal: imageUrl,
            categoria_id: CATEGORIA_ASEGURADORAS_ID,
            publicado: false,
            fijado: false,
            creado_por: creadoPor,
          })
          .select("id")
          .single();

        if (insertErr || !comunicado) {
          throw new Error(`Error creando comunicado: ${insertErr?.message || "sin datos"}`);
        }

        await supabase.from("comunicados_visibilidad").insert({
          comunicado_id: comunicado.id,
          para_todos: true,
        });

        let adjuntosVinculados = 0;
        if (email.adjuntos && Array.isArray(email.adjuntos) && email.adjuntos.length > 0) {
          for (const adj of email.adjuntos) {
            const archivoUrl = adj.url || adj.archivo_url || adj.storage_path;
            if (archivoUrl) {
              await supabase.from("comunicados_adjuntos").insert({
                comunicado_id: comunicado.id,
                archivo_url: archivoUrl,
                nombre_archivo: adj.nombre || adj.filename || adj.name || "adjunto",
                tamanio_bytes: adj.size || adj.tamanio || adj.tamanio_bytes || 0,
                tipo_mime: adj.mime || adj.tipo_mime || adj.content_type || "application/octet-stream",
              });
              adjuntosVinculados++;
            }
          }
        }

        await supabase
          .from("ia_bandeja")
          .update({
            comunicado_borrador_id: comunicado.id,
            resultado: {
              tipo: "comunicado_generado",
              comunicado_id: comunicado.id,
              titulo: article.titulo,
              resumen: article.resumen,
              generated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        await supabase.from("ia_bitacora").insert({
          correo_id: email.id,
          robot_id: robot.id,
          accion: "generar_comunicado",
          detalle: {
            comunicado_id: comunicado.id,
            titulo: article.titulo,
            imagen_generada: true,
            imagen_url: imageUrl,
            adjuntos_vinculados: adjuntosVinculados,
            aseguradora: matchedInsurer?.name || "desconocida",
          },
          estado: "exito",
          comunicados_creados: 1,
        });

        results.push({
          bandeja_id: email.id,
          comunicado_id: comunicado.id,
          titulo: article.titulo,
          success: true,
        });

      } catch (err: any) {
        console.error(`Error processing email ${email.id}:`, err.message);

        await supabase.from("ia_bitacora").insert({
          correo_id: email.id,
          robot_id: robot.id,
          accion: "generar_comunicado",
          detalle: { error: err.message },
          estado: "error",
          error_mensaje: err.message,
        });

        results.push({
          bandeja_id: email.id,
          comunicado_id: "",
          titulo: email.asunto || "",
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      comunicados_creados: successCount,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("ia-process-boletin error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Types ---

interface ArticleResult {
  titulo: string;
  resumen: string;
  contenido_html: string;
  imagen_prompt: string;
  categoria: string;
}

interface InsurerMatch {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
}

// --- Insurer Matching ---

function matchInsurer(
  remitente: string,
  asunto: string,
  insurers: { id: string; name: string; logo_url: string | null; primary_color: string | null }[],
): InsurerMatch | null {
  const searchText = `${remitente} ${asunto}`.toLowerCase();

  for (const insurer of insurers) {
    const nameParts = insurer.name.toLowerCase().split(/\s+/);
    const mainName = nameParts[0];
    if (mainName.length >= 3 && searchText.includes(mainName)) {
      return insurer;
    }
    if (searchText.includes(insurer.name.toLowerCase())) {
      return insurer;
    }
  }

  const commonAliases: Record<string, string> = {
    "gnp": "GNP",
    "qualitas": "Qualitas",
    "quálitas": "Qualitas",
    "hdi": "HDI",
    "mapfre": "Mapfre",
    "zurich": "Zurich",
    "chubb": "Chubb",
    "allianz": "Allianz",
    "atlas": "Atlas",
    "inbursa": "Inbursa",
    "afirme": "Afirme",
    "metlife": "Metlife",
    "bupa": "Bupa",
    "sura": "SURA",
    "axa": "AXA",
    "banorte": "Banorte",
  };

  for (const [alias, name] of Object.entries(commonAliases)) {
    if (searchText.includes(alias)) {
      const found = insurers.find(i => i.name.toLowerCase().includes(alias));
      if (found) return found;
      return { id: "", name, logo_url: null, primary_color: null };
    }
  }

  return null;
}

// --- Article Generation ---

async function generateArticle(
  apiKey: string,
  email: { asunto: string; remitente: string; cuerpo_texto: string | null; cuerpo_html: string | null },
  insurerName: string,
): Promise<ArticleResult> {
  const emailContent = email.cuerpo_texto || stripHtml(email.cuerpo_html || "");
  const truncatedContent = emailContent.substring(0, 5000);

  const prompt = `Eres un editor senior de una agencia de seguros en Mexico. Tu trabajo es transformar boletines y comunicados de aseguradoras en ARTICULOS PERIODISTICOS claros y faciles de leer para los agentes de seguros de la oficina.

IMPORTANTE: El resultado debe leerse como un ARTICULO DE BLOG/REVISTA que EXPLICA el comunicado recibido, no como una copia del email original. Los agentes deben poder entender rapidamente de que se trata y que deben hacer.

EMAIL ORIGINAL:
- Aseguradora/Remitente: ${insurerName || email.remitente}
- Asunto: ${email.asunto}
- Contenido: ${truncatedContent}

FORMATO DEL ARTICULO:
1. TITULO: Atractivo, informativo, maximo 80 caracteres. Debe comunicar la noticia principal.
2. RESUMEN: 1-2 oraciones que resuman lo esencial (para vista previa).
3. CATEGORIA: Una palabra/frase corta que categorice el tema (ej: "Productos", "Siniestros", "Comisiones", "Capacitacion", "Normativa", "Tecnologia", "Cobranza", "Beneficios").
4. CONTENIDO HTML: Articulo estructurado asi:
   - <p> de CONTEXTO: Explica brevemente quien envia y por que
   - <h3> con los PUNTOS PRINCIPALES del comunicado, usando <ul><li> para detallar cada uno
   - Si hay FECHAS LIMITE o VIGENCIAS, destacarlas con <strong>
   - <h3> "Que significa para ti como agente" - explicar el impacto practico
   - Si hay ACCIONES REQUERIDAS, listarlas claramente
   - <p> de CIERRE con recomendacion o siguiente paso
5. IMAGEN_PROMPT: Prompt en ingles para una ilustracion abstracta/conceptual del tema (NO texto, NO logos, solo visual temático). Ejemplo: "Abstract geometric composition representing insurance protection, shield shapes, blue gradient, modern corporate art style"

ESTILO DE REDACCION:
- Escribe como periodista, NO copies el email tal cual
- Explica terminos tecnicos si los hay
- Usa parrafos cortos (max 3 oraciones)
- Tono: profesional, directo, util
- Si el email tiene informacion confusa, sintetiza lo importante
- NO inventes informacion que no este en el email

HTML PERMITIDO: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <blockquote>
NO usar: <h1>, <table>, <div>, <span>, <img>

Responde SOLO con JSON valido:
{
  "titulo": "string (max 80 chars)",
  "resumen": "string (1-2 oraciones)",
  "categoria": "string (1-2 palabras)",
  "contenido_html": "string (HTML del articulo completo)",
  "imagen_prompt": "string (en ingles, visual abstracto, sin texto ni logos)"
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "";

  const parsed = JSON.parse(content);
  if (!parsed.titulo || !parsed.contenido_html) {
    throw new Error("Respuesta de OpenAI incompleta: falta titulo o contenido_html");
  }

  return {
    titulo: parsed.titulo.substring(0, 200),
    resumen: parsed.resumen || "",
    contenido_html: parsed.contenido_html,
    imagen_prompt: parsed.imagen_prompt || "Abstract professional insurance concept, geometric shapes, blue tones, modern corporate art",
    categoria: parsed.categoria || "Seguros",
  };
}

// --- Branded Thumbnail Generation ---

async function generateBrandedThumbnail(
  apiKey: string,
  article: ArticleResult,
  insurer: InsurerMatch | null,
  supabase: any,
): Promise<string> {
  try {
    // Step 1: Generate background illustration with DALL-E
    const bgImageUrl = await generateBackgroundImage(apiKey, article.imagen_prompt);

    // Step 2: Fetch the background image as base64
    const bgBase64 = await fetchImageAsBase64(bgImageUrl);

    // Step 3: Fetch insurer logo as base64 (if available)
    let logoBase64: string | null = null;
    if (insurer?.logo_url) {
      logoBase64 = await fetchImageAsBase64(insurer.logo_url).catch(() => null);
    }

    // Step 4: Create SVG composite image
    const brandColor = insurer?.primary_color || "#1a365d";
    const today = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const svgImage = buildCompositeSVG({
      bgBase64,
      logoBase64,
      title: article.titulo,
      category: article.categoria,
      date: today,
      insurerName: insurer?.name || "",
      brandColor,
    });

    // Step 5: Upload SVG (rendered as image) to storage
    const filename = `ia-boletin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.svg`;
    const storagePath = `imagenes/${filename}`;

    const svgBuffer = new TextEncoder().encode(svgImage);

    const { error: uploadErr } = await supabase.storage
      .from("comunicados")
      .upload(storagePath, svgBuffer, {
        contentType: "image/svg+xml",
        upsert: false,
      });

    if (uploadErr) {
      console.error("SVG upload error:", uploadErr.message);
      return getRandomFallbackImage();
    }

    const { data: publicUrl } = supabase.storage
      .from("comunicados")
      .getPublicUrl(storagePath);

    return publicUrl?.publicUrl || getRandomFallbackImage();

  } catch (err: any) {
    console.error("Branded thumbnail generation error:", err.message);
    return getRandomFallbackImage();
  }
}

async function generateBackgroundImage(apiKey: string, imagePrompt: string): Promise<string> {
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Create an abstract, artistic background illustration for a professional insurance article cover. ${imagePrompt}. Style: soft gradients, geometric shapes, modern corporate art. NO text, NO letters, NO words, NO logos, NO people faces. Clean abstract composition. Wide landscape format, soft colors suitable as a background with overlay text.`,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("DALL-E background error:", response.status, errBody.substring(0, 100));
      return getRandomFallbackImage();
    }

    const data = await response.json();
    return data.data?.[0]?.url || getRandomFallbackImage();
  } catch {
    return getRandomFallbackImage();
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${contentType};base64,${base64}`;
}

interface CompositeSVGParams {
  bgBase64: string;
  logoBase64: string | null;
  title: string;
  category: string;
  date: string;
  insurerName: string;
  brandColor: string;
}

function buildCompositeSVG(params: CompositeSVGParams): string {
  const { bgBase64, logoBase64, title, category, date, insurerName, brandColor } = params;

  const truncatedTitle = title.length > 70 ? title.substring(0, 67) + "..." : title;
  const titleLines = wrapText(truncatedTitle, 35);
  const escapedTitle = titleLines.map(l => escapeXml(l));
  const escapedCategory = escapeXml(category);
  const escapedDate = escapeXml(date);
  const escapedInsurer = escapeXml(insurerName);

  const titleY = 520;
  const lineHeight = 52;

  const logoSection = logoBase64
    ? `<image href="${logoBase64}" x="60" y="40" width="180" height="80" preserveAspectRatio="xMinYMid meet" />`
    : "";

  const insurerBadge = insurerName
    ? `<rect x="60" y="135" width="${Math.min(insurerName.length * 12 + 40, 300)}" height="36" rx="18" fill="${brandColor}" opacity="0.9"/>
       <text x="80" y="159" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="bold" fill="white">${escapedInsurer}</text>`
    : "";

  const titleTspans = escapedTitle
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${brandColor}" stop-opacity="0.3"/>
      <stop offset="40%" stop-color="${brandColor}" stop-opacity="0.1"/>
      <stop offset="65%" stop-color="#000000" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${brandColor}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${brandColor}" stop-opacity="0.7"/>
    </linearGradient>
  </defs>

  <!-- Background Image -->
  <image href="${bgBase64}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>

  <!-- Gradient Overlay -->
  <rect width="1200" height="630" fill="url(#overlay)"/>

  <!-- Top Header Bar -->
  <rect x="0" y="0" width="1200" height="6" fill="${brandColor}"/>

  <!-- Logo -->
  ${logoSection}

  <!-- Insurer Badge -->
  ${insurerBadge}

  <!-- Category Badge -->
  <rect x="60" y="${titleY - 50}" width="${Math.min(category.length * 11 + 30, 250)}" height="32" rx="16" fill="white" opacity="0.95"/>
  <text x="75" y="${titleY - 28}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="${brandColor}" letter-spacing="1">${escapedCategory.toUpperCase()}</text>

  <!-- Title -->
  <text x="60" y="${titleY}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" fill="white" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
    ${titleTspans}
  </text>

  <!-- Date -->
  <text x="60" y="${titleY + titleLines.length * lineHeight + 20}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="rgba(255,255,255,0.8)">${escapedDate}</text>

  <!-- Bottom accent line -->
  <rect x="60" y="600" width="200" height="4" rx="2" fill="white" opacity="0.6"/>
</svg>`;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.slice(0, 3);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getRandomFallbackImage(): string {
  return FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
