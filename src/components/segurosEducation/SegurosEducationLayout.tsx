import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Video, Calendar, BarChart3, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const BRAND_LOGO = 'https://movi.digital/wp-content/uploads/elementor/thumbs/moviRecurso-10-rgqg5n2oyvobfmstl7md0o8mr5w7vjv6rsxrkauuio.png';

const NAV_ITEMS = [
  { label: 'Inicio', path: '/seguros-education', icon: GraduationCap, exact: true },
  { label: 'Cedula A', path: '/seguros-education/cedula-a', icon: BookOpen },
  { label: 'On Demand', path: '/seguros-education/on-demand', icon: Video },
  { label: 'Aula Digital', path: '/seguros-education/aula-virtual', icon: Calendar },
  { label: 'Analytics', path: '/seguros-education/analytics', icon: BarChart3, adminOnly: true },
];

interface Props {
  children: ReactNode;
}

export function SegurosEducationLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const isAdmin = ['admin', 'administrador'].includes(usuario?.rol?.toLowerCase() || '');

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const visibleItems = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin);

  return (
    <div className="space-y-0 -mt-1">
      {/* Branded sub-header */}
      <div className="relative overflow-hidden rounded-2xl mb-5 bg-gradient-to-br from-[#0a1628] via-[#0e2040] to-[#1a3a6e] shadow-lg">
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Glow accents */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-cyan-400/8 blur-2xl pointer-events-none" />

        <div className="relative px-5 pt-4 pb-0">
          {/* Top row: logo + tagline */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO}
                alt="Seguros Education"
                className="h-8 w-auto object-contain drop-shadow-sm"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <div className="w-px h-5 bg-white/15 hidden sm:block" />
              <span className="text-white/40 text-[11px] font-medium tracking-widest uppercase hidden sm:block select-none">
                Plataforma de Capacitacion
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-semibold tracking-wide uppercase">En vivo</span>
            </div>
          </div>

          {/* Nav tabs — sit flush at the bottom of the banner */}
          <nav className="flex items-end gap-0.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            {visibleItems.map(item => {
              const active = isActive(item);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all duration-200 whitespace-nowrap flex-shrink-0 border-b-2 focus:outline-none',
                    active
                      ? 'bg-white text-neutral-900 border-transparent shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/8 border-transparent'
                  )}
                >
                  <item.icon className={cn('w-3.5 h-3.5 flex-shrink-0', active ? 'text-blue-600' : '')} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
