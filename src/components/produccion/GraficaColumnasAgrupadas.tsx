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
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="text-lg font-bold text-neutral-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-neutral-500">
          No hay datos para mostrar
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
        <div className="flex items-center space-x-4 text-sm">
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

      <div className="flex items-end justify-between gap-4" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const percentage1 = (item.value1 / maxValue) * 100;
          const percentage2 = (item.value2 / maxValue) * 100;

          return (
            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="relative w-full flex gap-1 items-end justify-center h-full">
                <div className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative"
                    style={{
                      height: `${percentage1}%`,
                      minHeight: '4px',
                      backgroundColor: series1Color
                    }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {series1Label}: {valueFormatter(item.value1)}
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-end h-full group">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative"
                    style={{
                      height: `${percentage2}%`,
                      minHeight: '4px',
                      backgroundColor: series2Color
                    }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {series2Label}: {valueFormatter(item.value2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-neutral-600 font-medium text-center max-w-full truncate px-1">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
