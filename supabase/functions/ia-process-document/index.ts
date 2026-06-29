import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    // Generate featured image with DALL-E 3
    let imageUrl = FALLBACK_BACKGROUNDS[Math.floor(Math.random() * FALLBACK_BACKGROUNDS.length)];
    try {
      imageUrl = await generateImage(openaiKey, article);
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
  "imagen_destacada_descripcion": "string - Descripcion en ingles para generar una imagen editorial. Describe una imagen profesional, abstracta y moderna que represente el tema. NO incluir texto ni logos.",
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
  const prompt = `Professional editorial magazine cover image: ${article.imagen_destacada_descripcion}. Style: clean, modern, high-quality corporate photography or abstract art. No text, no logos, no watermarks.`;

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
