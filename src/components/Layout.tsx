import { type ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PrimarySidebar } from './layout/PrimarySidebar';
import { SecondarySidebar } from './layout/SecondarySidebar';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { resolveWorkspace } from '../lib/workspaceConfig';
import type { UserRole } from '../lib/workspaceConfig';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, signOut } = useMoviAuth();
  const [secondaryCollapsed, setSecondaryCollapsed] = useState(false);

  const userRole = (usuario?.rol as UserRole) || 'Agente';
  const { workspace, activeItem } = resolveWorkspace(location.pathname, userRole);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-[#0e0e10]">
      {/* Primary rail sidebar */}
      <PrimarySidebar
        activeWorkspaceId={workspace?.id ?? null}
        userRole={userRole}
        usuario={usuario}
        onSignOut={handleSignOut}
      />

      {/* Secondary sidebar — only when inside a workspace */}
      {workspace && (
        <SecondarySidebar
          workspace={workspace}
          activeItem={activeItem}
          userRole={userRole}
          collapsed={secondaryCollapsed}
          onToggleCollapse={() => setSecondaryCollapsed(c => !c)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="px-6 py-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
