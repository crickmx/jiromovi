import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Edge Function: Obtener Vendedores No Reconocidos de un Lote
 *
 * Retorna la lista de vendedores agrupados que tienen items pendientes
 * de asignación en un lote específico.
 *
 * FORMATO LOGEXPORT:
 * Esta función agrupa los items por vendor_key (ej: "name:JUAN PEREZ")
 * y muestra el total de items y comisión por vendedor.
 *
 * Input:
 * - batch_id: UUID del lote (via query param o body)
 *
 * Output:
 * - vendors: array de vendedores no reconocidos con:
 *   - vendor_key
 *   - vendor_name_raw
 *   - vendor_email_raw
 *   - items_count
 *   - total_commission
 *   - has_existing_mapping (si existe mapping persistente)
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Obtener batch_id (desde query params o body)
    let batch_id: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      batch_id = url.searchParams.get("batch_id");
    } else {
      try {
        const body = await req.json();
        batch_id = body.batch_id;
      } catch (e) {
        // ignore
      }
    }

    if (!batch_id) {
      return new Response(JSON.stringify({
        error: "batch_id is required",
        code: "MISSING_BATCH_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Unrecognized Vendors] Getting vendors for batch ${batch_id}`);

    // Verificar que el batch existe
    const { data: batch, error: batchError } = await supabase
      .from("commission_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      return new Response(JSON.stringify({
        error: "Batch not found",
        code: "BATCH_NOT_FOUND"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Llamar a la función de BD que agrupa los vendedores
    const { data: vendors, error: vendorsError } = await supabase
      .rpc("get_unrecognized_vendors_for_batch", {
        p_batch_id: batch_id
      });

    if (vendorsError) {
      console.error("[Unrecognized Vendors] Error getting vendors:", vendorsError);
      return new Response(JSON.stringify({
        error: "Failed to get unrecognized vendors",
        code: "GET_VENDORS_FAILED",
        details: vendorsError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Unrecognized Vendors] Found ${vendors?.length || 0} vendor groups`);

    return new Response(JSON.stringify({
      success: true,
      batch_id,
      vendors: vendors || [],
      total_vendors: vendors?.length || 0,
      total_items: vendors?.reduce((sum: number, v: any) => sum + parseInt(v.items_count || 0), 0) || 0,
      total_commission: vendors?.reduce((sum: number, v: any) => sum + parseFloat(v.total_commission || 0), 0) || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Unrecognized Vendors] Unexpected error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
