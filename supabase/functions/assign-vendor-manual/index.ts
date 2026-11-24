import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Edge Function: Asignación Manual de Vendor a Usuario MOVI
 *
 * Aplica una asignación manual de vendor_key a movi_user_id en un lote
 * específico y guarda el mapping como persistente para futuras importaciones.
 *
 * FORMATO LOGEXPORT:
 * Esta función es crítica para el soporte de archivos sin email.
 * Permite asignar manualmente items con vendor_key = "name:VENDEDOR"
 * a un usuario MOVI específico.
 *
 * Input:
 * - batch_id: UUID del lote
 * - vendor_key: string, clave del vendedor (ej: "name:JUAN PEREZ")
 * - movi_user_id: UUID del usuario MOVI a asignar
 *
 * Output:
 * - success: boolean
 * - updated_count: número de items actualizados
 * - mapping_id: UUID del mapping persistente creado/actualizado
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

    // Parsear request body
    let body: any;
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return new Response(JSON.stringify({
          error: "Request body is empty",
          code: "EMPTY_REQUEST"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      body = JSON.parse(text);
    } catch (parseError: any) {
      console.error("[Assign Vendor] JSON parse error:", parseError);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body",
        code: "INVALID_JSON",
        details: parseError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { batch_id, vendor_key, movi_user_id } = body;

    // Validar parámetros
    if (!batch_id) {
      return new Response(JSON.stringify({
        error: "batch_id is required",
        code: "MISSING_BATCH_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!vendor_key) {
      return new Response(JSON.stringify({
        error: "vendor_key is required",
        code: "MISSING_VENDOR_KEY"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!movi_user_id) {
      return new Response(JSON.stringify({
        error: "movi_user_id is required",
        code: "MISSING_USER_ID"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Assign Vendor] Assigning vendor_key "${vendor_key}" to user ${movi_user_id} in batch ${batch_id}`);

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

    // Verificar que el usuario existe
    const { data: moviUser, error: userError } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, rol")
      .eq("id", movi_user_id)
      .maybeSingle();

    if (userError || !moviUser) {
      return new Response(JSON.stringify({
        error: "User not found",
        code: "USER_NOT_FOUND"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Contar items que serán afectados
    const { count: itemsCount } = await supabase
      .from("commission_details")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batch_id)
      .eq("vendor_key", vendor_key)
      .eq("pending_assignment", true);

    if (!itemsCount || itemsCount === 0) {
      return new Response(JSON.stringify({
        success: false,
        code: "NO_ITEMS_FOUND",
        message: "No se encontraron items pendientes con ese vendor_key en el lote",
        details: {
          batch_id,
          vendor_key,
          items_count: 0
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Assign Vendor] Found ${itemsCount} items to assign`);

    // Llamar a la función de BD que aplica el mapping
    const { data: result, error: applyError } = await supabase
      .rpc("apply_vendor_mapping_to_batch", {
        p_batch_id: batch_id,
        p_vendor_key: vendor_key,
        p_movi_user_id: movi_user_id,
        p_assigned_by: user.id
      });

    if (applyError) {
      console.error("[Assign Vendor] Error applying mapping:", applyError);
      return new Response(JSON.stringify({
        error: "Failed to apply vendor mapping",
        code: "APPLY_MAPPING_FAILED",
        details: applyError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Assign Vendor] Success:`, result);

    return new Response(JSON.stringify({
      success: true,
      message: "Asignación aplicada exitosamente",
      details: {
        batch_id,
        vendor_key,
        movi_user_id,
        user_name: moviUser.nombre_completo,
        updated_count: result.updated_count,
        mapping_id: result.mapping_id
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[Assign Vendor] Unexpected error:", error);
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
