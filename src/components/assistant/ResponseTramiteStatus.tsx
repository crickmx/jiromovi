import { CheckCircle, Circle, Clock } from 'lucide-react';
import type { TramiteStatusResponse } from '../../lib/assistantTypes';
import { ResponseActionButtons } from './ResponseActionButtons';

interface ResponseTramiteStatusProps {
  response: TramiteStatusResponse;
}

export function ResponseTramiteStatus({ response }: ResponseTramiteStatusProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {response.timeline.map((step, index) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';

          return (
            <div key={index} className="flex items-start gap-3">
              <div className="mt-0.5">
                {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
                {isCurrent && <Clock className="h-5 w-5 text-primary-600" />}
                {!isCompleted && !isCurrent && <Circle className="h-5 w-5 text-gray-300" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  isCompleted ? 'text-gray-900' :
                  isCurrent ? 'text-primary-900' :
                  'text-gray-500'
                }`}>
                  {step.step}
                </p>
                {step.date && (
                  <p className="text-xs text-gray-500">
                    {new Date(step.date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {response.next_step && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded">
          <p className="text-xs font-medium text-primary-900 mb-1">Siguiente paso:</p>
          <p className="text-sm text-gray-800">{response.next_step}</p>
        </div>
      )}

      {response.actions.length > 0 && (
        <ResponseActionButtons actions={response.actions} />
      )}
    </div>
  );
}
