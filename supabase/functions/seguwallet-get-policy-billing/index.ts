import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SicasSoapReportClient, SICAS_REPORT_KEYCODES } from "../_shared/sicasSoapReportClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  poliza: string;
  id_docto?: string | null;
}

interface BillingRecord {
  id_documento: string | null;
  no_poliza: string | null;
  cliente: string | null;
  importe: number | null;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  fecha_vencimiento: string | null;
  fecha_pago: string | null;
  status: string | null;
  forma_pago: string | null;
  moneda: string | null;
  serie: string | null;
  dias_vencidos: number | null;
  referencia: string | null;
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

    // ── Auth: resolve the calling Seguwallet customer ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SW-Billing] auth_user_id:", user.id);

    const body: RequestBody = await req.json();
    const { poliza, id_docto } = body;

    if (!poliza) {
      return new Response(JSON.stringify({ error: "poliza is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SW-Billing] poliza:", poliza, "id_docto:", id_docto);

    // ── Security: verify customer owns this policy ─────────────────────────
    const { data: customer } = await supabase
      .from("seguwallet_customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (!customer) {
      console.warn("[SW-Billing] customer not found for auth_user_id:", user.id);
      return new Response(JSON.stringify({ error: "Customer not found", receipts: [], source: "denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SW-Billing] customer_id:", customer.id);

    // Verify policy belongs to this customer's SICAS clients
    const { data: policyRow } = await supabase
      .from("sicas_documents")
      .select("id_docto, poliza, cliente, vend_id, vend_nombre")
      .eq("poliza", poliza)
      .eq("is_poliza", true)
      .maybeSingle();

    if (!policyRow) {
      console.warn("[SW-Billing] policy not found in sicas_documents:", poliza);
      return new Response(JSON.stringify({
        receipts: [], source: "not_found",
        message: "Poliza no encontrada en el sistema",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[SW-Billing] policy found - cliente:", policyRow.cliente, "id_docto:", policyRow.id_docto);

    // Check customer link
    const { data: link } = await supabase
      .from("seguwallet_customer_sicas_clients")
      .select("id")
      .eq("seguwallet_customer_id", customer.id)
      .eq("sicas_client_id", policyRow.cliente)
      .maybeSingle();

    if (!link) {
      console.warn("[SW-Billing] customer", customer.id, "does not own policy", poliza, "(cliente:", policyRow.cliente, ")");
      return new Response(JSON.stringify({ error: "Access denied", receipts: [], source: "denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SW-Billing] ownership verified - querying SICAS for receipts");

    // ── Query SICAS for receipts ────────────────────────────────────────────
    const sicasEndpoint = Deno.env.get("SICAS_ENDPOINT") ||
      "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";
    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");

    if (!sicasUsername || !sicasPassword) {
      throw new Error("SICAS credentials not configured");
    }

    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // Filter by the policy document number (Documento = poliza number in SICAS)
    const doctoRef = id_docto || policyRow.id_docto;
    const filters = [];

    // Filter by document number (poliza)
    filters.push(SicasSoapReportClient.createDocumentNumberFilter(poliza));

    // Also try by IDDocto if available
    if (doctoRef) {
      console.log("[SW-Billing] also filtering by IDDocto:", doctoRef);
    }

    console.log("[SW-Billing] executing SICAS report:", SICAS_REPORT_KEYCODES.COBRANZA_FILTROS);
    console.log("[SW-Billing] filters:", filters.length);

    const result = await client.executeReport({
      keyCode: SICAS_REPORT_KEYCODES.COBRANZA_FILTROS,
      page: 1,
      itemsPerPage: 200,
      sortField: "DatRecibos.FDesde",
      filters,
    });

    console.log("[SW-Billing] SICAS result success:", result.success);
    console.log("[SW-Billing] SICAS records:", result.records.length);
    console.log("[SW-Billing] SICAS message:", result.message);

    if (!result.success) {
      // Log internally but return friendly message
      await supabase.from("seguwallet_billing_logs").insert({
        customer_id: customer.id,
        poliza,
        id_docto: doctoRef,
        result: "sicas_error",
        records_returned: 0,
        error_message: result.message?.substring(0, 500),
      });

      return new Response(JSON.stringify({
        receipts: [],
        source: "sicas_unavailable",
        message: "El servicio de cobranza no esta disponible en este momento.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Normalize records ──────────────────────────────────────────────────
    const receipts: BillingRecord[] = result.records.map((r: any) => {
      const status = r.Status || r.Estatus || r.StatusRecibo || r.EstatusRecibo || null;
      const diasVenc = parseInt(String(r.DiasVencidos || r.Vencidos || "0"), 10) || 0;
      const fechaVenc = r.FVencimiento || r.FechaVencimiento || r.FLimite || r.FechaLimite || null;
      const fechaPago = r.FPago || r.FechaPago || null;

      return {
        id_documento:      r.IDRecibo || r.IdRecibo || r.IDDocto || r.IdDocto || r.Recibo || null,
        no_poliza:         r.Documento || r.NoPoliza || r.Poliza || poliza,
        cliente:           r.Cliente || r.Contratante || r.Asegurado || policyRow.cliente || null,
        importe:           parseFloat(String(r.Importe || r.ImporteTotal || r.ImporteRecibo || 0)) || null,
        fecha_desde:       r.FDesde || r.FechaDesde || r.FInicio || null,
        fecha_hasta:       r.FHasta || r.FechaHasta || r.FFin || null,
        fecha_vencimiento: fechaVenc,
        fecha_pago:        fechaPago,
        status,
        forma_pago:        r.FormaPago || r.FPago || null,
        moneda:            r.Moneda || r.Divisa || "MXN",
        serie:             r.Serie || r.Folio || r.SerieRecibo || null,
        dias_vencidos:     diasVenc,
        referencia:        r.Referencia || r.ReferenciaPago || null,
      };
    });

    console.log("[SW-Billing] normalized receipts:", receipts.length);

    // Log success
    await supabase.from("seguwallet_billing_logs").insert({
      customer_id: customer.id,
      poliza,
      id_docto: doctoRef,
      result: "success",
      records_returned: receipts.length,
    });

    return new Response(JSON.stringify({
      receipts,
      source: "sicas_live",
      total: receipts.length,
      poliza,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    const msg = String(error?.message ?? "Unknown error");
    console.error("[SW-Billing] Error:", msg);

    return new Response(JSON.stringify({
      receipts: [],
      source: "error",
      message: "No fue posible consultar la cobranza. Intenta nuevamente.",
      _debug: msg,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
