import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const BATCH_SIZE = 5; // Process 5 files at a time
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds per download

interface ProcessRequest {
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
        JSON.stringify({ error: "Solo administradores pueden ejecutar importaciones" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { job_id, batch_size }: ProcessRequest = await req.json();

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify job exists and is in valid state
    const { data: job } = await supabase
      .from("bulk_import_jobs")
      .select("id, estado, carpeta_destino_id, iniciado_por")
      .eq("id", job_id)
      .maybeSingle();

    if (!job) {
      return new Response(
        JSON.stringify({ error: "Job no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.estado === "completed" || job.estado === "cancelled") {
      return new Response(
        JSON.stringify({ error: `Job ya está en estado: ${job.estado}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job state to downloading
    await supabase
      .from("bulk_import_jobs")
      .update({ estado: "downloading" })
      .eq("id", job_id);

    // Get next batch of pending items
    const batchCount = batch_size || BATCH_SIZE;
    const { data: pendingItems } = await supabase
      .from("bulk_import_items")
      .select("*")
      .eq("job_id", job_id)
      .eq("estado", "pending")
      .eq("es_descargable", true)
      .order("created_at", { ascending: true })
      .limit(batchCount);

    if (!pendingItems || pendingItems.length === 0) {
      // Check if there are still downloading items
      const { count } = await supabase
        .from("bulk_import_items")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job_id)
        .eq("estado", "downloading");

      if (!count || count === 0) {
        // All done - update job stats and mark complete
        await finalizeJob(supabase, job_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "No hay más items pendientes",
          processed: 0,
          remaining: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark items as downloading
    const itemIds = pendingItems.map(i => i.id);
    await supabase
      .from("bulk_import_items")
      .update({ estado: "downloading", intentos: 1 })
      .in("id", itemIds);

    // Process each item
    const results: any[] = [];

    for (const item of pendingItems) {
      const result = await processItem(supabase, item, job);
      results.push(result);
    }

    // Calculate remaining
    const { count: remaining } = await supabase
      .from("bulk_import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", job_id)
      .eq("estado", "pending")
      .eq("es_descargable", true);

    // Update job counters
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    const { data: jobStats } = await supabase
      .from("bulk_import_jobs")
      .select("total_descargados, total_errores")
      .eq("id", job_id)
      .single();

    await supabase
      .from("bulk_import_jobs")
      .update({
        total_descargados: (jobStats?.total_descargados || 0) + successCount,
        total_errores: (jobStats?.total_errores || 0) + errorCount,
        estado: (remaining || 0) > 0 ? "downloading" : "pending",
      })
      .eq("id", job_id);

    // If no more remaining, finalize
    if (!remaining || remaining === 0) {
      await finalizeJob(supabase, job_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        errors: errorCount,
        remaining: remaining || 0,
        results: results.map(r => ({
          id: r.id,
          success: r.success,
          error: r.error || null,
          filename: r.filename || null,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("bulk-import-process-downloads error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processItem(supabase: any, item: any, job: any): Promise<any> {
  try {
    // Download the file
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(item.url_original, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MOVIDigital/1.0; DocumentImporter)",
          "Accept": "*/*",
        },
        redirect: "follow",
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      await markItemError(supabase, item.id, `Error de descarga: ${fetchErr.message}`);
      return { id: item.id, success: false, error: fetchErr.message };
    }
    clearTimeout(timeout);

    if (!response.ok) {
      await markItemError(supabase, item.id, `HTTP ${response.status}: ${response.statusText}`);
      return { id: item.id, success: false, error: `HTTP ${response.status}` };
    }

    // Validate content type - reject HTML responses disguised as documents
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html") && item.extension !== "html") {
      await markItemError(supabase, item.id, "Respuesta HTML en lugar de documento (posible error 404 o redirección)");
      return { id: item.id, success: false, error: "HTML response instead of document" };
    }

    // Read the file content
    const arrayBuffer = await response.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    if (fileSize === 0) {
      await markItemError(supabase, item.id, "Archivo vacío (0 bytes)");
      return { id: item.id, success: false, error: "Empty file" };
    }

    if (fileSize > MAX_FILE_SIZE) {
      await markItemError(supabase, item.id, `Archivo demasiado grande: ${Math.round(fileSize / 1024 / 1024)}MB (máx 50MB)`);
      return { id: item.id, success: false, error: "File too large" };
    }

    // Validate it's not an HTML error page masquerading as a document
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 100));
    const firstChars = new TextDecoder().decode(firstBytes).toLowerCase();
    if (firstChars.includes("<!doctype") || firstChars.includes("<html")) {
      if (item.extension && item.extension !== "html" && item.extension !== "htm") {
        await markItemError(supabase, item.id, "Contenido es HTML disfrazado de documento");
        return { id: item.id, success: false, error: "HTML disguised as document" };
      }
    }

    // Generate hash for duplicate detection
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Check for content-based duplicates
    const { data: duplicateByHash } = await supabase
      .from("bulk_import_items")
      .select("id")
      .eq("hash_contenido", hash)
      .in("estado", ["downloaded", "stored", "indexed"])
      .neq("id", item.id)
      .limit(1)
      .maybeSingle();

    if (duplicateByHash) {
      await supabase
        .from("bulk_import_items")
        .update({
          estado: "duplicate",
          hash_contenido: hash,
          tamano_bytes: fileSize,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return { id: item.id, success: false, error: "Duplicate content (hash match)" };
    }

    // Determine filename
    const filename = item.nombre_archivo_original
      || extractFilenameFromDisposition(response.headers.get("content-disposition"))
      || `${sanitizeFilename(item.titulo)}.${item.extension || "pdf"}`;

    // Determine MIME type
    const mimeType = item.tipo_mime_detectado
      || contentType.split(";")[0].trim()
      || "application/octet-stream";

    // Upload to Supabase Storage
    const storagePath = `bulk-imports/${job.id}/${item.id}/${filename}`;
    const blob = new Blob([arrayBuffer], { type: mimeType });

    const { error: uploadError } = await supabase.storage
      .from("centro-digital-files")
      .upload(storagePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      await markItemError(supabase, item.id, `Error al guardar en storage: ${uploadError.message}`);
      return { id: item.id, success: false, error: uploadError.message };
    }

    // Create Centro Digital archivo record
    const carpetaId = job.carpeta_destino_id;
    let archivoId: string | null = null;

    if (carpetaId) {
      const { data: archivo, error: archivoErr } = await supabase
        .from("centro_digital_archivos")
        .insert({
          carpeta_id: carpetaId,
          nombre: item.titulo || filename,
          nombre_original: filename,
          ruta_storage: storagePath,
          tipo_mime: mimeType,
          tamano_bytes: fileSize,
          estado: "activo",
          cargado_por: job.iniciado_por,
          visible_para_todos: true,
        })
        .select("id")
        .single();

      if (!archivoErr && archivo) {
        archivoId = archivo.id;
      }
    }

    // Also insert into digital_center_documents for global visibility
    await supabase
      .from("digital_center_documents")
      .insert({
        titulo: item.titulo || filename,
        descripcion: item.descripcion,
        aseguradora: item.aseguradora,
        ramo: item.ramo,
        categoria: item.categoria,
        formato: item.extension || "pdf",
        tags: item.tags || [],
        url_original: item.url_original,
        storage_path: storagePath,
        tamano_bytes: fileSize,
        file_hash: hash,
        file_name: filename,
        file_extension: item.extension,
        file_mime_type: mimeType,
        activo: true,
        visibilidad: "global",
        subido_por: job.iniciado_por,
      });

    // Update item as stored
    await supabase
      .from("bulk_import_items")
      .update({
        estado: "stored",
        storage_path: storagePath,
        hash_contenido: hash,
        tamano_bytes: fileSize,
        tipo_mime_detectado: mimeType,
        nombre_archivo_original: filename,
        archivo_centro_digital_id: archivoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    return { id: item.id, success: true, filename };
  } catch (err: any) {
    console.error(`Error processing item ${item.id}:`, err);
    await markItemError(supabase, item.id, `Error inesperado: ${err.message}`);
    return { id: item.id, success: false, error: err.message };
  }
}

async function markItemError(supabase: any, itemId: string, mensaje: string) {
  await supabase
    .from("bulk_import_items")
    .update({
      estado: "error",
      error_mensaje: mensaje,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);
}

async function finalizeJob(supabase: any, jobId: string) {
  // Get final counts
  const states = ["downloaded", "stored", "indexed", "error", "duplicate", "skipped"];
  const counts: Record<string, number> = {};

  for (const state of states) {
    const { count } = await supabase
      .from("bulk_import_items")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("estado", state);
    counts[state] = count || 0;
  }

  await supabase
    .from("bulk_import_jobs")
    .update({
      estado: "completed",
      total_descargados: (counts.downloaded || 0) + (counts.stored || 0) + (counts.indexed || 0),
      total_errores: counts.error || 0,
      total_duplicados: counts.duplicate || 0,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

function extractFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (match && match[1]) {
    return match[1].replace(/['"]/g, "").trim();
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s\-_]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 100)
    .toLowerCase();
}
