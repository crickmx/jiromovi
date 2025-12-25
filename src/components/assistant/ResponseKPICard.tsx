import * as Icons from 'lucide-react';
import type { KPICard } from '../../lib/assistantTypes';
import { getTrendIcon, getTrendColor } from '../../lib/assistantUtils';

interface ResponseKPICardProps {
  kpi: KPICard;
}

export function ResponseKPICard({ kpi }: ResponseKPICardProps) {
  const IconComponent = (Icons as any)[kpi.icon] || Icons.Activity;
  const TrendIconComponent = kpi.trend
    ? (Icons as any)[getTrendIcon(kpi.trend.direction)]
    : null;

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 bg-primary-50 rounded">
          <IconComponent className="h-4 w-4 text-primary-600" />
        </div>
        {kpi.trend && TrendIconComponent && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor(kpi.trend.direction)}`}>
            <TrendIconComponent className="h-3 w-3" />
            <span>{kpi.trend.value}</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
      <p className="text-xs text-gray-600 mt-1">{kpi.label}</p>
    </div>
  );
}
