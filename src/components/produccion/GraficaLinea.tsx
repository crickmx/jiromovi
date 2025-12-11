import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface GraficaLineaProps {
  data: DataPoint[];
  title: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  color?: string;
}

export default function GraficaLinea({
  data,
  title,
  valueFormatter = (v) => v.toLocaleString(),
  height = 300,
  color = '#3b82f6'
}: GraficaLineaProps) {
  const { maxValue, minValue, points, pathD } = useMemo(() => {
    if (data.length === 0) {
      return { maxValue: 0, minValue: 0, points: [], pathD: '' };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    const padding = (max - min) * 0.1 || max * 0.1 || 10;
    const chartMax = max + padding;
    const chartMin = Math.max(0, min - padding);
    const range = chartMax - chartMin || 1;

    const width = 100;
    const chartHeight = 100;
    const xStep = width / (data.length - 1 || 1);

    const chartPoints = data.map((item, index) => {
      const x = index * xStep;
      const normalizedValue = ((item.value - chartMin) / range);
      const y = chartHeight - (normalizedValue * chartHeight);

      return { x, y, value: item.value, label: item.label };
    });

    const path = chartPoints.map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    }).join(' ');

    return {
      maxValue: chartMax,
      minValue: chartMin,
      points: chartPoints,
      pathD: path
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-neutral-900 mb-6">{title}</h3>
        <div className="flex items-center justify-center h-64 text-neutral-500">
          No hay datos para mostrar
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-lg font-bold text-neutral-900 mb-6">{title}</h3>

      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`gradient-${title}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <path
            d={`${pathD} L 100 100 L 0 100 Z`}
            fill={`url(#gradient-${title})`}
          />

          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="1.5"
                fill="white"
                stroke={color}
                strokeWidth="0.5"
                className="cursor-pointer hover:r-2 transition-all"
              />
            </g>
          ))}
        </svg>

        {points.map((point, index) => (
          <div
            key={index}
            className="absolute group"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
              <div className="font-semibold">{point.label}</div>
              <div>{valueFormatter(point.value)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-neutral-600 overflow-x-auto">
        {data.map((item, index) => (
          <div
            key={index}
            className="text-center min-w-0 flex-shrink-0 px-1"
            style={{ width: `${100 / data.length}%` }}
          >
            <div className="truncate">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
