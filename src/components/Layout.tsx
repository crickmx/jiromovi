import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, Calculator, Palette, MessageSquare, Key, GraduationCap, Bell, ClipboardList, Briefcase, ShoppingBag, BookUser, FileText, DollarSign, TrendingUp } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Sheet, SheetContent } from './ui/sheet';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

export function Layout({ children, hideHeader = false }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

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
    { path: isAdmin ? '/comisiones' : '/mis-comisiones', label: 'Comisiones', icon: DollarSign, show: true },
    { path: '/produccion/total', label: 'Producción', icon: TrendingUp, show: isAdminOrGerente },
    { path: '/mi-crm', label: 'Mi CRM', icon: Briefcase, show: true },
    { path: '/comunicados', label: 'Comunicados', icon: FileText, show: true },
    { path: '/seguros-education', label: 'Seguros Education', icon: GraduationCap, show: true },
    { path: '/publicidad', label: 'Publicidad', icon: Palette, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador Digital', icon: Calculator, show: true },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/store', label: 'Store', icon: ShoppingBag, show: true },
    { path: '/accesos-nacional', label: 'Accesos Nacional', icon: Key, show: isNotAgent },
    { path: '/directorio-jiro', label: 'Directorio JIRO', icon: BookUser, show: canAccessDirectorio },
    { path: '/chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { path: '/tramites', label: 'Trámites', icon: ClipboardList, show: true },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: isNotAgent },
    { path: '/directorio', label: 'Usuarios', icon: Users, show: isAdminOrGerente },
    { path: '/centro-notificaciones', label: 'Centro de Notificaciones', icon: Bell, show: isAdmin },
    { path: '/notificaciones-transaccionales', label: 'Notificaciones Transaccionales', icon: Mail, show: isAdmin },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion/mapeo-vendedores', label: 'Mapeo de Agentes', icon: Users, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const handleNavClick = (path: string) => {
      navigate(path);
      if (isMobile) {
        setSidebarOpen(false);
      }
    };

    const getInitials = () => {
      const nombre = usuario?.nombre?.[0] || '';
      const apellido = usuario?.apellidos?.[0] || '';
      return `${nombre}${apellido}`.toUpperCase();
    };

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-6 py-6 border-b border-neutral-200">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center transition-transform hover:scale-105"
          >
            <img
              src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
              alt="MOVI Digital Logo"
              className="h-12 object-contain"
            />
          </button>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <nav className="space-y-1">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.label === 'Comisiones' && (location.pathname.startsWith('/comisiones') || location.pathname.startsWith('/mis-comisiones'))) ||
                (item.label === 'Producción' && location.pathname.startsWith('/produccion'));

              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start px-4 py-3 h-auto font-medium text-sm transition-all",
                    isActive
                      ? "bg-primary-500 text-white hover:bg-primary-600 shadow-ios"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                  onClick={() => handleNavClick(item.path)}
                >
                  <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="text-left flex-1">{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-neutral-200 bg-neutral-50/50">
          <Button
            variant="ghost"
            className="w-full justify-start h-auto p-3 mb-2 hover:bg-white"
            onClick={() => {
              navigate('/perfil');
              if (isMobile) setSidebarOpen(false);
            }}
          >
            <Avatar className="h-10 w-10 mr-3">
              <AvatarImage src={usuario?.imagen_perfil_url} alt={usuario?.nombre} />
              <AvatarFallback className="bg-primary-500 text-white font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {usuario?.nombre} {usuario?.apellidos}
              </p>
              <p className="text-xs text-neutral-500 truncate">{usuario?.rol}</p>
            </div>
            <User className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          </Button>

          <Separator className="my-2" />

          <Button
            variant="ghost"
            className="w-full justify-center text-ios-red hover:text-ios-red hover:bg-ios-red/10"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span>Cerrar Sesión</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside
        className={cn(
          "hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 border-r border-neutral-200 bg-white shadow-sm transition-all duration-300",
          desktopSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      <div className={cn(
        "flex-1 transition-all duration-300",
        desktopSidebarOpen && "lg:ml-72"
      )}>
        {!hideHeader && (
          <>
            <header className="lg:hidden bg-white/95 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
              <div className="flex items-center justify-between px-4 py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="mr-2"
                >
                  <Menu className="w-6 h-6" />
                </Button>
                <img
                  src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                  alt="MOVI Digital Logo"
                  className="h-9 object-contain"
                />
                <NotificationBell />
              </div>
            </header>

            <header className="hidden lg:flex bg-white/95 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-30 shadow-sm">
              <div className="max-w-full w-full px-6 lg:px-8 py-4 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                  className="mr-4"
                >
                  <Menu className="w-6 h-6" />
                </Button>
                <div className="flex-1" />
                <NotificationBell />
              </div>
            </header>
          </>
        )}

        <main className={
          location.pathname === '/multicotizador-digital'
            ? 'h-screen'
            : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8'
        }>
          {children}
        </main>
      </div>
    </div>
  );
}
