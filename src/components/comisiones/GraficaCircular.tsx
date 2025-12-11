import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface GraficaCircularProps {
  data: DataPoint[];
  title: string;
  valueFormatter?: (value: number) => string;
  size?: number;
}

export default function GraficaCircular({
  data,
  title,
  valueFormatter = (v) => v.toLocaleString(),
  size = 280
}: GraficaCircularProps) {
  const colors = [
    '#3b82f6',
    '#10b981',
    '#eab308',
    '#ef4444',
    '#14b8a6',
    '#f97316',
    '#06b6d4',
    '#10b981',
    '#f59e0b',
    '#0ea5e9'
  ];

  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const segments = useMemo(() => {
    if (data.length === 0) return [];

    let currentAngle = -90;

    return data.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = 50 + 40 * Math.cos(startRad);
      const y1 = 50 + 40 * Math.sin(startRad);
      const x2 = 50 + 40 * Math.cos(endRad);
      const y2 = 50 + 40 * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

      return {
        path,
        color: item.color || colors[index % colors.length],
        label: item.label,
        value: item.value,
        percentage: percentage.toFixed(1)
      };
    });
  }, [data, total, colors]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">
          No hay datos para mostrar
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-4 sm:mb-6">{title}</h3>

      <div className="flex flex-col items-center gap-6 sm:gap-8">
        <div className="relative w-full max-w-[240px] sm:max-w-none" style={{ maxWidth: `${size}px` }}>
          <div className="relative w-full" style={{ paddingBottom: '100%' }}>
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              {segments.map((segment, index) => (
                <g key={index}>
                  <path
                    d={segment.path}
                    fill={segment.color}
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer hover:scale-105"
                    style={{ transformOrigin: '50% 50%' }}
                  />
                </g>
              ))}

              <circle cx="50" cy="50" r="20" fill="white" />
            </svg>

            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <div className="text-lg sm:text-2xl font-bold text-neutral-900 text-center px-2">
                {valueFormatter(total)}
              </div>
              <div className="text-xs sm:text-sm text-neutral-600">Total</div>
            </div>
          </div>
        </div>

        <div className="w-full space-y-2 sm:space-y-3 max-h-64 overflow-y-auto">
          {segments.map((segment, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div
                  className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                    {segment.label}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {segment.percentage}%
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-neutral-900 ml-2 sm:ml-4 flex-shrink-0">
                {valueFormatter(segment.value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
