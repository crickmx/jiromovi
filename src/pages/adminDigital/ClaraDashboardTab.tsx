import { useState, useEffect } from 'react';
import { Wallet, ListChecks, FileSpreadsheet, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { DBTransaction, ClaraPeriod } from './claraService';
import { fetchTransactions, fetchPeriods } from './claraService';
import { formatMXN } from './claraUtils';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#14b8a6', '#ef4444',
  '#06b6d4', '#64748b', '#a855f7', '#ec4899', '#84cc16',
];

function buildSummary(data: DBTransaction[], key: 'cost_center' | 'simple_concept') {
  const total = data.reduce((s, t) => s + Number(t.amount_mxn), 0);
  const map: Record<string, { amount: number; count: number }> = {};
  for (const t of data) {
    const k = t[key] || (key === 'cost_center' ? 'Sin Asignar' : 'Otros');
    if (!map[k]) map[k] = { amount: 0, count: 0 };
    map[k].amount += Number(t.amount_mxn);
    map[k].count += 1;
  }
  return Object.entries(map)
    .map(([name, v]) => ({
      name,
      amount: v.amount,
      count: v.count,
      pct: total > 0 ? (v.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function HorizontalBarChart({ data }: { data: { name: string; amount: number; pct: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-gray-400 italic text-center py-4">Sin datos</p>;
  const maxAmt = Math.max(...data.map((d) => d.amount));
  return (
    <div className="space-y-2">
      {data.slice(0, 8).map((item, i) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600 dark:text-gray-400 w-24 truncate text-right flex-shrink-0">
            {item.name}
          </span>
          <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden relative">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${maxAmt > 0 ? (item.amount / maxAmt) * 100 : 0}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-20 text-right flex-shrink-0">
            ${formatMXN(item.amount)}
          </span>
          <span className="text-[10px] text-gray-400 w-10 text-right flex-shrink-0">
            {item.pct.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({ rows }: { rows: { name: string; amount: number; count: number; pct: number }[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-200 dark:border-gray-700">
          <th className="text-left py-1.5 font-semibold text-gray-600 dark:text-gray-400">Nombre</th>
          <th className="text-center py-1.5 font-semibold text-gray-600 dark:text-gray-400">Cant</th>
          <th className="text-right py-1.5 font-semibold text-gray-600 dark:text-gray-400">Monto</th>
          <th className="text-right py-1.5 font-semibold text-gray-600 dark:text-gray-400">%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-b border-gray-50 dark:border-gray-800">
            <td className="py-1.5 text-gray-900 dark:text-gray-100 font-medium">{r.name}</td>
            <td className="py-1.5 text-center text-gray-600 dark:text-gray-400">{r.count}</td>
            <td className="py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">$ {formatMXN(r.amount)}</td>
            <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{r.pct.toFixed(1)}%</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="py-4 text-center text-gray-400 italic">Sin datos</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

type FilterMode = 'period' | 'dates';

export function ClaraDashboardTab() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.substring(0, 8) + '01';

  const [filterMode, setFilterMode] = useState<FilterMode>('period');
  const [periods, setPeriods] = useState<ClaraPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [transactions, setTransactions] = useState<DBTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCC, setFilterCC] = useState('Todos');
  const [filterConcept, setFilterConcept] = useState('Todos');

  const loadPeriods = async () => {
    try {
      const data = await fetchPeriods();
      setPeriods(data);
      if (data.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(data[0].id);
      }
    } catch { /* ignore */ }
  };

  const load = async () => {
    setLoading(true);
    setFilterCC('Todos');
    setFilterConcept('Todos');
    try {
      let data: DBTransaction[];
      if (filterMode === 'period' && selectedPeriodId) {
        data = await fetchTransactions(undefined, undefined, selectedPeriodId);
      } else {
        data = await fetchTransactions(startDate, endDate);
      }
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPeriods(); }, []);
  useEffect(() => { load(); }, [selectedPeriodId, filterMode]);

  const totalGasto = transactions.reduce((s, t) => s + Number(t.amount_mxn), 0);
  const ccSummary = buildSummary(transactions, 'cost_center');
  const conceptSummary = buildSummary(transactions, 'simple_concept');
  const drillData = transactions.filter((t) => {
    if (filterCC !== 'Todos' && t.cost_center !== filterCC) return false;
    if (filterConcept !== 'Todos' && t.simple_concept !== filterConcept) return false;
    return true;
  });

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsSumCC = XLSX.utils.json_to_sheet(
      ccSummary.map((r) => ({
        'Centro de Costo': r.name,
        Cantidad: r.count,
        'Monto MXN': r.amount,
        'Participacion %': Number(r.pct.toFixed(2)),
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsSumCC, 'Resumen Centros Costo');
    const wsSumConcept = XLSX.utils.json_to_sheet(
      conceptSummary.map((r) => ({
        'Concepto Simple': r.name,
        Cantidad: r.count,
        'Monto MXN': r.amount,
        'Participacion %': Number(r.pct.toFixed(2)),
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsSumConcept, 'Resumen Conceptos');
    const wsDetail = XLSX.utils.json_to_sheet(
      transactions.map((t) => ({
        Fecha: t.transaction_date,
        'Proveedor Original': t.original_vendor,
        'Proveedor Normalizado': t.normalized_vendor,
        'Monto MXN': Number(t.amount_mxn),
        'Centro de Costo': t.cost_center,
        'Concepto Simple': t.simple_concept,
        Detalles: t.description,
        Tarjeta: t.card_alias,
        'Cod. Autorizacion': t.auth_code,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle');
    XLSX.writeFile(wb, `Clara_Consolidado_${startDate}_a_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tablero de Conciliacion</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Filtra por periodo de carga o rango de fechas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('period')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filterMode === 'period' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Periodos
            </button>
            <button
              onClick={() => setFilterMode('dates')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filterMode === 'dates' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Rango Fechas
            </button>
            <button
              onClick={handleExportExcel}
              disabled={transactions.length === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1" />
              Excel
            </button>
          </div>
        </div>

        <div className="mt-4">
          {filterMode === 'period' ? (
            periods.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay periodos cargados aun.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      selectedPeriodId === p.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Desde</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Hasta</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                onClick={load}
                className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Buscar
              </button>
            </div>
          )}
        </div>

        {selectedPeriod && filterMode === 'period' && (
          <p className="text-[10px] text-gray-400 mt-2">
            {selectedPeriod.date_from} a {selectedPeriod.date_to} -- Archivo: {selectedPeriod.file_name || '--'}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 opacity-80" />
            <span className="text-xs font-medium opacity-80">Gasto Total Conciliado</span>
          </div>
          <p className="text-2xl font-bold">$ {formatMXN(totalGasto)} MXN</p>
          {selectedPeriod && filterMode === 'period' && (
            <p className="text-xs opacity-70 mt-1">{selectedPeriod.label}</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-5 h-5 opacity-80" />
            <span className="text-xs font-medium opacity-80">Transacciones</span>
          </div>
          <p className="text-2xl font-bold">{transactions.length}</p>
          {loading && <p className="text-xs opacity-70 mt-1">Cargando...</p>}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Por Centro de Costo</h4>
          <HorizontalBarChart data={ccSummary} />
          <hr className="my-4 border-gray-100 dark:border-gray-700" />
          <SummaryTable rows={ccSummary} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Por Concepto Simple</h4>
          <HorizontalBarChart data={conceptSummary} />
          <hr className="my-4 border-gray-100 dark:border-gray-700" />
          <SummaryTable rows={conceptSummary} />
        </div>
      </div>

      {/* Drill Down */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Detalle de Movimientos</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Filtra por centro de costo o concepto.</p>
          </div>
          <div className="flex gap-2">
            <select
              value={filterCC}
              onChange={(e) => setFilterCC(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Todos">Todos los centros</option>
              {ccSummary.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
            <select
              value={filterConcept}
              onChange={(e) => setFilterConcept(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="Todos">Todos los conceptos</option>
              {conceptSummary.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Proveedor</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Norm.</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">Monto MXN</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Centro de Costo</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Concepto</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {drillData.slice(0, 100).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.transaction_date}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white truncate max-w-[160px]">{t.original_vendor}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 truncate max-w-[140px]">{t.normalized_vendor}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">$ {formatMXN(Number(t.amount_mxn))}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.cost_center}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{t.simple_concept}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{t.description || '-'}</td>
                </tr>
              ))}
              {drillData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400 italic">
                    Sin transacciones en este periodo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {drillData.length > 100 && (
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-center">
            Mostrando 100 de {drillData.length} transacciones
          </div>
        )}
      </div>
    </div>
  );
}
