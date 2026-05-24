import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';

interface Props {
  workspace: WorkspaceDefinition;
  activeItem: WorkspaceNavItem | null;
  userRole: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SecondarySidebar({ workspace, activeItem, userRole, collapsed, onToggleCollapse }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  if (collapsed) return null;

  const visibleItems = workspace.items.filter(item => isItemVisible(item, userRole));

  const isActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  return (
    <div className="flex flex-col h-full w-[200px] bg-white dark:bg-neutral-900 border-r border-neutral-200/70 dark:border-white/8">
      {/* Workspace title */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-neutral-100 dark:border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          <workspace.icon className="w-4 h-4 text-neutral-500 dark:text-white/50 flex-shrink-0" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
            {workspace.label}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                "active:scale-[0.98]",
                active
                  ? "bg-accent/10 text-accent-foreground dark:bg-accent/20"
                  : "text-neutral-600 dark:text-white/65 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                active ? "text-accent-foreground" : "text-neutral-400 dark:text-white/40"
              )} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
