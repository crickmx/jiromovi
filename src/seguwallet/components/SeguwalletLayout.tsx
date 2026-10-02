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
import { computeThemeVars } from '@/lib/themeUtils';
import { FloatingSiniestroButton } from './FloatingSiniestroButton';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const _HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const _isSWDomain = _HOST === 'seguwallet.mx' || _HOST.endsWith('.seguwallet.mx');
const SW_PREFIX = _isSWDomain ? '' : '/seguwallet';

// Accesos de cuenta (dropdown en tablet, barra lateral en escritorio, menú en móvil)
const ACCOUNT_ITEMS = [
  { icon: User, label: 'Mi Perfil', path: `${SW_PREFIX}/perfil`, desc: 'Editar datos personales' },
  { icon: FolderOpen, label: 'Expediente 492', path: `${SW_PREFIX}/perfil?tab=expediente`, desc: 'Documentos y archivos' },
  { icon: Globe, label: 'Mi Agente', path: `${SW_PREFIX}/perfil?tab=agente`, desc: 'Contactar a tu asesor' },
  { icon: Shield, label: 'Seguridad', path: `${SW_PREFIX}/perfil?tab=seguridad`, desc: 'Acceso y contraseña' },
];

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

interface UserAvatarProps {
  photoUrl: string | null;
  name: string | null | undefined;
  primary: string;
  contrastOnPrimary: string;
  size?: 'sm' | 'md' | 'lg';
}

function UserAvatar({
  photoUrl,
  name,
  primary,
  contrastOnPrimary,
  size = 'sm',
}: UserAvatarProps) {
  const initials = getInitials(name);
  const cls = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-[11px]';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? 'Avatar'}
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
  const firstName = customer?.full_name?.trim().split(/\s+/)[0] ?? '';

  const primary = brand.primaryColor;
  const contrastOnPrimary = getContrastColor(primary);
  const activeTint = tint(primary, 0.10);

  useEffect(() => {
    const name = brand.agentName && brand.agentName !== 'Tu Agente' ? brand.agentName : 'Seguwallet';
    document.title = `Seguwallet - ${name}`;
  }, [brand.agentName]);

  // El color del AGENTE manda dentro del portal: se aplican las mismas variables de
  // tema (acento, contraste AA, tintes, gradiente) que usa MOVI por oficina, y se
  // restauran los valores previos al salir del portal.
  useEffect(() => {
    if (brandLoading) return;
    const root = document.documentElement;
    const vars = computeThemeVars(primary);
    const previous: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      previous[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    }
    return () => {
      for (const [k, v] of Object.entries(previous)) {
        if (v) root.style.setProperty(k, v); else root.style.removeProperty(k);
      }
    };
  }, [primary, brandLoading]);

  const secondary = brand.secondaryColor;
  const isNavActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

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

  return (
    <div className="min-h-screen bg-surface-canvas lg:flex">

      {/* ── Impersonation Banner ── */}
      <ImpersonationBanner />

      {/* ── Barra lateral (escritorio ≥ lg) — misma lógica que la barra del sistema ── */}
      <aside
        aria-label="Navegación del portal"
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 w-[264px] sticky z-30 border-r border-soft bg-surface-card/95 backdrop-blur-sm',
          isImpersonatingActive ? 'top-10 h-[calc(100dvh-2.5rem)]' : 'top-0 h-[100dvh]'
        )}
      >
        {/* Logo del agente (o Seguwallet) */}
        <div className="px-5 pt-6 pb-4">
          <button onClick={() => navTo(`${SW_PREFIX}/dashboard`)} aria-label="Ir al inicio" className="flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45">
            {!brandLoading && (
              <img
                src={brand.displayLogo}
                alt={brand.agentName}
                className="h-10 w-auto object-contain max-w-[180px]"
                onError={e => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== SEGUWALLET_LOGO) img.src = SEGUWALLET_LOGO;
                }}
              />
            )}
          </button>
        </div>

        {/* Tarjeta del cliente — gradiente primario → secundario del agente */}
        <div className="px-4">
          <div
            className="relative isolate overflow-hidden rounded-[22px] p-4 shadow-e3"
            style={{ background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, color: contrastOnPrimary }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 w-36 h-36 -z-10 rounded-[58%_42%_46%_54%/47%_52%_48%_53%] bg-white/15" />
            <span aria-hidden="true" className="pointer-events-none absolute right-8 -bottom-16 w-28 h-28 -z-10 rounded-[50%_50%_38%_62%/60%_44%_56%_40%] bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="ring-2 ring-white/40 rounded-xl">
                <UserAvatar photoUrl={photoUrl} name={customer?.full_name} primary={secondary} contrastOnPrimary={getContrastColor(secondary)} size="md" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-semibold text-sm leading-tight truncate">{customer?.full_name || 'Usuario'}</p>
                <p className="text-[11.5px] opacity-80 truncate mt-0.5">{customer?.email}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-white/20">
              <span className="w-1.5 h-1.5 rounded-full inline-block bg-current" />
              Cliente Activo
            </span>
          </div>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 overflow-y-auto px-3 pt-5 pb-3">
          <p className="movi-eyebrow text-neutral-500 px-3 mb-2">Mi wallet</p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = isNavActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navTo(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-display text-[13.5px] transition-colors duration-fast text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
                    active
                      ? 'bg-accent-soft text-accent-ink font-semibold'
                      : 'font-medium text-neutral-700 hover:bg-surface-muted hover:text-neutral-900'
                  )}
                >
                  {active && <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-accent" />}
                  <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-accent-ink' : 'text-neutral-500')} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <p className="movi-eyebrow text-neutral-500 px-3 mt-6 mb-2">Mi cuenta</p>
          <div className="space-y-0.5">
            {ACCOUNT_ITEMS.map(item => {
              const Icon = item.icon;
              const active = location.pathname + location.search === item.path
                || (item.path === `${SW_PREFIX}/perfil` && location.pathname === item.path && !location.search);
              return (
                <button
                  key={item.path}
                  onClick={() => navTo(item.path)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-colors duration-fast text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
                    active ? 'bg-accent-soft text-accent-ink font-semibold' : 'font-medium text-neutral-700 hover:bg-surface-muted hover:text-neutral-900'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-accent-ink' : 'text-neutral-500')} />
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    <span className="block text-[11px] font-normal text-neutral-500 truncate">{item.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="px-3 py-3 border-t border-soft">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold text-red-600 hover:bg-red-50 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className={cn('flex-1 min-w-0 flex flex-col min-h-screen', isImpersonatingActive && 'lg:pt-10')}>

      {/* ── Header (móvil y tableta; en escritorio lo sustituye la barra lateral) ── */}
      <header className={cn(
        'lg:hidden sticky z-40 bg-white/90 backdrop-blur-xl border-b border-soft shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
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
                <UserAvatar
                  photoUrl={photoUrl}
                  name={customer?.full_name}
                  primary={primary}
                  contrastOnPrimary={contrastOnPrimary}
                  size="sm"
                />
                <span className="text-sm font-semibold text-neutral-700 max-w-[100px] truncate leading-none">
                  {firstName}
                </span>
                <ChevronDown
                  className={cn('w-3.5 h-3.5 text-neutral-500 transition-transform duration-200', userMenuOpen && 'rotate-180')}
                />
              </button>

              {/* ── Dropdown panel ── */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface-card rounded-2xl border border-soft shadow-xl shadow-neutral-900/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">

                  {/* User header */}
                  <div className="px-5 pt-5 pb-4 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${primary}18 0%, ${primary}08 100%)` }}>
                    <UserAvatar
                      photoUrl={photoUrl}
                      name={customer?.full_name}
                      primary={primary}
                      contrastOnPrimary={contrastOnPrimary}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900 truncate text-sm leading-tight">
                        {customer?.full_name || 'Usuario'}
                      </p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{customer?.email}</p>
                      <span
                        className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
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
                    {ACCOUNT_ITEMS.map(item => {
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
                            <p className="text-[11px] text-neutral-500">{item.desc}</p>
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
                <UserAvatar
                  photoUrl={photoUrl}
                  name={customer?.full_name}
                  primary={primary}
                  contrastOnPrimary={contrastOnPrimary}
                  size="md"
                />
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
              {ACCOUNT_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navTo(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-all text-left"
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-neutral-500" />
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
      <nav aria-label="Navegación del portal" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-soft shadow-[0_-8px_24px_-16px_rgba(28,25,23,0.25)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-stretch safe-area-bottom">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <button
                key={item.path}
                onClick={() => navTo(item.path)}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-h-[54px] relative transition-all active:scale-95"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full"
                    style={{ backgroundColor: primary }}
                  />
                )}
                <Icon className={cn('w-5 h-5', isActive ? 'text-accent-ink' : 'text-neutral-500')} />
                <span className={cn('font-display text-[10.5px] font-semibold leading-none', isActive ? 'text-accent-ink' : 'text-neutral-500')}>
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
              <UserAvatar
                photoUrl={photoUrl}
                name={customer?.full_name}
                primary={primary}
                contrastOnPrimary={contrastOnPrimary}
                size="sm"
              />
            </div>
            <span
              className={cn('font-display text-[10.5px] font-semibold leading-none', location.pathname.startsWith(`${SW_PREFIX}/perfil`) ? 'text-accent-ink' : 'text-neutral-500')}
            >
              Perfil
            </span>
          </button>
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="relative flex-1 w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-28 lg:pb-10">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="hidden lg:block border-t border-soft py-4 mt-2">
        <div className="max-w-6xl xl:max-w-7xl mx-auto px-10 flex items-center justify-between gap-4">
          <img
            src={brand.displayLogo}
            alt={brand.agentName}
            className="h-5 w-auto object-contain opacity-25 max-w-[80px]"
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (img.src !== SEGUWALLET_LOGO) img.src = SEGUWALLET_LOGO;
            }}
          />
          <p className="text-xs text-neutral-500">
            {brand.agentName !== 'Tu Agente' ? brand.agentName : 'Seguwallet'} · Tu wallet de seguros
          </p>
        </div>
      </footer>
      </div>

      <FloatingSiniestroButton />
    </div>
  );
}
