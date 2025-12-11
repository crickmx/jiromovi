import { useMemo, useState, useEffect, useRef } from 'react';

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
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const isMobile = containerWidth < 640;
  const isTablet = containerWidth < 1024;

  const formatLabel = (label: string) => {
    if (label.includes('-')) {
      const [year, month] = label.split('-');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthName = months[parseInt(month) - 1];
      const shortYear = year.substring(2);

      if (isMobile) return monthName || label;
      if (isTablet) return `${monthName} '${shortYear}`;
      return `${monthName} ${year}`;
    }

    if (isMobile && label.length > 6) {
      return label.substring(0, 6);
    }

    return label;
  };

  const formatYAxisLabel = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${Math.round(value / 1000)}K`;
    }
    return `$${Math.round(value)}`;
  };

  const { maxValue, minValue, points, pathD, yAxisLabels, smoothPath } = useMemo(() => {
    if (data.length === 0) {
      return { maxValue: 0, minValue: 0, points: [], pathD: '', smoothPath: '', yAxisLabels: [] };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);

    const padding = (max - min) * 0.15 || max * 0.15 || 10;
    const chartMax = max + padding;
    const chartMin = Math.max(0, min - padding);
    const range = chartMax - chartMin || 1;

    const width = 100;
    const chartHeight = 100;
    const margin = 2;
    const effectiveHeight = chartHeight - margin * 2;
    const xStep = data.length > 1 ? width / (data.length - 1) : width / 2;

    const chartPoints = data.map((item, index) => {
      const x = index * xStep;
      const normalizedValue = ((item.value - chartMin) / range);
      const y = margin + effectiveHeight - (normalizedValue * effectiveHeight);

      return { x, y, value: item.value, label: item.label };
    });

    const linePath = chartPoints.map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `L ${point.x} ${point.y}`;
    }).join(' ');

    const createSmoothPath = (points: typeof chartPoints) => {
      if (points.length < 2) return linePath;

      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = (current.x + next.x) / 2;

        path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
        path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
      }

      return path;
    };

    const steps = isMobile ? 4 : 5;
    const stepValue = (chartMax - chartMin) / steps;
    const axisLabels = Array.from({ length: steps + 1 }, (_, i) => {
      const value = chartMin + stepValue * (steps - i);
      return { value, label: formatYAxisLabel(value) };
    });

    return {
      maxValue: chartMax,
      minValue: chartMin,
      points: chartPoints,
      pathD: linePath,
      smoothPath: createSmoothPath(chartPoints),
      yAxisLabels: axisLabels
    };
  }, [data, isMobile, containerWidth]);

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
  const chartHeight = isMobile ? Math.min(height * 0.8, 200) : height;
  const yAxisWidth = isMobile ? 45 : 60;

  return (
    <div ref={containerRef} className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-6 overflow-hidden">
      <h3 className="text-sm sm:text-base md:text-lg font-bold text-neutral-900 mb-3 sm:mb-4 md:mb-6 truncate">
        {title}
      </h3>

      <div className="flex gap-2 sm:gap-3 overflow-hidden">
        <div
          className="flex flex-col justify-between flex-shrink-0"
          style={{ height: `${chartHeight}px`, width: `${yAxisWidth}px` }}
        >
          {yAxisLabels.map((label, index) => (
            <div
              key={index}
              className="text-[10px] sm:text-xs text-neutral-600 font-medium text-right pr-1.5 sm:pr-2 whitespace-nowrap leading-tight"
              style={{
                marginTop: index === 0 ? '0' : '-0.5rem',
              }}
            >
              {label.label}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="border-l border-b border-neutral-200 pl-2 sm:pl-3 pb-3 overflow-hidden">
            <div className="relative overflow-hidden" style={{ height: `${chartHeight}px` }}>
              <svg
                viewBox="0 0 100 104"
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
                style={{ display: 'block' }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                <path
                  d={`${smoothPath} L ${points[points.length - 1].x} 102 L 0 102 Z`}
                  fill={`url(#${gradientId})`}
                />

                <path
                  d={smoothPath}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-sm"
                  style={{ vectorEffect: 'non-scaling-stroke' }}
                />

                {points.map((point, index) => (
                  <g key={index}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={hoveredPoint === index ? "2.5" : "1.8"}
                      fill="white"
                      stroke={color}
                      strokeWidth="1.2"
                      className="cursor-pointer transition-all duration-200 hover:r-3"
                      style={{ vectorEffect: 'non-scaling-stroke' }}
                      onMouseEnter={() => setHoveredPoint(index)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onTouchStart={() => setHoveredPoint(index)}
                    />
                  </g>
                ))}
              </svg>

              {points.map((point, index) => (
                <div
                  key={`tooltip-${index}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${point.x}%`,
                    top: `${(point.y / 104) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: hoveredPoint === index ? 30 : 10
                  }}
                >
                  {hoveredPoint === index && (
                    <div
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-2.5 py-2 bg-neutral-900 text-white text-xs rounded-lg whitespace-nowrap shadow-xl pointer-events-none"
                      style={{
                        animation: 'fadeIn 0.2s ease-out',
                        maxWidth: '200px'
                      }}
                    >
                      <div className="font-semibold text-[11px] sm:text-xs">{point.label}</div>
                      <div className="text-[10px] sm:text-xs opacity-90 mt-0.5">
                        {valueFormatter(point.value)}
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-[3px]">
                        <div className="w-1.5 h-1.5 bg-neutral-900 rotate-45"></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 sm:mt-3 overflow-hidden">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-neutral-600 font-medium gap-0.5 sm:gap-1">
                {data.map((item, index) => {
                  let labelsToShow = 8;
                  if (isMobile) labelsToShow = 4;
                  else if (isTablet) labelsToShow = 6;

                  const step = Math.ceil(data.length / labelsToShow);
                  const showLabel = data.length <= labelsToShow || index % step === 0 || index === data.length - 1;

                  return (
                    <div
                      key={index}
                      className={`text-center flex-1 min-w-0 ${showLabel ? '' : 'opacity-0'}`}
                      style={{ maxWidth: `${100 / data.length}%` }}
                    >
                      {showLabel && (
                        <div className="truncate px-0.5" title={item.label}>
                          {formatLabel(item.label)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
