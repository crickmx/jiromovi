import { useState, useEffect } from 'react';
import { Brain, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartAnalysisResult } from '../lib/dashboardWelcomeService';

interface Props {
  result: SmartAnalysisResult | null;
  loading: boolean;
  onRefresh: () => void;
  userName?: string;
}


export function SmartAnalysisCard({ result, loading, onRefresh }: Props) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!result || hasAnimated) {
      if (result) setDisplayedText(result.analysis.message);
      return;
    }

    const text = result.analysis.message;
    setIsTyping(true);
    setDisplayedText('');

    let i = 0;
    const speed = Math.max(8, Math.min(20, 2000 / text.length));
    const timer = setInterval(() => {
      i += 2;
      if (i >= text.length) {
        setDisplayedText(text);
        setIsTyping(false);
        setHasAnimated(true);
        clearInterval(timer);
      } else {
        setDisplayedText(text.slice(0, i));
      }
    }, speed);

    return () => clearInterval(timer);
  }, [result]);

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 p-5 border border-neutral-700/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping opacity-75" />
            </div>
            <div>
              <div className="h-3 bg-white/10 rounded w-32 animate-pulse" />
              <div className="h-2 bg-white/5 rounded w-20 animate-pulse mt-1.5" />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="h-3 bg-white/8 rounded-lg w-full animate-pulse" />
            <div className="h-3 bg-white/6 rounded-lg w-11/12 animate-pulse" />
            <div className="h-3 bg-white/4 rounded-lg w-4/5 animate-pulse" />
            <div className="h-3 bg-white/3 rounded-lg w-2/3 animate-pulse" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-5 bg-white/5 rounded-full w-14 animate-pulse" />
            <div className="h-5 bg-white/5 rounded-full w-16 animate-pulse" />
            <div className="h-5 bg-white/5 rounded-full w-12 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { analysis, source } = result;

  const toneAccent = {
    positive: { accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10', pulse: 'bg-emerald-400' },
    neutral: { accent: 'text-sky-400', accentBg: 'bg-sky-500/10', pulse: 'bg-sky-400' },
    attention: { accent: 'text-amber-400', accentBg: 'bg-amber-500/10', pulse: 'bg-amber-400' },
  };

  const tone = toneAccent[analysis.tone] || toneAccent.neutral;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-700/30 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 transition-all duration-300">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', tone.accentBg)}>
                <Brain className={cn('w-[18px] h-[18px]', tone.accent)} />
              </div>
              {source === 'chatgpt' && (
                <div className={cn('absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full', tone.pulse)}>
                  <div className={cn('absolute inset-0 rounded-full animate-ping opacity-50', tone.pulse)} />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90 tracking-tight">
                Analisis Personalizado
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {source === 'chatgpt' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider bg-sky-500/15 text-sky-300 border-sky-500/20">
                    <Sparkles className="w-2.5 h-2.5" />
                    Generado con IA
                  </span>
                )}
                {source === 'cache' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/30 px-1.5 py-0.5">
                    <Zap className="w-2.5 h-2.5" />
                    Actualizado
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl hover:bg-white/5 transition-all duration-200 group flex-shrink-0"
            title="Regenerar analisis"
          >
            <RefreshCw className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        {/* Message body */}
        <div className="relative">
          <p className="text-[13px] sm:text-sm leading-relaxed text-white/70 whitespace-pre-line min-h-[60px]">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle bg-sky-400" />
            )}
          </p>
        </div>

      </div>
    </div>
  );
}
