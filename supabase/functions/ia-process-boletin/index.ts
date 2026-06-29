import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORIA_ASEGURADORAS_ID = "9cf4a22e-22a4-4b88-8ca1-f90bc2cf265d";

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

    // Get the robot ID for comunicados_aseguradoras
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

    // Find an admin user to attribute as creator if not specified
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

    // Get classified emails that haven't been processed into comunicados yet
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
        // Step 1: Generate article from email content
        const article = await generateArticle(openaiKey, email);

        // Step 2: Generate thumbnail image
        const imageUrl = await generateThumbnail(openaiKey, article.titulo, supabase, supabaseUrl);

        // Step 3: Create comunicado draft (publicado = false)
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

        // Step 4: Create visibility rule (para todos)
        await supabase.from("comunicados_visibilidad").insert({
          comunicado_id: comunicado.id,
          para_todos: true,
        });

        // Step 5: Handle attachments from original email
        if (email.adjuntos && Array.isArray(email.adjuntos) && email.adjuntos.length > 0) {
          for (const adj of email.adjuntos) {
            if (adj.url || adj.archivo_url) {
              await supabase.from("comunicados_adjuntos").insert({
                comunicado_id: comunicado.id,
                archivo_url: adj.url || adj.archivo_url,
                nombre_archivo: adj.nombre || adj.filename || "adjunto",
                tamanio_bytes: adj.size || adj.tamanio || 0,
                tipo_mime: adj.mime || adj.tipo_mime || "application/octet-stream",
              });
            }
          }
        }

        // Step 6: Link bandeja to comunicado
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

        // Step 7: Log to bitacora
        await supabase.from("ia_bitacora").insert({
          correo_id: email.id,
          robot_id: robot.id,
          accion: "generar_comunicado",
          detalle: {
            comunicado_id: comunicado.id,
            titulo: article.titulo,
            imagen_generada: !!imageUrl,
            adjuntos_vinculados: email.adjuntos?.length || 0,
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
  const truncatedContent = emailContent.substring(0, 4000);

  const prompt = `Eres un redactor experto para una agencia de seguros en Mexico. Tu tarea es transformar un email/boletin de una aseguradora en un articulo informativo profesional para publicar como comunicado interno a los agentes de la oficina.

EMAIL ORIGINAL:
- De: ${email.remitente}
- Asunto: ${email.asunto}
- Contenido: ${truncatedContent}

INSTRUCCIONES:
1. Genera un titulo atractivo y profesional (maximo 100 caracteres)
2. Genera un resumen ejecutivo de 1-2 oraciones
3. Genera el articulo completo en HTML bien estructurado con:
   - Un parrafo de introduccion/contexto
   - Los puntos clave del comunicado usando listas (<ul>) o subtitulos (<h3>)
   - Fechas importantes si las hay
   - Impacto o acciones requeridas para los agentes
   - Un parrafo de cierre
4. Genera un prompt para crear una imagen miniatura que represente visualmente el tema (en ingles, para DALL-E)

REGLAS:
- Usa un tono profesional pero accesible
- No inventes informacion que no este en el email
- Usa HTML semantico: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- NO uses <h1> (eso lo pone el sistema)
- Mantener en espanol
- El articulo debe ser util y accionable para un agente de seguros

Responde SOLO con un JSON valido:
{
  "titulo": "string",
  "resumen": "string (1-2 oraciones)",
  "contenido_html": "string (HTML del articulo)",
  "imagen_prompt": "string (prompt en ingles para DALL-E, paisaje 1792x1024)"
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
      temperature: 0.4,
      max_tokens: 3000,
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
    imagen_prompt: parsed.imagen_prompt || "Professional insurance industry newsletter header, modern corporate blue tones, abstract geometric shapes",
  };
}

async function generateThumbnail(
  apiKey: string,
  titulo: string,
  supabase: any,
  supabaseUrl: string,
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
        prompt: `Professional minimalist header image for an insurance industry newsletter article titled "${titulo}". Modern corporate design with clean geometric shapes, subtle gradients in blue and teal tones. No text, no letters, no words in the image. Wide landscape format.`,
        n: 1,
        size: "1792x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      console.error("DALL-E error:", response.status);
      return getDefaultThumbnail(supabaseUrl);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) return getDefaultThumbnail(supabaseUrl);

    // Download the image and upload to Supabase storage
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) return getDefaultThumbnail(supabaseUrl);

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
      return getDefaultThumbnail(supabaseUrl);
    }

    const { data: publicUrl } = supabase.storage
      .from("comunicados")
      .getPublicUrl(storagePath);

    return publicUrl?.publicUrl || getDefaultThumbnail(supabaseUrl);

  } catch (err: any) {
    console.error("Thumbnail generation error:", err.message);
    return getDefaultThumbnail(supabaseUrl);
  }
}

function getDefaultThumbnail(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/comunicados/imagenes/default-boletin.png`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
