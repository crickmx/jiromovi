import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Users, UserCheck, FileText, Bell, Activity, Zap, ArrowRight, Shield, ChevronRight, Globe, MessageCircle, Settings, Target, Briefcase, Phone, TrendingUp, DollarSign, ChartBar as BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Usuario } from '@/contexts/MoviAuthContext';

// ── Shared helpers ────────────────────────────────────────────────────────────

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
// WIDGET: Agentes Activos (KPI)
// ══════════════════════════════════════════════════════════════════════════════

export function AgentesActivosWidget({ usuario }: { usuario: Usuario }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let query = supabase.from('usuarios').select('id', { count: 'exact', head: true })
          .eq('estado', 'activo').in('rol', ['Agente', 'Ejecutivo']);
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
        const { count: c } = await supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('estado', 'activo');
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
    'Iniciado': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
    'En Proceso': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
    'Espera Agente': 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10',
    'Espera Aseguradora': 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10',
    'Cotizado': 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10',
    'Emitido': 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    'Emitido (Ganado)': 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    'No Emitido': 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
    'No Emitido (Perdido)': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
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
                  <span className="text-sm text-neutral-700 dark:text-white/70 truncate">{t.tipo || 'Tramite'}</span>
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
    { label: 'Comisiones', path: '/produccion/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  ],
  Empleado: [
    { label: 'Tramites', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Centro Contacto', path: '/centro-contacto', icon: <Phone className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'Comunicados', path: '/comunicados', icon: <Bell className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  ],
};

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Mi Pagina Web', path: '/mercadotecnia/mi-pagina-web', icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { label: 'Mi Produccion', path: '/produccion/mi-produccion', icon: <TrendingUp className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  { label: 'Comisiones', path: '/produccion/mis-comisiones', icon: <DollarSign className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
  { label: 'CRM', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
  { label: 'Centro Digital', path: '/centro-digital', icon: <Activity className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
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
