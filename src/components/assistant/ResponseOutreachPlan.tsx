import { User } from 'lucide-react';
import type { OutreachClient } from '../../lib/assistantTypes';
import { ResponseActionButtons } from './ResponseActionButtons';

interface ResponseOutreachPlanProps {
  clients: OutreachClient[];
}

export function ResponseOutreachPlan({ clients }: ResponseOutreachPlanProps) {
  return (
    <div className="space-y-2">
      {clients.map((client, index) => (
        <div key={index} className="p-3 border rounded bg-white">
          <div className="flex items-start gap-2 mb-2">
            <User className="h-4 w-4 text-primary-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">{client.name}</h4>
              <p className="text-xs text-gray-600">{client.reason}</p>
              {client.suggested_product && (
                <p className="text-xs text-primary-600 mt-1">
                  Sugerencia: {client.suggested_product}
                </p>
              )}
              {client.last_contact && (
                <p className="text-xs text-gray-500 mt-1">
                  Último contacto: {client.last_contact}
                </p>
              )}
            </div>
          </div>
          {client.action && <ResponseActionButtons actions={[client.action]} />}
        </div>
      ))}
    </div>
  );
}
