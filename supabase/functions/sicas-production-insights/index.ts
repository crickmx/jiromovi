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

interface VendorScope {
  type: "all" | "oficina" | "vend_ids";
  ids: string[];
  oficina_id?: string;
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRole(rol: string | null): string {
  if (!rol) return "agente";
  const r = rol.toLowerCase().trim();
  if (r === "admin" || r === "administrador") return "administrador";
  if (r === "gerente" || r === "manager") return "gerente";
  if (r === "empleado" || r === "employee" || r === "ejecutivo") return "empleado";
  return "agente";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Authenticate user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, status: "unauthenticated", error: "No authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log("[sicas-production-insights] Auth failed:", authError?.message);
      return jsonResponse({ success: false, status: "unauthenticated", error: "No autenticado. Tu sesion pudo haber expirado." }, 401);
    }

    console.log("[sicas-production-insights] auth user id:", user.id);
    console.log("[sicas-production-insights] auth user email:", user.email);

    const body: InsightsRequest = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh ?? false;

    // 2. Look up user profile using service role (bypasses RLS)
    const { data: usuarioData, error: profileError } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id, nombre_completo, nombre, apellidos, email_laboral, activo")
      .eq("id", user.id)
      .maybeSingle();

    console.log("[sicas-production-insights] profile lookup by id:", user.id);
    console.log("[sicas-production-insights] profile found:", !!usuarioData);
    console.log("[sicas-production-insights] profile error:", profileError?.message || "none");

    // If not found by id, try email fallback
    let profile = usuarioData;
    if (!profile && user.email) {
      const { data: byEmail } = await supabase
        .from("usuarios")
        .select("id, rol, oficina_id, nombre_completo, nombre, apellidos, email_laboral, activo")
        .eq("email_laboral", user.email)
        .maybeSingle();
      if (byEmail) {
        console.log("[sicas-production-insights] profile found via email fallback, usuario_id:", byEmail.id);
        profile = byEmail;
      }
    }

    if (!profile) {
      return jsonResponse({
        success: false,
        status: "profile_missing",
        error: "No se encontro perfil MOVI para este usuario. Configura su perfil antes de generar insights.",
        auth_user_id: user.id,
        email: user.email,
      }, 200);
    }

    if (profile.activo === false) {
      return jsonResponse({
        success: false,
        status: "user_inactive",
        error: "Tu cuenta esta inactiva. Contacta a tu administrador.",
      }, 200);
    }

    const role = normalizeRole(profile.rol);
    const oficinaId = profile.oficina_id;
    const userName = profile.nombre_completo || profile.nombre || "Agente";

    console.log("[sicas-production-insights] resolved role:", role, "(raw:", profile.rol, ")");
    console.log("[sicas-production-insights] oficina_id:", oficinaId);

    // 3. Check cache (TTL 30 min) unless forceRefresh
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("sicas_production_insights_cache")
        .select("*")
        .eq("usuario_id", profile.id)
        .maybeSingle();

      if (cached) {
        const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
        const TTL_MS = 30 * 60 * 1000;
        if (cacheAge < TTL_MS) {
          console.log(`[sicas-production-insights] Returning cached result (age=${Math.round(cacheAge / 1000)}s)`);
          return jsonResponse({
            success: true,
            alerts: cached.alerts,
            opportunities: cached.opportunities,
            ai_summary: cached.ai_summary,
            source: "cache",
            cached_at: cached.updated_at,
            diagnostics: cached.diagnostics,
            scope: { role, office_id: oficinaId },
          }, 200);
        }
      }
    }

    // 4. Resolve vendor scope based on role
    const vendorScope = await resolveVendorScope(supabase, profile.id, role, oficinaId);

    console.log("[sicas-production-insights] vendor scope:", JSON.stringify(vendorScope));

    // 5. If agent has no vendor mapping, return helpful diagnostic instead of error
    if (vendorScope.type === "vend_ids" && vendorScope.ids.length === 0) {
      const emptyResult = {
        success: true,
        alerts: [],
        opportunities: [],
        ai_summary: null,
        source: "fresh",
        scope: { role, office_id: oficinaId },
        diagnostics: {
          reason: "missing_vendor_mapping",
          message: "Tu usuario no tiene vendedor SICAS relacionado. Solicita a tu administrador que mapee tu usuario a un vendedor SICAS.",
          total_vigentes: 0,
          renewals_30: 0,
          renewals_60: 0,
          expired_recent: 0,
          active_clients: 0,
          alerts_generated: 0,
          opportunities_generated: 0,
          ai_available: !!Deno.env.get("OPENAI_API_KEY"),
          ai_used: false,
          role,
          generated_at: new Date().toISOString(),
        },
      };

      // Cache empty result too
      await supabase.from("sicas_production_insights_cache").upsert({
        usuario_id: profile.id,
        alerts: [],
        opportunities: [],
        ai_summary: null,
        diagnostics: emptyResult.diagnostics,
        updated_at: new Date().toISOString(),
      }, { onConflict: "usuario_id" });

      return jsonResponse(emptyResult, 200);
    }

    // 6. Query sicas_documents with scope
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Renewals 30 days
    const { data: renewals30 } = await buildScopedQuery(
      supabase, vendorScope,
      "id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre"
    )
      .eq("is_vigente", true)
      .eq("is_renewable", true)
      .gte("vigencia_hasta", now.toISOString())
      .lte("vigencia_hasta", thirtyDaysFromNow.toISOString())
      .order("vigencia_hasta", { ascending: true })
      .limit(100);

    // Renewals 30-60 days
    const { data: renewals60 } = await buildScopedQuery(
      supabase, vendorScope,
      "id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre"
    )
      .eq("is_vigente", true)
      .eq("is_renewable", true)
      .gt("vigencia_hasta", thirtyDaysFromNow.toISOString())
      .lte("vigencia_hasta", sixtyDaysFromNow.toISOString())
      .order("vigencia_hasta", { ascending: true })
      .limit(50);

    // Recently expired
    const { data: recentExpired } = await buildScopedQuery(
      supabase, vendorScope,
      "id, id_docto, cliente, poliza, compania, ramo, prima_neta, prima_total, vigencia_hasta, vend_nombre"
    )
      .eq("is_vigente", false)
      .eq("is_cancelada", false)
      .gte("vigencia_hasta", thirtyDaysAgo.toISOString())
      .lte("vigencia_hasta", now.toISOString())
      .order("prima_neta", { ascending: false })
      .limit(50);

    // Active by client (for cross-sell)
    const { data: activeByClient } = await buildScopedQuery(
      supabase, vendorScope,
      "cliente, ramo, compania, prima_neta, prima_total"
    )
      .eq("is_vigente", true)
      .order("prima_neta", { ascending: false })
      .limit(2000);

    // Top clients for concentration
    const { data: topClients } = await buildScopedQuery(
      supabase, vendorScope,
      "cliente, prima_neta"
    )
      .eq("is_vigente", true)
      .order("prima_neta", { ascending: false })
      .limit(500);

    // Total vigentes for diagnostics (within scope)
    const { count: totalVigentes } = await buildScopedQuery(
      supabase, vendorScope,
      "id", { count: "exact", head: true }
    ).eq("is_vigente", true);

    console.log("[sicas-production-insights] documents queried - vigentes:", totalVigentes, "renewals30:", renewals30?.length, "renewals60:", renewals60?.length, "expired:", recentExpired?.length);

    // 7. Generate local alerts
    const alerts = generateLocalAlerts(
      renewals30 || [],
      renewals60 || [],
      recentExpired || [],
      activeByClient || [],
      topClients || []
    );

    // 8. Generate local opportunities
    const opportunities = generateLocalOpportunities(
      activeByClient || [],
      recentExpired || [],
      renewals30 || []
    );

    // 9. Try AI enhancement (non-blocking)
    let aiSummary: string | null = null;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && (alerts.length > 0 || opportunities.length > 0)) {
      try {
        aiSummary = await generateAISummary(
          openaiKey, alerts, opportunities,
          {
            totalVigentes: totalVigentes || 0,
            renewals30Count: renewals30?.length || 0,
            renewals60Count: renewals60?.length || 0,
            expiredCount: recentExpired?.length || 0,
            userName,
          }
        );
      } catch (aiErr: any) {
        console.error("[sicas-production-insights] AI summary failed (non-blocking):", aiErr.message);
      }
    }

    // 10. Persist alerts and opportunities
    await persistAlerts(supabase, profile.id, vendorScope, oficinaId, alerts);
    await persistOpportunities(supabase, profile.id, vendorScope, oficinaId, opportunities);

    // 11. Build diagnostics
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
      role,
      generated_at: now.toISOString(),
    };

    // 12. Update cache
    await supabase.from("sicas_production_insights_cache").upsert({
      usuario_id: profile.id,
      alerts,
      opportunities,
      ai_summary: aiSummary,
      diagnostics,
      updated_at: now.toISOString(),
    }, { onConflict: "usuario_id" });

    console.log(`[sicas-production-insights] Generated ${alerts.length} alerts, ${opportunities.length} opportunities, AI=${!!aiSummary}`);

    return jsonResponse({
      success: true,
      alerts,
      opportunities,
      ai_summary: aiSummary,
      source: "fresh",
      scope: { role, office_id: oficinaId, vendor_ids: vendorScope.ids.length > 0 ? vendorScope.ids : undefined },
      diagnostics,
    }, 200);
  } catch (error: any) {
    console.error("[sicas-production-insights] Unhandled error:", error.message, error.stack);
    return jsonResponse({ success: false, status: "internal_error", error: error.message }, 500);
  }
});

// === Vendor Scope Resolution ===

async function resolveVendorScope(
  supabase: any,
  userId: string,
  role: string,
  oficinaId: string | null
): Promise<VendorScope> {
  // Admin: sees everything
  if (role === "administrador") {
    return { type: "all", ids: [] };
  }

  // Gerente / Empleado: sees their office
  if ((role === "gerente" || role === "empleado") && oficinaId) {
    return { type: "oficina", ids: [], oficina_id: oficinaId };
  }

  // Agent: resolve vend_ids from sicas_mapeo_vendedor_usuario
  const { data: mappings } = await supabase
    .from("sicas_mapeo_vendedor_usuario")
    .select("id_sicas_vendedor")
    .eq("movi_user_id", userId);

  const ids = (mappings || []).map((m: any) => m.id_sicas_vendedor).filter(Boolean);

  console.log("[sicas-production-insights] vendor mappings for user:", userId, "->", ids);

  return { type: "vend_ids", ids };
}

// Build a query on sicas_documents pre-filtered by scope
function buildScopedQuery(
  supabase: any,
  scope: VendorScope,
  columns: string,
  options?: { count?: "exact"; head?: boolean }
) {
  let query = supabase.from("sicas_documents").select(columns, options || {});

  if (scope.type === "vend_ids" && scope.ids.length > 0) {
    query = query.in("vend_id", scope.ids);
  } else if (scope.type === "oficina" && scope.oficina_id) {
    query = query.eq("oficina_id", scope.oficina_id);
  }
  // admin: no filter

  return query;
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
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Renewals in 7 days (critical)
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

  // 4. Concentration risk
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

  // 5. High-value renewals
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
  _renewals: any[]
): LocalOpportunity[] {
  const opportunities: LocalOpportunity[] = [];

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

  // High-value clients
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

  // Reactivation opportunities
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
