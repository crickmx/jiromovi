import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, ClipboardList, Building2, Users, UserCheck, FileText, Bell, Activity, Zap, Trophy, ArrowRight, Shield, ChevronRight, Globe, MessageCircle, Settings, Calendar, ChartBar as BarChart3, TriangleAlert as AlertTriangle, Clock, Target, Briefcase, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';
import type { WidgetConfig } from '@/lib/dashboardWidgets';

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-neutral-100 dark:bg-white/6 rounded animate-pulse', className)} />;
}

function EmptyState({ message, actionLabel, actionPath }: { message: string; actionLabel?: string; actionPath?: string }) {
  const nav = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
      <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
        <Shield className="w-5 h-5 text-neutral-300 dark:text-white/20" />
      </div>
      <p className="text-sm text-neutral-400 dark:text-white/35 max-w-[180px] leading-snug">{message}</p>
      {actionLabel && actionPath && (
        <button
          onClick={() => nav(actionPath)}
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
        >
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KPIData { value: string | number; label: string; delta?: number; deltaLabel?: string; icon: React.ReactNode; color: string }

function KPICard({ data, loading, onNavigate }: { data: KPIData | null; loading: boolean; onNavigate?: string }) {
  const nav = useNavigate();
  return (
    <button
      onClick={() => onNavigate && nav(onNavigate)}
      className={cn(
        'w-full text-left rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.03] p-4 transition-all',
        onNavigate && 'hover:border-neutral-200 dark:hover:border-white/12 hover:shadow-sm cursor-pointer',
        !onNavigate && 'cursor-default'
      )}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : data ? (
        <>
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', data.color)}>
            {data.icon}
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums leading-none mb-1">
            {data.value}
          </p>
          <p className="text-xs text-neutral-400 dark:text-white/40">{data.label}</p>
          {data.delta !== undefined && (
            <p className={cn('text-xs font-medium mt-1.5', data.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {data.delta >= 0 ? '+' : ''}{data.delta}% {data.deltaLabel || 'vs mes anterior'}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-400 dark:text-white/30">Sin datos</p>
      )}
    </button>
  );
}

// ── Shared WidgetShell ────────────────────────────────────────────────────────

function WidgetShell({ title, icon, children, onMore, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; onMore?: () => void; badge?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-50 dark:border-white/4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/6 flex items-center justify-center text-neutral-500 dark:text-white/40">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70">{title}</h3>
          {badge}
        </div>
        {onMore && (
          <button onClick={onMore} className="text-xs text-neutral-400 dark:text-white/30 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 transition-colors">
            Ver todo <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Produccion del Mes (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function ProduccionPersonalWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: formatCurrency(data.produccion_mes || 0),
    label: ['Administrador', 'Gerente'].includes(usuario.rol) ? 'Produccion oficina (mes)' : 'Mi produccion del mes',
    delta: data.produccion_growth || undefined,
    icon: <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: 'bg-emerald-50 dark:bg-emerald-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mi-produccion-sicas-live" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Comisiones del Mes (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function ComisionesPersonalWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: formatCurrency(data.comisiones_mes || 0),
    label: 'Comisiones este mes',
    icon: <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    color: 'bg-blue-50 dark:bg-blue-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mis-comisiones" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Tramites Pendientes (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function TramitesPendientesWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const total = (data?.tramites_pendientes || 0) + (data?.tramites_en_proceso || 0);
  const kpi: KPIData | null = data ? {
    value: total,
    label: `${data.tramites_pendientes || 0} pendientes, ${data.tramites_en_proceso || 0} en proceso`,
    icon: <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    color: 'bg-amber-50 dark:bg-amber-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/tramites" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: CRM Tareas Abiertas (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function CRMTareasWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: data.crm_tareas_abiertas || 0,
    label: 'Tareas CRM abiertas',
    icon: <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
    color: 'bg-cyan-50 dark:bg-cyan-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mi-crm" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Contactos (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function ContactosWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: data.contactos_total || 0,
    label: 'Contactos en mi CRM',
    icon: <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
    color: 'bg-teal-50 dark:bg-teal-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/contactos" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Polizas Vigentes (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function PolizasVigentesWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: data.polizas_vigentes || 0,
    label: 'Polizas vigentes',
    icon: <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: 'bg-emerald-50 dark:bg-emerald-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mis-polizas" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Produccion Oficina (KPI for Admin/Gerente)
// ══════════════════════════════════════════════════════════════════════════════

export function ProduccionOficinaWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: formatCurrency(data.produccion_mes || 0),
    label: 'Produccion oficina (mes)',
    delta: data.produccion_growth || undefined,
    icon: <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
    color: 'bg-cyan-50 dark:bg-cyan-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/produccion/total" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Agentes Activos (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function AgentesActivosWidget({ usuario }: { usuario: Usuario }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let query = supabase.from('usuarios').select('id', { count: 'exact', head: true })
          .eq('activo', true).in('rol', ['Agente', 'Ejecutivo']);
        if (usuario.oficina_id && usuario.rol === 'Gerente') {
          query = query.eq('oficina_id', usuario.oficina_id);
        }
        const { count: c } = await query;
        setCount(c || 0);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id, usuario.rol]);

  const kpi: KPIData | null = count !== null ? {
    value: count,
    label: 'Agentes activos',
    icon: <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    color: 'bg-blue-50 dark:bg-blue-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/directorio" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Usuarios Activos (KPI for Admin)
// ══════════════════════════════════════════════════════════════════════════════

export function UsuariosActivosWidget() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { count: c } = await supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('activo', true);
        setCount(c || 0);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const kpi: KPIData | null = count !== null ? {
    value: count,
    label: 'Usuarios activos totales',
    icon: <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: 'bg-emerald-50 dark:bg-emerald-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/directorio" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Renovaciones Breakdown (30/60/90)
// ══════════════════════════════════════════════════════════════════════════════

export function RenovacionesBreakdownWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_renovaciones_breakdown', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell
      title="Renovaciones Proximas"
      icon={<Calendar className="w-4 h-4" />}
      onMore={() => nav('/mis-polizas')}
      badge={data?.total ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {data.total}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="p-4 space-y-3"><Skeleton className="h-16" /><Skeleton className="h-8" /></div>
      ) : !data || data.total === 0 ? (
        <EmptyState message="No hay polizas por renovar en los proximos 90 dias" actionLabel="Ver polizas" actionPath="/mis-polizas" />
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-xl bg-red-50 dark:bg-red-500/8 p-3 border border-red-100 dark:border-red-500/15">
              <p className="text-xl font-bold text-red-700 dark:text-red-400">{data.proximas_30}</p>
              <p className="text-[10px] font-medium text-red-500 dark:text-red-400/70 mt-0.5">30 dias</p>
            </div>
            <div className="text-center rounded-xl bg-amber-50 dark:bg-amber-500/8 p-3 border border-amber-100 dark:border-amber-500/15">
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{data.proximas_60}</p>
              <p className="text-[10px] font-medium text-amber-500 dark:text-amber-400/70 mt-0.5">60 dias</p>
            </div>
            <div className="text-center rounded-xl bg-emerald-50 dark:bg-emerald-500/8 p-3 border border-emerald-100 dark:border-emerald-500/15">
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{data.proximas_90}</p>
              <p className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400/70 mt-0.5">90 dias</p>
            </div>
          </div>
          {data.prima_30 > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 dark:bg-white/[0.03]">
              <span className="text-xs text-neutral-500 dark:text-white/40">Prima a renovar (30d)</span>
              <span className="text-sm font-bold text-neutral-900 dark:text-white">{formatCurrency(data.prima_30)}</span>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Tramites Recientes (List)
// ══════════════════════════════════════════════════════════════════════════════

export function TramitesRecientesWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_tramites_resumen', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
          p_limit: 5,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const statusColor: Record<string, string> = {
    'Pendiente': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    'En proceso': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    'En revision': 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10',
  };

  const items = data?.recientes || [];
  const statuses = data?.por_estatus || {};
  const totalActive = Object.values(statuses).reduce((s: number, v: any) => s + (v as number), 0);

  return (
    <WidgetShell
      title="Tramites Activos"
      icon={<ClipboardList className="w-4 h-4" />}
      onMore={() => nav('/tramites')}
      badge={totalActive > 0 ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">
          {totalActive}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="No hay tramites activos" actionLabel="Crear tramite" actionPath="/tramites" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((t: any) => (
            <li key={t.id}>
              <button
                onClick={() => nav(`/tramites/${t.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-neutral-400 dark:text-white/30 flex-shrink-0">{t.folio || '#'}</span>
                  <span className="text-sm text-neutral-700 dark:text-white/70 truncate">{t.titulo || t.tipo || 'Tramite'}</span>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0', statusColor[t.estatus] || statusColor['Pendiente'])}>
                  {t.estatus}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Top Aseguradoras (Chart)
// ══════════════════════════════════════════════════════════════════════════════

export function TopAseguradorasWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('get_dashboard_top_aseguradoras', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
          p_limit: 7,
        });
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const maxPrima = items.length > 0 ? Math.max(...items.map((i: any) => i.prima_total || 0)) : 1;

  return (
    <WidgetShell title="Top Aseguradoras (Ano)" icon={<BarChart3 className="w-4 h-4" />} onMore={() => nav('/produccion/total')}>
      {loading ? (
        <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="Sin datos de produccion por aseguradora" actionLabel="Ver produccion" actionPath="/produccion/total" />
      ) : (
        <div className="p-4 space-y-2.5">
          {items.map((a: any, idx: number) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-neutral-400 dark:text-white/25 w-4 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-neutral-700 dark:text-white/70 truncate">{a.nombre}</span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white tabular-nums flex-shrink-0">{formatCurrency(a.prima_total)}</span>
                </div>
                <div className="h-1.5 bg-neutral-100 dark:bg-white/6 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${(a.prima_total / maxPrima) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Comunicados Recientes (List)
// ══════════════════════════════════════════════════════════════════════════════

export function ComunicadosRecientesWidget() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('comunicados')
          .select('id, titulo, created_at')
          .eq('activo', true)
          .order('created_at', { ascending: false })
          .limit(4);
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <WidgetShell title="Comunicados" icon={<Bell className="w-4 h-4" />} onMore={() => nav('/comunicados')}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="No hay comunicados recientes" actionLabel="Ver comunicados" actionPath="/comunicados" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(c => (
            <li key={c.id}>
              <button
                onClick={() => nav(`/comunicados/${c.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <p className="text-sm text-neutral-700 dark:text-white/70 text-left truncate">{c.titulo}</p>
                <p className="text-xs text-neutral-400 dark:text-white/30 flex-shrink-0">
                  {new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Notificaciones Sin Leer
// ══════════════════════════════════════════════════════════════════════════════

export function NotificacionesSinLeerWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('notificaciones_internas')
          .select('id, titulo, mensaje, created_at, tipo')
          .eq('usuario_id', usuario.id)
          .eq('leido', false)
          .order('created_at', { ascending: false })
          .limit(5);
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell
      title="Notificaciones"
      icon={<Bell className="w-4 h-4" />}
      onMore={() => nav('/centro-notificaciones')}
      badge={items.length > 0 ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400">
          {items.length}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-3">
            <Bell className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </div>
          <p className="text-sm text-neutral-500 dark:text-white/40">Estas al dia</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(n => (
            <li key={n.id} className="px-4 py-3">
              <p className="text-sm text-neutral-700 dark:text-white/70 truncate">{n.titulo || n.mensaje}</p>
              <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">{getRelativeTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Actividad Reciente
// ══════════════════════════════════════════════════════════════════════════════

export function ActividadRecienteWidget({ usuario }: { usuario: Usuario }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('user_activity_logs')
          .select('accion, modulo, created_at')
          .eq('usuario_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(6);
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Mi Actividad Reciente" icon={<Activity className="w-4 h-4" />}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="Aun no hay actividad registrada" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((a, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{a.accion} <span className="text-neutral-400 dark:text-white/30">· {a.modulo}</span></p>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-white/25 flex-shrink-0">
                {getRelativeTime(a.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Ultimas Emisiones
// ══════════════════════════════════════════════════════════════════════════════

export function ProduccionPorAgenteWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('get_home_latest_emissions', { p_user_id: usuario.id, p_limit: 5 });
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Ultimas Emisiones" icon={<TrendingUp className="w-4 h-4" />} onMore={() => nav('/produccion/total')}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="Sin emisiones recientes" actionLabel="Ver produccion" actionPath="/produccion/total" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((e: any, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-neutral-700 dark:text-white/70 truncate">{e.nombre_asegurado || 'Cliente'}</p>
                <p className="text-xs text-neutral-400 dark:text-white/30">{e.aseguradora || ''} · {e.ramo || ''}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">{formatCurrency(e.prima || 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Produccion Mensual (Comparison Card)
// ══════════════════════════════════════════════════════════════════════════════

export function ProduccionMensualWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_dashboard_kpis', {
          p_user_id: usuario.id,
          p_rol: usuario.rol,
          p_oficina_id: usuario.oficina_id || null,
        });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Comparativo Produccion" icon={<TrendingUp className="w-4 h-4" />} onMore={() => nav('/mi-produccion-sicas-live')}>
      {loading ? (
        <div className="p-4"><Skeleton className="h-32" /></div>
      ) : !data ? (
        <EmptyState message="Sin datos de produccion" actionLabel="Ver produccion" actionPath="/mi-produccion-sicas-live" />
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/8 p-3 border border-emerald-100 dark:border-emerald-500/15">
              <p className="text-xs text-emerald-600 dark:text-emerald-400/70 mb-1">Este mes</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(data.produccion_mes || 0)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-white/[0.03] p-3 border border-neutral-100 dark:border-white/6">
              <p className="text-xs text-neutral-400 dark:text-white/35 mb-1">Mes anterior</p>
              <p className="text-xl font-bold text-neutral-600 dark:text-white/60">{formatCurrency(data.produccion_anterior || 0)}</p>
            </div>
          </div>
          {data.produccion_growth !== undefined && data.produccion_growth !== 0 && (
            <div className={cn('flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl',
              data.produccion_growth >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-500'
            )}>
              <TrendingUp className="w-4 h-4" />
              {data.produccion_growth >= 0 ? '+' : ''}{data.produccion_growth}% vs mes anterior
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Gamificacion
// ══════════════════════════════════════════════════════════════════════════════

export function GamificacionWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.from('agente_gamification_profiles')
          .select('total_points, current_level, current_level_name, rank_in_office')
          .eq('usuario_id', usuario.id)
          .maybeSingle();
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Mi Progreso" icon={<Trophy className="w-4 h-4" />} onMore={() => nav('/mi-progreso')}>
      {loading ? (
        <div className="p-4 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-4" /></div>
      ) : !data ? (
        <EmptyState message="Sin datos de progreso aun" />
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{(data.total_points || 0).toLocaleString()} pts</p>
              <p className="text-sm text-neutral-400 dark:text-white/40">{data.current_level_name || `Nivel ${data.current_level}`}</p>
            </div>
            {data.rank_in_office && (
              <div className="text-right">
                <p className="text-xs text-neutral-400 dark:text-white/30">Ranking</p>
                <p className="text-lg font-bold text-amber-500">#{data.rank_in_office}</p>
              </div>
            )}
          </div>
          <div className="h-1.5 bg-neutral-100 dark:bg-white/8 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${Math.min(((data.total_points || 0) % 1000) / 10, 100)}%` }} />
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Diagnostico Sistema (Admin)
// ══════════════════════════════════════════════════════════════════════════════

export function DiagnosticoSistemaWidget() {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.from('sicas_sync_jobs')
          .select('status, created_at, records_synced')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <WidgetShell title="Diagnostico Sistema" icon={<Activity className="w-4 h-4" />} onMore={() => nav('/admin/diagnostico')}>
      {loading ? (
        <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : !data ? (
        <EmptyState message="Sin datos de sincronizacion" />
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-white/40">Ultima sync SICAS</span>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
              data.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : data.status === 'running' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
            )}>
              {data.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-white/40">Registros</span>
            <span className="text-sm font-semibold text-neutral-700 dark:text-white/70">{(data.records_synced || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-white/40">Hace</span>
            <span className="text-sm text-neutral-500 dark:text-white/40">{getRelativeTime(data.created_at)}</span>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WIDGET: Accesos Rapidos
// ══════════════════════════════════════════════════════════════════════════════

type QuickAction = { label: string; path: string; href?: string; icon: React.ReactNode; color: string; bg: string };

const QUICK_ACTIONS: Record<string, QuickAction[]> = {
  Administrador: [
    { label: 'Produccion', path: '/produccion/total', icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Usuarios', path: '/directorio', icon: <Users className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Centro Contacto', path: '/centro-contacto', icon: <Phone className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'SICAS', path: '/produccion/sicas-live', icon: <BarChart3 className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'Diagnostico', path: '/admin/diagnostico', icon: <Settings className="w-5 h-5" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
    { label: 'Notificaciones', path: '/admin/transaccionales', icon: <Bell className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  ],
  Gerente: [
    { label: 'Produccion', path: '/produccion/total', icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Equipo', path: '/directorio', icon: <Users className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Tramites', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Comisiones', path: '/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
  ],
  Empleado: [
    { label: 'Tramites', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Centro Contacto', path: '/centro-contacto', icon: <Phone className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Comunicados', path: '/comunicados', icon: <Bell className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
  ],
};

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Mi Pagina Web', path: '/mercadotecnia/mi-pagina-web', icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { label: 'Mi Produccion', path: '/mi-produccion-sicas-live', icon: <TrendingUp className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { label: 'Comisiones', path: '/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  { label: 'Centro Digital', path: '/centro-digital', icon: <Activity className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
];

export function AccesosRapidosWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const baseActions = QUICK_ACTIONS[usuario.rol] || DEFAULT_QUICK_ACTIONS;

  const actions = baseActions.map(a => {
    if (a.path === '/mercadotecnia/mi-pagina-web' && (usuario as any).web_slug) {
      return { ...a, href: `https://agentedeseguros.website/${(usuario as any).web_slug}` };
    }
    return a;
  });

  return (
    <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
          <Zap className="w-4 h-4 text-neutral-500 dark:text-white/40" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white/80">Accesos Rapidos</h3>
          <p className="text-[11px] text-neutral-400 dark:text-white/30">Modulos frecuentes</p>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => {
              if (action.href) {
                window.open(action.href, '_blank', 'noopener,noreferrer');
              } else {
                nav(action.path);
              }
            }}
            className="group flex flex-col items-center gap-2.5 p-3 rounded-xl border border-neutral-100 dark:border-white/6 hover:border-neutral-200 dark:hover:border-white/12 hover:bg-neutral-50 dark:hover:bg-white/4 hover:shadow-sm transition-all duration-200"
          >
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110',
              action.bg, action.color
            )}>
              {action.icon}
            </div>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-white/45 text-center leading-tight group-hover:text-neutral-700 dark:group-hover:text-white/70 transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
