import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2, Check, AlertCircle, ArrowRight, ArrowLeft,
  User, Mail, MessageCircle, MapPin, Shield, ChevronDown,
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

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `#${[clamp(r - amount), clamp(g - amount), clamp(b - amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function lightenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `#${[clamp(r + amount), clamp(g + amount), clamp(b + amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

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
  const primaryColor = brand.primary_color || '#0066FF';
  const agentName = brand.agent_name || 'Agente de Seguros';
  const logoUrl = brand.logo_url || '/logojiro.png';
  const footerText = brand.footer_text || 'Formulario enviado a traves de MOVI Digital.';

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateContact = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.client_name?.trim()) errs.client_name = 'El nombre es obligatorio';
    if (!formData.client_whatsapp && !formData.client_email) {
      errs.contact = 'Proporciona al menos WhatsApp o correo electronico';
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
      const payload = { ...formData };
      if (payload.client_whatsapp && !payload.client_phone) {
        payload.client_phone = payload.client_whatsapp;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-shared-quote-form/${slug}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}10 0%, #f8fafc 50%, ${primaryColor}05 100%)` }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-gray-500">Cargando formulario...</p>
        </div>
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
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(180deg, ${primaryColor}08 0%, #ffffff 40%)` }}>
        <BrandedHeader logoUrl={logoUrl} agentName={agentName} formTitle={link!.form_title} primaryColor={primaryColor} />
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: `${primaryColor}15` }}>
              <Check className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Solicitud enviada</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Tu informacion fue enviada correctamente a <span className="font-medium text-gray-700">{agentName}</span>. Te contactaremos a la brevedad para darte seguimiento.
            </p>
            <button
              onClick={() => { setSubmitted(false); setFormData({}); setStep('contact'); }}
              className="text-sm font-medium transition-colors"
              style={{ color: primaryColor }}
            >
              Enviar otra solicitud
            </button>
          </div>
        </main>
        <BrandedFooter agentName={agentName} agentSlug={link!.agent_slug} footerText={footerText} primaryColor={primaryColor} />
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

      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(180deg, ${primaryColor}06 0%, #f9fafb 30%, #ffffff 100%)` }}>
        <BrandedHeader logoUrl={logoUrl} agentName={agentName} formTitle={link!.form_title} primaryColor={primaryColor} />

        {/* Progress steps */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-4">
          <div className="max-w-xl mx-auto">
            <div className="flex items-center justify-between relative">
              {/* Connection line */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
              <div className="absolute top-4 left-0 h-0.5 transition-all duration-500" style={{ width: `${(stepIdx / (steps.length - 1)) * 100}%`, backgroundColor: primaryColor }} />

              {stepLabels.map((label, i) => (
                <div key={i} className="relative flex flex-col items-center z-10">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2"
                    style={{
                      backgroundColor: i <= stepIdx ? primaryColor : '#ffffff',
                      borderColor: i <= stepIdx ? primaryColor : '#e5e7eb',
                      color: i <= stepIdx ? '#ffffff' : '#9ca3af',
                    }}
                  >
                    {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="mt-1.5 text-[10px] sm:text-xs font-medium whitespace-nowrap" style={{ color: i <= stepIdx ? primaryColor : '#9ca3af' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 py-8">
          <div className="max-w-xl mx-auto space-y-6">

            {/* Form card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 transition-all duration-300">

              {step === 'contact' && (
                <ContactStep formData={formData} errors={fieldErrors} updateField={updateField} primaryColor={primaryColor} />
              )}

              {step === 'risk' && template && (
                <RiskStep formData={formData} errors={fieldErrors} updateField={updateField} template={template} primaryColor={primaryColor} />
              )}

              {step === 'review' && (
                <ReviewStep formData={formData} formTitle={link!.form_title} primaryColor={primaryColor} />
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
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>
              ) : <div />}

              {step !== 'review' ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
                  style={{ backgroundColor: primaryColor }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = darkenHex(primaryColor, 20))}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = primaryColor)}
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                  style={{ backgroundColor: primaryColor }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = darkenHex(primaryColor, 20); }}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = primaryColor)}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar solicitud
                </button>
              )}
            </div>

            {/* Privacy notice */}
            <p className="text-center text-xs text-gray-400 leading-relaxed">
              Tus datos seran utilizados unicamente para preparar tu cotizacion.
              No compartimos tu informacion con terceros.
            </p>
          </div>
        </main>

        <BrandedFooter agentName={agentName} agentSlug={link!.agent_slug} footerText={footerText} primaryColor={primaryColor} />
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Sub-components

function BrandedHeader({ logoUrl, agentName, formTitle, primaryColor }: {
  logoUrl: string; agentName: string; formTitle: string; primaryColor: string;
}) {
  return (
    <header className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm flex items-center justify-center bg-white shrink-0">
          <img
            src={logoUrl}
            alt={agentName}
            className="h-10 w-10 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 truncate">{agentName}</p>
          <h1 className="text-sm sm:text-base font-bold leading-tight truncate" style={{ color: primaryColor }}>
            {formTitle}
          </h1>
        </div>
      </div>
    </header>
  );
}

function BrandedFooter({ agentName, agentSlug, footerText, primaryColor }: {
  agentName: string; agentSlug: string; footerText: string; primaryColor: string;
}) {
  return (
    <footer className="border-t border-gray-100 py-6 px-4 text-center space-y-2" style={{ backgroundColor: `${primaryColor}04` }}>
      <p className="text-sm font-semibold text-gray-700">{agentName}</p>
      <p className="text-xs text-gray-400">agentedeseguros.website/{agentSlug}</p>
      <p className="text-xs text-gray-400">{footerText}</p>
    </footer>
  );
}

function ContactStep({ formData, errors, updateField, primaryColor }: {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (f: string, v: any) => void;
  primaryColor: string;
}) {
  const focusRing = `focus:ring-2 focus:border-transparent`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tus datos de contacto</h2>
        <p className="text-sm text-gray-500">Para que podamos ponernos en contacto contigo.</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre completo o razon social <span className="text-red-500">*</span>
        </label>
        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-current transition-colors" style={{ color: errors.client_name ? '#ef4444' : undefined }} />
          <input
            type="text"
            value={formData.client_name || ''}
            onChange={e => updateField('client_name', e.target.value)}
            placeholder="Tu nombre completo o empresa"
            className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm transition-all duration-200 ${errors.client_name ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-gray-300'} ${focusRing}`}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
        {errors.client_name && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.client_name}</p>}
      </div>

      {/* Contact methods — WhatsApp and Email only */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Medios de contacto <span className="text-red-500">*</span>
          <span className="text-xs text-gray-400 font-normal ml-1">(al menos uno)</span>
        </label>
        {errors.contact && (
          <p className="mb-3 text-xs text-red-600 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors.contact}
          </p>
        )}
        <div className="space-y-3">
          <div className="relative group">
            <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="tel"
              value={formData.client_whatsapp || ''}
              onChange={e => updateField('client_whatsapp', e.target.value)}
              placeholder="WhatsApp (10 digitos)"
              className={`w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 ${focusRing}`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Recomendado</span>
          </div>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="email"
              value={formData.client_email || ''}
              onChange={e => updateField('client_email', e.target.value)}
              placeholder="Correo electronico"
              className={`w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 ${focusRing}`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
        </div>
      </div>

      {/* Optional RFC */}
      <CollapsibleSection title="Datos fiscales (opcional)">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">RFC</label>
            <input
              type="text"
              value={formData.client_rfc || ''}
              onChange={e => updateField('client_rfc', e.target.value.toUpperCase())}
              placeholder="RFC (13 caracteres)"
              maxLength={13}
              className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono hover:border-gray-300 transition-all duration-200 ${focusRing}`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function RiskStep({ formData, errors, updateField, template, primaryColor }: {
  formData: Record<string, any>;
  errors: Record<string, string>;
  updateField: (f: string, v: any) => void;
  template: FormTemplate;
  primaryColor: string;
}) {
  const focusRing = `focus:ring-2 focus:border-transparent`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Informacion del seguro</h2>
        <p className="text-sm text-gray-500">Cuentanos mas sobre lo que deseas asegurar.</p>
      </div>

      {template.requires_risk_location && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ubicacion del riesgo <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-current transition-colors" />
            <textarea
              value={formData.risk_location_compact || ''}
              onChange={e => updateField('risk_location_compact', e.target.value)}
              placeholder="Calle, numero, colonia, ciudad, estado"
              rows={2}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm resize-none transition-all duration-200 ${errors.risk_location_compact ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-gray-300'} ${focusRing}`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
          {errors.risk_location_compact && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.risk_location_compact}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripcion breve <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <div className="relative group">
          <Shield className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 group-focus-within:text-current transition-colors" />
          <textarea
            value={formData.risk_description || ''}
            onChange={e => updateField('risk_description', e.target.value)}
            placeholder="Descripcion del bien o riesgo que deseas asegurar"
            rows={3}
            className={`w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 transition-all duration-200 ${focusRing}`}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Suma asegurada aproximada</label>
          <input
            type="text"
            value={formData.sum_insured || ''}
            onChange={e => updateField('sum_insured', e.target.value)}
            placeholder="Ej: $500,000"
            className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 ${focusRing}`}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vigencia deseada desde</label>
          <input
            type="date"
            value={formData.start_date || ''}
            onChange={e => updateField('start_date', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 ${focusRing}`}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones adicionales</label>
        <textarea
          value={formData.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Informacion adicional que consideres relevante"
          rows={2}
          className={`w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 transition-all duration-200 ${focusRing}`}
          style={{ '--tw-ring-color': primaryColor } as any}
        />
      </div>
    </div>
  );
}

function ReviewStep({ formData, formTitle, primaryColor }: { formData: Record<string, any>; formTitle: string; primaryColor: string }) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Nombre', value: formData.client_name },
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Confirma tu solicitud</h2>
        <p className="text-sm text-gray-500">Revisa la informacion antes de enviar.</p>
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100" style={{ backgroundColor: `${primaryColor}08` }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{formTitle}</p>
        </div>
        <div className="p-4 space-y-3">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
              <span className="text-gray-500">{f.label}</span>
              <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border" style={{ backgroundColor: `${primaryColor}06`, borderColor: `${primaryColor}20` }}>
        <p className="text-sm" style={{ color: darkenHex(primaryColor, 40) }}>
          Al enviar, el agente recibira tu solicitud y se pondra en contacto contigo a la brevedad.
        </p>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-300">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50/50 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}
