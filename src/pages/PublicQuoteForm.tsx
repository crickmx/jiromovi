import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2, Check, AlertCircle, ArrowRight, ArrowLeft,
  User, Mail, MessageCircle, MapPin, Shield, ChevronDown,
  Send, FileText, Home, ExternalLink,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface BrandConfig {
  agent_name?: string;
  office_name?: string;
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  profile_image_url?: string;
  agent_slug?: string;
  agent_whatsapp?: string;
  footer_text?: string;
}

interface PublicLinkInfo {
  id: string;
  form_type: string;
  form_slug: string;
  form_title: string;
  agent_slug: string;
  brand_config_json: BrandConfig;
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
  if (h.length < 6) return { r: 37, g: 99, b: 235 };
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, v));
  return `#${[c(r - amount), c(g - amount), c(b - amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
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
  const primaryColor = brand.primary_color || '#2563eb';
  const secondaryColor = brand.secondary_color || darkenHex(primaryColor, 30);
  const agentName = brand.agent_name || 'Agente de Seguros';
  const officeName = brand.office_name || '';
  const logoUrl = brand.logo_url || '/logojiro.png';
  const profileImageUrl = brand.profile_image_url || '';
  const agentSlug = brand.agent_slug || '';
  const agentWhatsapp = brand.agent_whatsapp || '';
  const footerText = brand.footer_text || 'Formulario enviado a traves de MOVI Digital.';
  const homeUrl = agentSlug ? `https://agentedeseguros.website/${agentSlug}` : '';

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateContact = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.client_name?.trim()) errs.client_name = 'El nombre es obligatorio';
    if (!formData.client_whatsapp && !formData.client_email) {
      errs.contact = 'Proporciona al menos WhatsApp o correo electrónico';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateRisk = (): boolean => {
    if (template?.requires_risk_location && !formData.risk_location_compact?.trim()) {
      setFieldErrors({ risk_location_compact: 'La ubicación del riesgo es obligatoria' });
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
      setSubmitError(err.message || 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (error === 'not_found' || error === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <FileText className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Formulario no encontrado</h1>
        <p className="text-gray-500 text-sm max-w-sm">El enlace que usas no existe o fue eliminado. Contacta a tu agente para obtener un enlace actualizado.</p>
      </div>
    );
  }

  if (error === 'inactive') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-5">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Formulario no disponible</h1>
        <p className="text-gray-500 text-sm max-w-sm">Este formulario ha sido desactivado por el agente. Contactalo directamente para continuar.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <SuccessPage
        agentName={agentName}
        officeName={officeName}
        logoUrl={logoUrl}
        profileImageUrl={profileImageUrl}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        homeUrl={homeUrl}
        agentWhatsapp={agentWhatsapp}
        formTitle={link!.form_title}
        footerText={footerText}
        onReset={() => { setSubmitted(false); setFormData({}); setStep('contact'); }}
      />
    );
  }

  const steps: Step[] = ['contact', 'risk', 'review'];
  const stepIdx = steps.indexOf(step);
  const stepLabels = ['Datos de contacto', 'Información del seguro', 'Confirmar'];

  return (
    <>
      <Helmet>
        <title>{link!.form_title} - {agentName}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content={`Solicitud de cotización: ${link!.form_title}`} />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-gray-50">
        <PublicHeader
          logoUrl={logoUrl}
          profileImageUrl={profileImageUrl}
          agentName={agentName}
          officeName={officeName}
          formTitle={link!.form_title}
          primaryColor={primaryColor}
          homeUrl={homeUrl}
        />

        {/* Progress */}
        <div className="bg-white border-b border-gray-100 px-4 py-5">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-4 left-[16.6%] right-[16.6%] h-[2px] bg-gray-200 rounded-full" />
              <div
                className="absolute top-4 left-[16.6%] h-[2px] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(stepIdx / (steps.length - 1)) * 66.6}%`, backgroundColor: primaryColor }}
              />
              {stepLabels.map((label, i) => (
                <div key={i} className="relative flex flex-col items-center z-10 flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-sm"
                    style={{
                      backgroundColor: i <= stepIdx ? primaryColor : '#ffffff',
                      border: `2px solid ${i <= stepIdx ? primaryColor : '#e5e7eb'}`,
                      color: i <= stepIdx ? '#ffffff' : '#9ca3af',
                      boxShadow: i === stepIdx ? `0 0 0 4px ${primaryColor}20` : undefined,
                    }}
                  >
                    {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span
                    className="mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight"
                    style={{ color: i <= stepIdx ? primaryColor : '#9ca3af' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 py-8">
          <div className="max-w-lg mx-auto space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8">
                {step === 'contact' && (
                  <ContactStep formData={formData} errors={fieldErrors} updateField={updateField} primaryColor={primaryColor} />
                )}
                {step === 'risk' && template && (
                  <RiskStep formData={formData} errors={fieldErrors} updateField={updateField} template={template} primaryColor={primaryColor} />
                )}
                {step === 'review' && (
                  <ReviewStep formData={formData} formTitle={link!.form_title} primaryColor={primaryColor} agentName={agentName} />
                )}
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
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
                  className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97]"
                  style={{ backgroundColor: primaryColor }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = darkenHex(primaryColor, 15))}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = primaryColor)}
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none"
                  style={{ backgroundColor: primaryColor }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = darkenHex(primaryColor, 15); }}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = primaryColor)}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar solicitud
                </button>
              )}
            </div>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed pt-2">
              Tus datos serán utilizados únicamente para preparar tu cotización. No compartimos tu información con terceros.
            </p>
          </div>
        </main>

        <PublicFooter
          agentName={agentName}
          officeName={officeName}
          homeUrl={homeUrl}
          footerText={footerText}
          primaryColor={primaryColor}
        />
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Header

function PublicHeader({ logoUrl, profileImageUrl, agentName, officeName, formTitle, primaryColor, homeUrl }: {
  logoUrl: string; profileImageUrl: string; agentName: string; officeName: string;
  formTitle: string; primaryColor: string; homeUrl: string;
}) {
  return (
    <header className="bg-white shadow-sm relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, transparent 60%)` }} />
      <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3 relative z-10">
        {/* Logo */}
        <div className="h-11 w-11 rounded-xl overflow-hidden border border-gray-100 shadow-sm flex items-center justify-center bg-white shrink-0">
          <img
            src={logoUrl}
            alt={agentName}
            className="h-9 w-9 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }}
          />
        </div>

        {/* Profile image */}
        {profileImageUrl ? (
          <div className="h-9 w-9 rounded-full overflow-hidden border-2 shrink-0 -ml-2 shadow-sm" style={{ borderColor: `${primaryColor}40` }}>
            <img src={profileImageUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        ) : (
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white -ml-2 shadow-sm shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {getInitials(agentName)}
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-gray-900 truncate">{agentName}</p>
            {officeName && <span className="text-[10px] text-gray-400 truncate hidden sm:inline">| {officeName}</span>}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5" style={{ color: `${primaryColor}cc` }}>{formTitle}</p>
        </div>

        {/* Home button */}
        {homeUrl && (
          <a
            href={homeUrl}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 shrink-0 hover:shadow-sm"
            style={{
              borderColor: `${primaryColor}30`,
              color: primaryColor,
              backgroundColor: `${primaryColor}08`,
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${primaryColor}15`; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = `${primaryColor}08`; }}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inicio</span>
          </a>
        )}
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────
// Footer

function PublicFooter({ agentName, officeName, homeUrl, footerText, primaryColor }: {
  agentName: string; officeName: string; homeUrl: string; footerText: string; primaryColor: string;
}) {
  return (
    <footer className="border-t border-gray-100 bg-white py-6 px-4">
      <div className="max-w-lg mx-auto text-center space-y-2">
        <p className="text-sm font-semibold text-gray-700">{agentName}</p>
        {officeName && <p className="text-xs text-gray-400">{officeName}</p>}
        {homeUrl && (
          <a
            href={homeUrl}
            className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: primaryColor }}
          >
            <ExternalLink className="w-3 h-3" />
            Mi página web
          </a>
        )}
        <p className="text-[11px] text-gray-400 pt-2">{footerText}</p>
        <p className="text-[10px] text-gray-300">Tus datos están protegidos y no serán compartidos con terceros.</p>
      </div>
    </footer>
  );
}

// ──────────────────────────────────────────────────────────
// Success Page

function SuccessPage({ agentName, officeName, logoUrl, profileImageUrl, primaryColor, secondaryColor, homeUrl, agentWhatsapp, formTitle, footerText, onReset }: {
  agentName: string; officeName: string; logoUrl: string; profileImageUrl: string;
  primaryColor: string; secondaryColor: string; homeUrl: string; agentWhatsapp: string;
  formTitle: string; footerText: string; onReset: () => void;
}) {
  const whatsappUrl = agentWhatsapp
    ? `https://wa.me/52${agentWhatsapp.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hola, acabo de enviar una solicitud de cotización de ${formTitle}.`)}`
    : '';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl overflow-hidden border border-gray-100 shadow-sm flex items-center justify-center bg-white shrink-0">
            <img src={logoUrl} alt="" className="h-8 w-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{agentName}</p>
            {officeName && <p className="text-[11px] text-gray-400 truncate">{officeName}</p>}
          </div>
          {homeUrl && (
            <a
              href={homeUrl}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 hover:shadow-sm"
              style={{ borderColor: `${primaryColor}30`, color: primaryColor, backgroundColor: `${primaryColor}08` }}
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Inicio</span>
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
          {/* Success icon */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"
            style={{ backgroundColor: `${primaryColor}12`, border: `3px solid ${primaryColor}30` }}
          >
            <Check className="w-9 h-9" style={{ color: primaryColor }} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-3">Solicitud enviada correctamente</h2>

          <p className="text-sm text-gray-500 mb-2 leading-relaxed">
            Tu solicitud de <span className="font-medium text-gray-700">{formTitle}</span> fue recibida.
          </p>

          {/* Agent card */}
          <div className="flex items-center justify-center gap-3 my-5 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: `${primaryColor}40` }} />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
                {getInitials(agentName)}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">{agentName}</p>
              <p className="text-xs text-gray-400">Te contactará a la brevedad</p>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97]"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4" />
                Escribir por WhatsApp
              </a>
            )}

            {homeUrl && (
              <a
                href={homeUrl}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-medium rounded-xl border transition-all duration-200 hover:shadow-sm"
                style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
              >
                <Home className="w-4 h-4" />
                Ir a la página del agente
              </a>
            )}

            <button
              onClick={onReset}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors pt-2"
            >
              Enviar otra solicitud
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white py-5 px-4 text-center">
        <p className="text-[11px] text-gray-400">{footerText}</p>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Form Steps

function ContactStep({ formData, errors, updateField, primaryColor }: {
  formData: Record<string, any>; errors: Record<string, string>;
  updateField: (f: string, v: any) => void; primaryColor: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tus datos de contacto</h2>
        <p className="text-sm text-gray-500">Para que podamos ponernos en contacto contigo.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nombre completo o razón social <span className="text-red-500">*</span>
        </label>
        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors" />
          <input
            type="text"
            value={formData.client_name || ''}
            onChange={e => updateField('client_name', e.target.value)}
            placeholder="Tu nombre completo o empresa"
            className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm transition-all duration-200 outline-none ${errors.client_name ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-gray-300 focus:border-transparent'} focus:ring-2`}
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
        {errors.client_name && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.client_name}</p>}
      </div>

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
            <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors" />
            <input
              type="tel"
              value={formData.client_whatsapp || ''}
              onChange={e => updateField('client_whatsapp', e.target.value)}
              placeholder="WhatsApp (10 dígitos)"
              className="w-full pl-11 pr-28 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}12`, color: primaryColor }}>
              Recomendado
            </span>
          </div>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors" />
            <input
              type="email"
              value={formData.client_email || ''}
              onChange={e => updateField('client_email', e.target.value)}
              placeholder="Correo electrónico"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
        </div>
      </div>

      <CollapsibleSection title="Datos fiscales (opcional)">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">RFC</label>
          <input
            type="text"
            value={formData.client_rfc || ''}
            onChange={e => updateField('client_rfc', e.target.value.toUpperCase())}
            placeholder="RFC (13 caracteres)"
            maxLength={13}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function RiskStep({ formData, errors, updateField, template, primaryColor }: {
  formData: Record<string, any>; errors: Record<string, string>;
  updateField: (f: string, v: any) => void; template: FormTemplate; primaryColor: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Información del seguro</h2>
        <p className="text-sm text-gray-500">Cuéntanos más sobre lo que deseas asegurar.</p>
      </div>

      {template.requires_risk_location && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ubicación del riesgo <span className="text-red-500">*</span>
          </label>
          <div className="relative group">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 transition-colors" />
            <textarea
              value={formData.risk_location_compact || ''}
              onChange={e => updateField('risk_location_compact', e.target.value)}
              placeholder="Calle, número, colonia, ciudad, estado"
              rows={2}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm resize-none transition-all duration-200 outline-none ${errors.risk_location_compact ? 'border-red-300 bg-red-50/50' : 'border-gray-200 hover:border-gray-300 focus:border-transparent'} focus:ring-2`}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
          {errors.risk_location_compact && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.risk_location_compact}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Descripción breve <span className="text-gray-400 text-xs font-normal">opcional</span>
        </label>
        <div className="relative group">
          <Shield className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 transition-colors" />
          <textarea
            value={formData.risk_description || ''}
            onChange={e => updateField('risk_description', e.target.value)}
            placeholder="Descripción del bien o riesgo que deseas asegurar"
            rows={3}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
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
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Vigencia deseada desde</label>
          <input
            type="date"
            value={formData.start_date || ''}
            onChange={e => updateField('start_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
            style={{ '--tw-ring-color': primaryColor } as any}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones adicionales</label>
        <textarea
          value={formData.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Información adicional que consideres relevante"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 focus:border-transparent transition-all duration-200 outline-none focus:ring-2"
          style={{ '--tw-ring-color': primaryColor } as any}
        />
      </div>
    </div>
  );
}

function ReviewStep({ formData, formTitle, primaryColor, agentName }: {
  formData: Record<string, any>; formTitle: string; primaryColor: string; agentName: string;
}) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Nombre', value: formData.client_name },
    { label: 'WhatsApp', value: formData.client_whatsapp },
    { label: 'Correo', value: formData.client_email },
    { label: 'RFC', value: formData.client_rfc },
    { label: 'Ubicación del riesgo', value: formData.risk_location_compact },
    { label: 'Descripción', value: formData.risk_description },
    { label: 'Suma asegurada', value: formData.sum_insured },
    { label: 'Vigencia desde', value: formData.start_date },
    { label: 'Observaciones', value: formData.notes },
  ].filter(f => f.value?.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Confirma tu solicitud</h2>
        <p className="text-sm text-gray-500">Revisa la información antes de enviar.</p>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2" style={{ backgroundColor: `${primaryColor}08` }}>
          <FileText className="w-4 h-4" style={{ color: primaryColor }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>{formTitle}</p>
        </div>
        <div className="p-4 space-y-2.5">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between items-start text-sm py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-gray-500 shrink-0">{f.label}</span>
              <span className="font-medium text-gray-800 text-right ml-4 break-words max-w-[60%]">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border" style={{ backgroundColor: `${primaryColor}06`, borderColor: `${primaryColor}20` }}>
        <p className="text-sm leading-relaxed" style={{ color: darkenHex(primaryColor, 40) }}>
          Al enviar, <strong>{agentName}</strong> recibirá tu solicitud y se pondrá en contacto contigo a la brevedad por los medios proporcionados.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Utilities

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
