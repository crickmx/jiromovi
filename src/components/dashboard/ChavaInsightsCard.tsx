import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, ArrowRight, Zap, TriangleAlert as AlertTriangle, Lightbulb, TrendingUp, CircleCheck as CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/contexts/MoviAuthContext';
import { useNavigate } from 'react-router-dom';

interface CTA {
  label: string;
  path: string;
  variant?: 'primary' | 'secondary';
}

interface ChavaAnalysis {
  saludo: string;
  resumen: string;
  recomendaciones: string[];
  alertas: string[];
  oportunidades: string[];
  ctas: CTA[];
}

interface ProactiveItem {
  tipo: 'alerta' | 'recomendacion' | 'oportunidad' | 'accion_pendiente';
  titulo: string;
  cuerpo: string;
  prioridad: number;
}

interface Props {
  usuario: Usuario;
}

const STORAGE_KEY_PREFIX = 'chava_dashboard_cache_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

function buildDashboardContext(usuario: Usuario): object {
  const nombre = usuario.nombre_completo || usuario.nombre || 'Usuario';
  const rol = usuario.rol;
  const oficina = (usuario.oficina as any)?.nombre || 'tu oficina';
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = now.getHours();
  return { nombre, rol, oficina, fecha, hora };
}

export function ChavaInsightsCard({ usuario }: Props) {
  const [analysis, setAnalysis] = useState<ChavaAnalysis | null>(null);
  const [proactiveItems, setProactiveItems] = useState<ProactiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumen' | 'alertas' | 'oportunidades'>('resumen');
  const navigate = useNavigate();

  const cacheKey = `${STORAGE_KEY_PREFIX}${usuario.id}`;

  const loadFromCache = (): ChavaAnalysis | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch { return null; }
  };

  const saveToCache = (data: ChavaAnalysis) => {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* storage full */ }
  };

  // Load proactive items from DB cache
  const loadProactiveItems = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('chava_proactive_cache')
        .select('tipo, titulo, cuerpo, prioridad')
        .eq('usuario_id', usuario.id)
        .eq('leido', false)
        .gt('expires_at', new Date().toISOString())
        .order('prioridad', { ascending: false })
        .limit(6);
      if (data && data.length > 0) setProactiveItems(data as ProactiveItem[]);
    } catch { /* non-blocking */ }
  }, [usuario.id]);

  const fetchAnalysis = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadFromCache();
      if (cached) { setAnalysis(cached); setLoading(false); loadProactiveItems(); return; }
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const context = buildDashboardContext(usuario);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      let res: Response;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/chava-query`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            modulo: 'dashboard',
            ruta: '/dashboard',
            parametros: { dashboard_context: true, usuario_context: context },
            mensaje: `Genera mi análisis del día como CHAVA OS. Responde SOLO con un JSON válido con esta estructura exacta:
{
  "saludo": "saludo personalizado corto",
  "resumen": "resumen de situación actual en 1-2 oraciones",
  "recomendaciones": ["recomendación 1", "recomendación 2"],
  "alertas": ["alerta urgente 1 si existe"],
  "oportunidades": ["oportunidad comercial 1 si existe"],
  "ctas": [{"label": "acción clave", "path": "/ruta", "variant": "primary"}]
}`,
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) throw new Error('API error');

      const json = await res.json();
      const text: string = json.respuesta || json.mensaje || '';

      if (!text || text.length < 5) throw new Error('Empty response');

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed: ChavaAnalysis = JSON.parse(jsonMatch[0]);
      if (!parsed.saludo || !parsed.resumen) throw new Error('Invalid schema');

      parsed.recomendaciones = Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones.filter(s => typeof s === 'string') : [];
      parsed.alertas = Array.isArray(parsed.alertas) ? parsed.alertas.filter(s => typeof s === 'string') : [];
      parsed.oportunidades = Array.isArray(parsed.oportunidades) ? parsed.oportunidades.filter(s => typeof s === 'string') : [];
      parsed.ctas = Array.isArray(parsed.ctas) ? parsed.ctas.filter(c => c && typeof c.label === 'string' && typeof c.path === 'string') : [];

      setAnalysis(parsed);
      saveToCache(parsed);
      await loadProactiveItems();
    } catch (err) {
      console.error('Chava dashboard error:', err);
      setAnalysis(getFallbackAnalysis(usuario));
    } finally {
      setLoading(false);
    }
  }, [usuario.id, usuario.rol]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  // Merge proactive items into display
  const alerts = [
    ...proactiveItems.filter(p => p.tipo === 'alerta').map(p => p.cuerpo),
    ...(analysis?.alertas || []),
  ].slice(0, 3);

  const recs = [
    ...proactiveItems.filter(p => p.tipo === 'recomendacion').map(p => p.cuerpo),
    ...(analysis?.recomendaciones || []),
  ].slice(0, 3);

  const ops = [
    ...proactiveItems.filter(p => p.tipo === 'oportunidad').map(p => p.cuerpo),
    ...(analysis?.oportunidades || []),
  ].slice(0, 3);

  const tabItems = { resumen: recs, alertas: alerts, oportunidades: ops };
  const currentItems = tabItems[activeTab];

  if (loading) return <ChavaInsightsSkeleton />;
  if (!analysis) return null;

  // Build final CTA list
  const webSlug = (usuario as any).web_slug as string | null | undefined;
  const webHref = webSlug ? `https://agentedeseguros.website/${webSlug}` : null;

  const permanentCtas: (CTA & { href?: string })[] = [
    { label: 'Mi Página Web', path: '/mercadotecnia/mi-pagina-web', href: webHref ?? undefined, variant: 'primary' },
    { label: 'Hablar con Chava', path: '/chava', variant: 'secondary' },
  ];
  const dynamicCtas = (analysis.ctas || []).filter(
    c => c.path !== '/mercadotecnia/mi-pagina-web' && c.path !== '/chava'
  ).slice(0, 2);
  const allCtas = [...permanentCtas, ...dynamicCtas];

  const tabConfig = [
    { key: 'resumen' as const, label: 'Recomendaciones', icon: Lightbulb, count: recs.length, color: 'cyan' },
    { key: 'alertas' as const, label: 'Alertas', icon: AlertTriangle, count: alerts.length, color: 'amber' },
    { key: 'oportunidades' as const, label: 'Oportunidades', icon: TrendingUp, count: ops.length, color: 'emerald' },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">CHAVA OS</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-400/20">
                  Sistema Operativo Inteligente
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">Análisis proactivo para tu rol</p>
            </div>
          </div>
          <button
            onClick={() => fetchAnalysis(true)}
            className="p-2 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
            title="Actualizar análisis"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Greeting + Summary */}
        <div className="mb-4">
          <p className="text-base font-semibold text-white leading-snug mb-1">{analysis.saludo}</p>
          <p className="text-sm text-white/60 leading-relaxed">{analysis.resumen}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl bg-white/5 border border-white/8">
          {tabConfig.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const colorMap: Record<string, string> = {
              cyan: isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/20' : 'text-white/40 hover:text-white/60',
              amber: isActive ? 'bg-amber-500/20 text-amber-300 border border-amber-400/20' : 'text-white/40 hover:text-white/60',
              emerald: isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/20' : 'text-white/40 hover:text-white/60',
            };
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  colorMap[tab.color]
                )}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1 rounded-full',
                    tab.color === 'amber' && tab.count > 0 ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-white/50'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="min-h-[80px] mb-4">
          {currentItems.length > 0 ? (
            <ul className="space-y-2">
              {currentItems.map((item, i) => {
                const dotColor = activeTab === 'alertas' ? 'bg-amber-400' : activeTab === 'oportunidades' ? 'bg-emerald-400' : 'bg-cyan-400';
                const textColor = activeTab === 'alertas' ? 'text-amber-200/80' : activeTab === 'oportunidades' ? 'text-emerald-200/80' : 'text-cyan-200/80';
                return (
                  <li key={i} className="flex items-start gap-2.5 text-xs leading-snug">
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0', dotColor)} />
                    <span className={cn('opacity-90', textColor)}>{item}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-xs text-white/30 py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {activeTab === 'alertas' ? 'Sin alertas activas' :
                 activeTab === 'oportunidades' ? 'Consulta CHAVA para análisis de oportunidades' :
                 'Sin recomendaciones pendientes'}
              </span>
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {allCtas.map((cta, i) => {
            const isExternal = !!(cta as any).href;
            const href = isExternal ? (cta as any).href : cta.path;
            return (
              <a
                key={i}
                href={href}
                {...(isExternal
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {
                      onClick: (e: React.MouseEvent) => {
                        e.preventDefault();
                        navigate(cta.path);
                      }
                    }
                )}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all',
                  cta.variant === 'primary'
                    ? 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-lg shadow-cyan-500/25'
                    : 'bg-white/8 text-white/75 hover:bg-white/12 border border-white/10'
                )}
              >
                {cta.variant === 'primary' && <Zap className="w-3 h-3" />}
                {cta.label}
                <ArrowRight className="w-3 h-3 opacity-60" />
              </a>
            );
          })}
        </div>

        {/* Quick nav to full CHAVA */}
        <button
          onClick={() => navigate('/chava')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
              Abrir CHAVA OS completo — análisis profundo, documentos, trámites
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-colors" />
        </button>

        {/* Disclaimer */}
        <p className="mt-3 text-[10px] text-white/20 leading-relaxed">
          Análisis generado por IA. Confirma los datos antes de tomar decisiones importantes.
        </p>
      </div>
    </div>
  );
}

function ChavaInsightsSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/8 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
          <div className="h-2 w-36 rounded bg-white/8 animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
        <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-white/8 animate-pulse" />
      </div>
      <div className="flex gap-1 mb-3 p-1 rounded-xl bg-white/5">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-8 rounded-lg bg-white/8 animate-pulse" />
        ))}
      </div>
      <div className="space-y-2 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-3 rounded bg-white/8 animate-pulse" style={{ width: `${70 + i * 8}%` }} />
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-7 w-28 rounded-xl bg-white/8 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function getFallbackAnalysis(usuario: Usuario): ChavaAnalysis {
  const nombre = usuario.nombre || 'equipo';
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';

  const ctasByRole: Record<string, CTA[]> = {
    Administrador: [
      { label: 'Ver producción', path: '/produccion/total', variant: 'primary' },
      { label: 'Administrar usuarios', path: '/directorio', variant: 'secondary' },
    ],
    Gerente: [
      { label: 'Ver producción equipo', path: '/produccion/total', variant: 'primary' },
      { label: 'Revisar trámites', path: '/tramites', variant: 'secondary' },
    ],
    Empleado: [
      { label: 'Ver trámites', path: '/tramites', variant: 'primary' },
      { label: 'Centro de contacto', path: '/centro-contacto', variant: 'secondary' },
    ],
  };

  const defaultCtas: CTA[] = [
    { label: 'Mi producción', path: '/mi-produccion-sicas-live', variant: 'primary' },
    { label: 'Mis comisiones', path: '/mis-comisiones', variant: 'secondary' },
  ];

  return {
    saludo: `${greeting}, ${nombre}`,
    resumen: 'Aquí tienes un resumen de tu operación. Revisa los módulos para ver la información más reciente.',
    recomendaciones: ['Revisa tus trámites pendientes', 'Consulta la producción del período actual', 'Mantén actualizados tus contactos'],
    alertas: [],
    oportunidades: ['Visita CHAVA OS para análisis personalizados en tiempo real'],
    ctas: ctasByRole[usuario.rol] || defaultCtas,
  };
}
