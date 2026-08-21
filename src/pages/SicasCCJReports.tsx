import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type ReportType = 'efectuada' | 'pendiente';
type ReportRow = Record<string, string | number | null>;

interface Filters {
  fechaDesde: string;
  fechaHasta: string;
  compania: string;
  documento: string;
  vendedor: string;
  despacho: string;
  agente: string;
  ramo: string;
  subramo: string;
  gerencia: string;
}

interface ReportResponse {
  ok: boolean;
  error?: string;
  status?: 'queued' | 'running' | 'completed' | 'worker_started';
  columns: string[];
  rows: ReportRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  source: { api: string; keyCode: string; live: boolean };
  progress?: {
    runId?: string;
    nextPage?: number;
    sourceRowsProcessed?: number;
    resultRows?: number;
    startedAt?: string;
    updatedAt?: string;
    completedAt?: string;
  };
}

const EMPTY_FILTERS: Filters = {
  fechaDesde: '',
  fechaHasta: '',
  compania: '',
  documento: '',
  vendedor: '',
  despacho: '',
  agente: '',
  ramo: '',
  subramo: '',
  gerencia: '',
};

const FALLBACK_COLUMNS: Record<ReportType, string[]> = {
  efectuada: [
    'Fecha de Pago', 'FDesde', 'FHasta', 'Documento', 'PrimaNeta',
    'Nombre Compañía', 'ClaveVend', 'DespNombre', 'Moneda', 'TCDocto',
    'RamosNombre', 'Sub Ramo', 'VendNombre', 'EjecutNombre',
    'GerenciaNombre', 'CLIENTE', 'IMPORTE PESOS', 'CAgente', 'Serie',
    'Endoso', 'Renovacion', 'TipoEnt_TXT',
  ],
  pendiente: [
    'Documento', 'FDesde', 'FHasta', 'FLimPago', 'Serie', 'Endoso',
    'Nombre Compañía', 'RamosNombre', 'SRamoNombre', 'DespNombre',
    'GerenciaNombre', 'VendNombre', 'PrimaNeta', 'Moneda', 'Concepto',
    'NombreCompleto', 'Clave de Agente', 'FPago', 'PrimaNetaDocto',
    'PrimaTotalDocto', 'Status_TXT',
  ],
};

const MONEY_COLUMNS = new Set(['PrimaNeta', 'IMPORTE PESOS', 'PrimaNetaDocto', 'PrimaTotalDocto']);

function formatCell(column: string, value: ReportRow[string]) {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY_COLUMNS.has(column) && typeof value === 'number') {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  if (column === 'TCDocto' && typeof value === 'number') {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 6 }).format(value);
  }
  return String(value);
}

function compactFilters(filters: Filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== ''));
}

async function getInvokeError(error: unknown, data?: Partial<ReportResponse> | null) {
  if (data?.error) return data.error;
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const payload = await error.context.clone().json() as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      // Fall through to the SDK message when the response is not JSON.
    }
  }
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'No fue posible consultar SICAS. Intenta nuevamente.';
}

async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!error && session?.access_token) {
      const expiresSoon = !session.expires_at || session.expires_at * 1000 <= Date.now() + 60_000;
      if (!expiresSoon) return session.access_token;
    }
  }

  const { data: { session }, error } = await supabase.auth.refreshSession();
  if (error || !session?.access_token) {
    throw new Error('Tu sesión expiró. Recarga la página o vuelve a iniciar sesión.');
  }
  return session.access_token;
}

function isUnauthorized(error: unknown, data?: Partial<ReportResponse> | null) {
  if (data?.error === 'Sesión no válida.') return true;
  if (!error || typeof error !== 'object') return false;
  if ('context' in error && error.context instanceof Response) return error.context.status === 401;
  return false;
}

async function invokeReport(body: Record<string, unknown>, signal?: AbortSignal) {
  let accessToken = await getAccessToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase.functions.invoke<ReportResponse>('sicas-ccj-reports', {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
    if (attempt === 0 && isUnauthorized(result.error, result.data)) {
      accessToken = await getAccessToken(true);
      continue;
    }
    return result;
  }

  throw new Error('Tu sesión expiró. Recarga la página o vuelve a iniciar sesión.');
}

export default function SicasCCJReports() {
  const [reportType, setReportType] = useState<ReportType>('efectuada');
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [columns, setColumns] = useState<string[]>(FALLBACK_COLUMNS.efectuada);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, pages: 1 });
  const [source, setSource] = useState<ReportResponse['source'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [syncProgress, setSyncProgress] = useState<ReportResponse['progress'] | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const forceRefreshRef = useRef(false);
  const requestIdRef = useRef(0);

  const dateLabel = reportType === 'efectuada' ? 'Fecha de pago' : 'Fecha límite de pago';
  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter((value) => value.trim()).length,
    [appliedFilters],
  );

  const loadReport = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current;
    if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
    setLoading(true);
    setError('');
    try {
      const forceRefresh = forceRefreshRef.current;
      forceRefreshRef.current = false;
      const { data, error: invokeError } = await invokeReport({
        reportType,
        page,
        pageSize,
        forceRefresh,
        filters: compactFilters(appliedFilters),
      }, signal);
      if (requestId !== requestIdRef.current) return;
      if (invokeError || !data?.ok) throw new Error(await getInvokeError(invokeError, data));
      if (reportType === 'pendiente' && (data.status === 'queued' || data.status === 'running')) {
        setRows([]);
        setColumns(data.columns || FALLBACK_COLUMNS.pendiente);
        setPagination({ page: 1, pageSize, total: 0, pages: 1 });
        setSource(data.source || null);
        setSyncProgress(data.progress || {});
        pollTimerRef.current = window.setTimeout(() => setRefreshKey((value) => value + 1), 4000);
        return;
      }
      setSyncProgress(null);
      setRows(data.rows || []);
      setColumns(data.columns || FALLBACK_COLUMNS[reportType]);
      setPagination(data.pagination || { page, pageSize, total: data.rows?.length || 0, pages: 1 });
      setSource(data.source || null);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || signal?.aborted) return;
      setSyncProgress(null);
      setRows([]);
      setColumns(FALLBACK_COLUMNS[reportType]);
      setPagination({ page, pageSize, total: 0, pages: 1 });
      setError(await getInvokeError(loadError));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [appliedFilters, page, pageSize, refreshKey, reportType]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReport(controller.signal);
    return () => controller.abort();
  }, [loadReport]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    if (pollTimerRef.current !== null) window.clearTimeout(pollTimerRef.current);
  }, []);

  function selectReport(nextType: ReportType) {
    if (nextType === reportType) return;
    setReportType(nextType);
    setColumns(FALLBACK_COLUMNS[nextType]);
    setRows([]);
    setPage(1);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setError('');
    setSyncProgress(null);
  }

  function refreshReport() {
    forceRefreshRef.current = true;
    setPage(1);
    setRefreshKey((value) => value + 1);
  }

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    if ((draftFilters.fechaDesde && !draftFilters.fechaHasta) || (!draftFilters.fechaDesde && draftFilters.fechaHasta)) {
      setError('Para filtrar por fecha selecciona tanto la fecha inicial como la final.');
      return;
    }
    setError('');
    setPage(1);
    setAppliedFilters({ ...draftFilters });
  }

  function clearFilters() {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    setError('');
  }

  function updateFilter(key: keyof Filters, value: string) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  async function exportReport() {
    setExporting(true);
    setError('');
    try {
      const { data, error: invokeError } = await invokeReport({
        reportType,
        exportAll: true,
        filters: compactFilters(appliedFilters),
      });
      if (invokeError || !data?.ok) throw new Error(await getInvokeError(invokeError, data));
      if (reportType === 'pendiente' && (data.status === 'queued' || data.status === 'running')) {
        setSyncProgress(data.progress || {});
        pollTimerRef.current = window.setTimeout(() => setRefreshKey((value) => value + 1), 4000);
        throw new Error('La cartera pendiente se está actualizando. El Excel estará disponible al terminar la precarga.');
      }

      const exportColumns = data.columns || FALLBACK_COLUMNS[reportType];
      const exportRows = (data.rows || []).map((row) => exportColumns.map((column) => row[column] ?? ''));
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([exportColumns, ...exportRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja1');
      const filename = reportType === 'efectuada' ? 'COBRANZA EFECTUADA.xlsx' : 'COBRANZA PENDIENTE.xlsx';
      XLSX.writeFile(workbook, filename, { compression: true });
    } catch (exportError) {
      setError(await getInvokeError(exportError));
    } finally {
      setExporting(false);
    }
  }

  const firstRecord = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastRecord = pagination.total === 0 ? 0 : Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="h-full overflow-auto bg-neutral-50 dark:bg-neutral-950 p-4 sm:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
              <Database className="h-4 w-4" /> Datos en vivo desde SICAS
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Reportes SICAS CCJ</h1>
            <p className="mt-1 max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">
              Consulta cobranza efectuada y pendiente directamente en SICAS, y exporta cada resultado con las mismas columnas y orden de los archivos operativos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {source?.live && (
              <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> {source.api} · {source.keyCode}
              </span>
            )}
            <Button variant="outline" onClick={refreshReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
            <Button onClick={exportReport} disabled={loading || exporting || Boolean(syncProgress)}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? 'Preparando Excel…' : 'Exportar Excel'}
            </Button>
          </div>
        </div>

        <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          {(['efectuada', 'pendiente'] as ReportType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectReport(type)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                reportType === type
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              Cobranza {type}
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={applyFilters} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label htmlFor="fecha-desde">{dateLabel} desde</Label>
                  <Input id="fecha-desde" type="date" value={draftFilters.fechaDesde} onChange={(event) => updateFilter('fechaDesde', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="fecha-hasta">{dateLabel} hasta</Label>
                  <Input id="fecha-hasta" type="date" value={draftFilters.fechaHasta} onChange={(event) => updateFilter('fechaHasta', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="documento">Documento / póliza</Label>
                  <Input id="documento" value={draftFilters.documento} onChange={(event) => updateFilter('documento', event.target.value)} placeholder="Ej. 0822587H" />
                </div>
                <div>
                  <Label htmlFor="compania">Compañía</Label>
                  <Input id="compania" value={draftFilters.compania} onChange={(event) => updateFilter('compania', event.target.value)} placeholder="Ej. Qualitas" />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" className="flex-1"><Search className="h-4 w-4" /> Consultar</Button>
                  <Button type="button" variant="outline" size="icon" title="Más filtros" onClick={() => setShowAdvanced((value) => !value)}>
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {showAdvanced && (
                <div className="grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-white/10">
                  <div>
                    <Label htmlFor="vendedor">Vendedor</Label>
                    <Input id="vendedor" value={draftFilters.vendedor} onChange={(event) => updateFilter('vendedor', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="despacho">Despacho</Label>
                    <Input id="despacho" value={draftFilters.despacho} onChange={(event) => updateFilter('despacho', event.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="agente">Clave de agente</Label>
                    <Input id="agente" value={draftFilters.agente} onChange={(event) => updateFilter('agente', event.target.value)} />
                  </div>
                  {reportType === 'pendiente' && (
                    <>
                      <div>
                        <Label htmlFor="ramo">Ramo</Label>
                        <Input id="ramo" value={draftFilters.ramo} onChange={(event) => updateFilter('ramo', event.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="subramo">Subramo</Label>
                        <Input id="subramo" value={draftFilters.subramo} onChange={(event) => updateFilter('subramo', event.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="gerencia">Gerencia</Label>
                        <Input id="gerencia" value={draftFilters.gerencia} onChange={(event) => updateFilter('gerencia', event.target.value)} />
                      </div>
                    </>
                  )}
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" onClick={clearFilters} disabled={!Object.values(draftFilters).some(Boolean)}>
                      Limpiar filtros
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-medium">No se pudo completar la consulta</p><p className="mt-0.5 opacity-90">{error}</p></div>
          </div>
        )}

        {syncProgress && !error && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <div>
                <p className="font-medium">Preparando la cartera pendiente completa</p>
                <p className="mt-0.5 opacity-80">
                  {(syncProgress.sourceRowsProcessed || 0).toLocaleString('es-MX')} registros revisados · {(syncProgress.resultRows || 0).toLocaleString('es-MX')} pendientes guardados. Puedes dejar esta pantalla abierta; se actualizará automáticamente.
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-200/70 dark:bg-blue-950">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><FileSpreadsheet className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Cobranza {reportType}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {syncProgress ? 'Precargando todas las páginas de SICAS…' : loading ? 'Consultando SICAS…' : `${pagination.total.toLocaleString('es-MX')} registros${activeFilterCount ? ` · ${activeFilterCount} filtros activos` : ''}`}
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              Filas por página
              <select
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-neutral-800 outline-none dark:border-white/15 dark:bg-neutral-900 dark:text-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="relative min-h-[360px] overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-neutral-900/80">
                <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 dark:text-neutral-300"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Consultando reporte en vivo…</div>
              </div>
            )}
            <table className="w-max min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap border-b border-neutral-200 px-3 py-3 font-semibold dark:border-white/10">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white dark:divide-white/5 dark:bg-neutral-900">
                {!loading && rows.length === 0 ? (
                  <tr><td colSpan={columns.length} className="h-72 px-4 text-center text-sm text-neutral-400">No hay registros para los filtros seleccionados.</td></tr>
                ) : rows.map((row, rowIndex) => (
                  <tr key={`${String(row.Documento || '')}-${rowIndex}`} className="hover:bg-blue-50/40 dark:hover:bg-blue-500/5">
                    {columns.map((column) => (
                      <td
                        key={column}
                        className={`max-w-[320px] whitespace-nowrap px-3 py-2.5 text-neutral-700 dark:text-neutral-300 ${MONEY_COLUMNS.has(column) || column === 'TCDocto' ? 'text-right tabular-nums' : ''}`}
                        title={String(row[column] ?? '')}
                      >
                        <span className={column === 'Documento' ? 'font-medium text-neutral-950 dark:text-white' : ''}>{formatCell(column, row[column])}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:text-neutral-400">
            <span>Mostrando {firstRecord.toLocaleString('es-MX')}–{lastRecord.toLocaleString('es-MX')} de {pagination.total.toLocaleString('es-MX')}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || pagination.page <= 1}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="min-w-24 text-center">Página {pagination.page} de {Math.max(1, pagination.pages)}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))} disabled={loading || pagination.page >= pagination.pages}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
