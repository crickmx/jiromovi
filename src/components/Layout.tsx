import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, X, Video, Calculator, Palette, Inbox } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
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
  const isAdminOrGerente = isAdmin || isGerente;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: true },
    { path: '/gestor-emails', label: 'Gestor de E-Mails', icon: Inbox, show: true },
    { path: '/movi-meet', label: 'MOVI Meet', icon: Video, show: true },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/publicidad', label: 'Publicidad', icon: Palette, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador Digital', icon: Calculator, show: true },
    { path: '/directorio', label: 'Directorio', icon: Users, show: isAdminOrGerente },
    { path: '/centro-correos', label: 'Centro de Correos', icon: Mail, show: isAdminOrGerente },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-neutral-200 shadow-soft transform transition-all duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
            <a href="/dashboard" className="flex items-center transition-transform hover:scale-105">
              <img
                src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                alt="MOVI Digital Logo"
                className="h-12 object-contain"
              />
            </a>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-2">
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
                    className={`w-full px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-3 group ${
                      isActive
                        ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-medium'
                        : 'text-neutral-700 hover:bg-neutral-100 hover:text-primary-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
            <button
              onClick={() => {
                navigate('/perfil');
                setSidebarOpen(false);
              }}
              className="flex items-center space-x-3 mb-3 w-full p-3 rounded-xl hover:bg-white hover:shadow-soft transition-all duration-200 group"
            >
              {usuario?.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Perfil"
                  className="w-11 h-11 rounded-full object-cover border-2 border-neutral-200 group-hover:border-primary-500 transition-all shadow-sm"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 group-hover:shadow-glow transition-all">
                  <span className="text-white font-semibold text-sm">
                    {usuario?.nombre?.[0]}{usuario?.apellidos?.[0]}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-neutral-800 truncate group-hover:text-primary-600 transition">
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p className="text-xs text-neutral-500 group-hover:text-primary-500 transition">{usuario?.rol}</p>
              </div>
              <User className="w-4 h-4 text-neutral-400 group-hover:text-primary-600 transition" />
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2.5 text-sm font-medium text-accent-600 hover:bg-accent-50 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-soft"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 lg:ml-72">
        <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-30 shadow-soft lg:hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 p-2 rounded-lg transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <img
              src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
              alt="MOVI Digital Logo"
              className="h-10 object-contain"
            />
            <div className="w-10" />
          </div>
        </header>

        <main className={location.pathname === '/multicotizador-digital' ? 'h-screen' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in'}>
          {children}
        </main>
      </div>
    </div>
  );
}
