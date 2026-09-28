import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { PrimaryNav } from '../navigation/PrimaryNav';
import { ContextNav } from '../navigation/ContextNav';

interface HorizontalNavProps {
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onSignOut: () => void;
  isModuleVisible?: (key: string, role: string, oficina_id?: string | null) => boolean;
  oficinaId?: string | null;
  badgeCounts?: Record<string, number>;
  topLevelBadges?: Record<string, number>;
}

export function HorizontalNav({
  workspace,
  activeItem,
  userRole,
  usuario,
  onSignOut,
  isModuleVisible,
  oficinaId,
  badgeCounts,
  topLevelBadges,
}: HorizontalNavProps) {
  return (
    <header className="hidden md:flex flex-col w-full shrink-0 z-30 select-none shadow-xs sticky top-0">
      {/* ── Nivel 1: Barra Primaria Fija con Secciones Principales & Utilidades ── */}
      <PrimaryNav
        workspace={workspace}
        userRole={userRole}
        usuario={usuario}
        onSignOut={onSignOut}
        isModuleVisible={isModuleVisible}
        oficinaId={oficinaId}
        topLevelBadges={topLevelBadges}
      />

      {/* ── Nivel 2: Barra Contextual con Breadcrumbs, Pestañas o MegaMenú ── */}
      <ContextNav
        workspace={workspace}
        activeItem={activeItem}
        userRole={userRole}
        isModuleVisible={isModuleVisible}
        oficinaId={oficinaId}
        badgeCounts={badgeCounts}
      />
    </header>
  );
}
