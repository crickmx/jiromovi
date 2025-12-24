import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import type { ActionButton } from '../../lib/assistantTypes';
import { Button } from '../ui/button';
import { useAssistant } from '../../contexts/AssistantContext';
import { useAuth } from '../../contexts/AuthContext';
import { logActionClick } from '../../lib/assistantService';

interface ResponseActionButtonsProps {
  actions: ActionButton[];
}

export function ResponseActionButtons({ actions }: ResponseActionButtonsProps) {
  const navigate = useNavigate();
  const { closeAssistant, sendMessage } = useAssistant();
  const { user } = useAuth();

  const handleAction = async (action: ActionButton) => {
    if (user?.id) {
      await logActionClick(user.id, null, null, action.type, action.destination);
    }

    switch (action.type) {
      case 'navigate':
        closeAssistant();
        navigate(action.destination);
        break;

      case 'navigate-with-id':
        closeAssistant();
        navigate(action.destination);
        break;

      case 'copy':
        await navigator.clipboard.writeText(action.destination);
        alert('Copiado al portapapeles');
        break;

      case 'execute-intent':
        await sendMessage(`Ejecutar: ${action.destination}`);
        break;

      case 'external':
        window.open(action.destination, '_blank');
        break;

      case 'dismiss':
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action, index) => {
        const IconComponent = action.icon ? (Icons as any)[action.icon] : Icons.ArrowRight;

        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => handleAction(action)}
            className="text-xs"
          >
            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
