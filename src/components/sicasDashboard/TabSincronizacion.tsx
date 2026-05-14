import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cloud, Database, Clock, Loader2, Download, RefreshCw,
  CheckCircle2, XCircle, Info, StopCircle, Users, ShieldAlert,
  Stethoscope, Settings2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { callEdgeFunction } from '../../pages/ProduccionSICASLive';
import { formatDate, formatNumber } from '../../lib/sicasDashboardTypes';
import { preflight, releaseClientLock, checkCircuitBreaker } from '../../lib/sicasRateControl';
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

interface DiagVariant {
  variant: string;
  description: string;
  conditionsAdd: string;
  typeFormat: string;
  records: number;
  totalRecords: number;
  responseLength: number;
  durationMs: number;
  parseStatus: 'parsed' | 'no_data' | 'parse_failed' | 'soap_error';
  error?: string;
  sampleFields?: string[];
  responsePreview?: string;
  responseTxt?: string;
  responseNbr?: string;
}

interface DiagCodeResult {
  code: string;
  variants: DiagVariant[];
  bestVariant: string | null;
  hasData: boolean;
}

interface DiagnosticResult {
  results: DiagCodeResult[];
  recommendedKeyCode: string | null;
  recommendedVariant?: string | null;
  recommendedFormat?: string | null;
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
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [sicasConfig, setSicasConfig] = useState<{
    last_successful_report?: string;
    current_report_code?: string;
    alternate_report_codes?: string[];
    report_test_history?: any;
    local_first_mode?: boolean;
    auto_sync_enabled?: boolean;
    last_successful_local_count?: number;
    last_successful_historic_report?: string;
    soap_diagnostic_enabled?: boolean;
    use_rest?: boolean;
  } | null>(null);
  const [activatingReport, setActivatingReport] = useState(false);

  const loadSyncInfo = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [{ data: jobs }, { data: countData }, { data: configData }] = await Promise.all([
        supabase.from('sicas_sync_jobs').select('*').order('started_at', { ascending: false }).limit(15),
        supabase.rpc('get_sicas_documents_count'),
        supabase.from('sicas_config').select('last_successful_report, current_report_code, alternate_report_codes, report_test_history, local_first_mode, auto_sync_enabled, last_successful_local_count, last_successful_historic_report, soap_diagnostic_enabled, use_rest').limit(1).maybeSingle(),
      ]);
      if (configData) setSicasConfig(configData);
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
        error_message: (j.status === 'failed' || j.status === 'empty') ? (j.error_message?.startsWith('{') ? null : j.error_message) : null,
        started_at: j.started_at,
        finished_at: j.finished_at,
        duration_seconds: j.started_at && j.finished_at ? Math.round((new Date(j.finished_at).getTime() - new Date(j.started_at).getTime()) / 1000) : null,
        source_api: j.keycode?.includes('DIAGNOSTIC') ? 'DIAGNOSTIC' : j.keycode?.endsWith('_REST') ? 'REST' : 'SOAP',
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
      } else if (job.status === 'failed' || job.status === 'empty') {
        setSyncing(false); setActiveJobId(null); setSyncProgress(null);
        if (job.status === 'empty') {
          setSyncResult({ ok: true, status: 'empty', localDocsAvailable: job.total_synced || 0, message: job.error_message });
        } else {
          setSyncResult({ ok: false, error: job.error_message || 'Error desconocido' });
        }
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

  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);

  useEffect(() => {
    checkCircuitBreaker().then(cb => setCircuitBreakerOpen(cb.is_open));
  }, []);

  const runSync = async (mode: 'full' | 'incremental') => {
    const blocked = await preflight(`sync-bulk-${mode}`, 'sync_massive', 'bulk_sync');
    if (blocked) {
      setSyncResult({ ok: false, error: blocked });
      return;
    }

    setSyncing(true); setSyncResult(null);
    setSyncProgress({ percent: 0, page: 0, totalPages: 0, fetched: 0, totalInSicas: 0 });
    try {
      const result = await callEdgeFunction('sicas-bulk-sync', { action: 'start', mode, triggeredBy: userId || null });
      if (!result.ok) { setSyncResult(result); setSyncing(false); setSyncProgress(null); releaseClientLock(`sync-bulk-${mode}`); return; }
      setActiveJobId(result.jobId as string);
      if (result.alreadyRunning) {
        const p = result.progress as any;
        setSyncProgress({ percent: p?.percent || 0, page: p?.currentPage || 0, totalPages: p?.totalPages || 0, fetched: p?.totalSynced || 0, totalInSicas: p?.totalInSicas || 0 });
      }
    } catch (err: any) {
      setSyncResult({ ok: false, error: err?.message || 'Error desconocido' });
      setSyncing(false); setSyncProgress(null);
    } finally {
      releaseClientLock(`sync-bulk-${mode}`);
    }
  };

  const cancelSync = async () => {
    if (!activeJobId) return;
    try { await callEdgeFunction('sicas-bulk-sync', { action: 'cancel', jobId: activeJobId }); } catch {}
  };

  const runDiagnostic = async () => {
    setDiagRunning(true); setDiagResult(null); setExpandedCode(null);
    try {
      const result = await callEdgeFunction('sicas-bulk-sync', { action: 'diagnostic', testAll: true, items: 3, triggeredBy: userId || null });
      if (result.results) {
        setDiagResult({
          results: result.results,
          recommendedKeyCode: result.recommendedKeyCode,
          recommendedVariant: result.recommendedVariant,
          recommendedFormat: result.recommendedFormat,
        });
        // Auto-trigger full sync if diagnostic validated a keycode
        if (result.recommendedKeyCode) {
          await loadSyncInfo();
          // Small delay to let config propagate then auto-start sync
          setTimeout(() => runSync('full'), 1500);
          return;
        }
      }
      loadSyncInfo();
    } catch (err: any) {
      setDiagResult({
        results: [{
          code: 'ERROR',
          variants: [{ variant: 'error', description: 'Error de conexion', conditionsAdd: '', typeFormat: 'XML', records: 0, totalRecords: 0, responseLength: 0, durationMs: 0, parseStatus: 'soap_error', error: err?.message || 'Error desconocido' }],
          bestVariant: null,
          hasData: false,
        }],
        recommendedKeyCode: null,
      });
    } finally { setDiagRunning(false); }
  };

  const activateReport = async (code: string) => {
    setActivatingReport(true);
    try {
      await supabase.from('sicas_config').update({
        current_report_code: code,
        last_successful_report: code,
      }).not('id', 'is', null);
      await loadSyncInfo();
    } catch { /* silent */ }
    finally { setActivatingReport(false); }
  };

  const hasValidatedReport = !!sicasConfig?.report_test_history?.recommended_code || !!diagResult?.recommendedKeyCode;

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

      {circuitBreakerOpen && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">SICAS con intermitencia</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">SICAS esta respondiendo con errores o lentitud. Los procesos automaticos estan pausados temporalmente para evitar saturacion. Se reanudan automaticamente.</p>
          </div>
        </div>
      )}

      {activeSection === 'mapeo' ? (
        <MapeoUsuariosSICAS callApi={(body) => callEdgeFunction('sicas-production-query', body)} />
      ) : (
        <>
          {/* Status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard icon={Database} label="Documentos Locales" value={totalDocs !== null ? formatNumber(totalDocs) : '-'} color={accentColor} subtitle={sicasConfig?.last_successful_historic_report ? `Via ${sicasConfig.last_successful_historic_report}` : undefined} />
            <StatusCard icon={Clock} label="Ultima Sincronizacion" value={lastSync?.started_at ? formatDate(lastSync.started_at) : 'Nunca'} color={accentColor} subtitle={lastSync ? (lastSync.status === 'success' || lastSync.status === 'completed' ? `${formatNumber(lastSync.records_upserted)} docs unicos` : lastSync.status === 'running' ? 'En progreso...' : 'Error') : undefined} />
            <StatusCard icon={Info} label="Estado" value={totalDocs === 0 ? 'Sin datos' : sicasConfig?.local_first_mode ? 'Local First' : 'Datos disponibles'} color={totalDocs === 0 ? '#f59e0b' : '#10b981'} subtitle={sicasConfig?.local_first_mode && totalDocs && totalDocs > 0 ? 'Modo estable' : undefined} />
          </div>

          {/* Local First Safe Mode banner */}
          {sicasConfig?.local_first_mode && totalDocs !== null && totalDocs > 0 && (
            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Modo Local First activo</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  MOVI cuenta con {formatNumber(totalDocs)} documentos sincronizados localmente. Los modulos de produccion, cartera, renovaciones y busqueda operan con estos datos.
                  {sicasConfig.use_rest === false && ' REST deshabilitado.'}
                  {!sicasConfig.auto_sync_enabled && ' Sincronizacion automatica pausada.'}
                </p>
              </div>
            </div>
          )}

          {/* Sync buttons */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Cloud className="w-4 h-4" style={{ color: accentColor }} /> Sincronizar con SICAS
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">La sincronizacion descarga documentos desde SICAS y continua en segundo plano aunque cierres esta pagina.</p>

            {sicasConfig?.local_first_mode && !sicasConfig?.auto_sync_enabled && (
              <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Sincronizacion masiva deshabilitada temporalmente</p>
                    <p className="mt-0.5 opacity-80">La plataforma opera con datos locales. Para reactivar la sincronizacion, valida un KeyCode SOAP con el diagnostico ligero y activa el reporte validado.</p>
                  </div>
                </div>
              </div>
            )}
            {!sicasConfig?.local_first_mode && !hasValidatedReport && !sicasConfig?.last_successful_report && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">No hay reporte SOAP validado para documentos</p>
                    <p className="mt-0.5 opacity-80">Ejecuta el diagnostico SOAP para identificar y validar un reporte antes de sincronizar.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button onClick={() => runSync('full')} disabled={syncing || diagRunning || (!!sicasConfig?.local_first_mode && !hasValidatedReport)} className="flex items-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 text-sm font-medium" style={{ backgroundColor: accentColor }}>
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Sincronizacion Completa
              </button>
              <button onClick={() => runSync('incremental')} disabled={syncing || diagRunning || (!!sicasConfig?.local_first_mode && !hasValidatedReport)} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 text-sm font-medium">
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
              <div className={`mt-4 p-3 rounded-lg border text-sm ${
                syncResult.ok
                  ? syncResult.status === 'empty'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}>
                <div className="flex items-start gap-2">
                  {syncResult.ok
                    ? syncResult.status === 'empty'
                      ? <Info className="w-4 h-4 mt-0.5 shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-medium">
                      {syncResult.ok
                        ? syncResult.status === 'empty'
                          ? 'SOAP sin resultados - datos locales disponibles'
                          : 'Sincronizacion completa'
                        : 'Error en sincronizacion'}
                    </p>
                    {syncResult.ok && syncResult.status === 'empty' && (
                      <p className="text-xs mt-1 opacity-80">
                        La consulta SOAP no devolvio registros nuevos, pero hay {formatNumber(syncResult.localDocsAvailable || totalDocs || 0)} documentos locales disponibles de sincronizaciones anteriores. Los modulos funcionan con normalidad.
                      </p>
                    )}
                    {syncResult.ok && syncResult.status !== 'empty' && syncResult.stats && <p className="text-xs mt-1 opacity-80">{formatNumber(syncResult.stats.documentsUpserted)} documentos sincronizados</p>}
                    {!syncResult.ok && <p className="text-xs mt-1 opacity-80">{syncResult.error as string}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostic & Config */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-4 h-4" style={{ color: accentColor }} /> Diagnostico SOAP
              </h3>
              <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                <Settings2 className="w-3.5 h-3.5" /> {showConfig ? 'Ocultar config' : 'Ver config'}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Prueba ligera: consulta 3 registros por cada KeyCode con variantes (sin filtro, FCaptura, FDesde, JSON) para identificar que reporte devuelve documentos realmente.
            </p>

            <button onClick={runDiagnostic} disabled={diagRunning || syncing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              {diagRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />} Ejecutar diagnostico
            </button>

            {diagResult && (
              <div className="mt-4 space-y-2">
                {/* Recommendation banner */}
                {diagResult.recommendedKeyCode ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="text-xs text-emerald-800 dark:text-emerald-300">
                      <p className="font-medium">Reporte validado: <span className="font-mono">{diagResult.recommendedKeyCode}</span></p>
                      <p className="opacity-80 mt-0.5">Variante: {diagResult.recommendedVariant} | Formato: {diagResult.recommendedFormat}</p>
                    </div>
                    {diagResult.recommendedKeyCode !== sicasConfig?.current_report_code && (
                      <button
                        onClick={() => activateReport(diagResult.recommendedKeyCode!)}
                        disabled={activatingReport}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {activatingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Usar como activo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-medium">Ningun reporte SOAP devolvio documentos con las variantes probadas.</p>
                    <p className="mt-0.5 opacity-80">Expande cada KeyCode para ver detalles de la respuesta y verificar si el reporte existe o las condiciones no coinciden.</p>
                  </div>
                )}

                {/* Per-code results */}
                {diagResult.results.map(r => (
                  <div key={r.code} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedCode(expandedCode === r.code ? null : r.code)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs ${r.hasData ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-gray-50 dark:bg-gray-800/50'}`}
                    >
                      <div className="flex items-center gap-2">
                        {r.hasData ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{r.code}</span>
                        {r.hasData && <span className="text-emerald-600 dark:text-emerald-400 font-medium">- Datos detectados</span>}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <span>{r.variants.length} variantes</span>
                        <span className="text-[10px]">{expandedCode === r.code ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {expandedCode === r.code && (
                      <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {r.variants.map((v, idx) => (
                          <div key={idx} className="px-3 py-2.5 text-[11px]">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{v.description}</span>
                              <div className="flex items-center gap-2">
                                <ParseStatusBadge status={v.parseStatus} />
                                <span className="text-gray-400">{v.durationMs}ms</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                              <div><span className="text-gray-400">Formato:</span> {v.typeFormat}</div>
                              <div><span className="text-gray-400">Rows:</span> {v.records}</div>
                              <div><span className="text-gray-400">Response:</span> {formatNumber(v.responseLength)} bytes</div>
                              <div><span className="text-gray-400">RESPONSENBR:</span> {v.responseNbr || '-'}</div>
                            </div>
                            {v.conditionsAdd && (
                              <div className="mt-1.5 text-[10px]">
                                <span className="text-gray-400">ConditionsAdd:</span>
                                <code className="ml-1 font-mono text-gray-600 dark:text-gray-400 break-all">{v.conditionsAdd.substring(0, 120)}{v.conditionsAdd.length > 120 ? '...' : ''}</code>
                              </div>
                            )}
                            {v.error && (
                              <p className="mt-1.5 text-red-600 dark:text-red-400 text-[10px]">{v.error}</p>
                            )}
                            {v.sampleFields && v.sampleFields.length > 0 && (
                              <div className="mt-1.5 text-[10px]">
                                <span className="text-gray-400">Campos detectados:</span>
                                <span className="ml-1 font-mono text-gray-600 dark:text-gray-400">{v.sampleFields.join(', ')}</span>
                              </div>
                            )}
                            {v.responsePreview && v.parseStatus !== 'parsed' && (
                              <details className="mt-1.5">
                                <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">Ver response preview</summary>
                                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-[9px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto max-h-24 overflow-y-auto">{v.responsePreview}</pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {showConfig && sicasConfig && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Modo:</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{sicasConfig.local_first_mode ? 'LOCAL FIRST' : 'Normal'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">REST:</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{sicasConfig.use_rest ? 'Habilitado' : 'Deshabilitado'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Sync auto:</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{sicasConfig.auto_sync_enabled ? 'Activo' : 'Pausado'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Mejor sincronizacion historica:</span>
                    <p className="font-mono font-medium text-gray-800 dark:text-gray-200">{sicasConfig.last_successful_historic_report || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Docs de esa sync:</span>
                    <p className="font-mono font-medium text-gray-800 dark:text-gray-200">{sicasConfig.last_successful_local_count ? formatNumber(sicasConfig.last_successful_local_count) : 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Reporte SOAP activo:</span>
                    <p className="font-mono font-medium text-gray-800 dark:text-gray-200">{sicasConfig.current_report_code || 'Ninguno (requiere validacion)'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Diagnostico SOAP:</span>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{sicasConfig.soap_diagnostic_enabled !== false ? 'Habilitado (ligero)' : 'Deshabilitado'}</p>
                  </div>
                </div>
                {sicasConfig.report_test_history?.last_diagnostic_at && (
                  <div className="text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Ultimo diagnostico:</span>
                    <span className="ml-1 text-gray-700 dark:text-gray-300">{formatDate(sicasConfig.report_test_history.last_diagnostic_at)}</span>
                  </div>
                )}
                <div className="text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Cadena de fallback (diagnostico):</span>
                  <p className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">HWS_DOCTOS → H03117 → HWS03668_WS → H03400</p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">HAPPDATAL_D004 excluido (es para cobranza, no documentos)</p>
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
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Metodo</th>
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
                        <td className="px-3 py-2">
                          <SourceBadge source={run.source_api || 'SOAP'} />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{(run.keycode || run.module).replace(/_SOAP$|_REST$|_DIAGNOSTIC$|^DIAGNOSTIC_?/, '')}</td>
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

  const label = status === 'empty' ? 'sin datos SOAP' : status;

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${classes}`}>{label}</span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const classes = source === 'REST'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
    : source === 'DIAGNOSTIC'
    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${classes}`}>{source}</span>
  );
}

function ParseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    parsed: { label: 'Parseado', classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    no_data: { label: 'Sin datos', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    parse_failed: { label: 'Parse fallido', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    soap_error: { label: 'Error SOAP', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  };
  const entry = map[status] || { label: status, classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${entry.classes}`}>{entry.label}</span>
  );
}
