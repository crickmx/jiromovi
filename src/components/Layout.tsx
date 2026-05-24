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
    if (!hasSecondary) return "lg:ml-[68px]";
    return secondaryCollapsed ? "lg:ml-[120px]" : "lg:ml-[268px]";
  };

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
      {hasSecondary && (
        <aside
          className={cn(
            "hidden lg:flex fixed inset-y-0 z-30 transition-all duration-200 ease-out",
            "left-[68px]"
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

      {/* Mobile Drawer - Vertical enterprise sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white dark:bg-neutral-900 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
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

            {/* Vertical navigation */}
            <ScrollArea className="flex-1">
              <nav className="py-2">
                {NAV_ORDER.map((entry, idx) => {
                  if (entry.type === 'link') {
                    const item = entry.item;
                    if (!isTopLevelItemVisible(item, userRole)) return null;
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path ||
                      (item.matchPrefix && location.pathname.startsWith(item.path));

                    return (
                      <div key={`link-${idx}`} className="px-2">
                        <button
                          onClick={() => { navigate(item.path); setMobileOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all",
                            isActive
                              ? "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white"
                              : "text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", isActive ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-white/40")} />
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
                    <div key={ws.id} className="px-2">
                      <button
                        onClick={() => setMobileExpandedWorkspace(isExpanded ? null : ws.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all",
                          isActiveWs
                            ? "text-neutral-900 dark:text-white"
                            : "text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <WsIcon className={cn("w-4 h-4", isActiveWs ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-white/40")} />
                          <span>{ws.label}</span>
                        </div>
                        <ChevronDown className={cn(
                          "w-3.5 h-3.5 text-neutral-400 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      </button>

                      {isExpanded && (
                        <div className="ml-3 pl-3 border-l border-neutral-100 dark:border-white/8 mt-0.5 mb-2 space-y-0.5">
                          {visibleItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path ||
                              (item.matchPrefix && !item.excludePrefixes?.some(ex => location.pathname.startsWith(ex)) && location.pathname.startsWith(item.path));

                            return (
                              <button
                                key={item.path}
                                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all",
                                  isActive
                                    ? "bg-neutral-100 dark:bg-white/10 text-neutral-900 dark:text-white"
                                    : "text-neutral-500 dark:text-white/55 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-800 dark:hover:text-white/80"
                                )}
                              >
                                <Icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-neutral-700 dark:text-white/80" : "text-neutral-400 dark:text-white/35")} />
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
            <div className="border-t border-neutral-100 dark:border-white/8 p-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
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
          "min-h-screen transition-all duration-200 ease-out",
          getMainMargin()
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
              <header className="hidden lg:flex sticky top-0 z-20 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl border-b border-neutral-100 dark:border-white/5">
                <div className="w-full px-6 lg:px-8 flex items-center justify-between h-14">
                  <Breadcrumbs items={breadcrumbs} />
                  <div className="flex items-center gap-1.5">
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
