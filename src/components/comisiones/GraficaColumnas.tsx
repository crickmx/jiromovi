import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface GraficaColumnasProps {
  data: DataPoint[];
  title: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

export default function GraficaColumnas({
  data,
  title,
  valueFormatter = (v) => v.toLocaleString(),
  height = 300
}: GraficaColumnasProps) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);

  const yAxisLabels = useMemo(() => {
    const steps = 5;
    const stepValue = maxValue / steps;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const value = stepValue * (steps - i);
      return {
        value,
        label: valueFormatter(value)
      };
    });
  }, [maxValue, valueFormatter]);

  const colors = [
    'bg-accent',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-sky-500'
  ];

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

  const isLargeDataset = data.length > 8;

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

        <div className={`flex-1 ${isLargeDataset ? 'overflow-x-auto pb-4' : ''}`}>
          <div
            className="flex items-end justify-between gap-2 sm:gap-3 border-l border-b border-neutral-200 pl-2"
            style={{
              height: `${height}px`,
              minWidth: isLargeDataset ? `${data.length * 60}px` : '100%'
            }}
          >
            {data.map((item, index) => {
              const percentage = (item.value / maxValue) * 100;
              const colorClass = item.color || colors[index % colors.length];

              return (
                <div
                  key={index}
                  className={`flex flex-col items-center justify-end h-full ${isLargeDataset ? 'min-w-[50px]' : 'flex-1'}`}
                >
                  <div className="relative w-full flex flex-col items-center justify-end h-full">
                    <div
                      className={`w-full ${colorClass} rounded-t-lg transition-all duration-500 hover:opacity-80 hover:scale-105 relative group cursor-pointer`}
                      style={{ height: `${percentage}%`, minHeight: '8px' }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs">{valueFormatter(item.value)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-3 text-xs text-neutral-600 font-medium text-center max-w-full truncate px-1">
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isLargeDataset && (
        <div className="mt-2 text-xs text-neutral-500 text-center">
          Desliza horizontalmente para ver todos los datos
        </div>
      )}
    </div>
  );
}
