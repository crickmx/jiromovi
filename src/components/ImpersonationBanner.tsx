import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { Eye, X, Shield, ArrowLeft } from 'lucide-react';

export function ImpersonationBanner() {
  const { isImpersonating, session, getDisplayName, endImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !session) return null;

  const handleExit = async () => {
    await endImpersonation();
    // Return to the page that makes sense for each platform
    if (session.platform === 'seguwallet') {
      navigate('/seguwallet-admin');
    } else {
      navigate('/directorio');
    }
  };

  const platformLabel = session.platform === 'seguwallet' ? 'Seguwallet' : 'MOVI Digital';
  const roleLabel = session.impersonatedUser?.rol || (session.platform === 'seguwallet' ? 'Cliente' : '');

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-amber-950 shadow-md"
      style={{ height: '36px' }}
      role="status"
      aria-live="polite"
    >
      <div className="h-full max-w-screen-2xl mx-auto px-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-600/30 rounded shrink-0">
            <Eye className="h-3 w-3" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Vista Admin</span>
          </div>
          <span className="text-xs font-medium truncate">
            <span className="hidden sm:inline">Viendo como: </span>
            <strong className="font-bold">{getDisplayName()}</strong>
            {roleLabel && (
              <span className="ml-1.5 text-[11px] font-medium bg-amber-600/25 px-1.5 py-0.5 rounded">
                {roleLabel}
              </span>
            )}
            <span className="ml-1.5 text-[11px] opacity-60">({platformLabel})</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:flex items-center gap-1 text-[11px] font-medium opacity-60">
            <Shield className="h-3 w-3" />
            Modo completo
          </span>
          <button
            onClick={handleExit}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-950 text-amber-50 rounded text-xs font-bold hover:bg-amber-900 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Salir</span>
            <X className="h-3 w-3 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

