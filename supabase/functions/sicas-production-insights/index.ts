import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InsightsRequest {
  forceRefresh?: boolean;
}

interface LocalAlert {
  alert_type: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  client_name: string | null;
  policy_number: string | null;
  due_date: string | null;
  recommended_action: string | null;
  related_data: Record<string, unknown> | null;
}

interface LocalOpportunity {
  opportunity_type: string;
  priority: "high" | "medium" | "low";
  client_name: string;
  description: string;
  current_products: string[];
  suggested_product: string | null;
  premium_current: number;
  recommended_message: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuario no autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: InsightsRequest = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh ?? false;

    // Get user info for scope resolution
    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id, nombre_completo, nombres, apellido_paterno")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuarioData) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuario no encontrado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userRole = usuarioData.rol;
    const oficinaId = usuarioData.oficina_id;

    // Check cache (TTL 30 min) unless forceRefresh
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("sicas_production_insights_cache")
        .select("*")
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (cached) {
        const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
        const TTL_MS = 30 * 60 * 1000; // 30 minutes
        if (cacheAge < TTL_MS) {
          console.log(`[Insights] Returning cached result (age=${Math.round(cacheAge / 1000)}s)`);
          return new Response(
            JSON.stringify({
              success: true,
              alerts: cached.alerts,
              opportunities: cached.opportunities,
              ai_summary: cached.ai_summary,
              source: "cache",
              cached_at: cached.updated_at,
              diagnostics: cached.diagnostics,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Resolve vendor IDs for this user (scope-aware)
    const vendorFilter = await resolveVendorScope(supabase, user.id, userRole, oficinaId);

    console.log(`[Insights] User=${user.id}, role=${userRole}, vendorFilter=${JSON.stringify(vendorFilter)}`);

    // Query sicas_documents directly for insights data
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Build base query conditions
    let baseQuery = supabase.from("sicas_documents").select("*");
    if (vendorFilter.type === "vend_ids") {
      baseQuery = baseQuery.in("vend_id", vendorFilter.ids);
    } else if (vendorFilter.type === "oficina") {
      baseQuery = baseQuery.eq("oficina_id", vendorFilter.oficina_id);
    }
    // admin: no filter

    // 1. Renewals in next 30 days (high priority alerts)
    const { data: renewals30 } = await supabase
      .from("sicas_documents")
      .select("id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre")
      .eq("is_vigente", true)
      .eq("is_renewable", true)
      .gte("vigencia_hasta", now.toISOString())
      .lte("vigencia_hasta", thirtyDaysFromNow.toISOString())
      .order("vigencia_hasta", { ascending: true })
      .limit(100)
      .then(r => applyVendorFilter(r, vendorFilter));

    // 2. Renewals 30-60 days (medium priority)
    const { data: renewals60 } = await supabase
      .from("sicas_documents")
      .select("id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre")
      .eq("is_vigente", true)
      .eq("is_renewable", true)
      .gt("vigencia_hasta", thirtyDaysFromNow.toISOString())
      .lte("vigencia_hasta", sixtyDaysFromNow.toISOString())
      .order("vigencia_hasta", { ascending: true })
      .limit(50)
      .then(r => applyVendorFilter(r, vendorFilter));

    // 3. Recently expired (last 30 days - reactivation opportunity)
    const { data: recentExpired } = await supabase
      .from("sicas_documents")
      .select("id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre")
      .eq("is_vigente", false)
      .eq("is_cancelada", false)
      .gte("vigencia_hasta", thirtyDaysAgo.toISOString())
      .lte("vigencia_hasta", now.toISOString())
      .order("prima_neta", { ascending: false })
      .limit(50)
      .then(r => applyVendorFilter(r, vendorFilter));

    // 4. Active policies by client (for cross-sell detection)
    const { data: activeByClient } = await supabase
      .from("sicas_documents")
      .select("cliente, ramo, compania, prima_neta, prima_total")
      .eq("is_vigente", true)
      .order("prima_neta", { ascending: false })
      .limit(2000)
      .then(r => applyVendorFilter(r, vendorFilter));

    // 5. Concentration analysis
    const { data: topClients } = await supabase
      .from("sicas_documents")
      .select("cliente, prima_neta")
      .eq("is_vigente", true)
      .order("prima_neta", { ascending: false })
      .limit(500)
      .then(r => applyVendorFilter(r, vendorFilter));

    // 6. Total vigente count for diagnostics
    const { count: totalVigentes } = await supabase
      .from("sicas_documents")
      .select("id", { count: "exact", head: true })
      .eq("is_vigente", true);

    // Generate local alerts
    const alerts = generateLocalAlerts(
      renewals30 || [],
      renewals60 || [],
      recentExpired || [],
      activeByClient || [],
      topClients || []
    );

    // Generate local opportunities
    const opportunities = generateLocalOpportunities(
      activeByClient || [],
      recentExpired || [],
      renewals30 || []
    );

    // Try AI enhancement (non-blocking)
    let aiSummary: string | null = null;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && (alerts.length > 0 || opportunities.length > 0)) {
      try {
        aiSummary = await generateAISummary(
          openaiKey,
          alerts,
          opportunities,
          {
            totalVigentes: totalVigentes || 0,
            renewals30Count: renewals30?.length || 0,
            renewals60Count: renewals60?.length || 0,
            expiredCount: recentExpired?.length || 0,
            userName: usuarioData.nombre_completo || usuarioData.nombres || "Agente",
          }
        );
      } catch (aiErr: any) {
        console.error("[Insights] AI summary failed (non-blocking):", aiErr.message);
      }
    }

    // Persist alerts and opportunities to tables
    await persistAlerts(supabase, user.id, vendorFilter, oficinaId, alerts);
    await persistOpportunities(supabase, user.id, vendorFilter, oficinaId, opportunities);

    // Update cache
    const diagnostics = {
      total_vigentes: totalVigentes || 0,
      renewals_30: renewals30?.length || 0,
      renewals_60: renewals60?.length || 0,
      expired_recent: recentExpired?.length || 0,
      active_clients: new Set((activeByClient || []).map(d => d.cliente)).size,
      alerts_generated: alerts.length,
      opportunities_generated: opportunities.length,
      ai_available: !!openaiKey,
      ai_used: !!aiSummary,
      role: userRole,
      generated_at: now.toISOString(),
    };

    await supabase.from("sicas_production_insights_cache").upsert({
      usuario_id: user.id,
      alerts,
      opportunities,
      ai_summary: aiSummary,
      diagnostics,
      updated_at: now.toISOString(),
    }, { onConflict: "usuario_id" });

    console.log(`[Insights] Generated ${alerts.length} alerts, ${opportunities.length} opportunities, AI=${!!aiSummary}`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        opportunities,
        ai_summary: aiSummary,
        source: "fresh",
        diagnostics,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Insights] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// === Vendor Scope Resolution ===

interface VendorScope {
  type: "all" | "oficina" | "vend_ids";
  ids: string[];
  oficina_id?: string;
}

async function resolveVendorScope(
  supabase: any,
  userId: string,
  role: string,
  oficinaId: string | null
): Promise<VendorScope> {
  if (role === "Administrador") {
    return { type: "all", ids: [] };
  }

  if (role === "Gerente" && oficinaId) {
    return { type: "oficina", ids: [], oficina_id: oficinaId };
  }

  // Agent: resolve vend_ids from vendor_mappings
  const { data: mappings } = await supabase
    .from("vendor_mappings")
    .select("vendor_sicas_id")
    .eq("usuario_id", userId)
    .not("vendor_sicas_id", "is", null);

  const ids = (mappings || []).map((m: any) => m.vendor_sicas_id).filter(Boolean);
  return { type: "vend_ids", ids };
}

function applyVendorFilter(result: any, scope: VendorScope): any {
  if (!result.data) return { data: [] };
  if (scope.type === "all") return result;
  if (scope.type === "oficina") {
    return { data: result.data.filter((d: any) => d.oficina_id === scope.oficina_id) };
  }
  if (scope.type === "vend_ids" && scope.ids.length > 0) {
    return { data: result.data.filter((d: any) => scope.ids.includes(d.vend_id)) };
  }
  return result;
}

// === Local Alert Generation ===

function generateLocalAlerts(
  renewals30: any[],
  renewals60: any[],
  recentExpired: any[],
  activeByClient: any[],
  topClients: any[]
): LocalAlert[] {
  const alerts: LocalAlert[] = [];

  // 1. Renewals in 7 days (critical)
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const critical = renewals30.filter(d => new Date(d.vigencia_hasta) <= sevenDays);
  for (const doc of critical.slice(0, 10)) {
    const daysLeft = Math.ceil((new Date(doc.vigencia_hasta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    alerts.push({
      alert_type: "renewal_upcoming",
      priority: "high",
      title: `Renovacion en ${daysLeft} dias: ${doc.cliente || "Sin nombre"}`,
      description: `Poliza ${doc.poliza || doc.id_docto} de ${doc.compania || "N/A"} (${doc.ramo || "N/A"}) vence el ${formatDateShort(doc.vigencia_hasta)}`,
      client_name: doc.cliente,
      policy_number: doc.poliza,
      due_date: doc.vigencia_hasta,
      recommended_action: "Contactar al cliente para renovacion antes de vencimiento",
      related_data: { prima_neta: doc.prima_neta, ramo: doc.ramo, compania: doc.compania },
    });
  }

  // 2. Renewals 8-30 days (medium)
  const medium = renewals30.filter(d => new Date(d.vigencia_hasta) > sevenDays);
  for (const doc of medium.slice(0, 15)) {
    const daysLeft = Math.ceil((new Date(doc.vigencia_hasta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    alerts.push({
      alert_type: "renewal_upcoming",
      priority: "medium",
      title: `Renovacion en ${daysLeft} dias: ${doc.cliente || "Sin nombre"}`,
      description: `${doc.compania || "N/A"} - ${doc.ramo || "N/A"} | Prima: $${formatNum(doc.prima_neta)}`,
      client_name: doc.cliente,
      policy_number: doc.poliza,
      due_date: doc.vigencia_hasta,
      recommended_action: "Preparar propuesta de renovacion",
      related_data: { prima_neta: doc.prima_neta, ramo: doc.ramo, daysLeft },
    });
  }

  // 3. Recently expired policies (reactivation alert)
  for (const doc of recentExpired.slice(0, 5)) {
    alerts.push({
      alert_type: "policy_expired",
      priority: "medium",
      title: `Poliza vencida: ${doc.cliente || "Sin nombre"}`,
      description: `${doc.poliza || doc.id_docto} vencio el ${formatDateShort(doc.vigencia_hasta)} | Prima: $${formatNum(doc.prima_neta)}`,
      client_name: doc.cliente,
      policy_number: doc.poliza,
      due_date: doc.vigencia_hasta,
      recommended_action: "Contactar cliente para reactivacion o nueva poliza",
      related_data: { prima_neta: doc.prima_neta, ramo: doc.ramo, compania: doc.compania },
    });
  }

  // 4. Concentration risk (if top client > 30% of portfolio)
  if (topClients.length > 5) {
    const totalPrima = topClients.reduce((s, d) => s + (d.prima_neta || 0), 0);
    if (totalPrima > 0) {
      const clientMap = new Map<string, number>();
      for (const d of topClients) {
        const name = d.cliente || "Sin nombre";
        clientMap.set(name, (clientMap.get(name) || 0) + (d.prima_neta || 0));
      }
      const sorted = [...clientMap.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0 && sorted[0][1] / totalPrima > 0.3) {
        alerts.push({
          alert_type: "production_low",
          priority: "low",
          title: "Concentracion de cartera elevada",
          description: `${sorted[0][0]} representa el ${Math.round(sorted[0][1] / totalPrima * 100)}% de tu prima vigente. Diversifica para reducir riesgo.`,
          client_name: sorted[0][0],
          policy_number: null,
          due_date: null,
          recommended_action: "Buscar nuevos prospectos para diversificar tu cartera",
          related_data: { concentration_pct: Math.round(sorted[0][1] / totalPrima * 100), top_client_prima: sorted[0][1] },
        });
      }
    }
  }

  // 5. High-value renewals (top 20% by prima)
  if (renewals60.length > 0) {
    const allRenewals = [...renewals30, ...renewals60];
    const avgPrima = allRenewals.reduce((s, d) => s + (d.prima_neta || 0), 0) / (allRenewals.length || 1);
    const highValue = renewals60.filter(d => (d.prima_neta || 0) > avgPrima * 2);
    for (const doc of highValue.slice(0, 3)) {
      alerts.push({
        alert_type: "high_value_renewal",
        priority: "high",
        title: `Renovacion alto valor: ${doc.cliente || "Sin nombre"}`,
        description: `Prima $${formatNum(doc.prima_neta)} en ${doc.compania || "N/A"} vence en ${Math.ceil((new Date(doc.vigencia_hasta).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} dias`,
        client_name: doc.cliente,
        policy_number: doc.poliza,
        due_date: doc.vigencia_hasta,
        recommended_action: "Priorizar contacto y preparar cotizacion competitiva",
        related_data: { prima_neta: doc.prima_neta, ramo: doc.ramo },
      });
    }
  }

  return alerts;
}

// === Local Opportunity Generation ===

function generateLocalOpportunities(
  activeByClient: any[],
  recentExpired: any[],
  renewals: any[]
): LocalOpportunity[] {
  const opportunities: LocalOpportunity[] = [];

  // Group active policies by client
  const clientProducts = new Map<string, { ramos: Set<string>; prima: number; aseguradoras: Set<string> }>();
  for (const doc of activeByClient) {
    const name = doc.cliente || "Sin nombre";
    if (!clientProducts.has(name)) {
      clientProducts.set(name, { ramos: new Set(), prima: 0, aseguradoras: new Set() });
    }
    const entry = clientProducts.get(name)!;
    if (doc.ramo) entry.ramos.add(doc.ramo);
    if (doc.compania) entry.aseguradoras.add(doc.compania);
    entry.prima += doc.prima_neta || 0;
  }

  // Cross-sell: clients with only 1 product type
  const allRamos = new Set<string>();
  for (const [, v] of clientProducts) {
    for (const r of v.ramos) allRamos.add(r);
  }

  for (const [clientName, data] of clientProducts) {
    if (data.ramos.size === 1 && data.prima > 5000) {
      const currentRamo = [...data.ramos][0];
      let suggested: string | null = null;
      let oppType = "single_policy";

      if (currentRamo.toLowerCase().includes("auto")) {
        suggested = "GMM / Gastos Medicos";
        oppType = "auto_sin_gmm";
      } else if (currentRamo.toLowerCase().includes("vida")) {
        suggested = "GMM / Gastos Medicos";
        oppType = "vida_sin_gmm";
      } else if (currentRamo.toLowerCase().includes("medico") || currentRamo.toLowerCase().includes("gmm")) {
        suggested = "Vida / Seguro de Vida";
        oppType = "diversification";
      } else if (currentRamo.toLowerCase().includes("hogar") || currentRamo.toLowerCase().includes("casa")) {
        suggested = "Auto / Seguro Vehicular";
        oppType = "diversification";
      } else {
        suggested = "Otro ramo complementario";
      }

      if (opportunities.length < 30) {
        opportunities.push({
          opportunity_type: oppType,
          priority: data.prima > 20000 ? "high" : data.prima > 10000 ? "medium" : "low",
          client_name: clientName,
          description: `Cliente con solo ${currentRamo}. Ofrecer ${suggested} para complementar proteccion.`,
          current_products: [currentRamo],
          suggested_product: suggested,
          premium_current: data.prima,
          recommended_message: `Hola, notamos que tienes tu poliza de ${currentRamo}. Te gustaria conocer opciones de ${suggested}?`,
        });
      }
    }
  }

  // High-value clients (potential upgrades)
  const sortedClients = [...clientProducts.entries()].sort((a, b) => b[1].prima - a[1].prima);
  for (const [clientName, data] of sortedClients.slice(0, 5)) {
    if (data.prima > 50000 && data.ramos.size >= 2) {
      if (opportunities.length < 40) {
        opportunities.push({
          opportunity_type: "high_value_client",
          priority: "high",
          client_name: clientName,
          description: `Cliente de alto valor ($${formatNum(data.prima)}) con ${data.ramos.size} ramos. Ideal para plan integral o upgrade de coberturas.`,
          current_products: [...data.ramos],
          suggested_product: "Plan Integral / Upgrade coberturas",
          premium_current: data.prima,
          recommended_message: null,
        });
      }
    }
  }

  // Reactivation opportunities (recently expired high-value)
  for (const doc of recentExpired.slice(0, 8)) {
    if ((doc.prima_neta || 0) > 5000 && opportunities.length < 50) {
      opportunities.push({
        opportunity_type: "recoverable_policy",
        priority: (doc.prima_neta || 0) > 20000 ? "high" : "medium",
        client_name: doc.cliente || "Sin nombre",
        description: `Poliza ${doc.ramo || "N/A"} vencida recientemente. Contactar para reactivar o cotizar nueva.`,
        current_products: [doc.ramo || "N/A"],
        suggested_product: doc.ramo || "Mismo ramo",
        premium_current: doc.prima_neta || 0,
        recommended_message: `Hola, tu poliza de ${doc.ramo || "seguros"} vencio recientemente. Te gustaria renovarla o ver nuevas opciones?`,
      });
    }
  }

  // Sort by priority and premium
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  opportunities.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.premium_current - a.premium_current;
  });

  return opportunities.slice(0, 50);
}

// === AI Summary Generation ===

async function generateAISummary(
  apiKey: string,
  alerts: LocalAlert[],
  opportunities: LocalOpportunity[],
  context: { totalVigentes: number; renewals30Count: number; renewals60Count: number; expiredCount: number; userName: string }
): Promise<string | null> {
  const highAlerts = alerts.filter(a => a.priority === "high");
  const highOpps = opportunities.filter(o => o.priority === "high");
  const totalPrimaOpp = opportunities.reduce((s, o) => s + o.premium_current, 0);

  const prompt = `Eres un asistente de seguros. Resume en 3-4 oraciones la situacion comercial del agente basandote en estos datos:
- Polizas vigentes: ${context.totalVigentes}
- Renovaciones proximas 30 dias: ${context.renewals30Count}
- Renovaciones proximas 60 dias: ${context.renewals60Count}
- Polizas vencidas recientes: ${context.expiredCount}
- Alertas de alta prioridad: ${highAlerts.length} (${highAlerts.slice(0, 3).map(a => a.title).join("; ")})
- Oportunidades detectadas: ${opportunities.length} (prima potencial ~$${formatNum(totalPrimaOpp)})
- Top oportunidades: ${highOpps.slice(0, 3).map(o => `${o.client_name}: ${o.opportunity_type}`).join("; ")}

Responde en espanol, en un tono profesional y conciso. Enfocate en acciones prioritarias para ${context.userName}.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || null;
}

// === Persist to DB ===

async function persistAlerts(
  supabase: any,
  userId: string,
  vendorScope: VendorScope,
  oficinaId: string | null,
  alerts: LocalAlert[]
): Promise<void> {
  // Clear old alerts for this user (keep dismissed)
  await supabase
    .from("sicas_agent_alerts")
    .delete()
    .eq("usuario_id", userId)
    .neq("status", "dismissed");

  if (alerts.length === 0) return;

  const vendId = vendorScope.type === "vend_ids" && vendorScope.ids.length > 0 ? vendorScope.ids[0] : null;

  const rows = alerts.map(a => ({
    usuario_id: userId,
    sicas_vendor_id: vendId,
    oficina_id: oficinaId,
    alert_type: a.alert_type,
    priority: a.priority,
    title: a.title,
    description: a.description,
    client_name: a.client_name,
    policy_number: a.policy_number,
    due_date: a.due_date,
    recommended_action: a.recommended_action,
    related_data: a.related_data,
    status: "new",
  }));

  await supabase.from("sicas_agent_alerts").insert(rows);
}

async function persistOpportunities(
  supabase: any,
  userId: string,
  vendorScope: VendorScope,
  oficinaId: string | null,
  opportunities: LocalOpportunity[]
): Promise<void> {
  // Clear old opportunities for this user (keep contacted)
  await supabase
    .from("sicas_cross_sell_opportunities")
    .delete()
    .eq("usuario_id", userId)
    .neq("status", "contacted");

  if (opportunities.length === 0) return;

  const vendId = vendorScope.type === "vend_ids" && vendorScope.ids.length > 0 ? vendorScope.ids[0] : null;

  const rows = opportunities.map(o => ({
    usuario_id: userId,
    sicas_vendor_id: vendId,
    oficina_id: oficinaId,
    client_name: o.client_name,
    opportunity_type: o.opportunity_type,
    description: o.description,
    current_products: o.current_products,
    suggested_product: o.suggested_product,
    priority: o.priority,
    recommended_message: o.recommended_message,
    premium_current: o.premium_current,
    status: "new",
  }));

  await supabase.from("sicas_cross_sell_opportunities").insert(rows);
}

// === Helpers ===

function formatNum(n: number): string {
  if (!n) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}
