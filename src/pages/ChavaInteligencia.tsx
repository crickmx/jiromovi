import { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, Target, Lightbulb, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Clock, RefreshCw, Loader as Loader2, MessageSquare, Users, Zap, ChevronRight, Eye, ThumbsUp, ThumbsDown, ChartBar as BarChart3, Search, BookOpen, Sparkles, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '../lib/supabase';

type TabId = 'dashboard' | 'intents' | 'leads' | 'conocimiento' | 'mejoras';

const TABS: { id: TabId; label: string; icon: typeof Brain }[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: BarChart3 },
  { id: 'intents',     label: 'Intents',       icon: Target },
  { id: 'leads',       label: 'Leads',         icon: Users },
  { id: 'conocimiento',label: 'Conocimiento',  icon: BookOpen },
  { id: 'mejoras',     label: 'Mejoras',       icon: Lightbulb },
];

const INTENT_LABELS: Record<string, string> = {
  consulta_tecnica_seguros: 'Consulta técnica',
  cotizacion_precio: 'Cotización / precio',
  proceso_siniestro: 'Proceso de siniestro',
  busqueda_agente: 'Búsqueda de agente',
  info_plataforma_movi: 'Info MOVI Digital',
  info_plataforma_seguwallet: 'Info Seguwallet',
  info_agente_total: 'Info Agente Total',
  comparativa_productos: 'Comparativa de productos',
  capacitacion_cedula: 'Capacitación / Cédula A',
  queja_inconformidad: 'Queja / Inconformidad',
  saludo_presentacion: 'Saludo / presentación',
  otro: 'Otro',
};

export default function ChavaInteligencia() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20"
            style={{ background: 'linear-gradient(135deg, #00E5FF22, #0D6EFD33)', border: '1px solid rgba(0,229,255,0.3)' }}>
            <Brain className="h-5 w-5" style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Inteligencia Chava AI</h1>
            <p className="text-sm text-neutral-500 dark:text-white/40">Analítica de comportamiento e insights comerciales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100/80 dark:bg-white/5 rounded-xl overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-white dark:bg-white/10 text-neutral-900 dark:text-white shadow-sm"
                  : "text-neutral-500 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/60"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'dashboard'    && <DashboardTab    days={days} refreshKey={refreshKey} />}
      {activeTab === 'intents'      && <IntentsTab      days={days} refreshKey={refreshKey} />}
      {activeTab === 'leads'        && <LeadsTab        days={days} refreshKey={refreshKey} />}
      {activeTab === 'conocimiento' && <ConocimientoTab             refreshKey={refreshKey} />}
      {activeTab === 'mejoras'      && <MejorasTab                  refreshKey={refreshKey} />}
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ days, refreshKey }: { days: number; refreshKey: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [days, refreshKey]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: result } = await supabase
        .rpc('get_chava_bi_dashboard', { p_dias: days });
      setData(result);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState icon={BarChart3} message="No hay datos disponibles" />;

  const uso = data.uso || {};
  const comercial = data.comercial || {};
  const conocimiento = data.conocimiento || {};

  const kpis = [
    { label: 'Consultas totales', value: uso.total_consultas ?? 0, icon: MessageSquare, color: 'text-blue-500' },
    { label: 'Usuarios únicos', value: uso.usuarios_unicos ?? 0, icon: Users, color: 'text-cyan-500' },
    { label: 'Tiempo promedio', value: uso.tiempo_promedio_ms ? `${Math.round(uso.tiempo_promedio_ms)}ms` : 'N/A', icon: Clock, color: 'text-emerald-500' },
    { label: 'Tokens utilizados', value: (uso.total_tokens ?? 0).toLocaleString(), icon: Zap, color: 'text-amber-500' },
    { label: 'Leads detectados', value: comercial.total_leads ?? 0, icon: Target, color: 'text-rose-500' },
    { label: 'Leads alta calidad', value: comercial.leads_alta_calidad ?? 0, icon: Sparkles, color: 'text-orange-500' },
    { label: 'Brechas de conocimiento', value: conocimiento.total_brechas ?? 0, icon: BookOpen, color: 'text-violet-500' },
    { label: 'Brechas pendientes', value: conocimiento.pendientes ?? 0, icon: AlertTriangle, color: 'text-red-500' },
  ];

  const insights: any[] = data.insights_recientes || [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", k.color)} />
                <span className="text-xs text-neutral-500 dark:text-white/40 leading-tight">{k.label}</span>
              </div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top intents mini-chart */}
      {(uso.top_intents || []).length > 0 && (
        <div className="p-5 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-4">Top Intents</h3>
          <IntentBar intents={uso.top_intents} />
        </div>
      )}

      {/* Insights feed */}
      {insights.length > 0 && (
        <div className="p-5 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            Insights Recientes
          </h3>
          <div className="space-y-3">
            {insights.slice(0, 5).map((ins: any) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </div>
      )}

      {/* Platform breakdown */}
      {(uso.por_plataforma || []).length > 0 && (
        <div className="p-5 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-4">Uso por Plataforma</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(uso.por_plataforma || []).map((p: any) => (
              <div key={p.plataforma} className="text-center p-4 rounded-xl"
                style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)' }}>
                <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">{p.plataforma}</p>
                <p className="text-3xl font-bold text-neutral-900 dark:text-white">{p.consultas}</p>
                <p className="text-xs text-neutral-400 mt-1">{p.usuarios_unicos} usuarios</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── INTENTS TAB ─────────────────────────────────────────────────────────────
function IntentsTab({ days, refreshKey }: { days: number; refreshKey: number }) {
  const [trends, setTrends] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('todos');

  useEffect(() => { load(); }, [days, refreshKey, platform]);

  const load = async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [trendsRes, analyticsRes] = await Promise.all([
      supabase
        .from('chava_topic_trends')
        .select('intent_codigo, plataforma, total_menciones, fecha')
        .eq('periodo', 'diario')
        .gte('fecha', since.toISOString().split('T')[0])
        .order('total_menciones', { ascending: false })
        .limit(200),
      supabase
        .from('chava_interaction_analytics')
        .select('intent_principal, producto_detectado, plataforma, created_at')
        .gte('created_at', since.toISOString())
        .limit(500),
    ]);

    setTrends(trendsRes.data || []);
    setAnalytics(analyticsRes.data || []);
    setLoading(false);
  };

  if (loading) return <LoadingState />;

  // Aggregate by intent
  const filtered = analytics.filter(a => platform === 'todos' || a.plataforma === platform);
  const intentMap: Record<string, number> = {};
  for (const a of filtered) {
    const key = a.intent_principal || 'otro';
    intentMap[key] = (intentMap[key] || 0) + 1;
  }
  const sorted = Object.entries(intentMap).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);

  // Product breakdown
  const productMap: Record<string, number> = {};
  for (const a of filtered) {
    if (a.producto_detectado) {
      productMap[a.producto_detectado] = (productMap[a.producto_detectado] || 0) + 1;
    }
  }
  const sortedProducts = Object.entries(productMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Platform filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['todos', 'movi', 'seguwallet', 'chava_agente'].map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              platform === p
                ? "text-white" : "text-neutral-500 dark:text-white/40 hover:text-neutral-700"
            )}
            style={platform === p ? { background: 'linear-gradient(135deg,#0D6EFD,#00c8e0)' } : { background: 'rgba(0,0,0,0.04)' }}
          >
            {p === 'todos' ? 'Todas las plataformas' : p}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-400">{total} interacciones</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent ranking */}
        <div className="p-5 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-4">Intents más frecuentes</h3>
          {sorted.length === 0
            ? <EmptyState icon={Target} message="Sin datos para este período" compact />
            : (
              <div className="space-y-3">
                {sorted.map(([intent, count], i) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={intent}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-400 w-4">{i + 1}</span>
                          <span className="text-sm text-neutral-700 dark:text-white/70">{INTENT_LABELS[intent] || intent}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-400">{count}</span>
                          <span className="text-xs font-medium text-cyan-600 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0D6EFD,#00E5FF)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Product interest */}
        <div className="p-5 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-4">Productos de interés detectados</h3>
          {sortedProducts.length === 0
            ? <EmptyState icon={BarChart3} message="Sin productos detectados" compact />
            : (
              <div className="space-y-3">
                {sortedProducts.map(([product, count]) => {
                  const pct = Math.round((count / (filtered.filter(a => a.producto_detectado).length || 1)) * 100);
                  const colors: Record<string, string> = {
                    gmm: '#0D6EFD', vida: '#10B981', autos: '#F59E0B',
                    danos: '#EF4444', empresarial: '#8B5CF6', fianzas: '#EC4899',
                  };
                  return (
                    <div key={product}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-neutral-700 dark:text-white/70 capitalize">{product}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-400">{count}</span>
                          <span className="text-xs font-medium w-8 text-right" style={{ color: colors[product] || '#6B7280' }}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: colors[product] || '#6B7280' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ─── LEADS TAB ────────────────────────────────────────────────────────────────
function LeadsTab({ days, refreshKey }: { days: number; refreshKey: number }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => { load(); }, [days, refreshKey]);

  const load = async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data } = await supabase
      .from('chava_lead_signals')
      .select('*, chava_agente_users:chava_user_id(nombre_completo, tipo_usuario)')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    setLeads(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, estatus: string) => {
    setUpdating(id);
    await supabase.from('chava_lead_signals').update({ estatus }).eq('id', id);
    await load();
    setUpdating(null);
  };

  if (loading) return <LoadingState />;

  const byQuality = (q: string) => leads.filter(l => l.calidad_lead === q).length;

  return (
    <div className="space-y-5">
      {/* Quality summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Alta calidad', key: 'alta', color: 'text-emerald-600', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Media calidad', key: 'media', color: 'text-amber-600', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Baja calidad', key: 'baja', color: 'text-neutral-500', bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.1)' },
        ].map(item => (
          <div key={item.key} className="p-4 rounded-xl text-center"
            style={{ background: item.bg, border: `1px solid ${item.border}` }}>
            <p className={cn("text-3xl font-bold", item.color)}>{byQuality(item.key)}</p>
            <p className="text-xs text-neutral-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Lead list */}
      {leads.length === 0
        ? <EmptyState icon={Users} message="Sin leads detectados en este período" />
        : (
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <QualityBadge quality={lead.calidad_lead} />
                      <StatusBadge status={lead.estatus} />
                      {lead.producto_interes && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 capitalize font-medium">{lead.producto_interes}</span>
                      )}
                      {lead.estado && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-500">{lead.estado}</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-700 dark:text-white/70 line-clamp-2">{lead.extracto_conversacion}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[11px] text-neutral-400">{lead.plataforma}</span>
                      {lead.chava_agente_users?.nombre_completo && (
                        <span className="text-[11px] text-neutral-400">{lead.chava_agente_users.nombre_completo}</span>
                      )}
                      <span className="text-[11px] text-neutral-400">{new Date(lead.created_at).toLocaleString()}</span>
                    </div>
                    {lead.datos_precalificacion && Object.keys(lead.datos_precalificacion).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(lead.datos_precalificacion).map(([k, v]) => (
                          <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {lead.estatus === 'nuevo' && (
                      <>
                        <Button size="sm" variant="ghost" className="gap-1 text-emerald-600 hover:text-emerald-700 text-xs"
                          disabled={updating === lead.id}
                          onClick={() => updateStatus(lead.id, 'contactado')}>
                          <ThumbsUp className="h-3 w-3" /> Contactar
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1 text-neutral-400 hover:text-neutral-500 text-xs"
                          disabled={updating === lead.id}
                          onClick={() => updateStatus(lead.id, 'descartado')}>
                          <ThumbsDown className="h-3 w-3" /> Descartar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── CONOCIMIENTO TAB ─────────────────────────────────────────────────────────
function ConocimientoTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pendiente' | 'aprobado' | 'rechazado' | 'todos'>('pendiente');

  useEffect(() => { load(); }, [refreshKey, filter]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('chava_knowledge_review_queue')
      .select('*')
      .order('frecuencia', { ascending: false })
      .limit(100);
    if (filter !== 'todos') q = q.eq('estatus', filter);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, estatus: string) => {
    setUpdating(id);
    await supabase.from('chava_knowledge_review_queue').update({ estatus, revisado_at: new Date().toISOString() }).eq('id', id);
    await load();
    setUpdating(null);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {(['pendiente', 'aprobado', 'rechazado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              filter === f ? "text-white" : "text-neutral-500 hover:text-neutral-700")}
            style={filter === f ? { background: 'linear-gradient(135deg,#0D6EFD,#00c8e0)' } : { background: 'rgba(0,0,0,0.04)' }}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-400">{items.length} elementos</span>
      </div>

      {items.length === 0
        ? <EmptyState icon={BookOpen} message="Sin elementos en cola" />
        : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-semibold text-neutral-500 dark:text-white/40 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                        {INTENT_LABELS[item.intent_codigo] || item.intent_codigo}
                      </span>
                      {item.plataforma_origen && (
                        <span className="text-xs text-neutral-400">{item.plataforma_origen}</span>
                      )}
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />{item.frecuencia}x
                      </span>
                      <StatusBadge status={item.estatus} />
                    </div>

                    {item.pregunta_ejemplo && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-neutral-50 dark:bg-white/[0.02] border-l-2 border-neutral-200 dark:border-white/10">
                        <p className="text-xs text-neutral-500 dark:text-white/30 mb-0.5">Ejemplo de pregunta</p>
                        <p className="text-sm text-neutral-700 dark:text-white/70 italic">"{item.pregunta_ejemplo}"</p>
                      </div>
                    )}

                    {item.sugerencia_contenido && (
                      <div className="px-3 py-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/5 border-l-2 border-cyan-300 dark:border-cyan-500/30">
                        <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-0.5">Sugerencia de contenido</p>
                        <p className="text-sm text-neutral-700 dark:text-white/70">{item.sugerencia_contenido}</p>
                      </div>
                    )}

                    <p className="text-[11px] text-neutral-400 mt-2">{new Date(item.created_at).toLocaleString()}</p>
                  </div>

                  {item.estatus === 'pendiente' && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="gap-1 text-emerald-600 hover:text-emerald-700 text-xs h-8"
                        disabled={updating === item.id}
                        onClick={() => updateStatus(item.id, 'aprobado')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-red-500 hover:text-red-600 text-xs h-8"
                        disabled={updating === item.id}
                        onClick={() => updateStatus(item.id, 'rechazado')}>
                        <XCircle className="h-3.5 w-3.5" /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── MEJORAS TAB ─────────────────────────────────────────────────────────────
function MejorasTab({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pendiente' | 'aceptado' | 'descartado' | 'todos'>('pendiente');

  useEffect(() => { load(); }, [refreshKey, filter]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('chava_improvement_suggestions')
      .select('*')
      .order('frecuencia_reportes', { ascending: false })
      .limit(100);
    if (filter !== 'todos') q = q.eq('estatus', filter);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, estatus: string) => {
    setUpdating(id);
    await supabase.from('chava_improvement_suggestions').update({ estatus }).eq('id', id);
    await load();
    setUpdating(null);
  };

  const platformColors: Record<string, string> = {
    movi: '#0D6EFD', seguwallet: '#10B981', agente_total: '#F59E0B', chava_ai: '#00E5FF',
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {(['pendiente', 'aceptado', 'descartado', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
              filter === f ? "text-white" : "text-neutral-500 hover:text-neutral-700")}
            style={filter === f ? { background: 'linear-gradient(135deg,#0D6EFD,#00c8e0)' } : { background: 'rgba(0,0,0,0.04)' }}>
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-400">{items.length} sugerencias</span>
      </div>

      {items.length === 0
        ? <EmptyState icon={Lightbulb} message="Sin sugerencias de mejora" />
        : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="p-4 bg-white dark:bg-white/[0.03] rounded-xl border border-neutral-200/60 dark:border-white/8">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {item.plataforma && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: platformColors[item.plataforma] || '#6B7280' }}>
                          {item.plataforma}
                        </span>
                      )}
                      {item.tipo_mejora && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 text-neutral-500 capitalize">{item.tipo_mejora}</span>
                      )}
                      <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />{item.frecuencia_reportes}x
                      </span>
                      <StatusBadge status={item.estatus} />
                    </div>
                    <p className="text-sm font-semibold text-neutral-800 dark:text-white/80 mb-1">{item.titulo}</p>
                    <p className="text-sm text-neutral-600 dark:text-white/50">{item.descripcion}</p>
                    <p className="text-[11px] text-neutral-400 mt-2">{new Date(item.created_at).toLocaleString()}</p>
                  </div>

                  {item.estatus === 'pendiente' && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="gap-1 text-emerald-600 hover:text-emerald-700 text-xs h-8"
                        disabled={updating === item.id}
                        onClick={() => updateStatus(item.id, 'aceptado')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aceptar
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-red-500 hover:text-red-600 text-xs h-8"
                        disabled={updating === item.id}
                        onClick={() => updateStatus(item.id, 'descartado')}>
                        <XCircle className="h-3.5 w-3.5" /> Descartar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
    </div>
  );
}

function EmptyState({ icon: Icon, message, compact = false }: { icon: typeof Brain; message: string; compact?: boolean }) {
  return (
    <div className={cn("text-center text-neutral-400 dark:text-white/30", compact ? "py-8" : "py-16")}>
      <Icon className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function IntentBar({ intents }: { intents: { intent_codigo: string; total: number }[] }) {
  const max = Math.max(...intents.map(i => i.total), 1);
  return (
    <div className="space-y-2.5">
      {intents.slice(0, 8).map(({ intent_codigo, total }) => {
        const pct = Math.round((total / max) * 100);
        return (
          <div key={intent_codigo}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-neutral-600 dark:text-white/60">{INTENT_LABELS[intent_codigo] || intent_codigo}</span>
              <span className="text-neutral-400 font-medium">{total}</span>
            </div>
            <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#0D6EFD,#00E5FF)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightCard({ insight }: { insight: any }) {
  const typeColors: Record<string, string> = {
    oportunidad: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10',
    alerta: 'text-red-600 bg-red-50 dark:bg-red-500/10',
    tendencia: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    recomendacion: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
  };
  const typeClass = typeColors[insight.tipo] || 'text-neutral-600 bg-neutral-50 dark:bg-neutral-500/10';

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5">
      <Sparkles className="h-4 w-4 text-cyan-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {insight.tipo && (
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide", typeClass)}>
              {insight.tipo}
            </span>
          )}
          <span className="text-[11px] text-neutral-400">{new Date(insight.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm font-medium text-neutral-800 dark:text-white/80">{insight.titulo}</p>
        {insight.descripcion && <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5 line-clamp-2">{insight.descripcion}</p>}
      </div>
    </div>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const map: Record<string, { label: string; class: string }> = {
    alta: { label: 'Alta', class: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
    media: { label: 'Media', class: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
    baja: { label: 'Baja', class: 'text-neutral-500 bg-neutral-50 dark:bg-neutral-500/10 border-neutral-200 dark:border-neutral-500/10' },
  };
  const cfg = map[quality] || map.baja;
  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", cfg.class)}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; class: string }> = {
    nuevo: { label: 'Nuevo', class: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10' },
    pendiente: { label: 'Pendiente', class: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
    contactado: { label: 'Contactado', class: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-500/10' },
    aprobado: { label: 'Aprobado', class: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
    aceptado: { label: 'Aceptado', class: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
    descartado: { label: 'Descartado', class: 'text-neutral-400 bg-neutral-50 dark:bg-neutral-500/10' },
    rechazado: { label: 'Rechazado', class: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
    convertido: { label: 'Convertido', class: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 font-bold' },
  };
  const cfg = map[status] || { label: status, class: 'text-neutral-500 bg-neutral-50' };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", cfg.class)}>
      {cfg.label}
    </span>
  );
}
