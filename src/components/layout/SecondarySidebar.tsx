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
        <div className="flex flex-col h-full w-[52px] bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl border-r border-neutral-200/40 dark:border-white/[0.04]">
          <div className="flex items-center justify-center h-16">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-accent dark:hover:text-accent hover:bg-accent/5 dark:hover:bg-accent/10 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);

              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.path)}
                      className={cn(
                        "w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-200",
                        "active:scale-[0.92]",
                        active
                          ? "bg-accent/10 text-accent dark:bg-accent/15 shadow-[0_0_8px_rgba(var(--movi-accent-rgb)/0.08)]"
                          : "text-neutral-400 dark:text-white/35 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-700 dark:hover:text-white/70"
                      )}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={6} className="text-xs font-medium">
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
    <div className="flex flex-col h-full w-[208px] bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl border-r border-neutral-200/40 dark:border-white/[0.04]">
      {/* Workspace title */}
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent/8 dark:bg-accent/12">
            <workspace.icon className="w-4 h-4 text-accent" />
          </div>
          <span className="text-sm font-bold text-neutral-900 dark:text-white truncate tracking-tight">
            {workspace.label}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-accent hover:bg-accent/5 dark:hover:bg-accent/10 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-neutral-200/60 dark:bg-white/[0.04]" />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                "active:scale-[0.97]",
                active
                  ? "bg-accent/8 text-accent dark:bg-accent/12 shadow-[0_0_0_1px_rgba(var(--movi-accent-rgb)/0.1)]"
                  : "text-neutral-600 dark:text-white/55 hover:bg-neutral-100/70 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                active ? "bg-accent/10 dark:bg-accent/20" : "bg-neutral-100/80 dark:bg-white/[0.06]"
              )}>
                <Icon className={cn(
                  "w-3.5 h-3.5",
                  active ? "text-accent" : "text-neutral-500 dark:text-white/40"
                )} />
              </div>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
