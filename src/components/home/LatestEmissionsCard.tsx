import { FileText, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Emission {
  id: string;
  id_docto: string;
  poliza: string;
  cliente: string;
  compania: string;
  ramo: string;
  prima_neta: number;
  fecha_captura: string;
  status_texto: string;
}

interface Props {
  data: Emission[] | null;
  loading: boolean;
  onViewMore?: () => void;
  onClickItem?: (item: Emission) => void;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function formatPrima(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

const ramoColors: Record<string, string> = {
  'Vehiculos': 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400',
  'Daños': 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Vida': 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Accidentes y Enfermedades': 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

export function LatestEmissionsCard({ data, loading, onViewMore, onClickItem }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-white/8" />
          <div className="h-4 w-36 bg-neutral-100 dark:bg-white/8 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-neutral-100 dark:bg-white/8 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const emissions = data || [];

  return (
    <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/15">
            <FileText className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Ultimas Emisiones</h3>
            <p className="text-[11px] text-neutral-400 dark:text-white/30">Documentos recientes</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-2">
        {emissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="w-8 h-8 text-neutral-200 dark:text-white/15 mb-2" />
            <p className="text-sm text-neutral-400 dark:text-white/30">Sin emisiones recientes</p>
          </div>
        ) : (
          emissions.map((emission) => {
            const ramoColor = ramoColors[emission.ramo] || 'bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/50';
            return (
              <button
                key={emission.id}
                onClick={() => onClickItem?.(emission)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-150 text-left group"
              >
                {/* Ramo badge */}
                <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold", ramoColor)}>
                  {emission.ramo === 'Vehiculos' ? 'AU' : emission.ramo === 'Daños' ? 'DA' : emission.ramo === 'Vida' ? 'VI' : 'AE'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                    {emission.cliente}
                  </p>
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 truncate mt-0.5">
                    {emission.poliza} - {emission.compania.split(' ')[0]}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-bold text-neutral-900 dark:text-white">
                    {formatPrima(emission.prima_neta)}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-white/25 mt-0.5">
                    {formatRelativeDate(emission.fecha_captura)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {onViewMore && (
        <button
          onClick={onViewMore}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/8 text-xs font-semibold text-neutral-600 dark:text-white/50 transition-colors group"
        >
          Ver todos los documentos
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
