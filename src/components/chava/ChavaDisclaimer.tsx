import { useState } from 'react';
import { CircleAlert as AlertCircle, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ChavaContextType =
  | 'general'
  | 'polizas'
  | 'pagos'
  | 'siniestros'
  | 'juridico'
  | 'documentos'
  | 'sicas'
  | 'comisiones';

interface ChavaDisclaimerProps {
  context?: ChavaContextType;
  variant?: 'banner' | 'compact' | 'inline';
  className?: string;
}

const CONTEXT_NOTES: Record<ChavaContextType, string | null> = {
  general: null,
  polizas: 'La información de pólizas se basa en los datos registrados en SICAS/Seguwallet. Para información oficial, consulta el documento de tu póliza.',
  pagos: 'Los datos de pagos y cobranza son referenciales. Verifica montos exactos directamente con tu aseguradora.',
  siniestros: 'Para reportar un siniestro formal, contacta directamente a tu aseguradora o agente. No procesualizamos siniestros.',
  juridico: 'Esta información es orientativa y no constituye asesoría legal. Consulta con un especialista para situaciones jurídicas específicas.',
  documentos: 'Los documentos mostrados son copias de referencia. Los documentos oficiales son los emitidos por la aseguradora.',
  sicas: 'Los datos de producción provienen de sincronizaciones periódicas con SICAS y pueden tener un desfase de hasta 24 horas.',
  comisiones: 'Los cálculos de comisiones son estimados basados en los parámetros configurados. Los importes definitivos los determina la aseguradora.',
};

const BASE_TEXT = 'Chava utiliza Inteligencia Artificial para generar respuestas y recomendaciones. La información puede contener errores — verifica datos importantes con fuentes oficiales.';

const EXPANDED_INFO = [
  'Las respuestas son generadas por IA y pueden contener inexactitudes.',
  'No reemplaza el consejo profesional de tu agente o aseguradora.',
  'Consulta siempre la documentación oficial de tus pólizas.',
  'Para emergencias o siniestros, contacta directamente a tu aseguradora.',
];

export function ChavaDisclaimer({
  context = 'general',
  variant = 'banner',
  className,
}: ChavaDisclaimerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const contextNote = CONTEXT_NOTES[context];

  if (dismissed && variant !== 'inline') return null;

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-start gap-1.5 text-xs text-gray-400', className)}>
        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>Respuestas generadas por IA — verifica con tu agente.</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 flex items-start gap-2', className)}>
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
        <p>{BASE_TEXT}</p>
      </div>
    );
  }

  // Default: banner
  return (
    <div className={cn(
      'rounded-xl bg-amber-50/70 border border-amber-100 px-4 py-3 text-xs text-amber-800 transition-all',
      className
    )}>
      <div className="flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="leading-relaxed">{BASE_TEXT}</p>

          {contextNote && (
            <p className="mt-1.5 text-amber-700/80 leading-relaxed">{contextNote}</p>
          )}

          {expanded && (
            <ul className="mt-2 space-y-1 text-amber-700/80">
              {EXPANDED_INFO.map((info, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  {info}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1 transition-colors"
          >
            {expanded ? 'Menos información' : 'Más información'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors -mt-0.5"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
