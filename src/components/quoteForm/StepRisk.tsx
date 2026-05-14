import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { QuoteFormTemplate } from '../../lib/quoteFormTypes';
import { CURRENCY_OPTIONS, PAYMENT_FREQUENCY_OPTIONS } from '../../lib/quoteFormTypes';

interface Props {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  updateFields: (fields: Record<string, any>) => void;
  template: QuoteFormTemplate;
}

export default function QuoteFormStepRisk({ formData, errors, updateField, template }: Props) {
  const [showDetailedAddress, setShowDetailedAddress] = useState(false);
  const requiresLocation = template.requires_risk_location;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Datos del riesgo</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Informacion basica del bien o actividad a asegurar.</p>
      </div>

      {/* Risk Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Ubicacion / domicilio del riesgo {requiresLocation && <span className="text-red-500">*</span>}
          {!requiresLocation && <span className="text-gray-400 text-xs font-normal ml-1">opcional</span>}
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <textarea
            value={formData.risk_location_compact || ''}
            onChange={(e) => updateField('risk_location_compact', e.target.value)}
            placeholder="Escribe la direccion completa o referencia de ubicacion. Ejemplo: calle, numero, colonia, ciudad, estado, CP o referencias."
            rows={2}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-900 resize-none ${errors.risk_location_compact ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        {errors.risk_location_compact && <p className="mt-1 text-xs text-red-600">{errors.risk_location_compact}</p>}

        {/* Detailed address toggle */}
        <button
          onClick={() => setShowDetailedAddress(!showDetailedAddress)}
          className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
        >
          {showDetailedAddress ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Agregar direccion detallada
        </button>

        {showDetailedAddress && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Calle</label>
                <input type="text" value={formData.address_street || ''} onChange={(e) => updateField('address_street', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Calle" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">No. Ext</label>
                  <input type="text" value={formData.address_ext || ''} onChange={(e) => updateField('address_ext', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">No. Int</label>
                  <input type="text" value={formData.address_int || ''} onChange={(e) => updateField('address_int', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Colonia</label>
                <input type="text" value={formData.address_colony || ''} onChange={(e) => updateField('address_colony', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Colonia" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Municipio / Alcaldia</label>
                <input type="text" value={formData.address_city || ''} onChange={(e) => updateField('address_city', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Municipio" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <input type="text" value={formData.address_state || ''} onChange={(e) => updateField('address_state', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Estado" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Codigo postal</label>
                <input type="text" value={formData.address_zip || ''} onChange={(e) => updateField('address_zip', e.target.value)} maxLength={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="00000" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referencias</label>
              <input type="text" value={formData.address_references || ''} onChange={(e) => updateField('address_references', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Entre calles, cerca de..." />
            </div>
          </div>
        )}
      </div>

      {/* Activity/Business description - contextual */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Giro / actividad / descripcion del riesgo <span className="text-gray-400 text-xs font-normal">recomendado</span>
        </label>
        <textarea
          value={formData.risk_description || ''}
          onChange={(e) => updateField('risk_description', e.target.value)}
          placeholder="Describe brevemente la actividad, negocio, bien asegurado o riesgo a cubrir"
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Sums insured / values */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Suma asegurada / valor aproximado <span className="text-gray-400 text-xs font-normal">recomendado</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={formData.sum_insured || ''}
            onChange={(e) => updateField('sum_insured', e.target.value)}
            placeholder="Monto o valor estimado"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={formData.currency || ''}
            onChange={(e) => updateField('currency', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Moneda</option>
            {CURRENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Vigencia & Payment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Inicio vigencia <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <input
            type="date"
            value={formData.start_date || ''}
            onChange={(e) => updateField('start_date', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Fin vigencia <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <input
            type="date"
            value={formData.end_date || ''}
            onChange={(e) => updateField('end_date', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Forma de pago <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <select
            value={formData.payment_frequency || ''}
            onChange={(e) => updateField('payment_frequency', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar</option>
            {PAYMENT_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Prioridad</label>
        <div className="flex gap-3">
          {(['normal', 'alta', 'urgente'] as const).map(p => (
            <label key={p} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors ${formData.priority === p ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
              <input type="radio" name="priority" value={p} checked={formData.priority === p} onChange={(e) => updateField('priority', e.target.value)} className="sr-only" />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{p}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
