import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, Globe, Copy, ExternalLink, ArrowRight, ChevronRight, Zap, MessageCircle, Phone, TrendingUp, Target, Users, BookOpen, Calendar, Play, Briefcase, Settings, ChartBar as BarChart2, FileText, Shield, UserCheck, Activity, Star, MapPin, Check, CircleAlert as AlertCircle, RefreshCw, Newspaper, GraduationCap, Video, DollarSign, Layers, MonitorPlay } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { ChavaInsightsCard } from '../components/dashboard/ChavaInsightsCard';
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('bg-neutral-100 dark:bg-white/6 rounded-xl animate-pulse', className)} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Hero personalizado
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

  const gradientStyle = accentColor
    ? { background: `linear-gradient(135deg, ${accentColor}18 0%, transparent 60%)` }
    : undefined;

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02]"
      style={gradientStyle}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative px-6 py-6 md:px-8 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

          {/* Left: identity block */}
          <div className="flex items-start gap-5">
            {/* Avatar / logo placeholder */}
            <div className={cn(
              'relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm overflow-hidden',
              'bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-white/10 dark:to-white/5',
              'border border-neutral-200 dark:border-white/10'
            )}>
              {(usuario as any).imagen_perfil_url ? (
                <img
                  src={(usuario as any).imagen_perfil_url}
                  alt={nombre}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <span className="text-neutral-600 dark:text-white/70">
                  {nombre.charAt(0)}{apellidos.charAt(0)}
                </span>
              )}
            </div>

            <div className="min-w-0">
              {/* Greeting line */}
              <p className="text-xs font-medium text-neutral-400 dark:text-white/40 mb-0.5">{greeting} · {dateStr}</p>

              {/* Name */}
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white leading-tight truncate">
                {nombre} {apellidos}
              </h1>

              {/* Role + office */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                {rol && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/50">
                    <Shield className="w-3 h-3" /> {rol}
                  </span>
                )}
                {oficinaNombre && (
                  <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/40">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {oficinaNombre}
                  </span>
                )}
              </div>

              {/* Web page */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {webUrl ? (
                  <>
                    <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-white/40 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/8 rounded-lg px-3 py-1.5 font-mono max-w-[260px] truncate">
                      <Globe className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                      <span className="truncate">{webUrl.replace('https://', '')}</span>
                    </span>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/5 text-neutral-600 dark:text-white/60 hover:bg-neutral-50 dark:hover:bg-white/8 transition-all"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                    <a
                      href={webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver página
                    </a>
                  </>
                ) : (
                  <button
                    onClick={() => nav('/mercadotecnia/mi-pagina-web')}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-white/15 text-neutral-500 dark:text-white/40 hover:border-neutral-400 dark:hover:border-white/25 hover:text-neutral-700 dark:hover:text-white/60 transition-all"
                  >
                    <Globe className="w-3 h-3" /> Configurar mi página web
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: office logo */}
          {logoUrl && (
            <div className="flex-shrink-0 hidden sm:flex">
              <div className="h-16 max-w-[180px] flex items-center justify-center bg-white dark:bg-white/[0.06] rounded-2xl px-5 border border-neutral-200 dark:border-white/10 shadow-sm">
                <img
                  src={logoUrl}
                  alt={oficinaNombre ?? 'Oficina'}
                  className="h-10 w-auto max-w-[150px] object-contain"
                  onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tagline */}
        <p className="mt-4 text-sm text-neutral-400 dark:text-white/30 max-w-xl">
          Bienvenido a tu oficina virtual. Aquí tienes lo más importante para trabajar hoy.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — KPI Strip
// ══════════════════════════════════════════════════════════════════════════════

interface KPIItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  path: string;
  loading: boolean;
}

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
          supabase.from('notificaciones_internas')
            .select('id', { count: 'exact', head: true })
            .eq('usuario_id', usuario.id)
            .eq('leido', false),
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

  const items: KPIItem[] = [
    {
      label: 'Trámites activos',
      value: loading ? '—' : ((kpis?.tramites_pendientes || 0) + (kpis?.tramites_en_proceso || 0)),
      icon: <ClipboardList className="w-4 h-4" />,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      path: '/tramites',
      loading,
    },
    {
      label: 'Notificaciones',
      value: loading ? '—' : notifCount,
      icon: <Bell className="w-4 h-4" />,
      color: notifCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-white/40',
      bg: notifCount > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-neutral-100 dark:bg-white/5',
      path: '/centro-notificaciones',
      loading,
    },
    {
      label: 'Tareas CRM',
      value: loading ? '—' : (kpis?.crm_tareas_abiertas || 0),
      icon: <Target className="w-4 h-4" />,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-500/10',
      path: '/mi-crm',
      loading,
    },
    {
      label: 'Contactos',
      value: loading ? '—' : (kpis?.contactos_total || 0),
      icon: <Users className="w-4 h-4" />,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-500/10',
      path: '/contactos',
      loading,
    },
    {
      label: 'Pólizas vigentes',
      value: loading ? '—' : (kpis?.polizas_vigentes || 0),
      icon: <FileText className="w-4 h-4" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      path: '/mis-polizas',
      loading,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => nav(item.path)}
          className="group text-left rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] p-4 hover:border-neutral-200 dark:hover:border-white/12 hover:shadow-sm transition-all duration-200"
        >
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', item.bg, item.color)}>
            {item.loading ? <Sk className="w-4 h-4 !rounded-lg" /> : item.icon}
          </div>
          {item.loading ? (
            <>
              <Sk className="h-6 w-12 mb-1.5" />
              <Sk className="h-3 w-20" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums leading-none mb-1">
                {item.value}
              </p>
              <p className="text-xs text-neutral-400 dark:text-white/40 group-hover:text-neutral-500 dark:group-hover:text-white/50 transition-colors">
                {item.label}
              </p>
            </>
          )}
        </button>
      ))}
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
    setLoading(true);
    setError(false);
    try {
      const { data } = await supabase
        .from('notificaciones_internas')
        .select('id, titulo, mensaje, created_at, tipo, leido, modulo')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setItems(data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [usuario.id]);

  useEffect(() => { load(); }, [load]);

  const typeIcon: Record<string, React.ReactNode> = {
    tramites: <ClipboardList className="w-3.5 h-3.5" />,
    comisiones: <DollarSign className="w-3.5 h-3.5" />,
    comunicados: <Newspaper className="w-3.5 h-3.5" />,
    crm: <Target className="w-3.5 h-3.5" />,
  };

  return (
    <SectionShell
      title="Notificaciones"
      icon={<Bell className="w-3.5 h-3.5" />}
      onMore={() => nav('/centro-notificaciones')}
      badge={items.filter(n => !n.leido).length > 0 ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400">
          {items.filter(n => !n.leido).length}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3">
              <Sk className="w-7 h-7 !rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-3/4" />
                <Sk className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Bell className="w-5 h-5 text-emerald-400" />} message="¡Estás al día! Sin notificaciones nuevas." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(n => (
            <li
              key={n.id}
              className={cn(
                'px-4 py-3 flex items-start gap-3 transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.02]',
                !n.leido && 'bg-blue-50/40 dark:bg-blue-500/[0.04]'
              )}
            >
              <div className={cn(
                'mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0',
                !n.leido ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'bg-neutral-100 dark:bg-white/6 text-neutral-400 dark:text-white/30'
              )}>
                {typeIcon[n.modulo?.toLowerCase()] || <Bell className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm leading-snug truncate',
                  !n.leido ? 'font-medium text-neutral-800 dark:text-white/80' : 'text-neutral-600 dark:text-white/55'
                )}>
                  {n.titulo || n.mensaje}
                </p>
                <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">{getRelativeTime(n.created_at)}</p>
              </div>
              {!n.leido && (
                <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              )}
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
    setLoading(true);
    setError(false);
    try {
      const { data } = await supabase.rpc('get_dashboard_tramites_resumen', {
        p_user_id: usuario.id,
        p_rol: usuario.rol,
        p_oficina_id: usuario.oficina_id || null,
        p_limit: 5,
      });
      const recientes = data?.recientes || [];
      const statuses = data?.por_estatus || {};
      const t = Object.values(statuses).reduce((s: number, v: any) => s + (v as number), 0) as number;
      setItems(recientes);
      setTotal(t);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [usuario.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell
      title="Trámites activos"
      icon={<ClipboardList className="w-3.5 h-3.5" />}
      onMore={() => nav('/tramites')}
      badge={total > 0 ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
          {total}
        </span>
      ) : undefined}
    >
      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map(i => <Sk key={i} className="h-11" />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed
          icon={<ClipboardList className="w-5 h-5 text-amber-400" />}
          message="No hay trámites activos por ahora."
          action={{ label: 'Nuevo trámite', path: '/tramites' }}
        />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map((t: any) => (
            <li key={t.id}>
              <button
                onClick={() => nav(`/tramites/${t.id}`)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs font-mono text-neutral-400 dark:text-white/25 flex-shrink-0 w-10 text-right">{t.folio ? `#${t.folio}` : '—'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-700 dark:text-white/70 truncate group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                      {t.tipo || 'Trámite'}
                    </p>
                    {t.cliente && (
                      <p className="text-xs text-neutral-400 dark:text-white/30 truncate">{t.cliente}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    ESTATUS_COLOR[t.estatus] || 'text-neutral-500 bg-neutral-100 dark:text-white/40 dark:bg-white/6'
                  )}>
                    {t.estatus}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-white/20 group-hover:text-neutral-500 dark:group-hover:text-white/40 transition-colors" />
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
// SECTION 5 — Comunicados
// ══════════════════════════════════════════════════════════════════════════════

function ComunicadosFeed() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await supabase
        .from('comunicados')
        .select('id, titulo, created_at, categoria:comunicados_categorias(nombre), imagen_portada_url')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(4);
      setItems(data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionShell
      title="Comunicados recientes"
      icon={<Newspaper className="w-3.5 h-3.5" />}
      onMore={() => nav('/comunicados')}
    >
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Sk className="w-12 h-12 !rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-5/6" />
                <Sk className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Newspaper className="w-5 h-5 text-neutral-400" />} message="No hay comunicados nuevos por ahora." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(c => (
            <li key={c.id}>
              <button
                onClick={() => nav(`/comunicados/${c.id}`)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group text-left"
              >
                {/* Thumbnail / placeholder */}
                <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
                  {c.imagen_portada_url ? (
                    <img src={c.imagen_portada_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Newspaper className="w-4 h-4 text-neutral-300 dark:text-white/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-700 dark:text-white/70 leading-snug line-clamp-2 group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                    {c.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {c.categoria?.nombre && (
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-white/30 bg-neutral-100 dark:bg-white/6 px-2 py-0.5 rounded-full">
                        {c.categoria.nombre}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-400 dark:text-white/30">
                      {new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
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
// SECTION 6 — Seguros Education: próximos eventos
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
          .select('id, titulo, fecha_inicio, modalidad, descripcion')
          .gte('fecha_inicio', new Date().toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(3);
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
      icon={<Calendar className="w-3.5 h-3.5" />}
      onMore={() => nav('/seguros-education/aula-virtual')}
    >
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2].map(i => <Sk key={i} className="h-14" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Calendar className="w-5 h-5 text-blue-400" />} message="No hay eventos próximos agendados." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(ev => {
            const badge = getEventBadge(ev.fecha_inicio);
            return (
              <li key={ev.id}>
                <button
                  onClick={() => nav('/seguros-education/aula-virtual')}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group text-left"
                >
                  <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <MonitorPlay className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-700 dark:text-white/70 leading-snug truncate group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                      {ev.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', badge.cls)}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-neutral-400 dark:text-white/30">
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
        // Get lessons with optional progress
        const { data: lessons } = await supabase
          .from('seguros_lessons')
          .select('id, titulo, thumbnail_url, duracion_minutos, categoria:seguros_categories(nombre)')
          .eq('activo', true)
          .order('created_at', { ascending: false })
          .limit(4);

        if (!active) return;

        const lessonIds = (lessons || []).map((l: any) => l.id);

        // Load progress for user
        let progressMap: Record<string, number> = {};
        if (lessonIds.length > 0) {
          const { data: prog } = await supabase
            .from('seguros_progress')
            .select('lesson_id, porcentaje_completado')
            .eq('usuario_id', usuario.id)
            .in('lesson_id', lessonIds);
          (prog || []).forEach((p: any) => { progressMap[p.lesson_id] = p.porcentaje_completado; });
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
      icon={<Play className="w-3.5 h-3.5" />}
      onMore={() => nav('/seguros-education/on-demand')}
    >
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Sk className="w-12 h-12 !rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Sk className="h-3.5 w-4/5" />
                <Sk className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyFeed icon={<Video className="w-5 h-5 text-teal-400" />} message="Próximamente cursos On Demand disponibles." />
      ) : (
        <ul className="divide-y divide-neutral-50 dark:divide-white/4">
          {items.map(lesson => (
            <li key={lesson.id}>
              <button
                onClick={() => nav('/seguros-education/on-demand')}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors group text-left"
              >
                <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
                  {lesson.thumbnail_url ? (
                    <img src={lesson.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Play className="w-4 h-4 text-teal-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-700 dark:text-white/70 leading-snug truncate group-hover:text-neutral-900 dark:group-hover:text-white/85 transition-colors">
                    {lesson.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {lesson.categoria?.nombre && (
                      <span className="text-[10px] text-neutral-400 dark:text-white/30 bg-neutral-100 dark:bg-white/6 px-2 py-0.5 rounded-full font-medium">
                        {lesson.categoria.nombre}
                      </span>
                    )}
                    {lesson.duracion_minutos && (
                      <span className="text-[11px] text-neutral-400 dark:text-white/30">{lesson.duracion_minutos}min</span>
                    )}
                  </div>
                  {lesson.progreso > 0 && (
                    <div className="mt-1.5 w-full bg-neutral-100 dark:bg-white/6 rounded-full h-1">
                      <div
                        className="h-1 rounded-full bg-teal-500"
                        style={{ width: `${Math.min(lesson.progreso, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {lesson.progreso > 0 && lesson.progreso < 100 && (
                  <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 flex-shrink-0 mt-1">
                    {lesson.progreso}%
                  </span>
                )}
                {lesson.progreso === 0 && (
                  <span className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 flex-shrink-0 mt-1 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                    Nuevo
                  </span>
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
// SECTION 8 — Accesos Rápidos (enhanced)
// ══════════════════════════════════════════════════════════════════════════════

type QA = { label: string; desc: string; path: string; href?: string; icon: React.ReactNode; color: string; bg: string };

function getQuickActions(usuario: Usuario): QA[] {
  const rol = usuario.rol;
  const webSlug = (usuario as any).web_slug;

  const base: QA[] = [
    { label: 'Trámites', desc: 'Gestiona expedientes', path: '/tramites', icon: <ClipboardList className="w-5 h-5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Contactos', desc: 'Tu CRM personal', path: '/contactos', icon: <MessageCircle className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    { label: 'CRM', desc: 'Tableros de tareas', path: '/mi-crm', icon: <Target className="w-5 h-5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-500/10' },
    { label: 'Cotizador', desc: 'GMM y autos', path: '/cotizar', icon: <BarChart2 className="w-5 h-5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Centro Digital', desc: 'Documentos y más', path: '/centro-digital', icon: <Layers className="w-5 h-5" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { label: 'Comunicados', desc: 'Avisos y noticias', path: '/comunicados', icon: <Newspaper className="w-5 h-5" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { label: 'Educación', desc: 'Cursos Seguros', path: '/seguros-education', icon: <GraduationCap className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { label: 'Mi Producción', desc: 'Pólizas SICAS', path: '/produccion/mi-produccion', icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
    { label: 'Mi Marca', desc: 'Identidad visual', path: '/mercadotecnia/mi-marca', icon: <Star className="w-5 h-5" />, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' },
  ];

  if (webSlug) {
    base.splice(8, 0, { label: 'Mi Página Web', desc: 'Ver página pública', path: '/mercadotecnia/mi-pagina-web', href: `https://agentedeseguros.website/${webSlug}`, icon: <Globe className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' });
  }

  if (rol === 'Administrador' || rol === 'Gerente' || rol === 'Empleado') {
    base.push({ label: 'Centro Contacto', desc: 'Chats y llamadas', path: '/centro-contacto', icon: <Phone className="w-5 h-5" />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' });
    base.push({ label: 'Publicidad', desc: 'Diseños y campañas', path: '/mercadotecnia/publicidad', icon: <Briefcase className="w-5 h-5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' });
  }

  if (rol === 'Administrador') {
    base.push({ label: 'Chava IA', desc: 'Asistente inteligente', path: '/chava', icon: <Zap className="w-5 h-5" />, color: 'text-neutral-700 dark:text-white/70', bg: 'bg-neutral-100 dark:bg-white/8' });
    base.push({ label: 'Administración', desc: 'Panel de control', path: '/directorio', icon: <Settings className="w-5 h-5" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' });
    base.push({ label: 'Producción', desc: 'Central SICAS', path: '/produccion', icon: <Activity className="w-5 h-5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' });
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
    .slice(0, 12);

  return (
    <div className="rounded-2xl border border-neutral-100 dark:border-white/8 bg-white dark:bg-white/[0.02] p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/6 flex items-center justify-center">
          <Zap className="w-4 h-4 text-neutral-500 dark:text-white/40" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-white/80">Accesos rápidos</h3>
          <p className="text-[11px] text-neutral-400 dark:text-white/30">Módulos más utilizados</p>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              if (a.href) window.open(a.href, '_blank', 'noopener,noreferrer');
              else nav(a.path);
            }}
            className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-neutral-100 dark:border-white/6 hover:border-neutral-200 dark:hover:border-white/12 hover:bg-neutral-50 dark:hover:bg-white/4 hover:shadow-sm transition-all duration-200 text-center"
          >
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-hover:shadow-md',
              a.bg, a.color
            )}>
              {a.icon}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-600 dark:text-white/60 leading-tight group-hover:text-neutral-800 dark:group-hover:text-white/80 transition-colors">
                {a.label}
              </p>
              <p className="text-[10px] text-neutral-400 dark:text-white/25 leading-tight mt-0.5 hidden sm:block">
                {a.desc}
              </p>
            </div>
          </button>
        ))}
      </div>
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
          <button
            onClick={onMore}
            className="text-xs text-neutral-400 dark:text-white/30 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 transition-colors"
          >
            Ver todo <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
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
    <div className="flex flex-col items-center justify-center py-9 px-4 gap-2.5 text-center">
      <div className="w-11 h-11 rounded-2xl bg-neutral-50 dark:bg-white/5 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-sm text-neutral-400 dark:text-white/35 max-w-[200px] leading-snug">{message}</p>
      {action && (
        <button
          onClick={() => nav(action.path)}
          className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
        >
          {action.label} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2.5 text-center px-4">
      <AlertCircle className="w-8 h-8 text-neutral-300 dark:text-white/20" />
      <p className="text-sm text-neutral-400 dark:text-white/35">No se pudo cargar la información.</p>
      <button
        onClick={onRetry}
        className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
      >
        <RefreshCw className="w-3 h-3" /> Reintentar
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);
  const { usuario } = useMoviAuth();

  if (!usuario) return null;

  return (
    <div className="space-y-5 pb-10">
      {/* ── 1. Hero personalizado ── */}
      <HeroSection usuario={usuario} />

      {/* ── 2. Chava AI — Administrador only ── */}
      {usuario.rol === 'Administrador' && <ChavaInsightsCard usuario={usuario} />}

      {/* ── 3. KPI Strip ── */}
      <KPIStrip usuario={usuario} />

      {/* ── 4. Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left col */}
        <div className="space-y-5">
          <TramitesFeed usuario={usuario} />
          <NotificacionesFeed usuario={usuario} />
        </div>
        {/* Right col */}
        <div className="space-y-5">
          <ComunicadosFeed />
          <EventosFeed />
          <OnDemandFeed usuario={usuario} />
        </div>
      </div>

      {/* ── 5. Accesos Rápidos ── */}
      <AccesosRapidos usuario={usuario} />
    </div>
  );
}
