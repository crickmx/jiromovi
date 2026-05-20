import { useState, useMemo, useEffect } from 'react';
import { MessageSquare, Headphones, Bell, Mail, Settings, Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw, Webhook } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Chat } from './Chat';
import CentroContacto from './CentroContacto';
import { NotificacionesTransaccionales } from './NotificacionesTransaccionales';
import { CentroNotificacionesContent } from './CentroNotificaciones';
import { cn } from '@/lib/utils';
import { supabase } from '../lib/supabase';

type TabKey = 'chat' | 'bandeja' | 'notificaciones' | 'transaccionales' | 'diagnostico';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof MessageSquare;
  show: boolean;
}

interface WebhookLog {
  id: string;
  received_at: string;
  method: string;
  messages_count: number;
  statuses_count: number;
  processing_logs: string[];
  error: string | null;
  payload: Record<string, unknown> | null;
}

function DiagnosticoWebhook() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<{ url?: string; configured?: boolean } | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wazzup_webhook_logs')
      .select('id, received_at, method, messages_count, statuses_count, processing_logs, error, payload')
      .order('received_at', { ascending: false })
      .limit(50);
    setLogs(data || []);
    setLoading(false);
  };

  const checkWebhook = async () => {
    try {
      const { data } = await supabase.functions.invoke('wazzup-configure-webhook', {});
      if (data) {
        setWebhookStatus({
          url: data.webhook_url_configured,
          configured: data.is_configured,
        });
      }
    } catch {
      setWebhookStatus(null);
    }
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    await checkWebhook();
    setRegisteringWebhook(false);
  };

  useEffect(() => {
    loadLogs();
    checkWebhook();
  }, []);

  const lastMessage = logs.find(l => l.messages_count > 0);
  const lastError = logs.find(l => l.error);

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Webhook registration status */}
          <div className={`rounded-xl border p-4 ${webhookStatus?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Webhook className={`w-5 h-5 ${webhookStatus?.configured ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className={`font-semibold text-sm ${webhookStatus?.configured ? 'text-emerald-800' : 'text-amber-800'}`}>
                {webhookStatus === null ? 'Verificando...' : webhookStatus.configured ? 'Webhook Activo' : 'Webhook No Registrado'}
              </span>
            </div>
            {webhookStatus?.url && (
              <p className="text-xs font-mono text-neutral-600 break-all mb-3">{webhookStatus.url}</p>
            )}
            <button
              onClick={registerWebhook}
              disabled={registeringWebhook}
              className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {registeringWebhook ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Webhook className="w-3 h-3" />}
              {registeringWebhook ? 'Registrando...' : 'Registrar / Verificar Webhook'}
            </button>
          </div>

          {/* Last inbound message */}
          <div className="rounded-xl border bg-white border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span className="font-semibold text-sm text-neutral-700">Ultimo Mensaje Recibido</span>
            </div>
            {lastMessage ? (
              <>
                <p className="text-xs text-neutral-600">
                  {new Date(lastMessage.received_at).toLocaleString('es-MX')}
                </p>
                <p className="text-xs text-neutral-500 mt-1">{lastMessage.messages_count} mensaje(s)</p>
              </>
            ) : (
              <p className="text-xs text-neutral-400 mt-1">Sin mensajes recibidos</p>
            )}
          </div>

          {/* Last error */}
          <div className={`rounded-xl border p-4 ${lastError ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {lastError
                ? <XCircle className="w-5 h-5 text-red-500" />
                : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              <span className={`font-semibold text-sm ${lastError ? 'text-red-700' : 'text-emerald-700'}`}>
                {lastError ? 'Ultimo Error' : 'Sin Errores Recientes'}
              </span>
            </div>
            {lastError && (
              <p className="text-xs text-red-600 break-all">{lastError.error}</p>
            )}
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-800 text-sm">Eventos de Webhook (ultimos 50)</h3>
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-neutral-400 text-sm">Cargando logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-neutral-500 text-sm">No hay registros de webhook todavia.</p>
              <p className="text-neutral-400 text-xs mt-1">Los eventos de Wazzup aparecen aqui cuando se reciben.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100">
                    <th className="text-left px-4 py-2 font-medium text-neutral-500">Recibido</th>
                    <th className="text-left px-4 py-2 font-medium text-neutral-500">Metodo</th>
                    <th className="text-center px-4 py-2 font-medium text-neutral-500">Mensajes</th>
                    <th className="text-center px-4 py-2 font-medium text-neutral-500">Estados</th>
                    <th className="text-left px-4 py-2 font-medium text-neutral-500">Estado</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">
                        {new Date(log.received_at).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded font-mono">{log.method}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {log.messages_count > 0
                          ? <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">{log.messages_count}</span>
                          : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {log.statuses_count > 0
                          ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">{log.statuses_count}</span>
                          : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {log.error
                          ? <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> Error</span>
                          : <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> OK</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                          className="text-accent hover:underline"
                        >
                          {selectedLog?.id === log.id ? 'Ocultar' : 'Detalle'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail panel */}
          {selectedLog && (
            <div className="border-t border-neutral-100 p-4 bg-neutral-50">
              <p className="font-medium text-xs text-neutral-700 mb-2">Logs de procesamiento:</p>
              <pre className="text-xs text-neutral-600 bg-white border border-neutral-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {selectedLog.processing_logs?.join('\n') || '(sin logs)'}
              </pre>
              {selectedLog.error && (
                <>
                  <p className="font-medium text-xs text-red-700 mt-3 mb-1">Error:</p>
                  <pre className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                    {selectedLog.error}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CentroContactoHub() {
  const { usuario } = useAuth();

  const isAdmin = usuario?.rol === 'Administrador';
  const isGerente = usuario?.rol === 'Gerente';
  const isEmpleado = usuario?.rol === 'Empleado';
  const isNotAgent = usuario?.rol !== 'Agente';

  const tabs: TabDef[] = useMemo(() => [
    { key: 'bandeja', label: 'Bandeja', icon: Headphones, show: isAdmin || isGerente || isEmpleado },
    { key: 'chat', label: 'Chat', icon: MessageSquare, show: isNotAgent },
    { key: 'notificaciones', label: 'Notificaciones', icon: Bell, show: isAdmin },
    { key: 'transaccionales', label: 'Transaccionales', icon: Mail, show: isAdmin },
    { key: 'diagnostico', label: 'Diagnóstico', icon: Activity, show: isAdmin },
  ], [isAdmin, isGerente, isEmpleado, isNotAgent]);

  const visibleTabs = tabs.filter(t => t.show);
  const [activeTab, setActiveTab] = useState<TabKey>(() => visibleTabs[0]?.key || 'chat');

  const currentTab = visibleTabs.find(t => t.key === activeTab) ? activeTab : (visibleTabs[0]?.key || 'chat');

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 flex items-stretch">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px flex-1" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        {(isAdmin || isGerente) && (
          <div className="flex items-center pb-px">
            <Link
              to="/centro-contacto/asistentes"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Asistentes Automáticos"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Asistentes</span>
            </Link>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {currentTab === 'chat' && <Chat />}
        {currentTab === 'bandeja' && <CentroContacto />}
        {currentTab === 'notificaciones' && <CentroNotificacionesContent />}
        {currentTab === 'transaccionales' && <NotificacionesTransaccionales />}
        {currentTab === 'diagnostico' && <DiagnosticoWebhook />}
      </div>
    </div>
  );
}
