import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface UserContext {
  nombre: string;
  rol: string;
  oficina: string | null;
  email: string | null;
  fecha_ingreso: string | null;
}

interface SicasContext {
  polizas_vigentes: number;
  prima_vigente: number;
  emisiones_mes: number;
  prima_emitida_mes: number;
  renovaciones_7d: number;
  renovaciones_15d: number;
  renovaciones_30d: number;
  prima_renovar_30d: number;
  cancelaciones_mes: number;
  clientes_total: number;
  top_ramo: string;
  top_aseguradora: string;
}

interface TicketsContext {
  abiertos: number;
  en_proceso: number;
  cerrados_mes: number;
  vencidos_7d: number;
}

interface ComisionesContext {
  total_periodo_actual: number;
  total_periodo_anterior: number;
  variacion_pct: number;
}

interface CRMContext {
  contactos_total: number;
  prospectos: number;
  clientes: number;
  tareas_pendientes: number;
  tareas_vencidas: number;
  cotizaciones_activas: number;
  contactos_recientes_30d: number;
}

interface WebLeadsContext {
  leads_mes: number;
  leads_sin_seguimiento: number;
  tiene_pagina: boolean;
}

interface EducationContext {
  lecciones_completadas: number;
  lecciones_total: number;
  ultima_leccion: string | null;
  tiempo_total_min: number;
}

interface RegistroActividadesContext {
  actividades_mes: number;
  en_proceso: number;
  completadas_mes: number;
  cotizaciones_mes: number;
  emisiones_mes: number;
}

interface ProduccionContext {
  importe_mes: number;
  prima_ponderada_mes: number;
  registros_mes: number;
}

interface CentroDigitalContext {
  archivos_total: number;
  subidos_semana: number;
}

interface StoreContext {
  pedidos_pendientes: number;
  pedidos_mes: number;
}

interface ChatContext {
  mensajes_no_leidos: number;
  chats_activos: number;
}

interface GamificacionContext {
  nivel: number;
  dias_racha: number;
  posicion_ranking: number | null;
}

interface ComunicadosContext {
  sin_leer: number;
}

interface FullContext {
  usuario: UserContext;
  sicas: SicasContext | null;
  tickets: TicketsContext | null;
  comisiones: ComisionesContext | null;
  crm: CRMContext | null;
  webLeads: WebLeadsContext | null;
  education: EducationContext | null;
  registroActividades: RegistroActividadesContext | null;
  produccion: ProduccionContext | null;
  centroDigital: CentroDigitalContext | null;
  store: StoreContext | null;
  chat: ChatContext | null;
  gamificacion: GamificacionContext | null;
  comunicados: ComunicadosContext | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

function fmtMoney(n: number): string {
  return "$" + fmtNum(n);
}

// ── Context Builders (all server-side, service role) ────────────────────────

async function buildFullContext(
  supabase: any,
  userId: string
): Promise<FullContext> {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select(
      "nombre_completo, nombre, rol, oficina_id, web_slug, id_sicas, email_laboral, fecha_ingreso, oficinas(nombre)"
    )
    .eq("id", userId)
    .maybeSingle();

  const ctx: FullContext = {
    usuario: {
      nombre:
        usuario?.nombre_completo || usuario?.nombre || "Usuario",
      rol: usuario?.rol || "Agente",
      oficina: (usuario?.oficinas as any)?.nombre || null,
      email: usuario?.email_laboral || null,
      fecha_ingreso: usuario?.fecha_ingreso || null,
    },
    sicas: null,
    tickets: null,
    comisiones: null,
    crm: null,
    webLeads: null,
    education: null,
    registroActividades: null,
    produccion: null,
    centroDigital: null,
    store: null,
    chat: null,
    gamificacion: null,
    comunicados: null,
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const oficina_id = usuario?.oficina_id || null;

  const results = await Promise.allSettled([
    fetchSicas(supabase, userId),
    fetchTickets(supabase, userId, monthStart, sevenDaysAgo),
    fetchComisiones(supabase, userId, thisMonth, prevMonth),
    fetchCRM(supabase, userId, thirtyDaysAgo),
    fetchWebLeads(supabase, userId, monthStart, !!usuario?.web_slug),
    fetchEducation(supabase, userId),
    fetchRegistroActividades(supabase, userId, monthStart),
    fetchProduccion(supabase, userId, monthStart),
    fetchCentroDigital(supabase, userId, sevenDaysAgo),
    fetchStore(supabase, userId, monthStart),
    fetchChat(supabase, userId),
    fetchGamificacion(supabase, userId),
    fetchComunicados(supabase, userId, oficina_id),
  ]);

  const keys: (keyof Omit<FullContext, "usuario">)[] = [
    "sicas", "tickets", "comisiones", "crm", "webLeads",
    "education", "registroActividades", "produccion",
    "centroDigital", "store", "chat",
    "gamificacion", "comunicados",
  ];
  keys.forEach((key, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      (ctx as any)[key] = r.value;
    }
  });

  return ctx;
}

async function fetchSicas(supabase: any, userId: string): Promise<SicasContext | null> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const in15d = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    const [vigentesR, emisionesR, ren7R, ren15R, ren30R] = await Promise.all([
      supabase.from("sicas_polizas_vigentes").select("id, prima_total, ramo, aseguradora, contratante").eq("usuario_id", userId),
      supabase.from("sicas_polizas_vigentes").select("id, prima_total").eq("usuario_id", userId).gte("vigencia_desde", monthStart),
      supabase.from("sicas_polizas_vigentes").select("id, prima_total").eq("usuario_id", userId).gte("vigencia_hasta", today).lte("vigencia_hasta", in7d),
      supabase.from("sicas_polizas_vigentes").select("id, prima_total").eq("usuario_id", userId).gte("vigencia_hasta", today).lte("vigencia_hasta", in15d),
      supabase.from("sicas_polizas_vigentes").select("id, prima_total").eq("usuario_id", userId).gte("vigencia_hasta", today).lte("vigencia_hasta", in30d),
    ]);

    const polizas = vigentesR.data || [];
    if (polizas.length === 0) return null;

    const primaVig = polizas.reduce((s: number, p: any) => s + (p.prima_total || 0), 0);
    const emisiones = emisionesR.data || [];
    const primaEmitida = emisiones.reduce((s: number, p: any) => s + (p.prima_total || 0), 0);
    const ren7 = ren7R.data || [];
    const ren15 = ren15R.data || [];
    const ren30 = ren30R.data || [];
    const primaRenovar = ren30.reduce((s: number, p: any) => s + (p.prima_total || 0), 0);

    const ramoCounts: Record<string, number> = {};
    const ciaCounts: Record<string, number> = {};
    const clienteSet = new Set<string>();
    for (const p of polizas) {
      if (p.ramo) ramoCounts[p.ramo] = (ramoCounts[p.ramo] || 0) + 1;
      if (p.aseguradora) ciaCounts[p.aseguradora] = (ciaCounts[p.aseguradora] || 0) + 1;
      if (p.contratante) clienteSet.add(p.contratante);
    }
    const topRamo = Object.entries(ramoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const topCia = Object.entries(ciaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    return {
      polizas_vigentes: polizas.length,
      prima_vigente: primaVig,
      emisiones_mes: emisiones.length,
      prima_emitida_mes: primaEmitida,
      renovaciones_7d: ren7.length,
      renovaciones_15d: ren15.length,
      renovaciones_30d: ren30.length,
      prima_renovar_30d: primaRenovar,
      cancelaciones_mes: 0,
      clientes_total: clienteSet.size,
      top_ramo: topRamo,
      top_aseguradora: topCia,
    };
  } catch (e) {
    console.error("[Context] SICAS error:", e);
    return null;
  }
}

async function fetchTickets(
  supabase: any, userId: string, monthStart: string, sevenDaysAgo: string
): Promise<TicketsContext | null> {
  try {
    const userFilter = `agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`;
    const [aR, epR, cR, vR] = await Promise.all([
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("cerrado", false).in("estatus", ["Abierto", "abierto"]),
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("cerrado", false).in("estatus", ["En Proceso", "en_proceso", "En proceso"]),
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("cerrado", true).gte("fecha_cierre", monthStart),
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("cerrado", false).lt("updated_at", sevenDaysAgo),
    ]);
    const snap = { abiertos: aR.count || 0, en_proceso: epR.count || 0, cerrados_mes: cR.count || 0, vencidos_7d: vR.count || 0 };
    if (snap.abiertos === 0 && snap.en_proceso === 0 && snap.cerrados_mes === 0) return null;
    return snap;
  } catch { return null; }
}

async function fetchComisiones(
  supabase: any, userId: string, thisMonth: string, prevMonth: string
): Promise<ComisionesContext | null> {
  try {
    const [curR, prevR] = await Promise.all([
      supabase.from("commission_details").select("commission_neta").eq("usuario_id", userId).gte("created_at", `${thisMonth}-01`),
      supabase.from("commission_details").select("commission_neta").eq("usuario_id", userId).gte("created_at", `${prevMonth}-01`).lt("created_at", `${thisMonth}-01`),
    ]);
    const actual = (curR.data || []).reduce((s: number, r: any) => s + (r.commission_neta || 0), 0);
    const anterior = (prevR.data || []).reduce((s: number, r: any) => s + (r.commission_neta || 0), 0);
    if (actual === 0 && anterior === 0) return null;
    const variacion = anterior > 0 ? ((actual - anterior) / anterior) * 100 : actual > 0 ? 100 : 0;
    return {
      total_periodo_actual: Math.round(actual * 100) / 100,
      total_periodo_anterior: Math.round(anterior * 100) / 100,
      variacion_pct: Math.round(variacion * 10) / 10,
    };
  } catch { return null; }
}

async function fetchCRM(
  supabase: any, userId: string, thirtyDaysAgo: string
): Promise<CRMContext | null> {
  try {
    const now = new Date().toISOString();
    const [totalR, prospR, cliR, cotR, tpR, tvR, recR] = await Promise.all([
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId),
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId).eq("estatus", "Prospecto"),
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId).eq("estatus", "Cliente"),
      supabase.from("crm_cotizaciones").select("*", { count: "exact", head: true }).eq("creado_por", userId).in("estatus_cotizacion", ["activa", "Nueva", "Pendiente"]),
      supabase.from("crm_tareas").select("*", { count: "exact", head: true }).eq("creado_por", userId).in("estatus", ["Pendiente", "pendiente"]).eq("completada", false),
      supabase.from("crm_tareas").select("*", { count: "exact", head: true }).eq("creado_por", userId).eq("completada", false).lt("fecha_vencimiento", now),
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId).gte("fecha_creacion", thirtyDaysAgo),
    ]);
    const total = totalR.count || 0;
    if (total === 0 && (cotR.count || 0) === 0) return null;
    return {
      contactos_total: total,
      prospectos: prospR.count || 0,
      clientes: cliR.count || 0,
      cotizaciones_activas: cotR.count || 0,
      tareas_pendientes: tpR.count || 0,
      tareas_vencidas: tvR.count || 0,
      contactos_recientes_30d: recR.count || 0,
    };
  } catch { return null; }
}

async function fetchWebLeads(
  supabase: any, userId: string, monthStart: string, hasWebSlug: boolean
): Promise<WebLeadsContext | null> {
  try {
    const [mesR, sinR] = await Promise.all([
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId).eq("fuente_origen", "Mi Página Web").gte("fecha_creacion", monthStart),
      supabase.from("crm_contactos").select("*", { count: "exact", head: true }).eq("creado_por", userId).eq("fuente_origen", "Mi Página Web").eq("estatus", "Prospecto"),
    ]);
    const leadsMes = mesR.count || 0;
    const sinSeguimiento = sinR.count || 0;
    if (leadsMes === 0 && sinSeguimiento === 0 && hasWebSlug) return null;
    if (!hasWebSlug && leadsMes === 0) return { leads_mes: 0, leads_sin_seguimiento: 0, tiene_pagina: false };
    return { leads_mes: leadsMes, leads_sin_seguimiento: sinSeguimiento, tiene_pagina: hasWebSlug };
  } catch { return null; }
}

async function fetchEducation(
  supabase: any, userId: string
): Promise<EducationContext | null> {
  try {
    const [progressR, totalR, sesionesR] = await Promise.all([
      supabase.from("seguros_progress").select("lesson_id, completado, ultima_vista").eq("user_id", userId),
      supabase.from("seguros_lessons").select("*", { count: "exact", head: true }),
      supabase.from("seguros_education_sesiones").select("duracion_total_segundos").eq("user_id", userId),
    ]);
    const progress = progressR.data || [];
    const completadas = progress.filter((p: any) => p.completado).length;
    const totalLecciones = totalR.count || 0;
    if (completadas === 0 && progress.length === 0) return null;
    const sorted = progress.filter((p: any) => p.ultima_vista).sort((a: any, b: any) => new Date(b.ultima_vista).getTime() - new Date(a.ultima_vista).getTime());
    const tiempoSeg = (sesionesR.data || []).reduce((s: number, r: any) => s + (r.duracion_total_segundos || 0), 0);
    return {
      lecciones_completadas: completadas,
      lecciones_total: totalLecciones,
      ultima_leccion: sorted[0]?.ultima_vista || null,
      tiempo_total_min: Math.round(tiempoSeg / 60),
    };
  } catch { return null; }
}

async function fetchRegistroActividades(
  supabase: any, userId: string, monthStart: string
): Promise<RegistroActividadesContext | null> {
  try {
    const userFilter = `requester_user_id.eq.${userId},attending_user_id.eq.${userId}`;
    const [totalMesR, enProcesoR, completadasR] = await Promise.all([
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("tipo_tramite", "registro_actividad").gte("created_at", monthStart),
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("tipo_tramite", "registro_actividad").eq("cerrado", false).in("estatus", ["En Proceso", "en_proceso", "En proceso"]),
      supabase.from("tickets").select("*", { count: "exact", head: true }).or(userFilter).eq("tipo_tramite", "registro_actividad").eq("cerrado", true).gte("created_at", monthStart),
    ]);
    const total = totalMesR.count || 0;
    if (total === 0) return null;
    return {
      actividades_mes: total,
      en_proceso: enProcesoR.count || 0,
      completadas_mes: completadasR.count || 0,
      cotizaciones_mes: 0,
      emisiones_mes: 0,
    };
  } catch { return null; }
}

async function fetchProduccion(
  supabase: any, userId: string, monthStart: string
): Promise<ProduccionContext | null> {
  try {
    const { data: mappings } = await supabase
      .from("vendor_mappings")
      .select("vendor_name")
      .eq("usuario_id", userId);
    if (!mappings || mappings.length === 0) return null;
    const vendorNames = mappings.map((m: any) => m.vendor_name);
    const { data: records } = await supabase
      .from("production_records")
      .select("importe_pesos, prima_ponderada")
      .in("agente_nombre", vendorNames)
      .gte("fecha", monthStart.split("T")[0]);
    if (!records || records.length === 0) return null;
    const importe = records.reduce((s: number, r: any) => s + (r.importe_pesos || 0), 0);
    const prima = records.reduce((s: number, r: any) => s + (r.prima_ponderada || 0), 0);
    return { importe_mes: importe, prima_ponderada_mes: prima, registros_mes: records.length };
  } catch { return null; }
}

async function fetchCentroDigital(
  supabase: any, userId: string, sevenDaysAgo: string
): Promise<CentroDigitalContext | null> {
  try {
    const [totalR, recentR] = await Promise.all([
      supabase.from("centro_digital_archivos").select("*", { count: "exact", head: true }).eq("cargado_por", userId).eq("estado", "activo"),
      supabase.from("centro_digital_archivos").select("*", { count: "exact", head: true }).eq("cargado_por", userId).eq("estado", "activo").gte("created_at", sevenDaysAgo),
    ]);
    const total = totalR.count || 0;
    if (total === 0) return null;
    return { archivos_total: total, subidos_semana: recentR.count || 0 };
  } catch { return null; }
}

async function fetchStore(
  supabase: any, userId: string, monthStart: string
): Promise<StoreContext | null> {
  try {
    const [pendR, mesR] = await Promise.all([
      supabase.from("store_pedidos").select("*", { count: "exact", head: true }).eq("usuario_id", userId).in("estatus_id", [1, 2]),
      supabase.from("store_pedidos").select("*", { count: "exact", head: true }).eq("usuario_id", userId).gte("created_at", monthStart),
    ]);
    const pend = pendR.count || 0;
    const mes = mesR.count || 0;
    if (pend === 0 && mes === 0) return null;
    return { pedidos_pendientes: pend, pedidos_mes: mes };
  } catch { return null; }
}

async function fetchChat(
  supabase: any, userId: string
): Promise<ChatContext | null> {
  try {
    const { data: memberships } = await supabase
      .from("chat_miembros")
      .select("chat_id, ultimo_leido_at")
      .eq("usuario_id", userId);
    if (!memberships || memberships.length === 0) return null;
    let noLeidos = 0;
    for (const m of memberships) {
      if (!m.ultimo_leido_at) { noLeidos++; continue; }
      const { count } = await supabase
        .from("chat_mensajes")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", m.chat_id)
        .neq("remitente_id", userId)
        .gt("created_at", m.ultimo_leido_at)
        .eq("eliminado", false);
      if ((count || 0) > 0) noLeidos++;
    }
    return { mensajes_no_leidos: noLeidos, chats_activos: memberships.length };
  } catch { return null; }
}

async function fetchGamificacion(
  supabase: any, userId: string
): Promise<GamificacionContext | null> {
  try {
    const { data: profile } = await supabase
      .from("agent_gamification_profile")
      .select("nivel_actual, dias_racha")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return null;
    return { nivel: profile.nivel_actual || 0, dias_racha: profile.dias_racha || 0, posicion_ranking: null };
  } catch { return null; }
}

async function fetchComunicados(
  supabase: any, userId: string, oficinaId: string | null
): Promise<ComunicadosContext | null> {
  try {
    const { data: comunicados } = await supabase
      .from("comunicados")
      .select("id, comunicados_visibilidad(usuario_id, area_id, oficina_id, para_todos)")
      .eq("publicado", true);
    if (!comunicados || comunicados.length === 0) return null;
    const relevantes = comunicados.filter((c: any) => {
      const vis = c.comunicados_visibilidad;
      if (!vis || vis.length === 0) return false;
      return vis.some((v: any) => v.para_todos || v.usuario_id === userId || (oficinaId && v.oficina_id === oficinaId));
    });
    const { data: lecturas } = await supabase.from("comunicados_lecturas").select("comunicado_id").eq("usuario_id", userId);
    const leidos = new Set(lecturas?.map((l: any) => l.comunicado_id) || []);
    const sinLeer = relevantes.filter((c: any) => !leidos.has(c.id)).length;
    if (sinLeer === 0) return null;
    return { sin_leer: sinLeer };
  } catch { return null; }
}

// ── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(ctx: FullContext, periodo: string): string {
  const nombre = ctx.usuario.nombre.split(" ")[0];
  const sections: string[] = [];

  if (ctx.sicas) {
    const s = ctx.sicas;
    const lines: string[] = [];
    if (s.polizas_vigentes > 0) lines.push(`Polizas vigentes: ${s.polizas_vigentes}, prima total: ${fmtMoney(s.prima_vigente)}`);
    if (s.emisiones_mes > 0) lines.push(`Emisiones este mes: ${s.emisiones_mes}, prima emitida: ${fmtMoney(s.prima_emitida_mes)}`);
    if (s.renovaciones_7d > 0) lines.push(`URGENTE - Renovaciones proximas 7 dias: ${s.renovaciones_7d}`);
    if (s.renovaciones_15d > 0) lines.push(`Renovaciones 15 dias: ${s.renovaciones_15d}`);
    if (s.renovaciones_30d > 0) lines.push(`Renovaciones 30 dias: ${s.renovaciones_30d}, prima a renovar: ${fmtMoney(s.prima_renovar_30d)}`);
    if (s.cancelaciones_mes > 0) lines.push(`Cancelaciones este mes: ${s.cancelaciones_mes}`);
    if (s.clientes_total > 0) lines.push(`Clientes en cartera: ${s.clientes_total}`);
    if (s.top_ramo) lines.push(`Ramo principal: ${s.top_ramo}`);
    if (s.top_aseguradora) lines.push(`Aseguradora principal: ${s.top_aseguradora}`);
    if (lines.length > 0) sections.push(`PRODUCCION / SICAS:\n${lines.join("\n")}`);
  }

  if (ctx.tickets) {
    const t = ctx.tickets;
    const lines: string[] = [];
    if (t.abiertos > 0) lines.push(`Tramites abiertos: ${t.abiertos}`);
    if (t.en_proceso > 0) lines.push(`Tramites en proceso: ${t.en_proceso}`);
    if (t.cerrados_mes > 0) lines.push(`Cerrados este mes: ${t.cerrados_mes}`);
    if (t.vencidos_7d > 0) lines.push(`ATENCION: ${t.vencidos_7d} tramite(s) sin actualizacion en 7+ dias`);
    if (lines.length > 0) sections.push(`TRAMITES:\n${lines.join("\n")}`);
  }

  if (ctx.comisiones) {
    const c = ctx.comisiones;
    const lines: string[] = [];
    if (c.total_periodo_actual > 0) lines.push(`Comisiones periodo actual: ${fmtMoney(c.total_periodo_actual)}`);
    if (c.total_periodo_anterior > 0) lines.push(`Periodo anterior: ${fmtMoney(c.total_periodo_anterior)}`);
    if (c.variacion_pct !== 0) lines.push(`Variacion: ${c.variacion_pct > 0 ? "+" : ""}${c.variacion_pct.toFixed(1)}%`);
    if (lines.length > 0) sections.push(`COMISIONES:\n${lines.join("\n")}`);
  }

  if (ctx.crm) {
    const crm = ctx.crm;
    const lines: string[] = [];
    if (crm.contactos_total > 0) lines.push(`Contactos: ${crm.contactos_total} (${crm.prospectos} prospectos, ${crm.clientes} clientes)`);
    if (crm.cotizaciones_activas > 0) lines.push(`Cotizaciones activas: ${crm.cotizaciones_activas}`);
    if (crm.tareas_pendientes > 0) lines.push(`Tareas pendientes: ${crm.tareas_pendientes}`);
    if (crm.tareas_vencidas > 0) lines.push(`ATENCION: ${crm.tareas_vencidas} tarea(s) vencida(s)`);
    if (crm.contactos_recientes_30d > 0) lines.push(`Nuevos contactos (30d): ${crm.contactos_recientes_30d}`);
    if (lines.length > 0) sections.push(`CRM:\n${lines.join("\n")}`);
  }

  if (ctx.webLeads) {
    const w = ctx.webLeads;
    const lines: string[] = [];
    if (w.leads_mes > 0) lines.push(`Leads desde pagina web este mes: ${w.leads_mes}`);
    if (w.leads_sin_seguimiento > 0) lines.push(`Leads sin seguimiento: ${w.leads_sin_seguimiento}`);
    if (!w.tiene_pagina) lines.push("Pagina web publica: no configurada aun");
    if (lines.length > 0) sections.push(`MI PAGINA WEB:\n${lines.join("\n")}`);
  }

  if (ctx.registroActividades) {
    const ra = ctx.registroActividades;
    const lines: string[] = [];
    lines.push(`Actividades registradas este mes: ${ra.actividades_mes}`);
    if (ra.en_proceso > 0) lines.push(`En proceso: ${ra.en_proceso}`);
    if (ra.completadas_mes > 0) lines.push(`Completadas: ${ra.completadas_mes}`);
    sections.push(`REGISTRO DE ACTIVIDADES:\n${lines.join("\n")}`);
  }

  if (ctx.education) {
    const e = ctx.education;
    const lines: string[] = [];
    lines.push(`Lecciones completadas: ${e.lecciones_completadas} de ${e.lecciones_total}`);
    if (e.tiempo_total_min > 0) lines.push(`Tiempo de estudio: ${e.tiempo_total_min} min`);
    sections.push(`CAPACITACION:\n${lines.join("\n")}`);
  }

  if (ctx.produccion) {
    const p = ctx.produccion;
    const lines: string[] = [];
    lines.push(`Registros de produccion este mes: ${p.registros_mes}`);
    if (p.importe_mes > 0) lines.push(`Importe total: ${fmtMoney(p.importe_mes)}`);
    sections.push(`PRODUCCION (EXCEL):\n${lines.join("\n")}`);
  }

  if (ctx.comunicados && ctx.comunicados.sin_leer > 0) {
    sections.push(`COMUNICADOS:\nSin leer: ${ctx.comunicados.sin_leer}`);
  }

  if (ctx.chat && ctx.chat.mensajes_no_leidos > 0) {
    sections.push(`CHAT INTERNO:\nConversaciones con mensajes no leidos: ${ctx.chat.mensajes_no_leidos}`);
  }

  if (ctx.store && (ctx.store.pedidos_pendientes > 0 || ctx.store.pedidos_mes > 0)) {
    const lines: string[] = [];
    if (ctx.store.pedidos_pendientes > 0) lines.push(`Pedidos pendientes: ${ctx.store.pedidos_pendientes}`);
    if (ctx.store.pedidos_mes > 0) lines.push(`Pedidos este mes: ${ctx.store.pedidos_mes}`);
    sections.push(`TIENDA:\n${lines.join("\n")}`);
  }

  if (ctx.centroDigital) {
    const cd = ctx.centroDigital;
    const lines: string[] = [];
    lines.push(`Archivos en Centro Digital: ${cd.archivos_total}`);
    if (cd.subidos_semana > 0) lines.push(`Subidos esta semana: ${cd.subidos_semana}`);
    sections.push(`CENTRO DIGITAL:\n${lines.join("\n")}`);
  }

  if (ctx.gamificacion) {
    const g = ctx.gamificacion;
    const lines: string[] = [];
    if (g.nivel > 0) lines.push(`Nivel: ${g.nivel}`);
    if (g.dias_racha > 0) lines.push(`Racha: ${g.dias_racha} dias consecutivos`);
    if (lines.length > 0) sections.push(`GAMIFICACION:\n${lines.join("\n")}`);
  }

  const dataBlock = sections.length > 0
    ? sections.join("\n\n")
    : "No hay datos suficientes de los modulos en este momento.";

  return `Eres el asistente personal profesional de MOVI Digital, una plataforma integral para promotorias y agentes de seguros en Mexico. Tu trabajo es generar un mensaje de analisis ejecutivo diario personalizado para cada usuario, basandote en los datos reales de su operacion.

INSTRUCCIONES ESTRICTAS:
1. Escribe como un mentor cercano y profesional que conoce la operacion del usuario. Usa tono directo, calido y constructivo.
2. El mensaje debe tener entre 90 y 160 palabras. Maximo 2-3 parrafos cortos.
3. NO uses listas, vinetas, markdown, negritas, asteriscos ni formato especial. Solo texto plano fluido.
4. NO enumeres metricas una por una. Interpreta y sintetiza: que significan los datos, que senales positivas o de atencion hay, y que conviene hacer a continuacion.
5. Si hay datos de varios modulos, integralos naturalmente en el mensaje. Prioriza lo mas importante.
6. PRIORIDAD de contenido:
   P1 (URGENTE): Renovaciones proximas, tramites vencidos, tareas CRM vencidas, leads sin seguimiento
   P2 (IMPORTANTE): Produccion/emisiones del mes, comisiones, oportunidades de venta, cotizaciones activas
   P3 (INFORMATIVO): Comunicados sin leer, capacitacion pendiente, mercadotecnia/pagina web
   P4 (MOTIVACIONAL): Gamificacion, racha, resumen general cuando no hay alertas urgentes
7. Siempre menciona el nombre del usuario al inicio.
8. Si hay pocos datos, genera un mensaje amable indicando que conforme use la plataforma vera analisis mas completos. Sugiere 1-2 modulos que podria empezar a usar.
9. NUNCA inventes datos. Solo usa lo proporcionado.
10. Incluye al menos una recomendacion accionable especifica (ej: "te sugiero dar seguimiento a las 3 renovaciones de esta semana", "revisa los 2 leads pendientes de tu pagina web").
11. Todos los textos en espanol.

Responde UNICAMENTE con un JSON asi:
{"message": "tu mensaje en texto plano", "tone": "positive|neutral|attention"}

Donde tone es:
- "positive": produccion creciente, buenas metricas, buen ritmo de trabajo
- "attention": hay pendientes urgentes, retrasos, caidas, o temas que requieren accion inmediata
- "neutral": situacion estable o datos insuficientes para emitir juicio

USUARIO: ${nombre} (${ctx.usuario.rol}${ctx.usuario.oficina ? `, oficina: ${ctx.usuario.oficina}` : ""})
PERIODO: ${periodo}

DATOS DE SUS MODULOS:
${dataBlock}`;
}

// ── Fallback Generator ──────────────────────────────────────────────────────

function generateFallback(ctx: FullContext): { message: string; tone: "positive" | "neutral" | "attention" } {
  const nombre = ctx.usuario.nombre.split(" ")[0];
  const parts: string[] = [];
  let tone: "positive" | "neutral" | "attention" = "neutral";

  if (ctx.sicas) {
    const s = ctx.sicas;
    if (s.emisiones_mes > 0) {
      parts.push(`${nombre}, este mes llevas ${fmtMoney(s.prima_emitida_mes)} en prima emitida con ${s.emisiones_mes} emisiones`);
      tone = "positive";
    } else if (s.polizas_vigentes > 0) {
      parts.push(`${nombre}, tienes ${s.polizas_vigentes} polizas vigentes en tu cartera con una prima total de ${fmtMoney(s.prima_vigente)}`);
    }
    if (s.renovaciones_7d > 0) {
      parts.push(`Tienes ${s.renovaciones_7d} renovacion${s.renovaciones_7d > 1 ? "es" : ""} en los siguientes 7 dias que conviene gestionar cuanto antes`);
      tone = "attention";
    } else if (s.renovaciones_30d > 0) {
      parts.push(`Hay ${s.renovaciones_30d} renovacion${s.renovaciones_30d > 1 ? "es" : ""} proximas en los siguientes 30 dias por ${fmtMoney(s.prima_renovar_30d)}`);
    }
  }

  if (ctx.tickets && (ctx.tickets.abiertos + ctx.tickets.en_proceso) > 0) {
    const pending = ctx.tickets.abiertos + ctx.tickets.en_proceso;
    parts.push(`En tramites, tienes ${pending} pendiente${pending > 1 ? "s" : ""} de atencion`);
    if (ctx.tickets.vencidos_7d > 0) {
      parts.push(`${ctx.tickets.vencidos_7d} de ellos lleva${ctx.tickets.vencidos_7d > 1 ? "n" : ""} mas de una semana sin actualizacion`);
      tone = "attention";
    }
  }

  if (ctx.crm?.tareas_vencidas && ctx.crm.tareas_vencidas > 0) {
    parts.push(`En tu CRM hay ${ctx.crm.tareas_vencidas} tarea${ctx.crm.tareas_vencidas > 1 ? "s" : ""} vencida${ctx.crm.tareas_vencidas > 1 ? "s" : ""}`);
    tone = "attention";
  }

  if (ctx.comisiones && ctx.comisiones.total_periodo_actual > 0 && ctx.comisiones.variacion_pct > 10) {
    parts.push(`Tus comisiones muestran un crecimiento de ${ctx.comisiones.variacion_pct.toFixed(0)}% respecto al periodo anterior`);
    tone = "positive";
  }

  if (ctx.webLeads && ctx.webLeads.leads_sin_seguimiento > 0) {
    parts.push(`Tienes ${ctx.webLeads.leads_sin_seguimiento} lead${ctx.webLeads.leads_sin_seguimiento > 1 ? "s" : ""} de tu pagina web sin seguimiento`);
  }

  if (ctx.comunicados && ctx.comunicados.sin_leer > 0) {
    parts.push(`Hay ${ctx.comunicados.sin_leer} comunicado${ctx.comunicados.sin_leer > 1 ? "s" : ""} sin leer`);
  }

  if (parts.length === 0) {
    return {
      message: `${nombre}, aun no hay suficiente actividad consolidada para generar un analisis mas detallado, pero conforme se registren mas movimientos en tus modulos de MOVI, aqui veras observaciones y sugerencias personalizadas para ayudarte a dar mejor seguimiento a tu operacion comercial.`,
      tone: "neutral",
    };
  }

  return { message: parts.join(". ") + ".", tone };
}

// ── Get modules that had data ───────────────────────────────────────────────

function getModulesIncluded(ctx: FullContext): string[] {
  const modules: string[] = [];
  if (ctx.sicas) modules.push("sicas");
  if (ctx.tickets) modules.push("tickets");
  if (ctx.comisiones) modules.push("comisiones");
  if (ctx.crm) modules.push("crm");
  if (ctx.webLeads) modules.push("webLeads");
  if (ctx.education) modules.push("education");
  if (ctx.registroActividades) modules.push("registroActividades");
  if (ctx.produccion) modules.push("produccion");
  if (ctx.centroDigital) modules.push("centroDigital");
  if (ctx.store) modules.push("store");
  if (ctx.chat) modules.push("chat");
  if (ctx.gamificacion) modules.push("gamificacion");
  if (ctx.comunicados) modules.push("comunicados");
  return modules;
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    const userClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const forceRegenerate = body.forceRegenerate === true;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    if (!forceRegenerate) {
      const { data: cached } = await serviceClient
        .from("dashboard_smart_analysis")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cached && cached.periodo === periodo && cached.expires_at) {
        const expiresAt = new Date(cached.expires_at).getTime();
        if (Date.now() < expiresAt && cached.analysis_json?.message) {
          console.log(`[Welcome] Cache hit for user ${user.id}, expires ${cached.expires_at}`);
          return new Response(
            JSON.stringify({
              success: true,
              analysis: { message: cached.analysis_json.message, tone: cached.analysis_json.tone || "neutral" },
              source: "cache",
              periodo,
              modules: cached.modules_included || [],
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const startMs = Date.now();
    console.log(`[Welcome] Building context for user ${user.id}...`);
    const ctx = await buildFullContext(serviceClient, user.id);
    const contextMs = Date.now() - startMs;
    console.log(`[Welcome] Context built in ${contextMs}ms. Modules: ${getModulesIncluded(ctx).join(", ") || "none"}`);

    const modulesIncluded = getModulesIncluded(ctx);
    const hasData = modulesIncluded.length > 0;

    if (!hasData || !openaiApiKey) {
      const fallback = generateFallback(ctx);
      await serviceClient.from("dashboard_smart_analysis").upsert({
        user_id: user.id,
        analysis_json: fallback,
        sicas_context_hash: `${periodo}_${Date.now()}`,
        periodo,
        has_sicas_mapping: !!ctx.sicas,
        source: "fallback",
        context_json: ctx,
        model_used: null,
        generation_ms: Date.now() - startMs,
        modules_included: modulesIncluded,
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback", periodo, modules: modulesIncluded }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(ctx, periodo);
    const model = "gpt-4o-mini";

    console.log(`[Welcome] Calling OpenAI (${model})...`);
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: `Genera el mensaje de analisis ejecutivo personalizado para ${ctx.usuario.nombre.split(" ")[0]} en el periodo ${periodo}. Responde SOLO con el JSON.`,
          },
        ],
        temperature: 0.6,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    const totalMs = Date.now() - startMs;

    if (!openaiResponse.ok) {
      console.error("[Welcome] OpenAI error:", openaiResponse.status, await openaiResponse.text());
      const fallback = generateFallback(ctx);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback", periodo, modules: modulesIncluded }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      const fallback = generateFallback(ctx);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback", periodo, modules: modulesIncluded }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("[Welcome] Failed to parse ChatGPT JSON:", rawContent.substring(0, 300));
      const fallback = generateFallback(ctx);
      return new Response(
        JSON.stringify({ success: true, analysis: fallback, source: "fallback", periodo, modules: modulesIncluded }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = typeof parsed.message === "string" && parsed.message.length > 0
      ? parsed.message.slice(0, 1200)
      : generateFallback(ctx).message;

    const tone = ["positive", "neutral", "attention"].includes(parsed.tone)
      ? parsed.tone
      : "neutral";

    const analysis = { message, tone };

    await serviceClient.from("dashboard_smart_analysis").upsert({
      user_id: user.id,
      analysis_json: analysis,
      sicas_context_hash: `${periodo}_${Date.now()}`,
      periodo,
      has_sicas_mapping: !!ctx.sicas,
      source: "chatgpt",
      context_json: ctx,
      model_used: model,
      generation_ms: totalMs,
      modules_included: modulesIncluded,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    console.log(`[Welcome] Generated for ${ctx.usuario.nombre.split(" ")[0]} in ${totalMs}ms (${modulesIncluded.length} modules, source: chatgpt)`);

    return new Response(
      JSON.stringify({ success: true, analysis, source: "chatgpt", periodo, modules: modulesIncluded }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Welcome] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
