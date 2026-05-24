import { ChevronRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface Props {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: Props) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-xs text-neutral-500 dark:text-white/50 mb-1">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-white/70 transition-colors"
      >
        <Home className="w-3 h-3" />
      </button>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 text-neutral-300 dark:text-white/20" />
          {item.path && idx < items.length - 1 ? (
            <button
              onClick={() => navigate(item.path!)}
              className="hover:text-neutral-700 dark:hover:text-white/70 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-neutral-700 dark:text-white/80 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
