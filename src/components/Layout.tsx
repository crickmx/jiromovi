import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Users, Settings, Building2, LayoutDashboard, Mail, Calendar } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isAdminOrGerente = isAdmin || isGerente;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: isAdminOrGerente },
    { path: '/perfil', label: 'Mi Perfil', icon: User, show: true },
    { path: '/vacaciones', label: 'Vacaciones', icon: Calendar, show: true },
    { path: '/directorio', label: 'Directorio', icon: Users, show: isAdminOrGerente },
    { path: '/centro-correos', label: 'Centro de Correos', icon: Mail, show: isAdminOrGerente },
    { path: '/oficinas', label: 'Oficinas', icon: Building2, show: isAdmin },
    { path: '/configuracion', label: 'Configuración', icon: Settings, show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-slate-800">
                Intranet JIRO
              </h1>

              <div className="hidden md:flex space-x-1">
                {navItems.filter(item => item.show).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-800">
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p className="text-xs text-slate-500">{usuario?.rol}</p>
              </div>

              {usuario?.imagen_perfil_url ? (
                <img
                  src={usuario.imagen_perfil_url}
                  alt="Perfil"
                  className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {usuario?.nombre?.[0]}{usuario?.apellidos?.[0]}
                  </span>
                </div>
              )}

              <button
                onClick={handleSignOut}
                className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="md:hidden bg-white border-b border-slate-200">
        <div className="flex overflow-x-auto">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 px-4 py-3 text-xs font-medium transition flex flex-col items-center space-y-1 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                    : 'text-slate-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
