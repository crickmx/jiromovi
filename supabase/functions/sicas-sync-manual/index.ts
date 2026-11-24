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

    const body = await req.json().catch(() => ({}));
    const syncType: string = body.syncType || "completa";
    const mode: string = body.mode || "full";

    console.log(`[SICAS-Sync-Manual] Iniciando sincronización: ${syncType}, modo: ${mode}`);

    const results: {
      job_id?: string;
      polizas_vigentes: number;
      cobranza_pendiente: number;
      errors: string[];
      already_running?: boolean;
    } = {
      polizas_vigentes: 0,
      cobranza_pendiente: 0,
      errors: [],
    };

    // Documentos via bulk-sync SOAP (the only working path for this SICAS account)
    if (syncType === "polizas" || syncType === "completa") {
      console.log("[SICAS-Sync-Manual] Delegando a sicas-bulk-sync (SOAP ProcesarWS)...");

      const bulkResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/sicas-bulk-sync`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "start", mode, triggeredBy: "manual" }),
        }
      );

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        if (bulkData.alreadyRunning) {
          console.log(`[SICAS-Sync-Manual] Ya hay una sincronización en progreso: ${bulkData.jobId}`);
          results.already_running = true;
          results.job_id = bulkData.jobId;
        } else if (bulkData.ok || bulkData.jobId) {
          results.job_id = bulkData.jobId;
          console.log(`[SICAS-Sync-Manual] Job creado: ${bulkData.jobId}`);
        } else {
          const errorMsg = bulkData.error || "Error al iniciar sincronización SOAP";
          results.errors.push(`Error en pólizas: ${errorMsg}`);
          console.error("[SICAS-Sync-Manual] Error bulk-sync:", errorMsg);
        }
      } else {
        const errorText = await bulkResponse.text();
        results.errors.push(`Error en pólizas: HTTP ${bulkResponse.status} - ${errorText.slice(0, 200)}`);
        console.error("[SICAS-Sync-Manual] Error HTTP bulk-sync:", bulkResponse.status);
      }
    }

    // Cobranza via dedicated SOAP function
    if (syncType === "cobranza" || syncType === "completa") {
      console.log("[SICAS-Sync-Manual] Sincronizando cobranza...");

      const cobranzaResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/sicas-sync-cobranza`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (cobranzaResponse.ok) {
        const cobranzaData = await cobranzaResponse.json();
        results.cobranza_pendiente = cobranzaData.records_count || 0;
        if (cobranzaData.report_available === false) {
          console.log("[SICAS-Sync-Manual] Reporte de cobranza no disponible en SICAS");
        } else {
          console.log(`[SICAS-Sync-Manual] Cobranza sincronizada: ${results.cobranza_pendiente}`);
        }
      } else {
        const errorText = await cobranzaResponse.text();
        let errorMsg = errorText;
        try {
          errorMsg = JSON.parse(errorText).error || errorText;
        } catch (_) { /* use text as-is */ }
        results.errors.push(`Error en cobranza: ${errorMsg}`);
        console.error("[SICAS-Sync-Manual] Error en cobranza:", errorMsg);
      }
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
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
