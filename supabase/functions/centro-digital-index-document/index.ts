import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IndexRequest {
  archivo_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario || !["Administrador", "Gerente"].includes(usuario.rol)) {
      return new Response(
        JSON.stringify({
          error: "Solo administradores y gerentes pueden indexar documentos",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { archivo_id }: IndexRequest = await req.json();

    if (!archivo_id) {
      return new Response(
        JSON.stringify({ error: "archivo_id es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the file and its folder
    const { data: archivo, error: archivoErr } = await supabase
      .from("centro_digital_archivos")
      .select(
        "id, nombre, nombre_original, ruta_storage, tipo_mime, tamano_bytes, carpeta_id"
      )
      .eq("id", archivo_id)
      .eq("estado", "activo")
      .maybeSingle();

    if (archivoErr || !archivo) {
      return new Response(
        JSON.stringify({ error: "Archivo no encontrado o inactivo" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify folder has AI enabled
    const { data: carpeta } = await supabase
      .from("centro_digital_carpetas")
      .select("id, nombre, enable_chava_ai, auto_index, knowledge_priority")
      .eq("id", archivo.carpeta_id)
      .eq("activa", true)
      .maybeSingle();

    if (!carpeta || !carpeta.enable_chava_ai) {
      return new Response(
        JSON.stringify({
          error:
            "La carpeta no tiene Chava AI habilitado. Activa la opcion en la configuracion de la carpeta.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create indexing job
    const { data: job } = await supabase
      .from("centro_digital_indexing_jobs")
      .insert({
        archivo_id,
        carpeta_id: archivo.carpeta_id,
        estado: "procesando",
        iniciado_por: user.id,
      })
      .select("id")
      .single();

    const jobId = job?.id;

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("centro-digital-files")
      .download(archivo.ruta_storage);

    if (downloadError || !fileData) {
      await updateJobError(
        supabase,
        jobId,
        `Error al descargar archivo: ${downloadError?.message || "sin datos"}`
      );
      return new Response(
        JSON.stringify({ error: "No se pudo descargar el archivo" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract text content
    const mimeType = archivo.tipo_mime || "";
    let textContent = "";

    if (
      mimeType === "text/plain" ||
      mimeType === "text/markdown" ||
      mimeType === "text/csv"
    ) {
      textContent = await fileData.text();
    } else if (mimeType === "application/pdf") {
      textContent = await extractPdfText(openaiKey, fileData);
    } else if (
      mimeType.includes("word") ||
      mimeType.includes("document") ||
      mimeType.includes("text")
    ) {
      try {
        textContent = await fileData.text();
      } catch {
        textContent = `[Documento: ${archivo.nombre}] - Tipo ${mimeType} no soportado para extraccion automatica.`;
      }
    } else {
      try {
        textContent = await fileData.text();
      } catch {
        textContent = "";
      }
    }

    if (!textContent || textContent.length < 20) {
      await updateJobError(
        supabase,
        jobId,
        "No se pudo extraer contenido de texto suficiente del archivo"
      );
      return new Response(
        JSON.stringify({
          error: "No se pudo extraer contenido de texto del archivo",
          tipo_mime: mimeType,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Split into chunks
    const chunks = splitIntoChunks(textContent, 1800);

    // Delete existing chunks for this file
    await supabase
      .from("centro_digital_chunks")
      .delete()
      .eq("archivo_id", archivo_id);

    // Generate embeddings and store chunks in batches
    let successCount = 0;
    const batchSize = 20;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const embeddingResponse = await fetch(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: batch.map((c) => c.text),
          }),
        }
      );

      if (!embeddingResponse.ok) {
        const errBody = await embeddingResponse.text();
        console.error("Embedding API error:", errBody);
        continue;
      }

      const embeddingData = await embeddingResponse.json();
      const embeddings = embeddingData.data;

      const records = batch.map((chunk, idx) => ({
        archivo_id,
        carpeta_id: archivo.carpeta_id,
        contenido: chunk.text,
        embedding: embeddings[idx].embedding,
        chunk_index: i + idx,
        metadata: {
          section: chunk.section || null,
          archivo_nombre: archivo.nombre,
          carpeta_nombre: carpeta.nombre,
        },
      }));

      const { error: insertErr } = await supabase
        .from("centro_digital_chunks")
        .insert(records);

      if (!insertErr) {
        successCount += batch.length;
      } else {
        console.error("Chunk insert error:", insertErr.message);
      }
    }

    // Update job as completed
    if (jobId) {
      await supabase
        .from("centro_digital_indexing_jobs")
        .update({
          estado: "completado",
          total_chunks: successCount,
          contenido_extraido_tamano: textContent.length,
          completado_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        archivo_id,
        archivo_nombre: archivo.nombre,
        carpeta_nombre: carpeta.nombre,
        total_chunks: successCount,
        contenido_tamano: textContent.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("centro-digital-index-document error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function updateJobError(
  supabase: any,
  jobId: string | undefined,
  mensaje: string
) {
  if (!jobId) return;
  await supabase
    .from("centro_digital_indexing_jobs")
    .update({
      estado: "error",
      error_mensaje: mensaje,
      completado_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function extractPdfText(
  openaiKey: string,
  fileData: Blob
): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Only process PDFs up to 10MB for AI extraction
    if (bytes.length > 10 * 1024 * 1024) {
      return "[PDF demasiado grande para extraccion automatica]";
    }

    const base64 = btoa(
      bytes.reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Extrae todo el texto de este documento PDF. Devuelve SOLO el texto extraido preservando la estructura. No agregues comentarios ni explicaciones.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extrae el texto completo de este PDF:",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0,
        }),
      }
    );

    if (!response.ok) {
      console.error("PDF extraction API error:", response.status);
      return "";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    console.error("PDF extraction error:", err.message);
    return "";
  }
}

function splitIntoChunks(
  text: string,
  maxChunkSize: number
): Array<{ text: string; section?: string }> {
  const chunks: Array<{ text: string; section?: string }> = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let currentSection = "";

  for (const para of paragraphs) {
    const headerMatch =
      para.match(/^#{1,3}\s+(.+)$/m) ||
      para.match(/^([A-Z][A-Z\s]{3,})$/m);
    if (headerMatch) {
      currentSection = headerMatch[1].trim();
    }

    if (
      (currentChunk + "\n\n" + para).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push({
        text: currentChunk.trim(),
        section: currentSection || undefined,
      });
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      section: currentSection || undefined,
    });
  }

  // If chunks are still too large, split by sentences
  const finalChunks: Array<{ text: string; section?: string }> = [];
  for (const chunk of chunks) {
    if (chunk.text.length <= maxChunkSize) {
      finalChunks.push(chunk);
    } else {
      const sentences = chunk.text.split(/(?<=[.!?])\s+/);
      let subChunk = "";
      for (const sentence of sentences) {
        if ((subChunk + " " + sentence).length > maxChunkSize && subChunk) {
          finalChunks.push({ text: subChunk.trim(), section: chunk.section });
          subChunk = sentence;
        } else {
          subChunk = subChunk ? subChunk + " " + sentence : sentence;
        }
      }
      if (subChunk.trim()) {
        finalChunks.push({ text: subChunk.trim(), section: chunk.section });
      }
    }
  }

  return finalChunks;
}
