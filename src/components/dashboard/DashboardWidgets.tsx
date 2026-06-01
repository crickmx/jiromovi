import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, ClipboardList, Building2, Users, UserCheck, FileText, Bell, Activity, ChartBar as BarChart3, Zap, Trophy, TriangleAlert as AlertTriangle, ArrowRight, RefreshCw, Shield, ChevronRight, Globe, MessageCircle, ChartBar as BarChart2, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';
import type { WidgetConfig, WidgetDefinition } from '@/lib/dashboardWidgets';
import { WIDGET_REGISTRY } from '@/lib/dashboardWidgets';

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
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
              {data.delta >= 0 ? '↑' : '↓'} {Math.abs(data.delta)}% {data.deltaLabel || 'vs mes anterior'}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-400 dark:text-white/30">Sin datos</p>
      )}
    </button>
  );
}

// ── Widget: Producción Personal ───────────────────────────────────────────────

export function ProduccionPersonalWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_home_production_comparison', { p_user_id: usuario.id });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: formatCurrency(data.current_month_prima || 0),
    label: 'Producción este mes',
    delta: data.growth_percent,
    icon: <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: 'bg-emerald-50 dark:bg-emerald-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mi-produccion-sicas-live" />;
}

// ── Widget: Comisiones Personales ─────────────────────────────────────────────

export function ComisionesPersonalWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const { data: d } = await supabase
          .from('commission_details')
          .select('comision_neta')
          .eq('usuario_id', usuario.id)
          .gte('created_at', firstDay)
          .lte('created_at', lastDay);
        const total = (d || []).reduce((s: number, r: any) => s + (r.comision_neta || 0), 0);
        setData({ total });
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data !== null ? {
    value: formatCurrency(data.total || 0),
    label: 'Comisiones este mes',
    icon: <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
    color: 'bg-blue-50 dark:bg-blue-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/mis-comisiones" />;
}

// ── Widget: Trámites Pendientes ───────────────────────────────────────────────

export function TramitesPendientesWidget({ usuario }: { usuario: Usuario }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const isAdmin = ['Administrador', 'Gerente'].includes(usuario.rol);
        let query = supabase.from('tickets').select('id', { count: 'exact', head: true })
          .in('estatus', ['Pendiente', 'En proceso', 'En revisión']);
        if (!isAdmin) query = query.or(`agente_id.eq.${usuario.id},assigned_to.eq.${usuario.id}`);
        const { count: c } = await query;
        setCount(c || 0);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id, usuario.rol]);

  const kpi: KPIData | null = count !== null ? {
    value: count,
    label: 'Trámites pendientes',
    icon: <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
    color: 'bg-amber-50 dark:bg-amber-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/tramites" />;
}

// ── Widget: Producción Oficina ────────────────────────────────────────────────

export function ProduccionOficinaWidget({ usuario }: { usuario: Usuario }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_home_production_comparison', { p_user_id: usuario.id });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  const kpi: KPIData | null = data ? {
    value: formatCurrency(data.current_month_prima || 0),
    label: 'Producción oficina (mes)',
    delta: data.growth_percent,
    icon: <Building2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
    color: 'bg-cyan-50 dark:bg-cyan-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/produccion/total" />;
}

// ── Widget: Agentes Activos ───────────────────────────────────────────────────

export function AgentesActivosWidget({ usuario }: { usuario: Usuario }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let query = supabase.from('usuarios').select('id', { count: 'exact', head: true })
          .eq('activo', true).eq('rol', 'Agente');
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
    icon: <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
    color: 'bg-violet-50 dark:bg-violet-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/directorio" />;
}

// ── Widget: Usuarios Activos ──────────────────────────────────────────────────

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
    label: 'Usuarios activos',
    icon: <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
    color: 'bg-emerald-50 dark:bg-emerald-500/10',
  } : null;

  return <KPICard data={kpi} loading={loading} onNavigate="/directorio" />;
}

// ── Widget: Trámites Recientes ────────────────────────────────────────────────

export function TramitesRecientesWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const isAdmin = ['Administrador', 'Gerente'].includes(usuario.rol);
        let query = supabase.from('tickets')
          .select('id, folio, tipo, estatus, created_at, titulo')
          .order('created_at', { ascending: false })
          .limit(5);
        if (!isAdmin) query = query.or(`agente_id.eq.${usuario.id},assigned_to.eq.${usuario.id}`);
        const { data } = await query;
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id, usuario.rol]);

  const statusColor: Record<string, string> = {
    'Pendiente': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    'En proceso': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    'En revisión': 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10',
    'Cerrado': 'text-neutral-500 dark:text-white/30 bg-neutral-50 dark:bg-white/5',
  };

  return (
    <WidgetShell title="Trámites Recientes" icon={<ClipboardList className="w-4 h-4" />} onMore={() => nav('/tramites')}>
      {loading ? (
        <div className="space-y-2 p-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="No hay trámites recientes" actionLabel="Crear trámite" actionPath="/tramites" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(t => (
            <li key={t.id}>
              <button
                onClick={() => nav(`/tramites/${t.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-neutral-400 dark:text-white/30 flex-shrink-0">{t.folio || '#'}</span>
                  <span className="text-sm text-neutral-700 dark:text-white/70 truncate">{t.titulo || t.tipo || 'Trámite'}</span>
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

// ── Widget: Pólizas por Vencer ────────────────────────────────────────────────

export function PolizasPorVencerWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('get_home_next_renewals', { p_user_id: usuario.id, p_limit: 5 });
        setItems(data || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Pólizas por Vencer" icon={<FileText className="w-4 h-4" />} onMore={() => nav('/mis-polizas')}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="No hay pólizas próximas a vencer" actionLabel="Ver pólizas" actionPath="/mis-polizas" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((p: any, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-neutral-700 dark:text-white/70 truncate">{p.nombre_asegurado || p.poliza || 'Póliza'}</p>
                <p className="text-xs text-neutral-400 dark:text-white/30">{p.aseguradora || ''}</p>
              </div>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">{p.dias_para_vencer ?? ''}d</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── Widget: Comunicados ───────────────────────────────────────────────────────

export function ComunicadosRecientesWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('comunicados')
          .select('id, titulo, created_at, categoria_id')
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

// ── Widget: Actividad Reciente ────────────────────────────────────────────────

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
    <WidgetShell title="Actividad Reciente" icon={<Activity className="w-4 h-4" />}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="Aún no hay actividad registrada" />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((a, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{a.accion} <span className="text-neutral-400 dark:text-white/30">· {a.modulo}</span></p>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-white/25 flex-shrink-0">
                {new Date(a.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── Widget: Producción por Agente ─────────────────────────────────────────────

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
    <WidgetShell title="Últimas Emisiones" icon={<BarChart3 className="w-4 h-4" />} onMore={() => nav('/produccion/total')}>
      {loading ? (
        <div className="space-y-2 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState message="Sin emisiones recientes" actionLabel="Ver producción" actionPath="/produccion/total" />
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

// ── Widget: Diagnóstico Sistema ───────────────────────────────────────────────

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
    <WidgetShell title="Diagnóstico Sistema" icon={<Activity className="w-4 h-4" />} onMore={() => nav('/admin/diagnostico')}>
      {loading ? (
        <div className="p-4 space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : !data ? (
        <EmptyState message="Sin datos de sincronización" />
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-white/40">Última sync SICAS</span>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
              data.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : data.status === 'running' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
            )}>
              {data.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500 dark:text-white/40">Registros sincronizados</span>
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

// ── Widget: Gamificación ──────────────────────────────────────────────────────

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
        <EmptyState message="Sin datos de progreso aún" />
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

// ── Widget: Producción Mensual (chart placeholder) ────────────────────────────

export function ProduccionMensualWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await supabase.rpc('get_home_production_comparison', { p_user_id: usuario.id });
        setData(d);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, [usuario.id]);

  return (
    <WidgetShell title="Producción Mensual" icon={<TrendingUp className="w-4 h-4" />} onMore={() => nav('/mi-produccion-sicas-live')}>
      {loading ? (
        <div className="p-4"><Skeleton className="h-32" /></div>
      ) : !data ? (
        <EmptyState message="Sin datos de producción" actionLabel="Ver producción" actionPath="/mi-produccion-sicas-live" />
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-neutral-50 dark:bg-white/[0.03] p-3">
              <p className="text-xs text-neutral-400 dark:text-white/35 mb-1">Este mes</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.current_month_prima || 0)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-white/[0.03] p-3">
              <p className="text-xs text-neutral-400 dark:text-white/35 mb-1">Mes anterior</p>
              <p className="text-xl font-bold text-neutral-600 dark:text-white/60">{formatCurrency(data.previous_month_prima || 0)}</p>
            </div>
          </div>
          {data.growth_percent !== undefined && (
            <div className={cn('flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-xl',
              data.growth_percent >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 text-red-500'
            )}>
              <TrendingUp className="w-4 h-4" />
              {data.growth_percent >= 0 ? '+' : ''}{data.growth_percent?.toFixed(1)}% vs mes anterior
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

// ── Widget: Accesos Rápidos ───────────────────────────────────────────────────

type QuickAction = { label: string; path: string; href?: string; icon: React.ReactNode; color: string; bg: string };

const QUICK_ACTIONS: Record<string, QuickAction[]> = {
  Administrador: [
    { label: 'Producción', path: '/produccion/total', icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Usuarios', path: '/directorio', icon: <Users className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Centro Contacto', path: '/centro-contacto', icon: <Activity className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'SICAS', path: '/produccion/sicas-live', icon: <BarChart2 className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Diagnóstico', path: '/admin/diagnostico', icon: <Settings className="w-5 h-5" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
    { label: 'Notificaciones', path: '/admin/transaccionales', icon: <Bell className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  ],
  Gerente: [
    { label: 'Producción', path: '/produccion/total', icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Equipo', path: '/directorio', icon: <Users className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Trámites', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Comisiones', path: '/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <MessageCircle className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
  ],
  Empleado: [
    { label: 'Trámites', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Centro Contacto', path: '/centro-contacto', icon: <Activity className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Comunicados', path: '/comunicados', icon: <Bell className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Users className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
  ],
};

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Mi Página Web', path: '/mercadotecnia/mi-pagina-web', icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { label: 'Mi Producción', path: '/mi-produccion-sicas-live', icon: <TrendingUp className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { label: 'Comisiones', path: '/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  { label: 'Centro Digital', path: '/centro-digital', icon: <Activity className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
  { label: 'Chava IA', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-600 dark:text-white/60', bg: 'bg-neutral-100 dark:bg-white/8' },
];

export function AccesosRapidosWidget({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const baseActions = QUICK_ACTIONS[usuario.rol] || DEFAULT_QUICK_ACTIONS;

  // Inject external web page URL when slug exists
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
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white/80">Accesos Rápidos</h3>
          <p className="text-[11px] text-neutral-400 dark:text-white/30">Módulos frecuentes</p>
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

// ── Shared WidgetShell ────────────────────────────────────────────────────────

function WidgetShell({ title, icon, children, onMore }: { title: string; icon: React.ReactNode; children: React.ReactNode; onMore?: () => void }) {
  return (
    <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-50 dark:border-white/4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/6 flex items-center justify-center text-neutral-500 dark:text-white/40">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70">{title}</h3>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
