import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmartAnalysis {
  message: string;
  tone: 'positive' | 'neutral' | 'attention';
}

export interface SmartAnalysisResult {
  analysis: SmartAnalysis;
  source: 'chatgpt' | 'fallback' | 'cache';
  periodo: string;
  cachedAt?: string;
}

interface ModuleSnapshot {
  usuario: { nombre: string; rol: string; oficina?: string };
  sicas: SicasSnapshot | null;
  tickets: TicketsSnapshot | null;
  comisiones: ComisionesSnapshot | null;
  crm: CRMSnapshot | null;
  webLeads: WebLeadsSnapshot | null;
  gamificacion: GamificacionSnapshot | null;
  comunicados: ComunicadosSnapshot | null;
}

interface SicasSnapshot {
  polizas_vigentes: number;
  fianzas_vigentes: number;
  prima_vigente: number;
  polizas_emitidas: number;
  mes_emisiones: number;
  mes_prima_total: number;
  renovaciones_7dias: number;
  renovaciones_15dias: number;
  renovaciones_30dias: number;
  prima_renovar: number;
  cancelaciones: number;
  variacion_mes_anterior: number;
  clientes_total: number;
  top_ramo: string;
  top_aseguradora: string;
  top_cliente: string;
}

interface TicketsSnapshot {
  abiertos: number;
  en_proceso: number;
  cerrados_mes: number;
  total_mes: number;
  vencidos: number;
}

interface ComisionesSnapshot {
  total_periodo_actual: number;
  total_periodo_anterior: number;
  batches_cerrados: number;
  variacion_porcentaje: number;
}

interface CRMSnapshot {
  contactos_total: number;
  prospectos: number;
  clientes: number;
  cotizaciones_activas: number;
  tareas_pendientes: number;
  tareas_vencidas: number;
  contactos_recientes_30d: number;
}

interface WebLeadsSnapshot {
  leads_total: number;
  leads_mes: number;
  leads_sin_seguimiento: number;
  tiene_pagina_web: boolean;
}

interface GamificacionSnapshot {
  nivel_actual: number;
  dias_racha: number;
  posicion_ranking: number | null;
}

interface ComunicadosSnapshot {
  sin_leer: number;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function getSmartAnalysis(
  userId: string,
  forceRegenerate: boolean = false
): Promise<SmartAnalysisResult> {
  const now = new Date();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (!forceRegenerate) {
    const cached = await getCachedAnalysis(userId, periodo);
    if (cached) return cached;
  }

  const snapshot = await buildModuleSnapshot(userId);

  const result = await callAnalysisEdgeFunction(snapshot, periodo, forceRegenerate);

  await cacheAnalysis(userId, result.analysis, periodo, result.source);

  return {
    analysis: result.analysis,
    source: result.source,
    periodo,
  };
}

// ─── Build Module Snapshot ──────────────────────────────────────────────────

async function buildModuleSnapshot(userId: string): Promise<ModuleSnapshot> {
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre_completo, nombre, rol, oficina_id, web_slug, id_sicas, oficinas(nombre)')
    .eq('id', userId)
    .maybeSingle();

  const nombreCompleto = usuario?.nombre_completo || usuario?.nombre || 'Usuario';

  const snapshot: ModuleSnapshot = {
    usuario: {
      nombre: nombreCompleto,
      rol: usuario?.rol || 'Agente',
      oficina: (usuario?.oficinas as any)?.nombre,
    },
    sicas: null,
    tickets: null,
    comisiones: null,
    crm: null,
    webLeads: null,
    gamificacion: null,
    comunicados: null,
  };

  const results = await Promise.allSettled([
    usuario?.id_sicas ? fetchSicasSnapshot(userId) : Promise.resolve(null),
    fetchTicketsSnapshot(userId),
    fetchComisionesSnapshot(userId),
    fetchCRMSnapshot(userId),
    fetchWebLeadsSnapshot(userId, !!usuario?.web_slug),
    fetchGamificacionSnapshot(userId),
    fetchComunicadosSnapshot(userId, usuario?.oficina_id),
  ]);

  if (results[0].status === 'fulfilled' && results[0].value) snapshot.sicas = results[0].value;
  if (results[1].status === 'fulfilled' && results[1].value) snapshot.tickets = results[1].value;
  if (results[2].status === 'fulfilled' && results[2].value) snapshot.comisiones = results[2].value;
  if (results[3].status === 'fulfilled' && results[3].value) snapshot.crm = results[3].value;
  if (results[4].status === 'fulfilled' && results[4].value) snapshot.webLeads = results[4].value;
  if (results[5].status === 'fulfilled' && results[5].value) snapshot.gamificacion = results[5].value;
  if (results[6].status === 'fulfilled' && results[6].value) snapshot.comunicados = results[6].value;

  return snapshot;
}

// ─── SICAS ──────────────────────────────────────────────────────────────────

async function fetchSicasSnapshot(userId: string): Promise<SicasSnapshot | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/sicas-production-query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'dashboard' }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ok || !data.kpis) return null;

    const k = data.kpis;
    return {
      polizas_vigentes: k.polizasVigentes || 0,
      fianzas_vigentes: k.fianzasVigentes || 0,
      prima_vigente: k.primaVigente || 0,
      polizas_emitidas: k.polizasEmitidas || 0,
      mes_emisiones: k.mesEmisiones || 0,
      mes_prima_total: k.mesPrimaTotal || 0,
      renovaciones_7dias: k.renovaciones7dias || 0,
      renovaciones_15dias: k.renovaciones15dias || 0,
      renovaciones_30dias: k.renovaciones30dias || 0,
      prima_renovar: k.primaRenovar || 0,
      cancelaciones: k.cancelaciones || 0,
      variacion_mes_anterior: k.variacionMesAnterior || 0,
      clientes_total: k.clientesTotal || 0,
      top_ramo: data.topLists?.ramos?.[0]?.name || '',
      top_aseguradora: data.topLists?.aseguradoras?.[0]?.name || '',
      top_cliente: data.topLists?.clientes?.[0]?.name || '',
    };
  } catch {
    return null;
  }
}

// ─── Tickets / Tramites ─────────────────────────────────────────────────────

async function fetchTicketsSnapshot(userId: string): Promise<TicketsSnapshot | null> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [abiertosR, enProcesoR, cerradosMesR, totalMesR, vencidosR] = await Promise.all([
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .or(`agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`)
        .eq('cerrado', false)
        .in('estatus', ['Abierto', 'abierto']),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .or(`agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`)
        .eq('cerrado', false)
        .in('estatus', ['En Proceso', 'en_proceso', 'En proceso']),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .or(`agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`)
        .eq('cerrado', true)
        .gte('fecha_cierre', monthStart),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .or(`agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`)
        .gte('created_at', monthStart),
      supabase.from('tickets').select('*', { count: 'exact', head: true })
        .or(`agente_usuario_id.eq.${userId},attending_user_id.eq.${userId},creado_por.eq.${userId}`)
        .eq('cerrado', false)
        .lt('updated_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const snap: TicketsSnapshot = {
      abiertos: abiertosR.count || 0,
      en_proceso: enProcesoR.count || 0,
      cerrados_mes: cerradosMesR.count || 0,
      total_mes: totalMesR.count || 0,
      vencidos: vencidosR.count || 0,
    };

    if (snap.abiertos === 0 && snap.en_proceso === 0 && snap.cerrados_mes === 0 && snap.total_mes === 0) return null;
    return snap;
  } catch {
    return null;
  }
}

// ─── Comisiones ─────────────────────────────────────────────────────────────

async function fetchComisionesSnapshot(userId: string): Promise<ComisionesSnapshot | null> {
  try {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const [currentR, prevR, batchesR] = await Promise.all([
      supabase.from('commission_details')
        .select('commission_neta')
        .eq('usuario_id', userId)
        .gte('created_at', `${thisMonth}-01`),
      supabase.from('commission_details')
        .select('commission_neta')
        .eq('usuario_id', userId)
        .gte('created_at', `${prevMonth}-01`)
        .lt('created_at', `${thisMonth}-01`),
      supabase.from('commission_batches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'closed')
        .gte('created_at', `${thisMonth}-01`),
    ]);

    const totalActual = (currentR.data || []).reduce((s, r) => s + (r.commission_neta || 0), 0);
    const totalAnterior = (prevR.data || []).reduce((s, r) => s + (r.commission_neta || 0), 0);
    const variacion = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : (totalActual > 0 ? 100 : 0);

    if (totalActual === 0 && totalAnterior === 0) return null;

    return {
      total_periodo_actual: Math.round(totalActual * 100) / 100,
      total_periodo_anterior: Math.round(totalAnterior * 100) / 100,
      batches_cerrados: batchesR.count || 0,
      variacion_porcentaje: Math.round(variacion * 10) / 10,
    };
  } catch {
    return null;
  }
}

// ─── CRM ────────────────────────────────────────────────────────────────────

async function fetchCRMSnapshot(userId: string): Promise<CRMSnapshot | null> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [contactosR, prospectosR, clientesR, cotizacionesR, tareasPendR, tareasVencR, recientesR] = await Promise.all([
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true }).eq('creado_por', userId),
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('estatus', 'Prospecto'),
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('estatus', 'Cliente'),
      supabase.from('crm_cotizaciones').select('*', { count: 'exact', head: true }).eq('creado_por', userId).in('estatus_cotizacion', ['activa', 'Nueva', 'Pendiente']),
      supabase.from('crm_tareas').select('*', { count: 'exact', head: true }).eq('creado_por', userId).in('estatus', ['Pendiente', 'pendiente']).eq('completada', false),
      supabase.from('crm_tareas').select('*', { count: 'exact', head: true }).eq('creado_por', userId).eq('completada', false).lt('fecha_vencimiento', now.toISOString()),
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true }).eq('creado_por', userId).gte('fecha_creacion', thirtyDaysAgo),
    ]);

    const total = contactosR.count || 0;
    if (total === 0 && (cotizacionesR.count || 0) === 0) return null;

    return {
      contactos_total: total,
      prospectos: prospectosR.count || 0,
      clientes: clientesR.count || 0,
      cotizaciones_activas: cotizacionesR.count || 0,
      tareas_pendientes: tareasPendR.count || 0,
      tareas_vencidas: tareasVencR.count || 0,
      contactos_recientes_30d: recientesR.count || 0,
    };
  } catch {
    return null;
  }
}

// ─── Web Leads ──────────────────────────────────────────────────────────────

async function fetchWebLeadsSnapshot(userId: string, hasWebPage: boolean): Promise<WebLeadsSnapshot | null> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalR, mesR, sinSeguimientoR] = await Promise.all([
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true })
        .eq('creado_por', userId).eq('fuente_origen', 'Mi Página Web'),
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true })
        .eq('creado_por', userId).eq('fuente_origen', 'Mi Página Web').gte('fecha_creacion', monthStart),
      supabase.from('crm_contactos').select('*', { count: 'exact', head: true })
        .eq('creado_por', userId).eq('fuente_origen', 'Mi Página Web').eq('estatus', 'Prospecto'),
    ]);

    const total = totalR.count || 0;
    if (total === 0 && !hasWebPage) return null;

    return {
      leads_total: total,
      leads_mes: mesR.count || 0,
      leads_sin_seguimiento: sinSeguimientoR.count || 0,
      tiene_pagina_web: hasWebPage,
    };
  } catch {
    return null;
  }
}

// ─── Gamificacion ───────────────────────────────────────────────────────────

async function fetchGamificacionSnapshot(userId: string): Promise<GamificacionSnapshot | null> {
  try {
    const { data: profile } = await supabase
      .from('agent_gamification_profile')
      .select('nivel_actual, dias_racha')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) return null;

    return {
      nivel_actual: profile.nivel_actual || 0,
      dias_racha: profile.dias_racha || 0,
      posicion_ranking: null,
    };
  } catch {
    return null;
  }
}

// ─── Comunicados ────────────────────────────────────────────────────────────

async function fetchComunicadosSnapshot(userId: string, oficinaId?: string | null): Promise<ComunicadosSnapshot | null> {
  try {
    const { data: comunicados } = await supabase
      .from('comunicados')
      .select('id, comunicados_visibilidad(usuario_id, area_id, oficina_id, para_todos)')
      .eq('publicado', true);

    if (!comunicados || comunicados.length === 0) return null;

    const relevantes = comunicados.filter((c: any) => {
      const vis = c.comunicados_visibilidad;
      if (!vis || vis.length === 0) return false;
      return vis.some((v: any) => v.para_todos || v.usuario_id === userId || (oficinaId && v.oficina_id === oficinaId));
    });

    const { data: lecturas } = await supabase.from('comunicados_lecturas').select('comunicado_id').eq('usuario_id', userId);
    const leidos = new Set(lecturas?.map(l => l.comunicado_id) || []);
    const sinLeer = relevantes.filter(c => !leidos.has(c.id)).length;

    if (sinLeer === 0) return null;
    return { sin_leer: sinLeer };
  } catch {
    return null;
  }
}

// ─── Edge Function Call ─────────────────────────────────────────────────────

async function callAnalysisEdgeFunction(
  snapshot: ModuleSnapshot,
  periodo: string,
  forceRegenerate: boolean
): Promise<{ analysis: SmartAnalysis; source: 'chatgpt' | 'fallback' }> {
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
      body: JSON.stringify({ snapshot, periodo, forceRegenerate }),
    });

    if (!response.ok) throw new Error(`Edge function error: ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.analysis) throw new Error('Invalid response');

    return { analysis: data.analysis, source: data.source || 'chatgpt' };
  } catch (error) {
    console.error('Edge function call failed, using client fallback:', error);
    return { analysis: buildClientFallback(snapshot, periodo), source: 'fallback' };
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
    const maxAge = 4 * 60 * 60 * 1000;
    if (cacheAge > maxAge) return null;

    const cached = data.analysis_json as any;
    if (!cached?.message) return null;

    return {
      analysis: { message: cached.message, tone: cached.tone || 'neutral' },
      source: 'cache',
      periodo: data.periodo,
      cachedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

async function cacheAnalysis(
  userId: string,
  analysis: SmartAnalysis,
  periodo: string,
  source: string
): Promise<void> {
  try {
    await supabase.from('dashboard_smart_analysis').upsert({
      user_id: userId,
      analysis_json: analysis as any,
      sicas_context_hash: `${periodo}_${Date.now()}`,
      periodo,
      has_sicas_mapping: true,
      source,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch (error) {
    console.error('Failed to cache analysis:', error);
  }
}

// ─── Client-Side Fallback ───────────────────────────────────────────────────

function buildClientFallback(snapshot: ModuleSnapshot, periodo: string): SmartAnalysis {
  const nombre = snapshot.usuario.nombre.split(' ')[0];
  const parts: string[] = [];
  let tone: SmartAnalysis['tone'] = 'neutral';

  const s = snapshot.sicas;
  const t = snapshot.tickets;
  const c = snapshot.comisiones;
  const crm = snapshot.crm;
  const web = snapshot.webLeads;

  if (s) {
    if (s.mes_prima_total > 0) {
      parts.push(`${nombre}, este mes llevas $${fmt(s.mes_prima_total)} en prima emitida con ${s.mes_emisiones} emisiones`);
      tone = 'positive';
    } else if (s.polizas_vigentes > 0) {
      parts.push(`${nombre}, tienes ${s.polizas_vigentes} polizas vigentes en tu cartera`);
    }
    if (s.renovaciones_7dias > 0) {
      parts.push(`Tienes ${s.renovaciones_7dias} renovacion${s.renovaciones_7dias > 1 ? 'es' : ''} proxima${s.renovaciones_7dias > 1 ? 's' : ''} en los siguientes 7 dias que conviene gestionar cuanto antes`);
      tone = 'attention';
    } else if (s.renovaciones_30dias > 0) {
      parts.push(`Hay ${s.renovaciones_30dias} renovacion${s.renovaciones_30dias > 1 ? 'es' : ''} en los proximos 30 dias por un total de $${fmt(s.prima_renovar)}`);
    }
  }

  if (t && (t.abiertos + t.en_proceso) > 0) {
    parts.push(`En tramites, tienes ${t.abiertos + t.en_proceso} pendiente${(t.abiertos + t.en_proceso) > 1 ? 's' : ''} de atencion`);
    if (t.vencidos > 0) {
      parts.push(`${t.vencidos} de ellos lleva${t.vencidos > 1 ? 'n' : ''} mas de una semana sin actualizacion`);
      tone = 'attention';
    }
  }

  if (crm) {
    if (crm.tareas_vencidas > 0) {
      parts.push(`En tu CRM hay ${crm.tareas_vencidas} tarea${crm.tareas_vencidas > 1 ? 's' : ''} vencida${crm.tareas_vencidas > 1 ? 's' : ''} que requiere${crm.tareas_vencidas > 1 ? 'n' : ''} seguimiento`);
      tone = 'attention';
    } else if (crm.prospectos > 0 && crm.tareas_pendientes > 0) {
      parts.push(`Tienes ${crm.prospectos} prospecto${crm.prospectos > 1 ? 's' : ''} activo${crm.prospectos > 1 ? 's' : ''} y ${crm.tareas_pendientes} tarea${crm.tareas_pendientes > 1 ? 's' : ''} pendiente${crm.tareas_pendientes > 1 ? 's' : ''} en CRM`);
    }
  }

  if (c && c.total_periodo_actual > 0) {
    if (c.variacion_porcentaje > 10) {
      parts.push(`Tus comisiones muestran un crecimiento de ${c.variacion_porcentaje.toFixed(0)}% respecto al periodo anterior`);
      tone = 'positive';
    } else if (c.variacion_porcentaje < -10) {
      parts.push(`Tus comisiones bajaron ${Math.abs(c.variacion_porcentaje).toFixed(0)}% respecto al periodo anterior`);
    }
  }

  if (web && web.leads_sin_seguimiento > 0) {
    parts.push(`Tienes ${web.leads_sin_seguimiento} lead${web.leads_sin_seguimiento > 1 ? 's' : ''} de tu pagina web sin seguimiento`);
  }

  if (parts.length === 0) {
    return {
      message: `${nombre}, aun no hay suficiente actividad consolidada para generar un analisis mas detallado, pero conforme se registren mas movimientos en tus modulos de MOVI, aqui veras observaciones y sugerencias personalizadas para ayudarte a dar mejor seguimiento a tu operacion comercial.`,
      tone: 'neutral',
    };
  }

  return { message: parts.join('. ') + '.', tone };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}
