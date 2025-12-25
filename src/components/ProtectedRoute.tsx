import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireGerente?: boolean;
  requireAdminOrGerente?: boolean;
  requireAdminOrEmpleado?: boolean;
  requireDirectorioAccess?: boolean;
  excludeAgente?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireGerente = false,
  requireAdminOrGerente = false,
  requireAdminOrEmpleado = false,
  requireDirectorioAccess = false,
  excludeAgente = false
}: ProtectedRouteProps) {
  const { usuario, loading } = useAuth();

  console.log('[ProtectedRoute] Rendering, loading:', loading, 'usuario:', usuario?.id, usuario?.rol);

  if (loading) {
    console.log('[ProtectedRoute] Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    console.log('[ProtectedRoute] No usuario, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && usuario.rol !== 'Administrador') {
    console.error('[ProtectedRoute] ❌ ACCESO DENEGADO - Admin requerido');
    console.error('[ProtectedRoute] Rol del usuario:', usuario.rol);
    console.error('[ProtectedRoute] Rol esperado: Administrador');
    console.error('[ProtectedRoute] Comparación exacta:', usuario.rol === 'Administrador');
    console.error('[ProtectedRoute] Usuario completo:', JSON.stringify(usuario, null, 2));
    console.error('[ProtectedRoute] Redirigiendo a /dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  if (requireGerente && usuario.rol !== 'Administrador' && usuario.rol !== 'Gerente') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdminOrGerente && usuario.rol !== 'Administrador' && usuario.rol !== 'Gerente') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdminOrEmpleado && usuario.rol !== 'Administrador' && usuario.rol !== 'Empleado') {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireDirectorioAccess && usuario.rol !== 'Administrador' && usuario.rol !== 'Empleado' && usuario.rol !== 'Agente' && usuario.rol !== 'Gerente') {
    return <Navigate to="/dashboard" replace />;
  }

  if (excludeAgente && usuario.rol === 'Agente') {
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[ProtectedRoute] All checks passed, rendering children');
  return <>{children}</>;
}
