import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedIndicatorProps {
  show: boolean;
  message?: string;
  duration?: number;
}

export function SavedIndicator({ show, message = "Guardado", duration = 2000 }: SavedIndicatorProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "flex items-center gap-2 px-4 py-3",
        "bg-white/90 dark:bg-slate-800/90 backdrop-blur-md",
        "border border-green-200 dark:border-green-500/30",
        "rounded-xl shadow-ios-lg",
        "animate-slide-up"
      )}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-500/20">
        <Check className="w-3 h-3 text-green-600 dark:text-green-400" strokeWidth={3} />
      </div>
      <span className="text-sm font-medium text-neutral-900 dark:text-white">
        {message}
      </span>
    </div>
  );
}
