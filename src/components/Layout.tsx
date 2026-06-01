import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PrimarySidebar } from './layout/PrimarySidebar';
import { SecondarySidebar } from './layout/SecondarySidebar';
import { MobileNav } from './layout/MobileNav';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { resolveWorkspace } from '../lib/workspaceConfig';
import type { UserRole } from '../lib/workspaceConfig';

// Routes that need full-height layout (no padding, overflow-hidden)
const FULL_HEIGHT_PREFIXES = [
  '/centro-contacto/',
  '/centro-contacto',
  '/chat',
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, signOut } = useMoviAuth();
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const userRole = (usuario?.rol as UserRole) || 'Agente';
  const { workspace, activeItem } = resolveWorkspace(location.pathname, userRole);

  const isFullHeight = FULL_HEIGHT_PREFIXES.some(prefix => location.pathname.startsWith(prefix));

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-[#0e0e10]">
      {/* Primary rail sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <PrimarySidebar
          activeWorkspaceId={workspace?.id ?? null}
          userRole={userRole}
          usuario={usuario}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Secondary sidebar — only when inside a workspace, hidden on mobile */}
      {workspace && (
        <div className="hidden md:flex">
          <SecondarySidebar
            workspace={workspace}
            activeItem={activeItem}
            userRole={userRole}
            collapsed={secondaryCollapsed}
            onToggleCollapse={() => setSecondaryCollapsed(c => !c)}
          />
        </div>
      )}

      {/* Mobile drawer overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 md:hidden flex transition-transform duration-300 ease-in-out ${
        mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <PrimarySidebar
          activeWorkspaceId={workspace?.id ?? null}
          userRole={userRole}
          usuario={usuario}
          onSignOut={handleSignOut}
          mobileMode
          onMobileClose={() => setMobileDrawerOpen(false)}
        />
        {workspace && (
          <SecondarySidebar
            workspace={workspace}
            activeItem={activeItem}
            userRole={userRole}
            collapsed={false}
            onToggleCollapse={() => setMobileDrawerOpen(false)}
            mobileMode
            onMobileItemClick={() => setMobileDrawerOpen(false)}
          />
        )}
      </div>

      {/* Main content */}
      {isFullHeight ? (
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col pb-14 md:pb-0">
          {children}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto min-w-0 pb-14 md:pb-0">
          <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      )}

      {/* Mobile bottom navigation */}
      <MobileNav
        workspace={workspace}
        activeItem={activeItem}
        userRole={userRole}
        usuario={usuario}
        onOpenDrawer={() => setMobileDrawerOpen(true)}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
