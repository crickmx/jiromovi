import { Shield, Plus, X } from 'lucide-react';
import type { QuoteFormTemplate } from '../../lib/quoteFormTypes';

interface Props {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  updateFields: (fields: Record<string, any>) => void;
  template: QuoteFormTemplate;
}

export default function QuoteFormStepAdditional({ formData, errors, updateField, template }: Props) {
  const formType = template.form_type;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Informacion adicional</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Datos complementarios que ayudan a obtener una cotizacion mas precisa. Todos son opcionales.</p>
      </div>

      {/* Construction details - for property forms */}
      {['hogar_casa_habitacion', 'casa_con_negocio', 'pyme_comercio', 'empresa_paquete', 'incendio', 'equipo_electronico'].includes(formType) && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Caracteristicas constructivas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de muros</label>
              <input type="text" value={formData.construction_walls || ''} onChange={(e) => updateField('construction_walls', e.target.value)} placeholder="Ladrillo, block, concreto..." className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de techos</label>
              <input type="text" value={formData.construction_roof || ''} onChange={(e) => updateField('construction_roof', e.target.value)} placeholder="Concreto, lamina, madera..." className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano de construccion</label>
              <input type="text" value={formData.construction_year || ''} onChange={(e) => updateField('construction_year', e.target.value)} placeholder="Ej: 2005" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Numero de niveles</label>
              <input type="text" value={formData.construction_levels || ''} onChange={(e) => updateField('construction_levels', e.target.value)} placeholder="Ej: 2" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Propietario o arrendatario</label>
            <select value={formData.ownership || ''} onChange={(e) => updateField('ownership', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900">
              <option value="">No especificado</option>
              <option value="propietario">Propietario</option>
              <option value="arrendatario">Arrendatario</option>
            </select>
          </div>
        </div>
      )}

      {/* Security measures */}
      {['hogar_casa_habitacion', 'casa_con_negocio', 'pyme_comercio', 'empresa_paquete', 'gasolinera'].includes(formType) && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Medidas de seguridad</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Proteccion metalica', 'Alarma local', 'Alarma central', 'CCTV', 'Vigilancia 24h', 'Extintores', 'Detectores de humo', 'Caja fuerte'].map(measure => {
              const measures: string[] = formData.security_measures || [];
              return (
                <label key={measure} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${measures.includes(measure) ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                  <input
                    type="checkbox"
                    checked={measures.includes(measure)}
                    onChange={() => {
                      const updated = measures.includes(measure) ? measures.filter(m => m !== measure) : [...measures, measure];
                      updateField('security_measures', updated);
                    }}
                    className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300">{measure}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Vehicle data - for auto */}
      {formType === 'auto_alta_gama' && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Datos del vehiculo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Marca</label>
              <input type="text" value={formData.vehicle_brand || ''} onChange={(e) => updateField('vehicle_brand', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Version / descripcion</label>
              <input type="text" value={formData.vehicle_version || ''} onChange={(e) => updateField('vehicle_version', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Modelo (ano)</label>
              <input type="text" value={formData.vehicle_year || ''} onChange={(e) => updateField('vehicle_year', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor de factura</label>
              <input type="text" value={formData.vehicle_value || ''} onChange={(e) => updateField('vehicle_value', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Uso del vehiculo</label>
              <select value={formData.vehicle_use || ''} onChange={(e) => updateField('vehicle_use', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900">
                <option value="">Seleccionar</option>
                <option value="particular">Particular</option>
                <option value="comercial">Comercial</option>
                <option value="ejecutivo">Ejecutivo</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Transport data */}
      {formType === 'transporte_carga' && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Datos del embarque</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de mercancia</label>
              <input type="text" value={formData.cargo_type || ''} onChange={(e) => updateField('cargo_type', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" placeholder="Descripcion de la carga" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Medio de transporte</label>
              <select value={formData.transport_mode || ''} onChange={(e) => updateField('transport_mode', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900">
                <option value="">Seleccionar</option>
                <option value="terrestre">Terrestre</option>
                <option value="aereo">Aereo</option>
                <option value="maritimo">Maritimo</option>
                <option value="ferrocarril">Ferrocarril</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Origen</label>
              <input type="text" value={formData.transport_origin || ''} onChange={(e) => updateField('transport_origin', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Destino</label>
              <input type="text" value={formData.transport_destination || ''} onChange={(e) => updateField('transport_destination', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900" />
            </div>
          </div>
        </div>
      )}

      {/* Siniestralidad */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Siniestralidad ultimos 5 anos <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <textarea
          value={formData.claims_history || ''}
          onChange={(e) => updateField('claims_history', e.target.value)}
          placeholder="Describe siniestros relevantes de los ultimos anos, si los hay"
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* General notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Observaciones generales <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <textarea
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Cualquier informacion adicional relevante para la cotizacion"
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  );
}
