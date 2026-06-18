import { cn } from '../../lib/utils';
import { ChavaAvatar } from '../chava/ChavaAvatar';
import { Sparkles, ArrowRight } from 'lucide-react';

interface SmartAnalysisCardProps {
  className?: string;
  onStartAnalysis?: () => void;
}

export function SmartAnalysisCard({ className, onStartAnalysis }: SmartAnalysisCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-sky-800/40 bg-gradient-to-br from-surface-900 to-surface-950 p-6',
        className
      )}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-900/10 to-brand-900/5 pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-sky-500/5 blur-2xl pointer-events-none" />

      <div className="relative flex items-start gap-4">
        {/* Chava AI animated icon */}
        <ChavaAvatar size="lg" animate online className="flex-shrink-0 mt-0.5" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-semibold text-base">Análisis Inteligente</h3>
            <span className="flex items-center gap-1 text-xs text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full border border-sky-400/20">
              <Sparkles className="w-3 h-3" />
              Chava AI
            </span>
          </div>
          <p className="text-surface-400 text-sm leading-relaxed mb-4">
            Deja que Chava analice tu cartera y te sugiera las mejores acciones para retener clientes y aumentar conversiones.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onStartAnalysis}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
            >
              Iniciar análisis
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors border border-surface-700"
            >
              Ver historial
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="relative mt-5 pt-4 border-t border-surface-800 grid grid-cols-3 gap-4">
        {[
          { label: 'Pólizas analizadas', value: '1,248' },
          { label: 'Renovaciones en riesgo', value: '23' },
          { label: 'Oportunidades', value: '87' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-white font-bold text-lg leading-tight">{stat.value}</p>
            <p className="text-surface-500 text-xs mt-0.5 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
