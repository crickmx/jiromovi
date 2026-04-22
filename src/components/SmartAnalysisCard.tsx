import { useState } from 'react';
import {
  TrendingUp, AlertTriangle, Target, Shield, Clock, DollarSign,
  Users, FileText, RefreshCw, Award, BarChart3, Zap, Lightbulb,
  ChevronDown, ChevronUp, AlertCircle, Info, Brain
} from 'lucide-react';
import type { SmartAnalysisResult } from '../lib/dashboardWelcomeService';

const iconMap: Record<string, React.ComponentType<any>> = {
  TrendingUp, AlertTriangle, Target, Shield, Clock, DollarSign,
  Users, FileText, RefreshCw, Award, BarChart3, Zap, Lightbulb, Info, Brain,
};

function getIcon(name: string, className: string) {
  const Icon = iconMap[name] || BarChart3;
  return <Icon className={className} />;
}

interface Props {
  result: SmartAnalysisResult | null;
  loading: boolean;
  onRefresh: () => void;
  userName?: string;
}

export function SmartAnalysisCard({ result, loading, onRefresh, userName }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-blue-500 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-48" />
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 rounded w-full" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-slate-200/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { analysis, source, hasSicasMapping } = result;

  const toneStyles = {
    positive: { card: 'from-emerald-50 to-teal-50 border-emerald-200', title: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
    neutral: { card: 'from-slate-50 to-blue-50 border-slate-200', title: 'text-slate-800', badge: 'bg-blue-100 text-blue-700' },
    attention: { card: 'from-amber-50 to-orange-50 border-amber-200', title: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  };
  const styles = toneStyles[analysis.tone] || toneStyles.neutral;

  const alertStyles = {
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> },
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /> },
  };

  const hasDetails = analysis.alerts.length > 0 || analysis.opportunities.length > 0 || analysis.recommendations.length > 0;

  return (
    <div className={`p-4 bg-gradient-to-br ${styles.card} rounded-xl border transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <h3 className={`text-sm font-semibold ${styles.title} truncate`}>
            {analysis.title}
          </h3>
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

      {/* Summary */}
      <p className="text-sm text-slate-600 leading-relaxed mb-3">
        {analysis.summary}
      </p>

      {/* Insights Grid */}
      {analysis.insights.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {analysis.insights.map((insight, i) => (
            <div key={i} className="bg-white/70 rounded-lg p-2.5 border border-white/80">
              <div className="flex items-center gap-1.5 mb-1">
                {getIcon(insight.icon, 'w-3.5 h-3.5 text-blue-600')}
                <span className="text-[11px] text-slate-500 font-medium truncate">{insight.label}</span>
              </div>
              <p className="text-base font-bold text-slate-800">{insight.value}</p>
              {insight.detail && (
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{insight.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alerts (always visible) */}
      {analysis.alerts.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {analysis.alerts.map((alert, i) => {
            const s = alertStyles[alert.level] || alertStyles.info;
            return (
              <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg ${s.bg} border ${s.border}`}>
                {s.icon}
                <span className={`text-xs ${s.text} leading-relaxed`}>{alert.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Section */}
      {hasDetails && (analysis.opportunities.length > 0 || analysis.recommendations.length > 0) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors mt-1"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Menos detalle' : 'Oportunidades y recomendaciones'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {/* Opportunities */}
              {analysis.opportunities.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-700">Oportunidades</span>
                  </div>
                  <div className="space-y-1">
                    {analysis.opportunities.map((opp, i) => (
                      <div key={i} className="bg-white/60 rounded-lg px-2.5 py-2 border border-emerald-100">
                        <p className="text-xs text-slate-700 font-medium">{opp.description}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opp.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-slate-700">Recomendaciones</span>
                  </div>
                  <div className="space-y-1">
                    {analysis.recommendations.map((rec, i) => (
                      <div key={i} className="bg-white/60 rounded-lg px-2.5 py-2 border border-amber-100">
                        <p className="text-xs text-slate-700 font-medium">{rec.action}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{rec.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
