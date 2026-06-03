import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';

interface Props {
  children: ReactNode;
  loginPath?: string;
  profilePath?: string;
}

export function SeguwalletProtectedRoute({
  children,
  loginPath = '/seguwallet/login',
  profilePath = '/seguwallet/completa-perfil',
}: Props) {
  const { loading, isAuthenticated, needsProfileCompletion, needsTermsAcceptance } = useSeguwallet();
  const { isImpersonating, session } = useImpersonation();
  const location = useLocation();

  // Admin impersonating a Seguwallet customer — bypass auth check
  if (isImpersonating && session?.platform === 'seguwallet') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-blue-200 border-t-[#1C37E0] rounded-full animate-spin" />
          <p className="text-sm text-neutral-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace />;
  }

  const isCompleteProfileRoute = location.pathname === profilePath;

  if ((needsProfileCompletion || needsTermsAcceptance) && !isCompleteProfileRoute) {
    return <Navigate to={profilePath} replace />;
  }

  return <>{children}</>;
}
