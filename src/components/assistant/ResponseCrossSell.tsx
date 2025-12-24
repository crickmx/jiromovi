import { Target } from 'lucide-react';
import type { CrossSellOpportunity } from '../../lib/assistantTypes';
import { Badge } from '../ui/badge';

interface ResponseCrossSellProps {
  opportunities: CrossSellOpportunity[];
}

export function ResponseCrossSell({ opportunities }: ResponseCrossSellProps) {
  return (
    <div className="space-y-2">
      {opportunities.map((opp, index) => (
        <div key={index} className="p-3 border rounded bg-white">
          <div className="flex items-start gap-2 mb-2">
            <Target className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{opp.client}</h4>
                <Badge variant="outline" className="text-xs">
                  Score: {opp.score}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2">{opp.reason}</p>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Actual:</span>
                  <span className="ml-1 text-gray-900">
                    {opp.current_products.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Sugerido:</span>
                  <span className="ml-1 text-green-600 font-medium">
                    {opp.suggested_products.join(', ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
