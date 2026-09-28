import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DesktopSidebar } from './layout/DesktopSidebar';
import { Breadcrumbs } from './navigation/Breadcrumbs';
import { MobileNav } from './layout/MobileNav';
import { MobileDrawer } from './layout/MobileDrawer';
import { ImpersonationBanner } from './ImpersonationBanner';
import { BetaBanner } from './BetaBanner';
import { BackToBetaBanner } from './BackToBetaBanner';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { isBetaHost } from '../lib/betaAccess';
import { resolveWorkspace } from '../lib/workspaceConfig';
import type { UserRole } from '../lib/workspaceConfig';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { useTramitesAttentionCount } from '../hooks/useTramitesAttentionCount';
import { useStoreAttentionCount } from '../hooks/useStoreAttentionCount';
import { useBugReportConfig } from '../hooks/useBugReportConfig';
import { FloatingBugReportButton } from './FloatingBugReportButton';

const PINNED_KEY = 'movi:sidebar_pinned';

// Routes that need full-height layout (no padding, overflow-hidden)
const FULL_HEIGHT_PREFIXES = [
  '/centro-contacto/',
  '/centro-contacto',
  '/chat',
  '/produccion',
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, signOut, esUsuarioBeta, redirigiendoABeta } = useMoviAuth();
  const { isImpersonating } = useImpersonation();
  const isBeta = isBetaHost();
  const hasTopBanner = isImpersonating || isBeta || esUsuarioBeta;
  const bannerCount = (isImpersonating ? 1 : 0) + (isBeta || esUsuarioBeta ? 1 : 0);
  const bannerPt = bannerCount === 2 ? 'pt-[72px]' : bannerCount === 1 ? 'pt-9' : '';
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Por default el menú opera en modo hover inteligente (isPinned = false).
  // Si el usuario decide fijarlo, se guarda su preferencia en localStorage.
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PINNED_KEY);
      return saved === '1';
    } catch {
      return false;
    }
  });

  const userRole = (usuario?.rol as UserRole) || 'Agente';
  const oficinaId = (usuario as any)?.oficina_id ?? null;
  const { isVisible } = useModuleVisibility();
  const isModuleVisible = (key: string, role: string, oficina_id?: string | null) =>
    isVisible(key, role, oficina_id, usuario?.id);
  const { workspace, activeItem } = resolveWorkspace(location.pathname, userRole);

  const isFullHeight = FULL_HEIGHT_PREFIXES.some(prefix => location.pathname.startsWith(prefix));

  const tramitesAttentionCount = useTramitesAttentionCount(usuario?.id);
  const storeAttentionCount = useStoreAttentionCount(usuario?.id);
  const { botonActivo: bugReportActivo } = useBugReportConfig();

  const badgeCounts: Record<string, number> = {};
  if (tramitesAttentionCount > 0) badgeCounts['/tramites'] = tramitesAttentionCount;
  if (storeAttentionCount > 0) badgeCounts['/store'] = storeAttentionCount;

  const topLevelBadges: Record<string, number> = {};
  if (tramitesAttentionCount > 0) topLevelBadges['/tramites'] = tramitesAttentionCount;
  if (storeAttentionCount > 0) topLevelBadges['/store'] = storeAttentionCount;

  // Auto-close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const handleTogglePin = () => {
    setIsPinned(prev => {
      const next = !prev;
      try {
        localStorage.setItem(PINNED_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  if (redirigiendoABeta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ background: 'linear-gradient(140deg, #2A1860 0%, #180E40 55%, #0D0B24 100%)' }}>
        <div className="w-14 h-14 border-4 border-white/25 border-t-white rounded-full animate-spin" />
        <p className="text-lg font-semibold text-white">Te estamos redirigiendo a la versión Beta de MOVI.</p>
        <p className="text-sm text-white/60">¡Gracias por ayudarnos a mejorar!</p>
      </div>
    );
  }

  return (
    <div className={`app-shell min-h-screen flex overflow-hidden bg-neutral-50 dark:bg-[#0c0c0e] ${bannerPt}`}>
      {/* Impersonation banner & Beta Banner */}
      <ImpersonationBanner />
      {isBeta && <BetaBanner />}
      {!isBeta && esUsuarioBeta && <BackToBetaBanner />}

      {/* ── Menú Lateral Izquierdo Inteligente (Desktop) ── */}
      <DesktopSidebar
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        workspace={workspace}
        activeItem={activeItem}
        userRole={userRole}
        usuario={usuario}
        onSignOut={handleSignOut}
        isModuleVisible={isModuleVisible}
        oficinaId={oficinaId}
        badgeCounts={badgeCounts}
        topLevelBadges={topLevelBadges}
      />

      {/* ── Área de Contenido Principal (Aprovecha el 100% del alto y ancho) ── */}
      {isFullHeight ? (
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 mobile-page-content md:!pb-0">
          {children}
        </main>
      ) : (
        <main className="flex-1 flex flex-col overflow-y-auto min-w-0 mobile-page-content md:!pb-0">
          {/* Barra de Breadcrumbs contextual */}
          <div className="hidden md:flex px-6 py-2.5 border-b border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.015] shrink-0 justify-between items-center">
            <Breadcrumbs workspace={workspace} activeItem={activeItem} />
          </div>

          {/* Contenedor de Página */}
          <div className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
            {children}
          </div>
        </main>
      )}

      {/* Mobile right-side drawer (Intacto para teléfonos) */}
      <MobileDrawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        workspace={workspace}
        activeItem={activeItem}
        userRole={userRole}
        usuario={usuario}
        onSignOut={handleSignOut}
        isModuleVisible={isModuleVisible}
        oficinaId={oficinaId}
      />

      {/* Mobile bottom navigation (Intacto para teléfonos) */}
      <MobileNav onOpenDrawer={() => setMobileDrawerOpen(true)} />

      {usuario && bugReportActivo && <FloatingBugReportButton />}
    </div>
  );
}
