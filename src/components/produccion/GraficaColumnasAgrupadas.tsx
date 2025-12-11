import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value1: number;
  value2: number;
}

interface GraficaColumnasAgrupadasProps {
  data: DataPoint[];
  title: string;
  series1Label: string;
  series2Label: string;
  series1Color?: string;
  series2Color?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

export default function GraficaColumnasAgrupadas({
  data,
  title,
  series1Label,
  series2Label,
  series1Color = '#3b82f6',
  series2Color = '#9ca3af',
  valueFormatter = (v) => v.toLocaleString(),
  height = 300
}: GraficaColumnasAgrupadasProps) {
  const maxValue = useMemo(() => {
    const allValues = data.flatMap(d => [d.value1, d.value2]);
    return Math.max(...allValues);
  }, [data]);

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

  const isLargeDataset = data.length > 6;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-bold text-neutral-900">{title}</h3>
        <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: series1Color }}></div>
            <span className="text-neutral-600">{series1Label}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: series2Color }}></div>
            <span className="text-neutral-600">{series2Label}</span>
          </div>
        </div>
      </div>

      <div className={`overflow-x-auto ${isLargeDataset ? 'pb-4' : ''}`}>
        <div
          className="flex items-end justify-between gap-3 sm:gap-4"
          style={{
            height: `${height}px`,
            minWidth: isLargeDataset ? `${data.length * 100}px` : '100%'
          }}
        >
          {data.map((item, index) => {
            const percentage1 = (item.value1 / maxValue) * 100;
            const percentage2 = (item.value2 / maxValue) * 100;

            return (
              <div
                key={index}
                className={`flex flex-col items-center justify-end h-full ${isLargeDataset ? 'min-w-[80px]' : 'flex-1'}`}
              >
                <div className="relative w-full flex gap-1 items-end justify-center h-full">
                  <div className="flex-1 flex flex-col items-center justify-end h-full group">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 hover:scale-105 relative cursor-pointer"
                      style={{
                        height: `${percentage1}%`,
                        minHeight: '8px',
                        backgroundColor: series1Color
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <div className="font-medium">{series1Label}</div>
                        <div className="text-xs">{valueFormatter(item.value1)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-end h-full group">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 hover:scale-105 relative cursor-pointer"
                      style={{
                        height: `${percentage2}%`,
                        minHeight: '8px',
                        backgroundColor: series2Color
                      }}
                    >
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <div className="font-medium">{series2Label}</div>
                        <div className="text-xs">{valueFormatter(item.value2)}</div>
                      </div>
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

      {isLargeDataset && (
        <div className="mt-2 text-xs text-neutral-500 text-center">
          Desliza horizontalmente para ver todos los datos
        </div>
      )}
    </div>
  );
}
