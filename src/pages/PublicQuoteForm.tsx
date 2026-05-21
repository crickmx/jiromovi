import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2, Check, AlertCircle, ArrowRight, ArrowLeft,
  User, Mail, MessageCircle, MapPin, Shield, ChevronDown,
  Send, FileText, Home, Globe,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const PRIVACY_URL = 'https://agentedeseguros.website/privacidad';

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

interface BrandTheme {
  primary: string;
  secondary: string;
  primarySoft: string;
  secondarySoft: string;
  gradient: string;
  textOnPrimary: string;
}

type Step = 'contact' | 'risk' | 'review';

// ──────────────────────────────────────────────────────────
// Color utilities

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  if (h.length < 6) return { r: 37, g: 99, b: 235 };
  return { r: parseInt(h.substring(0, 2), 16) || 0, g: parseInt(h.substring(2, 4), 16) || 0, b: parseInt(h.substring(4, 6), 16) || 0 };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, v));
  return `#${[c(r - amount), c(g - amount), c(b - amount)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function getReadableTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
}

function resolveBrandTheme(primary: string, secondary: string): BrandTheme {
  return {
    primary,
    secondary,
    primarySoft: hexToRgba(primary, 0.08),
    secondarySoft: hexToRgba(secondary, 0.08),
    gradient: `linear-gradient(135deg, ${primary}, ${secondary})`,
    textOnPrimary: getReadableTextColor(primary),
  };
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function getAgentPublicUrl(slug: string): string {
  return slug ? `https://agentedeseguros.website/${slug}` : '';
}

// ──────────────────────────────────────────────────────────
// Main component

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
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-shared-quote-form/${slug}`, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error === 'inactive' ? 'inactive' : 'not_found'); return; }
        setLink(json.link);
        setTemplate(json.template);
      } catch { setError('error'); } finally { setLoading(false); }
    })();
  }, [slug]);

  const brand = link?.brand_config_json || {};
  const primaryColor = brand.primary_color || '#2563eb';
  const secondaryColor = brand.secondary_color || darkenHex(primaryColor, 30);
  const theme = resolveBrandTheme(primaryColor, secondaryColor);
  const agentName = brand.agent_name || 'Agente de Seguros';
  const officeName = brand.office_name || '';
  const logoUrl = brand.logo_url || '/logojiro.png';
  const profileImageUrl = brand.profile_image_url || '';
  const agentSlug = brand.agent_slug || '';
  const agentWhatsapp = brand.agent_whatsapp || '';
  const homeUrl = getAgentPublicUrl(agentSlug);

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
      if (payload.client_whatsapp && !payload.client_phone) payload.client_phone = payload.client_whatsapp;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-shared-quote-form/${slug}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'contact_required') { setSubmitError('Por favor proporciona al menos un medio de contacto.'); setStep('contact'); return; }
        throw new Error(json.message || json.error || 'Error al enviar');
      }
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Ocurrió un error. Intenta de nuevo.');
    } finally { setSubmitting(false); }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  // Error: not found
  if (error === 'not_found' || error === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
          <FileText className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Formulario no encontrado</h1>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">El enlace que usas no existe o fue eliminado. Contacta a tu agente para obtener un enlace actualizado.</p>
      </div>
    );
  }

  // Error: inactive
  if (error === 'inactive') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-5">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">Formulario no disponible</h1>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">Este formulario ha sido desactivado. Contacta directamente al agente para continuar.</p>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <SuccessPage
        agentName={agentName} officeName={officeName} logoUrl={logoUrl}
        profileImageUrl={profileImageUrl} theme={theme} homeUrl={homeUrl}
        agentWhatsapp={agentWhatsapp} formTitle={link!.form_title} agentSlug={agentSlug}
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
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fb' }}>
        {/* Hero header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${hexToRgba(primaryColor, 0.06)} 0%, ${hexToRgba(secondaryColor, 0.04)} 50%, transparent 100%)` }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${hexToRgba(primaryColor, 0.15)}, transparent)` }} />

          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
            <div className="flex items-center gap-4">
              {/* Logo in its own container */}
              <div className="shrink-0">
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-center justify-center p-1.5">
                  <img
                    src={logoUrl} alt={agentName}
                    className="h-full w-full object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }}
                  />
                </div>
              </div>

              {/* Profile avatar - separate from logo */}
              <div className="shrink-0">
                {profileImageUrl ? (
                  <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden ring-2 ring-white shadow-md" style={{ boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.2)}` }}>
                    <img src={profileImageUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="h-full w-full flex items-center justify-center text-xs font-bold text-white" style="background:${primaryColor}">${getInitials(agentName)}</div>`; }} />
                  </div>
                ) : (
                  <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md" style={{ backgroundColor: primaryColor }}>
                    {getInitials(agentName)}
                  </div>
                )}
              </div>

              {/* Name and form title */}
              <div className="flex-1 min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate leading-tight">{agentName}</h1>
                {officeName && <p className="text-[11px] sm:text-xs text-gray-400 truncate mt-0.5">{officeName}</p>}
                <p className="text-xs sm:text-sm font-medium truncate mt-0.5" style={{ color: primaryColor }}>{link!.form_title}</p>
              </div>

              {/* Home button - icon only */}
              {homeUrl && (
                <a
                  href={homeUrl}
                  title="Ir al inicio"
                  className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all duration-200 hover:shadow-sm"
                  style={{ borderColor: hexToRgba(primaryColor, 0.2), backgroundColor: hexToRgba(primaryColor, 0.04), color: primaryColor }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.12); }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.04); }}
                >
                  <Home className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white/70 backdrop-blur-sm border-b border-gray-100 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center relative">
              {/* Track */}
              <div className="absolute top-4 left-[10%] right-[10%] h-[2px] bg-gray-200 rounded-full" />
              <div
                className="absolute top-4 left-[10%] h-[2px] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(stepIdx / (steps.length - 1)) * 80}%`, background: theme.gradient }}
              />

              {stepLabels.map((label, i) => (
                <div key={i} className="relative flex flex-col items-center z-10 flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                    style={{
                      background: i < stepIdx ? theme.gradient : i === stepIdx ? primaryColor : '#ffffff',
                      border: i <= stepIdx ? 'none' : '2px solid #e5e7eb',
                      color: i <= stepIdx ? '#ffffff' : '#9ca3af',
                      boxShadow: i === stepIdx ? `0 0 0 4px ${hexToRgba(primaryColor, 0.15)}, 0 2px 4px ${hexToRgba(primaryColor, 0.2)}` : i < stepIdx ? `0 1px 3px ${hexToRgba(secondaryColor, 0.3)}` : 'none',
                    }}
                  >
                    {i < stepIdx ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight max-w-[80px] sm:max-w-none" style={{ color: i <= stepIdx ? primaryColor : '#9ca3af' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-lg mx-auto space-y-5">
            {/* Form card */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300" style={{ borderColor: hexToRgba(primaryColor, 0.1) }}>
              <div className="p-5 sm:p-7">
                {step === 'contact' && <ContactStep formData={formData} errors={fieldErrors} updateField={updateField} theme={theme} />}
                {step === 'risk' && template && <RiskStep formData={formData} errors={fieldErrors} updateField={updateField} template={template} theme={theme} />}
                {step === 'review' && <ReviewStep formData={formData} formTitle={link!.form_title} theme={theme} agentName={agentName} />}
              </div>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-1">
              {stepIdx > 0 ? (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm active:scale-[0.97]"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>
              ) : <div />}

              {step !== 'review' ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-5 sm:px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97]"
                  style={{ background: theme.gradient, color: theme.textOnPrimary }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Siguiente <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 sm:px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none"
                  style={{ background: theme.gradient, color: theme.textOnPrimary }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar solicitud
                </button>
              )}
            </div>

            {/* Privacy micro-text */}
            <p className="text-center text-[11px] text-gray-400 leading-relaxed pt-1">
              Tus datos serán utilizados únicamente para preparar tu cotización.{' '}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500 transition-colors">
                Aviso de privacidad
              </a>
            </p>
          </div>
        </main>

        {/* Footer */}
        <PublicFooter agentName={agentName} officeName={officeName} agentSlug={agentSlug} theme={theme} />
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Footer

function PublicFooter({ agentName, officeName, agentSlug, theme }: {
  agentName: string; officeName: string; agentSlug: string; theme: BrandTheme;
}) {
  const publicUrl = getAgentPublicUrl(agentSlug);
  const displayUrl = agentSlug ? `agentedeseguros.website/${agentSlug}` : 'agentedeseguros.website';

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8 text-center space-y-3">
        <p className="text-sm font-semibold text-gray-800">{agentName}</p>
        {officeName && <p className="text-xs text-gray-400">{officeName}</p>}

        {publicUrl && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
            style={{ color: theme.primary }}
          >
            <Globe className="w-3.5 h-3.5" />
            {displayUrl}
          </a>
        )}

        <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-gray-400">
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 underline transition-colors">
            Aviso de privacidad
          </a>
          <span className="text-gray-200">|</span>
          <span>Powered by MOVI Digital</span>
        </div>

        <p className="text-[10px] text-gray-300 pt-1">
          Tus datos están protegidos y no serán compartidos con terceros.
        </p>
      </div>
    </footer>
  );
}

// ──────────────────────────────────────────────────────────
// Success Page

function SuccessPage({ agentName, officeName, logoUrl, profileImageUrl, theme, homeUrl, agentWhatsapp, formTitle, agentSlug, onReset }: {
  agentName: string; officeName: string; logoUrl: string; profileImageUrl: string;
  theme: BrandTheme; homeUrl: string; agentWhatsapp: string;
  formTitle: string; agentSlug: string; onReset: () => void;
}) {
  const whatsappUrl = agentWhatsapp
    ? `https://wa.me/52${agentWhatsapp.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hola, acabo de enviar una solicitud de cotización de ${formTitle}.`)}`
    : '';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f8f9fb' }}>
      {/* Minimal header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white border border-gray-200/80 shadow-sm flex items-center justify-center p-1">
            <img src={logoUrl} alt="" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/logojiro.png'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{agentName}</p>
            {officeName && <p className="text-[11px] text-gray-400 truncate">{officeName}</p>}
          </div>
          {homeUrl && (
            <a href={homeUrl} title="Ir al inicio" className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 hover:shadow-sm" style={{ borderColor: hexToRgba(theme.primary, 0.2), backgroundColor: hexToRgba(theme.primary, 0.04), color: theme.primary }}>
              <Home className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Success content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 max-w-sm w-full text-center">
          {/* Success icon with gradient ring */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full" style={{ background: theme.gradient, opacity: 0.1 }} />
            <div className="absolute inset-1.5 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: `0 0 0 3px ${hexToRgba(theme.primary, 0.15)}` }}>
              <Check className="w-8 h-8" style={{ color: theme.primary }} />
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Solicitud enviada correctamente</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-1">
            Tu solicitud de <span className="font-medium text-gray-700">{formTitle}</span> fue recibida.
          </p>

          {/* Agent mini-card */}
          <div className="flex items-center justify-center gap-3 my-5 px-4 py-3 rounded-xl border border-gray-100" style={{ backgroundColor: theme.primarySoft }}>
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: theme.primary, color: theme.textOnPrimary }}>
                {getInitials(agentName)}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">{agentName}</p>
              <p className="text-[11px] text-gray-400">Revisará tu solicitud y te contactará</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3 mt-6">
            {whatsappUrl && (
              <a
                href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.97]"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle className="w-4 h-4" /> Escribir por WhatsApp
              </a>
            )}

            {homeUrl && (
              <a
                href={homeUrl}
                className="flex items-center justify-center gap-2 w-full px-5 py-2.5 text-sm font-medium rounded-xl border transition-all duration-200 hover:shadow-sm"
                style={{ borderColor: hexToRgba(theme.primary, 0.25), color: theme.primary }}
              >
                <Home className="w-4 h-4" /> Ir a la página del agente
              </a>
            )}

            <button onClick={onReset} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors pt-2">
              Enviar otra solicitud
            </button>
          </div>

          {/* Privacy link */}
          <p className="text-[10px] text-gray-300 mt-5">
            <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-400 transition-colors">
              Aviso de privacidad
            </a>
          </p>
        </div>
      </main>

      <PublicFooter agentName={agentName} officeName={officeName} agentSlug={agentSlug} theme={theme} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Contact Step

function ContactStep({ formData, errors, updateField, theme }: {
  formData: Record<string, any>; errors: Record<string, string>;
  updateField: (f: string, v: any) => void; theme: BrandTheme;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Tus datos de contacto</h2>
        <p className="text-sm text-gray-500">Para que podamos ponernos en contacto contigo.</p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre completo o razón social <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: errors.client_name ? '#ef4444' : hexToRgba(theme.primary, 0.5) }} />
          <input
            type="text"
            value={formData.client_name || ''}
            onChange={e => updateField('client_name', e.target.value)}
            placeholder="Tu nombre completo o empresa"
            className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm transition-all duration-200 outline-none ${errors.client_name ? 'border-red-300 bg-red-50/40' : 'border-gray-200 hover:border-gray-300'} focus:ring-2 focus:border-transparent`}
            style={{ '--tw-ring-color': theme.primary } as any}
          />
        </div>
        {errors.client_name && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.client_name}</p>}
      </div>

      {/* Contact methods */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Medios de contacto <span className="text-red-400">*</span>
          <span className="text-xs text-gray-400 font-normal ml-1">(al menos uno)</span>
        </label>
        {errors.contact && (
          <p className="mb-3 text-xs text-red-500 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors.contact}
          </p>
        )}
        <div className="space-y-3">
          <div className="relative">
            <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: hexToRgba(theme.primary, 0.5) }} />
            <input
              type="tel"
              value={formData.client_whatsapp || ''}
              onChange={e => updateField('client_whatsapp', e.target.value)}
              placeholder="WhatsApp (10 dígitos)"
              className="w-full pl-11 pr-28 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': theme.primary } as any}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: theme.primarySoft, color: theme.primary }}>
              Recomendado
            </span>
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: hexToRgba(theme.primary, 0.5) }} />
            <input
              type="email"
              value={formData.client_email || ''}
              onChange={e => updateField('client_email', e.target.value)}
              placeholder="Correo electrónico"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': theme.primary } as any}
            />
          </div>
        </div>
      </div>

      {/* RFC collapsible */}
      <CollapsibleSection title="Datos fiscales (opcional)" theme={theme}>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">RFC</label>
          <input
            type="text"
            value={formData.client_rfc || ''}
            onChange={e => updateField('client_rfc', e.target.value.toUpperCase())}
            placeholder="RFC (13 caracteres)"
            maxLength={13}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': theme.primary } as any}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Risk Step

function RiskStep({ formData, errors, updateField, template, theme }: {
  formData: Record<string, any>; errors: Record<string, string>;
  updateField: (f: string, v: any) => void; template: FormTemplate; theme: BrandTheme;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Información del seguro</h2>
        <p className="text-sm text-gray-500">Cuéntanos más sobre lo que deseas asegurar.</p>
      </div>

      {template.requires_risk_location && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Ubicación del riesgo <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4" style={{ color: hexToRgba(theme.primary, 0.5) }} />
            <textarea
              value={formData.risk_location_compact || ''}
              onChange={e => updateField('risk_location_compact', e.target.value)}
              placeholder="Calle, número, colonia, ciudad, estado"
              rows={2}
              className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm resize-none transition-all duration-200 outline-none ${errors.risk_location_compact ? 'border-red-300 bg-red-50/40' : 'border-gray-200 hover:border-gray-300'} focus:ring-2 focus:border-transparent`}
              style={{ '--tw-ring-color': theme.primary } as any}
            />
          </div>
          {errors.risk_location_compact && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.risk_location_compact}</p>}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Descripción breve <span className="text-xs text-gray-400 font-normal">opcional</span>
        </label>
        <div className="relative">
          <Shield className="absolute left-3.5 top-3 w-4 h-4" style={{ color: hexToRgba(theme.primary, 0.5) }} />
          <textarea
            value={formData.risk_description || ''}
            onChange={e => updateField('risk_description', e.target.value)}
            placeholder="Descripción del bien o riesgo que deseas asegurar"
            rows={3}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': theme.primary } as any}
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
            placeholder="Ej: $500,000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': theme.primary } as any}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia deseada desde</label>
          <input
            type="date"
            value={formData.start_date || ''}
            onChange={e => updateField('start_date', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': theme.primary } as any}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones adicionales</label>
        <textarea
          value={formData.notes || ''}
          onChange={e => updateField('notes', e.target.value)}
          placeholder="Información adicional que consideres relevante"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none hover:border-gray-300 transition-all duration-200 outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': theme.primary } as any}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Review Step

function ReviewStep({ formData, formTitle, theme, agentName }: {
  formData: Record<string, any>; formTitle: string; theme: BrandTheme; agentName: string;
}) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Nombre', value: formData.client_name },
    { label: 'WhatsApp', value: formData.client_whatsapp },
    { label: 'Correo electrónico', value: formData.client_email },
    { label: 'RFC', value: formData.client_rfc },
    { label: 'Ubicación del riesgo', value: formData.risk_location_compact },
    { label: 'Descripción', value: formData.risk_description },
    { label: 'Suma asegurada', value: formData.sum_insured },
    { label: 'Vigencia desde', value: formData.start_date },
    { label: 'Observaciones', value: formData.notes },
  ].filter(f => f.value?.trim());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Confirma tu solicitud</h2>
        <p className="text-sm text-gray-500">Revisa la información antes de enviar.</p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: hexToRgba(theme.primary, 0.15) }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ backgroundColor: theme.primarySoft, borderColor: hexToRgba(theme.primary, 0.1) }}>
          <FileText className="w-4 h-4" style={{ color: theme.primary }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>{formTitle}</p>
        </div>
        <div className="p-4 space-y-2">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between items-start text-sm py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-500 shrink-0 text-xs sm:text-sm">{f.label}</span>
              <span className="font-medium text-gray-800 text-right ml-4 break-words max-w-[55%] text-xs sm:text-sm">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border" style={{ backgroundColor: theme.secondarySoft, borderColor: hexToRgba(theme.secondary, 0.15) }}>
        <p className="text-sm leading-relaxed text-gray-700">
          Al enviar, <strong>{agentName}</strong> recibirá tu solicitud y se pondrá en contacto contigo a la brevedad por los medios proporcionados.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Collapsible Section

function CollapsibleSection({ title, children, theme }: { title: string; children: React.ReactNode; theme: BrandTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-300">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50/50 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: open ? theme.primary : undefined }} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">{children}</div>
      )}
    </div>
  );
}
