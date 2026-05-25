import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Video, Calendar, BarChart3, BookOpen, Home, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const BRAND_LOGO = 'https://movi.digital/wp-content/uploads/elementor/thumbs/moviRecurso-10-rgqg5n2oyvobfmstl7md0o8mr5w7vjv6rsxrkauuio.png';

export const NAV_ITEMS = [
  { label: 'Inicio', path: '/seguros-education', icon: Home, exact: true },
  { label: 'Cédula A', path: '/seguros-education/cedula-a', icon: GraduationCap },
  { label: 'On Demand', path: '/seguros-education/on-demand', icon: Video },
  { label: 'Aula Virtual', path: '/seguros-education/aula-virtual', icon: Calendar },
  { label: 'Manuales', path: '/seguros-education/manuales', icon: BookOpen },
  { label: 'Analytics', path: '/seguros-education/analytics', icon: BarChart3, adminOnly: true },
];

function getActiveLabel(pathname: string, items: typeof NAV_ITEMS) {
  for (const item of [...items].reverse()) {
    if (item.exact ? pathname === item.path : pathname.startsWith(item.path)) {
      return item.label;
    }
  }
  return 'Inicio';
}

interface Props {
  children: ReactNode;
  sectionTitle?: string;
  sectionDescription?: string;
}

export function SegurosEducationLayout({ children, sectionTitle, sectionDescription }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const isAdmin = ['admin', 'administrador'].includes(usuario?.rol?.toLowerCase() || '');
  const isGerente = usuario?.rol?.toLowerCase() === 'gerente';
  const hasAdminAccess = isAdmin || isGerente;

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const visibleItems = NAV_ITEMS.filter(i => !i.adminOnly || hasAdminAccess);
  const activeLabel = getActiveLabel(location.pathname, visibleItems);

  return (
    <div className="flex flex-col gap-0 -mt-1">
      {/* ── Branded sub-header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl mb-0 bg-gradient-to-br from-[#071428] via-[#0c1e3e] to-[#142f5e] shadow-xl">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/4 w-56 h-40 rounded-full bg-cyan-400/6 blur-3xl pointer-events-none" />

        <div className="relative px-5 pt-5 pb-0">
          {/* Top row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO}
                alt="Seguros Education"
                className="h-7 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-px h-4 bg-white/15" />
                <span className="text-white/35 text-[10px] font-semibold tracking-[0.18em] uppercase select-none">
                  Plataforma de Capacitación
                </span>
              </div>
            </div>
            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/35 font-medium">
              <span>MOVI</span>
              <ChevronRight className="w-3 h-3" />
              <span>Seguros Education</span>
              {activeLabel !== 'Inicio' && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-white/70">{activeLabel}</span>
                </>
              )}
            </div>
          </div>

          {/* Section info (optional override) */}
          {sectionTitle && (
            <div className="mb-4">
              <h1 className="text-white text-lg font-bold leading-tight">{sectionTitle}</h1>
              {sectionDescription && (
                <p className="text-white/40 text-xs mt-0.5">{sectionDescription}</p>
              )}
            </div>
          )}

          {/* Tab nav — flush bottom */}
          <nav className="flex items-end gap-0 overflow-x-auto scrollbar-none -mx-1 px-1">
            {visibleItems.map(item => {
              const active = isActive(item);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  className={cn(
                    'relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold rounded-t-xl transition-all duration-150 whitespace-nowrap flex-shrink-0 focus:outline-none group',
                    active
                      ? 'bg-white/[0.97] dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-white/50 hover:text-white/90 hover:bg-white/[0.07]'
                  )}
                >
                  <item.icon
                    className={cn(
                      'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                      active ? 'text-[#1C37E0]' : 'text-white/40 group-hover:text-white/70'
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C37E0] rounded-t" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────── */}
      <div className="bg-white/50 dark:bg-neutral-900/30 rounded-b-2xl border border-t-0 border-neutral-200/50 dark:border-white/[0.06] p-5">
        {children}
      </div>
    </div>
  );
}
