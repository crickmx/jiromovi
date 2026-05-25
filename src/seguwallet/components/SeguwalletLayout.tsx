import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Calculator, User, LogOut, Menu, X, LayoutDashboard, Building2 } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand, SEGUWALLET_LOGO } from '../lib/AgentBrandContext';
import { seguwalletSignOut } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/seguwallet/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { path: '/seguwallet/polizas', label: 'Polizas', icon: FileText },
  { path: '/seguwallet/cotizar', label: 'Cotizar', icon: Calculator },
  { path: '/seguwallet/aseguradoras', label: 'Aseguradoras', icon: Building2 },
  { path: '/seguwallet/perfil', label: 'Perfil', icon: User },
];

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

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 60%, #f0f4ff 100%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-neutral-100/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => navigate('/seguwallet/dashboard')}
            className="flex items-center gap-2.5 flex-shrink-0 min-w-0"
          >
            {!brandLoading && (
              <img
                src={brand.displayLogo}
                alt={brand.agentName}
                className="h-9 w-auto object-contain max-w-[140px]"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== SEGUWALLET_LOGO) img.src = SEGUWALLET_LOGO;
                }}
              />
            )}
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-white shadow-sm"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                  style={isActive ? { backgroundColor: primary } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-100">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: primary }}
              >
                {getInitials()}
              </div>
              <span className="text-sm font-medium text-neutral-700 max-w-[90px] truncate leading-none">
                {customer?.full_name?.split(' ')[0]}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Cerrar sesion"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-neutral-100 bg-white px-4 py-3 space-y-1 shadow-lg">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                    isActive ? "text-white" : "text-neutral-600 hover:bg-neutral-50"
                  )}
                  style={isActive ? { backgroundColor: primary } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100/80 py-5 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <img
            src={brand.displayLogo}
            alt={brand.agentName}
            className="h-6 w-auto object-contain opacity-40 max-w-[100px]"
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
