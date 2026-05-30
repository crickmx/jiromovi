import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { Eye, X, Shield } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, session, getDisplayName, endImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !session) return null;

  const handleExit = async () => {
    await endImpersonation();
    navigate('/dashboard');
  };

  const platformLabel = session.platform === 'seguwallet' ? 'Seguwallet' : 'MOVI Digital';
  const roleLabel = session.impersonatedUser?.rol || (session.platform === 'seguwallet' ? 'Cliente' : '');

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-600/30 rounded-md">
            <Eye className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide">Vista Admin</span>
          </div>
          <span className="text-sm font-medium truncate">
            Viendo la plataforma como:{' '}
            <strong className="font-bold">{getDisplayName()}</strong>
            {roleLabel && (
              <span className="ml-1.5 text-xs font-medium bg-amber-600/20 px-1.5 py-0.5 rounded">
                {roleLabel}
              </span>
            )}
            <span className="ml-1.5 text-xs opacity-70">({platformLabel})</span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:flex items-center gap-1 text-xs font-medium opacity-70">
            <Shield className="h-3 w-3" />
            Solo lectura
          </span>
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950 text-amber-50 rounded-md text-xs font-bold hover:bg-amber-900 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
