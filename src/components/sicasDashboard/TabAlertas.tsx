import { useState, useEffect, useCallback } from 'react';
import {
  Bell, RefreshCcw, Loader2, AlertTriangle, Calendar, TrendingUp,
  FileText, X, CheckCircle2, DollarSign, Eye, ChevronDown,
} from 'lucide-react';
import type { DashboardScope } from '../../lib/sicasDashboardTypes';
import { fetchAgentAlerts, generateAlerts, markAlertRead, dismissAlert, type AgentAlert } from '../../lib/sicasDashboardService';

interface Props {
  userId: string;
  scope: DashboardScope | null;
  accentColor: string;
}

const ALERT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  renewal_upcoming: { icon: Calendar, color: '#f59e0b', label: 'Renovacion proxima' },
  policy_expired: { icon: AlertTriangle, color: '#ef4444', label: 'Poliza vencida' },
  new_emission: { icon: FileText, color: '#10b981', label: 'Nueva emision' },
  document_available: { icon: FileText, color: '#06b6d4', label: 'Documento disponible' },
  no_followup: { icon: Bell, color: '#f97316', label: 'Sin seguimiento' },
  cross_sell: { icon: TrendingUp, color: '#8b5cf6', label: 'Venta cruzada' },
  production_low: { icon: TrendingUp, color: '#dc2626', label: 'Produccion baja' },
  high_value_renewal: { icon: DollarSign, color: '#059669', label: 'Renovacion alto valor' },
  recoverable_policy: { icon: TrendingUp, color: '#0284c7', label: 'Poliza recuperable' },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-blue-400',
};

export default function TabAlertas({ userId, scope, accentColor }: Props) {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [showRead, setShowRead] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchAgentAlerts(userId, {
        unreadOnly: !showRead,
        priority: filterPriority || undefined,
        limit: 100,
        scope: scope?.scope,
        oficinaId: scope?.oficina_id,
      });
      setAlerts(data);
    } catch (err) {
      console.error('[TabAlertas]', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [userId, filterPriority, showRead, scope]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleGenerate = async () => {
    setRefreshing(true);
    try {
      await generateAlerts(userId);
      await loadAlerts();
    } catch (err) {
      console.error('[TabAlertas] Generate error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markAlertRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'seen' } : a));
  };

  const handleDismiss = async (id: string) => {
    await dismissAlert(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const unreadCount = alerts.filter(a => a.status === 'new').length;
  const highCount = alerts.filter(a => a.priority === 'high').length;
  const mediumCount = alerts.filter(a => a.priority === 'medium').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{unreadCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Alertas sin leer</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{highCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Prioridad alta</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-900/20">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{mediumCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Prioridad media</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showRead}
                onChange={e => setShowRead(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Mostrar leidas
            </label>
          </div>
          <button
            onClick={handleGenerate}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Generar alertas
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-300 dark:text-emerald-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sin alertas pendientes</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {showRead ? 'No hay alertas registradas' : 'Todas las alertas han sido atendidas'}
            </p>
          </div>
        ) : (
          alerts.map(alert => {
            const config = ALERT_TYPE_CONFIG[alert.alert_type] || { icon: Bell, color: '#6b7280', label: alert.alert_type };
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-all hover:shadow-sm ${
                  PRIORITY_STYLES[alert.priority] || ''
                } ${alert.status !== 'new' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: config.color + '15' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-medium ${alert.status !== 'new' ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {alert.title}
                        </p>
                        {alert.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{alert.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {alert.status === 'new' && (
                          <button
                            onClick={() => handleMarkRead(alert.id)}
                            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Marcar como leida"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                          title="Descartar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                        {config.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatTimeAgo(alert.created_at)}
                      </span>
                      {alert.due_date && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          Vence: {new Date(alert.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
