import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessRequest {
  documento_id: string;
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

    // Verify caller is admin
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
      .select("rol")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario || usuario.rol !== "Administrador") {
      return new Response(
        JSON.stringify({ error: "Only administrators can process documents" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documento_id }: ProcessRequest = await req.json();

    if (!documento_id) {
      return new Response(
        JSON.stringify({ error: "documento_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("chava_documentos")
      .select("*")
      .eq("id", documento_id)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    await supabase
      .from("chava_documentos")
      .update({ estado: "processing", updated_at: new Date().toISOString() })
      .eq("id", documento_id);

    // Extract text content based on file type
    let textContent = doc.contenido_extraido || "";

    if (!textContent && doc.archivo_url) {
      try {
        // Download file from storage
        const filePath = doc.archivo_url.replace(/.*\/storage\/v1\/object\/public\//, "").replace(/.*\/storage\/v1\/object\//, "");
        const bucketAndPath = filePath.startsWith("chava-knowledge/")
          ? filePath
          : `chava-knowledge/${filePath}`;

        const bucket = bucketAndPath.split("/")[0];
        const path = bucketAndPath.split("/").slice(1).join("/");

        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(path);

        if (downloadError) {
          throw new Error(`Download error: ${downloadError.message}`);
        }

        const mimeType = doc.archivo_tipo || "";

        if (mimeType === "text/plain" || mimeType === "text/markdown" || mimeType === "text/csv") {
          textContent = await fileData.text();
        } else if (mimeType === "application/pdf") {
          // For PDF, use basic text extraction or pass to OpenAI for analysis
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          // Use OpenAI to extract text from PDF
          const extractResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "Extract all text content from this document. Return ONLY the extracted text, preserving structure and formatting. Do not add commentary."
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all text from this PDF document:" },
                    { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } }
                  ]
                }
              ],
              max_tokens: 4000,
              temperature: 0,
            }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            textContent = extractData.choices?.[0]?.message?.content || "";
          }
        } else {
          // For other types, try to read as text
          try {
            textContent = await fileData.text();
          } catch {
            textContent = `[Document: ${doc.titulo}] - Content type ${mimeType} requires manual processing.`;
          }
        }
      } catch (err: any) {
        console.error("File extraction error:", err.message);
        // If file download fails, use whatever content we have
        if (!textContent) {
          textContent = `[Document: ${doc.titulo}] ${doc.descripcion || ""}`;
        }
      }
    }

    if (!textContent || textContent.length < 10) {
      await supabase
        .from("chava_documentos")
        .update({
          estado: "error",
          updated_at: new Date().toISOString()
        })
        .eq("id", documento_id);

      return new Response(
        JSON.stringify({ error: "Could not extract text content from document" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save extracted content
    await supabase
      .from("chava_documentos")
      .update({ contenido_extraido: textContent })
      .eq("id", documento_id);

    // Split into chunks (approx 500 tokens each, ~2000 chars)
    const chunks = splitIntoChunks(textContent, 1800);

    // Delete existing fragments
    await supabase
      .from("chava_fragmentos")
      .delete()
      .eq("documento_id", documento_id);

    // Generate embeddings and save fragments
    let successCount = 0;
    const batchSize = 20;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Generate embeddings in batch
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: batch.map(c => c.text),
        }),
      });

      if (!embeddingResponse.ok) {
        const errBody = await embeddingResponse.text();
        console.error("Embedding API error:", errBody);
        continue;
      }

      const embeddingData = await embeddingResponse.json();
      const embeddings = embeddingData.data;

      // Insert fragments
      const fragments = batch.map((chunk, idx) => ({
        documento_id,
        contenido: chunk.text,
        embedding: JSON.stringify(embeddings[idx].embedding),
        metadata: { page: chunk.page, section: chunk.section },
        orden: i + idx,
      }));

      const { error: insertError } = await supabase
        .from("chava_fragmentos")
        .insert(fragments);

      if (!insertError) {
        successCount += batch.length;
      } else {
        console.error("Fragment insert error:", insertError.message);
      }
    }

    // Update document status
    await supabase
      .from("chava_documentos")
      .update({
        estado: "ready",
        total_fragmentos: successCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documento_id);

    return new Response(
      JSON.stringify({
        success: true,
        documento_id,
        total_fragmentos: successCount,
        total_chunks: chunks.length,
        contenido_tamano: textContent.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Process document error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function splitIntoChunks(
  text: string,
  maxChunkSize: number
): Array<{ text: string; page?: number; section?: string }> {
  const chunks: Array<{ text: string; page?: number; section?: string }> = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let currentSection = "";

  for (const para of paragraphs) {
    // Detect section headers
    const headerMatch = para.match(/^#{1,3}\s+(.+)$/m) || para.match(/^([A-Z][A-Z\s]{3,})$/m);
    if (headerMatch) {
      currentSection = headerMatch[1].trim();
    }

    if ((currentChunk + "\n\n" + para).length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({ text: currentChunk.trim(), section: currentSection || undefined });
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ text: currentChunk.trim(), section: currentSection || undefined });
  }

  // If still too large, split by sentences
  const finalChunks: Array<{ text: string; page?: number; section?: string }> = [];
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
