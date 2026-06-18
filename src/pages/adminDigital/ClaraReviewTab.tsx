import { useRef, useState, useEffect } from 'react';
import { Upload, Brain, FileSpreadsheet, CheckCircle, Zap, AlertTriangle, Calendar, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { ClaraTransaction, VendorMapping } from './claraUtils';
import { cleanVendorName, findBestMappingMatch, normalizeHeader, parseCSVAmount } from './claraUtils';
import { derivePeriodKey, fetchExistingDedupKeys } from './claraService';

interface Props {
  transactions: ClaraTransaction[];
  costCenters: string[];
  simpleConcepts: string[];
  vendorMappings: VendorMapping[];
  onTransactionsLoaded: (txns: ClaraTransaction[], fileName: string) => void;
  onSaveAndLearn: () => void;
  onUpdateRow: (id: number, field: 'cost_center' | 'simple_concept' | 'description', value: string) => void;
  isSaving: boolean;
  fileName: string;
}

export function ClaraReviewTab({
  transactions,
  costCenters,
  simpleConcepts,
  vendorMappings,
  onTransactionsLoaded,
  onSaveAndLearn,
  onUpdateRow,
  isSaving,
  fileName,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checkingDups, setCheckingDups] = useState(false);
  const [periodInfo, setPeriodInfo] = useState<{ label: string; dateFrom: string; dateTo: string } | null>(null);

  useEffect(() => {
    if (transactions.length === 0) {
      setPeriodInfo(null);
      setDuplicateCount(0);
      return;
    }
    const { label, dateFrom, dateTo } = derivePeriodKey(transactions);
    setPeriodInfo({ label, dateFrom, dateTo });
  }, [transactions]);

  useEffect(() => {
    if (transactions.length === 0) return;
    setCheckingDups(true);
    fetchExistingDedupKeys(transactions)
      .then((existingKeys) => {
        const dups = transactions.filter((t) => {
          const key = `${t.auth_code}|${t.date.substring(0, 10)}|${t.amount_mxn}|${t.normalized_vendor}`;
          return existingKeys.has(key);
        }).length;
        setDuplicateCount(dups);
      })
      .catch(() => setDuplicateCount(0))
      .finally(() => setCheckingDups(false));
  }, [transactions]);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const data: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        data.push(row);
      }
      parseAndLoad(data, file.name);
    };
    reader.readAsText(file);
  };

  const parseAndLoad = (data: Record<string, string>[], name: string) => {
    if (data.length === 0) return;
    const actualKeys = Object.keys(data[0]);
    const mapped = {
      date: null as string | null,
      vendor: null as string | null,
      amount: null as string | null,
      status: null as string | null,
      card: null as string | null,
      auth: null as string | null,
    };
    for (const k of actualKeys) {
      const norm = normalizeHeader(k);
      if (!mapped.date && (norm.includes('fechadetrans') || norm === 'fecha')) mapped.date = k;
      else if (!mapped.vendor && (norm.includes('transac') || norm === 'proveedor' || norm.includes('comercio') || norm.includes('descripcion'))) mapped.vendor = k;
      else if (!mapped.amount && (norm.includes('montoenmxn') || norm === 'montomxn' || norm.includes('monto') || norm.includes('importe'))) mapped.amount = k;
      else if (!mapped.status && (norm === 'estado' || norm === 'status' || norm.includes('estatus'))) mapped.status = k;
      else if (!mapped.card && (norm.includes('alias') || norm === 'tarjeta' || norm.includes('tarjeta'))) mapped.card = k;
      else if (!mapped.auth && (norm.includes('autorizac') || norm === 'auth' || norm.includes('referencia'))) mapped.auth = k;
    }
    if (!mapped.date || !mapped.vendor || !mapped.amount) return;

    const filtered = mapped.status
      ? data.filter((r) => r[mapped.status!] && r[mapped.status!].toUpperCase() !== 'RECHAZADA')
      : data;

    const txns: ClaraTransaction[] = filtered.map((row, idx) => {
      const origVendor = row[mapped.vendor!] || 'PROVEEDOR DESCONOCIDO';
      const normalized = cleanVendorName(origVendor);
      const { match, type } = findBestMappingMatch(normalized, vendorMappings);
      return {
        id: idx,
        date: row[mapped.date!] || '',
        original_vendor: origVendor,
        normalized_vendor: normalized,
        amount_mxn: parseCSVAmount(row[mapped.amount!]),
        cost_center: match?.cost_center ?? (costCenters[0] || 'Sin Asignar'),
        simple_concept: match?.simple_concept ?? (simpleConcepts[0] || 'Otros'),
        description: match?.description ?? '',
        match_type: type,
        card_alias: row[mapped.card ?? ''] || '',
        auth_code: row[mapped.auth ?? ''] || '',
      };
    });
    onTransactionsLoaded(txns, name);
  };

  const handleExportExcel = () => {
    const rows = transactions.map((t) => ({
      Fecha: t.date.substring(0, 10),
      'Proveedor Original': t.original_vendor,
      'Proveedor Normalizado': t.normalized_vendor,
      'Monto MXN': t.amount_mxn,
      'Centro de Costo': t.cost_center,
      'Concepto Simple': t.simple_concept,
      Detalles: t.description,
      Tarjeta: t.card_alias,
      'Cod. Autorizacion': t.auth_code,
      'Tipo Coincidencia': t.match_type,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revision');
    XLSX.writeFile(wb, `Clara_Revision_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  const exactCount = transactions.filter((t) => t.match_type === 'Coincidencia Exacta').length;
  const fuzzyCount = transactions.filter((t) => t.match_type.includes('Aproximada')).length;
  const pendingCount = transactions.filter((t) => t.match_type === 'Requiere Asignacion').length;
  const newCount = transactions.length - duplicateCount;

  return (
    <div className="space-y-5">
      {/* Upload Zone */}
      <div
        ref={dropZoneRef}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          dropZoneRef.current?.classList.add('border-blue-400', 'bg-blue-50');
        }}
        onDragLeave={() => dropZoneRef.current?.classList.remove('border-blue-400', 'bg-blue-50')}
        onDrop={(e) => {
          e.preventDefault();
          dropZoneRef.current?.classList.remove('border-blue-400', 'bg-blue-50');
          const file = e.dataTransfer.files[0];
          if (file) processFile(file);
        }}
        className="bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer p-10 text-center"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sube el CSV exportado de Clara</p>
        <p className="text-xs text-gray-500 mt-1">Arrastra el archivo o haz clic para explorar</p>
        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {fileName}
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <>
          {/* Period banner */}
          {periodInfo && (
            <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Periodo detectado: {periodInfo.label}</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Del {periodInfo.dateFrom} al {periodInfo.dateTo} -- este archivo se guardara como un solo periodo.
                </p>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {checkingDups ? (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <Info className="w-4 h-4 animate-pulse" />
              Verificando duplicados en la base de datos...
            </div>
          ) : duplicateCount > 0 ? (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {duplicateCount} transaccion{duplicateCount !== 1 ? 'es' : ''} ya existe{duplicateCount !== 1 ? 'n' : ''} en la base de datos
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Se omitiran automaticamente al guardar. Solo se guardaran las <strong>{newCount} nuevas</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              Sin duplicados -- las {transactions.length} transacciones son nuevas.
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Cargadas</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{transactions.length}</p>
              {duplicateCount > 0 && (
                <p className="text-[10px] text-gray-400">{newCount} nuevas / {duplicateCount} dup.</p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 text-center">
              <p className="text-xs text-emerald-600">Exactas</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{exactCount}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-800 p-3 text-center">
              <p className="text-xs text-blue-600">Aproximadas</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{fuzzyCount}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-3 text-center">
              <p className="text-xs text-amber-600">Pendientes</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{pendingCount}</p>
            </div>
          </div>

          {/* Editor Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transacciones para Revision</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Asigna Centro de Costo, Concepto y Detalles a cada transaccion.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Fecha / Proveedor</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-gray-600 dark:text-gray-300">Monto MXN</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Coincidencia</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Centro de Costo</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Concepto</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transactions.map((t) => {
                    let badgeCls = 'bg-amber-100 text-amber-800 border-amber-200';
                    if (t.match_type === 'Coincidencia Exacta')
                      badgeCls = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    else if (t.match_type.includes('Aproximada'))
                      badgeCls = 'bg-blue-100 text-blue-800 border-blue-200';
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2">
                          <div className="text-[10px] text-gray-400">{t.date.substring(0, 10)}</div>
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">{t.original_vendor}</div>
                          <div className="text-[10px] text-gray-400 truncate">Norm: {t.normalized_vendor}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          $ {t.amount_mxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                            {t.match_type}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={t.cost_center}
                            onChange={(e) => onUpdateRow(t.id, 'cost_center', e.target.value)}
                            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 w-full max-w-[160px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                          >
                            {costCenters.map((cc) => (
                              <option key={cc} value={cc}>{cc}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={t.simple_concept}
                            onChange={(e) => onUpdateRow(t.id, 'simple_concept', e.target.value)}
                            className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 w-full max-w-[160px] focus:outline-none focus:ring-1 focus:ring-teal-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                          >
                            {simpleConcepts.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={t.description}
                            onChange={(e) => onUpdateRow(t.id, 'description', e.target.value)}
                            placeholder="Detalles..."
                            className="text-xs border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent hover:bg-gray-50 focus:bg-white dark:focus:bg-gray-700 rounded-sm px-1 py-1 w-full min-w-[140px] transition dark:text-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {duplicateCount > 0 && newCount === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Todas las transacciones ya existen. No hay nada nuevo que guardar.
              </p>
            ) : (
              <>
                <button
                  onClick={onSaveAndLearn}
                  disabled={isSaving || (duplicateCount > 0 && newCount === 0)}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Brain className="w-4 h-4" />
                  {isSaving ? 'Guardando...' : 'Guardar y Aprender'}
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel
                </button>
                {newCount > 0 && (
                  <span className="text-xs text-gray-500">
                    {newCount} transacciones nuevas seran guardadas.
                    {duplicateCount > 0 && ` ${duplicateCount} duplicadas seran omitidas.`}
                  </span>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
