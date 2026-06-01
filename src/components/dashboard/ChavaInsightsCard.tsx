import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/contexts/MoviAuthContext';

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

interface Props {
  usuario: Usuario;
}

const STORAGE_KEY_PREFIX = 'chava_dashboard_cache_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

function buildContextPrompt(usuario: Usuario): string {
  const nombre = usuario.nombre_completo || usuario.nombre || 'Usuario';
  const rol = usuario.rol;
  const oficina = (usuario.oficina as any)?.nombre || 'tu oficina';
  const now = new Date();
  const fecha = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return `Eres Chava, el asistente inteligente de MOVI Digital.

El usuario es ${nombre}, con rol "${rol}" en la oficina "${oficina}".
Hoy es ${fecha}.

Genera un análisis JSON con este formato EXACTO (sin markdown, solo JSON):
{
  "saludo": "mensaje breve de bienvenida personalizado según hora del día",
  "resumen": "resumen ejecutivo de 1-2 oraciones según el rol del usuario",
  "recomendaciones": ["recomendación 1", "recomendación 2", "recomendación 3"],
  "alertas": ["alerta importante si aplica"],
  "oportunidades": ["oportunidad detectada 1", "oportunidad detectada 2"],
  "ctas": [
    {"label": "texto del botón", "path": "/ruta", "variant": "primary"},
    {"label": "texto del botón", "path": "/ruta", "variant": "secondary"},
    {"label": "texto del botón", "path": "/ruta", "variant": "secondary"}
  ]
}

CTAs válidos según el rol "${rol}":
${rol === 'Administrador' ? `
- {"label": "Ver producción global", "path": "/produccion/total", "variant": "primary"}
- {"label": "Administrar usuarios", "path": "/directorio", "variant": "secondary"}
- {"label": "Ver diagnóstico", "path": "/admin/diagnostico", "variant": "secondary"}
- {"label": "Configurar SICAS", "path": "/produccion/configuracion", "variant": "secondary"}
- {"label": "Ver trámites activos", "path": "/tramites", "variant": "secondary"}
- {"label": "Notificaciones", "path": "/admin/transaccionales", "variant": "secondary"}` : ''}
${rol === 'Gerente' ? `
- {"label": "Ver producción equipo", "path": "/produccion/total", "variant": "primary"}
- {"label": "Revisar trámites", "path": "/tramites", "variant": "secondary"}
- {"label": "Ver mi equipo", "path": "/directorio", "variant": "secondary"}
- {"label": "Ver comisiones", "path": "/mis-comisiones", "variant": "secondary"}
- {"label": "Centro de contacto", "path": "/centro-contacto", "variant": "secondary"}` : ''}
${rol === 'Empleado' ? `
- {"label": "Ver trámites asignados", "path": "/tramites", "variant": "primary"}
- {"label": "Abrir centro de contacto", "path": "/centro-contacto", "variant": "secondary"}
- {"label": "Ver mis contactos", "path": "/contactos", "variant": "secondary"}
- {"label": "Revisar comunicados", "path": "/comunicados", "variant": "secondary"}` : ''}
${rol === 'Agente' || rol === 'Ejecutivo' ? `
- {"label": "Ver mi producción", "path": "/mi-produccion-sicas-live", "variant": "primary"}
- {"label": "Mis comisiones", "path": "/mis-comisiones", "variant": "secondary"}
- {"label": "Mi página web", "path": "/mercadotecnia/mi-pagina-web", "variant": "secondary"}
- {"label": "Centro Digital", "path": "/centro-digital", "variant": "secondary"}
- {"label": "Mis trámites", "path": "/tramites", "variant": "secondary"}
- {"label": "Hablar con Chava", "path": "/chava", "variant": "secondary"}` : ''}

Responde SOLO con el JSON. Sin markdown, sin explicaciones.`;
}

export function ChavaInsightsCard({ usuario }: Props) {
  const [analysis, setAnalysis] = useState<ChavaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const cacheKey = `${STORAGE_KEY_PREFIX}${usuario.id}`;

  const loadFromCache = (): ChavaAnalysis | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  };

  const saveToCache = (data: ChavaAnalysis) => {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* storage full */ }
  };

  const fetchAnalysis = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadFromCache();
      if (cached) { setAnalysis(cached); setLoading(false); return; }
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const prompt = buildContextPrompt(usuario);

      const res = await fetch(`${supabaseUrl}/functions/v1/chava-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mensaje: prompt,
          modulo: 'dashboard',
          ruta: '/dashboard',
          parametros: { dashboard_context: true },
        }),
      });

      if (!res.ok) throw new Error('API error');

      const json = await res.json();
      const text: string = json.respuesta || json.mensaje || '';

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid response format');

      const parsed: ChavaAnalysis = JSON.parse(jsonMatch[0]);
      setAnalysis(parsed);
      saveToCache(parsed);
    } catch (err) {
      console.error('Chava dashboard error:', err);
      const fallback = getFallbackAnalysis(usuario);
      setAnalysis(fallback);
    } finally {
      setLoading(false);
    }
  }, [usuario.id, usuario.rol]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  if (loading) return <ChavaInsightsSkeleton />;

  if (!analysis) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-white/8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Chava IA</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-400/20">
                  agentedeseguros.ai
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">Análisis inteligente para tu rol</p>
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

        {/* Grid: alerts + recs + opportunities */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {analysis.alertas.length > 0 && (
            <InsightPill color="amber" label="Alerta" items={analysis.alertas} />
          )}
          {analysis.recomendaciones.length > 0 && (
            <InsightPill color="cyan" label="Recomendación" items={analysis.recomendaciones} />
          )}
          {analysis.oportunidades.length > 0 && (
            <InsightPill color="emerald" label="Oportunidad" items={analysis.oportunidades} />
          )}
        </div>

        {/* CTAs — permanent + dynamic */}
        {(() => {
          const permanentCtas: CTA[] = [
            { label: 'Mi Página Web', path: '/mercadotecnia/mi-pagina-web', variant: 'primary' },
            { label: 'Hablar con Chava IA', path: '/chava', variant: 'secondary' },
          ];
          const dynamicCtas = (analysis.ctas || []).filter(
            c => c.path !== '/mercadotecnia/mi-pagina-web' && c.path !== '/chava'
          );
          const allCtas = [...permanentCtas, ...dynamicCtas];
          return (
            <div className="flex flex-wrap gap-2">
              {allCtas.map((cta, i) => (
                <a
                  key={i}
                  href={cta.path}
                  onClick={e => { e.preventDefault(); window.location.href = cta.path; }}
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
              ))}
            </div>
          );
        })()}

        {/* Disclaimer */}
        <p className="mt-4 text-[10px] text-white/20 leading-relaxed">
          La información es generada por IA y puede contener errores. Confirma los datos antes de tomar decisiones importantes.
        </p>
      </div>
    </div>
  );
}

function InsightPill({ color, label, items }: { color: 'cyan' | 'amber' | 'emerald'; label: string; items: string[] }) {
  const colors = {
    cyan: 'bg-cyan-500/8 border-cyan-400/15 text-cyan-300',
    amber: 'bg-amber-500/8 border-amber-400/15 text-amber-300',
    emerald: 'bg-emerald-500/8 border-emerald-400/15 text-emerald-300',
  };
  const dots = { cyan: 'bg-cyan-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400' };

  return (
    <div className={cn('rounded-xl border p-3', colors[color])}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2">{label}</p>
      <ul className="space-y-1.5">
        {items.slice(0, 2).map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-snug">
            <span className={cn('w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0', dots[color])} />
            <span className="opacity-85">{item}</span>
          </li>
        ))}
      </ul>
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
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
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
      { label: 'Diagnóstico', path: '/admin/diagnostico', variant: 'secondary' },
    ],
    Gerente: [
      { label: 'Ver producción equipo', path: '/produccion/total', variant: 'primary' },
      { label: 'Revisar trámites', path: '/tramites', variant: 'secondary' },
      { label: 'Ver equipo', path: '/directorio', variant: 'secondary' },
    ],
    Empleado: [
      { label: 'Ver trámites', path: '/tramites', variant: 'primary' },
      { label: 'Centro de contacto', path: '/centro-contacto', variant: 'secondary' },
      { label: 'Mis contactos', path: '/contactos', variant: 'secondary' },
    ],
  };

  const defaultCtas: CTA[] = [
    { label: 'Ver mi producción', path: '/mi-produccion-sicas-live', variant: 'primary' },
    { label: 'Mis comisiones', path: '/mis-comisiones', variant: 'secondary' },
    { label: 'Hablar con Chava', path: '/chava', variant: 'secondary' },
  ];

  return {
    saludo: `${greeting}, ${nombre}`,
    resumen: 'Aquí tienes un resumen de tu operación. Revisa los módulos para ver la información más reciente.',
    recomendaciones: ['Revisa tus trámites pendientes', 'Consulta la producción del período actual', 'Mantén actualizados tus contactos'],
    alertas: [],
    oportunidades: ['Visita Chava IA para análisis personalizados en tiempo real'],
    ctas: ctasByRole[usuario.rol] || defaultCtas,
  };
}
