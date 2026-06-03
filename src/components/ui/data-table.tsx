import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  emptyMessage?: string;
  stickyHeader?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  onRowClick,
  className,
  emptyMessage = 'No hay datos disponibles',
  stickyHeader = false,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-neutral-500 dark:text-white/55">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn(
            "border-b border-neutral-200 dark:border-white/8",
            stickyHeader && "sticky top-0 bg-white/97 dark:bg-neutral-900/97 backdrop-blur-sm z-10"
          )}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  // WCAG AA: neutral-600 on white = 5.7:1, white/65 on dark = ~4.5:1+
                  "text-left text-xs font-semibold text-neutral-600 dark:text-white/65 uppercase tracking-wider px-4 py-3.5",
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-white/6">
          {data.map((item, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(item)}
              className={cn(
                "transition-colors duration-150",
                onRowClick && "cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5"
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  // WCAG AA: neutral-800 on white = 9.7:1, white/85 on dark = ~6:1
                  className={cn("px-4 py-3.5 text-neutral-800 dark:text-white/85", col.className)}
                >
                  {col.render(item, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
