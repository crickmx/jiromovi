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
    // Validar que las credenciales SICAS estén configuradas ANTES de hacer nada
    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');

    if (!sicasUsername || !sicasPassword) {
      console.error('[SICAS-Sync-Manual] ❌ Credenciales SICAS no configuradas');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciales SICAS no configuradas en el servidor. Contacta al administrador.',
          details: {
            username_configured: !!sicasUsername,
            password_configured: !!sicasPassword,
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Run polizas and cobranza in PARALLEL for faster sync
    const syncPolizas = async () => {
      if (syncType && syncType !== 'polizas' && syncType !== 'completa') return;

      console.log('[SICAS-Sync-Manual] Llamando a sicas-get-polizas-vigentes-rest...');

      const polizasResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/sicas-get-polizas-vigentes-rest`,
        {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const polizasData = await polizasResponse.json();

      if (polizasResponse.ok && polizasData.success) {
        results.polizas_vigentes = polizasData.polizas?.length || 0;
        console.log(`[SICAS-Sync-Manual] Pólizas sincronizadas: ${results.polizas_vigentes}`);
      } else {
        const errorMsg = polizasData.error || polizasData.message || 'Error desconocido en SICAS REST';
        results.errors.push(`Error en pólizas: ${errorMsg}`);
        console.error("[SICAS-Sync-Manual] Error en pólizas REST:", errorMsg);
      }
    };

    const syncCobranza = async () => {
      if (syncType && syncType !== 'cobranza' && syncType !== 'completa') return;

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
        } catch (_) { /* use text as-is */ }
        results.errors.push(`Error en cobranza: ${errorMsg}`);
        console.error("[SICAS-Sync-Manual] Error en cobranza:", errorMsg);
      }
    };

    // Execute both in parallel
    const [polizasResult, cobranzaResult] = await Promise.allSettled([
      syncPolizas(),
      syncCobranza(),
    ]);

    if (polizasResult.status === "rejected") {
      results.errors.push(`Error en pólizas: ${polizasResult.reason?.message || 'Error de conexión'}`);
      console.error("[SICAS-Sync-Manual] Error en pólizas:", polizasResult.reason);
    }
    if (cobranzaResult.status === "rejected") {
      results.errors.push(`Error en cobranza: ${cobranzaResult.reason?.message || 'Error de conexión'}`);
      console.error("[SICAS-Sync-Manual] Error en cobranza:", cobranzaResult.reason);
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
