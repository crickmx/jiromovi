import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Calculator, User, LogOut, Menu, X, LayoutDashboard, Building2 } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand, SEGUWALLET_LOGO } from '../lib/AgentBrandContext';
import { seguwalletSignOut } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/seguwallet/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { path: '/seguwallet/polizas', label: 'Pólizas', icon: FileText },
  { path: '/seguwallet/cotizar', label: 'Cotizar', icon: Calculator },
  { path: '/seguwallet/aseguradoras', label: 'Aseguradoras', icon: Building2 },
  { path: '/seguwallet/perfil', label: 'Perfil', icon: User },
];

/** Returns white or near-black text color based on background luminance */
function getContrastColor(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? '#1a1a1a' : '#ffffff';
}

/** Creates a very light tint of the hex color for active backgrounds */
function tint(hex: string, opacity = 0.12): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function SeguwalletLayout({ children }: { children: ReactNode }) {
  const { customer } = useSeguwallet();
  const { brand, loading: brandLoading } = useAgentBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await seguwalletSignOut();
    navigate('/seguwallet/login');
  };

  const getInitials = () => {
    if (!customer?.full_name) return 'SW';
    const parts = customer.full_name.split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  };

  const primary = brand.primaryColor;
  const contrastOnPrimary = getContrastColor(primary);
  const activeTint = tint(primary, 0.10);

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Desktop + tablet header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-4">

          {/* Logo */}
          <button
            onClick={() => navigate('/seguwallet/dashboard')}
            className="flex items-center flex-shrink-0"
          >
            {!brandLoading && (
              <img
                src={brand.displayLogo}
                alt={brand.agentName}
                className="h-8 w-auto object-contain max-w-[130px]"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== SEGUWALLET_LOGO) img.src = SEGUWALLET_LOGO;
                }}
              />
            )}
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150',
                    !isActive && 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                  )}
                  style={isActive
                    ? { backgroundColor: activeTint, color: primary }
                    : undefined}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* User pill */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: primary, color: contrastOnPrimary }}
              >
                {getInitials()}
              </div>
              <span className="text-sm font-medium text-neutral-700 max-w-[80px] truncate leading-none">
                {customer?.full_name?.split(' ')[0]}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-neutral-100 bg-white shadow-md">
            <div className="max-w-6xl mx-auto px-4 py-3">
              {/* User info */}
              <div className="flex items-center gap-3 px-2 py-2.5 mb-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: primary, color: contrastOnPrimary }}
                >
                  {getInitials()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{customer?.full_name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{customer?.email}</p>
                </div>
              </div>

              <div className="h-px bg-neutral-100 mb-2" />

              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all text-left',
                      !isActive && 'text-neutral-600 hover:bg-neutral-50'
                    )}
                    style={isActive ? { backgroundColor: activeTint, color: primary } : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </button>
                );
              })}

              <div className="h-px bg-neutral-100 my-2" />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all text-left"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch safe-area-bottom">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative transition-all"
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full transition-all"
                    style={{ backgroundColor: primary }}
                  />
                )}
                <Icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: isActive ? primary : '#9ca3af' }}
                />
                <span
                  className="text-[10px] font-semibold transition-colors leading-none"
                  style={{ color: isActive ? primary : '#9ca3af' }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="hidden lg:block border-t border-neutral-100 py-4 mt-2">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <img
            src={brand.displayLogo}
            alt={brand.agentName}
            className="h-5 w-auto object-contain opacity-25 max-w-[80px]"
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.src !== SEGUWALLET_LOGO) img.src = SEGUWALLET_LOGO;
            }}
          />
          <p className="text-xs text-neutral-400">
            {brand.agentName !== 'Tu Agente' ? brand.agentName : 'Seguwallet'} · Tu wallet de seguros
          </p>
        </div>
      </footer>
    </div>
  );
}
