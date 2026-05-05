import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, Calculator, Palette, MessageSquare, Key, GraduationCap, Bell, ClipboardList, Briefcase, ShoppingBag, BookUser, FileText, DollarSign, TrendingUp, ChevronLeft, Building, Activity, ClipboardCheck, Car, Database, Link as LinkIcon, FolderOpen, Trophy, X } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { FloatingAssistantButton } from './FloatingAssistantButton';
import { AssistantModal } from './AssistantModal';
import InstallAppButton from './InstallAppButton';
import InstallBanner from './InstallBanner';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

const SIDEBAR_STORAGE_KEY = 'movi-sidebar-collapsed';

export function Layout({ children, hideHeader = false }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(desktopSidebarCollapsed));
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
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
  const canAccessDirectorio = isAdmin || isEmpleado || isGerente;
  const isNotAgent = usuario?.rol !== 'Agente';

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/tramites', label: 'Tramites', icon: ClipboardList, show: true },
    { path: isAdmin ? '/comisiones' : '/mis-comisiones', label: 'Comisiones', icon: DollarSign, show: !isEmpleado && !isAgente },
    { path: '/mi-produccion', label: 'Mi Produccion', icon: TrendingUp, show: false },
    { path: '/mi-produccion-sicas-live', label: 'Produccion SICAS', icon: Activity, show: true },
    { path: '/produccion/total', label: 'Produccion Oficina', icon: Building, show: isAdminOrGerente },
    { path: '/mi-crm', label: 'Mi CRM', icon: Briefcase, show: true },
    { path: '/mi-progreso', label: 'Mi Progreso', icon: Trophy, show: !isEmpleado && !isAgente },
    { path: '/comunicados', label: 'Comunicados', icon: FileText, show: true },
    { path: '/centro-digital', label: 'Centro Digital', icon: FolderOpen, show: true },
    { path: '/seguros-education', label: 'Seguros Education', icon: GraduationCap, show: true },
    { path: '/mercadotecnia/mi-marca', label: 'Mercadotecnia', icon: Palette, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador', icon: Car, show: true },
    { path: '/gmm/cotizador', label: 'GMM BX+', icon: Activity, show: isAdmin },
    { path: '/gmm/tarifas', label: 'GMM Tarifas Admin', icon: Settings, show: isAdmin },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/store', label: 'MOVI Store', icon: ShoppingBag, show: true },
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, show: isNotAgent },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, show: canAccessDirectorio },
    { path: '/chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: isNotAgent },
    { path: '/directorio', label: 'Usuarios', icon: Users, show: isAdminOrGerente },
    { path: '/actividad-usuarios', label: 'Actividad Usuarios', icon: Activity, show: isAdmin },
    { path: '/centro-notificaciones', label: 'Notificaciones', icon: Bell, show: isAdmin },
    { path: '/notificaciones-transaccionales', label: 'Notif. Transaccionales', icon: Mail, show: isAdmin },
    { path: '/gamificacion/admin', label: 'Gamificacion', icon: Trophy, show: isAdmin },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/catalogos-web', label: 'Catalogos Web', icon: Database, show: isAdmin },
    { path: '/sicas', label: 'SICAS', icon: LinkIcon, show: isAdmin },
    { path: '/configuracion', label: 'Configuracion', icon: Settings, show: isAdmin },
  ];

  const getInitials = () => {
    const nombre = usuario?.nombre?.[0] || '';
    const apellido = usuario?.apellidos?.[0] || '';
    return `${nombre}${apellido}`.toUpperCase();
  };

  const handleNavClick = (path: string) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const NavItem = ({ item, isCollapsed = false }: { item: typeof navItems[0]; isCollapsed?: boolean }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path ||
      (item.label === 'Comisiones' && (location.pathname.startsWith('/comisiones') || location.pathname.startsWith('/mis-comisiones'))) ||
      (item.label === 'Mi Produccion' && location.pathname === '/mi-produccion') ||
      (item.label === 'Mercadotecnia' && location.pathname.startsWith('/mercadotecnia')) ||
      (item.path === '/produccion/total' && location.pathname === '/produccion/total');

    return (
      <button
        onClick={() => handleNavClick(item.path)}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 ease-smooth",
          isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5",
          "active:scale-[0.97]",
          isActive
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/8 hover:text-neutral-900 dark:hover:text-white"
        )}
      >
        <Icon className={cn(
          "flex-shrink-0 transition-colors duration-200",
          isCollapsed ? "w-5 h-5" : "w-[18px] h-[18px]"
        )} />
        {!isCollapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </button>
    );
  };

  const SidebarContent = ({ isMobile = false, isCollapsed = false }: { isMobile?: boolean; isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center flex-shrink-0 border-b border-neutral-100 dark:border-white/8",
        isCollapsed ? "justify-center px-2 h-14" : "justify-between px-5 h-14"
      )}>
        <button
          onClick={() => handleNavClick('/dashboard')}
          className="flex items-center transition-transform duration-200 hover:scale-[1.02] active:scale-95 focus:outline-none rounded-lg"
          aria-label="Ir al Dashboard"
        >
          <img
            src="/movirecurso_7.png"
            alt="MOVI Digital"
            className={cn(
              "object-contain",
              isCollapsed ? "h-8 w-8" : "h-8"
            )}
          />
        </button>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className={cn("space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
          {navItems.filter(item => item.show).map((item) => (
            <NavItem key={item.path} item={item} isCollapsed={isCollapsed} />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer - Profile */}
      <div className={cn(
        "flex-shrink-0 border-t border-neutral-100 dark:border-white/8",
        isCollapsed ? "p-2" : "p-3"
      )}>
        <button
          className={cn(
            "w-full flex items-center gap-3 rounded-xl transition-all duration-200 ease-smooth",
            "hover:bg-neutral-100 dark:hover:bg-white/8 active:scale-[0.97]",
            isCollapsed ? "justify-center p-2" : "px-3 py-2.5"
          )}
          onClick={() => handleNavClick('/perfil')}
          title={isCollapsed ? `${usuario?.nombre} ${usuario?.apellidos}` : undefined}
        >
          <Avatar className={cn("flex-shrink-0", isCollapsed ? "h-8 w-8" : "h-8 w-8")}>
            <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} />
            <AvatarFallback className="bg-accent text-accent-foreground font-semibold text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                {usuario?.nombre} {usuario?.apellidos}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-white/50 truncate">{usuario?.rol}</p>
            </div>
          )}
        </button>

        <button
          className={cn(
            "w-full flex items-center gap-2 rounded-xl text-[13px] font-medium mt-1",
            "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 active:scale-[0.97]",
            isCollapsed ? "justify-center p-2.5" : "justify-center px-3 py-2"
          )}
          onClick={handleSignOut}
          title={isCollapsed ? "Cerrar Sesion" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Cerrar Sesion</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 bg-white dark:bg-neutral-900 border-r border-neutral-200/70 dark:border-white/8 transition-all duration-250 ease-smooth",
          desktopSidebarCollapsed ? "w-[68px]" : "w-[264px]"
        )}
      >
        <div className="flex flex-col w-full relative">
          <SidebarContent isCollapsed={desktopSidebarCollapsed} />

          {/* Collapse toggle */}
          <button
            onClick={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
            className={cn(
              "absolute top-[60px] -right-3 z-50 w-6 h-6 rounded-full",
              "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10",
              "flex items-center justify-center shadow-sm",
              "hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1",
              "active:scale-90"
            )}
            aria-label={desktopSidebarCollapsed ? "Expandir menu" : "Colapsar menu"}
          >
            <ChevronLeft className={cn(
              "w-3.5 h-3.5 text-neutral-500 dark:text-white/60 transition-transform duration-200",
              desktopSidebarCollapsed && "rotate-180"
            )} />
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white dark:bg-neutral-900 shadow-xl animate-slide-in-left">
            <SidebarContent isMobile />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className={cn(
        "min-h-screen transition-all duration-250 ease-smooth",
        desktopSidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[264px]"
      )}>
        {!hideHeader && (
          <>
            {/* Mobile header */}
            <header className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-200/60 dark:border-white/8">
              <div className="flex items-center justify-between h-14 px-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 -ml-2 text-neutral-600 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors active:scale-95"
                  aria-label="Abrir menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <img
                  src="/movirecurso_7.png"
                  alt="MOVI Digital"
                  className="h-7 object-contain"
                />
                <div className="flex items-center gap-1">
                  <InstallAppButton variant="ghost" size="sm" showText={false} />
                  <ThemeToggle />
                  <NotificationBell />
                </div>
              </div>
            </header>

            {/* Desktop header */}
            <header className="hidden lg:flex sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border-b border-neutral-200/60 dark:border-white/8">
              <div className="w-full px-6 lg:px-8 flex items-center justify-end gap-2 h-14">
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
            : 'w-full py-5 lg:py-8',
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
