import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, Calculator, Palette, MessageSquare, Key, GraduationCap, Bell, ClipboardList, Briefcase, ShoppingBag, BookUser, FileText, DollarSign, TrendingUp, ChevronLeft, Building, Activity, ClipboardCheck, Car, Globe as Globe2, Database, Link as LinkIcon, FolderOpen, BarChart3, Trophy, Percent } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { FloatingAssistantButton } from './FloatingAssistantButton';
import { AssistantModal } from './AssistantModal';
import InstallAppButton from './InstallAppButton';
import InstallBanner from './InstallBanner';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

const SIDEBAR_STORAGE_KEY = 'movi-sidebar-collapsed';

export function Layout({ children, hideHeader = false }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile sidebar state (drawer overlay)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Desktop sidebar state (collapsed/expanded)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    // Load from localStorage only on desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored === 'true';
    }
    return false;
  });

  // Persist desktop sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(desktopSidebarCollapsed));
    }
  }, [desktopSidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Handle ESC key to close mobile sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isAgente = usuario?.rol === 'Agente';
  const isAdminOrGerente = isAdmin || isGerente;
  const isAdminOrEmpleado = isAdmin || isEmpleado;
  const canAccessDirectorio = isAdmin || isEmpleado || isGerente;
  const isNotAgent = usuario?.rol !== 'Agente';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/tramites', label: 'Trámites', icon: ClipboardList, show: true },
    { path: isAdmin ? '/comisiones' : '/mis-comisiones', label: 'Comisiones', icon: DollarSign, show: !isEmpleado && !isAgente },
    { path: '/comisiones/regimen-fiscal', label: 'Régimen Fiscal', icon: Percent, show: isAdmin },
    { path: '/mi-produccion', label: 'Mi Producción', icon: TrendingUp, show: false },
    { path: '/mi-produccion-sicas', label: 'Mi Producción SICAS', icon: Database, show: !isEmpleado && !isAgente },
    { path: '/produccion/total', label: 'Producción por Oficina', icon: Building, show: isAdminOrGerente },
    { path: '/produccion/por-vendedor', label: 'Producción por Vendedor', icon: Users, show: isAdminOrGerente },
    { path: '/mi-crm', label: 'Mi CRM', icon: Briefcase, show: true },
    { path: '/mi-progreso', label: 'Mi Progreso', icon: Trophy, show: !isEmpleado && !isAgente },
    { path: '/comunicados', label: 'Comunicados', icon: FileText, show: true },
    { path: '/centro-digital', label: 'Centro Digital', icon: FolderOpen, show: true },
    { path: '/seguros-education', label: 'Seguros Education', icon: GraduationCap, show: true },
    { path: '/publicidad', label: 'Publicidad', icon: Palette, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador Digital', icon: Car, show: true },
    { path: '/gmm/cotizador', label: 'GMM BX+', icon: Activity, show: isAdmin },
    { path: '/gmm/tarifas', label: 'GMM Tarifas Admin', icon: Settings, show: isAdmin },
    { path: '/mi-pagina-web', label: 'Mi Página Web', icon: Globe2, show: true },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/store', label: 'MOVI Store', icon: ShoppingBag, show: true },
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, show: isNotAgent },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, show: canAccessDirectorio },
    { path: '/chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { path: '/tramites/reportes', label: 'Dashboard de Trámites', icon: BarChart3, show: isAdminOrGerente },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: isNotAgent },
    { path: '/directorio', label: 'Usuarios', icon: Users, show: isAdminOrGerente },
    { path: '/centro-notificaciones', label: 'Centro de Notificaciones', icon: Bell, show: isAdmin },
    { path: '/notificaciones-transaccionales', label: 'Notificaciones Transaccionales', icon: Mail, show: isAdmin },
    { path: '/gamificacion/admin', label: 'Gamificación', icon: Trophy, show: isAdmin },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/catalogos-web', label: 'Catálogos Web', icon: Database, show: isAdmin },
    { path: '/sicas', label: 'SICAS', icon: LinkIcon, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  const SidebarContent = ({ isMobile = false, isCollapsed = false }: { isMobile?: boolean; isCollapsed?: boolean }) => {
    const handleNavClick = (path: string) => {
      // Cerrar inmediatamente el menú antes de navegar
      if (isMobile) {
        setSidebarOpen(false);
      }
      // Navegar después de cerrar
      setTimeout(() => {
        navigate(path);
      }, 0);
    };

    const getInitials = () => {
      const nombre = usuario?.nombre?.[0] || '';
      const apellido = usuario?.apellidos?.[0] || '';
      return `${nombre}${apellido}`.toUpperCase();
    };

    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-neutral-200 dark:border-white/10 transition-all duration-250 ease-ios-smooth",
          isCollapsed ? "justify-center px-2 py-4" : "justify-between px-6 py-6"
        )}>
          <button
            onClick={() => {
              if (isMobile) {
                setSidebarOpen(false);
              }
              setTimeout(() => navigate('/dashboard'), 0);
            }}
            className="flex items-center transition-all duration-250 ease-ios-smooth hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-lg"
            aria-label="Ir al Dashboard"
          >
            <img
              src="/movirecurso_7.png"
              alt="MOVI Digital Logo"
              className={cn(
                "object-contain transition-all duration-250 ease-ios-smooth",
                isCollapsed ? "h-10 w-10" : "h-12"
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.label === 'Comisiones' && (location.pathname.startsWith('/comisiones') || location.pathname.startsWith('/mis-comisiones'))) ||
                (item.label === 'Mi Producción' && location.pathname === '/mi-produccion') ||
                (item.label.includes('Producción') && location.pathname.startsWith('/produccion') && (
                  (item.path === '/produccion/total' && location.pathname === '/produccion/total') ||
                  (item.path === '/produccion/por-vendedor' && location.pathname === '/produccion/por-vendedor')
                ));

              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full transition-all duration-250 ease-ios-smooth font-medium text-sm",
                    isCollapsed ? "justify-center px-2 py-3" : "justify-start px-4 py-3",
                    "h-auto active:scale-95",
                    isActive
                      ? "bg-accent text-accent-foreground hover:bg-accent-hover shadow-ios"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                  onClick={() => handleNavClick(item.path)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-all duration-250 ease-ios-smooth",
                    !isCollapsed && "mr-3"
                  )} />
                  {!isCollapsed && (
                    <span className="text-left flex-1 transition-opacity duration-200 ease-ios-smooth">
                      {item.label}
                    </span>
                  )}
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className={cn(
          "border-t border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 transition-all duration-250 ease-ios-smooth",
          isCollapsed ? "p-2" : "p-4"
        )}>
          <Button
            variant="ghost"
            className={cn(
              "w-full h-auto mb-2 hover:bg-white dark:hover:bg-white/10 transition-all duration-250 ease-ios-smooth active:scale-95",
              isCollapsed ? "justify-center p-2" : "justify-start p-3"
            )}
            onClick={() => {
              if (isMobile) setSidebarOpen(false);
              setTimeout(() => navigate('/perfil'), 0);
            }}
            title={isCollapsed ? `${usuario?.nombre} ${usuario?.apellidos}` : undefined}
          >
            <Avatar className={cn(
              "transition-all duration-250 ease-ios-smooth",
              isCollapsed ? "h-9 w-9" : "h-10 w-10 mr-3"
            )}>
              <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} />
              <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0 transition-opacity duration-200 ease-ios-smooth">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                    {usuario?.nombre} {usuario?.apellidos}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-white/60 truncate">{usuario?.rol}</p>
                </div>
                <User className="w-4 h-4 text-neutral-400 dark:text-white/40 flex-shrink-0 transition-all duration-250 ease-ios-smooth" />
              </>
            )}
          </Button>

          {!isCollapsed && <Separator className="my-2" />}

          <Button
            variant="ghost"
            className={cn(
              "w-full text-ios-red hover:text-ios-red hover:bg-ios-red/10 transition-all duration-250 ease-ios-smooth active:scale-95",
              isCollapsed ? "justify-center p-2" : "justify-center"
            )}
            onClick={handleSignOut}
            title={isCollapsed ? "Cerrar Sesión" : undefined}
          >
            <LogOut className={cn(
              "w-4 h-4 transition-all duration-250 ease-ios-smooth",
              !isCollapsed && "mr-2"
            )} />
            {!isCollapsed && (
              <span className="transition-opacity duration-200 ease-ios-smooth">
                Cerrar Sesión
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-slate-950">
      {/* Desktop Sidebar - Always visible, can be collapsed */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 border-r border-neutral-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm transition-all duration-250 ease-ios-smooth",
          desktopSidebarCollapsed ? "w-[72px]" : "w-[280px]"
        )}
      >
        <div className="flex flex-col w-full relative">
          <SidebarContent isCollapsed={desktopSidebarCollapsed} />

          {/* Collapse/Expand button */}
          <button
            onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
            className={cn(
              "absolute top-[88px] -right-3 z-50 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-neutral-200 dark:border-white/10 flex items-center justify-center hover:bg-neutral-50 dark:hover:bg-slate-700 transition-all duration-250 ease-ios-smooth shadow-sm",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
              "active:scale-95"
            )}
            aria-label={desktopSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <ChevronLeft className={cn(
              "w-4 h-4 text-neutral-600 dark:text-white/70 transition-transform duration-250 ease-ios-smooth",
              desktopSidebarCollapsed && "rotate-180"
            )} />
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar - Overlay drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menú de navegación</SheetTitle>
            <SheetDescription>Acceso a todas las secciones de la plataforma</SheetDescription>
          </SheetHeader>
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className={cn(
        "min-h-screen transition-all duration-250 ease-ios-smooth",
        desktopSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[280px]"
      )}>
        {!hideHeader && (
          <>
            {/* Mobile header */}
            <header className="lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-neutral-200 dark:border-white/10 sticky top-0 z-30 shadow-sm">
              <div className="flex items-center justify-between px-4 py-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mr-2 p-2 text-neutral-700 dark:text-white/80 hover:text-neutral-900 dark:hover:text-white transition-colors active:scale-95"
                  aria-label="Abrir menú"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <img
                  src="/movirecurso_7.png"
                  alt="MOVI Digital Logo"
                  className="h-9 object-contain"
                />
                <div className="flex items-center gap-2">
                  <InstallAppButton variant="ghost" size="sm" showText={false} />
                  <ThemeToggle />
                  <NotificationBell />
                </div>
              </div>
            </header>

            {/* Desktop header */}
            <header className="hidden lg:flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-neutral-200 dark:border-white/10 sticky top-0 z-30 shadow-sm">
              <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-end gap-3">
                <InstallAppButton variant="outline" size="sm" />
                <ThemeToggle />
                <NotificationBell />
              </div>
            </header>
          </>
        )}

        <main className={cn(
          location.pathname === '/multicotizador-digital'
            ? 'h-screen'
            : 'w-full py-6 lg:py-8',
          // Páginas con ancho completo sin centrado
          ['/espacio-jiro'].includes(location.pathname)
            ? 'px-4 sm:px-6 lg:px-8'
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
