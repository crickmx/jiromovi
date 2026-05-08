import { useState, useEffect, useCallback } from 'react';
import {
  Lightbulb, RefreshCcw, Loader2, DollarSign, CheckCircle2,
  TrendingUp, Shield, Layers, Sparkles, AlertCircle, Zap,
} from 'lucide-react';
import type { DashboardScope } from '../../lib/sicasDashboardTypes';
import { formatCurrency } from '../../lib/sicasDashboardTypes';
import {
  fetchCrossSellOpportunities, callProductionInsights,
  markOpportunityActioned, fetchInsightsDiagnostics,
  type CrossSellOpportunity,
} from '../../lib/sicasDashboardService';

interface Props {
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
}

const OPPORTUNITY_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  auto_sin_gmm: { label: 'Auto sin GMM', icon: Shield, color: '#0ea5e9' },
  auto_sin_hogar: { label: 'Auto sin Hogar', icon: Shield, color: '#06b6d4' },
  vida_sin_gmm: { label: 'Vida sin GMM', icon: Shield, color: '#8b5cf6' },
  single_policy: { label: 'Poliza unica', icon: Layers, color: '#f59e0b' },
  high_value_client: { label: 'Cliente alto valor', icon: DollarSign, color: '#10b981' },
  recoverable_policy: { label: 'Recuperable', icon: TrendingUp, color: '#ef4444' },
  diversification: { label: 'Diversificacion', icon: Layers, color: '#6366f1' },
  upgrade: { label: 'Upgrade', icon: TrendingUp, color: '#14b8a6' },
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
  medium: 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
  low: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800',
};

export default function TabOportunidades({ userId, scope, accentColor }: Props) {
  const [opportunities, setOpportunities] = useState<CrossSellOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCrossSellOpportunities(userId, {
        confidence: filter || undefined,
        limit: 50,
        scope: scope?.scope,
        oficinaId: scope?.oficina_id || undefined,
      });
      setOpportunities(data);

      // Load diagnostics for admin
      if (scope?.scope === 'admin' || scope?.rol === 'Administrador') {
        const diag = await fetchInsightsDiagnostics(userId);
        setDiagnostics(diag);
      }
    } catch (err: any) {
      console.error('[TabOportunidades]', err);
      setError(err.message);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [userId, filter, scope]);

  useEffect(() => { loadOpportunities(); }, [loadOpportunities]);

  const handleDetect = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const result = await callProductionInsights(true);
      if (result.ai_summary) setAiSummary(result.ai_summary);
      if (result.diagnostics) setDiagnostics(result.diagnostics as Record<string, unknown>);
      await loadOpportunities();
    } catch (err: any) {
      console.error('[TabOportunidades] Detect error:', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAction = async (id: string) => {
    await markOpportunityActioned(id);
    setOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const totalEstimatedPrima = opportunities.reduce((sum, o) => sum + (o.premium_current || 0), 0);
  const highConfidence = opportunities.filter(o => o.priority === 'high').length;

  return (
    <div className="space-y-4">
      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Analisis Inteligente</p>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">{aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{opportunities.length}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Oportunidades detectadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalEstimatedPrima)}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Prima potencial estimada</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{highConfidence}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Alta probabilidad</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las probabilidades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
          <button
            onClick={handleDetect}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Analizando...' : 'Actualizar analisis'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : opportunities.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Lightbulb className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No hay oportunidades pendientes</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {diagnostics?.message
                ? String(diagnostics.message)
                : 'Haz clic en "Actualizar analisis" para detectar oportunidades de venta cruzada y reactivacion en tu cartera SICAS'}
            </p>
            {diagnostics && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Vigentes: {String(diagnostics.total_vigentes || 0)} |
                  Clientes activos: {String(diagnostics.active_clients || 0)} |
                  AI: {diagnostics.ai_available ? 'Disponible' : 'No configurado'} |
                  Ultimo analisis: {diagnostics.generated_at ? new Date(String(diagnostics.generated_at)).toLocaleString('es-MX') : 'Nunca'}
                </p>
              </div>
            )}
          </div>
        ) : (
          opportunities.map(opp => {
            const config = OPPORTUNITY_LABELS[opp.opportunity_type] || { label: opp.opportunity_type, icon: Lightbulb, color: '#6b7280' };
            const Icon = config.icon;
            return (
              <div
                key={opp.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: config.color + '15' }}>
                    <Icon className="w-4.5 h-4.5" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{opp.client_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opp.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONFIDENCE_STYLES[opp.priority] || CONFIDENCE_STYLES.low}`}>
                          {opp.priority === 'high' ? 'Alta' : opp.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                          {config.label}
                        </span>
                        {opp.suggested_product && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Layers className="w-3 h-3" /> {opp.suggested_product}
                          </span>
                        )}
                        {opp.premium_current > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" /> ~{formatCurrency(opp.premium_current)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAction(opp.id)}
                        className="flex items-center gap-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Atendida
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Diagnostics */}
      {diagnostics && (scope?.scope === 'admin' || scope?.rol === 'Administrador') && opportunities.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">Diagnostico (solo admin)</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Vigentes: {String(diagnostics.total_vigentes || 0)} |
            Renovaciones 30d: {String(diagnostics.renewals_30 || 0)} |
            Expiradas recientes: {String(diagnostics.expired_recent || 0)} |
            Clientes: {String(diagnostics.active_clients || 0)} |
            AI usado: {diagnostics.ai_used ? 'Si' : 'No'} |
            Fuente: {String(diagnostics.cached_at ? 'Cache' : 'Fresco')}
          </p>
        </div>
      )}
    </div>
  );
}
