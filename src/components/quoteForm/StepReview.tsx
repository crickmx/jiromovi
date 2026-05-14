import { CreditCard as Edit3, User, MapPin, Shield, Clock, Paperclip } from 'lucide-react';
import type { QuoteFormTemplate } from '../../lib/quoteFormTypes';
import { PRIORITY_CONFIG, CLIENT_TYPE_OPTIONS, CURRENCY_OPTIONS, PAYMENT_FREQUENCY_OPTIONS } from '../../lib/quoteFormTypes';
import { FORM_COVERAGES } from './coveragesData';

interface Props {
  formData: Record<string, any>;
  template: QuoteFormTemplate;
  onEditStep: (idx: number) => void;
}

function ReviewSection({ title, icon: Icon, stepIdx, onEdit, children }: { title: string; icon: React.ElementType; stepIdx: number; onEdit: (idx: number) => void; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <button
          onClick={() => onEdit(stepIdx)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors"
        >
          <Edit3 className="w-3 h-3" /> Editar
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  );
}

export default function QuoteFormStepReview({ formData, template, onEditStep }: Props) {
  const priority = PRIORITY_CONFIG[formData.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
  const clientType = CLIENT_TYPE_OPTIONS.find(o => o.value === formData.client_type)?.label || '';
  const currency = CURRENCY_OPTIONS.find(o => o.value === formData.currency)?.label || '';
  const payFreq = PAYMENT_FREQUENCY_OPTIONS.find(o => o.value === formData.payment_frequency)?.label || '';
  const coverages: string[] = formData.coverages || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Revision final</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Verifica que la informacion sea correcta antes de enviar la solicitud.</p>
      </div>

      {/* Header info */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg font-medium">{template.title}</span>
        <span className={`px-2.5 py-1 rounded-lg font-medium ${priority.bg} ${priority.color}`}>{priority.label}</span>
      </div>

      {/* Client section */}
      <ReviewSection title="Datos del cliente" icon={User} stepIdx={0} onEdit={onEditStep}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre / Razon social" value={formData.client_name} />
          <Field label="Tipo" value={clientType} />
          <Field label="Telefono" value={formData.client_phone} />
          <Field label="Correo" value={formData.client_email} />
          <Field label="WhatsApp" value={formData.client_whatsapp} />
          <Field label="RFC" value={formData.client_rfc} />
          <Field label="Referencia" value={formData.client_reference} />
          <Field label="Notas" value={formData.client_notes} />
        </div>
        {formData.client_address_compact && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Field label="Domicilio fiscal" value={formData.client_address_compact} />
          </div>
        )}
      </ReviewSection>

      {/* Risk section */}
      <ReviewSection title="Datos del riesgo" icon={MapPin} stepIdx={1} onEdit={onEditStep}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ubicacion del riesgo" value={formData.risk_location_compact} />
          <Field label="Descripcion del riesgo" value={formData.risk_description} />
          <Field label="Suma asegurada" value={formData.sum_insured ? `${formData.sum_insured} ${currency}` : null} />
          <Field label="Forma de pago" value={payFreq} />
          <Field label="Inicio vigencia" value={formData.start_date} />
          <Field label="Fin vigencia" value={formData.end_date} />
        </div>
      </ReviewSection>

      {/* Coverages section */}
      {coverages.length > 0 && (
        <ReviewSection title="Coberturas" icon={Shield} stepIdx={2} onEdit={onEditStep}>
          {formData.modality && (
            <p className="text-xs text-gray-500 mb-2">Modalidad: <span className="font-medium text-gray-700 dark:text-gray-300">{formData.modality}</span></p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {coverages.map(cov => (
              <span key={cov} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md border border-blue-100 dark:border-blue-800">
                {cov}
              </span>
            ))}
          </div>
          {formData.sums_detail && (
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Field label="Detalle de sumas" value={formData.sums_detail} />
            </div>
          )}
        </ReviewSection>
      )}

      {/* Additional section */}
      {(formData.claims_history || formData.notes || formData.construction_walls || formData.vehicle_brand || formData.cargo_type) && (
        <ReviewSection title="Informacion adicional" icon={Clock} stepIdx={3} onEdit={onEditStep}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Siniestralidad" value={formData.claims_history} />
            <Field label="Observaciones" value={formData.notes} />
            <Field label="Tipo de muros" value={formData.construction_walls} />
            <Field label="Tipo de techos" value={formData.construction_roof} />
            <Field label="Ano construccion" value={formData.construction_year} />
            <Field label="Marca vehiculo" value={formData.vehicle_brand} />
            <Field label="Modelo vehiculo" value={formData.vehicle_year} />
            <Field label="Tipo mercancia" value={formData.cargo_type} />
            <Field label="Medio transporte" value={formData.transport_mode} />
          </div>
          {formData.security_measures?.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider">Medidas de seguridad</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {formData.security_measures.map((m: string) => (
                  <span key={m} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">{m}</span>
                ))}
              </div>
            </div>
          )}
        </ReviewSection>
      )}

      {/* Confirmation text */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl">
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Al enviar esta solicitud, se creara un tramite asociado y el equipo procedera a cotizar. Podras dar seguimiento desde la seccion de Tramites.
        </p>
      </div>
    </div>
  );
}
