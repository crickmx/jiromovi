import { type ReactNode, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Calculator, LogOut, Menu, X, LayoutDashboard, Building2,
  User, FolderOpen, Shield, ChevronDown, Globe, Sparkles
} from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useAgentBrand, SEGUWALLET_LOGO } from '../lib/AgentBrandContext';
import { seguwalletSignOut } from '../lib/seguwalletAuth';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { ImpersonationBanner } from '@/components/ImpersonationBanner';
import { cn } from '@/lib/utils';
import { FloatingSiniestroButton } from './FloatingSiniestroButton';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const _HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const _isSWDomain = _HOST === 'seguwallet.mx' || _HOST.endsWith('.seguwallet.mx');
const SW_PREFIX = _isSWDomain ? '' : '/seguwallet';

// Nav without Perfil — access moved to user dropdown
const NAV_ITEMS = [
  { path: `${SW_PREFIX}/dashboard`, label: 'Inicio', icon: LayoutDashboard },
  { path: `${SW_PREFIX}/polizas`, label: 'Pólizas', icon: FileText },
  { path: `${SW_PREFIX}/cotizar`, label: 'Cotizar', icon: Calculator },
  { path: `${SW_PREFIX}/aseguradoras`, label: 'Aseguradoras', icon: Building2 },
  { path: `${SW_PREFIX}/chava`, label: 'Chava IA', icon: Sparkles },
];

function getContrastColor(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.179 ? '#111827' : '#ffffff';
}

function tint(hex: string, opacity = 0.12): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function getPhotoUrl(path: string | null | undefined, fallback?: string | null): string | null {
  if (path) return `${SUPABASE_URL}/storage/v1/object/public/seguwallet-profile-photos/${path}`;
  return fallback || null;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'SW';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export function SeguwalletLayout({ children }: { children: ReactNode }) {
  const { customer } = useSeguwallet();
  const { brand, loading: brandLoading } = useAgentBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { isImpersonating: isImpersonatingActive, endImpersonation: exitImpersonationFn } = useImpersonation();

  const handleSignOut = async () => {
    if (isImpersonatingActive) {
      await exitImpersonationFn();
      navigate('/seguwallet-admin');
      return;
    }
    await seguwalletSignOut();
    navigate(`${SW_PREFIX}/login`);
  };

  const photoUrl = getPhotoUrl(customer?.profile_photo_path, customer?.profile_photo_url);
  const initials = getInitials(customer?.full_name);
  const firstName = customer?.full_name?.trim().split(/\s+/)[0] ?? '';

  const primary = brand.primaryColor;
  const contrastOnPrimary = getContrastColor(primary);
  const activeTint = tint(primary, 0.10);

  useEffect(() => {
    const name = brand.agentName && brand.agentName !== 'Tu Agente' ? brand.agentName : 'Seguwallet';
    document.title = `Seguwallet - ${name}`;
  }, [brand.agentName]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const navTo = (path: string) => {
    navigate(path);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  // ── User Avatar component ─────────────────────────────────────────────
  const UserAvatar = ({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const cls = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[11px]';
    if (photoUrl) {
      return (
        <img
          src={photoUrl}
          alt={customer?.full_name ?? 'Avatar'}
          className={cn(cls, 'rounded-xl object-cover flex-shrink-0')}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    return (
      <div
        className={cn(cls, 'rounded-xl flex items-center justify-center font-bold flex-shrink-0')}
        style={{ backgroundColor: primary, color: contrastOnPrimary }}
      >
        {initials}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Impersonation Banner ── */}
      <ImpersonationBanner />

      {/* ── Header ── */}
      <header className={cn(
        'sticky z-40 bg-white border-b border-neutral-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
        isImpersonatingActive ? 'top-10' : 'top-0'
      )}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-4">

          {/* Logo */}
          <button onClick={() => navTo(`${SW_PREFIX}/dashboard`)} className="flex items-center flex-shrink-0">
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
                  onClick={() => navTo(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150',
                    !isActive && 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                  )}
                  style={isActive ? { backgroundColor: activeTint, color: primary } : undefined}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">

            {/* ── User dropdown trigger (desktop) ── */}
            <div className="hidden sm:block relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(v => !v)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-150',
                  userMenuOpen
                    ? 'border-neutral-300 bg-neutral-100 shadow-inner'
                    : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white'
                )}
              >
                <UserAvatar size="sm" />
                <span className="text-sm font-semibold text-neutral-700 max-w-[100px] truncate leading-none">
                  {firstName}
                </span>
                <ChevronDown
                  className={cn('w-3.5 h-3.5 text-neutral-400 transition-transform duration-200', userMenuOpen && 'rotate-180')}
                />
              </button>

              {/* ── Dropdown panel ── */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-neutral-200 shadow-xl shadow-neutral-900/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">

                  {/* User header */}
                  <div className="px-5 pt-5 pb-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${primary}18 0%, ${primary}08 100%)` }}>
                    <UserAvatar size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900 truncate text-sm leading-tight">
                        {customer?.full_name || 'Usuario'}
                      </p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{customer?.email}</p>
                      <span
                        className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: primary + '20', color: primary }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: primary }} />
                        Cliente Activo
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-neutral-100" />

                  {/* Menu items */}
                  <div className="py-2 px-2">
                    {[
                      { icon: User, label: 'Mi Perfil', path: `${SW_PREFIX}/perfil`, desc: 'Editar datos personales' },
                      { icon: FolderOpen, label: 'Expediente 492', path: `${SW_PREFIX}/perfil?tab=expediente`, desc: 'Documentos y archivos' },
                      { icon: Globe, label: 'Mi Agente', path: `${SW_PREFIX}/perfil?tab=agente`, desc: 'Contactar a tu asesor' },
                      { icon: Shield, label: 'Seguridad', path: `${SW_PREFIX}/perfil?tab=seguridad`, desc: 'Acceso y contraseña' },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => navTo(item.path)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-neutral-50 transition-colors group"
                        >
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{ backgroundColor: primary + '15' }}
                          >
                            <Icon className="w-4 h-4" style={{ color: primary }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-800">{item.label}</p>
                            <p className="text-[11px] text-neutral-400">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="h-px bg-neutral-100 mx-4" />

                  <div className="py-2 px-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-red-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50">
                        <LogOut className="w-4 h-4 text-red-500" />
                      </div>
                      <p className="text-sm font-semibold text-red-500">Cerrar sesión</p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile dropdown menu ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-neutral-100 bg-white shadow-md">
            <div className="max-w-6xl mx-auto px-4 py-3">
              {/* User info card */}
              <div
                className="flex items-center gap-3 px-3 py-3 mb-2 rounded-2xl"
                style={{ background: `linear-gradient(135deg, ${primary}15 0%, ${primary}08 100%)` }}
              >
                <UserAvatar size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-neutral-900 truncate">{customer?.full_name}</p>
                  <p className="text-[11px] text-neutral-500 truncate">{customer?.email}</p>
                </div>
              </div>

              <div className="h-px bg-neutral-100 mb-2" />

              {/* Main nav */}
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <button
                    key={item.path}
                    onClick={() => navTo(item.path)}
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

              {/* Profile section */}
              {[
                { icon: User, label: 'Mi Perfil', path: `${SW_PREFIX}/perfil` },
                { icon: FolderOpen, label: 'Expediente 492', path: `${SW_PREFIX}/perfil?tab=expediente` },
                { icon: Globe, label: 'Mi Agente', path: `${SW_PREFIX}/perfil?tab=agente` },
                { icon: Shield, label: 'Seguridad', path: `${SW_PREFIX}/perfil?tab=seguridad` },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navTo(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all text-left"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-neutral-400" />
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

      {/* ── Mobile bottom tab bar (4 items only) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch safe-area-bottom">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => navTo(item.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative transition-all"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full"
                    style={{ backgroundColor: primary }}
                  />
                )}
                <Icon className="w-5 h-5" style={{ color: isActive ? primary : '#9ca3af' }} />
                <span className="text-[10px] font-semibold leading-none" style={{ color: isActive ? primary : '#9ca3af' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
          {/* Mobile profile tab */}
          <button
            onClick={() => navTo(`${SW_PREFIX}/perfil`)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 relative transition-all"
          >
            {location.pathname.startsWith(`${SW_PREFIX}/perfil`) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full" style={{ backgroundColor: primary }} />
            )}
            <div className="w-5 h-5 rounded-md overflow-hidden">
              <UserAvatar size="sm" />
            </div>
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: location.pathname.startsWith(`${SW_PREFIX}/perfil`) ? primary : '#9ca3af' }}
            >
              Perfil
            </span>
          </button>
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8">
        {children}
      </main>

      <FloatingSiniestroButton />

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
