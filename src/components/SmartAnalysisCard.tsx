import { Brain, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-neutral-200/60 dark:bg-white/10 animate-pulse" />
          <div className="h-3.5 bg-neutral-200/60 dark:bg-white/10 rounded w-36 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-neutral-200/60 dark:bg-white/10 rounded w-full animate-pulse" />
          <div className="h-3 bg-neutral-200/60 dark:bg-white/10 rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-neutral-200/60 dark:bg-white/10 rounded w-2/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { analysis, source } = result;

  const toneConfig = {
    positive: {
      bg: 'bg-emerald-50/70 dark:bg-emerald-500/8',
      border: 'border-emerald-200/60 dark:border-emerald-500/15',
      iconBg: 'bg-emerald-100 dark:bg-emerald-500/15',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    },
    neutral: {
      bg: 'bg-neutral-50/70 dark:bg-white/5',
      border: 'border-neutral-200/60 dark:border-white/8',
      iconBg: 'bg-accent/8 dark:bg-accent/15',
      iconColor: 'text-accent',
      badge: 'bg-accent/10 text-accent dark:bg-accent/20',
    },
    attention: {
      bg: 'bg-amber-50/70 dark:bg-amber-500/8',
      border: 'border-amber-200/60 dark:border-amber-500/15',
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    },
  };

  const tone = toneConfig[analysis.tone] || toneConfig.neutral;

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all duration-200',
      tone.bg, tone.border
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', tone.iconBg)}>
            <Brain className={cn('w-4 h-4', tone.iconColor)} />
          </div>
          <span className="text-xs font-semibold text-neutral-500 dark:text-white/50 uppercase tracking-wider">
            Analisis personalizado
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {source === 'chatgpt' && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
              tone.badge
            )}>
              <Sparkles className="w-2.5 h-2.5" />
              IA
            </span>
          )}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
            title="Actualizar analisis"
          >
            <RefreshCw className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-white/60 transition-colors" />
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-700 dark:text-white/70 leading-relaxed whitespace-pre-line">
        {analysis.message}
      </p>
    </div>
  );
}
