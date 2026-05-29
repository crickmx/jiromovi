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

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Auth ───────────────────────────────────────────────────────────────────
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

    const body: RequestBody = await req.json();
    const { poliza, id_docto } = body;

    if (!poliza) {
      return new Response(JSON.stringify({ error: "poliza is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("=== [SW-Billing] ============================");
    console.log("[SW-Billing] POLIZA:", poliza);
    console.log("[SW-Billing] ID_DOCTO_CLIENT:", id_docto);
    console.log("[SW-Billing] AUTH_USER_ID:", user.id);

    // ── Resolve Seguwallet customer ────────────────────────────────────────────
    const { data: customer, error: custErr } = await supabase
      .from("seguwallet_customers")
      .select("id, email")
      .eq("auth_user_id", user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    if (custErr) console.error("[SW-Billing] custErr:", custErr.message);
    if (!customer) {
      console.warn("[SW-Billing] No customer for auth_user_id:", user.id);
      return new Response(JSON.stringify({ error: "Customer not found", receipts: [], source: "denied", error_code: "customer_not_found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[SW-Billing] CUSTOMER_ID:", customer.id, "EMAIL:", customer.email);

    // ── Resolve policy from sicas_documents ───────────────────────────────────
    const { data: policyRow, error: polErr } = await supabase
      .from("sicas_documents")
      .select("id_docto, poliza, cliente, vend_id, vend_nombre, ramo")
      .eq("poliza", poliza)
      .eq("is_poliza", true)
      .maybeSingle();

    if (polErr) console.error("[SW-Billing] polErr:", polErr.message);
    if (!policyRow) {
      console.warn("[SW-Billing] Policy not in sicas_documents:", poliza);
      return new Response(JSON.stringify({
        receipts: [], source: "not_found", error_code: "policy_not_found",
        message: "Poliza no encontrada en el sistema",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const doctoRef = id_docto || policyRow.id_docto;

    console.log("[SW-Billing] POLICY: poliza=" + policyRow.poliza
      + " | id_docto=" + policyRow.id_docto
      + " | cliente=" + policyRow.cliente
      + " | vend_id=" + policyRow.vend_id
      + " | vend_nombre=" + policyRow.vend_nombre
      + " | ramo=" + policyRow.ramo);
    console.log("[SW-Billing] DOCTO_REF:", doctoRef);

    // ── Verify ownership ───────────────────────────────────────────────────────
    const { data: link, error: linkErr } = await supabase
      .from("seguwallet_customer_sicas_clients")
      .select("id, sicas_client_id")
      .eq("seguwallet_customer_id", customer.id)
      .eq("sicas_client_id", policyRow.cliente)
      .maybeSingle();

    if (linkErr) console.error("[SW-Billing] linkErr:", linkErr.message);
    if (!link) {
      const { data: allLinks } = await supabase
        .from("seguwallet_customer_sicas_clients")
        .select("sicas_client_id")
        .eq("seguwallet_customer_id", customer.id);
      console.warn("[SW-Billing] OWNERSHIP FAILED. Policy cliente:", policyRow.cliente);
      console.warn("[SW-Billing] Customer linked clients:", allLinks?.map((l: any) => l.sicas_client_id).join(" | ") || "none");
      return new Response(JSON.stringify({
        error: "Access denied", error_code: "ownership_denied", receipts: [], source: "denied",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[SW-Billing] OWNERSHIP OK:", link.sicas_client_id);

    // ── SICAS credentials ─────────────────────────────────────────────────────
    const sicasEndpoint = Deno.env.get("SICAS_ENDPOINT") ||
      "https://www.sicasonline.com/SICASOnline/WS_SICASOnline.asmx";
    const sicasUsername = Deno.env.get("SICAS_USERNAME");
    const sicasPassword = Deno.env.get("SICAS_PASSWORD");

    if (!sicasUsername || !sicasPassword) {
      throw new Error("SICAS credentials not configured");
    }

    console.log("[SW-Billing] SICAS endpoint:", sicasEndpoint);
    console.log("[SW-Billing] KEYCODE:", SICAS_REPORT_KEYCODES.COBRANZA_FILTROS);
    console.log("[SW-Billing] NOTE: NO status filter — querying ALL receipt statuses");

    const client = new SicasSoapReportClient({
      endpoint: sicasEndpoint,
      username: sicasUsername,
      password: sicasPassword,
    });

    // ── Strategy 1: Filter by Documento (policy number) ───────────────────────
    // CRITICAL: Do NOT use createCobranzaFilter() here.
    // That filter restricts to status=3(Pagado) + status=4(Liquidado) ONLY.
    // It would exclude all pending, overdue, and upcoming receipts.
    // We query ALL statuses for this specific policy number.
    console.log("[SW-Billing] S1: VDatDocumentos.Documento =", poliza);

    let result: any;
    let usedStrategy = "s1_documento";

    try {
      result = await client.executeReport({
        keyCode: SICAS_REPORT_KEYCODES.COBRANZA_FILTROS,
        page: 1,
        itemsPerPage: 500,
        sortField: "DatRecibos.FDesde",
        filters: [SicasSoapReportClient.createDocumentNumberFilter(poliza)],
      });

      console.log("[SW-Billing] S1 success=" + result.success + " records=" + result.records.length + " msg=" + (result.message || "").substring(0, 150));
      if (result.records.length > 0) {
        console.log("[SW-Billing] S1 FIELDS:", Object.keys(result.records[0]).join(","));
        console.log("[SW-Billing] S1 FIRST:", JSON.stringify(result.records[0]));
      }
    } catch (err1: any) {
      const msg1 = String(err1?.message ?? err1);
      const elapsed1 = Date.now() - startTime;
      console.error("[SW-Billing] S1 EXCEPTION:", msg1, "elapsed:", elapsed1 + "ms");
      const isTimeout = msg1.toLowerCase().includes("timeout") || msg1.toLowerCase().includes("45 seg");
      return new Response(JSON.stringify({
        receipts: [], source: isTimeout ? "timeout" : "sicas_error",
        error_code: isTimeout ? "sicas_timeout" : "sicas_error",
        message: isTimeout
          ? "El servicio de cobranza no respondio a tiempo."
          : "No fue posible consultar la cobranza en SICAS.",
        _debug: { error: msg1, elapsed_ms: elapsed1, strategy: "s1_documento", poliza, id_docto: doctoRef },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Strategy 2: Filter by IDDocto ─────────────────────────────────────────
    if (result.records.length === 0 && doctoRef && doctoRef !== poliza) {
      console.log("[SW-Billing] S2: VDatDocumentos.IDDocto =", doctoRef);
      usedStrategy = "s2_iddocto";
      try {
        const r2 = await client.executeReport({
          keyCode: SICAS_REPORT_KEYCODES.COBRANZA_FILTROS,
          page: 1,
          itemsPerPage: 500,
          sortField: "DatRecibos.FDesde",
          filters: [SicasSoapReportClient.createDocumentIdFilter(doctoRef)],
        });
        console.log("[SW-Billing] S2 records=" + r2.records.length + " msg=" + (r2.message || "").substring(0, 100));
        if (r2.records.length > 0) {
          console.log("[SW-Billing] S2 FIELDS:", Object.keys(r2.records[0]).join(","));
          console.log("[SW-Billing] S2 FIRST:", JSON.stringify(r2.records[0]));
          result = r2;
        }
      } catch (err2: any) {
        console.error("[SW-Billing] S2 EXCEPTION:", String(err2?.message ?? err2));
      }
    }

    // ── Strategy 3: Vendor-scoped, match client-side by poliza ───────────────
    if (result.records.length === 0 && policyRow.vend_id) {
      console.log("[SW-Billing] S3: vendor vend_id =", policyRow.vend_id, "then filter by poliza");
      usedStrategy = "s3_vendedor";
      try {
        const r3 = await client.executeReport({
          keyCode: SICAS_REPORT_KEYCODES.COBRANZA_FILTROS,
          page: 1,
          itemsPerPage: 500,
          sortField: "DatRecibos.FDesde",
          filters: [SicasSoapReportClient.createVendorFilter(
            [policyRow.vend_id],
            [policyRow.vend_nombre || policyRow.vend_id]
          )],
        });
        console.log("[SW-Billing] S3 raw records=" + r3.records.length);
        if (r3.records.length > 0) {
          console.log("[SW-Billing] S3 FIELDS:", Object.keys(r3.records[0]).join(","));
          const polizaCandidates = ["Documento", "NoPoliza", "Poliza", "NumPoliza", "NoPol"];
          const matched = r3.records.filter((r: any) => {
            for (const f of polizaCandidates) {
              if (r[f] && String(r[f]).trim() === poliza.trim()) return true;
            }
            return false;
          });
          const sampleVals = r3.records.slice(0, 5).map((r: any) =>
            r["Documento"] || r["NoPoliza"] || r["Poliza"] || "?"
          );
          console.log("[SW-Billing] S3 matched=" + matched.length + "/" + r3.records.length + " sample_polizas=" + sampleVals.join(","));
          if (matched.length > 0) result = { ...r3, records: matched };
        }
      } catch (err3: any) {
        console.error("[SW-Billing] S3 EXCEPTION:", String(err3?.message ?? err3));
      }
    }

    const elapsed = Date.now() - startTime;
    console.log("[SW-Billing] DONE: strategy=" + usedStrategy + " records=" + result.records.length + " elapsed=" + elapsed + "ms");

    // ── Audit ─────────────────────────────────────────────────────────────────
    await supabase.from("seguwallet_billing_logs").insert({
      customer_id: customer.id,
      poliza,
      id_docto: doctoRef,
      result: result.records.length > 0 ? "success" : "no_data",
      records_returned: result.records.length,
      error_message: result.records.length === 0
        ? ("strategy=" + usedStrategy + " | msg=" + (result.message || "").substring(0, 200))
        : null,
    });

    if (result.records.length === 0) {
      const isErr = result.message && /error|falla|fail/i.test(result.message);
      return new Response(JSON.stringify({
        receipts: [], total: 0, poliza,
        source: isErr ? "sicas_error" : "no_data",
        error_code: isErr ? "sicas_error" : "no_receipts",
        _debug: {
          strategy: usedStrategy, elapsed_ms: elapsed,
          sicas_message: result.message,
          ramo: policyRow.ramo,
          id_docto_used: doctoRef,
          vend_id: policyRow.vend_id,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Normalize records ─────────────────────────────────────────────────────
    const receipts: (BillingRecord & { _debug_fields: string })[] = result.records.map((r: any) => ({
      id_documento:      r.IDRecibo != null ? String(r.IDRecibo) : r.IdRecibo != null ? String(r.IdRecibo) : r.Recibo != null ? String(r.Recibo) : r.IDDocto != null ? String(r.IDDocto) : null,
      no_poliza:         String(r.Documento ?? r.NoPoliza ?? r.Poliza ?? r.NumPoliza ?? poliza),
      cliente:           String(r.Cliente ?? r.Contratante ?? r.Asegurado ?? policyRow.cliente ?? ""),
      importe:           parseFloat(String(r.Importe ?? r.ImporteTotal ?? r.ImporteRecibo ?? r.ImportePendiente ?? r.Monto ?? 0)) || null,
      fecha_desde:       r.FDesde != null ? String(r.FDesde) : r.FechaDesde != null ? String(r.FechaDesde) : null,
      fecha_hasta:       r.FHasta != null ? String(r.FHasta) : r.FechaHasta != null ? String(r.FechaHasta) : null,
      fecha_vencimiento: r.FVencimiento != null ? String(r.FVencimiento) : r.FechaVencimiento != null ? String(r.FechaVencimiento) : r.FLimite != null ? String(r.FLimite) : r.FechaLimite != null ? String(r.FechaLimite) : null,
      fecha_pago:        r.FPago != null ? String(r.FPago) : r.FechaPago != null ? String(r.FechaPago) : r.FCobro != null ? String(r.FCobro) : null,
      status:            r.Status != null ? String(r.Status) : r.Estatus != null ? String(r.Estatus) : r.StatusRecibo != null ? String(r.StatusRecibo) : null,
      forma_pago:        r.FormaPago != null ? String(r.FormaPago) : r.Fpago != null ? String(r.Fpago) : null,
      moneda:            String(r.Moneda ?? r.Divisa ?? "MXN"),
      serie:             r.Serie != null ? String(r.Serie) : r.Folio != null ? String(r.Folio) : r.NoRecibo != null ? String(r.NoRecibo) : null,
      dias_vencidos:     parseInt(String(r.DiasVencidos ?? r.Vencidos ?? r.DiasMora ?? "0"), 10) || 0,
      referencia:        r.Referencia != null ? String(r.Referencia) : r.ReferenciaPago != null ? String(r.ReferenciaPago) : r.ClavePago != null ? String(r.ClavePago) : null,
      _debug_fields:     Object.keys(r).join(","),
    }));

    return new Response(JSON.stringify({
      receipts,
      source: "sicas_live",
      total: receipts.length,
      poliza,
      _debug: {
        strategy: usedStrategy, elapsed_ms: elapsed,
        ramo: policyRow.ramo,
        cliente: policyRow.cliente,
        id_docto_used: doctoRef,
        first_record_fields: Object.keys(result.records[0]).join(","),
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    const msg = String(error?.message ?? "Unknown error");
    const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("45 seg");
    console.error("[SW-Billing] FATAL:", msg, "elapsed:", elapsed + "ms");
    return new Response(JSON.stringify({
      receipts: [],
      source: isTimeout ? "timeout" : "error",
      error_code: isTimeout ? "sicas_timeout" : "internal_error",
      message: isTimeout
        ? "El servicio de cobranza no respondio a tiempo."
        : "Error interno al consultar la cobranza.",
      _debug: { error: msg, elapsed_ms: elapsed },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
