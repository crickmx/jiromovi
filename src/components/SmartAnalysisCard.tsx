import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, RefreshCw, Sparkles, Zap, Clock,
  TrendingUp, Shield, FileText, AlertTriangle,
  Users, Target, BookOpen, FolderOpen,
  ChevronRight, MoreHorizontal, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmartAnalysisResult, AnalysisBullet, AnalysisAction, BulletPriority } from '../lib/dashboardWelcomeService';

interface Props {
  result: SmartAnalysisResult | null;
  loading: boolean;
  onRefresh: () => void;
  userName?: string;
}

const BULLET_ICONS: Record<string, React.ElementType> = {
  production: TrendingUp,
  renewals: Shield,
  emissions: FileText,
  portfolio: FolderOpen,
  tickets: FileText,
  commissions: Activity,
  leads: Users,
  tasks: Target,
  contact_center: Users,
  whatsapp: Users,
  email: FileText,
  marketing: Target,
  courses: BookOpen,
  documents: FolderOpen,
  cross_sell: TrendingUp,
  alerts: AlertTriangle,
  general: Activity,
};

const PRIORITY_STYLES: Record<BulletPriority, { dot: string; text: string }> = {
  high: { dot: 'bg-amber-400', text: 'text-white/85' },
  medium: { dot: 'bg-sky-400', text: 'text-white/75' },
  low: { dot: 'bg-white/30', text: 'text-white/60' },
};

export function SmartAnalysisCard({ result, loading, onRefresh }: Props) {
  const navigate = useNavigate();
  const [showAllActions, setShowAllActions] = useState(false);
  const [animatedBullets, setAnimatedBullets] = useState<number>(0);

  const structured = result?.structured;
  const hasStructured = !!structured && structured.summary_bullets.length > 0;

  useEffect(() => {
    if (!hasStructured) return;
    setAnimatedBullets(0);
    const bullets = structured!.summary_bullets;
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      setAnimatedBullets(idx);
      if (idx >= bullets.length) clearInterval(timer);
    }, 120);
    return () => clearInterval(timer);
  }, [structured]);

  const sortedBullets = useMemo(() => {
    if (!structured) return [];
    const order: Record<BulletPriority, number> = { high: 0, medium: 1, low: 2 };
    return [...structured.summary_bullets].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [structured]);

  const sortedActions = useMemo(() => {
    if (!structured) return [];
    const order: Record<BulletPriority, number> = { high: 0, medium: 1, low: 2 };
    return [...structured.actions].sort((a, b) => order[a.priority] - order[b.priority]);
  }, [structured]);

  const visibleActions = showAllActions ? sortedActions : sortedActions.slice(0, 4);
  const mobileVisibleActions = showAllActions ? sortedActions : sortedActions.slice(0, 2);
  const hasMoreActions = sortedActions.length > 4;
  const hasMobileMore = sortedActions.length > 2;

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 p-5 border border-neutral-700/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
                <Brain className="w-[18px] h-[18px] text-sky-400 animate-pulse" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping opacity-75" />
            </div>
            <div>
              <div className="h-3.5 bg-white/10 rounded w-40 animate-pulse" />
              <div className="h-2.5 bg-white/5 rounded w-28 animate-pulse mt-1.5" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 bg-white/8 rounded-lg flex-1 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 bg-white/6 rounded-lg w-11/12 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 bg-white/5 rounded-lg w-4/5 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
              <div className="h-3 bg-white/4 rounded-lg w-3/4 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-7 bg-white/5 rounded-lg w-24 animate-pulse" />
            <div className="h-7 bg-white/5 rounded-lg w-20 animate-pulse" />
            <div className="h-7 bg-white/5 rounded-lg w-28 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // Fallback: legacy plain text rendering
  if (!hasStructured) {
    return <LegacyAnalysisCard result={result} onRefresh={onRefresh} />;
  }

  const toneAccent = {
    positive: { accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: 'bg-emerald-400' },
    neutral: { accent: 'text-sky-400', accentBg: 'bg-sky-500/10', border: 'border-sky-500/20', pulse: 'bg-sky-400' },
    attention: { accent: 'text-amber-400', accentBg: 'bg-amber-500/10', border: 'border-amber-500/20', pulse: 'bg-amber-400' },
  };

  const tone = toneAccent[structured.tone] || toneAccent.neutral;

  const sourceLabel = structured.source;
  const updatedLabel = result.updatedMinutesAgo !== undefined && result.updatedMinutesAgo >= 0
    ? result.updatedMinutesAgo < 1
      ? 'Ahora'
      : `Hace ${result.updatedMinutesAgo} min`
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-700/30 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 transition-all duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%23fff\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }}
      />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', tone.accentBg)}>
                <Brain className={cn('w-[18px] h-[18px]', tone.accent)} />
              </div>
              {result.source === 'chatgpt' && (
                <div className={cn('absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full', tone.pulse)}>
                  <div className={cn('absolute inset-0 rounded-full animate-ping opacity-50', tone.pulse)} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white/90 tracking-tight truncate">
                {structured.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider',
                  result.source === 'chatgpt'
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/20'
                    : 'bg-white/5 text-white/40 border-white/10'
                )}>
                  {result.source === 'chatgpt' && <Sparkles className="w-2.5 h-2.5" />}
                  {result.source === 'cache' && <Zap className="w-2.5 h-2.5" />}
                  {sourceLabel}
                </span>
                {updatedLabel && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                    <Clock className="w-2.5 h-2.5" />
                    {updatedLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl hover:bg-white/5 transition-all duration-200 group flex-shrink-0"
            title="Actualizar analisis"
          >
            <RefreshCw className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        {/* Bullets */}
        <div className="space-y-2.5 mb-4">
          {sortedBullets.map((bullet, idx) => (
            <BulletItem
              key={idx}
              bullet={bullet}
              visible={idx < animatedBullets}
            />
          ))}
        </div>

        {/* Actions - Desktop */}
        {sortedActions.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            {visibleActions.map((action, idx) => (
              <ActionButton
                key={idx}
                action={action}
                onClick={() => navigate(action.target)}
              />
            ))}
            {hasMoreActions && !showAllActions && (
              <button
                onClick={() => setShowAllActions(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Mas
              </button>
            )}
          </div>
        )}

        {/* Actions - Mobile */}
        {sortedActions.length > 0 && (
          <div className="flex sm:hidden items-center gap-2 flex-wrap">
            {mobileVisibleActions.map((action, idx) => (
              <ActionButton
                key={idx}
                action={action}
                onClick={() => navigate(action.target)}
              />
            ))}
            {hasMobileMore && !showAllActions && (
              <button
                onClick={() => setShowAllActions(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
                Mas acciones
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BulletItem({ bullet, visible }: { bullet: AnalysisBullet; visible: boolean }) {
  const Icon = BULLET_ICONS[bullet.type] || Activity;
  const priority = PRIORITY_STYLES[bullet.priority];

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', priority.dot)} />
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', priority.text)} />
        <p className={cn('text-[13px] sm:text-sm leading-relaxed', priority.text)}>
          {bullet.text}
        </p>
      </div>
    </div>
  );
}

function ActionButton({ action, onClick }: { action: AnalysisAction; onClick: () => void }) {
  const priorityStyles: Record<BulletPriority, string> = {
    high: 'bg-white/10 text-white/80 hover:bg-white/15 border-white/10',
    medium: 'bg-white/5 text-white/60 hover:bg-white/10 border-white/8',
    low: 'bg-white/3 text-white/40 hover:bg-white/8 border-white/5',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 hover:-translate-y-px active:translate-y-0',
        priorityStyles[action.priority]
      )}
    >
      {action.label}
      <ChevronRight className="w-3 h-3" />
    </button>
  );
}

function LegacyAnalysisCard({ result, onRefresh }: { result: SmartAnalysisResult; onRefresh: () => void }) {
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

  const { analysis, source } = result;

  const toneAccent = {
    positive: { accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10', pulse: 'bg-emerald-400' },
    neutral: { accent: 'text-sky-400', accentBg: 'bg-sky-500/10', pulse: 'bg-sky-400' },
    attention: { accent: 'text-amber-400', accentBg: 'bg-amber-500/10', pulse: 'bg-amber-400' },
  };

  const tone = toneAccent[analysis.tone] || toneAccent.neutral;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-700/30 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 transition-all duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 p-5">
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
              <h3 className="text-sm font-semibold text-white/90 tracking-tight">Analisis Personalizado</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {source === 'chatgpt' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider bg-sky-500/15 text-sky-300 border-sky-500/20">
                    <Sparkles className="w-2.5 h-2.5" />
                    IA
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
        <p className="text-[13px] sm:text-sm leading-relaxed text-white/70 whitespace-pre-line min-h-[60px]">
          {displayedText}
          {isTyping && <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle bg-sky-400" />}
        </p>
      </div>
    </div>
  );
}
