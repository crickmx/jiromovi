import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';

const HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const isSeguwalletDomain = HOST === 'seguwallet.mx' || HOST.endsWith('.seguwallet.mx');
const LOGIN_PATH = isSeguwalletDomain ? '/login' : '/seguwallet/login';
const COMPLETE_PROFILE_PATH = isSeguwalletDomain ? '/completa-perfil' : '/seguwallet/completa-perfil';

export function SeguwalletProtectedRoute({ children }: { children: ReactNode }) {
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
    return <Navigate to={LOGIN_PATH} replace />;
  }

  const isCompleteProfileRoute = location.pathname === COMPLETE_PROFILE_PATH;

  if ((needsProfileCompletion || needsTermsAcceptance) && !isCompleteProfileRoute) {
    return <Navigate to={COMPLETE_PROFILE_PATH} replace />;
  }

  return <>{children}</>;
}
