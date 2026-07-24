import { type ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PrimarySidebar } from './layout/PrimarySidebar';
import { SecondarySidebar } from './layout/SecondarySidebar';
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
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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

  const workspaceBadges: Partial<Record<string, number>> = {};
  if (tramitesAttentionCount > 0) workspaceBadges['comercial'] = tramitesAttentionCount;

  // Auto-close drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

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
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-[#0e0e10]">
      {/* Impersonation banner — fixed top, only during active session */}
      <ImpersonationBanner />
      {isBeta && <BetaBanner />}
      {!isBeta && esUsuarioBeta && <BackToBetaBanner />}

      {/* Primary rail sidebar — hidden on mobile */}
      <div className={`hidden md:flex ${bannerPt}`}>
        <PrimarySidebar
          activeWorkspaceId={workspace?.id ?? null}
          userRole={userRole}
          usuario={usuario}
          onSignOut={handleSignOut}
          isModuleVisible={isModuleVisible}
          oficinaId={oficinaId}
          workspaceBadges={workspaceBadges}
          topLevelBadges={storeAttentionCount > 0 ? { '/store': storeAttentionCount } : {}}
        />
      </div>

      {/* Secondary sidebar — only when inside a workspace, hidden on mobile */}
      {workspace && workspace.id !== 'produccion' && (
        <div className={`hidden md:flex ${bannerPt}`}>
          <SecondarySidebar
            workspace={workspace}
            activeItem={activeItem}
            userRole={userRole}
            collapsed={secondaryCollapsed}
            onToggleCollapse={() => setSecondaryCollapsed(c => !c)}
            isModuleVisible={isModuleVisible}
            oficinaId={oficinaId}
            badgeCounts={badgeCounts}
          />
        </div>
      )}

      {/* Mobile right-side drawer */}
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

      {/* Main content — shift down when banner is visible */}
      {isFullHeight ? (
        <main className={`flex-1 overflow-hidden min-w-0 flex flex-col mobile-page-content md:!pb-0 ${bannerPt}`}>
          {children}
        </main>
      ) : (
        <main className={`flex-1 overflow-y-auto min-w-0 mobile-page-content md:!pb-0 ${bannerPt}`}>
          <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      )}

      {/* Mobile bottom navigation */}
      <MobileNav onOpenDrawer={() => setMobileDrawerOpen(true)} />

      {usuario && bugReportActivo && <FloatingBugReportButton />}
    </div>
  );
}
