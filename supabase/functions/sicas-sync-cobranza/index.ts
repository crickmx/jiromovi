import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from '../_shared/sicasSoapReportClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CobranzaRecord {
  vend_id: string;
  vend_nombre?: string;
  cliente?: string;
  no_poliza?: string;
  id_documento?: string;
  importe_pendiente?: number;
  fecha_limite?: string;
  dias_vencidos?: number;
  status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[SICAS-Cobranza] Iniciando sincronización de cobranza pendiente");
    console.log(`[SICAS-Cobranza] Usando KeyCode: ${SICAS_REPORT_KEYCODES.COBRANZA_FILTROS}`);

    const sicasUsername = Deno.env.get('SICAS_USERNAME');
    const sicasPassword = Deno.env.get('SICAS_PASSWORD');
    const sicasEndpoint = Deno.env.get('SICAS_ENDPOINT') || 'https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx';

    if (!sicasUsername || !sicasPassword) {
      throw new Error('Credenciales SICAS no configuradas');
    }

    console.log("[SICAS-Cobranza] Configuración cargada, consultando reporte con filtros...");

    // Inicializar cliente SOAP con ProcesarWS
    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // Construir filtros para cobranza pendiente (Pagado + Liquidado)
    const filters = [
      SicasSoapReportClient.createCobranzaFilter(),
    ];

    console.log(`[SICAS-Cobranza] Filtros aplicados: ${filters.length}`);

    try {
      // Ejecutar reporte con el cliente oficial
      const result = await client.executeReport({
        keyCode: SICAS_REPORT_KEYCODES.COBRANZA_FILTROS,
        page: 1,
        itemsPerPage: 1000,
        sortField: 'DatRecibos.FDesde',
        filters,
      });

      console.log(`[SICAS-Cobranza] Respuesta recibida - Success: ${result.success}`);
      console.log(`[SICAS-Cobranza] Registros encontrados: ${result.records.length}`);

      if (!result.success) {
        console.warn(`[SICAS-Cobranza] Reporte no exitoso: ${result.message}`);

        // Si el código de reporte no existe, registrar como no disponible
        if (result.message?.toLowerCase().includes('codigo de reporte') ||
            result.message?.toLowerCase().includes('not found')) {
          console.log("[SICAS-Cobranza] Reporte de cobranza no disponible en esta instancia SICAS");

          // Limpiar tabla
          await supabase
            .from("sicas_cobranza_pendiente")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

          return new Response(
            JSON.stringify({
              success: true,
              message: `Reporte de cobranza (${SICAS_REPORT_KEYCODES.COBRANZA_FILTROS}) no disponible en SICAS`,
              records_count: 0,
              report_available: false
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(`SICAS Error: ${result.message}`);
      }

      // Convertir los registros al formato esperado
      const cobranzaRecords: CobranzaRecord[] = result.records.map((record: any) => ({
        vend_id: record.IDVend || record.IdVendedor || record.VendID || '0',
        vend_nombre: record.VendNombre || record.Vendedor || record.NombreVendedor || null,
        cliente: record.Cliente || record.Contratante || record.Asegurado || null,
        no_poliza: record.Documento || record.NoPoliza || record.Poliza || null,
        id_documento: record.IDDocto || record.IdDocumento || record.Recibo || null,
        importe_pendiente: record.ImportePendiente || record.Importe || record.ImporteTotal || 0,
        fecha_limite: record.FechaLimite || record.FVencimiento || record.FechaVencimiento || null,
        dias_vencidos: parseInt(String(record.DiasVencidos || record.Vencidos || 0)),
        status: record.Status || record.Estado || 'Pendiente',
      }));

      console.log(`[SICAS-Cobranza] ${cobranzaRecords.length} registros procesados`);

      if (cobranzaRecords.length === 0) {
        console.log("[SICAS-Cobranza] No se encontraron registros de cobranza");

        return new Response(
          JSON.stringify({
            success: true,
            message: "Sin registros de cobranza pendiente",
            records_count: 0
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Limpiar tabla anterior
      const { error: deleteError } = await supabase
        .from("sicas_cobranza_pendiente")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) {
        console.error("[SICAS-Cobranza] Error limpiando tabla:", deleteError);
      }

      // Insertar nuevos registros
      const { error: insertError } = await supabase
        .from("sicas_cobranza_pendiente")
        .insert(cobranzaRecords);

      if (insertError) {
        console.error("[SICAS-Cobranza] Error insertando registros:", insertError);
        throw insertError;
      }

      console.log(`[SICAS-Cobranza] Sincronización completada: ${cobranzaRecords.length} registros`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Cobranza sincronizada: ${cobranzaRecords.length} registros`,
          records_count: cobranzaRecords.length,
          report_available: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (error: any) {
      console.error('[SICAS-Cobranza] Error en consulta:', error.message);

      // Si el error es de código de reporte no encontrado
      if (error.message?.includes('Codigo de reporte no encontrado') ||
          error.message?.includes('not found')) {
        console.log("[SICAS-Cobranza] Reporte no disponible, limpiando tabla...");

        // Limpiar tabla
        await supabase
          .from("sicas_cobranza_pendiente")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");

        return new Response(
          JSON.stringify({
            success: true,
            message: `Reporte de cobranza (${SICAS_REPORT_KEYCODES.COBRANZA_FILTROS}) no disponible. Verifica con SICAS.`,
            records_count: 0,
            report_available: false
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw error;
    }

  } catch (error: any) {
    console.error("[SICAS-Cobranza] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
