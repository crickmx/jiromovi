import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, Globe, Copy, ExternalLink, ChevronRight, Zap, MessageCircle, Phone, TrendingUp, Target, Users, Calendar, Play, Briefcase, Settings, ChartBar as BarChart2, FileText, Shield, Activity, Star, MapPin, Check, CircleAlert as AlertCircle, RefreshCw, Newspaper, GraduationCap, Video, DollarSign, Layers, MonitorPlay, ArrowRight } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useModuleVisibility } from '@/lib/useModuleVisibility';
import type { Usuario } from '@/contexts/MoviAuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate(): string {
  const s = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Hace ${days}d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('bg-neutral-100 dark:bg-white/6 rounded-xl animate-pulse', className)} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Hero compact
// ══════════════════════════════════════════════════════════════════════════════

function HeroSection({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  const nombre = toTitleCase(usuario.nombre || (usuario.nombre_completo || '').split(' ')[0] || 'Usuario');
  const apellidos = toTitleCase(usuario.apellidos || '');
  const oficina = usuario.oficina as any;
  const oficinaNombre = oficina?.nombre;
  const logoUrl = oficina?.logo_url;
  const accentColor = oficina?.accent_color;
  const webSlug = (usuario as any).web_slug;
  const webUrl = webSlug ? `https://agentedeseguros.website/${webSlug}` : null;
  const greeting = getGreeting();
  const dateStr = formatDate();
  const rol = usuario.rol;

  function handleCopy() {
    if (!webUrl) return;
    navigator.clipboard.writeText(webUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="flex-shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02]"
      style={accentColor ? { background: `linear-gradient(135deg, ${accentColor}12 0%, transparent 50%)` } : undefined}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-white/10 dark:to-white/5 border border-neutral-200 dark:border-white/10">
        {(usuario as any).imagen_perfil_url ? (
          <img src={(usuario as any).imagen_perfil_url} alt={nombre} className="w-full h-full object-cover" crossOrigin="anonymous" />
        ) : (
          <span className="text-neutral-600 dark:text-white/70">{nombre.charAt(0)}{apellidos.charAt(0)}</span>
        )}
      </div>

      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-xs text-neutral-400 dark:text-white/35">{greeting} · {dateStr}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-bold text-neutral-900 dark:text-white leading-tight truncate">
            {nombre} {apellidos}
          </h1>
          {rol && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-white/8 text-neutral-500 dark:text-white/40">
              <Shield className="w-2.5 h-2.5" /> {rol}
            </span>
          )}
          {oficinaNombre && (
            <span className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-white/35">
              <MapPin className="w-3 h-3 flex-shrink-0" /> {oficinaNombre}
            </span>
          )}
        </div>
      </div>

      {/* Web URL actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {webUrl ? (
          <>
            <span className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-400 dark:text-white/35 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/8 rounded-lg px-2.5 py-1.5 font-mono max-w-[200px] truncate">
              <Globe className="w-3 h-3 flex-shrink-0 text-emerald-500" />
              <span className="truncate">{webUrl.replace('https://', '')}</span>
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/5 text-neutral-500 dark:text-white/50 hover:bg-neutral-50 dark:hover:bg-white/8 transition-all"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <a
              href={webUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-all"
            >
              <ExternalLink className="w-3 h-3" /> <span className="hidden sm:inline">Ver página</span>
            </a>
          </>
        ) : (
          <button
            onClick={() => nav('/mercadotecnia/mi-pagina-web')}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-white/15 text-neutral-400 dark:text-white/35 hover:border-neutral-400 dark:hover:border-white/25 transition-all"
          >
            <Globe className="w-3 h-3" /> Mi página web
          </button>
        )}
      </div>

      {/* Office logo */}
      {logoUrl && (
        <div className="flex-shrink-0 hidden xl:flex h-9 items-center justify-center bg-white dark:bg-white/5 rounded-xl px-3 border border-neutral-200 dark:border-white/8">
          <img
            src={logoUrl} alt={oficinaNombre ?? ''} className="h-6 w-auto max-w-[120px] object-contain"
            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — KPI Strip
// ══════════════════════════════════════════════════════════════════════════════

function KPIStrip({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [kpis, setKpis] = useState<any>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [kpiRes, notifRes] = await Promise.all([
          supabase.rpc('get_dashboard_kpis', {
            p_user_id: usuario.id,
            p_rol: usuario.rol,
            p_oficina_id: usuario.oficina_id || null,
          }),
          supabase.from('notificaciones')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', usuario.id)
            .eq('leida', false),
        ]);
        if (!active) return;
        setKpis(kpiRes.data);
        setNotifCount(notifRes.count || 0);
      } catch { /* silent */ }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [usuario.id]);

  const items = [
    {
      label: 'Trámites activos',
      value: loading ? '—' : ((kpis?.tramites_pendientes || 0) + (kpis?.tramites_en_proceso || 0)),
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', path: '/tramites',
    },
    {
      label: 'Notificaciones',
      value: loading ? '—' : notifCount,
      icon: <Bell className="w-3.5 h-3.5" />,
      color: notifCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-white/40',
      bg: notifCount > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-neutral-100 dark:bg-white/5',
      path: '/centro-notificaciones',
    },
    {
      label: 'Tareas CRM',
      value: loading ? '—' : (kpis?.crm_tareas_abiertas || 0),
      icon: <Target className="w-3.5 h-3.5" />,
      color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10', path: '/mi-crm',
    },
    {
      label: 'Contactos',
      value: loading ? '—' : (kpis?.contactos_total || 0),
      icon: <Users className="w-3.5 h-3.5" />,
      color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10', path: '/contactos',
    },
    {
      label: 'Pólizas vigentes',
      value: loading ? '—' : (kpis?.polizas_vigentes || 0),
      icon: <FileText className="w-3.5 h-3.5" />,
      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', path: '/mis-polizas',
    },
  ];

  return (
    <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => nav(item.path)}
          className="group text-left rounded-xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] px-3.5 py-2.5 hover:border-neutral-200 dark:hover:border-white/12 hover:shadow-sm transition-all duration-200 flex items-center gap-3"
        >
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.bg, item.color)}>
            {loading ? <Sk className="w-3.5 h-3.5 !rounded-md" /> : item.icon}
          </div>
          <div className="min-w-0">
            {loading ? (
              <>
                <Sk className="h-5 w-8 mb-1" />
                <Sk className="h-2.5 w-16" />
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums leading-none">{item.value}</p>
                <p className="text-[10px] text-neutral-400 dark:text-white/40 leading-tight mt-0.5 truncate">{item.label}</p>
              </>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared UI primitives
// ══════════════════════════════════════════════════════════════════════════════

function SectionShell({
  title, icon, children, onMore, badge
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onMore?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-neutral-50 dark:border-white/4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-neutral-100 dark:bg-white/6 flex items-center justify-center text-neutral-500 dark:text-white/40">
            {icon}
          </div>
          <h3 className="text-xs font-semibold text-neutral-700 dark:text-white/70">{title}</h3>
          {badge}
        </div>
        {onMore && (
          <button
            onClick={onMore}
            className="text-[11px] text-neutral-400 dark:text-white/30 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-0.5 transition-colors"
          >
            Ver todo <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function EmptyFeed({
  icon, message, action
}: {
  icon: React.ReactNode;
  message: string;
  action?: { label: string; path: string };
}) {
  const nav = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-4 gap-2 text-center">
      <div className="w-9 h-9 rounded-2xl bg-neutral-50 dark:bg-white/5 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-xs text-neutral-400 dark:text-white/35 max-w-[180px] leading-snug">{message}</p>
      {action && (
        <button
          onClick={() => nav(action.path)}
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
        >
          {action.label} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 gap-2 text-center px-4">
      <AlertCircle className="w-7 h-7 text-neutral-300 dark:text-white/20" />
      <p className="text-xs text-neutral-400 dark:text-white/35">No se pudo cargar.</p>
      <button onClick={onRetry} className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Reintentar
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Notifications Feed
// ══════════════════════════════════════════════════════════════════════════════

function NotificacionesFeed({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await supabase
        .from('notificaciones')
        .select('id, titulo, mensaje, created_at, tipo, leida, modulo')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(8);
      setItems(data || []);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [usuario.id]);

  useEffect(() => { load(); }, [load]);

  const typeIcon: Record<string, React.ReactNode> = {
    tramites: <ClipboardList className="w-3 h-3" />,
    comisiones: <DollarSign className="w-3 h-3" />,
    comunicados: <Newspaper className="w-3 h-3" />,
    crm: <Target className="w-3 h-3" />,
  };

  const unread = items.filter(n => !n.leida).length;

  return (
    <SectionShell
      title="Notificaciones"
      icon={<Bell className="w-3 h-3" />}
      onMore={() => nav('/centro-notificaciones')}
      badge={unread > 0 ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
          {unread}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="p-3 space-y-2.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-2.5">
              <Sk className="w-6 h-6 !rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1"><Sk className="h-3 w-3/4" /><Sk className="h-2.5 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Bell className="w-4 h-4 text-emerald-400" />} message="¡Estás al día! Sin notificaciones nuevas." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(n => (
            <li
              key={n.id}
              className={cn(
                'px-3 py-2 flex items-start gap-2.5 hover:bg-neutral-50 dark:hover:bg-white/[0.02]',
                !n.leida && 'bg-blue-50/40 dark:bg-blue-500/[0.04]'
              )}
            >
              <div className={cn(
                'mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0',
                !n.leida ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'bg-neutral-100 dark:bg-white/6 text-neutral-400 dark:text-white/30'
              )}>
                {typeIcon[n.modulo?.toLowerCase()] || <Bell className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-xs leading-snug truncate',
                  !n.leida ? 'font-medium text-neutral-800 dark:text-white/80' : 'text-neutral-500 dark:text-white/50'
                )}>
                  {n.titulo || n.mensaje}
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">{getRelativeTime(n.created_at)}</p>
              </div>
              {!n.leida && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Trámites recientes
// ══════════════════════════════════════════════════════════════════════════════

const ESTATUS_COLOR: Record<string, string> = {
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

function TramitesFeed({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await supabase.rpc('get_dashboard_tramites_resumen', {
        p_user_id: usuario.id,
        p_rol: usuario.rol,
        p_oficina_id: usuario.oficina_id || null,
        p_limit: 8,
      });
      const recientes = data?.recientes || [];
      const statuses = data?.por_estatus || {};
      const t = Object.values(statuses).reduce((s: number, v: any) => s + (v as number), 0) as number;
      setItems(recientes);
      setTotal(t);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [usuario.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell
      title="Trámites activos"
      icon={<ClipboardList className="w-3 h-3" />}
      onMore={() => nav('/tramites')}
      badge={total > 0 ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
          {total}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="p-3 space-y-1.5">{[1, 2, 3, 4, 5].map(i => <Sk key={i} className="h-9" />)}</div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed
          icon={<ClipboardList className="w-4 h-4 text-amber-400" />}
          message="No hay trámites activos."
          action={{ label: 'Nuevo trámite', path: '/tramites' }}
        />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((t: any) => (
            <li key={t.id}>
              <button
                onClick={() => nav(`/tramites/${t.id}`)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/[0.02] group"
              >
                <span className="text-[10px] font-mono text-neutral-300 dark:text-white/20 flex-shrink-0 w-8 text-right">{t.folio ? `#${t.folio}` : '—'}</span>
                <p className="text-xs text-neutral-600 dark:text-white/60 truncate flex-1 text-left group-hover:text-neutral-900 dark:group-hover:text-white/80 transition-colors">
                  {t.tipo || 'Trámite'}
                </p>
                <span className={cn(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                  ESTATUS_COLOR[t.estatus] || 'text-neutral-500 bg-neutral-100 dark:text-white/40 dark:bg-white/6'
                )}>
                  {t.estatus}
                </span>
                <ChevronRight className="w-3 h-3 text-neutral-200 dark:text-white/15 flex-shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Comunicados
// ══════════════════════════════════════════════════════════════════════════════

function ComunicadosFeed() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await supabase
        .from('comunicados_publicaciones')
        .select('id, titulo, imagen_principal, fecha_publicacion, fijado')
        .eq('publicado', true)
        .order('fijado', { ascending: false })
        .order('fecha_publicacion', { ascending: false })
        .limit(6);
      setItems(data || []);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell
      title="Comunicados"
      icon={<Newspaper className="w-3 h-3" />}
      onMore={() => nav('/comunicados')}
    >
      {loading ? (
        <div className="p-3 space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2.5">
              <Sk className="w-10 h-10 !rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1"><Sk className="h-3 w-5/6" /><Sk className="h-2.5 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Newspaper className="w-4 h-4 text-neutral-400" />} message="No hay comunicados nuevos." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(c => (
            <li key={c.id}>
              <button
                onClick={() => nav(`/comunicados/${c.id}`)}
                className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/[0.02] group text-left"
              >
                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
                  {c.imagen_principal ? (
                    <img src={c.imagen_principal} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Newspaper className="w-3.5 h-3.5 text-neutral-300 dark:text-white/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-700 dark:text-white/70 leading-snug line-clamp-2 group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                    {c.titulo}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {c.fijado && (
                      <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-full">Fijado</span>
                    )}
                    <span className="text-[10px] text-neutral-400 dark:text-white/30">
                      {new Date(c.fecha_publicacion || c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Próximos eventos
// ══════════════════════════════════════════════════════════════════════════════

function EventosFeed() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('aula_virtual_sesiones')
          .select('id, titulo, fecha_inicio, estado, descripcion')
          .gte('fecha_inicio', new Date().toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(4);
        if (active) setItems(data || []);
      } catch { /* silent */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  function getEventBadge(fechaIso: string) {
    const diff = new Date(fechaIso).getTime() - Date.now();
    const hours = diff / 3600000;
    if (hours <= 0) return { label: 'En curso', cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' };
    if (hours <= 24) return { label: 'Hoy', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    if (hours <= 168) return { label: 'Esta semana', cls: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    return { label: 'Próximo', cls: 'bg-neutral-100 dark:bg-white/8 text-neutral-500 dark:text-white/40' };
  }

  return (
    <SectionShell
      title="Próximos eventos"
      icon={<Calendar className="w-3 h-3" />}
      onMore={() => nav('/seguros-education/aula-virtual')}
    >
      {loading ? (
        <div className="p-3 space-y-2">{[1, 2].map(i => <Sk key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Calendar className="w-4 h-4 text-blue-400" />} message="No hay eventos próximos." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(ev => {
            const badge = getEventBadge(ev.fecha_inicio);
            return (
              <li key={ev.id}>
                <button
                  onClick={() => nav('/seguros-education/aula-virtual')}
                  className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/[0.02] group text-left"
                >
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <MonitorPlay className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-700 dark:text-white/70 leading-snug truncate group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                      {ev.titulo}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', badge.cls)}>{badge.label}</span>
                      <span className="text-[10px] text-neutral-400 dark:text-white/30">
                        {new Date(ev.fecha_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — On Demand
// ══════════════════════════════════════════════════════════════════════════════

function OnDemandFeed({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: lessons } = await supabase
          .from('seguros_lessons')
          .select('id, titulo, miniatura_url, duracion')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!active) return;
        const lessonIds = (lessons || []).map((l: any) => l.id);
        let progressMap: Record<string, number> = {};
        if (lessonIds.length > 0) {
          const { data: prog } = await supabase
            .from('seguros_progress')
            .select('lesson_id, progreso')
            .eq('usuario_id', usuario.id)
            .in('lesson_id', lessonIds);
          (prog || []).forEach((p: any) => { progressMap[p.lesson_id] = p.progreso; });
        }
        if (active) setItems((lessons || []).map((l: any) => ({ ...l, progreso: progressMap[l.id] ?? 0 })));
      } catch { /* silent */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [usuario.id]);

  return (
    <SectionShell
      title="On Demand"
      icon={<Play className="w-3 h-3" />}
      onMore={() => nav('/seguros-education/on-demand')}
    >
      {loading ? (
        <div className="p-3 space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2.5">
              <Sk className="w-10 h-10 !rounded-xl flex-shrink-0" /><div className="flex-1 space-y-1"><Sk className="h-3 w-4/5" /><Sk className="h-2.5 w-1/4" /></div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Video className="w-4 h-4 text-teal-400" />} message="Próximamente cursos disponibles." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(lesson => (
            <li key={lesson.id}>
              <button
                onClick={() => nav('/seguros-education/on-demand')}
                className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-white/[0.02] group text-left"
              >
                <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
                  {lesson.miniatura_url ? (
                    <img src={lesson.miniatura_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-teal-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-700 dark:text-white/70 leading-snug truncate group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                    {lesson.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {lesson.duracion && <span className="text-[10px] text-neutral-400 dark:text-white/30">{lesson.duracion}min</span>}
                    {lesson.progreso > 0 && (
                      <div className="flex-1 bg-neutral-100 dark:bg-white/6 rounded-full h-1">
                        <div className="h-1 rounded-full bg-teal-500" style={{ width: `${Math.min(lesson.progreso, 100)}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                {lesson.progreso === 0 && (
                  <span className="text-[9px] font-semibold text-blue-500 dark:text-blue-400 flex-shrink-0 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full">Nuevo</span>
                )}
                {lesson.progreso > 0 && lesson.progreso < 100 && (
                  <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 flex-shrink-0">{lesson.progreso}%</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Accesos Rápidos
// ══════════════════════════════════════════════════════════════════════════════

type QA = { label: string; path: string; href?: string; icon: React.ReactNode; color: string; bg: string };

function getQuickActions(usuario: Usuario): QA[] {
  const rol = usuario.rol;
  const webSlug = (usuario as any).web_slug;

  const base: QA[] = [
    { label: 'Trámites', path: '/tramites', icon: <ClipboardList className="w-4 h-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Contactos', path: '/contactos', icon: <MessageCircle className="w-4 h-4" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'CRM', path: '/mi-crm', icon: <Target className="w-4 h-4" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'Cotizador', path: '/cotizar', icon: <BarChart2 className="w-4 h-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Centro Digital', path: '/centro-digital', icon: <Layers className="w-4 h-4" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Comunicados', path: '/comunicados', icon: <Newspaper className="w-4 h-4" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: 'Educación', path: '/seguros-education', icon: <GraduationCap className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Producción', path: '/produccion/mi-produccion', icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
    { label: 'Mi Marca', path: '/mercadotecnia/mi-marca', icon: <Star className="w-4 h-4" />, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' },
  ];

  if (webSlug) {
    base.splice(8, 0, { label: 'Mi Página', path: '/mercadotecnia/mi-pagina-web', href: `https://agentedeseguros.website/${webSlug}`, icon: <Globe className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' });
  }

  if (rol === 'Administrador' || rol === 'Gerente' || rol === 'Empleado') {
    base.push({ label: 'C. Contacto', path: '/centro-contacto', icon: <Phone className="w-4 h-4" />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' });
    base.push({ label: 'Publicidad', path: '/mercadotecnia/publicidad', icon: <Briefcase className="w-4 h-4" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' });
  }

  if (rol === 'Administrador') {
    base.push({ label: 'Chava IA', path: '/chava', icon: <Zap className="w-4 h-4" />, color: 'text-neutral-700 dark:text-white/70', bg: 'bg-neutral-100 dark:bg-white/8' });
    base.push({ label: 'Admin', path: '/directorio', icon: <Settings className="w-4 h-4" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' });
    base.push({ label: 'SICAS', path: '/produccion', icon: <Activity className="w-4 h-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' });
  }

  return base;
}

function AccesosRapidos({ usuario }: { usuario: Usuario }) {
  const nav = useNavigate();
  const { isVisible } = useModuleVisibility();
  const rol = usuario.rol || '';
  const oficinaId = usuario.oficina_id ?? null;

  const actions = getQuickActions(usuario)
    .filter(a => isVisible(a.path, rol, oficinaId))
    .slice(0, 10);

  return (
    <div className="flex-shrink-0 rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
          <Zap className="w-3 h-3 text-neutral-500 dark:text-white/40" />
        </div>
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-white/70">Accesos rápidos</h3>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              if (a.href) window.open(a.href, '_blank', 'noopener,noreferrer');
              else nav(a.path);
            }}
            className="group flex flex-col items-center gap-1.5 p-2 rounded-xl border border-neutral-100 dark:border-white/6 hover:border-neutral-200 dark:hover:border-white/12 hover:bg-neutral-50 dark:hover:bg-white/4 hover:shadow-sm transition-all duration-200"
          >
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105',
              a.bg, a.color
            )}>
              {a.icon}
            </div>
            <p className="text-[10px] font-semibold text-neutral-500 dark:text-white/50 leading-tight text-center group-hover:text-neutral-800 dark:group-hover:text-white/75 transition-colors truncate w-full">
              {a.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD — full-page no-scroll layout
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);
  const { usuario } = useMoviAuth();

  if (!usuario) return null;

  return (
    <div className="h-full flex flex-col gap-2.5 p-4 overflow-hidden">
      {/* 1. Hero compact bar */}
      <HeroSection usuario={usuario} />

      {/* 2. KPI strip */}
      <KPIStrip usuario={usuario} />

      {/* 3. Main feeds — grows to fill remaining height */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Left column */}
        <div className="flex flex-col gap-2.5 min-h-0">
          <div className="flex-1 min-h-0"><TramitesFeed usuario={usuario} /></div>
          <div className="flex-1 min-h-0"><NotificacionesFeed usuario={usuario} /></div>
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-2.5 min-h-0">
          <div className="flex-[1.2] min-h-0"><ComunicadosFeed /></div>
          <div className="flex-1 min-h-0"><EventosFeed /></div>
          <div className="flex-1 min-h-0"><OnDemandFeed usuario={usuario} /></div>
        </div>
      </div>

      {/* 4. Accesos rápidos — fixed bottom strip */}
      <AccesosRapidos usuario={usuario} />
    </div>
  );
}
