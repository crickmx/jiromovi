import { Sparkles } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { Button } from './ui/button';
import { useState } from 'react';

export function FloatingAssistantButton() {
  const { openAssistant, unreadEventsCount } = useAssistant();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    openAssistant();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative h-12 rounded-full bg-accent text-white shadow-lg
          hover:bg-accent-hover transition-all duration-300 ease-in-out
          flex items-center gap-2 group
          ${isHovered ? 'px-5 w-auto' : 'w-12 px-0 justify-center'}
        `}
        aria-label="Abrir Mi Asistente"
      >
        <Sparkles className="h-5 w-5 flex-shrink-0" />
        <span
          className={`
            font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300
            ${isHovered ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'}
          `}
        >
          Mi Asistente
        </span>

        {unreadEventsCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white flex items-center justify-center animate-pulse shadow-md">
            {unreadEventsCount > 9 ? '9+' : unreadEventsCount}
          </span>
        )}
      </Button>
    </div>
  );
}
