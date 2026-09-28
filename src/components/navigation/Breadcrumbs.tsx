import { ChevronRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { WorkspaceDefinition, WorkspaceNavItem } from '@/lib/workspaceConfig';

interface BreadcrumbsProps {
  workspace: WorkspaceDefinition | null;
  activeItem: WorkspaceNavItem | null;
  className?: string;
}

export function Breadcrumbs({ workspace, activeItem, className }: BreadcrumbsProps) {
  const navigate = useNavigate();

  return (
    <nav aria-label="Ruta de navegación" className={cn('flex items-center gap-1.5 text-[11.5px] select-none', className)}>
      {/* Inicio / Dashboard */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5"
        title="Ir al Inicio"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline font-medium">Inicio</span>
      </button>

      {/* Workspace Level */}
      {workspace && (
        <>
          <ChevronRight className="w-3 h-3 text-neutral-400 dark:text-neutral-600 shrink-0" aria-hidden="true" />
          <button
            onClick={() => {
              const firstPath = workspace.items[0]?.path || '/dashboard';
              navigate(firstPath);
            }}
            className={cn(
              'font-medium transition-colors p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5',
              activeItem
                ? 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                : 'text-neutral-900 dark:text-white font-semibold'
            )}
          >
            {workspace.label}
          </button>
        </>
      )}

      {/* Active Page / Sub-Item Level */}
      {activeItem && (
        <>
          <ChevronRight className="w-3 h-3 text-neutral-400 dark:text-neutral-600 shrink-0" aria-hidden="true" />
          <span
            aria-current="page"
            className="font-semibold text-neutral-900 dark:text-white truncate max-w-[180px] p-1"
          >
            {activeItem.label}
          </span>
        </>
      )}
    </nav>
  );
}
