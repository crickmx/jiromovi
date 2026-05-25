import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, ChevronDown, LogOut } from 'lucide-react';
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
import { WORKSPACES, NAV_ORDER, TOP_LEVEL_ITEMS, resolveWorkspace, isWorkspaceVisible, isItemVisible, isTopLevelItemVisible, buildBreadcrumbs } from '@/lib/workspaceConfig';
import type { WorkspaceId, UserRole } from '@/lib/workspaceConfig';

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
  const [mobileExpandedWorkspace, setMobileExpandedWorkspace] = useState<WorkspaceId | null>(null);
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

  const userRole: UserRole = (usuario?.rol as UserRole) || 'Agente';
  const isAdmin = usuario?.rol === 'Administrador';

  const { workspace, activeItem } = resolveWorkspace(location.pathname, userRole);
  const breadcrumbs = buildBreadcrumbs(workspace, activeItem);

  useEffect(() => {
    if (mobileOpen && workspace) {
      setMobileExpandedWorkspace(workspace.id);
    }
  }, [mobileOpen]);

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

  const hasSecondary = workspace !== null;

  const getMainMargin = () => {
    if (!hasSecondary) return "lg:ml-[72px]";
    return secondaryCollapsed ? "lg:ml-[124px]" : "lg:ml-[280px]";
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] dark:bg-[#09090b]">
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
      {hasSecondary && (
        <aside
          className={cn(
            "hidden lg:flex fixed inset-y-0 z-30 transition-all duration-300 ease-smooth",
            "left-[72px]"
          )}
        >
          <SecondarySidebar
            workspace={workspace}
            activeItem={activeItem}
            userRole={userRole}
            collapsed={secondaryCollapsed}
            onToggleCollapse={() => setSecondaryCollapsed(!secondaryCollapsed)}
          />
        </aside>
      )}

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[300px] bg-white dark:bg-[#111113] shadow-2xl flex flex-col animate-slide-in-left">
            {/* Mobile header */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-neutral-100/80 dark:border-white/6">
              <img src="/movirecurso_7.png" alt="MOVI" className="h-8 object-contain" />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-white dark:hover:bg-white/8 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vertical navigation */}
            <ScrollArea className="flex-1">
              <nav className="py-3 px-3">
                {NAV_ORDER.map((entry, idx) => {
                  if (entry.type === 'link') {
                    const item = entry.item;
                    if (!isTopLevelItemVisible(item, userRole)) return null;
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                      (item.matchPrefix && location.pathname.startsWith(item.path));

                    return (
                      <div key={`link-${idx}`} className="mb-0.5">
                        <button
                          onClick={() => { navigate(item.path); setMobileOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-semibold transition-all duration-200",
                            isActive
                              ? "bg-accent/8 text-accent dark:bg-accent/12 dark:text-white"
                              : "text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center",
                            isActive ? "bg-accent/10 dark:bg-accent/20" : "bg-neutral-100 dark:bg-white/8"
                          )}>
                            <Icon className={cn("w-4 h-4", isActive ? "text-accent" : "text-neutral-500 dark:text-white/50")} />
                          </div>
                          <span>{item.label}</span>
                        </button>
                      </div>
                    );
                  }

                  const ws = entry.workspace;
                  if (!isWorkspaceVisible(ws, userRole)) return null;
                  const WsIcon = ws.icon;
                  const isActiveWs = ws.id === workspace?.id;
                  const isExpanded = mobileExpandedWorkspace === ws.id;
                  const visibleItems = ws.items.filter(item => isItemVisible(item, userRole));

                  return (
                    <div key={ws.id} className="mb-0.5">
                      <button
                        onClick={() => setMobileExpandedWorkspace(isExpanded ? null : ws.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[13px] font-semibold transition-all duration-200",
                          isActiveWs
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center",
                            isActiveWs ? "bg-accent/10 dark:bg-accent/20" : "bg-neutral-100 dark:bg-white/8"
                          )}>
                            <WsIcon className={cn("w-4 h-4", isActiveWs ? "text-accent" : "text-neutral-500 dark:text-white/50")} />
                          </div>
                          <span>{ws.label}</span>
                        </div>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-neutral-400 transition-transform duration-300 ease-smooth",
                          isExpanded && "rotate-180"
                        )} />
                      </button>

                      {isExpanded && (
                        <div className="ml-5 pl-4 border-l-2 border-neutral-100 dark:border-white/6 mt-1 mb-2 space-y-0.5 animate-fade-in">
                          {visibleItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path ||
                              (item.matchPrefix && !item.excludePrefixes?.some(ex => location.pathname.startsWith(ex)) && location.pathname.startsWith(item.path));

                            return (
                              <button
                                key={item.path}
                                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                                  isActive
                                    ? "bg-accent/8 text-accent dark:bg-accent/12 dark:text-white"
                                    : "text-neutral-500 dark:text-white/50 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-white/80"
                                )}
                              >
                                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-accent" : "text-neutral-400 dark:text-white/35")} />
                                <span className="truncate">{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </ScrollArea>

            {/* Mobile footer */}
            <div className="border-t border-neutral-100 dark:border-white/6 p-4">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300 ease-smooth",
          getMainMargin()
        )}
      >

          {!hideHeader && (
            <>
              {/* Mobile header */}
              <header className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl border-b border-neutral-200/40 dark:border-white/5">
                <div className="flex items-center justify-between h-16 px-5">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="p-2.5 -ml-2 text-neutral-600 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white rounded-xl hover:bg-neutral-100 dark:hover:bg-white/8 transition-all active:scale-95"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <img src="/movirecurso_7.png" alt="MOVI" className="h-7 object-contain" />
                  <div className="flex items-center gap-1.5">
                    <InstallAppButton variant="ghost" size="sm" showText={false} />
                    <ThemeToggle />
                    <NotificationBell />
                  </div>
                </div>
              </header>

              {/* Desktop header */}
              <header className="hidden lg:flex sticky top-0 z-20 bg-white/70 dark:bg-[#111113]/70 backdrop-blur-2xl border-b border-neutral-100/60 dark:border-white/4">
                <div className="w-full px-8 flex items-center justify-between h-16">
                  <Breadcrumbs items={breadcrumbs} />
                  <div className="flex items-center gap-2">
                    <InstallAppButton variant="ghost" size="sm" />
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
              : 'w-full py-6 lg:py-8',
            ['/espacio-jiro'].includes(location.pathname)
              ? 'px-4 sm:px-6 lg:px-8'
              : ['/multicotizador-digital', '/centro-contacto'].includes(location.pathname)
              ? ''
              : 'max-w-[1400px] mx-auto px-5 sm:px-6 lg:px-10'
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
