import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BATCH_SIZE = 3; // Index 3 documents at a time (embedding calls are expensive)

interface IndexBatchRequest {
  job_id: string;
  batch_size?: number;
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
        JSON.stringify({ error: "Solo administradores pueden realizar esta acción" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // ── Provision insurer folders action (no job_id needed) ──────────────────
    if (body.action === "provision_insurer_folders") {
      const { data: result, error: fnErr } = await supabase
        .rpc("provision_insurer_folders");

      if (fnErr) {
        return new Response(
          JSON.stringify({ error: fnErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const log: string[] = [];
      log.push(`Carpetas nuevas creadas: ${result?.carpetas_creadas ?? 0}`);
      log.push(`Carpetas ya existentes (omitidas): ${result?.carpetas_existentes ?? 0}`);
      log.push("Estructura de carpetas lista.");

      return new Response(
        JSON.stringify({
          success: true,
          carpetas_creadas: result?.carpetas_creadas ?? 0,
          log,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { job_id, batch_size }: IndexBatchRequest = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job
    const { data: job } = await supabase
      .from("bulk_import_jobs")
      .select("id, carpeta_destino_id, iniciado_por")
      .eq("id", job_id)
      .maybeSingle();

    if (!job) {
      return new Response(
        JSON.stringify({ error: "Job no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job state
    await supabase
      .from("bulk_import_jobs")
      .update({ estado: "indexing" })
      .eq("id", job_id);

    // Get stored items that need indexing
    const batchCount = batch_size || BATCH_SIZE;
    const { data: storedItems } = await supabase
      .from("bulk_import_items")
      .select("id, titulo, storage_path, tipo_mime_detectado, archivo_centro_digital_id, aseguradora, categoria, ramo")
      .eq("job_id", job_id)
      .eq("estado", "stored")
      .order("created_at", { ascending: true })
      .limit(batchCount);

    if (!storedItems || storedItems.length === 0) {
      // Check if there's anything left
      const { count: remaining } = await supabase
        .from("bulk_import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job_id)
        .eq("estado", "stored");

      if (!remaining || remaining === 0) {
        // Update final stats
        const { count: indexedCount } = await supabase
          .from("bulk_import_items")
          .select("id", { count: "exact", head: true })
          .eq("job_id", job_id)
          .eq("estado", "indexed");

        await supabase
          .from("bulk_import_jobs")
          .update({
            estado: "completed",
            total_indexados: indexedCount || 0,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "No hay más items para indexar", processed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const item of storedItems) {
      try {
        const result = await indexItem(supabase, openaiKey, item, job);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
        results.push(result);
      } catch (err: any) {
        errorCount++;
        results.push({ id: item.id, success: false, error: err.message });
        await supabase
          .from("bulk_import_items")
          .update({ error_mensaje: `Indexing error: ${err.message}`, updated_at: new Date().toISOString() })
          .eq("id", item.id);
      }
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from("bulk_import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job_id)
      .eq("estado", "stored");

    // Update job indexado count
    const { data: jobData } = await supabase
      .from("bulk_import_jobs")
      .select("total_indexados")
      .eq("id", job_id)
      .single();

    await supabase
      .from("bulk_import_jobs")
      .update({
        total_indexados: (jobData?.total_indexados || 0) + successCount,
        estado: (remaining || 0) > 0 ? "indexing" : "completed",
        completed_at: (remaining || 0) === 0 ? new Date().toISOString() : null,
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        indexed: successCount,
        errors: errorCount,
        remaining: remaining || 0,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bulk-import-index-batch error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function indexItem(supabase: any, openaiKey: string, item: any, job: any) {
  const { storage_path, tipo_mime_detectado, titulo, archivo_centro_digital_id } = item;

  if (!storage_path) {
    return { id: item.id, success: false, error: "No storage path" };
  }

  // Download from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("centro-digital-files")
    .download(storage_path);

  if (downloadError || !fileData) {
    return { id: item.id, success: false, error: `Storage download error: ${downloadError?.message}` };
  }

  // Extract text
  const mimeType = tipo_mime_detectado || "";
  let textContent = "";

  if (mimeType === "text/plain" || mimeType === "text/csv" || mimeType === "text/markdown") {
    textContent = await fileData.text();
  } else if (mimeType === "application/pdf") {
    textContent = await extractPdfText(openaiKey, fileData);
  } else if (mimeType.includes("word") || mimeType.includes("document") || mimeType.includes("text")) {
    try {
      textContent = await fileData.text();
    } catch {
      textContent = `[Documento: ${titulo}] - Contenido no extraíble automáticamente (${mimeType})`;
    }
  } else {
    try {
      textContent = await fileData.text();
    } catch {
      textContent = "";
    }
  }

  if (!textContent || textContent.length < 20) {
    // Mark as indexed anyway (some formats can't be extracted)
    await supabase
      .from("bulk_import_items")
      .update({ estado: "indexed", error_mensaje: "Contenido no extraíble (formato no soportado)", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    return { id: item.id, success: true, chunks: 0, note: "No extractable content" };
  }

  // Split into chunks
  const chunks = splitIntoChunks(textContent, 1800);

  // Determine carpeta_id for chunks: use the archivo's actual carpeta (supports subcarpetas)
  let carpetaId: string | null = null;
  if (archivo_centro_digital_id) {
    const { data: archivoRow } = await supabase
      .from("centro_digital_archivos")
      .select("carpeta_id")
      .eq("id", archivo_centro_digital_id)
      .maybeSingle();
    carpetaId = archivoRow?.carpeta_id ?? job.carpeta_destino_id ?? null;
  } else {
    carpetaId = job.carpeta_destino_id ?? null;
  }

  if (!carpetaId) {
    await supabase
      .from("bulk_import_items")
      .update({ estado: "indexed", updated_at: new Date().toISOString() })
      .eq("id", item.id);
    return { id: item.id, success: true, chunks: 0, note: "No target folder for chunks" };
  }

  // Delete any existing chunks for this file
  if (archivo_centro_digital_id) {
    await supabase
      .from("centro_digital_chunks")
      .delete()
      .eq("archivo_id", archivo_centro_digital_id);
  }

  // Generate embeddings in batches of 20
  let totalChunks = 0;
  const embBatchSize = 20;

  for (let i = 0; i < chunks.length; i += embBatchSize) {
    const batch = chunks.slice(i, i + embBatchSize);

    const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: batch.map(c => c.text),
      }),
    });

    if (!embResponse.ok) {
      console.error("Embedding error:", await embResponse.text());
      continue;
    }

    const embData = await embResponse.json();
    const embeddings = embData.data;

    const records = batch.map((chunk, idx) => ({
      archivo_id: archivo_centro_digital_id || null,
      carpeta_id: carpetaId,
      contenido: chunk.text,
      embedding: embeddings[idx].embedding,
      chunk_index: i + idx,
      metadata: {
        section: chunk.section || null,
        archivo_nombre: titulo,
        aseguradora: item.aseguradora,
        categoria: item.categoria,
        ramo: item.ramo,
        source: "bulk_import",
        job_id: job.id,
      },
    }));

    const { error: insertErr } = await supabase
      .from("centro_digital_chunks")
      .insert(records);

    if (!insertErr) {
      totalChunks += batch.length;
    } else {
      console.error("Chunk insert error:", insertErr.message);
    }
  }

  // Mark as indexed
  await supabase
    .from("bulk_import_items")
    .update({ estado: "indexed", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  // Also create an indexing job record for traceability
  if (archivo_centro_digital_id) {
    await supabase
      .from("centro_digital_indexing_jobs")
      .insert({
        archivo_id: archivo_centro_digital_id,
        carpeta_id: carpetaId,
        estado: "completado",
        total_chunks: totalChunks,
        contenido_extraido_tamano: textContent.length,
        iniciado_por: job.iniciado_por,
        completado_at: new Date().toISOString(),
      });
  }

  return { id: item.id, success: true, chunks: totalChunks };
}

async function extractPdfText(openaiKey: string, fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > 10 * 1024 * 1024) {
      return "[PDF demasiado grande para extracción automática]";
    }

    const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ""));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Extrae todo el texto de este documento PDF. Devuelve SOLO el texto extraido preservando la estructura. No agregues comentarios ni explicaciones." },
          { role: "user", content: [
            { type: "text", text: "Extrae el texto completo de este PDF:" },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
          ]},
        ],
        max_tokens: 4000,
        temperature: 0,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

function splitIntoChunks(text: string, maxChunkSize: number): Array<{ text: string; section?: string }> {
  const chunks: Array<{ text: string; section?: string }> = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";
  let currentSection = "";

  for (const para of paragraphs) {
    const headerMatch = para.match(/^#{1,3}\s+(.+)$/m) || para.match(/^([A-Z][A-Z\s]{3,})$/m);
    if (headerMatch) currentSection = headerMatch[1].trim();

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
