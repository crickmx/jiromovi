import { useMemo, useState } from 'react';

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
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const { maxValue, minValue, points, pathD, yAxisLabels } = useMemo(() => {
    if (data.length === 0) {
      return { maxValue: 0, minValue: 0, points: [], pathD: '', yAxisLabels: [] };
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

    const steps = 5;
    const stepValue = (chartMax - chartMin) / steps;
    const axisLabels = Array.from({ length: steps + 1 }, (_, i) => {
      const value = chartMin + stepValue * (steps - i);
      return {
        value,
        label: valueFormatter(value)
      };
    });

    return {
      maxValue: chartMax,
      minValue: chartMin,
      points: chartPoints,
      pathD: path,
      yAxisLabels: axisLabels
    };
  }, [data, valueFormatter]);

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

  const gradientId = `gradient-${title.replace(/\s+/g, '-')}`;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-4 sm:mb-6">{title}</h3>

      <div className="flex gap-3">
        <div className="flex flex-col justify-between" style={{ height: `${height}px` }}>
          {yAxisLabels.map((label, index) => (
            <div key={index} className="text-xs text-neutral-500 font-medium text-right pr-2 -mt-2 first:mt-0">
              {label.label}
            </div>
          ))}
        </div>

        <div className="flex-1 border-l border-b border-neutral-200 pl-2">
          <div className="relative" style={{ height: `${height}px` }}>
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.05" />
                </linearGradient>
              </defs>

              <path
                d={`${pathD} L 100 100 L 0 100 Z`}
                fill={`url(#${gradientId})`}
              />

              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-sm"
              />

              {points.map((point, index) => (
                <g key={index}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={hoveredPoint === index ? "2.5" : "1.8"}
                    fill="white"
                    stroke={color}
                    strokeWidth="0.8"
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}
            </svg>

            {points.map((point, index) => (
              <div
                key={index}
                className="absolute"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: hoveredPoint === index ? 20 : 10
                }}
                onMouseEnter={() => setHoveredPoint(index)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {hoveredPoint === index && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-neutral-900 text-white text-xs rounded-lg whitespace-nowrap shadow-xl animate-in fade-in duration-200">
                    <div className="font-semibold">{point.label}</div>
                    <div className="text-xs opacity-90">{valueFormatter(point.value)}</div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="w-2 h-2 bg-neutral-900 rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="flex items-center justify-between text-xs text-neutral-600 min-w-max sm:min-w-0">
              {data.map((item, index) => {
                const showLabel = data.length <= 12 || index % Math.ceil(data.length / 12) === 0;

                return showLabel ? (
                  <div
                    key={index}
                    className="text-center px-1 flex-1"
                  >
                    <div className="truncate">{item.label}</div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
