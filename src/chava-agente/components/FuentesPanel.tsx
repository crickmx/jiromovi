import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Cpu, Globe, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Circle as HelpCircle } from 'lucide-react';
import type { Fuente } from '../lib/types';

const FUENTE_CONFIG = {
  conocimiento: { icon: BookOpen, label: 'Base de conocimiento', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  ia: { icon: Cpu, label: 'Inteligencia Artificial', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400' },
  internet: { icon: Globe, label: 'Búsqueda web', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
};

const CONFIANZA_CONFIG = {
  alta: { label: 'Confianza alta', icon: CheckCircle, color: 'text-emerald-600', dot: 'bg-emerald-500' },
  media: { label: 'Confianza media', icon: AlertCircle, color: 'text-amber-600', dot: 'bg-amber-500' },
  baja: { label: 'Confianza baja', icon: HelpCircle, color: 'text-slate-500', dot: 'bg-slate-400' },
};

function FuenteChip({ fuente }: { fuente: Fuente }) {
  const cfg = FUENTE_CONFIG[fuente.tipo] || FUENTE_CONFIG.ia;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {fuente.tipo === 'conocimiento' ? 'Conocimiento' : fuente.tipo === 'ia' ? 'IA' : 'Web'}
    </span>
  );
}

interface Props {
  fuentes: Fuente[];
  confianza_general?: 'alta' | 'media' | 'baja';
}

export default function FuentesPanel({ fuentes, confianza_general }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!fuentes.length) return null;

  const confianza = confianza_general || 'media';
  const confianzaCfg = CONFIANZA_CONFIG[confianza];
  const ConfianzaIcon = confianzaCfg.icon;

  return (
    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden text-xs">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className={`flex items-center gap-1 font-medium ${confianzaCfg.color}`}>
          <ConfianzaIcon className="w-3.5 h-3.5" />
          {confianzaCfg.label}
        </span>
        <span className="text-slate-400 mx-0.5">·</span>
        <div className="flex items-center gap-1 flex-wrap">
          {fuentes.map((f, i) => <FuenteChip key={i} fuente={f} />)}
        </div>
        <span className="ml-auto text-slate-400">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {fuentes.map((f, i) => {
            const cfg = FUENTE_CONFIG[f.tipo] || FUENTE_CONFIG.ia;
            const Icon = cfg.icon;
            const fConfianza = CONFIANZA_CONFIG[f.confianza];
            return (
              <div key={i} className="px-3 py-2.5 bg-white">
                <div className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 leading-snug">{f.descripcion}</p>
                    {f.documento && <p className="text-slate-500 mt-0.5 truncate">{f.documento}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${fConfianza.dot}`} />
                      <span className={`${fConfianza.color}`}>{fConfianza.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="px-3 py-2 bg-slate-50">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              La información proporcionada es orientativa. Verifica siempre con tu agente, aseguradora o documentos oficiales antes de tomar decisiones.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
