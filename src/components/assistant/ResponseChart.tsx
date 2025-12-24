import type { ChartData } from '../../lib/assistantTypes';

interface ResponseChartProps {
  chart: ChartData;
}

export function ResponseChart({ chart }: ResponseChartProps) {
  return (
    <div className="p-3 bg-gray-50 rounded border">
      <p className="text-xs text-gray-600 mb-2">Gráfica: {chart.type}</p>
      <div className="h-48 flex items-center justify-center bg-white rounded border">
        <p className="text-sm text-gray-500">
          Visualización de datos ({chart.labels?.length || 0} elementos)
        </p>
      </div>
    </div>
  );
}
