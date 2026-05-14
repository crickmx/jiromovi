import { useState } from 'react';
import { Shield, Plus, X, Info } from 'lucide-react';
import type { QuoteFormTemplate } from '../../lib/quoteFormTypes';
import { FORM_COVERAGES } from './coveragesData';

interface Props {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  updateFields: (fields: Record<string, any>) => void;
  template: QuoteFormTemplate;
}

export default function QuoteFormStepCoverages({ formData, errors, updateField, template }: Props) {
  const coverageOptions = FORM_COVERAGES[template.form_type] || [];
  const selectedCoverages: string[] = formData.coverages || [];
  const [customCoverage, setCustomCoverage] = useState('');

  const toggleCoverage = (cov: string) => {
    const updated = selectedCoverages.includes(cov)
      ? selectedCoverages.filter(c => c !== cov)
      : [...selectedCoverages, cov];
    updateField('coverages', updated);
  };

  const addCustom = () => {
    if (customCoverage.trim() && !selectedCoverages.includes(customCoverage.trim())) {
      updateField('coverages', [...selectedCoverages, customCoverage.trim()]);
      setCustomCoverage('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Coberturas y modalidad</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Selecciona las coberturas que deseas cotizar. Puedes agregar coberturas adicionales.</p>
      </div>

      {/* Modality if applicable */}
      {['hogar_casa_habitacion', 'pyme_comercio', 'incendio'].includes(template.form_type) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modalidad</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Cobertura basica', 'Cobertura amplia', 'Cobertura integral', 'Paquete libre'].map(mod => (
              <label key={mod} className={`flex items-center justify-center px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all text-center ${formData.modality === mod ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                <input type="radio" name="modality" value={mod} checked={formData.modality === mod} onChange={(e) => updateField('modality', e.target.value)} className="sr-only" />
                {mod}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Coverage checkboxes */}
      {coverageOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Coberturas disponibles
            <span className="text-xs font-normal text-gray-400 ml-2">{selectedCoverages.length} seleccionadas</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {coverageOptions.map(cov => (
              <label
                key={cov}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs ${selectedCoverages.includes(cov) ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedCoverages.includes(cov)}
                  onChange={() => toggleCoverage(cov)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{cov}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Custom coverage */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Agregar cobertura adicional</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customCoverage}
            onChange={(e) => setCustomCoverage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
            placeholder="Nombre de la cobertura"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button onClick={addCustom} disabled={!customCoverage.trim()} className="px-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected coverages tags */}
      {selectedCoverages.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Coberturas seleccionadas</label>
          <div className="flex flex-wrap gap-2">
            {selectedCoverages.map(cov => (
              <span key={cov} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg border border-blue-200 dark:border-blue-800">
                {cov}
                <button onClick={() => toggleCoverage(cov)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sum details per coverage (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Detalle de sumas aseguradas <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <textarea
          value={formData.sums_detail || ''}
          onChange={(e) => updateField('sums_detail', e.target.value)}
          placeholder="Detalla sumas aseguradas por cobertura si aplica. Ejemplo: Edificio $5,000,000 / Contenidos $1,000,000 / RC $2,000,000"
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
