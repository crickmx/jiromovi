import { useEffect, useState, type ReactNode, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  MoonStar,
  Sparkles,
  SunMedium,
  ArrowRight,
  Star,
  Radio,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { resolveDashboardIcon } from '../lib/dashboardIcons';
import type { Usuario } from '../contexts/MoviAuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useModuleVisibility } from '@/lib/useModuleVisibility';
import { useDashboardConfig, type DashboardVcard } from '@/lib/useDashboardConfig';
import { obtenerComunicados } from '../lib/comunicadosUtils';
import type { ComunicadoPublicacion } from '../lib/comunicadosTypes';
import { SolicitudBetaModal } from '../components/dashboard/SolicitudBetaModal';
import { ProduccionResumenCard } from '../components/dashboard/ProduccionResumenCard';
import { CampaniasActivasCard } from '../components/dashboard/CampaniasActivasCard';
import { ConvencionCard } from '../components/dashboard/ConvencionCard';
import { VendedorSections } from '../components/dashboard/VendedorSections';
import { GerenteSections } from '../components/dashboard/GerenteSections';
import { DireccionSections } from '../components/dashboard/DireccionSections';
import { EjecutivoSections } from '../components/dashboard/EjecutivoSections';

// ── Helpers ─────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getGreetingIcon(): LucideIcon {
  const h = new Date().getHours();
  if (h < 12) return SunMedium;
  if (h < 19) return Sparkles;
  return MoonStar;
}

function formatDate(): string {
  const raw = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getRelativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffMin / 24);
  if (diffD < 7) return `Hace ${diffD} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200 dark:bg-white/10', className)} />;
}

function SectionShell({
  title,
  icon: Icon,
  badge,
  onMore,
  children,
}: {
  title: string;
  icon: ElementType;
  badge?: ReactNode;
  onMore?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-neutral-900/90 border border-neutral-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-neutral-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight">{title}</h3>
          {badge}
        </div>
        {onMore && (
          <button
            onClick={onMore}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 dark:text-accent-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
          >
            <span>Ver más</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Datos estáticos ─────────────────────────────────────────────────────

const BETA_FAVORITOS = [
  { label: 'Nuevo Trámite', iconKey: 'ClipboardList', route: '/tramites' },
  { label: 'Avisos', iconKey: 'Bell', route: '/comunicados' },
  { label: 'Fotos Estudio', iconKey: 'Camera', route: '/mercadotecnia/fotos-estudio' },
  { label: 'Mis Metas', iconKey: 'Target', route: '/produccion' },
  { label: 'Chat', iconKey: 'MessageSquare', route: '/centro-contacto/chat' },
  { label: 'Mi Perfil', iconKey: 'User', route: '/perfil' },
] as const;

// ── WelcomeHero ─────────────────────────────────────────────────────────

function WelcomeHero({ usuario }: { usuario: Usuario }) {
  const accentColor = usuario.oficina?.accent_color || '#164281';
  const GreetingIcon = getGreetingIcon();

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 sm:p-6 shadow-md border border-white/10"
      style={{
        backgroundColor: accentColor,
        backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, rgba(10, 25, 55, 0.95) 100%)`,
      }}
    >
      {/* Luces decorativas ambientales */}
      <div
        className="absolute -top-12 -right-12 w-64 h-64 rounded-full pointer-events-none opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-16 -left-12 w-72 h-48 rounded-full pointer-events-none opacity-30 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(255, 215, 0, 0.35), transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white/95 text-[11px] font-semibold mb-2 shadow-sm">
            <GreetingIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>{getGreeting()}</span>
          </div>

          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight truncate leading-tight">
            {usuario.nombre} <span className="font-light opacity-95">{usuario.apellidos}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/85 mt-1.5 font-medium">
            <span>{formatDate()}</span>
            {usuario.oficina?.nombre && (
              <>
                <span className="opacity-50">·</span>
                <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                  🏢 {usuario.oficina.nombre}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-white/20 backdrop-blur-md border border-white/30 shadow-sm whitespace-nowrap tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {usuario.rol}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── ModuleVCards ────────────────────────────────────────────────────────

function ModuleVCards({
  modules,
  onNavigate,
}: {
  modules: DashboardVcard[];
  onNavigate: (route: string) => void;
}) {
  if (modules.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 dark:border-white/15 p-8 text-center bg-white/50 dark:bg-white/[0.02]">
        <p className="text-sm font-semibold text-neutral-600 dark:text-white/70">
          No hay módulos disponibles en tu vista actual
        </p>
        <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">
          La visibilidad se gestiona desde Control de Módulos.
        </p>
      </div>
    );
  }

  const isOddLast = (i: number) => modules.length % 2 === 1 && i === modules.length - 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {modules.map((m, i) => {
        const Icon = resolveDashboardIcon(m.icon_key ?? m.emoji);
        const singleSpan = isOddLast(i);

        return (
          <button
            key={m.card_key}
            type="button"
            onClick={() => onNavigate(m.route)}
            className={cn(
              'group text-left relative rounded-2xl overflow-hidden p-4 sm:p-5 min-h-[112px] flex flex-col justify-between gap-3 transition-all duration-200 cursor-pointer shadow-sm border border-white/15 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              singleSpan && 'sm:col-span-2'
            )}
            style={{
              background: `linear-gradient(145deg, ${m.gradient_from}, ${m.gradient_to})`,
            }}
          >
            {/* Ambient glass sheen */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none group-hover:scale-125 transition-transform duration-300" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-white/30 transition-colors">
                <Icon className="w-5 h-5 text-white" />
              </div>

              <div className="w-7 h-7 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white/90 group-hover:bg-white group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all shadow-sm shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="relative z-10 min-w-0">
              <h2 className="text-base font-bold text-white tracking-tight leading-snug group-hover:underline decoration-white/50 underline-offset-2">
                {m.label}
              </h2>
              {m.descripcion && (
                <p className="text-xs text-white/85 line-clamp-2 leading-relaxed mt-0.5">
                  {m.descripcion}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── FavoritosGrid ───────────────────────────────────────────────────────

function FavoritosGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="bg-white dark:bg-neutral-900/90 border border-neutral-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-neutral-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight leading-none">
              Mis Favoritos
            </h3>
            <p className="text-[11px] text-neutral-400 dark:text-white/40 mt-0.5">Accesos rápidos y herramientas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
        {BETA_FAVORITOS.map(fav => {
          const Icon = resolveDashboardIcon(fav.iconKey);
          return (
            <button
              key={fav.route}
              type="button"
              onClick={() => onNavigate(fav.route)}
              className="group p-3 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-neutral-50/70 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="w-7 h-7 rounded-lg bg-neutral-200/60 dark:bg-white/10 flex items-center justify-center text-[#164281] dark:text-sky-300 group-hover:scale-110 transition-transform">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white tracking-tight leading-tight line-clamp-1">
                {fav.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── JoinBetaCard ────────────────────────────────────────────────────────

type BetaEstado = 'cargando' | 'ya_beta' | 'pendiente' | 'sin_solicitar';

function JoinBetaCard({ usuario }: { usuario: Usuario }) {
  const [estado, setEstado] = useState<BetaEstado>('cargando');
  const [showModal, setShowModal] = useState(false);

  const cargarEstado = async () => {
    const [{ data: beta }, { data: pendiente }] = await Promise.all([
      supabase.from('usuarios_beta').select('id').eq('usuario_id', usuario.id).maybeSingle(),
      supabase
        .from('tickets')
        .select('id')
        .eq('tipo_tramite', 'alta_usuario_beta')
        .eq('creado_por', usuario.id)
        .is('cerrado_en', null)
        .maybeSingle(),
    ]);
    setEstado(beta ? 'ya_beta' : pendiente ? 'pendiente' : 'sin_solicitar');
  };

  useEffect(() => {
    cargarEstado();
  }, [usuario.id]);

  if (estado === 'ya_beta') {
    return (
      <div
        className="rounded-2xl p-5 relative overflow-hidden border border-white/20 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #10B981, #065F46)' }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎉</span>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full border border-white/25">
            Usuario Activo
          </span>
        </div>
        <p className="text-base font-bold text-white mb-1">Ya eres usuario Beta</p>
        <p className="text-xs text-white/85 leading-relaxed">
          Cuentas con acceso a todas las nuevas herramientas en desarrollo. Gracias por ayudarnos a mejorar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        <div
          className="absolute -inset-0.5 rounded-2xl opacity-75 blur-sm animate-pulse pointer-events-none"
          style={{ background: 'linear-gradient(145deg, #FFD166, #E84F8A, #8E1A52)', animationDuration: '3s' }}
        />
        <div
          className="rounded-2xl p-5 relative overflow-hidden border border-white/20 shadow-md flex flex-col justify-between"
          style={{ background: 'linear-gradient(135deg, #E84F8A, #8E1A52)' }}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🚀</span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#FFD166] text-[#5A3300] px-2 py-0.5 rounded-full shadow-sm">
                Novedad
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1">Únete al Programa Beta</h3>
            <p className="text-xs text-white/85 mb-4 leading-relaxed">
              Prueba las nuevas funciones de MOVI antes que nadie y comparte tu retroalimentación directa.
            </p>
          </div>

          {estado === 'pendiente' ? (
            <div className="bg-white/20 border border-white/30 text-white text-xs font-semibold py-2 px-3 rounded-xl text-center">
              ⏳ Solicitud enviada, en revisión
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={estado === 'cargando'}
              className="w-full bg-white text-[#8E1A52] text-xs font-bold py-2.5 px-4 rounded-xl text-center hover:bg-white/95 active:scale-[0.99] transition-all shadow-md disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Solicitar acceso Beta →
            </button>
          )}
        </div>
      </div>
      {showModal && (
        <SolicitudBetaModal
          usuario={usuario}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            cargarEstado();
          }}
        />
      )}
    </>
  );
}

// ── AvisosPanel ─────────────────────────────────────────────────────────

const AVISO_DOT_COLORS = ['#E84F8A', '#5A6EC4', '#3DA88A'];

function AvisosPanel({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [avisos, setAvisos] = useState<ComunicadoPublicacion[] | 'loading' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    obtenerComunicados(3)
      .then(data => {
        if (active) setAvisos(data);
      })
      .catch(() => {
        if (active) setAvisos('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SectionShell
      title="Avisos y Comunicados"
      icon={Bell}
      badge={
        Array.isArray(avisos) && avisos.length > 0 ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
            {avisos.length}
          </span>
        ) : undefined
      }
      onMore={() => onNavigate('/comunicados')}
    >
      {avisos === 'loading' && (
        <div className="space-y-2.5">
          <Sk className="h-12 w-full" />
          <Sk className="h-12 w-full" />
          <Sk className="h-12 w-full" />
        </div>
      )}

      {avisos === 'error' && (
        <div className="py-6 text-center">
          <p className="text-xs text-red-500 font-medium">Error al cargar avisos recientes</p>
        </div>
      )}

      {Array.isArray(avisos) && avisos.length === 0 && (
        <div className="py-6 text-center text-neutral-400 dark:text-white/40">
          <p className="text-xs font-medium">Sin avisos recientes</p>
        </div>
      )}

      {Array.isArray(avisos) && avisos.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-white/5">
          {avisos.map((aviso, i) => (
            <div
              key={aviso.id}
              onClick={() => onNavigate('/comunicados')}
              className="flex items-start gap-2.5 py-2.5 hover:bg-neutral-50 dark:hover:bg-white/5 -mx-2 px-2 rounded-xl transition-colors cursor-pointer group"
              title={aviso.titulo}
            >
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-sm"
                style={{ backgroundColor: AVISO_DOT_COLORS[i % AVISO_DOT_COLORS.length] }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-neutral-800 dark:text-white/90 truncate group-hover:text-accent transition-colors">
                  {aviso.titulo}
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-white/40 mt-0.5">
                  {aviso.fecha_publicacion ? getRelativeTime(aviso.fecha_publicacion) : ''}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-neutral-300 dark:text-white/20 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ── Render Widget Resolver ──────────────────────────────────────────────

function renderWidget(key: string, usuario: Usuario, navigate: (route: string) => void): ReactNode {
  switch (key) {
    case 'favoritos':
      return <FavoritosGrid key={key} onNavigate={navigate} />;
    case 'beta':
      return <JoinBetaCard key={key} usuario={usuario} />;
    case 'produccion_bonos':
      return <ProduccionResumenCard key={key} />;
    case 'campanias':
      return <CampaniasActivasCard key={key} />;
    case 'convencion':
      return <ConvencionCard key={key} />;
    case 'avisos':
      return <AvisosPanel key={key} onNavigate={navigate} />;
    default:
      return null;
  }
}

// ── Dashboard Principal ─────────────────────────────────────────────────

export default function Dashboard() {
  useEffect(() => {
    document.title = 'Dashboard · MOVI Digital';
  }, []);

  const { usuario } = useMoviAuth();
  const navigate = useNavigate();
  const { isVisible } = useModuleVisibility();
  const { vcards, widgets } = useDashboardConfig();

  if (!usuario) return null;

  const visibleFor = (moduleKey: string) =>
    isVisible(moduleKey, usuario.rol, usuario.oficina_id, usuario.id);

  const enabledVcards = vcards
    .filter(v => v.activa)
    .filter(v => visibleFor(`dashboard:vcard:${v.card_key}`))
    .filter(v => visibleFor(v.route));

  const enabledWidgets = widgets
    .filter(w => w.activa)
    .filter(w => visibleFor(`dashboard:widget:${w.widget_key}`));

  const wideWidgets = enabledWidgets.filter(w => w.full_width);
  const narrowWidgets = enabledWidgets.filter(w => !w.full_width);

  const esAgente = usuario.rol === 'Agente';
  const esEjecutivo = (usuario as { rol?: string }).rol === 'Ejecutivo';
  const esGerente = usuario.rol === 'Gerente';
  const esDireccion = usuario.rol === 'Administrador';

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Encabezado Personal y Contexto */}
      <WelcomeHero usuario={usuario} />

      {/* 2. Resumen Operativo Relevante por Rol */}
      {esAgente && <VendedorSections usuario={usuario} />}
      {esEjecutivo && <EjecutivoSections usuario={usuario} />}
      {esGerente && <GerenteSections usuario={usuario} />}
      {esDireccion && <DireccionSections usuario={usuario} />}

      {/* 3. Grid Principal de Módulos y Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Principal (2 columnas en desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-neutral-800 dark:text-white/90 uppercase tracking-wider text-[11px]">
                Módulos Principales
              </h2>
              <span className="text-xs text-neutral-400 dark:text-white/40">
                {enabledVcards.length} disponible{enabledVcards.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ModuleVCards modules={enabledVcards} onNavigate={navigate} />
          </div>

          {/* Widgets de ancho completo en columna izquierda */}
          {wideWidgets.length > 0 && (
            <div className="space-y-6">
              {wideWidgets.map(w => renderWidget(w.widget_key, usuario, navigate))}
            </div>
          )}
        </div>

        {/* Columna Lateral (Favoritos, Avisos, Beta, etc.) */}
        <div className="space-y-6">
          {narrowWidgets.map(w => renderWidget(w.widget_key, usuario, navigate))}
        </div>
      </div>
    </div>
  );
}
