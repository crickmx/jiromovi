import { useState, useEffect } from 'react';
import { FileText, PieChart, Zap } from 'lucide-react';
import { ClaraSidebar } from './adminDigital/ClaraSidebar';
import { ClaraReviewTab } from './adminDigital/ClaraReviewTab';
import { ClaraDashboardTab } from './adminDigital/ClaraDashboardTab';
import {
  fetchCostCenters,
  fetchSimpleConcepts,
  fetchVendorMappings,
  saveTransactions,
  upsertVendorMappings,
} from './adminDigital/claraService';
import type { ClaraTransaction, VendorMapping } from './adminDigital/claraUtils';

type Tab = 'revision' | 'conciliacion';

export default function AdminDigital() {
  const [activeTab, setActiveTab] = useState<Tab>('revision');
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [simpleConcepts, setSimpleConcepts] = useState<string[]>([]);
  const [vendorMappings, setVendorMappings] = useState<VendorMapping[]>([]);
  const [transactions, setTransactions] = useState<ClaraTransaction[]>([]);
  const [fileName, setFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
  };

  const loadConfig = async () => {
    try {
      const [ccs, concepts, mappings] = await Promise.all([
        fetchCostCenters(),
        fetchSimpleConcepts(),
        fetchVendorMappings(),
      ]);
      setCostCenters(ccs);
      setSimpleConcepts(concepts);
      setVendorMappings(mappings);
    } catch {
      showToast('Error cargando configuracion', 'error');
    }
  };

  const handleTransactionsLoaded = (txns: ClaraTransaction[], name: string) => {
    setTransactions(txns);
    setFileName(name);
    const pending = txns.filter((t) => t.match_type === 'Requiere Asignacion').length;
    showToast(
      `${txns.length} transacciones cargadas. ${pending} requieren asignacion manual.`,
      pending > 0 ? 'info' : 'success'
    );
  };

  const handleUpdateRow = (
    id: number,
    field: 'cost_center' | 'simple_concept' | 'description',
    value: string
  ) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSaveAndLearn = async () => {
    if (transactions.length === 0) {
      showToast('No hay transacciones para guardar', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const batchId = `batch_${Date.now()}`;
      const { saved, skipped } = await saveTransactions(transactions, batchId, fileName);
      await upsertVendorMappings(transactions);
      await loadConfig();
      const msg = skipped > 0
        ? `${saved} transacciones guardadas. ${skipped} duplicadas omitidas. El sistema aprendio las clasificaciones.`
        : `${saved} transacciones guardadas. El sistema aprendio las clasificaciones.`;
      showToast(msg, 'success');
      setTransactions([]);
      setFileName('');
      setActiveTab('conciliacion');
    } catch (err) {
      showToast('Error al guardar: ' + (err as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toastColor =
    toast?.type === 'success'
      ? 'bg-emerald-600'
      : toast?.type === 'error'
      ? 'bg-red-600'
      : 'bg-blue-600';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Module Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 border-b border-slate-700">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                Conciliacion de Gastos — Clara
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Procesador inteligente de estados de cuenta
              </p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-full">
              <Zap className="w-3.5 h-3.5" />
              Inteligencia Activa
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`${toastColor} text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg max-w-md`}>
            {toast.msg}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-72 flex-shrink-0">
            <ClaraSidebar
              costCenters={costCenters}
              simpleConcepts={simpleConcepts}
              onRefresh={loadConfig}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Tab Nav */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 mb-5 shadow-sm w-fit">
              <button
                onClick={() => setActiveTab('revision')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'revision'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Revision
              </button>
              <button
                onClick={() => setActiveTab('conciliacion')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'conciliacion'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <PieChart className="w-4 h-4" />
                Conciliacion
              </button>
            </div>

            {activeTab === 'revision' ? (
              <ClaraReviewTab
                transactions={transactions}
                costCenters={costCenters}
                simpleConcepts={simpleConcepts}
                vendorMappings={vendorMappings}
                onTransactionsLoaded={handleTransactionsLoaded}
                onSaveAndLearn={handleSaveAndLearn}
                onUpdateRow={handleUpdateRow}
                isSaving={isSaving}
                fileName={fileName}
              />
            ) : (
              <ClaraDashboardTab />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
