import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  showCloseButton?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '2xl',
  showCloseButton = true,
}: BaseModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative bg-white rounded-xl shadow-2xl ${maxWidthClasses[maxWidth]} w-full my-4 flex flex-col max-h-[92vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 hover:bg-white p-1.5 rounded-lg transition-all"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-slate-50 border-t border-slate-200 px-4 py-3 rounded-b-xl flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
