import { useState } from 'react';
import { Building2, Tags, Plus, Trash2, Loader2 } from 'lucide-react';
import { addCostCenter, deleteCostCenter, addSimpleConcept, deleteSimpleConcept } from './claraService';

interface Props {
  costCenters: string[];
  simpleConcepts: string[];
  onRefresh: () => void;
}

export function ClaraSidebar({ costCenters, simpleConcepts, onRefresh }: Props) {
  const [newCC, setNewCC] = useState('');
  const [newConcept, setNewConcept] = useState('');
  const [loadingCC, setLoadingCC] = useState(false);
  const [loadingConcept, setLoadingConcept] = useState(false);

  const handleAddCC = async () => {
    const val = newCC.trim();
    if (!val) return;
    setLoadingCC(true);
    try {
      await addCostCenter(val);
      setNewCC('');
      onRefresh();
    } finally {
      setLoadingCC(false);
    }
  };

  const handleDeleteCC = async (name: string) => {
    try {
      await deleteCostCenter(name);
      onRefresh();
    } catch { /* ignore */ }
  };

  const handleAddConcept = async () => {
    const val = newConcept.trim();
    if (!val) return;
    setLoadingConcept(true);
    try {
      await addSimpleConcept(val);
      setNewConcept('');
      onRefresh();
    } finally {
      setLoadingConcept(false);
    }
  };

  const handleDeleteConcept = async (name: string) => {
    try {
      await deleteSimpleConcept(name);
      onRefresh();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Cost Centers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Centros de Costo</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Areas que asumen el gasto.</p>
        <div className="flex gap-2 mb-3">
          <input
            value={newCC}
            onChange={(e) => setNewCC(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCC()}
            placeholder="Ej: Dir. General"
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleAddCC}
            disabled={loadingCC || !newCC.trim()}
            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loadingCC ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
        <hr className="border-gray-100 dark:border-gray-700 mb-2" />
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {costCenters.map((cc) => (
            <li key={cc} className="flex items-center justify-between group text-xs text-gray-700 dark:text-gray-300 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="truncate">{cc}</span>
              <button
                onClick={() => handleDeleteCC(cc)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
          {costCenters.length === 0 && (
            <li className="text-xs text-gray-400 italic py-1">Sin centros de costo</li>
          )}
        </ul>
      </div>

      {/* Simple Concepts */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Tags className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conceptos Simples</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Categorias de tipo de servicio.</p>
        <div className="flex gap-2 mb-3">
          <input
            value={newConcept}
            onChange={(e) => setNewConcept(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddConcept()}
            placeholder="Ej: Papeleria"
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleAddConcept}
            disabled={loadingConcept || !newConcept.trim()}
            className="p-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {loadingConcept ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
        <hr className="border-gray-100 dark:border-gray-700 mb-2" />
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {simpleConcepts.map((c) => (
            <li key={c} className="flex items-center justify-between group text-xs text-gray-700 dark:text-gray-300 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="truncate">{c}</span>
              <button
                onClick={() => handleDeleteConcept(c)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
          {simpleConcepts.length === 0 && (
            <li className="text-xs text-gray-400 italic py-1">Sin conceptos</li>
          )}
        </ul>
      </div>
    </div>
  );
}
