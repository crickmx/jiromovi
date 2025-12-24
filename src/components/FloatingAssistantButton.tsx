import { Sparkles } from 'lucide-react';
import { useAssistant } from '../contexts/AssistantContext';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export function FloatingAssistantButton() {
  const { openAssistant, unreadEventsCount } = useAssistant();

  const handleClick = () => {
    openAssistant();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="fixed bottom-6 right-6 z-40">
            <Button
              onClick={handleClick}
              size="lg"
              className="relative h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-110 transition-all duration-200"
              aria-label="Abrir Mi Asistente"
            >
              <Sparkles className="h-6 w-6" />

              {unreadEventsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white flex items-center justify-center animate-pulse">
                  {unreadEventsCount > 9 ? '9+' : unreadEventsCount}
                </span>
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Mi Asistente</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
