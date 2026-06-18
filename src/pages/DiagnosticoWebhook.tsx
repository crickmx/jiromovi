import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Webhook } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

export default function DiagnosticoWebhook() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookStatus, setWebhookStatus] = useState<{ url?: string; configured?: boolean } | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [msgStats, setMsgStats] = useState({ inbound: 0, outbound: 0, constraintErrors: 0, duplicates: 0, insertErrors: 0 });

  const loadLogs = async () => {
    setLoading(true);
    const [{ data: logsData }, { data: inboundCount }, { data: outboundCount }] = await Promise.all([
      supabase
        .from('wazzup_webhook_logs')
        .select('id, received_at, method, messages_count, statuses_count, processing_logs, error, payload')
        .order('received_at', { ascending: false })
        .limit(50),
      supabase.from('contact_center_messages').select('id', { count: 'exact', head: true }).eq('direction', 'inbound').eq('channel', 'whatsapp'),
      supabase.from('contact_center_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('channel', 'whatsapp'),
    ]);
    const fetchedLogs: WebhookLog[] = logsData || [];
    setLogs(fetchedLogs);

    let constraintErrors = 0, duplicates = 0, insertErrors = 0;
    for (const log of fetchedLogs) {
      for (const entry of (log.processing_logs || [])) {
        if (entry.includes('constraint')) constraintErrors++;
        else if (entry.startsWith('duplicate_')) duplicates++;
        else if (entry.includes('insert_error')) insertErrors++;
      }
    }
    setMsgStats({
      inbound: (inboundCount as unknown as { count: number })?.count || 0,
      outbound: (outboundCount as unknown as { count: number })?.count || 0,
      constraintErrors,
      duplicates,
      insertErrors,
    });
    setLoading(false);
  };

  const checkWebhook = async () => {
    try {
      const { data } = await supabase.functions.invoke('wazzup-configure-webhook', {});
      if (data) {
        setWebhookStatus({ url: data.webhook_url_configured, configured: data.is_configured });
      }
    } catch {
      setWebhookStatus(null);
    }
  };

  const registerWebhook = async () => {
    setRegisteringWebhook(true);
    await checkWebhook();
    await loadLogs();
    setRegisteringWebhook(false);
  };

  useEffect(() => {
    loadLogs();
    checkWebhook();
  }, []);

  const totalMsgs = logs.reduce((s, l) => s + l.messages_count, 0);
  const totalStatuses = logs.reduce((s, l) => s + l.statuses_count, 0);
  const totalErrors = logs.filter(l => l.error).length;
  const lastInboundLog = logs.find(l => l.messages_count > 0);
  const lastInsertedInbound = logs.find(l =>
    (l.processing_logs || []).some(e => e.includes('dir=inbound'))
  );
  const lastConstraintError = logs.find(l =>
    (l.processing_logs || []).some(e => e.includes('constraint'))
  );

  const noConstraintErrors = msgStats.constraintErrors === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">

        {/* Webhook registration */}
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${webhookStatus?.configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Webhook className={`w-5 h-5 ${webhookStatus?.configured ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span className={`font-semibold text-sm ${webhookStatus?.configured ? 'text-emerald-800' : 'text-amber-800'}`}>
                {webhookStatus === null ? 'Verificando webhook...' : webhookStatus.configured ? 'Webhook registrado y activo en Wazzup' : 'Webhook no confirmado en Wazzup'}
              </span>
            </div>
            {webhookStatus?.url && (
              <p className="text-xs font-mono text-neutral-600 break-all">{webhookStatus.url}</p>
            )}
          </div>
          <button
            onClick={registerWebhook}
            disabled={registeringWebhook}
            className="shrink-0 px-4 py-2 text-xs font-medium bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            {registeringWebhook ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
            {registeringWebhook ? 'Registrando...' : 'Registrar / Verificar'}
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Mensajes inbound (DB)', value: msgStats.inbound, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Mensajes outbound (DB)', value: msgStats.outbound, color: 'text-teal-600', bg: 'bg-teal-50' },
            { label: 'Webhooks recibidos', value: logs.length, color: 'text-neutral-700', bg: 'bg-neutral-50' },
            { label: 'Msgs en webhooks', value: totalMsgs, color: 'text-neutral-700', bg: 'bg-neutral-50' },
            { label: 'Status updates', value: totalStatuses, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Errores webhook', value: totalErrors, color: totalErrors > 0 ? 'text-red-600' : 'text-emerald-600', bg: totalErrors > 0 ? 'bg-red-50' : 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-neutral-100 ${s.bg} p-3`}>
              <p className="text-[10px] text-neutral-500 mb-1 leading-tight">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Detailed stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`rounded-xl border p-3 ${noConstraintErrors ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {noConstraintErrors ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span className={`text-xs font-semibold ${noConstraintErrors ? 'text-emerald-700' : 'text-red-700'}`}>
                Errores de constraint
              </span>
            </div>
            <p className={`text-2xl font-bold ${noConstraintErrors ? 'text-emerald-600' : 'text-red-600'}`}>{msgStats.constraintErrors}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">{noConstraintErrors ? 'Sin errores (constraint OK)' : 'Mensajes bloqueados por constraint'}</p>
          </div>

          <div className="rounded-xl border bg-neutral-50 border-neutral-200 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-semibold text-neutral-600">Duplicados ignorados</span>
            </div>
            <p className="text-2xl font-bold text-neutral-600">{msgStats.duplicates}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">Ecos ya existentes</p>
          </div>

          <div className={`rounded-xl border p-3 ${msgStats.insertErrors > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {msgStats.insertErrors > 0 ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              <span className={`text-xs font-semibold ${msgStats.insertErrors > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                Errores de insercion
              </span>
            </div>
            <p className={`text-2xl font-bold ${msgStats.insertErrors > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{msgStats.insertErrors}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">{msgStats.insertErrors > 0 ? 'Revisa detalle del log' : 'Todas las inserciones OK'}</p>
          </div>
        </div>

        {/* Key timestamps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] text-neutral-400 mb-1 uppercase tracking-wide">Ultimo webhook con mensaje</p>
            <p className="font-medium text-neutral-700">{lastInboundLog ? new Date(lastInboundLog.received_at).toLocaleString('es-MX') : '—'}</p>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 p-3">
            <p className="text-[10px] text-neutral-400 mb-1 uppercase tracking-wide">Ultimo inbound insertado</p>
            <p className="font-medium text-neutral-700">{lastInsertedInbound ? new Date(lastInsertedInbound.received_at).toLocaleString('es-MX') : '—'}</p>
          </div>
          <div className={`rounded-xl border p-3 ${lastConstraintError ? 'bg-red-50 border-red-100' : 'bg-white border-neutral-200'}`}>
            <p className="text-[10px] text-neutral-400 mb-1 uppercase tracking-wide">Ultimo error de constraint</p>
            <p className={`font-medium ${lastConstraintError ? 'text-red-600' : 'text-emerald-600'}`}>
              {lastConstraintError ? new Date(lastConstraintError.received_at).toLocaleString('es-MX') : 'Ninguno'}
            </p>
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
                    <th className="text-center px-4 py-2 font-medium text-neutral-500">Msgs</th>
                    <th className="text-center px-4 py-2 font-medium text-neutral-500">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-neutral-500">Resultado</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const hasConstraintErr = (log.processing_logs || []).some(e => e.includes('constraint'));
                    const hasInsertErr = (log.processing_logs || []).some(e => e.includes('insert_error'));
                    const hasDuplicate = (log.processing_logs || []).some(e => e.startsWith('duplicate_'));
                    const insertedOk = (log.processing_logs || []).some(e => e.startsWith('inserted_'));
                    return (
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
                          {hasConstraintErr
                            ? <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> Constraint</span>
                            : hasInsertErr
                            ? <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> Insert error</span>
                            : insertedOk
                            ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Insertado</span>
                            : hasDuplicate
                            ? <span className="flex items-center gap-1 text-neutral-400"><AlertCircle className="w-3 h-3" /> Duplicado</span>
                            : <span className="flex items-center gap-1 text-neutral-400"><CheckCircle2 className="w-3 h-3" /> OK</span>}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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
