import { useState } from 'react';
import { User, Phone, Mail, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { CLIENT_TYPE_OPTIONS } from '../../lib/quoteFormTypes';

interface Props {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (field: string, value: any) => void;
  updateFields: (fields: Record<string, any>) => void;
}

export default function QuoteFormStepClient({ formData, errors, updateField }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Datos basicos del cliente</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Para cotizar solo necesitamos los datos esenciales.</p>
      </div>

      {/* Client Name - Required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Nombre o razon social <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.client_name || ''}
          onChange={(e) => updateField('client_name', e.target.value)}
          placeholder="Nombre del cliente o empresa"
          className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-900 ${errors.client_name ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
        />
        {errors.client_name && <p className="mt-1 text-xs text-red-600">{errors.client_name}</p>}
      </div>

      {/* Contact Methods */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Medios de contacto <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={formData.client_phone || ''}
              onChange={(e) => updateField('client_phone', e.target.value)}
              placeholder="Telefono"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={formData.client_email || ''}
              onChange={(e) => updateField('client_email', e.target.value)}
              placeholder="Correo electronico"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={formData.client_whatsapp || ''}
              onChange={(e) => updateField('client_whatsapp', e.target.value)}
              placeholder="WhatsApp"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Client Type - Optional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Tipo de persona <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <select
            value={formData.client_type || 'no_especificado'}
            onChange={(e) => updateField('client_type', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
          >
            {CLIENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            RFC <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <input
            type="text"
            value={formData.client_rfc || ''}
            onChange={(e) => updateField('client_rfc', e.target.value.toUpperCase())}
            placeholder="RFC del cliente"
            maxLength={13}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
        </div>
      </div>

      {/* Reference & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Referencia interna <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <input
            type="text"
            value={formData.client_reference || ''}
            onChange={(e) => updateField('client_reference', e.target.value)}
            placeholder="Numero de cliente, expediente..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Observaciones <span className="text-gray-400 text-xs font-normal">opcional</span>
          </label>
          <input
            type="text"
            value={formData.client_notes || ''}
            onChange={(e) => updateField('client_notes', e.target.value)}
            placeholder="Notas sobre el cliente"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Advanced section - collapsible */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <span className="font-medium">Datos fiscales y legales — opcional / para emision</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAdvanced && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              Para cotizar solo necesitamos los datos esenciales. Podras agregar informacion fiscal o legal mas adelante si se requiere para emision.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Domicilio fiscal</label>
              <textarea
                value={formData.client_address_compact || ''}
                onChange={(e) => updateField('client_address_compact', e.target.value)}
                placeholder="Direccion fiscal completa o referencia"
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">CURP</label>
                <input
                  type="text"
                  value={formData.client_curp || ''}
                  onChange={(e) => updateField('client_curp', e.target.value.toUpperCase())}
                  placeholder="CURP"
                  maxLength={18}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={formData.client_birth_date || ''}
                  onChange={(e) => updateField('client_birth_date', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nacionalidad</label>
                <input
                  type="text"
                  value={formData.client_nationality || ''}
                  onChange={(e) => updateField('client_nationality', e.target.value)}
                  placeholder="Mexicana"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ocupacion / profesion</label>
                <input
                  type="text"
                  value={formData.client_occupation || ''}
                  onChange={(e) => updateField('client_occupation', e.target.value)}
                  placeholder="Profesion del cliente"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
