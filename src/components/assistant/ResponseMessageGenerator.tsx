import { MessageSquare } from 'lucide-react';
import type { MessageGeneratorResponse } from '../../lib/assistantTypes';
import { ResponseActionButtons } from './ResponseActionButtons';

interface ResponseMessageGeneratorProps {
  response: MessageGeneratorResponse;
}

export function ResponseMessageGenerator({ response }: ResponseMessageGeneratorProps) {
  return (
    <div className="space-y-3">
      <div className="p-3 bg-primary-50 border border-primary-200 rounded">
        <div className="flex items-start gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-accent mt-0.5" />
          <h4 className="font-medium text-sm text-primary-900">Mensaje generado</h4>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{response.message}</p>
        {Object.keys(response.variables).length > 0 && (
          <div className="mt-2 pt-2 border-t border-primary-200">
            <p className="text-xs text-gray-600 mb-1">Variables:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(response.variables).map(([key, value]) => (
                <span key={key} className="text-xs bg-white px-2 py-1 rounded">
                  <span className="text-gray-500">{key}:</span>
                  <span className="ml-1 text-gray-900">{value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {response.actions.length > 0 && (
        <ResponseActionButtons actions={response.actions} />
      )}
    </div>
  );
}
