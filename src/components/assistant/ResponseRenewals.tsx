import { Calendar } from 'lucide-react';
import type { RenewalItem } from '../../lib/assistantTypes';
import { ResponseActionButtons } from './ResponseActionButtons';
import { formatCurrency } from '../../lib/assistantUtils';

interface ResponseRenewalsProps {
  renewals: RenewalItem[];
}

export function ResponseRenewals({ renewals }: ResponseRenewalsProps) {
  return (
    <div className="space-y-2">
      {renewals.map((renewal, index) => (
        <div key={index} className="p-3 border rounded bg-white">
          <div className="flex items-start gap-2 mb-2">
            <Calendar className="h-4 w-4 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-sm">{renewal.client}</h4>
              <p className="text-xs text-gray-600">Póliza: {renewal.policy}</p>
              <div className="flex items-center gap-4 mt-1 text-xs">
                <span className="text-gray-500">
                  Vence: {new Date(renewal.expiry_date).toLocaleDateString()}
                </span>
                <span className="text-gray-900 font-medium">
                  {formatCurrency(renewal.premium)}
                </span>
              </div>
            </div>
          </div>
          {renewal.action && <ResponseActionButtons actions={[renewal.action]} />}
        </div>
      ))}
    </div>
  );
}
