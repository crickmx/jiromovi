import { useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useChavaAgente, type RegisterData } from '../lib/ChavaAgenteContext';
import { TIPO_USUARIO_LABELS, type TipoUsuario } from '../lib/types';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { X, Mail, ArrowRight, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2, User, Phone, MapPin } from 'lucide-react';

type Step = 'choice' | 'login_email' | 'login_otp' | 'register_form' | 'register_otp' | 'success';

interface Props {
  onClose: () => void;
  pendingMessage?: string;
}

export default function ChavaAgenteAuthModal({ onClose, pendingMessage }: Props) {
  const { login, register, refreshUser, terms } = useChavaAgente();
  const [step, setStep] = useState<Step>('choice');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      await login(email.trim());
      setStep('login_otp');
    } catch (e: any) {
      setError(e.message || 'Error al enviar el código');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(_isRegister = false) {
    if (!otp.trim() || otp.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      await refreshUser();
      setStep('success');
      setTimeout(() => onClose(), 1200);
    } catch (e: any) {
      setError('Código inválido o expirado. Verifica e intenta de nuevo.');
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
      await register(regData);
      setStep('register_otp');
    } catch (e: any) {
      setError(e.message || 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0A183D 100%)' }}>
          <div className="flex items-center gap-3">
            <ChavaBrandLogo size="sm" animate />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-white opacity-80">
              {step === 'choice' && 'Accede a tu cuenta'}
              {(step === 'login_email' || step === 'login_otp') && 'Iniciar sesión'}
              {(step === 'register_form' || step === 'register_otp') && 'Crear cuenta'}
              {step === 'success' && 'Bienvenido'}
            </p>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-slate-800">Sesión iniciada</p>
              <p className="text-sm text-slate-500 mt-1">Redirigiendo...</p>
            </div>
          )}

          {/* Choice */}
          {step === 'choice' && (
            <div className="space-y-3">
              {pendingMessage && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-amber-700">Para continuar con tu consulta, necesitas identificarte.</p>
                </div>
              )}
              <button
                onClick={() => setStep('login_email')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                  <Mail className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Ya tengo cuenta</p>
                  <p className="text-xs text-slate-500">Acceder con mi email</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
              </button>
              <button
                onClick={() => setStep('register_form')}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Soy nuevo</p>
                  <p className="text-xs text-slate-500">Crear cuenta gratuita</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>
            </div>
          )}

          {/* Login — email */}
          {step === 'login_email' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Ingresa tu email y te enviamos un código de acceso.</p>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLoginEmail()}
                  placeholder="tu@email.com"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                />
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button onClick={handleLoginEmail} disabled={loading || !email.trim()} className="w-full btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Enviar código'}
              </button>
              <button onClick={() => setStep('choice')} className="w-full text-xs text-slate-500 hover:text-slate-700">Volver</button>
            </div>
          )}

          {/* Login — OTP */}
          {(step === 'login_otp' || step === 'register_otp') && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-cyan-600" />
                </div>
                <p className="text-sm text-slate-600">Te enviamos un código de 6 dígitos a</p>
                <p className="text-sm font-semibold text-slate-800 mt-1">{email}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Código de verificación</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp(step === 'register_otp')}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                />
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button onClick={() => handleVerifyOtp(step === 'register_otp')} disabled={loading || otp.length < 6} className="w-full btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Verificar'}
              </button>
              <button onClick={() => setStep(step === 'register_otp' ? 'register_form' : 'login_email')} className="w-full text-xs text-slate-500 hover:text-slate-700">Cambiar email</button>
            </div>
          )}

          {/* Register form */}
          {step === 'register_form' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Crea tu cuenta gratuita en segundos.</p>
              <div className="grid grid-cols-1 gap-3">
                <Field label="Nombre completo">
                  <input
                    type="text"
                    value={form.nombre_completo}
                    onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
                    placeholder="Ej. María García López"
                    className="field-input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="field-input"
                  />
                </Field>
                <Field label="WhatsApp (opcional)">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+52 55 0000 0000"
                      className="field-input pl-8"
                    />
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Estado">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <select
                        value={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                        className="field-input pl-8 appearance-none"
                      >
                        <option value="">Selecciona</option>
                        {ESTADOS_MX.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </Field>
                  <Field label="C.P.">
                    <input
                      type="text"
                      maxLength={5}
                      value={form.codigo_postal}
                      onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value.replace(/\D/g, '') }))}
                      placeholder="00000"
                      className="field-input"
                    />
                  </Field>
                </div>
                <Field label="¿Cómo describes tu perfil?">
                  <select
                    value={form.tipo_usuario}
                    onChange={e => setForm(f => ({ ...f, tipo_usuario: e.target.value as TipoUsuario }))}
                    className="field-input appearance-none"
                  >
                    {(Object.entries(TIPO_USUARIO_LABELS) as [TipoUsuario, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Terms */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <div
                    onClick={() => setTermsAccepted(v => !v)}
                    className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors cursor-pointer ${termsAccepted ? 'bg-cyan-500 border-cyan-500' : 'border-slate-300'}`}
                  >
                    {termsAccepted && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Acepto los{' '}
                    <button type="button" onClick={() => setShowTerms(true)} className="text-cyan-600 underline hover:text-cyan-700">términos y condiciones</button>
                    {' '}y la{' '}
                    <button type="button" onClick={() => setShowPrivacy(true)} className="text-cyan-600 underline hover:text-cyan-700">política de privacidad</button>
                    {' '}de Chava Agente y Grupo JIRO.
                  </span>
                </label>
              </div>

              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button onClick={handleRegisterSubmit} disabled={loading} className="w-full btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Crear cuenta y continuar'}
              </button>
              <button onClick={() => setStep('choice')} className="w-full text-xs text-slate-500 hover:text-slate-700">Ya tengo cuenta</button>
            </div>
          )}
        </div>
      </div>

      {/* Terms modal */}
      {showTerms && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowTerms(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">Términos y Condiciones</p>
              <button onClick={() => setShowTerms(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {terms?.contenido_terminos || 'Cargando...'}
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowPrivacy(false)} />
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">Política de Privacidad</p>
              <button onClick={() => setShowPrivacy(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {terms?.contenido_privacidad || 'Cargando...'}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .btn-primary {
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          color: white; font-weight: 600; font-size: 0.875rem;
          padding: 0.75rem 1rem; border-radius: 0.75rem;
          transition: opacity 0.2s, transform 0.1s;
          border: none; cursor: pointer;
        }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; }
        .btn-primary:active:not(:disabled) { transform: scale(0.99); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .field-input {
          width: 100%; padding: 0.625rem 0.875rem; border-radius: 0.625rem;
          border: 1px solid #e2e8f0; font-size: 0.8125rem;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          background: white;
        }
        .field-input:focus { border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6,182,212,0.12); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {children}
    </div>
  );
}

