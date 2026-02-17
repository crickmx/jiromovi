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

    // Sincronizar pólizas vigentes usando REST API
    let polizasMetadata: any = null;
    if (!syncType || syncType === 'polizas' || syncType === 'completa') {
      try {
        console.log('[SICAS-Sync-Manual] Llamando a sicas-get-polizas-vigentes-rest...');

        const polizasResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/sicas-get-polizas-vigentes-rest`,
          {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // Las fechas se asignan automáticamente en el edge function
            }),
          }
        );

        const polizasData = await polizasResponse.json();

        console.log('[SICAS-Sync-Manual] Respuesta REST:', {
          ok: polizasResponse.ok,
          status: polizasResponse.status,
          success: polizasData.success,
          polizasCount: polizasData.polizas?.length || 0
        });

        if (polizasResponse.ok && polizasData.success) {
          results.polizas_vigentes = polizasData.polizas?.length || 0;
          polizasMetadata = {
            source: 'REST API (HWSDOC)',
            records: results.polizas_vigentes,
            sicas_response: polizasData.metadata
          };
          console.log(`[SICAS-Sync-Manual] Pólizas sincronizadas: ${results.polizas_vigentes}`);

          // Verificar si hay warnings de SICAS
          if (polizasData.metadata?.warnings?.length > 0) {
            console.warn('[SICAS-Sync-Manual] Warnings:', polizasData.metadata.warnings);
          }
        } else {
          const errorMsg = polizasData.error || polizasData.message || 'Error desconocido en SICAS REST';
          results.errors.push(`Error en pólizas: ${errorMsg}`);
          console.error("[SICAS-Sync-Manual] Error en pólizas REST:", errorMsg);

          // Incluir metadata de error si está disponible
          if (polizasData.metadata) {
            polizasMetadata = polizasData.metadata;
          }
        }
      } catch (error) {
        const errorMsg = error.message || 'Error de conexión con SICAS REST';
        results.errors.push(`Error en pólizas: ${errorMsg}`);
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
