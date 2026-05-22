import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  children?: ReactNode;
  className?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  actions?: ReactNode;
}

export function FilterBar({
  children,
  className,
  searchValue,
  searchPlaceholder = 'Buscar...',
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  actions,
}: FilterBarProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-3 sm:p-4",
      className
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {onSearchChange && (
          <div className="relative flex-1 min-w-0 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-white/30" />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent dark:focus:border-accent transition-all placeholder:text-neutral-400 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
            />
          </div>
        )}

        {children && (
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-white/60 bg-neutral-100 dark:bg-white/8 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/12 transition-colors"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg",
        "focus:ring-2 focus:ring-accent/20 focus:border-accent dark:focus:border-accent transition-all",
        "text-neutral-700 dark:text-white/80",
        className
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
