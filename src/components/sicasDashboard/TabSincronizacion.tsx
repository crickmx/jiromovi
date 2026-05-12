import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cloud, Database, Clock, Loader2, Download, RefreshCw,
  CheckCircle2, XCircle, Info, StopCircle, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { callEdgeFunction } from '../../pages/ProduccionSICASLive';
import { formatDate, formatNumber } from '../../lib/sicasDashboardTypes';
import MapeoUsuariosSICAS from '../produccion/MapeoUsuariosSICAS';

interface Props {
  userId?: string;
  onSyncComplete?: () => void;
  accentColor: string;
}

interface SyncRun {
  run_id: string;
  module: string;
  keycode: string;
  records_fetched: number;
  records_upserted: number;
  records_failed: number;
  status: string;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  source_api?: string;
  window_label?: string;
}

export default function TabSincronizacion({ userId, onSyncComplete, accentColor }: Props) {
  const [activeSection, setActiveSection] = useState<'sync' | 'mapeo'>('sync');
  const [syncing, setSyncing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, any> | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ percent: number; page: number; totalPages: number; fetched: number; totalInSicas: number } | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [totalDocs, setTotalDocs] = useState<number | null>(null);

  const loadSyncInfo = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [{ data: jobs }, { data: countData }] = await Promise.all([
        supabase.from('sicas_sync_jobs').select('*').order('started_at', { ascending: false }).limit(15),
        supabase.rpc('get_sicas_documents_count'),
      ]);
      const count = typeof countData === 'number' ? countData : 0;
      // Map sicas_sync_jobs to SyncRun format for display
      const mapped: SyncRun[] = (jobs || []).map(j => ({
        run_id: j.id,
        module: 'documents',
        keycode: j.keycode || 'H03400_SOAP',
        records_fetched: j.total_in_sicas || 0,
        records_upserted: j.total_synced || 0,
        records_failed: j.total_errors || 0,
        status: j.status,
        error_message: j.status === 'failed' ? (j.error_message?.startsWith('{') ? null : j.error_message) : null,
        started_at: j.started_at,
        finished_at: j.finished_at,
        duration_seconds: j.started_at && j.finished_at ? Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000) : null,
      }));
      setSyncHistory(mapped);
      setTotalDocs(count ?? 0);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, []);

  const checkActiveJob = useCallback(async () => {
    const { data: job } = await supabase
      .from('sicas_sync_jobs')
      .select('*')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (job) {
      const startedAt = new Date(job.started_at).getTime();
      const stuckThreshold = 2 * 60 * 60 * 1000; // 2 hours
      if (Date.now() - startedAt > stuckThreshold && (job.current_page || 0) === 0) {
        await supabase.from('sicas_sync_jobs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: 'Job marcado como fallido automaticamente (stuck >2h sin progreso)' }).eq('id', job.id);
        setSyncResult({ ok: false, error: 'La sincronizacion anterior se quedo atorada y fue terminada automaticamente. Puedes reintentar.' });
        loadSyncInfo();
        return;
      }
      setActiveJobId(job.id);
      setSyncing(true);
      setSyncProgress({
        percent: job.percent || 0,
        page: job.current_page || 0,
        totalPages: job.total_pages || 0,
        fetched: job.total_synced || 0,
        totalInSicas: job.total_in_sicas || 0,
      });
    }
  }, [loadSyncInfo]);

  useEffect(() => { loadSyncInfo(); checkActiveJob(); }, [loadSyncInfo, checkActiveJob]);

  // Auto-continue: aggressively call continue whenever job is running and no call is in-flight
  const continueInFlightRef = useRef(false);
  const lastPageRef = useRef<number>(0);

  useEffect(() => {
    if (!syncing || !activeJobId) return;
    continueInFlightRef.current = false;
    lastPageRef.current = 0;

    const triggerContinue = async () => {
      if (continueInFlightRef.current) return;
      continueInFlightRef.current = true;
      try {
        console.log('[SYNC] Calling continue...');
        await callEdgeFunction('sicas-bulk-sync', { action: 'continue', jobId: activeJobId });
      } catch { /* silent */ }
      finally { continueInFlightRef.current = false; }
    };

    const interval = setInterval(async () => {
      const { data: job } = await supabase
        .from('sicas_sync_jobs')
        .select('*')
        .eq('id', activeJobId)
        .maybeSingle();
      if (!job) return;

      setSyncProgress({
        percent: job.percent || 0,
        page: job.current_page || 0,
        totalPages: job.total_pages || 0,
        fetched: job.total_synced || 0,
        totalInSicas: job.total_in_sicas || 0,
      });

      if (job.status === 'completed') {
        setSyncing(false); setActiveJobId(null); setSyncProgress(null);
        setSyncResult({ ok: true, stats: { documentsUpserted: job.total_synced || 0, totalInSicas: job.total_in_sicas || 0, errors: job.total_errors || 0 } });
        loadSyncInfo(); onSyncComplete?.();
      } else if (job.status === 'failed') {
        setSyncing(false); setActiveJobId(null); setSyncProgress(null);
        setSyncResult({ ok: false, error: job.error_message || 'Error desconocido' });
        loadSyncInfo();
      } else if (job.status === 'cancelled') {
        setSyncing(false); setActiveJobId(null); setSyncProgress(null);
        setSyncResult({ ok: false, error: 'Sincronizacion cancelada' });
        loadSyncInfo();
      } else if (job.status === 'running') {
        // Always trigger continue if not already in-flight
        triggerContinue();
      }
    }, 4000);

    // Also trigger continue immediately on mount (don't wait for first poll)
    setTimeout(() => triggerContinue(), 500);

    return () => clearInterval(interval);
  }, [syncing, activeJobId, loadSyncInfo, onSyncComplete]);

  const runSync = async (mode: 'full' | 'incremental') => {
    setSyncing(true); setSyncResult(null);
    setSyncProgress({ percent: 0, page: 0, totalPages: 0, fetched: 0, totalInSicas: 0 });
    try {
      const result = await callEdgeFunction('sicas-bulk-sync', { action: 'start', mode, triggeredBy: userId || null });
      if (!result.ok) { setSyncResult(result); setSyncing(false); setSyncProgress(null); return; }
      setActiveJobId(result.jobId as string);
      if (result.alreadyRunning) {
        const p = result.progress as any;
        setSyncProgress({ percent: p?.percent || 0, page: p?.currentPage || 0, totalPages: p?.totalPages || 0, fetched: p?.totalSynced || 0, totalInSicas: p?.totalInSicas || 0 });
      }
    } catch (err: any) {
      setSyncResult({ ok: false, error: err?.message || 'Error desconocido' });
      setSyncing(false); setSyncProgress(null);
    }
  };

  const cancelSync = async () => {
    if (!activeJobId) return;
    try { await callEdgeFunction('sicas-bulk-sync', { action: 'cancel', jobId: activeJobId }); } catch {}
  };

  const lastSync = syncHistory[0];

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
        <button onClick={() => setActiveSection('sync')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeSection === 'sync' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
          <Cloud className="w-4 h-4" /> Sincronizacion
        </button>
        <button onClick={() => setActiveSection('mapeo')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all flex-1 justify-center ${activeSection === 'mapeo' ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>
          <Users className="w-4 h-4" /> Mapeo de Usuarios
        </button>
      </div>

      {activeSection === 'mapeo' ? (
        <MapeoUsuariosSICAS callApi={(body) => callEdgeFunction('sicas-production-query', body)} />
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard icon={Database} label="Documentos Locales" value={totalDocs !== null ? formatNumber(totalDocs) : '-'} color={accentColor} />
            <StatusCard icon={Clock} label="Ultima Sincronizacion" value={lastSync?.started_at ? formatDate(lastSync.started_at) : 'Nunca'} color={accentColor} subtitle={lastSync ? (lastSync.status === 'success' || lastSync.status === 'completed' ? `${formatNumber(lastSync.records_upserted)} docs unicos` : lastSync.status === 'running' ? 'En progreso...' : 'Error') : undefined} />
            <StatusCard icon={Info} label="Estado" value={totalDocs === 0 ? 'Sin datos' : 'Datos disponibles'} color={totalDocs === 0 ? '#f59e0b' : '#10b981'} />
          </div>

          {/* Sync buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Cloud className="w-4 h-4" style={{ color: accentColor }} /> Sincronizar con SICAS
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">La sincronizacion descarga documentos desde SICAS y continua en segundo plano aunque cierres esta pagina.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => runSync('full')} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 text-sm font-medium" style={{ backgroundColor: accentColor }}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Sincronizacion Completa
              </button>
              <button onClick={() => runSync('incremental')} disabled={syncing} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 text-sm font-medium">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Incremental (30 dias)
              </button>
              {syncing && activeJobId && (
                <button onClick={cancelSync} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium">
                  <StopCircle className="w-4 h-4" /> Cancelar
                </button>
              )}
            </div>

            {syncing && syncProgress && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <p className="font-medium">
                    {syncProgress.totalPages === 0
                      ? 'Conectando con SICAS...'
                      : `Sincronizando... ${Math.round((syncProgress.page / syncProgress.totalPages) * 100)}%`}
                  </p>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${syncProgress.totalPages > 0 ? Math.round((syncProgress.page / syncProgress.totalPages) * 100) : 2}%`, backgroundColor: accentColor }} />
                </div>
                <p className="text-xs opacity-80">
                  {syncProgress.totalPages === 0
                    ? 'Obteniendo informacion del servidor SICAS...'
                    : <>
                        Pagina {syncProgress.page}/{syncProgress.totalPages}
                        {syncProgress.totalInSicas > 0 && ` - ${formatNumber(syncProgress.totalInSicas)} registros en SICAS`}
                        {syncProgress.fetched > 0 && ` - ${formatNumber(syncProgress.fetched)} documentos unicos en BD`}
                        {syncProgress.page > 0 && syncProgress.totalPages > 0 && syncProgress.page < syncProgress.totalPages && (
                          ` - ~${Math.round((syncProgress.totalPages - syncProgress.page) * 1.1)} min restantes`
                        )}
                      </>}
                </p>
              </div>
            )}

            {syncResult && (
              <div className={`mt-4 p-3 rounded-lg border text-sm ${syncResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
                <div className="flex items-start gap-2">
                  {syncResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-medium">{syncResult.ok ? 'Sincronizacion completa' : 'Error en sincronizacion'}</p>
                    {syncResult.ok && syncResult.stats && <p className="text-xs mt-1 opacity-80">{formatNumber(syncResult.stats.documentsUpserted)} documentos sincronizados</p>}
                    {!syncResult.ok && <p className="text-xs mt-1 opacity-80">{syncResult.error as string}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sync history */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de Sincronizaciones</h3>
            </div>
            {loadingHistory ? (
              <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></div>
            ) : syncHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Sin historial</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Reporte</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">En SICAS</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Unicos BD</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Duracion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {syncHistory.map(run => (
                      <tr key={run.run_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(run.started_at)}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{run.keycode || run.module}</td>
                        <td className="px-3 py-2 text-center">
                          <SyncStatusBadge status={run.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{formatNumber(run.records_fetched || 0)}</td>
                        <td className="px-3 py-2 text-xs text-right text-gray-700 dark:text-gray-300">{formatNumber(run.records_upserted || 0)}</td>
                        <td className="px-3 py-2 text-xs text-right text-gray-500 dark:text-gray-400">{run.duration_seconds ? `${run.duration_seconds}s` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color, subtitle }: { icon: React.ElementType; label: string; value: string; color: string; subtitle?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const classes = (status === 'success' || status === 'completed')
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : status === 'running'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    : status === 'partial' || status === 'empty'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${classes}`}>{status}</span>
  );
}
