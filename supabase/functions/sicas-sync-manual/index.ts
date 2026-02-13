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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { syncType } = await req.json();

    const results = {
      polizas_vigentes: 0,
      cobranza_pendiente: 0,
      errors: [] as string[],
    };

    console.log(`[SICAS-Sync-Manual] Iniciando sincronización: ${syncType || 'completa'}`);

    // Sincronizar pólizas vigentes
    let polizasMetadata: any = null;
    if (!syncType || syncType === 'polizas' || syncType === 'completa') {
      try {
        const polizasResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-sicas-polizas-vigentes`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
            },
          }
        );

        const polizasData = await polizasResponse.json();

        if (polizasResponse.ok) {
          results.polizas_vigentes = polizasData.stats?.records_inserted || polizasData.stats?.records_fetched || 0;
          polizasMetadata = polizasData.metadata;
          console.log(`[SICAS-Sync-Manual] Pólizas sincronizadas: ${results.polizas_vigentes}`);

          // Si el metadata indica error interno de SICAS, agregarlo a errores
          if (polizasMetadata?.message?.includes('Error')) {
            results.errors.push(`SICAS Error Interno: ${polizasMetadata.message}`);
          }
        } else {
          const errorMsg = polizasData.error || 'Error desconocido';
          results.errors.push(`Error en pólizas: ${errorMsg}`);
          console.error("[SICAS-Sync-Manual] Error en pólizas:", errorMsg);
        }
      } catch (error) {
        results.errors.push(`Error en pólizas: ${error.message}`);
        console.error("[SICAS-Sync-Manual] Error en pólizas:", error);
      }
    }

    // Sincronizar cobranza pendiente
    if (!syncType || syncType === 'cobranza' || syncType === 'completa') {
      try {
        const cobranzaResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sicas-sync-cobranza`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
            },
          }
        );

        if (cobranzaResponse.ok) {
          const cobranzaData = await cobranzaResponse.json();
          results.cobranza_pendiente = cobranzaData.records_count || 0;

          // Si el reporte no está disponible, no es un error
          if (cobranzaData.report_available === false) {
            console.log(`[SICAS-Sync-Manual] Reporte de cobranza no disponible en SICAS`);
          } else {
            console.log(`[SICAS-Sync-Manual] Cobranza sincronizada: ${results.cobranza_pendiente}`);
          }
        } else {
          const errorText = await cobranzaResponse.text();
          let errorMsg = errorText;

          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error || errorText;
          } catch (e) {
            // Si no es JSON, usar el texto tal cual
          }

          results.errors.push(`Error en cobranza: ${errorMsg}`);
          console.error("[SICAS-Sync-Manual] Error en cobranza:", errorMsg);
        }
      } catch (error) {
        results.errors.push(`Error en cobranza: ${error.message}`);
        console.error("[SICAS-Sync-Manual] Error en cobranza:", error);
      }
    }

    // Refrescar vistas materializadas
    try {
      console.log("[SICAS-Sync-Manual] Refrescando vistas...");
      // Las vistas se actualizan automáticamente ya que son vistas normales
    } catch (error) {
      console.error("[SICAS-Sync-Manual] Error al refrescar vistas:", error);
    }

    const success = results.errors.length === 0;

    return new Response(
      JSON.stringify({
        success,
        results,
        synced_at: new Date().toISOString(),
      }),
      { status: success ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SICAS-Sync-Manual] Error general:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
