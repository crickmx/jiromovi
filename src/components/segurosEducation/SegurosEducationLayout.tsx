import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Video, Calendar, BarChart3, BookOpen, Home } from 'lucide-react';
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

  return (
    <div className="flex flex-col gap-0">
      {/* ── Clean light header ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.07] rounded-2xl shadow-sm overflow-hidden">
        {/* Top bar with logo + section info */}
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO}
                alt="Seguros Education"
                className="h-6 w-auto object-contain opacity-90 dark:brightness-0 dark:invert"
              />
              <div className="w-px h-4 bg-neutral-200 dark:bg-white/10" />
              <span className="text-neutral-400 dark:text-white/30 text-[10px] font-semibold tracking-[0.16em] uppercase select-none">
                Plataforma de Capacitación
              </span>
            </div>
          </div>

          {sectionTitle && (
            <div className="mb-3">
              <h1 className="text-neutral-900 dark:text-white text-lg font-bold leading-tight">{sectionTitle}</h1>
              {sectionDescription && (
                <p className="text-neutral-400 dark:text-white/40 text-xs mt-0.5">{sectionDescription}</p>
              )}
            </div>
          )}

          {/* Tab nav */}
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
                      ? 'text-[#1C37E0] dark:text-blue-400 bg-[#1C37E0]/5 dark:bg-blue-400/10'
                      : 'text-neutral-500 dark:text-white/40 hover:text-neutral-800 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/[0.05]'
                  )}
                >
                  <item.icon
                    className={cn(
                      'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                      active ? 'text-[#1C37E0] dark:text-blue-400' : 'text-neutral-400 dark:text-white/30 group-hover:text-neutral-600 dark:group-hover:text-white/60'
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1C37E0] dark:bg-blue-400 rounded-t" />
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
