import type { PriorityItem } from '../../lib/assistantTypes';
import { Badge } from '../ui/badge';
import { ResponseActionButtons } from './ResponseActionButtons';
import { getPriorityColor } from '../../lib/assistantUtils';

interface ResponsePriorityListProps {
  items: PriorityItem[];
}

export function ResponsePriorityList({ items }: ResponsePriorityListProps) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="p-3 border rounded bg-surface-card">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm">{item.title}</h4>
            <Badge className={`text-xs ${getPriorityColor(item.priority)}`}>
              {item.priority === 'alta' ? 'Alta' : item.priority === 'media' ? 'Media' : 'Baja'}
            </Badge>
          </div>
          <p className="text-sm text-neutral-600">{item.description}</p>
          {item.action && <ResponseActionButtons actions={[item.action]} />}
        </div>
      ))}
    </div>
  );
}
