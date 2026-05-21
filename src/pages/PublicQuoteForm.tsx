import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2, Check, AlertCircle, ArrowRight, ArrowLeft,
  User, Phone, Mail, MessageCircle, MapPin, Shield, ChevronDown,
  Send, FileText,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface PublicLinkInfo {
  id: string;
  form_type: string;
  form_slug: string;
  form_title: string;
  agent_slug: string;
  brand_config_json: {
    agent_name?: string;
    office_name?: string;
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
    footer_text?: string;
  };
  status: string;
}

interface FormTemplate {
  id: string;
  form_type: string;
  title: string;
  description: string;
  requires_risk_location: boolean;
  schema_json: { steps: string[] };
}

type Step = 'contact' | 'risk' | 'review';

export default function PublicQuoteForm() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<PublicLinkInfo | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [error, setError] = useState<'not_found' | 'inactive' | 'error' | null>(null);

  const [step, setStep] = useState<Step>('contact');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError('not_found'); setLoading(false); return; }
    const fetchLink = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-shared-quote-form/${slug}`, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error === 'inactive' ? 'inactive' : 'not_found');
          return;
        }
        setLink(json.link);
        setTemplate(json.template);
      } catch {
        setError('error');
      } finally {
        setLoading(false);
      }
    };
    fetchLink();
  }, [slug]);

  const brand = link?.brand_config_json || {};
  const primaryColor = brand.primary_color || '#2563eb';
  const agentName = brand.agent_name || 'Agente de Seguros';
  const logoUrl = brand.logo_url || '/logojiro.png';
  const footerText = brand.footer_text || 'Formulario enviado a través de MOVI Digital.';

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateContact = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.client_name?.trim()) errs.client_name = 'El nombre es obligatorio';
    if (!formData.client_phone && !formData.client_whatsapp && !formData.client_email) {
      errs.contact = 'Proporciona al menos un medio de contacto: telefono, WhatsApp o correo';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRisk = (): boolean => {
    if (template?.requires_risk_location && !formData.risk_location_compact?.trim()) {
      setFieldErrors({ risk_location_compact: 'La ubicacion del riesgo es obligatoria' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (step === 'contact' && !validateContact()) return;
    if (step === 'risk' && !validateRisk()) return;
    if (step === 'contact') setStep('risk');
    else if (step === 'risk') setStep('review');
  };

  const goPrev = () => {
    if (step === 'risk') setStep('contact');
    else if (step === 'review') setStep('risk');
  };

  const handleSubmit = async () => {
    if (!validateContact()) { setStep('contact'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-shared-quote-form/${slug}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'contact_required') {
          setSubmitError('Por favor proporciona al menos un medio de contacto.');
          setStep('contact');
          return;
        }
        throw new Error(json.message || json.error || 'Error al enviar');
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Ocurrio un error. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error states
  if (error === 'not_found' || error === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <FileText className="w-14 h-14 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Formulario no encontrado</h1>
        <p className="text-gray-500 text-sm">El enlace que usas no existe o fue eliminado.</p>
      </div>
    );
  }

  if (error === 'inactive') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <AlertCircle className="w-14 h-14 text-amber-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Este formulario ya no esta disponible</h1>
        <p className="text-gray-500 text-sm">El agente ha desactivado este enlace. Contactalo directamente para continuar.</p>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader logoUrl={logoUrl} agentName={agentName} formTitle={link!.form_title} primaryColor={primaryColor} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Formulario enviado exitosamente</h2>
            <p className="text-sm text-gray-500 mb-6">
              Gracias. Tu informacion fue enviada correctamente. El agente revisara tu solicitud y se pondra en contacto contigo.
            </p>
            <button
              onClick={() => { setSubmitted(false); setFormData({}); setStep('contact'); }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Enviar otra solicitud
            </button>
          </div>
        </main>
        <PublicFooter agentName={agentName} agentSlug={link!.agent_slug} footerText={footerText} />
      </div>
    );
  }

  const steps: Step[] = ['contact', 'risk', 'review'];
  const stepIdx = steps.indexOf(step);
  const stepLabels = ['Tus datos', 'Informacion del seguro', 'Confirmar y enviar'];

  return (
    <>
      <Helmet>
        <title>{link!.form_title} — {agentName}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content={`Solicitud de cotizacion: ${link!.form_title}`} />
      </Helmet>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader logoUrl={logoUrl} agentName={agentName} formTitle={link!.form_title} primaryColor={primaryColor} />

        {/* Progress bar */}
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              {stepLabels.map((label, i) => (
                <span key={i} className={`text-xs font-medium ${i === stepIdx ? 'text-blue-600' : i < stepIdx ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {i < stepIdx ? <Check className="w-3.5 h-3.5 inline mr-1" /> : null}{label}
                </span>
              ))}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${((stepIdx + 1) / steps.length) * 100}%`, backgroundColor: primaryColor }}
              />
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Form card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">

              {step === 'contact' && (
                <ContactStep formData={formData} errors={fieldErrors} updateField={updateField} />
              )}

              {step === 'risk' && template && (
                <RiskStep formData={formData} errors={fieldErrors} updateField={updateField} template={template} />
              )}

              {step === 'review' && (
                <ReviewStep formData={formData} formTitle={link!.form_title} />
              )}
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {submitError}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              {stepIdx > 0 ? (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>
              ) : <div />}

              {step !== 'review' ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-colors"
                  style={{ backgroundColor: primaryColor }}
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar solicitud
                </button>
              )}
            </div>

            {/* Privacy notice */}
            <p className="text-center text-xs text-gray-400">
              Tus datos seran utilizados unicamente para preparar tu cotizacion de seguro.
              No compartimos tu informacion con terceros.
            </p>
          </div>
        </main>

        <PublicFooter agentName={agentName} agentSlug={link!.agent_slug} footerText={footerText} />
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components

function PublicHeader({ logoUrl, agentName, formTitle, primaryColor }: {
  logoUrl: string; agentName: string; formTitle: string; primaryColor: string;
}) {
  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
        <img
          src={logoUrl}
          alt={agentName}
          className="h-10 w-auto object-contain"
          onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }}
        />
        <div>
          <p className="text-xs text-gray-500 font-medium">{agentName}</p>
          <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">{formTitle}</h1>
        </div>
      </div>
    </header>
  );
}

function PublicFooter({ agentName, agentSlug, footerText }: {
  agentName: string; agentSlug: string; footerText: string;
}) {
  return (
    <footer className="bg-white border-t border-gray-100 py-6 px-4 text-center text-xs text-gray-400 space-y-1">
      <p className="font-medium text-gray-600">{agentName}</p>
      <p>agentedeseguros.website/{agentSlug}</p>
      <p>{footerText}</p>
    </footer>
  );
}

function ContactStep({ formData, errors, updateField }: {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (f: string, v: any) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Tus datos de contacto</h2>
        <p className="text-xs text-gray-500">Para que el agente pueda ponerse en contacto contigo.</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre completo o razon social <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={formData.client_name || ''}
            onChange={e => updateField('client_name', e.target.value)}
            placeholder="Tu nombre completo o empresa"
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm ${errors.client_name ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        {errors.client_name && <p className="mt-1 text-xs text-red-600">{errors.client_name}</p>}
      </div>

      {/* Contact methods — at least one required */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Medios de contacto <span className="text-red-500">*</span>
          <span className="text-xs text-gray-400 font-normal ml-1">(al menos uno)</span>
        </label>
        {errors.contact && (
          <p className="mb-2 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />{errors.contact}
          </p>
        )}
        <div className="space-y-3">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={formData.client_phone || ''}
              onChange={e => updateField('client_phone', e.target.value)}
              placeholder="Telefono"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={formData.client_whatsapp || ''}
              onChange={e => updateField('client_whatsapp', e.target.value)}
              placeholder="WhatsApp"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={formData.client_email || ''}
              onChange={e => updateField('client_email', e.target.value)}
              placeholder="Correo electronico"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Optional RFC */}
      <CollapsibleSection title="Datos fiscales (opcional)">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">RFC</label>
            <input
              type="text"
              value={formData.client_rfc || ''}
              onChange={e => updateField('client_rfc', e.target.value.toUpperCase())}
              placeholder="RFC"
              maxLength={13}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function RiskStep({ formData, errors, updateField, template }: {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (f: string, v: any) => void;
  template: FormTemplate;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Informacion del seguro</h2>
        <p className="text-xs text-gray-500">Cuéntanos mas sobre lo que deseas asegurar.</p>
      </div>

      {template.requires_risk_location && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Ubicacion del riesgo <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <textarea
              value={formData.risk_location_compact || ''}
              onChange={e => updateField('risk_location_compact', e.target.value)}
              placeholder="Calle, numero, colonia, ciudad, estado"
              rows={2}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm resize-none ${errors.risk_location_compact ? 'border-red-400' : 'border-gray-200'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
          {errors.risk_location_compact && <p className="mt-1 text-xs text-red-600">{errors.risk_location_compact}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descripcion breve <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <div className="relative">
          <Shield className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <textarea
            value={formData.risk_description || ''}
            onChange={e => updateField('risk_description', e.target.value)}
            placeholder="Descripcion del bien o riesgo que deseas asegurar"
            rows={3}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Suma asegurada aproximada</label>
          <input
            type="text"
            value={formData.sum_insured || ''}
            onChange={e => updateField('sum_insured', e.target.value)}
            placeholder="Ej: 500,000"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia deseada desde</label>
          <input
            type="date"
            value={formData.start_date || ''}
            onChange={e => updateField('start_date', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones adicionales</label>
        <textarea
          value={formData.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Informacion adicional que consideres relevante"
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}

function ReviewStep({ formData, formTitle }: { formData: Record<string, any>; formTitle: string }) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Nombre', value: formData.client_name },
    { label: 'Telefono', value: formData.client_phone },
    { label: 'WhatsApp', value: formData.client_whatsapp },
    { label: 'Correo', value: formData.client_email },
    { label: 'RFC', value: formData.client_rfc },
    { label: 'Ubicacion del riesgo', value: formData.risk_location_compact },
    { label: 'Descripcion', value: formData.risk_description },
    { label: 'Suma asegurada', value: formData.sum_insured },
    { label: 'Vigencia desde', value: formData.start_date },
    { label: 'Observaciones', value: formData.notes },
  ].filter(f => f.value?.trim());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Confirma tu solicitud</h2>
        <p className="text-xs text-gray-500">Revisa la informacion antes de enviar.</p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{formTitle}</p>
        {fields.map(f => (
          <div key={f.label} className="flex justify-between text-sm">
            <span className="text-gray-500">{f.label}</span>
            <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-700">
          Al enviar, el agente recibira tu solicitud y se pondra en contacto contigo a la brevedad.
        </p>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}
