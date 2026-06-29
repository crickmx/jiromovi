import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORIA_ASEGURADORAS_ID = "9cf4a22e-22a4-4b88-8ca1-f90bc2cf265d";

const FALLBACK_IMAGES = [
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
        const article = await generateArticle(openaiKey, email);
        const imageUrl = await generateThumbnail(openaiKey, article.titulo, article.imagen_prompt, supabase);

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
            imagen_generada: !imageUrl.includes("pexels.com"),
            imagen_url: imageUrl,
            adjuntos_vinculados: adjuntosVinculados,
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

interface ArticleResult {
  titulo: string;
  resumen: string;
  contenido_html: string;
  imagen_prompt: string;
}

async function generateArticle(
  apiKey: string,
  email: { asunto: string; remitente: string; cuerpo_texto: string | null; cuerpo_html: string | null },
): Promise<ArticleResult> {
  const emailContent = email.cuerpo_texto || stripHtml(email.cuerpo_html || "");
  const truncatedContent = emailContent.substring(0, 5000);

  const insurerName = extractInsurerName(email.remitente, email.asunto);

  const prompt = `Eres un editor senior de una agencia de seguros en Mexico. Tu trabajo es transformar boletines y comunicados de aseguradoras en ARTICULOS PERIODISTICOS claros y faciles de leer para los agentes de seguros de la oficina.

IMPORTANTE: El resultado debe leerse como un ARTICULO DE BLOG/REVISTA que EXPLICA el comunicado recibido, no como una copia del email original. Los agentes deben poder entender rapidamente de que se trata y que deben hacer.

EMAIL ORIGINAL:
- Aseguradora/Remitente: ${insurerName || email.remitente}
- Asunto: ${email.asunto}
- Contenido: ${truncatedContent}

FORMATO DEL ARTICULO:
1. TITULO: Atractivo, informativo, maximo 80 caracteres. Debe comunicar la noticia principal.
2. RESUMEN: 1-2 oraciones que resuman lo esencial (para vista previa).
3. CONTENIDO HTML: Articulo estructurado asi:
   - <p> de CONTEXTO: Explica brevemente quien envia y por que (ej: "GNP Seguros ha emitido un comunicado importante para sus agentes...")
   - <h3> con los PUNTOS PRINCIPALES del comunicado, usando <ul><li> para detallar cada uno
   - Si hay FECHAS LIMITE o VIGENCIAS, destacarlas con <strong>
   - <h3> "Que significa para ti como agente" - explicar el impacto practico
   - Si hay ACCIONES REQUERIDAS, listarlas claramente
   - <p> de CIERRE con recomendacion o siguiente paso

4. IMAGEN_PROMPT: Prompt en ingles para generar una imagen de portada profesional relacionada al tema del articulo.

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
  "contenido_html": "string (HTML del articulo completo)",
  "imagen_prompt": "string (en ingles, descriptivo, para imagen landscape 1792x1024)"
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
    imagen_prompt: parsed.imagen_prompt || "Professional insurance newsletter cover, corporate office scene with documents and handshake, blue and white tones, modern minimalist style",
  };
}

async function generateThumbnail(
  apiKey: string,
  titulo: string,
  imagePrompt: string,
  supabase: any,
): Promise<string> {
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Create a professional magazine-style cover image for an insurance industry article. ${imagePrompt}. The image should be visually striking with corporate tones (deep blue, teal, white). Include abstract visual elements that represent the insurance/financial sector. NO text, NO letters, NO words, NO logos in the image. Clean, modern, editorial photography style. Wide landscape format.`,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("DALL-E error:", response.status, errBody.substring(0, 100));
      return getRandomFallbackImage();
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return getRandomFallbackImage();

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) return getRandomFallbackImage();

    const imgBuffer = await imgResponse.arrayBuffer();
    const filename = `ia-boletin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const storagePath = `imagenes/${filename}`;

    const { error: uploadErr } = await supabase.storage
      .from("comunicados")
      .upload(storagePath, imgBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr.message);
      return getRandomFallbackImage();
    }

    const { data: publicUrl } = supabase.storage
      .from("comunicados")
      .getPublicUrl(storagePath);

    return publicUrl?.publicUrl || getRandomFallbackImage();

  } catch (err: any) {
    console.error("Thumbnail generation error:", err.message);
    return getRandomFallbackImage();
  }
}

function getRandomFallbackImage(): string {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

function extractInsurerName(remitente: string, asunto: string): string {
  const insurers = [
    "GNP", "AXA", "Qualitas", "Quálitas", "HDI", "Mapfre", "Zurich",
    "Chubb", "Allianz", "Atlas", "Inbursa", "Afirme", "Plan Seguro",
    "Latino Seguros", "BX+", "Banorte", "Metlife", "General de Seguros",
    "ANA Seguros", "Seguros Monterrey", "Bupa", "SURA",
  ];
  const searchText = `${remitente} ${asunto}`;
  for (const ins of insurers) {
    if (searchText.toLowerCase().includes(ins.toLowerCase())) return ins;
  }
  return "";
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
