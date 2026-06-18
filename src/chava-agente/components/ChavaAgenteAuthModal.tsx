import { useState, type ReactNode } from 'react';
import { useChavaAgente, type RegisterData } from '../lib/ChavaAgenteContext';
import { TIPO_USUARIO_LABELS, type TipoUsuario } from '../lib/types';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import { X, Mail, ArrowRight, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, User, Phone, MapPin, MessageSquare, ShieldCheck, BookOpen } from 'lucide-react';

type Step = 'choice' | 'login_email' | 'login_otp' | 'register_form' | 'register_otp' | 'success';

interface Props {
  onClose: () => void;
  pendingMessage?: string;
  initialView?: 'login' | 'register';
}

export default function ChavaAgenteAuthModal({ onClose, pendingMessage, initialView }: Props) {
  const { login, register, verifyCode, terms } = useChavaAgente();
  const [step, setStep] = useState<Step>(
    initialView === 'register' ? 'register_form' : initialView === 'login' ? 'login_email' : 'choice'
  );
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RegisterData, 'email' | 'terms_version' | 'terms_ip'>>({
    nombre_completo: '',
    whatsapp: '',
    estado: '',
    codigo_postal: '',
    tipo_usuario: 'particular',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const ESTADOS_MX = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
    'Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero',
    'Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro',
    'Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz',
    'Yucatán','Zacatecas',
  ];

  async function handleLoginEmail() {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    try {
      const result = await login(email.trim());
      if (!result.email_sent && !result.whatsapp_sent) {
        setError('No encontramos una cuenta con ese correo. ¿Aún no tienes cuenta? Usa "Soy nuevo".');
        return;
      }
      setEmailSent(result.email_sent);
      setWhatsappSent(result.whatsapp_sent);
      setMaskedEmail(result.masked_email);
      setStep('login_otp');
    } catch (e: any) {
      setError(e.message || 'Error al enviar el código');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(isRegister = false) {
    if (!otp.trim() || otp.length < 6) return;
    setError('');
    setLoading(true);
    try {
      await verifyCode(email.trim(), otp.trim());
      setStep('success');
      setTimeout(() => onClose(), 1400);
    } catch (e: any) {
      if (e.code === 'EXPIRED') {
        setError('El código ha expirado. Solicita uno nuevo.');
        setStep(isRegister ? 'register_form' : 'login_email');
      } else if (e.code === 'MAX_ATTEMPTS') {
        setError('Demasiados intentos. Solicita un nuevo código.');
        setStep(isRegister ? 'register_form' : 'login_email');
      } else if (e.remaining_attempts !== undefined) {
        setError(e.message || 'Código incorrecto.');
      } else {
        setError('Código inválido o expirado. Verifica e intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode(isRegister = false) {
    setError('');
    setLoading(true);
    try {
      const result = await login(email.trim());
      setEmailSent(result.email_sent);
      setWhatsappSent(result.whatsapp_sent);
      setOtp('');
    } catch (e: any) {
      setError(e.message || 'Error al reenviar el código');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit() {
    if (!termsAccepted) { setError('Debes aceptar los términos y condiciones'); return; }
    if (!form.nombre_completo.trim()) { setError('Ingresa tu nombre completo'); return; }
    if (!email.trim()) { setError('Ingresa tu email'); return; }
    setError('');
    setLoading(true);
    try {
      const regData: RegisterData = {
        ...form,
        email: email.trim(),
        terms_version: terms?.version || '1.0',
      };
      const result = await register(regData);
      if (result.direct_access) {
        setStep('success');
        setTimeout(() => onClose(), 1400);
        return;
      }
      setEmailSent(result.email_sent);
      setWhatsappSent(result.whatsapp_sent);
      setMaskedEmail(result.masked_email);
      setStep('register_otp');
    } catch (e: any) {
      setError(e.message || 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  }

  const isRegisterStep = step === 'register_otp';

  const stepLabel = {
    choice: 'Accede a tu cuenta',
    login_email: 'Iniciar sesión',
    login_otp: 'Verificar código',
    register_form: 'Crear cuenta',
    register_otp: 'Verificar código',
    success: 'Bienvenido',
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(5, 11, 25, 0.85)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #0c1a3a 0%, #0A183D 60%, #071020 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          maxHeight: '95dvh',
        }}
      >
        {/* Ambient top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(13,110,253,0.18) 0%, transparent 70%)' }} />

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <ChavaAvatar size="sm" />
            <div>
              <p className="text-sm font-semibold text-white">{stepLabel}</p>
              <p className="text-[10px]" style={{ color: '#00E5FF' }}>agentedeseguros.ai</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto chava-auth-scroll flex-1">
          <div className="p-5 space-y-4">

            {/* Success */}
            {step === 'success' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-lg font-semibold text-white">Sesión iniciada</p>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Redirigiendo...</p>
              </div>
            )}

            {/* Choice */}
            {step === 'choice' && (
              <div className="space-y-3">
                {pendingMessage && (
                  <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,158,11,0.9)' }}>
                      Para guardar tu consulta y continuar la conversacion, identifícate.
                    </p>
                  </div>
                )}

                <DarkOption
                  icon={<User className="w-4.5 h-4.5" />}
                  title="Ya tengo cuenta"
                  subtitle="Acceder con mi email"
                  onClick={() => setStep('login_email')}
                  accent
                />
                <DarkOption
                  icon={<Mail className="w-4.5 h-4.5" />}
                  title="Soy nuevo"
                  subtitle="Crear cuenta gratuita"
                  onClick={() => setStep('register_form')}
                />

                {/* Trust badges */}
                <div className="pt-2 grid grid-cols-2 gap-2">
                  {[
                    { icon: ShieldCheck, label: 'Datos protegidos' },
                    { icon: BookOpen, label: 'Conocimiento JIRO' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: '#00E5FF' }} />
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Login — email */}
            {step === 'login_email' && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Ingresa tu email y te enviamos un código de acceso.
                </p>
                <DarkField label="Correo electrónico">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLoginEmail()}
                    placeholder="tu@email.com"
                    autoFocus
                    className="dark-input"
                  />
                </DarkField>
                {error && <DarkError>{error}</DarkError>}
                <DarkButton onClick={handleLoginEmail} disabled={loading || !email.trim()} loading={loading}>
                  Enviar código
                </DarkButton>
                <BackLink onClick={() => setStep('choice')} />
              </div>
            )}

            {/* OTP step */}
            {(step === 'login_otp' || step === 'register_otp') && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    <Mail className="w-6 h-6" style={{ color: '#00E5FF' }} />
                  </div>
                  <p className="text-sm font-semibold text-white">Revisa tu bandeja</p>
                  <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Te enviamos un código de 6 caracteres
                    {maskedEmail ? ` a ${maskedEmail}` : ''}
                  </p>
                </div>

                {/* Channel badges */}
                <div className="flex items-center justify-center gap-2">
                  {emailSent && (
                    <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full" style={{ color: 'rgba(52,211,153,0.9)', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <Mail className="w-3 h-3" /> Correo enviado
                    </span>
                  )}
                  {whatsappSent && (
                    <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full" style={{ color: 'rgba(52,211,153,0.9)', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      <MessageSquare className="w-3 h-3" /> WhatsApp enviado
                    </span>
                  )}
                </div>

                <DarkField label="Código de acceso">
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyOtp(isRegisterStep)}
                    placeholder="ABC123"
                    autoFocus
                    autoComplete="one-time-code"
                    className="dark-input text-center tracking-[0.5em] font-mono uppercase"
                  />
                  <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>Vence en 10 minutos</p>
                </DarkField>

                {error && <DarkError>{error}</DarkError>}
                <DarkButton onClick={() => handleVerifyOtp(isRegisterStep)} disabled={loading || otp.length < 6} loading={loading}>
                  Verificar código
                </DarkButton>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setStep(isRegisterStep ? 'register_form' : 'login_email')}
                    className="text-xs transition-colors"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                  >
                    Cambiar email
                  </button>
                  <button
                    onClick={() => handleResendCode(isRegisterStep)}
                    disabled={loading}
                    className="text-xs font-medium transition-colors disabled:opacity-40"
                    style={{ color: '#00E5FF' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Reenviar código
                  </button>
                </div>
              </div>
            )}

            {/* Register form */}
            {step === 'register_form' && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Crea tu cuenta gratuita y accede al historial de conversaciones.
                </p>

                <DarkField label="Nombre completo">
                  <input
                    type="text"
                    value={form.nombre_completo}
                    onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
                    placeholder="Ej. María García López"
                    className="dark-input"
                  />
                </DarkField>

                <DarkField label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="dark-input"
                  />
                </DarkField>

                <DarkField label="WhatsApp (opcional)">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+52 55 0000 0000"
                      className="dark-input pl-9"
                    />
                  </div>
                </DarkField>

                <div className="grid grid-cols-2 gap-2">
                  <DarkField label="Estado">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <select
                        value={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                        className="dark-input pl-9 appearance-none"
                      >
                        <option value="">Selecciona</option>
                        {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </DarkField>
                  <DarkField label="C.P.">
                    <input
                      type="text"
                      maxLength={5}
                      value={form.codigo_postal}
                      onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value.replace(/\D/g, '') }))}
                      placeholder="00000"
                      className="dark-input"
                    />
                  </DarkField>
                </div>

                <DarkField label="¿Cómo describes tu perfil?">
                  <select
                    value={form.tipo_usuario}
                    onChange={e => setForm(f => ({ ...f, tipo_usuario: e.target.value as TipoUsuario }))}
                    className="dark-input appearance-none"
                  >
                    {(Object.entries(TIPO_USUARIO_LABELS) as [TipoUsuario, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </DarkField>

                {/* Terms */}
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setTermsAccepted(v => !v)}
                      className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                      style={termsAccepted
                        ? { background: '#00E5FF', border: '2px solid #00E5FF' }
                        : { background: 'transparent', border: '2px solid rgba(255,255,255,0.2)' }
                      }
                    >
                      {termsAccepted && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5">
                          <path d="M1 4l3 3 5-6" stroke="#0A183D" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Acepto los{' '}
                      <button type="button" onClick={() => setShowTerms(true)} className="underline transition-colors" style={{ color: '#00E5FF' }}>
                        términos y condiciones
                      </button>
                      {' '}y la{' '}
                      <button type="button" onClick={() => setShowPrivacy(true)} className="underline transition-colors" style={{ color: '#00E5FF' }}>
                        política de privacidad
                      </button>
                      {' '}de Chava AI y Grupo JIRO.
                    </span>
                  </label>
                </div>

                {error && <DarkError>{error}</DarkError>}
                <DarkButton onClick={handleRegisterSubmit} disabled={loading} loading={loading}>
                  Crear cuenta y continuar
                </DarkButton>
                <BackLink onClick={() => setStep('choice')} label="Ya tengo cuenta" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {step !== 'success' && (
          <div className="px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Desarrollado por Grupo JIRO · Seguridad y privacidad garantizadas
            </p>
          </div>
        )}
      </div>

      {/* Terms sub-modal */}
      {showTerms && (
        <SubModal title="Términos y Condiciones" onClose={() => setShowTerms(false)}>
          {terms?.contenido_terminos || 'Cargando...'}
        </SubModal>
      )}

      {showPrivacy && (
        <SubModal title="Política de Privacidad" onClose={() => setShowPrivacy(false)}>
          {terms?.contenido_privacidad || 'Cargando...'}
        </SubModal>
      )}

      <style>{`
        .chava-auth-scroll::-webkit-scrollbar { width: 4px; }
        .chava-auth-scroll::-webkit-scrollbar-track { background: transparent; }
        .chava-auth-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .dark-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 0.8125rem;
          outline: none;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.85);
          transition: border-color 0.15s, box-shadow 0.15s;
          caret-color: #00E5FF;
        }
        .dark-input::placeholder { color: rgba(255,255,255,0.25); }
        .dark-input:focus { border-color: rgba(0,229,255,0.4); box-shadow: 0 0 0 3px rgba(0,229,255,0.08); }
        .dark-input option { background: #0A183D; color: rgba(255,255,255,0.85); }
      `}</style>
    </div>
  );
}

function DarkOption({ icon, title, subtitle, onClick, accent }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all group"
      style={accent
        ? { background: 'rgba(13,110,253,0.1)', border: '1px solid rgba(13,110,253,0.25)' }
        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
      }
      onMouseEnter={e => {
        e.currentTarget.style.background = accent ? 'rgba(13,110,253,0.18)' : 'rgba(255,255,255,0.07)';
        e.currentTarget.style.borderColor = accent ? 'rgba(13,110,253,0.4)' : 'rgba(255,255,255,0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = accent ? 'rgba(13,110,253,0.1)' : 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = accent ? 'rgba(13,110,253,0.25)' : 'rgba(255,255,255,0.08)';
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={accent
          ? { background: 'rgba(13,110,253,0.15)', color: '#60a5fa' }
          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
        }
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p>
      </div>
      <ArrowRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: accent ? '#60a5fa' : 'rgba(255,255,255,0.2)' }} />
    </button>
  );
}

function DarkField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</label>
      {children}
    </div>
  );
}

function DarkButton({ onClick, disabled, loading, children }: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center h-11 rounded-xl text-sm font-semibold text-white transition-all"
      style={disabled
        ? { background: 'rgba(255,255,255,0.08)', opacity: 0.5, cursor: 'not-allowed' }
        : { background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }
      }
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.9'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

function BackLink({ onClick, label = 'Volver' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-xs text-center py-1 transition-colors"
      style={{ color: 'rgba(255,255,255,0.3)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
    >
      {label}
    </button>
  );
}

function DarkError({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(252,165,165,0.9)' }}>
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function SubModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: 'linear-gradient(160deg, #0c1a3a 0%, #0A183D 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '80vh',
        }}
      >
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.65)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
