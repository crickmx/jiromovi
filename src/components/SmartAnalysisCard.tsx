import { Brain, RefreshCw } from 'lucide-react';
import type { SmartAnalysisResult } from '../lib/dashboardWelcomeService';

interface Props {
  result: SmartAnalysisResult | null;
  loading: boolean;
  onRefresh: () => void;
  userName?: string;
}

export function SmartAnalysisCard({ result, loading, onRefresh }: Props) {
  if (loading) {
    return (
      <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-blue-500 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-48" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-5/6" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { analysis, source } = result;

  const toneStyles = {
    positive: {
      card: 'from-emerald-50 to-teal-50 border-emerald-200',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    neutral: {
      card: 'from-slate-50 to-blue-50 border-slate-200',
      icon: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
    },
    attention: {
      card: 'from-amber-50 to-orange-50 border-amber-200',
      icon: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700',
    },
  };
  const styles = toneStyles[analysis.tone] || toneStyles.neutral;

  return (
    <div className={`p-4 bg-gradient-to-br ${styles.card} rounded-xl border transition-all duration-300`}>
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Brain className={`w-4 h-4 ${styles.icon} flex-shrink-0`} />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Analisis personalizado
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {source === 'chatgpt' && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${styles.badge}`}>IA</span>
          )}
          <button
            onClick={onRefresh}
            className="p-1 hover:bg-white/60 rounded-md transition-colors"
            title="Actualizar analisis"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {analysis.message}
      </p>
    </div>
  );
}
