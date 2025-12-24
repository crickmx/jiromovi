import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MigrationRequest {
  lessonId: string;
  videoUrl: string;
  thumbnailUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lessonId, videoUrl, thumbnailUrl }: MigrationRequest = await req.json();

    console.log(`[migrate-video] Starting migration for lesson ${lessonId}`);

    // Extract file ID from Google Drive URL
    const extractFileId = (url: string): string | null => {
      const match = url.match(/[?&]id=([^&]+)/);
      return match ? match[1] : null;
    };

    const videoFileId = extractFileId(videoUrl);
    if (!videoFileId) {
      throw new Error('Could not extract video file ID from URL');
    }

    // Download video from Google Drive
    console.log(`[migrate-video] Downloading video ${videoFileId}`);
    const videoResponse = await fetch(videoUrl);
    
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    console.log(`[migrate-video] Downloaded video: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

    // Determine file extension from content type
    const contentType = videoResponse.headers.get('content-type') || 'video/mp4';
    const extension = contentType.includes('quicktime') ? 'mov' : 'mp4';
    
    // Upload video to Supabase Storage
    const videoPath = `lessons/${lessonId}.${extension}`;
    console.log(`[migrate-video] Uploading video to ${videoPath}`);

    const { error: videoUploadError } = await supabase.storage
      .from('videos-seguros-education')
      .upload(videoPath, videoBlob, {
        contentType,
        upsert: true,
      });

    if (videoUploadError) {
      throw new Error(`Failed to upload video: ${videoUploadError.message}`);
    }

    // Get public URL for video
    const { data: videoData } = supabase.storage
      .from('videos-seguros-education')
      .getPublicUrl(videoPath);

    const newVideoUrl = videoData.publicUrl;
    console.log(`[migrate-video] Video uploaded: ${newVideoUrl}`);

    // Download and upload thumbnail if provided
    let newThumbnailUrl = null;
    if (thumbnailUrl) {
      const thumbnailFileId = extractFileId(thumbnailUrl);
      if (thumbnailFileId) {
        console.log(`[migrate-video] Downloading thumbnail ${thumbnailFileId}`);
        const thumbnailResponse = await fetch(thumbnailUrl);
        
        if (thumbnailResponse.ok) {
          const thumbnailBlob = await thumbnailResponse.blob();
          const thumbnailContentType = thumbnailResponse.headers.get('content-type') || 'image/jpeg';
          const thumbnailExt = thumbnailContentType.includes('png') ? 'png' : 'jpg';
          const thumbnailPath = `lessons/${lessonId}.${thumbnailExt}`;
          
          console.log(`[migrate-video] Uploading thumbnail to ${thumbnailPath}`);
          const { error: thumbnailUploadError } = await supabase.storage
            .from('thumbnails-seguros-education')
            .upload(thumbnailPath, thumbnailBlob, {
              contentType: thumbnailContentType,
              upsert: true,
            });

          if (!thumbnailUploadError) {
            const { data: thumbnailData } = supabase.storage
              .from('thumbnails-seguros-education')
              .getPublicUrl(thumbnailPath);
            newThumbnailUrl = thumbnailData.publicUrl;
            console.log(`[migrate-video] Thumbnail uploaded: ${newThumbnailUrl}`);
          }
        }
      }
    }

    // Update database with new URLs
    console.log(`[migrate-video] Updating database for lesson ${lessonId}`);
    const updateData: any = { video_url: newVideoUrl };
    if (newThumbnailUrl) {
      updateData.miniatura_url = newThumbnailUrl;
    }

    const { error: updateError } = await supabase
      .from('seguros_lessons')
      .update(updateData)
      .eq('id', lessonId);

    if (updateError) {
      throw new Error(`Failed to update database: ${updateError.message}`);
    }

    console.log(`[migrate-video] Migration completed for lesson ${lessonId}`);

    return new Response(
      JSON.stringify({
        success: true,
        lessonId,
        videoUrl: newVideoUrl,
        thumbnailUrl: newThumbnailUrl,
        videoSize,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[migrate-video] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});