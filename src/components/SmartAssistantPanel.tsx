import { Brain, Bot, Zap, X, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';

export interface SmartSuggestion {
  label: string;
  assistant_id?: string;
  form_slug?: string;
  action?: string;
}

export interface SmartAssistantState {
  smart_assistant_enabled: boolean;
  smart_assistant_status: 'active' | 'inactive' | 'paused' | 'awaiting_confirmation' | 'agent_active';
  last_detected_intent?: string | null;
  last_detected_confidence?: number | null;
  pending_suggestion?: SmartSuggestion[] | null;
  pause_reason?: string | null;
}

interface Props {
  state: SmartAssistantState;
  onAccept: (suggestion: SmartSuggestion) => void;
  onDismiss: () => void;
  onResume?: () => void;
  loading?: boolean;
}

const INTENT_LABELS: Record<string, string> = {
  cotizacion_auto: 'Seguro de Auto',
  gmm_individual: 'GMM / Gastos Medicos',
  hogar: 'Seguro de Hogar',
  empresarial: 'Seguro Empresarial',
  transporte_carga: 'Transporte y Carga',
  rc_general: 'Responsabilidad Civil',
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? 'bg-emerald-500' : value >= 0.55 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono font-semibold text-gray-600 dark:text-gray-400 w-7 text-right">{pct}%</span>
    </div>
  );
}

export default function SmartAssistantPanel({ state, onAccept, onDismiss, onResume, loading }: Props) {
  const { smart_assistant_status, last_detected_intent, last_detected_confidence, pending_suggestion, pause_reason } = state;

  if (smart_assistant_status === 'paused') {
    return (
      <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Asistente pausado</p>
            {pause_reason && <p className="text-[11px] text-amber-600/80 dark:text-amber-500/70 truncate">{pause_reason}</p>}
          </div>
        </div>
        {onResume && (
          <button
            onClick={onResume}
            disabled={loading}
            className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
          >
            Reactivar
          </button>
        )}
      </div>
    );
  }

  if (smart_assistant_status !== 'awaiting_confirmation') return null;

  const suggestions = pending_suggestion || [];
  const intent = last_detected_intent ? (INTENT_LABELS[last_detected_intent] || last_detected_intent) : null;
  const confidence = last_detected_confidence ?? 0;

  return (
    <div className="mx-3 mb-2 rounded-xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-900/20 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-3 py-2 border-b border-sky-100 dark:border-sky-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-600 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">Asistente Inteligente</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-200 dark:bg-sky-800 text-sky-700 dark:text-sky-300 font-medium">Sugerencia</span>
        </div>
        <button onClick={onDismiss} disabled={loading} className="p-1 rounded-lg hover:bg-sky-100 dark:hover:bg-sky-800/40 text-sky-500 dark:text-sky-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Intent detection */}
      <div className="px-3 pt-2.5 pb-1.5 space-y-1.5">
        {intent && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Intento detectado: <span className="font-semibold text-sky-700 dark:text-sky-400">{intent}</span></span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-400 w-16 shrink-0">Confianza</span>
          <ConfidenceBar value={confidence} />
        </div>

        {confidence < 0.85 && (
          <div className="flex items-start gap-1.5 mt-1 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-px" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Confianza menor a 85%. Requiere confirmacion manual antes de activar.</p>
          </div>
        )}
      </div>

      {/* Suggested actions */}
      {suggestions.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 mt-1">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Acciones sugeridas</p>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onAccept(s)}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-sky-200 dark:border-sky-700/50 bg-white dark:bg-sky-900/30 hover:bg-sky-50 dark:hover:bg-sky-800/40 transition-colors text-left group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 text-sky-500 animate-spin shrink-0" />
              ) : (
                <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1">{s.label}</span>
              <ChevronDown className="w-3 h-3 text-sky-400 rotate-[-90deg]" />
            </button>
          ))}
          <button
            onClick={onDismiss}
            disabled={loading}
            className="w-full text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1 transition-colors disabled:opacity-50"
          >
            Ignorar sugerencia
          </button>
        </div>
      )}
    </div>
  );
}
