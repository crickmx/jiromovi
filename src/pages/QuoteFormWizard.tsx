import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Save, Send, Loader2, AlertCircle,
  User, MapPin, Shield, Paperclip, Eye, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchQuoteFormTemplates, createQuoteForm, updateQuoteForm, submitQuoteForm, addQuoteFormHistory, fetchQuoteFormById } from '../lib/quoteFormUtils';
import type { QuoteFormTemplate, QuoteForm, ClientType } from '../lib/quoteFormTypes';
import { CLIENT_TYPE_OPTIONS, CURRENCY_OPTIONS, PAYMENT_FREQUENCY_OPTIONS, PRIORITY_CONFIG } from '../lib/quoteFormTypes';
import QuoteFormStepClient from '../components/quoteForm/StepClient';
import QuoteFormStepRisk from '../components/quoteForm/StepRisk';
import QuoteFormStepCoverages from '../components/quoteForm/StepCoverages';
import QuoteFormStepAdditional from '../components/quoteForm/StepAdditional';
import QuoteFormStepAttachments from '../components/quoteForm/StepAttachments';
import QuoteFormStepReview from '../components/quoteForm/StepReview';

interface WizardStep {
  id: string;
  label: string;
  icon: React.ElementType;
}

const DEFAULT_STEPS: WizardStep[] = [
  { id: 'client', label: 'Cliente', icon: User },
  { id: 'risk', label: 'Riesgo', icon: MapPin },
  { id: 'coverages', label: 'Coberturas', icon: Shield },
  { id: 'additional', label: 'Adicional', icon: Clock },
  { id: 'attachments', label: 'Adjuntos', icon: Paperclip },
  { id: 'review', label: 'Revision', icon: Eye },
];

export default function QuoteFormWizard() {
  const { formType, formId } = useParams<{ formType?: string; formId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [template, setTemplate] = useState<QuoteFormTemplate | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [quoteFormId, setQuoteFormId] = useState<string | null>(formId || null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; folio?: string; ticketId?: string } | null>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load template and existing form
  useEffect(() => {
    const load = async () => {
      const templates = await fetchQuoteFormTemplates();

      if (formId) {
        const existing = await fetchQuoteFormById(formId);
        if (existing) {
          setQuoteFormId(existing.id);
          setFormData({
            client_name: existing.client_name || '',
            client_type: existing.client_type || 'no_especificado',
            client_phone: existing.client_phone || '',
            client_email: existing.client_email || '',
            client_whatsapp: existing.client_whatsapp || '',
            client_rfc: existing.client_rfc || '',
            client_reference: existing.client_reference || '',
            client_notes: existing.client_notes || '',
            client_address_compact: existing.client_address_compact || '',
            risk_location_compact: existing.risk_location_compact || '',
            currency: existing.currency || '',
            payment_frequency: existing.payment_frequency || '',
            start_date: existing.start_date || '',
            end_date: existing.end_date || '',
            priority: existing.priority || 'normal',
            notes: existing.notes || '',
            ...existing.data_json,
          });
          const tpl = templates.find(t => t.form_type === existing.form_type);
          setTemplate(tpl || null);
        }
      } else if (formType) {
        const tpl = templates.find(t => t.form_type === formType);
        setTemplate(tpl || null);
        setFormData({ client_type: 'no_especificado', priority: 'normal' });
      }
    };
    load();
  }, [formType, formId]);

  const steps = DEFAULT_STEPS.filter(s => {
    if (s.id === 'risk' && template && !template.requires_risk_location) {
      return true; // Still show risk step but it becomes optional
    }
    return true;
  });

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    triggerAutoSave();
  }, []);

  const updateFields = useCallback((fields: Record<string, any>) => {
    setFormData(prev => ({ ...prev, ...fields }));
    triggerAutoSave();
  }, []);

  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveAsDraft(), 5000);
  };

  const saveAsDraft = async (): Promise<string | null> => {
    if (!user || !template) return quoteFormId;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (quoteFormId) {
        await updateQuoteForm(quoteFormId, payload);
        setLastSaved(new Date());
        return quoteFormId;
      } else {
        const created = await createQuoteForm({
          ...payload,
          created_by: user.id,
          agent_id: user.id,
          office_id: (user as any).oficina_id || null,
        });
        setQuoteFormId(created.id);
        await addQuoteFormHistory(created.id, user.id, 'borrador_creado', 'Formulario creado como borrador');
        setLastSaved(new Date());
        return created.id;
      }
    } catch { return quoteFormId; }
    finally { setSaving(false); }
  };

  const buildPayload = (): Partial<QuoteForm> => {
    const { client_name, client_type, client_phone, client_email, client_whatsapp, client_rfc,
      client_reference, client_notes, client_address_compact, risk_location_compact,
      currency, payment_frequency, start_date, end_date, priority, notes, ...rest } = formData;

    return {
      form_type: template!.form_type,
      form_title: template!.title,
      status: 'borrador',
      priority: priority || 'normal',
      client_name: client_name || '',
      client_type: client_type || 'no_especificado',
      client_phone: client_phone || null,
      client_email: client_email || null,
      client_whatsapp: client_whatsapp || null,
      client_rfc: client_rfc || null,
      client_reference: client_reference || null,
      client_notes: client_notes || null,
      client_address_compact: client_address_compact || null,
      risk_location_compact: risk_location_compact || null,
      currency: currency || null,
      payment_frequency: payment_frequency || null,
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || null,
      data_json: rest,
    };
  };

  const validateStep = (stepId: string): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepId === 'client') {
      if (!formData.client_name?.trim()) newErrors.client_name = 'Nombre del cliente es obligatorio';
    }

    if (stepId === 'risk' && template?.requires_risk_location) {
      if (!formData.risk_location_compact?.trim()) {
        newErrors.risk_location_compact = 'Ubicacion del riesgo es obligatoria para este tipo de seguro';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = async () => {
    const step = steps[currentStep];
    if (!validateStep(step.id)) return;
    await saveAsDraft();
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const goPrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const goToStep = (idx: number) => {
    if (idx <= currentStep) setCurrentStep(idx);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep('client')) { setCurrentStep(0); return; }

    setSubmitting(true);
    try {
      const savedId = await saveAsDraft();
      if (!savedId) throw new Error('No se pudo guardar el formulario');

      const { quoteForm, ticketId } = await submitQuoteForm(savedId, user.id);
      setSubmitResult({ ok: true, folio: quoteForm.folio, ticketId: ticketId || undefined });
    } catch (err: any) {
      console.error('Error submitting quote form:', err);
      setErrors({ submit: err?.message || 'Error al enviar la solicitud. Intenta de nuevo.' });
      setSubmitResult(null);
    } finally { setSubmitting(false); }
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (submitResult?.ok) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-sm">
          <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Solicitud enviada correctamente</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Tu solicitud de cotizacion ha sido registrada y sera atendida por el equipo.</p>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Folio:</span><span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{submitResult.folio}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tipo:</span><span className="text-gray-800 dark:text-gray-200">{template.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Estatus:</span><span className="text-blue-600 font-medium">Enviado</span></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {submitResult.ticketId && (
              <button onClick={() => navigate(`/tramites/${submitResult.ticketId}`)} className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Ver tramite
              </button>
            )}
            <button onClick={() => navigate('/tramites/formularios')} className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              Nueva cotizacion
            </button>
            <button onClick={() => navigate('/tramites')} className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              Volver a Tramites
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/tramites/formularios')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{template.title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
        </div>
        {lastSaved && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-emerald-500" />}
            Guardado {lastSaved.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Step Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <button
                key={step.id}
                onClick={() => goToStep(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 cursor-pointer'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
                disabled={idx > currentStep}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {steps[currentStep].id === 'client' && (
          <QuoteFormStepClient
            formData={formData}
            errors={errors}
            updateField={updateField}
            updateFields={updateFields}
          />
        )}
        {steps[currentStep].id === 'risk' && (
          <QuoteFormStepRisk
            formData={formData}
            errors={errors}
            updateField={updateField}
            updateFields={updateFields}
            template={template}
          />
        )}
        {steps[currentStep].id === 'coverages' && (
          <QuoteFormStepCoverages
            formData={formData}
            errors={errors}
            updateField={updateField}
            updateFields={updateFields}
            template={template}
          />
        )}
        {steps[currentStep].id === 'additional' && (
          <QuoteFormStepAdditional
            formData={formData}
            errors={errors}
            updateField={updateField}
            updateFields={updateFields}
            template={template}
          />
        )}
        {steps[currentStep].id === 'attachments' && (
          <QuoteFormStepAttachments
            formData={formData}
            quoteFormId={quoteFormId}
            updateField={updateField}
          />
        )}
        {steps[currentStep].id === 'review' && (
          <QuoteFormStepReview
            formData={formData}
            template={template}
            onEditStep={(idx) => setCurrentStep(idx)}
          />
        )}
      </div>

      {/* Errors */}
      {Object.keys(errors).length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            {Object.values(errors).map((err, i) => <p key={i}>{err}</p>)}
          </div>
        </div>
      )}

      {errors.submit && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {errors.submit}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={saveAsDraft}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar borrador
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar solicitud
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
