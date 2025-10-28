import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar, MapPin, Menu, X, Video, Calculator } from 'lucide-react';

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
    { path: '/movi-meet', label: 'MOVI Meet', icon: Video, show: true },
    { path: '/espacio-jiro', label: 'Espacio JIRO', icon: MapPin, show: true },
    { path: '/multicotizador-digital', label: 'Multicotizador Digital', icon: Calculator, show: true },
    { path: '/directorio', label: 'Directorio', icon: Users, show: isAdminOrGerente },
    { path: '/centro-correos', label: 'Centro de Correos', icon: Mail, show: isAdminOrGerente },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-800">Intranet JIRO</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-600 hover:text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
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
                    className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition flex items-center space-x-3 ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-slate-200">
            <button
              onClick={() => {
                navigate('/perfil');
                setSidebarOpen(false);
              }}
              className="flex items-center space-x-3 mb-4 w-full p-3 rounded-lg hover:bg-slate-100 transition group"
            >
              {usuario?.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Perfil"
                  className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 group-hover:border-blue-600 transition"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-700 transition">
                  <span className="text-white font-medium text-sm">
                    {usuario?.nombre?.[0]}{usuario?.apellidos?.[0]}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600 transition">
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p className="text-xs text-slate-500 group-hover:text-blue-500 transition">{usuario?.rol}</p>
              </div>
              <User className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 lg:ml-64">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-800">Intranet JIRO</h1>
            <div className="w-6" />
          </div>
        </header>

        <main className={location.pathname === '/multicotizador-digital' ? 'h-screen' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
          {children}
        </main>
      </div>
    </div>
  );
}
