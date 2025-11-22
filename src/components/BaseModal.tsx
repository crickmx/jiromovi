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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-ios p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative bg-white rounded-ios-2xl shadow-ios-xl ${maxWidthClasses[maxWidth]} w-full my-4 flex flex-col max-h-[90vh] animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 sticky top-0 z-10 bg-white border-b border-ios-gray-200/50 px-5 py-4 rounded-t-ios-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ios-gray-900 tracking-tight">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-ios-gray-500 hover:text-ios-gray-900 hover:bg-ios-gray-100 p-2 rounded-ios transition-all duration-200 active:scale-95"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 stroke-[1.5]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 sticky bottom-0 z-10 bg-ios-gray-50 border-t border-ios-gray-200/50 px-5 py-4 rounded-b-ios-2xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
