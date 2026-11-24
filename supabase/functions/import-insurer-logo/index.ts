import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { insurer_id, source_url, file_name } = body as {
      insurer_id: string;
      source_url: string;
      file_name?: string;
    };

    if (!insurer_id || !source_url) {
      return new Response(
        JSON.stringify({ error: "insurer_id and source_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the image from the source URL
    const imageRes = await fetch(source_url, {
      headers: { "User-Agent": "Seguwallet/1.0 Logo Importer" },
    });

    if (!imageRes.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${imageRes.status} ${imageRes.statusText}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = imageRes.headers.get("content-type") || "image/png";
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];
    const mimeType = contentType.split(";")[0].trim();

    if (!allowedTypes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: `Unsupported image type: ${mimeType}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ext = mimeType.split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
    const storageName = file_name
      ? `${file_name}.${ext}`
      : `insurer-${insurer_id}-${Date.now()}.${ext}`;
    const storagePath = `logos/${storageName}`;

    const imageBuffer = await imageRes.arrayBuffer();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("insurance-carriers-logos")
      .upload(storagePath, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update the insurer record
    const { error: dbError } = await supabase
      .from("seguwallet_insurers")
      .update({
        logo_local_path: storagePath,
        logo_original_source_url: source_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insurer_id);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `DB update failed: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("insurance-carriers-logos")
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({ success: true, storage_path: storagePath, public_url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
