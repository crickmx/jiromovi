import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isItemVisible } from '@/lib/workspaceConfig';
import type { WorkspaceDefinition, WorkspaceNavItem, UserRole } from '@/lib/workspaceConfig';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

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

  const visibleItems = workspace.items.filter(item => isItemVisible(item, userRole));

  const isActive = (item: WorkspaceNavItem) => {
    if (location.pathname === item.path) return true;
    if (item.matchPrefix) {
      if (item.excludePrefixes?.some(ex => location.pathname.startsWith(ex))) return false;
      return location.pathname.startsWith(item.path);
    }
    return false;
  };

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-col h-full w-[52px] bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-white/6">
          <div className="flex items-center justify-center h-14 border-b border-neutral-100 dark:border-white/6">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2.5 px-1.5 space-y-0.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "w-full flex items-center justify-center p-2 rounded-xl transition-all duration-150",
                        "active:scale-[0.95]",
                        active
                          ? "bg-accent/10 text-accent dark:bg-accent/15 dark:text-accent-foreground"
                          : "text-neutral-400 dark:text-white/40 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-600 dark:hover:text-white/70"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-col h-full w-[200px] bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-white/6">
      {/* Workspace title */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-neutral-100 dark:border-white/6">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-accent/8">
            <workspace.icon className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
            {workspace.label}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
                "active:scale-[0.98]",
                active
                  ? "bg-accent/8 text-accent dark:bg-accent/12 dark:text-accent-foreground"
                  : "text-neutral-600 dark:text-white/60 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn(
                "w-4 h-4 flex-shrink-0",
                active ? "text-accent dark:text-accent-foreground/80" : "text-neutral-400 dark:text-white/40"
              )} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
