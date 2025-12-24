import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MigrationItem {
  titulo: string;
  videoUrl: string;
  imageUrl: string;
}

function extractGoogleDriveId(url: string): string | null {
  if (!url || url === "No se encontró imagen") return null;
  const match = url.match(/\/d\/([^\/]+)\//); 
  return match ? match[1] : null;
}

function getDirectDownloadUrl(driveUrl: string): string | null {
  const fileId = extractGoogleDriveId(driveUrl);
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

async function downloadFromDrive(driveUrl: string): Promise<{ blob: Blob | null; error: string | null }> {
  const fileId = extractGoogleDriveId(driveUrl);
  if (!fileId) {
    return { blob: null, error: "No se pudo extraer el ID del archivo de Drive" };
  }

  const downloadMethods = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=AIzaSyAcJm9bu_OBmPU6BcdEw8W9QAOYHpnk5Vo`,
  ];

  for (let i = 0; i < downloadMethods.length; i++) {
    const downloadUrl = downloadMethods[i];
    console.log(`Intento ${i + 1}: ${downloadUrl.substring(0, 80)}...`);

    try {
      const response = await fetch(downloadUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        redirect: "follow",
      });

      console.log(`Response status: ${response.status}, Content-Type: ${response.headers.get("content-type")}`);

      if (!response.ok) {
        console.error(`Método ${i + 1} falló: ${response.status} ${response.statusText}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/html")) {
        console.error(`Método ${i + 1} retornó HTML - probablemente bloqueado por Google`);
        continue;
      }

      const blob = await response.blob();

      if (blob.size < 1024) {
        console.error(`Método ${i + 1} retornó archivo muy pequeño: ${blob.size} bytes`);
        continue;
      }

      console.log(`✓ Descarga exitosa con método ${i + 1}: ${blob.size} bytes`);
      return { blob, error: null };

    } catch (error) {
      console.error(`Método ${i + 1} error:`, error);
      continue;
    }
  }

  return {
    blob: null,
    error: "Todos los métodos de descarga fallaron. Google Drive puede estar bloqueando el acceso automático a este archivo."
  };
}

async function uploadToSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  filePath: string,
  file: Blob
): Promise<string | null> {
  try {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to upload to Supabase: ${error}`);
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  } catch (error) {
    console.error(`Error uploading to Supabase:`, error);
    return null;
  }
}

function sanitizeFilename(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { items } = await req.json() as { items: MigrationItem[] };

    const results = [];

    for (const item of items) {
      const result: any = {
        titulo: item.titulo,
        success: false,
        videoUrl: null,
        imageUrl: null,
        errors: [],
      };

      const filename = sanitizeFilename(item.titulo);

      if (item.videoUrl && item.videoUrl !== "No se encontró imagen") {
        console.log(`Downloading video: ${item.titulo}`);
        const { blob: videoBlob, error: downloadError } = await downloadFromDrive(item.videoUrl);

        if (videoBlob) {
          const videoPath = `academia-negocios-2025/${filename}.mp4`;
          const videoUrl = await uploadToSupabase(
            supabaseUrl,
            supabaseServiceKey,
            "seguros-videos",
            videoPath,
            videoBlob
          );

          if (videoUrl) {
            result.videoUrl = videoUrl;
            console.log(`✓ Video uploaded: ${videoUrl}`);
          } else {
            result.errors.push("Failed to upload video to Supabase");
          }
        } else {
          result.errors.push(downloadError || "Failed to download video from Drive");
        }
      }

      if (item.imageUrl && item.imageUrl !== "No se encontró imagen") {
        console.log(`Downloading image: ${item.titulo}`);
        const { blob: imageBlob, error: downloadError } = await downloadFromDrive(item.imageUrl);

        if (imageBlob) {
          const imagePath = `academia-negocios-2025/${filename}.jpg`;
          const imageUrl = await uploadToSupabase(
            supabaseUrl,
            supabaseServiceKey,
            "seguros-thumbnails",
            imagePath,
            imageBlob
          );

          if (imageUrl) {
            result.imageUrl = imageUrl;
            console.log(`✓ Image uploaded: ${imageUrl}`);
          } else {
            result.errors.push("Failed to upload image to Supabase");
          }
        } else {
          result.errors.push(downloadError || "Failed to download image from Drive");
        }
      }

      result.success = (result.videoUrl || result.imageUrl) && result.errors.length === 0;
      results.push(result);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        migrated: results.filter(r => r.success).length,
        total: items.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
