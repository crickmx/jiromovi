import { Sparkles } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { Button } from './ui/button';

export function FloatingAssistantButton() {
  const { openAssistant, unreadEventsCount } = useAssistant();

  const handleClick = () => {
    openAssistant();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Button
        onClick={handleClick}
        size="lg"
        className="relative h-14 px-6 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:scale-105 transition-all duration-200 flex items-center gap-2"
        aria-label="Abrir Mi Asistente"
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-semibold text-base">Mi Asistente</span>

        {unreadEventsCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white flex items-center justify-center animate-pulse">
            {unreadEventsCount > 9 ? '9+' : unreadEventsCount}
          </span>
        )}
      </Button>
    </div>
  );
}
