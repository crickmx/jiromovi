import { useState, useEffect, useCallback } from 'react';
import {
  X, Target, TrendingUp, TrendingDown, DollarSign, FileText,
  Calendar, Award, Zap, AlertCircle, ChevronRight, ArrowRight,
  Users, Eye, ChevronLeft,
} from 'lucide-react';
import type { AvanceComercialData, DashboardScope, SicasDocRow } from '../../lib/sicasDashboardTypes';
import { formatFullCurrency, formatNumber, formatDate } from '../../lib/sicasDashboardTypes';
import { fetchDocuments } from '../../lib/sicasDashboardService';

interface Props {
  data: AvanceComercialData;
  accentColor: string;
  userId: string;
  scope: DashboardScope | null;
  vendedorId?: string;
  onClose: () => void;
  onDocumentClick: (docId: string) => void;
}

type ViewMode = 'dashboard' | 'docs-actual' | 'docs-anterior';

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function AvanceComercialModal({
  data, accentColor, userId, scope, vendedorId, onClose, onDocumentClick,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [docs, setDocs] = useState<SicasDocRow[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docPage, setDocPage] = useState(1);
  const docPageSize = 25;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const loadDocs = useCallback(async (mode: 'docs-actual' | 'docs-anterior') => {
    if (!userId || !scope) return;
    setLoadingDocs(true);
    const isActual = mode === 'docs-actual';
    const period = isActual ? data.periodo_actual : data.periodo_anterior;
    try {
      const result = await fetchDocuments({
        userId,
        scope: scope.scope,
        oficinaId: scope.oficina_id || undefined,
        vendedorId,
        fechaDesde: period.fecha_desde,
        fechaHasta: period.fecha_hasta,
        page: docPage,
        pageSize: docPageSize,
        orderBy: 'fecha_captura',
        orderAsc: false,
      });
      setDocs(result.data);
      setDocCount(result.count);
    } catch {
      setDocs([]);
      setDocCount(0);
    } finally {
      setLoadingDocs(false);
    }
  }, [userId, scope, vendedorId, data, docPage]);

  useEffect(() => {
    if (viewMode === 'docs-actual' || viewMode === 'docs-anterior') {
      loadDocs(viewMode);
    }
  }, [viewMode, loadDocs]);

  const handleViewDocs = (mode: 'docs-actual' | 'docs-anterior') => {
    setDocPage(1);
    setViewMode(mode);
  };

  const mesLabel = MONTHS_ES[(data.mes_actual || 1) - 1] || '';
  const anioActual = new Date(data.periodo_actual.fecha_desde).getFullYear();
  const anioAnterior = anioActual - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(59,130,246,0.15),transparent_60%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {viewMode !== 'dashboard' && (
                <button onClick={() => setViewMode('dashboard')} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-white/80" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Avance Comercial</h2>
                <p className="text-white/50 text-xs">
                  {viewMode === 'dashboard'
                    ? `${mesLabel} ${anioActual} vs ${anioAnterior}`
                    : viewMode === 'docs-actual'
                    ? `Documentos del periodo actual`
                    : `Documentos del mismo periodo ${anioAnterior}`
                  }
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'dashboard' ? (
            <DashboardView
              data={data}
              accentColor={accentColor}
              mesLabel={mesLabel}
              anioActual={anioActual}
              anioAnterior={anioAnterior}
              onViewDocs={handleViewDocs}
            />
          ) : (
            <DocsListView
              docs={docs}
              count={docCount}
              loading={loadingDocs}
              page={docPage}
              pageSize={docPageSize}
              onPageChange={setDocPage}
              onDocClick={onDocumentClick}
              isActual={viewMode === 'docs-actual'}
              data={data}
              anioAnterior={anioAnterior}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ data, accentColor, mesLabel, anioActual, anioAnterior, onViewDocs }: {
  data: AvanceComercialData;
  accentColor: string;
  mesLabel: string;
  anioActual: number;
  anioAnterior: number;
  onViewDocs: (mode: 'docs-actual' | 'docs-anterior') => void;
}) {
  const c = data.crecimiento;

  return (
    <div className="p-6 space-y-6">

      {/* Top status banner */}
      <StatusBanner data={data} />

      {/* === PRIMA NETA BLOCK === */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Prima Neta</h3>
        </div>

        {/* Three-column comparison */}
        <div className="grid grid-cols-3 gap-3">
          <MetricBlock
            label={`${mesLabel} ${anioActual}`}
            sublabel="Periodo actual"
            value={formatFullCurrency(data.periodo_actual.prima_neta)}
            accentColor={accentColor}
            isCurrent
          />
          <MetricBlock
            label={`${mesLabel} ${anioAnterior}`}
            sublabel="Mismo periodo anterior"
            value={formatFullCurrency(data.periodo_anterior.prima_neta)}
            accentColor="#6b7280"
          />
          <MetricBlock
            label={`Meta mensual ${anioActual}`}
            sublabel={`Base: ${anioAnterior} + 20%`}
            value={formatFullCurrency(data.meta_mensual.prima_neta)}
            accentColor="#f59e0b"
            isGoal
          />
        </div>

        {/* Progress bar toward monthly goal */}
        <div className="mt-4">
          <ProgressBar
            current={data.periodo_actual.prima_neta}
            goal={data.meta_mensual.prima_neta}
            previous={data.periodo_anterior.prima_neta}
            percent={c.avance_meta_prima_pct}
            label="Avance vs meta mensual"
            formatValue={formatFullCurrency}
            accentColor={accentColor}
          />
        </div>

        {/* Delta row */}
        <div className="mt-3 flex flex-wrap gap-2">
          <DeltaPill
            label="vs mismo periodo"
            value={c.prima_delta}
            percent={c.prima_vs_anterior}
            formatValue={formatFullCurrency}
          />
          <DeltaPill
            label="YTD vs anterior"
            value={data.ytd_actual.prima_neta - data.ytd_anterior.prima_neta}
            percent={c.ytd_prima_vs_anterior}
            formatValue={formatFullCurrency}
          />
          {c.falta_prima > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <Target className="w-3 h-3" />
              Faltan {formatFullCurrency(c.falta_prima)} para la meta
            </span>
          )}
        </div>
      </section>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* === POLIZAS BLOCK === */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Polizas Emitidas</h3>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MetricBlock
            label={`${mesLabel} ${anioActual}`}
            sublabel="Periodo actual"
            value={formatNumber(data.periodo_actual.polizas)}
            accentColor={accentColor}
            isCurrent
          />
          <MetricBlock
            label={`${mesLabel} ${anioAnterior}`}
            sublabel="Mismo periodo anterior"
            value={formatNumber(data.periodo_anterior.polizas)}
            accentColor="#6b7280"
          />
          <MetricBlock
            label={`Meta mensual ${anioActual}`}
            sublabel={`Base: ${anioAnterior} + 20%`}
            value={formatNumber(data.meta_mensual.polizas)}
            accentColor="#f59e0b"
            isGoal
          />
        </div>

        <div className="mt-4">
          <ProgressBar
            current={data.periodo_actual.polizas}
            goal={data.meta_mensual.polizas}
            previous={data.periodo_anterior.polizas}
            percent={c.avance_meta_polizas_pct}
            label="Avance vs meta mensual"
            formatValue={v => formatNumber(Math.round(v))}
            accentColor={accentColor}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <DeltaPill
            label="vs mismo periodo"
            value={c.polizas_delta}
            percent={c.polizas_vs_anterior}
            formatValue={v => `${v > 0 ? '+' : ''}${formatNumber(Math.round(v))}`}
          />
          {c.falta_polizas > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <Target className="w-3 h-3" />
              Faltan {formatNumber(c.falta_polizas)} polizas para la meta
            </span>
          )}
        </div>
      </section>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* === YTD ANNUAL PROGRESS === */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Avance Acumulado Anual</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Prima YTD */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Prima Neta YTD</p>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatFullCurrency(data.ytd_actual.prima_neta)}</span>
              <DeltaPill
                label=""
                value={data.ytd_actual.prima_neta - data.ytd_anterior.prima_neta}
                percent={c.ytd_prima_vs_anterior}
                formatValue={formatFullCurrency}
                compact
              />
            </div>
            <ProgressBar
              current={data.ytd_actual.prima_neta}
              goal={data.meta_anual.prima_neta}
              previous={data.ytd_anterior.prima_neta}
              percent={c.avance_meta_anual_prima_pct}
              label={`Meta anual: ${formatFullCurrency(data.meta_anual.prima_neta)}`}
              formatValue={formatFullCurrency}
              accentColor="#06b6d4"
            />
          </div>

          {/* Polizas YTD */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Polizas YTD</p>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(data.ytd_actual.polizas)}</span>
              <DeltaPill
                label=""
                value={data.ytd_actual.polizas - data.ytd_anterior.polizas}
                percent={c.ytd_polizas_vs_anterior}
                formatValue={v => `${v > 0 ? '+' : ''}${formatNumber(Math.round(v))}`}
                compact
              />
            </div>
            <ProgressBar
              current={data.ytd_actual.polizas}
              goal={data.meta_anual.polizas}
              previous={data.ytd_anterior.polizas}
              percent={c.avance_meta_anual_polizas_pct}
              label={`Meta anual: ${formatNumber(data.meta_anual.polizas)}`}
              formatValue={v => formatNumber(Math.round(v))}
              accentColor="#06b6d4"
            />
          </div>
        </div>

        {/* Base calculation explainer */}
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>
            Meta anual calculada sobre la produccion completa de {anioAnterior}{' '}
            ({formatFullCurrency(data.anual_anterior_completo.prima_neta)}) + 20% de crecimiento.
            Meta mensual equivalente: {formatFullCurrency(data.meta_mensual.prima_neta)}.
          </p>
        </div>
      </section>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* === DOCUMENT DRILL DOWN === */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white">Explorar Documentos</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onViewDocs('docs-actual')}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor + '15' }}>
                <FileText className="w-4 h-4" style={{ color: accentColor }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Periodo actual</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(data.periodo_actual.fecha_desde)} - {formatDate(data.periodo_actual.fecha_hasta)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatNumber(data.periodo_actual.total_docs)} documentos</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </button>

          <button
            onClick={() => onViewDocs('docs-anterior')}
            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Mismo periodo {anioAnterior}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(data.periodo_anterior.fecha_desde)} - {formatDate(data.periodo_anterior.fecha_hasta)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatNumber(data.periodo_anterior.total_docs)} documentos</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </button>
        </div>
      </section>
    </div>
  );
}

// ======= HELPER COMPONENTS =======

function StatusBanner({ data }: { data: AvanceComercialData }) {
  const avance = data.crecimiento.avance_meta_prima_pct;
  const crec = data.crecimiento.prima_vs_anterior;

  let config: { bg: string; icon: React.ElementType; text: string; desc: string };
  if (avance >= 100 && crec >= 0) {
    config = { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Award, text: 'text-emerald-800 dark:text-emerald-300', desc: 'Has superado la meta del mes y creces vs el anio anterior.' };
  } else if (avance >= 100) {
    config = { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Award, text: 'text-emerald-800 dark:text-emerald-300', desc: 'Meta mensual cumplida. Mantener el ritmo para cerrar arriba.' };
  } else if (avance >= 70 || crec > 10) {
    config = { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: TrendingUp, text: 'text-blue-800 dark:text-blue-300', desc: 'Buen ritmo de produccion. Sigues en camino hacia la meta.' };
  } else if (avance >= 40) {
    config = { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: Zap, text: 'text-amber-800 dark:text-amber-300', desc: 'Hay oportunidad de acelerar para alcanzar la meta del mes.' };
  } else {
    config = { bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertCircle, text: 'text-red-800 dark:text-red-300', desc: 'Atencion: la produccion esta por debajo del ritmo esperado.' };
  }

  const Icon = config.icon;

  return (
    <div className={`${config.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
      <Icon className={`w-5 h-5 shrink-0 ${config.text}`} />
      <p className={`text-sm font-medium ${config.text}`}>{config.desc}</p>
    </div>
  );
}

function MetricBlock({ label, sublabel, value, accentColor, isCurrent, isGoal }: {
  label: string;
  sublabel: string;
  value: string;
  accentColor: string;
  isCurrent?: boolean;
  isGoal?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border transition-all ${
      isCurrent
        ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 ring-2 ring-offset-2 dark:ring-offset-gray-900'
        : isGoal
        ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}
      style={isCurrent ? { ringColor: accentColor } : undefined}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">{sublabel}</p>
      <p className={`text-xl font-bold ${isCurrent ? 'text-gray-900 dark:text-white' : isGoal ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
        {value}
      </p>
      {isGoal && <div className="mt-1 flex items-center gap-1"><Target className="w-3 h-3 text-amber-500" /><span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Meta</span></div>}
      {isCurrent && <div className="mt-1 flex items-center gap-1"><Zap className="w-3 h-3" style={{ color: accentColor }} /><span className="text-[10px] font-medium" style={{ color: accentColor }}>Actual</span></div>}
    </div>
  );
}

function ProgressBar({ current, goal, previous, percent, label, formatValue, accentColor }: {
  current: number;
  goal: number;
  previous: number;
  percent: number;
  label: string;
  formatValue: (v: number) => string;
  accentColor: string;
}) {
  const cappedPercent = Math.min(percent, 100);
  const prevPercent = goal > 0 ? Math.min((previous / goal) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-xs font-bold" style={{ color: percent >= 100 ? '#10b981' : accentColor }}>
          {Math.round(percent)}%
        </span>
      </div>
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Previous year marker */}
        {prevPercent > 0 && prevPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400 dark:bg-gray-500 z-10"
            style={{ left: `${prevPercent}%` }}
            title={`${formatValue(previous)} (anterior)`}
          />
        )}
        {/* Current progress */}
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{
            width: `${cappedPercent}%`,
            background: percent >= 100
              ? 'linear-gradient(90deg, #10b981, #06d6a0)'
              : `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
          }}
        >
          {percent >= 100 && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2">
              <Award className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400">{formatValue(current)}</span>
        <span className="text-[10px] text-gray-400">
          {percent >= 100 ? 'Meta cumplida' : `Faltan ${formatValue(Math.max(goal - current, 0))}`}
        </span>
      </div>
    </div>
  );
}

function DeltaPill({ label, value, percent, formatValue, compact }: {
  label: string;
  value: number;
  percent: number;
  formatValue: (v: number) => string;
  compact?: boolean;
}) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'} rounded-full text-xs font-medium ${
      isPositive
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
    }`}>
      <Icon className="w-3 h-3" />
      {!compact && label && <span>{label}:</span>}
      <span className="font-bold">{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</span>
    </span>
  );
}

// ======= DOCUMENT LIST VIEW =======

function DocsListView({ docs, count, loading, page, pageSize, onPageChange, onDocClick, isActual, data, anioAnterior }: {
  docs: SicasDocRow[];
  count: number;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onDocClick: (id: string) => void;
  isActual: boolean;
  data: AvanceComercialData;
  anioAnterior: number;
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const period = isActual ? data.periodo_actual : data.periodo_anterior;

  return (
    <div className="p-6 space-y-4">
      {/* Period summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Periodo</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatDate(period.fecha_desde)} - {formatDate(period.fecha_hasta)}
          </p>
        </div>
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
        <div>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Prima neta</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatFullCurrency(period.prima_neta)}</p>
        </div>
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
        <div>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Documentos</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatNumber(period.total_docs)}</p>
        </div>
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
        <div>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">Clientes</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatNumber(period.clientes)}</p>
        </div>
      </div>

      {/* Document table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No se encontraron documentos en este periodo</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Poliza</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Cliente</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Aseguradora</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">Ramo</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Prima Neta</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Fecha</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => onDocClick(d.id)}
                  >
                    <td className="py-2 px-3 text-xs font-mono text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{d.poliza || '-'}</td>
                    <td className="py-2 px-3 text-xs text-gray-900 dark:text-white truncate max-w-[180px]">{d.cliente || '-'}</td>
                    <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[140px] hidden md:table-cell">{d.compania || '-'}</td>
                    <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 truncate max-w-[100px] hidden lg:table-cell">{d.ramo || '-'}</td>
                    <td className="py-2 px-3 text-xs text-right font-semibold text-gray-900 dark:text-white">{formatFullCurrency(d.prima_neta)}</td>
                    <td className="py-2 px-3 text-xs text-center text-gray-500 dark:text-gray-400 hidden sm:table-cell">{formatDate(d.fecha_captura)}</td>
                    <td className="py-2 px-3 text-center">
                      <Eye className="w-3.5 h-3.5 text-gray-400 hover:text-blue-600 transition-colors inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatNumber(count)} documentos
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400 px-2">{page} / {totalPages}</span>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
