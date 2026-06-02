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
      .select("id, estado, carpeta_destino_id, iniciado_por, configuracion")
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

    // Resolve the destination folder name for storage path derivation
    let carpetaNombre: string | null = null;
    if (job.carpeta_destino_id) {
      const { data: carpeta } = await supabase
        .from("centro_digital_carpetas")
        .select("nombre")
        .eq("id", job.carpeta_destino_id)
        .maybeSingle();
      carpetaNombre = carpeta?.nombre ?? null;
    }

    // Derive a safe folder prefix: sanitized folder name + id prefix for uniqueness
    const folderPrefix = carpetaNombre
      ? slugify(carpetaNombre)
      : (job.carpeta_destino_id ? job.carpeta_destino_id.substring(0, 8) : "sin-carpeta");

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
    // Cache of ramo -> subcarpeta_id to avoid redundant lookups/creates
    const subcarpetaCache: Map<string, string> = new Map();
    const crearSubcarpetas = job.configuracion?.crear_subcarpetas === true;

    for (const item of pendingItems) {
      const result = await processItem(supabase, item, job, folderPrefix, crearSubcarpetas, subcarpetaCache);
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

async function processItem(supabase: any, item: any, job: any, folderPrefix: string, crearSubcarpetas: boolean, subcarpetaCache: Map<string, string>): Promise<any> {
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
    const baseFilename = item.nombre_archivo_original
      || extractFilenameFromDisposition(response.headers.get("content-disposition"))
      || `${sanitizeFilename(item.titulo)}.${item.extension || "pdf"}`;

    // Determine MIME type
    const mimeType = item.tipo_mime_detectado
      || contentType.split(";")[0].trim()
      || "application/octet-stream";

    // Build storage path using the correct centro-digital folder convention:
    // centro-digital/{folder-slug}/{timestamp}_{safeFilename}
    const timestamp = Date.now();
    const safeFilename = sanitizeFilename(baseFilename.replace(/\.[^.]+$/, ""))
      + "." + (item.extension || getExtensionFromMime(mimeType) || "bin");
    const storagePath = `${folderPrefix}/${timestamp}_${safeFilename}`;

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

    // Verify file actually exists in storage before creating DB records
    const { data: verifyList, error: verifyErr } = await supabase.storage
      .from("centro-digital-files")
      .list(storagePath.substring(0, storagePath.lastIndexOf("/")), {
        search: storagePath.substring(storagePath.lastIndexOf("/") + 1),
        limit: 1,
      });

    if (verifyErr || !verifyList || verifyList.length === 0) {
      // Upload reported success but file can't be found — don't create orphan DB records
      await markItemError(supabase, item.id, "Archivo subido pero no verificable en storage");
      return { id: item.id, success: false, error: "Storage verification failed" };
    }

    // Create Centro Digital archivo record with the correct carpeta_id
    // If subcarpetas are enabled, resolve or create the subcarpeta for this item's ramo
    let carpetaId = job.carpeta_destino_id;
    if (crearSubcarpetas && item.ramo) {
      if (carpetaId) {
        // Create subcarpeta under the root folder
        carpetaId = await getOrCreateSubcarpeta(supabase, carpetaId, item.ramo, job.iniciado_por, subcarpetaCache);
      } else {
        // No root folder — create top-level carpeta by ramo
        carpetaId = await getOrCreateTopLevelCarpeta(supabase, item.ramo, item.aseguradora, job.iniciado_por, subcarpetaCache);
      }
    } else if (!carpetaId && item.aseguradora) {
      // No root folder and no ramo — create/find top-level carpeta by aseguradora
      carpetaId = await getOrCreateTopLevelCarpeta(supabase, item.aseguradora, null, job.iniciado_por, subcarpetaCache);
    }
    let archivoId: string | null = null;

    if (carpetaId) {
      const { data: archivo, error: archivoErr } = await supabase
        .from("centro_digital_archivos")
        .insert({
          carpeta_id: carpetaId,
          nombre: item.titulo || baseFilename,
          nombre_original: baseFilename,
          ruta_storage: storagePath,
          tipo_mime: mimeType,
          tamano_bytes: fileSize,
          estado: "activo",
          cargado_por: job.iniciado_por,
          visible_para_todos: true,
        })
        .select("id")
        .single();

      if (archivoErr) {
        // Roll back storage upload to avoid orphan files
        await supabase.storage.from("centro-digital-files").remove([storagePath]);
        await markItemError(supabase, item.id, `Error al registrar archivo: ${archivoErr.message}`);
        return { id: item.id, success: false, error: archivoErr.message };
      }

      if (archivo) {
        archivoId = archivo.id;
      }
    }

    // Also insert into digital_center_documents for global visibility / Chava AI search
    const { error: docErr } = await supabase
      .from("digital_center_documents")
      .insert({
        titulo: item.titulo || baseFilename,
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
        file_name: baseFilename,
        file_extension: item.extension,
        file_mime_type: mimeType,
        activo: true,
        visibilidad: "global",
        subido_por: job.iniciado_por,
      });

    if (docErr) {
      console.error("digital_center_documents insert error (non-fatal):", docErr.message);
    }

    // Update item as stored with correct folder association
    await supabase
      .from("bulk_import_items")
      .update({
        estado: "stored",
        storage_path: storagePath,
        hash_contenido: hash,
        tamano_bytes: fileSize,
        tipo_mime_detectado: mimeType,
        nombre_archivo_original: baseFilename,
        archivo_centro_digital_id: archivoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    return { id: item.id, success: true, filename: baseFilename };
  } catch (err: any) {
    console.error(`Error processing item ${item.id}:`, err);
    await markItemError(supabase, item.id, `Error inesperado: ${err.message}`);
    return { id: item.id, success: false, error: err.message };
  }
}

async function getOrCreateTopLevelCarpeta(
  supabase: any,
  nombre: string,
  aseguradora: string | null,
  creadoPor: string,
  cache: Map<string, string>
): Promise<string | null> {
  const cacheKey = `root::${nombre}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const { data: existing } = await supabase
    .from("centro_digital_carpetas")
    .select("id")
    .is("parent_id", null)
    .eq("nombre", nombre)
    .eq("activa", true)
    .maybeSingle();

  if (existing?.id) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("centro_digital_carpetas")
    .insert({
      nombre,
      parent_id: null,
      todas_oficinas: true,
      todos_roles: true,
      enable_chava_ai: true,
      auto_index: true,
      activa: true,
      creado_por: creadoPor,
      descripcion: aseguradora ? `Documentos de ${aseguradora}` : null,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error(`Error creating top-level carpeta ${nombre}:`, error?.message);
    return null;
  }

  cache.set(cacheKey, created.id);
  return created.id;
}

async function getOrCreateSubcarpeta(
  supabase: any,
  parentId: string,
  ramo: string,
  creadoPor: string,
  cache: Map<string, string>
): Promise<string> {
  const cacheKey = `${parentId}::${ramo}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // Try to find existing subcarpeta with this name under the parent
  const { data: existing } = await supabase
    .from("centro_digital_carpetas")
    .select("id")
    .eq("parent_id", parentId)
    .eq("nombre", ramo)
    .maybeSingle();

  if (existing?.id) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  // Create the subcarpeta
  const { data: created, error } = await supabase
    .from("centro_digital_carpetas")
    .insert({
      nombre: ramo,
      parent_id: parentId,
      todas_oficinas: true,
      todos_roles: true,
      enable_chava_ai: true,
      auto_index: true,
      activa: true,
      creado_por: creadoPor,
    })
    .select("id")
    .single();

  if (error || !created) {
    // Fall back to parent if create fails
    console.error(`Error creating subcarpeta for ramo ${ramo}:`, error?.message);
    return parentId;
  }

  cache.set(cacheKey, created.id);
  return created.id;
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip accent diacritics
    .replace(/[^a-zA-Z0-9\s\-_\.]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80)
    .toLowerCase();
}

/** Convert a folder name to a URL-safe slug for use in storage paths */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) || "sin-carpeta";
}

function getExtensionFromMime(mime: string): string | null {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/zip": "zip",
  };
  return map[mime] || null;
}
