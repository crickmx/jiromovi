import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireAdminOrGerente?: boolean;
  requireAdminOrEmpleado?: boolean;
  requireDirectorioAccess?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireAdminOrGerente = false,
  requireAdminOrEmpleado = false,
  requireDirectorioAccess = false
}: ProtectedRouteProps) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && usuario.rol !== 'Administrador') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdminOrGerente && usuario.rol !== 'Administrador' && usuario.rol !== 'Gerente') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdminOrEmpleado && usuario.rol !== 'Administrador' && usuario.rol !== 'Empleado') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireDirectorioAccess && usuario.rol !== 'Administrador' && usuario.rol !== 'Empleado' && usuario.rol !== 'Agente') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
