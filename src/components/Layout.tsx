import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, ChevronRight } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { FloatingAssistantButton } from './FloatingAssistantButton';
import { AssistantModal } from './AssistantModal';
import InstallAppButton from './InstallAppButton';
import InstallBanner from './InstallBanner';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { PrimarySidebar } from './layout/PrimarySidebar';
import { SecondarySidebar } from './layout/SecondarySidebar';
import { Breadcrumbs } from './layout/Breadcrumbs';
import { WORKSPACES, resolveWorkspace, isWorkspaceVisible, isItemVisible, buildBreadcrumbs } from '@/lib/workspaceConfig';
import type { UserRole } from '@/lib/workspaceConfig';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

const SIDEBAR_STORAGE_KEY = 'movi-sidebar-collapsed';

export function Layout({ children, hideHeader = false }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(secondaryCollapsed));
    }
  }, [secondaryCollapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const userRole: UserRole = (usuario?.rol as UserRole) || 'Agente';
  const isAdmin = usuario?.rol === 'Administrador';

  const { workspace, activeItem } = resolveWorkspace(location.pathname, userRole);
  const breadcrumbs = buildBreadcrumbs(workspace, activeItem);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Desktop: Primary Sidebar (icon rail) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40">
        <PrimarySidebar
          activeWorkspaceId={workspace?.id || null}
          userRole={userRole}
          usuario={usuario}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Desktop: Secondary Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 z-30 transition-all duration-200 ease-out",
          "left-[68px]"
        )}
      >
        {workspace && (
          <SecondarySidebar
            workspace={workspace}
            activeItem={activeItem}
            userRole={userRole}
            collapsed={secondaryCollapsed}
            onToggleCollapse={() => setSecondaryCollapsed(!secondaryCollapsed)}
          />
        )}
      </aside>

      {/* Desktop: Expand button when secondary is collapsed */}
      {secondaryCollapsed && workspace && workspace.id !== 'dashboard' && (
        <button
          onClick={() => setSecondaryCollapsed(false)}
          className="hidden lg:flex fixed top-[72px] z-30 items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
          style={{ left: 63 }}
        >
          <ChevronRight className="w-3 h-3 text-neutral-500" />
        </button>
      )}

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] bg-white dark:bg-neutral-900 shadow-2xl flex flex-col">
            {/* Mobile header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-neutral-100 dark:border-white/8">
              <img src="/movirecurso_7.png" alt="MOVI" className="h-7 object-contain" />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile workspace selector */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-neutral-100 dark:border-white/8 overflow-x-auto">
              {WORKSPACES.filter(ws => isWorkspaceVisible(ws, userRole)).map((ws) => {
                const Icon = ws.icon;
                const isActive = ws.id === workspace?.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => navigate(ws.items[0]?.path || '/dashboard')}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                      isActive
                        ? "bg-accent/10 text-accent-foreground"
                        : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {ws.label}
                  </button>
                );
              })}
            </div>

            {/* Mobile workspace items */}
            <ScrollArea className="flex-1">
              {workspace && (
                <nav className="px-3 py-2 space-y-0.5">
                  {workspace.items.filter(item => isItemVisible(item, userRole)).map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                      (item.matchPrefix && !item.excludePrefixes?.some(ex => location.pathname.startsWith(ex)) && location.pathname.startsWith(item.path));

                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setMobileOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                          isActive
                            ? "bg-accent/10 text-accent-foreground"
                            : "text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/8"
                        )}
                      >
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              )}
            </ScrollArea>

            {/* Mobile footer */}
            <div className="border-t border-neutral-100 dark:border-white/8 p-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <span>Cerrar Sesion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        className={cn(
          "min-h-screen transition-all duration-200 ease-out",
          secondaryCollapsed ? "lg:ml-[68px]" : "lg:ml-[268px]"
        )}
      >

          {!hideHeader && (
            <>
              {/* Mobile header */}
              <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-200/60 dark:border-white/8">
                <div className="flex items-center justify-between h-14 px-4">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2 -ml-2 text-neutral-600 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors active:scale-95"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <img src="/movirecurso_7.png" alt="MOVI" className="h-7 object-contain" />
                  <div className="flex items-center gap-1">
                    <InstallAppButton variant="ghost" size="sm" showText={false} />
                    <ThemeToggle />
                    <NotificationBell />
                  </div>
                </div>
              </header>

              {/* Desktop header */}
              <header className="hidden lg:flex sticky top-0 z-20 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/60 dark:border-white/5">
                <div className="w-full px-6 lg:px-8 flex items-center justify-between h-12">
                  <Breadcrumbs items={breadcrumbs} />
                  <div className="flex items-center gap-2">
                    <InstallAppButton variant="outline" size="sm" />
                    <ThemeToggle />
                    <NotificationBell />
                  </div>
                </div>
              </header>
            </>
          )}

          <main className={cn(
            ['/multicotizador-digital', '/centro-contacto'].includes(location.pathname)
              ? 'h-screen overflow-hidden'
              : 'w-full py-5 lg:py-6',
            ['/espacio-jiro'].includes(location.pathname)
              ? 'px-4 sm:px-6 lg:px-8'
              : ['/multicotizador-digital', '/centro-contacto'].includes(location.pathname)
              ? ''
              : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'
          )}>
            {children}
          </main>

          {isAdmin && <FloatingAssistantButton />}
          {isAdmin && <AssistantModal />}
          <InstallBanner />
      </div>
    </div>
  );
}
