import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileText, Calculator, User, LogOut, Menu, X, LayoutDashboard } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { seguwalletSignOut } from '../lib/seguwalletAuth';
import { cn } from '@/lib/utils';
import logoLight from '../assets/logo-light.svg';

const NAV_ITEMS = [
  { path: '/seguwallet/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { path: '/seguwallet/polizas', label: 'Polizas', icon: FileText },
  { path: '/seguwallet/cotizar', label: 'Cotizar', icon: Calculator },
  { path: '/seguwallet/perfil', label: 'Perfil', icon: User },
];

export function SeguwalletLayout({ children }: { children: ReactNode }) {
  const { customer } = useSeguwallet();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-neutral-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <button onClick={() => navigate('/seguwallet/dashboard')} className="flex items-center">
            <img src={logoLight} alt="Seguwallet" className="h-9 w-auto object-contain" />
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive ? "bg-blue-50 text-[#1C37E0]" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900")}>
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1C37E0] flex items-center justify-center text-white text-xs font-bold">
                {getInitials()}
              </div>
              <span className="text-sm font-medium text-neutral-700 max-w-[120px] truncate">
                {customer?.full_name?.split(' ')[0]}
              </span>
            </div>
            <button onClick={handleSignOut} className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Cerrar sesion">
              <LogOut className="w-4 h-4" />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-xl text-neutral-600 hover:bg-neutral-100">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-100 bg-white px-4 py-3 space-y-1">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    (location.pathname === item.path || location.pathname.startsWith(item.path + '/')) ? "bg-blue-50 text-[#1C37E0]" : "text-neutral-600 hover:bg-neutral-50")}>
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-neutral-100 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <img src={logoLight} alt="Seguwallet" className="h-5 w-auto object-contain opacity-60" />
          <p className="text-xs text-neutral-400">Tu wallet de seguros</p>
        </div>
      </footer>
    </div>
  );
}
