import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmartAnalysis {
  title: string;
  summary: string;
  insights: Array<{ icon: string; label: string; value: string; detail?: string }>;
  alerts: Array<{ level: 'info' | 'warning' | 'critical'; message: string }>;
  opportunities: Array<{ description: string; impact: string }>;
  recommendations: Array<{ action: string; reason: string }>;
  tone: 'positive' | 'neutral' | 'attention';
  priority: 'low' | 'medium' | 'high';
}

export interface SmartAnalysisResult {
  analysis: SmartAnalysis;
  source: 'chatgpt' | 'fallback' | 'no_sicas' | 'cache';
  periodo: string;
  hasSicasMapping: boolean;
  cachedAt?: string;
}

interface UserContext {
  nombre: string;
  rol: string;
  oficina?: string;
  tareas_pendientes?: number;
  tareas_vencidas?: number;
  cotizaciones_activas?: number;
  comunicados_sin_leer?: number;
  tramites_pendientes_atencion?: number;
  nivel_actual?: number;
  dias_racha?: number;
  posicion_ranking?: number;
}

interface SicasContext {
  usuario: { nombre: string; rol: string; oficina: string; id_sicas: string };
  kpis: Record<string, number>;
  top_clientes: Array<{ name: string; count: number; prima: number }>;
  top_aseguradoras: Array<{ name: string; count: number; prima: number }>;
  top_ramos: Array<{ name: string; count: number; prima: number }>;
  top_subramos: Array<{ name: string; count: number; prima: number }>;
  observaciones: Record<string, any>;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function getSmartAnalysis(
  userId: string,
  forceRegenerate: boolean = false
): Promise<SmartAnalysisResult> {
  const now = new Date();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. Check cache (unless forcing regeneration)
  if (!forceRegenerate) {
    const cached = await getCachedAnalysis(userId, periodo);
    if (cached) return cached;
  }

  // 2. Get user basic info
  const userContext = await getUserContext(userId);

  // 3. Try to get SICAS production data
  const sicasResult = await getSicasProductionData(userId, userContext, periodo);

  // 4. Build context hash to detect data changes
  const contextHash = buildContextHash(sicasResult.sicasData, periodo);

  // 5. Call edge function for analysis
  const result = await callAnalysisEdgeFunction(
    sicasResult.sicasData,
    userContext,
    periodo,
    forceRegenerate
  );

  // 6. Cache the result
  await cacheAnalysis(userId, result.analysis, contextHash, periodo, sicasResult.hasSicasMapping, result.source);

  return {
    analysis: result.analysis,
    source: result.source,
    periodo,
    hasSicasMapping: sicasResult.hasSicasMapping,
  };
}

// ─── User Context ───────────────────────────────────────────────────────────

async function getUserContext(userId: string): Promise<UserContext> {
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol, oficina_id, oficinas(nombre)')
    .eq('id', userId)
    .maybeSingle();

  const context: UserContext = {
    nombre: usuario?.nombre_completo || 'Usuario',
    rol: usuario?.rol || 'Agente',
    oficina: usuario?.oficinas?.nombre,
  };

  const [tareasResult, cotizacionesResult, comunicadosResult, tramitesResult, gamificacionResult] =
    await Promise.allSettled([
      getTareasCount(userId),
      getCotizacionesCount(userId),
      getComunicadosSinLeer(userId),
      getTramitesPendientes(userId),
      getGamificacionBasic(userId),
    ]);

  if (tareasResult.status === 'fulfilled' && tareasResult.value) Object.assign(context, tareasResult.value);
  if (cotizacionesResult.status === 'fulfilled' && cotizacionesResult.value) Object.assign(context, cotizacionesResult.value);
  if (comunicadosResult.status === 'fulfilled' && comunicadosResult.value) Object.assign(context, comunicadosResult.value);
  if (tramitesResult.status === 'fulfilled' && tramitesResult.value) Object.assign(context, tramitesResult.value);
  if (gamificacionResult.status === 'fulfilled' && gamificacionResult.value) Object.assign(context, gamificacionResult.value);

  return context;
}

async function getTareasCount(userId: string) {
  try {
    const now = new Date().toISOString();
    const [{ count: pendientes }, { count: vencidas }] = await Promise.all([
      supabase.from('crm_tareas').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('estatus', 'pendiente'),
      supabase.from('crm_tareas').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('estatus', 'pendiente').lt('fecha_vencimiento', now),
    ]);
    return { tareas_pendientes: pendientes || 0, tareas_vencidas: vencidas || 0 };
  } catch { return null; }
}

async function getCotizacionesCount(userId: string) {
  try {
    const { count } = await supabase.from('crm_cotizaciones').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('estatus_cotizacion', 'activa');
    return { cotizaciones_activas: count || 0 };
  } catch { return null; }
}

async function getComunicadosSinLeer(userId: string) {
  try {
    const { data: userData } = await supabase.from('usuarios').select('oficina_id').eq('id', userId).maybeSingle();
    if (!userData) return null;

    const { data: comunicados } = await supabase
      .from('comunicados')
      .select('id, comunicados_visibilidad(usuario_id, area_id, oficina_id, para_todos)')
      .eq('publicado', true);

    if (!comunicados) return null;

    const relevantes = comunicados.filter((c: any) => {
      const vis = c.comunicados_visibilidad;
      if (!vis || vis.length === 0) return false;
      return vis.some((v: any) => v.para_todos || v.usuario_id === userId || v.oficina_id === userData.oficina_id);
    });

    const { data: lecturas } = await supabase.from('comunicados_lecturas').select('comunicado_id').eq('usuario_id', userId);
    const leidos = new Set(lecturas?.map(l => l.comunicado_id) || []);
    const sinLeer = relevantes.filter(c => !leidos.has(c.id));

    return { comunicados_sin_leer: sinLeer.length };
  } catch { return null; }
}

async function getTramitesPendientes(userId: string) {
  try {
    const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('agente_id', userId).in('estatus', ['abierto', 'en_proceso']);
    return { tramites_pendientes_atencion: count || 0 };
  } catch { return null; }
}

async function getGamificacionBasic(userId: string) {
  try {
    const { data: profile } = await supabase
      .from('agent_gamification_profile')
      .select('nivel_actual, dias_racha')
      .eq('user_id', userId)
      .maybeSingle();
    if (!profile) return null;
    return { nivel_actual: profile.nivel_actual, dias_racha: profile.dias_racha || 0 };
  } catch { return null; }
}

// ─── SICAS Production Data ──────────────────────────────────────────────────

async function getSicasProductionData(
  userId: string,
  userContext: UserContext,
  periodo: string
): Promise<{ sicasData: SicasContext | null; hasSicasMapping: boolean }> {
  try {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id_sicas, nombre_completo, rol, oficina_id, oficinas(nombre)')
      .eq('id', userId)
      .maybeSingle();

    if (!usuario?.id_sicas) {
      return { sicasData: null, hasSicasMapping: false };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { sicasData: null, hasSicasMapping: true };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/sicas-production-query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'dashboard' }),
    });

    if (!response.ok) {
      console.error('SICAS production query failed:', response.status);
      return { sicasData: null, hasSicasMapping: true };
    }

    const data = await response.json();
    if (!data.ok || !data.kpis) {
      return { sicasData: null, hasSicasMapping: true };
    }

    const sicasData: SicasContext = {
      usuario: {
        nombre: usuario.nombre_completo || userContext.nombre,
        rol: usuario.rol || userContext.rol,
        oficina: usuario.oficinas?.nombre || userContext.oficina || '',
        id_sicas: usuario.id_sicas,
      },
      kpis: {
        polizas_vigentes: data.kpis.polizasVigentes || 0,
        fianzas_vigentes: data.kpis.fianzasVigentes || 0,
        prima_vigente: data.kpis.primaVigente || 0,
        polizas_emitidas: data.kpis.polizasEmitidas || 0,
        fianzas_emitidas: data.kpis.fianzasEmitidas || 0,
        prima_neta_emitida: data.kpis.primaNetaEmitida || 0,
        prima_total_emitida: data.kpis.primaTotalEmitida || 0,
        mes_prima_neta: data.kpis.mesPrimaNeta || 0,
        mes_prima_total: data.kpis.mesPrimaTotal || 0,
        mes_emisiones: data.kpis.mesEmisiones || 0,
        clientes_total: data.kpis.clientesTotal || 0,
        clientes_mes: data.kpis.clientesMes || 0,
        renovaciones_7dias: data.kpis.renovaciones7dias || 0,
        renovaciones_15dias: data.kpis.renovaciones15dias || 0,
        renovaciones_30dias: data.kpis.renovaciones30dias || 0,
        prima_renovar: data.kpis.primaRenovar || 0,
        cancelaciones: data.kpis.cancelaciones || 0,
        ticket_promedio: data.kpis.ticketPromedio || 0,
        variacion_mes_anterior: data.kpis.variacionMesAnterior || 0,
        variacion_interanual: data.kpis.variacionInteranual || 0,
      },
      top_clientes: (data.topLists?.clientes || []).slice(0, 5),
      top_aseguradoras: (data.topLists?.aseguradoras || []).slice(0, 5),
      top_ramos: (data.topLists?.ramos || []).slice(0, 5),
      top_subramos: (data.topLists?.subramos || []).slice(0, 5),
      observaciones: {
        periodo_analizado: data.periodo || periodo,
        total_documentos: data.recordsAnalyzed || 0,
        tiene_fianzas: (data.kpis.fianzasEmitidas || 0) > 0,
        tiene_renovaciones_urgentes: (data.kpis.renovaciones7dias || 0) > 0,
      },
    };

    return { sicasData, hasSicasMapping: true };
  } catch (error) {
    console.error('Error fetching SICAS data:', error);
    return { sicasData: null, hasSicasMapping: false };
  }
}

// ─── Edge Function Call ─────────────────────────────────────────────────────

async function callAnalysisEdgeFunction(
  sicasData: SicasContext | null,
  userContext: UserContext,
  periodo: string,
  forceRegenerate: boolean
): Promise<{ analysis: SmartAnalysis; source: 'chatgpt' | 'fallback' | 'no_sicas' }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-welcome-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sicasData, userContext, periodo, forceRegenerate }),
    });

    if (!response.ok) throw new Error(`Edge function error: ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.analysis) throw new Error('Invalid response');

    return { analysis: data.analysis, source: data.source || 'chatgpt' };
  } catch (error) {
    console.error('Edge function call failed, using client fallback:', error);
    return { analysis: buildClientFallback(sicasData, userContext, periodo), source: sicasData ? 'fallback' : 'no_sicas' };
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────

async function getCachedAnalysis(userId: string, periodo: string): Promise<SmartAnalysisResult | null> {
  try {
    const { data } = await supabase
      .from('dashboard_smart_analysis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return null;

    if (data.periodo !== periodo) return null;

    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    const maxAge = 4 * 60 * 60 * 1000; // 4 hours
    if (cacheAge > maxAge) return null;

    return {
      analysis: data.analysis_json as SmartAnalysis,
      source: 'cache',
      periodo: data.periodo,
      hasSicasMapping: data.has_sicas_mapping,
      cachedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

async function cacheAnalysis(
  userId: string,
  analysis: SmartAnalysis,
  contextHash: string,
  periodo: string,
  hasSicasMapping: boolean,
  source: string
): Promise<void> {
  try {
    await supabase.from('dashboard_smart_analysis').upsert({
      user_id: userId,
      analysis_json: analysis as any,
      sicas_context_hash: contextHash,
      periodo,
      has_sicas_mapping: hasSicasMapping,
      source,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (error) {
    console.error('Failed to cache analysis:', error);
  }
}

function buildContextHash(sicasData: SicasContext | null, periodo: string): string {
  if (!sicasData) return `no_sicas_${periodo}`;
  const k = sicasData.kpis;
  return `${periodo}_${k.polizas_vigentes}_${k.mes_emisiones}_${k.renovaciones_30dias}_${k.prima_total_emitida}`;
}

// ─── Client-Side Fallback ───────────────────────────────────────────────────

function buildClientFallback(sicasData: SicasContext | null, userContext: UserContext, periodo: string): SmartAnalysis {
  const nombre = userContext.nombre.split(' ')[0];

  if (!sicasData) {
    return {
      title: `Bienvenido, ${nombre}`,
      summary: 'Tu cuenta aun no esta vinculada a SICAS. Contacta a tu administrador para activar el analisis de produccion.',
      insights: [],
      alerts: [{ level: 'info', message: 'Sin vinculacion a SICAS. Solicita el mapeo de tu cuenta.' }],
      opportunities: [],
      recommendations: [{ action: 'Solicitar vinculacion SICAS', reason: 'Para ver tu cartera y produccion en tiempo real' }],
      tone: 'neutral',
      priority: 'low',
    };
  }

  const k = sicasData.kpis;
  const insights: SmartAnalysis['insights'] = [];
  const alerts: SmartAnalysis['alerts'] = [];
  const opportunities: SmartAnalysis['opportunities'] = [];
  const recommendations: SmartAnalysis['recommendations'] = [];
  let tone: SmartAnalysis['tone'] = 'neutral';
  let priority: SmartAnalysis['priority'] = 'low';

  if (k.polizas_vigentes > 0) insights.push({ icon: 'Shield', label: 'Polizas vigentes', value: String(k.polizas_vigentes), detail: `Prima: $${fmt(k.prima_vigente)}` });
  if (k.mes_emisiones > 0) insights.push({ icon: 'TrendingUp', label: 'Emisiones del mes', value: String(k.mes_emisiones), detail: `Prima: $${fmt(k.mes_prima_total)}` });
  if (k.renovaciones_30dias > 0) insights.push({ icon: 'RefreshCw', label: 'Renovaciones 30 dias', value: String(k.renovaciones_30dias), detail: `Prima: $${fmt(k.prima_renovar)}` });
  if (k.clientes_total > 0) insights.push({ icon: 'Users', label: 'Clientes en cartera', value: String(k.clientes_total) });

  if (k.renovaciones_7dias > 0) {
    alerts.push({ level: 'critical', message: `${k.renovaciones_7dias} poliza${k.renovaciones_7dias > 1 ? 's' : ''} por renovar en 7 dias` });
    priority = 'high'; tone = 'attention';
  }
  if (k.variacion_mes_anterior < -10) {
    alerts.push({ level: 'warning', message: `Produccion ${k.variacion_mes_anterior.toFixed(1)}% vs mes anterior` });
    priority = 'high'; tone = 'attention';
  } else if (k.variacion_mes_anterior > 10) {
    tone = 'positive';
  }

  if (sicasData.top_clientes[0]) {
    opportunities.push({ description: `Fortalecer relacion con ${sicasData.top_clientes[0].name}`, impact: `${sicasData.top_clientes[0].count} polizas` });
  }
  if (k.renovaciones_30dias > 0) {
    recommendations.push({ action: 'Gestionar renovaciones proximas', reason: `${k.renovaciones_30dias} polizas por vencer` });
  }

  let summary = '';
  if (k.mes_prima_total > 0) summary = `${nombre}, llevas $${fmt(k.mes_prima_total)} en prima este mes con ${k.mes_emisiones} emisiones.`;
  else if (k.polizas_vigentes > 0) summary = `${nombre}, tienes ${k.polizas_vigentes} polizas vigentes.`;
  else summary = `${nombre}, sin movimientos registrados este periodo.`;

  return {
    title: `Analisis de produccion - ${periodo}`,
    summary,
    insights: insights.slice(0, 4),
    alerts: alerts.slice(0, 3),
    opportunities: opportunities.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    tone,
    priority,
  };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
