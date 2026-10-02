import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Contenido extra pegado debajo del título, dentro del mismo header sticky (ej. barra de progreso). */
  subHeader?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  subHeader,
  maxWidth = '2xl',
  showCloseButton = true,
  closeOnEscape = false,
}: BaseModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    if (!closeOnEscape) return () => { document.body.style.overflow = 'unset'; };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 backdrop-blur-[3px] p-3 sm:p-4 overflow-y-auto movi-overlay-in"
      data-state="open"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative bg-surface-card border border-soft rounded-[var(--radius-xl)] shadow-e4 ${maxWidthClasses[maxWidth]} w-full my-4 flex flex-col max-h-[90dvh] animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 sticky top-0 z-10 bg-surface-card border-b border-soft px-5 sm:px-6 py-4 rounded-t-[var(--radius-xl)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-title-sm sm:text-title font-semibold text-neutral-900 dark:text-white">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-900 hover:bg-surface-muted dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10 p-2 rounded-xl transition-colors duration-fast active:scale-95 flex-shrink-0"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            )}
          </div>
          {subHeader && <div className="mt-3">{subHeader}</div>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-surface-muted/80 backdrop-blur border-t border-soft px-5 sm:px-6 py-4 rounded-b-[var(--radius-xl)] flex flex-wrap justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
