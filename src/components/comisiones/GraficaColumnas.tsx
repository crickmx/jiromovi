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

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500'
  ];

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-lg font-bold text-neutral-900 mb-6">{title}</h3>

      <div className="flex items-end justify-between gap-3" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const colorClass = item.color || colors[index % colors.length];

          return (
            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="relative w-full flex flex-col items-center justify-end h-full">
                <div className="absolute -top-8 text-sm font-semibold text-neutral-900 whitespace-nowrap">
                  {valueFormatter(item.value)}
                </div>

                <div
                  className={`w-full ${colorClass} rounded-t-lg transition-all duration-500 hover:opacity-80 relative group`}
                  style={{ height: `${percentage}%`, minHeight: '4px' }}
                >
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {valueFormatter(item.value)}
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
