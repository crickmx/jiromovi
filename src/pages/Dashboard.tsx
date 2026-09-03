import { useEffect, useState, type ReactNode, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
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

function getGreetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return '☀️';
  if (h < 19) return '🌤️';
  return '🌙';
}

function formatDate(): string {
  const raw = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getRelativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Hace ${diffD} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-neutral-200 dark:bg-white/10', className)} />;
}

function SectionShell({
  title, icon: Icon, onMore, children,
}: { title: string; icon: ElementType; onMore?: () => void; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-400 dark:text-white/40" />
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white/90">{title}</h3>
        </div>
        {onMore && (
          <button
            onClick={onMore}
            className="text-[11px] font-semibold text-neutral-400 dark:text-white/40 hover:text-neutral-700 dark:hover:text-white/70 transition-colors"
          >
            Ver más →
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Datos estáticos ─────────────────────────────────────────────────────
// Las Vcards de colores (antes BETA_MODULES) ahora viven en la tabla
// dashboard_vcards (ver useDashboardConfig) — editables desde Admin >
// Editor de Dashboard. BETA_FAVORITOS se queda fijo, no forma parte de ese
// editor (son atajos, no tarjetas de módulo).

const BETA_FAVORITOS = [
  { label: 'Nuevo Trámite', emoji: '📋', route: '/tramites' },
  { label: 'Avisos', emoji: '🔔', route: '/comunicados' },
  { label: 'Fotos Estudio', emoji: '📸', route: '/mercadotecnia/fotos-estudio' },
  { label: 'Mis Metas', emoji: '🎯', route: '/produccion' },
  { label: 'Chat', emoji: '💬', route: '/centro-contacto/chat' },
  { label: 'Mi Perfil', emoji: '👤', route: '/perfil' },
] as const;

// ── WelcomeHero ─────────────────────────────────────────────────────────

function WelcomeHero({ usuario }: { usuario: Usuario }) {
  const accentColor = usuario.oficina?.accent_color || '#1e40af';
  const bgColor = accentColor; // sólido

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-5 min-h-[90px] flex items-center justify-between gap-4"
      style={{ backgroundColor: bgColor }}
    >
      {/* Decoración sutil */}
      <div
        className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}30, transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}20, transparent 70%)` }}
      />

      <div className="relative z-10 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-white/90">
          {getGreetingEmoji()} {getGreeting()}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
          {usuario.nombre} <span className="text-white">{usuario.apellidos}</span>
        </h1>
        <p className="text-xs text-white/80 mt-1 truncate">
          {formatDate()}
          {usuario.oficina?.nombre ? ` · ${usuario.oficina.nombre}` : ''}
        </p>
      </div>

      <div className="relative z-10 shrink-0">
        <span
          className="px-3 py-1.5 rounded-full text-xs font-semibold text-white/90 border border-white/30 bg-white/20 whitespace-nowrap"
        >
          {usuario.rol}
        </span>
      </div>
    </div>
  );
}

// ── ModuleVCards ────────────────────────────────────────────────────────

function ModuleVCards({
  modules, onNavigate,
}: { modules: DashboardVcard[]; onNavigate: (route: string) => void }) {
  const isOddLast = (i: number) => modules.length % 2 === 1 && i === modules.length - 1;
  return (
    <div className="grid grid-cols-2 gap-3">
      {modules.map((m, i) => (
        <div
          key={m.card_key}
          onClick={() => onNavigate(m.route)}
          className={cn(
            'rounded-2xl overflow-hidden relative cursor-pointer p-4 min-h-[100px] flex flex-col gap-2 transition hover:-translate-y-0.5',
            isOddLast(i) && 'col-span-2'
          )}
          style={{ background: `linear-gradient(145deg, ${m.gradient_from}, ${m.gradient_to})` }}
        >
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/8 pointer-events-none" />
          <div className="relative z-10 w-[30px] h-[30px] bg-white/18 rounded-lg text-sm flex items-center justify-center">
            {m.emoji}
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold text-white">{m.label}</p>
            <p className="text-[10px] text-white/80">{m.descripcion}</p>
          </div>
          <span className="absolute bottom-3 right-3 text-white/50">→</span>
        </div>
      ))}
    </div>
  );
}

// ── FavoritosGrid ───────────────────────────────────────────────────────

function FavoritosGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-white/40 mb-2">
        ★ Mis Favoritos
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {BETA_FAVORITOS.map(fav => (
          <button
            key={fav.route}
            onClick={() => onNavigate(fav.route)}
            className="bg-neutral-100 dark:bg-white/6 hover:bg-neutral-200 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/8 rounded-xl p-2 flex flex-col items-center gap-1 text-center text-[9px] font-semibold text-neutral-600 dark:text-white/60 transition-colors cursor-pointer"
          >
            <span className="text-base">{fav.emoji}</span>
            {fav.label}
          </button>
        ))}
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
      supabase.from('tickets').select('id')
        .eq('tipo_tramite', 'alta_usuario_beta')
        .eq('creado_por', usuario.id)
        .is('cerrado_en', null)
        .maybeSingle(),
    ]);
    setEstado(beta ? 'ya_beta' : pendiente ? 'pendiente' : 'sin_solicitar');
  };

  useEffect(() => { cargarEstado(); }, [usuario.id]);

  if (estado === 'ya_beta') {
    return (
      <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #E84F8A, #8E1A52)' }}>
        <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
        <p className="text-xl mb-1">🎉</p>
        <p className="text-sm font-bold text-white mb-1">Ya eres usuario Beta</p>
        <p className="text-[10px] text-white/80 leading-relaxed">
          Gracias por ayudarnos a mejorar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <div
          className="absolute -inset-0.5 rounded-2xl opacity-75 blur-sm animate-pulse pointer-events-none"
          style={{ background: 'linear-gradient(145deg, #FFD166, #E84F8A, #8E1A52)', animationDuration: '2.5s' }}
        />
        <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #E84F8A, #8E1A52)' }}>
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          <span className="absolute top-3 right-3 text-[8px] font-bold uppercase tracking-wider bg-[#FFD166] text-[#5A3300] px-1.5 py-0.5 rounded-full">
            Nuevo
          </span>
          <p className="text-xl mb-1">🚀</p>
          <p className="text-sm font-bold text-white mb-1">Únete a la Beta</p>
          <p className="text-[10px] text-white/80 mb-3 leading-relaxed">
            Ayúdanos a probar las nuevas funciones de MOVI antes de que lleguen a todos.
          </p>
          {estado === 'pendiente' ? (
            <div className="bg-white/15 border border-white/25 text-white/90 text-[10px] font-semibold py-1.5 px-3 rounded-lg text-center">
              Solicitud enviada, en revisión
            </div>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={estado === 'cargando'}
              className="w-full bg-white text-[#8E1A52] text-[10px] font-bold py-1.5 px-3 rounded-lg text-center hover:bg-white/90 hover:scale-[1.02] transition-all shadow-md disabled:opacity-50"
            >
              Solicitar acceso →
            </button>
          )}
        </div>
      </div>
      {showModal && (
        <SolicitudBetaModal
          usuario={usuario}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); cargarEstado(); }}
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
      .then(data => { if (active) setAvisos(data); })
      .catch(() => { if (active) setAvisos('error'); });
    return () => { active = false; };
  }, []);

  return (
    <SectionShell title="Avisos" icon={Bell} onMore={() => onNavigate('/comunicados')}>
      {avisos === 'loading' && (
        <>
          <Sk className="h-10 mb-2" />
          <Sk className="h-10 mb-2" />
          <Sk className="h-10" />
        </>
      )}
      {avisos === 'error' && (
        <p className="text-xs text-neutral-400 dark:text-white/40 py-4 text-center">Error al cargar avisos</p>
      )}
      {Array.isArray(avisos) && avisos.length === 0 && (
        <p className="text-xs text-neutral-400 dark:text-white/40 py-4 text-center">Sin avisos recientes</p>
      )}
      {Array.isArray(avisos) && avisos.map((aviso, i) => (
        <div key={aviso.id} className="flex gap-2 items-start py-2 border-b last:border-0 border-neutral-100 dark:border-white/6">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: AVISO_DOT_COLORS[i % 3] }} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-neutral-800 dark:text-white/85 truncate">{aviso.titulo}</p>
            <p className="text-[10px] text-neutral-400 dark:text-white/35">
              {aviso.fecha_publicacion ? getRelativeTime(aviso.fecha_publicacion) : ''}
            </p>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────

function renderWidget(key: string, usuario: Usuario, navigate: (route: string) => void): ReactNode {
  switch (key) {
    case 'favoritos': return <FavoritosGrid key={key} onNavigate={navigate} />;
    case 'beta': return <JoinBetaCard key={key} usuario={usuario} />;
    case 'produccion_bonos': return <ProduccionResumenCard key={key} />;
    case 'campanias': return <CampaniasActivasCard key={key} />;
    case 'convencion': return <ConvencionCard key={key} />;
    case 'avisos': return <AvisosPanel key={key} onNavigate={navigate} />;
    default: return null;
  }
}

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard · MOVI Digital'; }, []);

  const { usuario } = useMoviAuth();
  const navigate = useNavigate();
  const { isVisible } = useModuleVisibility();
  const { vcards, widgets } = useDashboardConfig();

  // MoviPrivateRoute already handles unauthenticated redirect
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

  const esAgente      = usuario.rol === 'Agente';
  const esEjecutivo   = usuario.rol === 'Ejecutivo';
  const esGerente     = usuario.rol === 'Gerente';
  const esDireccion   = usuario.rol === 'Administrador';

  return (
    <div className="space-y-6 pb-8">
      <WelcomeHero usuario={usuario} />

      {esAgente     && <VendedorSections   usuario={usuario} />}
      {esEjecutivo  && <EjecutivoSections  usuario={usuario} />}
      {esGerente    && <GerenteSections    usuario={usuario} />}
      {esDireccion  && <DireccionSections  usuario={usuario} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ModuleVCards modules={enabledVcards} onNavigate={navigate} />
          {wideWidgets.map(w => renderWidget(w.widget_key, usuario, navigate))}
        </div>

        <div className="space-y-8">
          {narrowWidgets.map(w => renderWidget(w.widget_key, usuario, navigate))}
        </div>
      </div>
    </div>
  );
}
