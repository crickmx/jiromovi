import { CalendarClock, AlertTriangle, Clock, ChevronRight, DollarSign } from 'lucide-react';

interface RenewalDoc {
  idDocto: number | string;
  documento: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  fechaHasta: string;
  primaTotal: number;
  status: string;
}

interface Props {
  renewals: RenewalDoc[];
  loading: boolean;
  kpis: { renovaciones7dias: number; renovaciones15dias: number; renovaciones30dias: number; primaRenovar: number } | null;
  onDocumentClick?: (idDocto: string | number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): string {
  if (days <= 3) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800';
  if (days <= 7) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800';
  if (days <= 15) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
}

function urgencyBg(days: number): string {
  if (days <= 3) return 'border-l-red-500';
  if (days <= 7) return 'border-l-orange-500';
  if (days <= 15) return 'border-l-amber-500';
  return 'border-l-blue-500';
}

export default function SicasRenovacionesPanel({ renewals, loading, kpis, onDocumentClick }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="w-5 h-5 text-amber-600" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Proximas Renovaciones</h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-16 bg-gray-100 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header with urgency summary */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Proximas Renovaciones</h3>
          </div>
          {kpis && (
            <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              {formatCurrency(kpis.primaRenovar)} por renovar
            </div>
          )}
        </div>

        {kpis && (
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg px-3 py-2 text-center border ${kpis.renovaciones7dias > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}>
              <p className={`text-lg font-bold ${kpis.renovaciones7dias > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-500'}`}>{kpis.renovaciones7dias}</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">7 dias</p>
            </div>
            <div className={`rounded-lg px-3 py-2 text-center border ${kpis.renovaciones15dias > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}>
              <p className={`text-lg font-bold ${kpis.renovaciones15dias > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'}`}>{kpis.renovaciones15dias}</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">15 dias</p>
            </div>
            <div className={`rounded-lg px-3 py-2 text-center border ${kpis.renovaciones30dias > 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}>
              <p className={`text-lg font-bold ${kpis.renovaciones30dias > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}>{kpis.renovaciones30dias}</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">30 dias</p>
            </div>
          </div>
        )}
      </div>

      {/* Renewals list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
        {renewals.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay renovaciones proximas</p>
          </div>
        ) : (
          renewals.map(doc => {
            const days = daysUntil(doc.fechaHasta);
            return (
              <button
                key={String(doc.idDocto)}
                onClick={() => onDocumentClick?.(doc.idDocto)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-l-4 ${urgencyBg(days)} group`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.documento || '-'}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded border ${urgencyColor(days)}`}>
                        {days <= 0 ? 'VENCIDO' : days === 1 ? '1 dia' : `${days} dias`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{doc.cliente}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{doc.aseguradora}</span>
                      <span className="text-[10px] text-gray-300">|</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{doc.ramo}</span>
                      <span className="text-[10px] text-gray-300">|</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">Vence {formatDate(doc.fechaHasta)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(doc.primaTotal)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {renewals.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
            {renewals.length} documentos por renovar en los proximos 30 dias
          </p>
        </div>
      )}
    </div>
  );
}
