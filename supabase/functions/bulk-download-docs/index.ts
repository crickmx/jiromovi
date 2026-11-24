import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DownloadResult {
  id: string;
  titulo: string;
  status: "downloaded" | "skipped" | "error";
  storage_path?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional filters from body
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const { aseguradora, limit = 10, offset = 0, dry_run = false } = body;

    // Fetch documents that need downloading (no storage_path yet)
    let query = supabase
      .from("digital_center_documents")
      .select("id, titulo, aseguradora, ramo, categoria, tipo, formato, url_original, storage_path")
      .is("storage_path", null)
      .eq("activo", true)
      .eq("visibilidad", "global")
      .order("aseguradora", { ascending: true })
      .range(offset, offset + limit - 1);

    if (aseguradora) {
      query = query.eq("aseguradora", aseguradora);
    }

    const { data: docs, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!docs || docs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No documents pending download", results: [], total_pending: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({ message: "Dry run - documents that would be downloaded", docs, count: docs.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: DownloadResult[] = [];

    for (const doc of docs) {
      if (!doc.url_original) {
        results.push({ id: doc.id, titulo: doc.titulo, status: "skipped", error: "No URL" });
        continue;
      }

      try {
        // Fetch the document
        const response = await fetch(doc.url_original, {
          headers: { "User-Agent": "Mozilla/5.0 MOVI-Digital-Bot/1.0" },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          results.push({
            id: doc.id,
            titulo: doc.titulo,
            status: "error",
            error: `HTTP ${response.status}: ${response.statusText}`,
          });
          // Still update with a note that the URL was unreachable
          await supabase
            .from("digital_center_documents")
            .update({
              storage_path: null,
              file_mime_type: `error:${response.status}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", doc.id);
          continue;
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Determine file extension
        const ext = getExtension(doc.formato, contentType);
        const safeTitle = doc.titulo
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .substring(0, 80);
        const fileName = `${safeTitle}-${doc.id.substring(0, 8)}.${ext}`;
        const storagePath = `${doc.aseguradora.toLowerCase().replace(/\s+/g, "-")}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("centro-digital-files")
          .upload(storagePath, uint8Array, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          results.push({ id: doc.id, titulo: doc.titulo, status: "error", error: uploadError.message });
          continue;
        }

        // Generate file hash (simple length-based for now, full SHA256 requires crypto)
        const fileSize = uint8Array.length;
        const fileHash = `size:${fileSize}`;

        // Update document record
        await supabase
          .from("digital_center_documents")
          .update({
            storage_path: storagePath,
            tamano_bytes: fileSize,
            file_name: fileName,
            file_extension: ext,
            file_mime_type: contentType,
            file_hash: fileHash,
            updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id);

        results.push({ id: doc.id, titulo: doc.titulo, status: "downloaded", storage_path: storagePath });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        results.push({ id: doc.id, titulo: doc.titulo, status: "error", error: errMsg });
      }
    }

    const summary = {
      total_processed: results.length,
      downloaded: results.filter((r) => r.status === "downloaded").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getExtension(formato: string | null, contentType: string): string {
  if (formato) {
    const f = formato.toUpperCase();
    if (f === "PDF") return "pdf";
    if (f === "XLSX") return "xlsx";
    if (f === "DOCX") return "docx";
    if (f === "PPTX") return "pptx";
    if (f === "DOC") return "doc";
    if (f === "XLS") return "xls";
  }
  // Infer from content type
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "xlsx";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("presentationml")) return "pptx";
  return "pdf";
}
