import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, X, Calculator, Palette, Inbox, FileSignature, Contact, MessageSquare, Key, GraduationCap, Bell, ClipboardList, Briefcase, ShoppingBag, BookUser, FileText } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface LayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
}

export function Layout({ children, hideHeader = false }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: true },
    { path: '/directorio', label: 'Usuarios', icon: Users, show: isAdminOrGerente },
    { path: '/centro-correos', label: 'Centro de Correos', icon: Mail, show: false },
    { path: '/centro-notificaciones', label: 'Centro de Notificaciones', icon: Bell, show: isAdmin },
    { path: '/notificaciones-transaccionales', label: 'Notificaciones Transaccionales', icon: Mail, show: isAdmin },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-ios-gray-100 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-ios border-r border-ios-gray-200 shadow-ios-md transform transition-all duration-300 ease-ios ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-6 border-b border-ios-gray-200/50">
            <a href="/dashboard" className="flex items-center transition-transform hover:scale-105">
              <img
                src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                alt="MOVI Digital Logo"
                className="h-12 object-contain"
              />
            </a>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-ios-gray-600 hover:text-ios-gray-900 hover:bg-ios-gray-100 p-2.5 rounded-ios-lg transition-all duration-200"
              title="Cerrar menú"
            >
              <X className="w-5 h-5 stroke-[1.5]" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-ios-lg text-[15px] font-medium transition-all duration-200 flex items-center space-x-3 text-left group ${
                      isActive
                        ? 'bg-ios-blue text-white shadow-ios'
                        : 'text-ios-gray-900 hover:bg-ios-gray-100 active:bg-ios-gray-200'
                    }`}
                  >
                    <Icon className={`w-[22px] h-[22px] flex-shrink-0 transition-all duration-200 stroke-[1.5] ${isActive ? '' : 'group-hover:scale-105'}`} />
                    <span className="text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-ios-gray-200/50 bg-ios-gray-50/30">
            <button
              onClick={() => {
                navigate('/perfil');
                setSidebarOpen(false);
              }}
              className="flex items-center space-x-3 mb-2 w-full p-3 rounded-ios-lg hover:bg-white active:bg-ios-gray-100 transition-all duration-200 group"
            >
              {usuario?.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Perfil"
                  className="w-11 h-11 rounded-full object-cover border-2 border-ios-gray-200 group-hover:border-ios-blue transition-all shadow-ios"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-ios-blue flex items-center justify-center flex-shrink-0 shadow-ios transition-all">
                  <span className="text-white font-semibold text-sm">
                    {usuario?.nombre?.[0]}{usuario?.apellidos?.[0]}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[15px] font-semibold text-ios-gray-900 truncate group-hover:text-ios-blue transition">
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p className="text-[13px] text-ios-gray-600">{usuario?.rol}</p>
              </div>
              <User className="w-[18px] h-[18px] text-ios-gray-500 group-hover:text-ios-blue transition stroke-[1.5]" />
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-[15px] font-medium text-ios-red hover:bg-ios-red/10 rounded-ios-lg transition-all duration-200 flex items-center justify-center space-x-2 active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`flex-1 transition-all duration-300 ease-ios ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-0'}`}>
        {!hideHeader && (
          <>
            {/* Mobile Header */}
            <header className="bg-white/90 backdrop-blur-ios border-b border-ios-gray-200/50 sticky top-0 z-30 shadow-ios lg:hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-ios-gray-700 hover:text-ios-gray-900 active:bg-ios-gray-100 p-2 rounded-ios transition-all"
                  title="Abrir menú"
                >
                  <Menu className="w-6 h-6 stroke-[1.5]" />
                </button>
                <img
                  src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                  alt="MOVI Digital Logo"
                  className="h-9 object-contain"
                />
                <NotificationBell />
              </div>
            </header>

            {/* Desktop Header with Menu Button and Notification Bell */}
            <header className="hidden lg:block bg-white/90 backdrop-blur-ios border-b border-ios-gray-200/50 sticky top-0 z-30 shadow-ios">
              <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="text-ios-gray-700 hover:text-ios-gray-900 active:bg-ios-gray-100 p-2.5 rounded-ios-lg transition-all"
                  title={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
                >
                  <Menu className="w-6 h-6 stroke-[1.5]" />
                </button>
                <NotificationBell />
              </div>
            </header>
          </>
        )}

        <main className={location.pathname === '/multicotizador-digital' ? 'h-screen' : 'max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in'}>
          {children}
        </main>
      </div>
    </div>
  );
}
