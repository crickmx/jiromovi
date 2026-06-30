import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Clean editorial photos (no text visible, topic-appropriate for insurance industry)
const FALLBACK_BACKGROUNDS = [
  "https://images.pexels.com/photos/1118448/pexels-photo-1118448.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/120049/pexels-photo-120049.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/1643383/pexels-photo-1643383.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "https://images.pexels.com/photos/323705/pexels-photo-323705.jpeg?auto=compress&cs=tinysrgb&w=1200",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY no configurada." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      raw_text?: string;
      titulo_sugerido?: string;
    };

    const rawText = body.raw_text || "";

    if (!rawText.trim()) {
      return new Response(JSON.stringify({ error: "Debes proporcionar texto para procesar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate article with GPT-4o
    const article = await generateArticle(openaiKey, rawText, body.titulo_sugerido);

    // Generate featured image with DALL-E 3 and upload to storage
    let imageUrl = FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];
    try {
      const dalleUrl = await generateImage(openaiKey, article);
      // Upload DALL-E image to Supabase storage for permanent URL
      const storedUrl = await uploadImageToStorage(dalleUrl);
      if (storedUrl) {
        imageUrl = storedUrl;
      } else {
        imageUrl = dalleUrl;
      }
    } catch (imgErr: any) {
      console.error("Error generating image, using fallback:", imgErr.message);
    }

    return new Response(JSON.stringify({
      success: true,
      titulo: article.titulo,
      contenido_html: article.contenido_html,
      imagen_url: imageUrl,
      bajada: article.bajada,
      resumen_ejecutivo: article.resumen_ejecutivo,
      puntos_clave: article.puntos_clave,
      tiempo_lectura: article.tiempo_lectura,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("ia-process-document error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Types ---

interface ArticleResult {
  titulo: string;
  bajada: string;
  resumen_ejecutivo: string;
  contenido_html: string;
  puntos_clave: string[];
  imagen_destacada_descripcion: string;
  tiempo_lectura: string;
}

// --- Upload image to Supabase Storage ---

async function uploadImageToStorage(imageUrl: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase env vars for storage upload");
      return null;
    }

    // Download the image
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
      console.error("Failed to download image:", resp.status);
      return null;
    }

    const imageBlob = await resp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const fileName = `ia-covers/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;

    const { error: uploadError } = await supabase.storage
      .from("comunicados")
      .upload(fileName, uint8, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("comunicados")
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (err: any) {
    console.error("uploadImageToStorage error:", err.message);
    return null;
  }
}

// --- Article Generation ---

async function generateArticle(
  apiKey: string,
  content: string,
  tituloSugerido?: string,
): Promise<ArticleResult> {
  const truncatedContent = content.substring(0, 14000);

  const systemPrompt = `Eres un Editor Ejecutivo y Redactor Institucional Senior de MOVI Digital. Transformas documentos corporativos, boletines, circulares y comunicados en articulos claros, profesionales y faciles de comprender.

Tu objetivo: convertir informacion tecnica o institucional en contenido periodistico de alta calidad, manteniendo absoluta fidelidad a la informacion original.

PROCESO EDITORIAL:
1. Analiza el contenido proporcionado
2. Identifica la informacion clave
3. Redacta un articulo profesional que explique el contenido de forma amigable

ESTILO:
- Profesional, claro, elegante, cercano, facil de leer
- Evita lenguaje burocratico y frases legales innecesarias
- Traduce tecnicismos a lenguaje sencillo
- Tono como un medio de comunicacion corporativo moderno

ESTRUCTURA del contenido_html:
- Bajada introductoria (primer parrafo que resume)
- Desarrollo organizado con subtitulos <h3>
- Puntos clave como bloque de bullets
- Informacion practica (fechas, contactos, pasos)
- Seccion "Impacto para el agente" (si aplica)
- Seccion "Acciones requeridas" (si aplica)

HTML PERMITIDO: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <blockquote>
NO usar: <h1>, <table>, <div>, <span>, <img>

LONGITUD:
- Contenido corto: 500-800 palabras
- Contenido medio: 800-1200 palabras
- Contenido extenso: 1200-2500 palabras

EXACTITUD: NO inventar datos. Si algo no esta en el contenido original, no lo incluyas.`;

  const userPrompt = `CONTENIDO A TRANSFORMAR EN ARTICULO:

${tituloSugerido ? `Titulo sugerido por el usuario: ${tituloSugerido}` : ""}

CONTENIDO:
${truncatedContent}

---

Responde UNICAMENTE con un objeto JSON valido:
{
  "titulo": "string - Titulo atractivo, max 100 caracteres. ${tituloSugerido ? "Puedes basarte en la sugerencia del usuario." : ""}",
  "bajada": "string - Resumen en 2-3 oraciones.",
  "resumen_ejecutivo": "string - Resumen ejecutivo de 3-5 oraciones.",
  "contenido_html": "string - Articulo COMPLETO en HTML con la estructura editorial indicada.",
  "puntos_clave": ["array de 3-8 puntos clave"],
  "imagen_destacada_descripcion": "string - Scene description in English for an AI image generator. Describe a SPECIFIC PHOTOGRAPHIC SCENE with OBJECTS or ENVIRONMENTS only — NO people, NO papers, NO documents, NO screens with text. Focus on tangible subjects: vehicles (car on highway, car key on leather surface), architecture (modern building exterior, clean office lobby), nature (sunrise over city, open road through mountains), or symbolic objects (stethoscope on white surface, house exterior at sunset, coins and pen on wooden table). The scene must relate to the article topic. Examples for auto insurance: 'Sleek silver car driving on an open mountain highway at golden hour, dramatic sky, motion blur on wheels, no people visible'. Examples for health: 'Modern hospital corridor with warm ambient lighting, polished floors, no text or signage visible'. Examples for payments/finance: 'Close-up of a car key resting on a clean wooden surface, shallow depth of field, warm light'. CRITICAL: Do NOT describe offices, meetings, people reviewing documents, or any scene that would naturally show text. Max 200 characters.",
  "tiempo_lectura": "string - Ej: '4 min de lectura'"
}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 10000,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} - ${errText}`);
  }

  const data = await resp.json();
  const content_raw = data.choices?.[0]?.message?.content;

  if (!content_raw) {
    throw new Error("OpenAI no devolvio contenido.");
  }

  const article: ArticleResult = JSON.parse(content_raw);

  if (!article.titulo || !article.contenido_html) {
    throw new Error("Respuesta de OpenAI incompleta: falta titulo o contenido_html.");
  }

  return article;
}

// --- Image Generation ---

async function generateImage(apiKey: string, article: ArticleResult): Promise<string> {
  const scene = article.imagen_destacada_descripcion;
  const prompt = `Editorial cover photograph. ${scene}

Photography style: high-end commercial photography, cinematic lighting, shallow depth of field, professional color grading, sharp focus on subject with soft background blur.
Composition: subject positioned slightly right of center, left side naturally darker for text overlay space. Main subject within center 70% of frame.
Lighting: warm-to-neutral cinematic tones, well-lit focal point, dramatic shadows.
Clean surfaces — absolutely zero text, zero letters, zero numbers, zero logos, zero watermarks, zero signs on any surface in the entire image.
Wide format, landscape orientation, 16:9 ratio.
Style: premium, modern, trustworthy. NOT stock photo aesthetic.`;

  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: prompt.substring(0, 4000),
      n: 1,
      size: "1792x1024",
      quality: "standard",
      style: "natural",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DALL-E error: ${resp.status} - ${errText}`);
  }

  const data = await resp.json();
  const imageUrl = data.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error("DALL-E no devolvio una imagen.");
  }

  return imageUrl;
}
