import { useNavigate, useLocation } from 'react-router-dom';
import { Hop as Home, ClipboardList, Sparkles, FolderOpen, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';

interface Props {
  workspace: WorkspaceDefinition | null | undefined;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  usuario: { nombre?: string; apellidos?: string; imagen_perfil_url?: string; rol?: string } | null;
  onOpenDrawer: () => void;
  onSignOut: () => void;
}

export function MobileNav({ workspace, onOpenDrawer }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const quickItems = [
    { path: '/dashboard', label: 'Inicio', icon: Home },
    { path: '/tramites', label: 'Tramites', icon: ClipboardList },
    { path: '/chava', label: 'Chava', icon: Sparkles },
    { path: '/centro-digital', label: 'Digital', icon: FolderOpen },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-[#111113] border-t border-neutral-200 dark:border-white/[0.08] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-stretch h-14">
        {quickItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all active:scale-95',
                active
                  ? 'text-accent'
                  : 'text-neutral-400 dark:text-neutral-500'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}

        {/* Menu/drawer button */}
        <button
          onClick={onOpenDrawer}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all active:scale-95"
        >
          <Menu className="w-5 h-5" />
          <span className="leading-none">Menu</span>
        </button>
      </div>
    </div>
  );
}
