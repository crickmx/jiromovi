import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, TrendingUp, Shield, FileText,
  AlertTriangle, Users, Target, BookOpen, FolderOpen,
  Activity, MessageCircle, Zap, Sparkles, Clock,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChavaAvatar } from './chava/ChavaAvatar';
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
  whatsapp: MessageCircle,
  email: FileText,
  marketing: Target,
  courses: BookOpen,
  documents: FolderOpen,
  cross_sell: TrendingUp,
  alerts: AlertTriangle,
  general: Activity,
};

const BULLET_SECTION_LABELS: Record<string, string> = {
  alerts: 'Alerta',
  production: 'Produccion',
  renewals: 'Renovacion',
  commissions: 'Comisiones',
  leads: 'Oportunidad',
  tasks: 'Accion sugerida',
  cross_sell: 'Oportunidad',
  contact_center: 'Contactos',
  general: 'Resumen',
  emissions: 'Emision',
  portfolio: 'Cartera',
  tickets: 'Tramite',
  whatsapp: 'WhatsApp',
  email: 'Correo',
  marketing: 'Marketing',
  courses: 'Capacitacion',
  documents: 'Documentos',
};

export function SmartAnalysisCard({ result, loading, onRefresh, userName }: Props) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTypingDot, setShowTypingDot] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const structured = result?.structured;
  const hasStructured = !!structured && structured.summary_bullets.length > 0;

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

  useEffect(() => {
    if (!hasStructured) return;
    setVisibleCount(0);
    setShowTypingDot(true);

    if (timerRef.current) clearInterval(timerRef.current);

    // Brief typing delay then reveal bullets one by one
    const startDelay = setTimeout(() => {
      setShowTypingDot(false);
      let idx = 0;
      timerRef.current = setInterval(() => {
        idx++;
        setVisibleCount(idx);
        if (idx >= sortedBullets.length) {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 150);
    }, 900);

    return () => {
      clearTimeout(startDelay);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [structured]);

  const PREVIEW_COUNT = 3;
  const visibleBullets = isExpanded ? sortedBullets : sortedBullets.slice(0, PREVIEW_COUNT);
  const hasMore = sortedBullets.length > PREVIEW_COUNT;

  const tone = structured?.tone ?? 'neutral';
  const toneGlow = {
    positive: 'from-emerald-500/8 via-transparent',
    neutral: 'from-cyan-500/8 via-transparent',
    attention: 'from-amber-500/8 via-transparent',
  }[tone];

  const updatedLabel = result?.updatedMinutesAgo !== undefined && result.updatedMinutesAgo >= 0
    ? result.updatedMinutesAgo < 1 ? 'Ahora mismo' : `Hace ${result.updatedMinutesAgo} min`
    : null;

  const subtitle = hasStructured
    ? structured!.title || 'Esto es lo que encontre'
    : 'Analizando tu actividad...';

  if (loading) {
    return <ChavaLoadingState />;
  }

  if (!result) return null;

  if (!hasStructured) {
    return <ChavaLegacyCard result={result} onRefresh={onRefresh} navigate={navigate} />;
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-white/8',
      'bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900',
      'shadow-xl shadow-black/30 transition-all duration-300'
    )}>
      {/* Background glow */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br pointer-events-none',
        toneGlow, 'to-transparent'
      )} />
      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
      />

      <div className="relative z-10 p-4 sm:p-5">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-4">
          <ChavaAvatar size="lg" animate={result.source === 'chatgpt'} online className="mt-0.5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">
                {userName ? `Hola ${userName.split(' ')[0]}` : 'Chava'}
              </span>
              {result.source === 'chatgpt' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/20 text-cyan-300">
                  <Sparkles className="w-2.5 h-2.5" />
                  IA en vivo
                </span>
              )}
              {result.source === 'cache' && (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                  <Zap className="w-2.5 h-2.5" />
                  Guardado
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white/90 leading-snug">{subtitle}</p>
            {updatedLabel && (
              <p className="text-[11px] text-white/30 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {updatedLabel}
              </p>
            )}
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl hover:bg-white/8 transition-all duration-200 group flex-shrink-0"
            title="Actualizar analisis"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white/25 group-hover:text-white/55 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        {/* ── Chat bubble area ── */}
        <div className="mb-4 space-y-2">

          {/* Typing indicator */}
          {showTypingDot && (
            <div className="flex items-end gap-2">
              <div className="bg-white/6 border border-white/10 rounded-2xl rounded-bl-sm px-3.5 py-2.5 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Bullet messages */}
          {visibleBullets.map((bullet, idx) => (
            <ChatBubble
              key={idx}
              bullet={bullet}
              visible={!showTypingDot && idx < visibleCount}
            />
          ))}

          {/* Empty state */}
          {!showTypingDot && !loading && sortedBullets.length === 0 && (
            <div className="flex items-end gap-2">
              <div className="bg-white/6 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%]">
                <p className="text-sm text-white/60 leading-relaxed">
                  Hoy todo parece estar en orden. No detecte alertas ni pendientes urgentes. Buen dia!
                </p>
              </div>
            </div>
          )}

          {/* Show more */}
          {hasMore && !isExpanded && !showTypingDot && visibleCount >= PREVIEW_COUNT && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-[12px] text-cyan-400/70 hover:text-cyan-400 transition-colors flex items-center gap-1 pl-1 mt-1"
            >
              <Bell className="w-3 h-3" />
              Ver {sortedBullets.length - PREVIEW_COUNT} mensaje{sortedBullets.length - PREVIEW_COUNT > 1 ? 's' : ''} mas
            </button>
          )}
        </div>

        {/* ── Action buttons ── */}
        {sortedActions.length > 0 && !showTypingDot && visibleCount > 0 && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-white/6">
            {sortedActions.slice(0, 4).map((action, idx) => (
              <ActionPill key={idx} action={action} onClick={() => navigate(action.target)} />
            ))}
            {/* Always: Talk to Chava */}
            <button
              onClick={() => navigate('/chava')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold',
                'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300',
                'hover:bg-cyan-500/30 hover:border-cyan-500/40 transition-all duration-200 hover:-translate-y-px active:translate-y-0'
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Hablar con Chava
            </button>
          </div>
        )}

        {/* Fallback CTA when no actions */}
        {sortedActions.length === 0 && !showTypingDot && (
          <div className="pt-3 border-t border-white/6">
            <button
              onClick={() => navigate('/chava')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold',
                'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300',
                'hover:bg-cyan-500/30 transition-all duration-200 hover:-translate-y-px'
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Hablar con Chava
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat bubble component ──
function ChatBubble({ bullet, visible }: { bullet: AnalysisBullet; visible: boolean }) {
  const Icon = BULLET_ICONS[bullet.type] || Activity;
  const sectionLabel = BULLET_SECTION_LABELS[bullet.type] || 'Nota';

  return (
    <div
      className={cn(
        'flex items-end gap-2 transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
    >
      <div className={cn(
        'rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[95%]',
        'bg-white/6 border border-white/8',
        bullet.priority === 'high' && 'bg-amber-500/8 border-amber-500/15',
        bullet.priority === 'medium' && 'bg-sky-500/5 border-sky-500/12',
      )}>
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={cn(
            'w-3 h-3 flex-shrink-0',
            bullet.priority === 'high' ? 'text-amber-400' :
            bullet.priority === 'medium' ? 'text-sky-400' : 'text-white/35'
          )} />
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            bullet.priority === 'high' ? 'text-amber-400' :
            bullet.priority === 'medium' ? 'text-sky-400' : 'text-white/35'
          )}>
            {sectionLabel}
          </span>
        </div>
        <p className={cn(
          'text-[13px] leading-relaxed',
          bullet.priority === 'high' ? 'text-white/85' :
          bullet.priority === 'medium' ? 'text-white/75' : 'text-white/55'
        )}>
          {bullet.text}
        </p>
      </div>
    </div>
  );
}

// ── Action pill component ──
function ActionPill({ action, onClick }: { action: AnalysisAction; onClick: () => void }) {
  const styles: Record<BulletPriority, string> = {
    high: 'bg-white/10 border-white/15 text-white/80 hover:bg-white/15',
    medium: 'bg-white/6 border-white/10 text-white/60 hover:bg-white/10',
    low: 'bg-white/4 border-white/8 text-white/40 hover:bg-white/8',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border',
        'transition-all duration-200 hover:-translate-y-px active:translate-y-0',
        styles[action.priority]
      )}
    >
      {action.label}
      <ChevronRight className="w-3 h-3" />
    </button>
  );
}

// ── Loading skeleton ──
function ChavaLoadingState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900 p-4 sm:p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/6 animate-pulse flex-shrink-0" />
          <div className="flex-1 pt-1">
            <div className="h-3 bg-cyan-500/20 rounded w-12 mb-2 animate-pulse" />
            <div className="h-4 bg-white/8 rounded w-48 animate-pulse mb-1" />
            <div className="h-2.5 bg-white/5 rounded w-24 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2.5">
          {[90, 75, 85].map((w, i) => (
            <div key={i} className="bg-white/5 border border-white/6 rounded-2xl rounded-bl-sm px-3.5 py-2.5" style={{ width: `${w}%` }}>
              <div className="h-2 bg-white/8 rounded w-16 mb-2 animate-pulse" />
              <div className="h-3 bg-white/6 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-white/6 flex gap-2">
          <div className="h-7 bg-white/5 rounded-xl w-24 animate-pulse" />
          <div className="h-7 bg-white/5 rounded-xl w-28 animate-pulse" />
          <div className="h-7 bg-cyan-500/10 rounded-xl w-36 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Legacy text format fallback ──
function ChavaLegacyCard({
  result,
  onRefresh,
  navigate,
}: {
  result: SmartAnalysisResult;
  onRefresh: () => void;
  navigate: (path: string) => void;
}) {
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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-neutral-900 via-neutral-850 to-neutral-900 shadow-xl shadow-black/30">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/6 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <ChavaAvatar size="lg" animate={result.source === 'chatgpt'} online className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">Chava</span>
            <p className="text-sm font-semibold text-white/90 mt-0.5">Revise tu operacion</p>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl hover:bg-white/8 transition-all duration-200 group flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white/25 group-hover:text-white/55 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-sm px-4 py-3 mb-4">
          <p className="text-[13px] sm:text-sm leading-relaxed text-white/70 whitespace-pre-line min-h-[60px]">
            {displayedText}
            {isTyping && <span className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle bg-cyan-400" />}
          </p>
        </div>

        <div className="pt-3 border-t border-white/6">
          <button
            onClick={() => navigate('/chava')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-all duration-200 hover:-translate-y-px"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Hablar con Chava
          </button>
        </div>
      </div>
    </div>
  );
}
