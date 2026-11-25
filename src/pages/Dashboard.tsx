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
  Rocket,
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
import { PanelDelDia } from '../components/dashboard/PanelDelDia';
import { ConvencionCard } from '../components/dashboard/ConvencionCard';
import { VendedorSections } from '../components/dashboard/VendedorSections';
import { GerenteSections } from '../components/dashboard/GerenteSections';
import { DireccionSections } from '../components/dashboard/DireccionSections';
import { EjecutivoSections } from '../components/dashboard/EjecutivoSections';
import { isBetaHost } from '../lib/betaAccess';
import { ZocaloCard } from '../components/ui/zocalo-card';

// ── Tarjetas que sólo viven en beta ─────────────────────────────────────
// La base es la misma para beta y producción, así que estas tarjetas no son
// filas de dashboard_vcards (producción las vería): van en código y se filtran
// por entorno con isBetaHost(). Para publicarlas, muévelas a la tabla.
const VCARDS_SOLO_BETA: DashboardVcard[] = [
  {
    id: 'solo-beta-saludtoday',
    card_key: 'saludtoday',
    label: 'salud.today',
    descripcion: 'Telemedicina 24/7, asistencias y beneficios',
    route: '/saludtoday',
    emoji: '🩺',
    gradient_from: '#0f3d38',
    gradient_to: '#10b981',
    orden: 4,
    activa: true,
    icon_key: 'HeartHandshake',
  },
];

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
    <div className="bg-surface-card border border-soft p-5 sm:p-6">
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
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:text-accent/80 dark:text-accent-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
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
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-ink">
        {getGreeting()}
      </p>
      <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-900 dark:text-white sm:text-[34px]">
        {usuario.nombre} <span className="font-normal text-neutral-500 dark:text-neutral-400">{usuario.apellidos}</span>
      </h1>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium text-neutral-500 dark:text-neutral-400">
        <span>{formatDate()}</span>
        {usuario.oficina?.nombre && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <span>{usuario.oficina.nombre}</span>
          </>
        )}
      </p>
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
        <p className="text-xs text-neutral-500 dark:text-white/55 mt-1">
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
          <ZocaloCard
            key={m.card_key}
            title={m.label}
            description={m.descripcion ?? ''}
            icon={Icon}
            iconColor="text-accent-ink"
            cta="Abrir"
            className={singleSpan ? 'sm:col-span-2' : undefined}
            onClick={() => onNavigate(m.route)}
          />
        );
      })}
    </div>
  );
}

// ── FavoritosGrid ───────────────────────────────────────────────────────

function FavoritosGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="bg-surface-card border border-soft p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-neutral-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white tracking-tight leading-none">
              Mis Favoritos
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-white/55 mt-0.5">Accesos rápidos y herramientas</p>
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
              className="group p-3 rounded-none border border-soft hover:border-neutral-900 dark:hover:border-white hover:bg-surface-muted dark:hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
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
      <div className="border border-soft bg-surface-card p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
          <span className="border border-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-neutral-600 dark:text-neutral-300">
            Usuario activo
          </span>
        </div>
        <p className="font-display text-[17px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white mb-1.5">Ya eres usuario Beta</p>
        <p className="text-[13.5px] leading-[1.6] text-neutral-500 dark:text-neutral-400">
          Cuentas con acceso a todas las nuevas herramientas en desarrollo. Gracias por ayudarnos a mejorar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-soft bg-surface-card p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <Rocket className="w-5 h-5 text-accent-ink" strokeWidth={1.5} />
            <span className="border border-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-neutral-600 dark:text-neutral-300">
              Novedad
            </span>
          </div>

          <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white mb-1.5">Únete al Programa Beta</h3>
          <p className="text-[13.5px] leading-[1.6] text-neutral-500 dark:text-neutral-400 mb-5">
            Prueba las nuevas funciones de MOVI antes que nadie y comparte tu retroalimentación directa.
          </p>
        </div>

        {estado === 'pendiente' ? (
          <div className="border border-soft text-[13px] font-semibold py-2.5 px-3 text-center text-neutral-600 dark:text-neutral-300">
            Solicitud enviada, en revisión
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={estado === 'cargando'}
            className="w-full bg-accent text-accent-foreground font-display text-[13px] font-semibold py-3 px-4 text-center transition-colors hover:bg-accent-hover disabled:opacity-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Solicitar acceso Beta
          </button>
        )}
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
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
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
        <div className="py-6 text-center text-neutral-500 dark:text-white/55">
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
                <p className="text-[11px] text-neutral-500 dark:text-white/55 mt-0.5">
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
    document.title = 'Dashboard · MOVI Mi Oficina Virtual';
  }, []);

  const { usuario } = useMoviAuth();
  const navigate = useNavigate();
  const { isVisible } = useModuleVisibility();
  const { vcards, widgets } = useDashboardConfig();

  if (!usuario) return null;

  const visibleFor = (moduleKey: string) =>
    isVisible(moduleKey, usuario.rol, usuario.oficina_id, usuario.id);

  const vcardsEntorno = isBetaHost()
    ? [...vcards, ...VCARDS_SOLO_BETA].sort((a, b) => a.orden - b.orden)
    : vcards;

  const enabledVcards = vcardsEntorno
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
    <div className="space-y-6">
      {/* 1. Encabezado Personal y Contexto */}
      <WelcomeHero usuario={usuario} />

      {/* 2. Lo del día: atención, mensajes, novedades y producción */}
      <PanelDelDia usuario={usuario} />

      {/* 3. Resumen Operativo Relevante por Rol */}
      {esAgente && <VendedorSections usuario={usuario} />}
      {esEjecutivo && <EjecutivoSections usuario={usuario} />}
      {esGerente && <GerenteSections usuario={usuario} />}
      {esDireccion && <DireccionSections usuario={usuario} />}

      {/* 4. Grid Principal de Módulos y Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Columna Principal (2 columnas en desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-neutral-800 dark:text-white/90 uppercase tracking-wider text-[11px]">
                Módulos Principales
              </h2>
              <span className="text-xs text-neutral-500 dark:text-white/55">
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
