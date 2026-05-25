import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSeguwallet } from '../lib/SeguwalletContext';

export function SeguwalletProtectedRoute({ children }: { children: ReactNode }) {
  const { customer, loading, isAuthenticated } = useSeguwallet();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-sky-200 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer) {
    return <Navigate to="/seguwallet/login" replace />;
  }

  return <>{children}</>;
}
