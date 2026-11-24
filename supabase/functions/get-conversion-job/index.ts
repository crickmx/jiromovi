import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: "Authorization required"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid token"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // Extraer job_id de la URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId || jobId === 'get-conversion-job') {
      return new Response(JSON.stringify({
        success: false,
        error: "job_id is required in URL path"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // Consultar el job
    const { data: job, error: jobError } = await supabase
      .from("conversion_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({
        success: false,
        error: "Job not found",
        job_id: jobId
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // Devolver información del job
    return new Response(JSON.stringify({
      success: true,
      job: {
        id: job.id,
        batch_id: job.batch_id,
        status: job.status,
        started_at: job.started_at,
        finished_at: job.finished_at,
        duration_ms: job.duration_ms,
        error_code: job.error_code,
        error_message: job.error_message,
        total_inserted_items: job.total_inserted_items,
        created_batch_count: job.created_batch_count,
        created_batch_ids: job.created_batch_ids,
        conversion_report: job.conversion_report
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (error: any) {
    console.error("[GetConversionJob] Error:", error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Error al consultar el job de conversión"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
    });
  }
});
