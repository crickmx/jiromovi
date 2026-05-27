import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft, RefreshCw, CheckCircle } from 'lucide-react';
import MoviPreloader from '../components/MoviPreloader';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Animated background ──────────────────────────────────────────────────────
function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #051530 0%, #0b2d6b 35%, #0d3680 55%, #0a2258 80%, #040d1f 100%)',
      }} />
      <div className="absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full opacity-25 animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, #1a56db 0%, transparent 65%)' }} />
      <div className="absolute top-1/3 -right-64 w-[600px] h-[600px] rounded-full opacity-20 animate-pulse-slower"
        style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 65%)' }} />
      <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] rounded-full opacity-15 animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 65%)' }} />
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute top-0 left-0 right-0 h-px opacity-30"
        style={{ background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)' }} />
    </div>
  );
}

type Step = 'email' | 'code';

export function Login() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPreloader, setShowPreloader] = useState(false);
  const [userName, setUserName] = useState('Usuario');
  const navigate = useNavigate();

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.16)',
    color: 'white',
  };
  const inputCls = 'w-full h-12 px-4 text-sm rounded-xl transition-all duration-200 outline-none placeholder:text-white/40';

  const handleFocusOn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(96,165,250,0.6)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
  };
  const handleFocusOff = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = inputStyle.border as string;
    e.currentTarget.style.background = inputStyle.background as string;
  };

  // Step 1: request code
  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Ingresa tu correo electrónico.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'movi' }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(data.error || 'Espera un momento antes de solicitar otro código.');
        return;
      }
      // Always show code screen (don't leak if user exists)
      setMaskedEmail(data.masked_email || email);
      setStep('code');
      setResendCooldown(120);
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify code
  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) { setError('Ingresa el código de 6 caracteres.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), platform: 'movi' }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'EXPIRED') {
          setError('El código expiró. Solicita uno nuevo.');
          setStep('email');
          setCode('');
        } else if (data.code === 'MAX_ATTEMPTS') {
          setError('Demasiados intentos fallidos. Solicita un nuevo código.');
          setStep('email');
          setCode('');
        } else {
          setError(data.error || 'Código incorrecto.');
        }
        return;
      }

      // Verify the token_hash returned from the edge function to create a session
      const { error: sessionError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'email',
      });

      if (sessionError) {
        setError('Error al iniciar sesión. Solicita un nuevo código.');
        return;
      }

      // Fetch user name for preloader
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: ud } = await supabase.from('usuarios').select('nombre').eq('id', user.id).maybeSingle();
        if (ud?.nombre) setUserName(ud.nombre);
      }

      setShowPreloader(true);
      setTimeout(() => navigate('/'), 3000);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setCode('');
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'movi' }),
      });
      const data = await res.json();
      if (res.status === 429) { setError(data.error || 'Espera antes de reenviar.'); return; }
      setResendCooldown(120);
    } catch {
      setError('Error al reenviar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MoviPreloader
        isOpen={showPreloader}
        userName={userName}
        subtitle="Preparando tu experiencia digital..."
        logoIconUrl="/movirecurso_1.png"
        minDurationMs={3000}
      />

      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* ── LEFT COLUMN ── */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div>
              <img src="https://movi.digital/wp-content/uploads/2025/12/moviRecurso-2.png" alt="MOVI Digital" className="h-16 xl:h-20 object-contain" />
            </div>
            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-blue-300/70 mb-4">movi.digital</p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.12] tracking-tight">Mi Oficina Virtual</h1>
              <p className="mt-5 text-base text-white/50 leading-relaxed max-w-sm">Grupo JIRO</p>
            </div>
            <div className="flex items-center gap-5 text-[11px] text-white/30">
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">movi.digital</a>
              <span className="w-px h-3 bg-white/15" />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">grupojiro.com</a>
              <span className="w-px h-3 bg-white/15" />
              <span>© {new Date().getFullYear()} MOVI Digital</span>
            </div>
          </div>

          <div className="hidden lg:block w-px self-stretch my-12"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, transparent)' }} />

          {/* ── RIGHT COLUMN ── */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            <div className="lg:hidden mb-10 text-center">
              <img src="https://movi.digital/wp-content/uploads/2025/12/moviRecurso-2.png" alt="MOVI Digital" className="h-14 object-contain mx-auto" />
            </div>

            <div className="w-full max-w-[380px]">

              {/* ── STEP 1: Email ── */}
              {step === 'email' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Iniciar sesión</h2>
                    <p className="mt-1.5 text-sm text-white/45">Ingresa tu correo para recibir tu código de acceso</p>
                  </div>

                  <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
                    {error && (
                      <div className="px-4 py-3 rounded-xl text-sm text-red-300 font-medium"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        {error}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="email" className="block text-xs font-semibold text-white/55 tracking-wide uppercase">
                        Correo electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          placeholder="usuario@empresa.com"
                          className={`${inputCls} pl-10`}
                          style={inputStyle}
                          autoComplete="email"
                          autoFocus
                          onFocus={handleFocusOn}
                          onBlur={handleFocusOff}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-[#0b2d6b] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      style={{ background: loading ? 'rgba(255,255,255,0.7)' : 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
                    >
                      {loading ? (
                        <><span className="w-4 h-4 border-2 border-blue-800/30 border-t-blue-800 rounded-full animate-spin" /><span>Enviando código...</span></>
                      ) : (
                        <><span>Enviar código de acceso</span><ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <div className="pt-4 text-center">
                      <span className="text-sm text-white/35">¿No tienes cuenta? </span>
                      <button type="button" onClick={() => window.location.href = '/registro'}
                        className="text-sm text-blue-300/80 hover:text-blue-200 font-semibold transition-colors">
                        Regístrate
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* ── STEP 2: Code ── */}
              {step === 'code' && (
                <>
                  <div className="mb-8">
                    <button onClick={() => { setStep('email'); setError(''); setCode(''); }}
                      className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-4">
                      <ChevronLeft className="w-4 h-4" /> Cambiar correo
                    </button>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Ingresa tu código</h2>
                    <p className="mt-1.5 text-sm text-white/45 leading-relaxed">
                      Enviamos un código de acceso a<br />
                      <span className="text-white/70 font-medium">{maskedEmail}</span>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyCode} className="space-y-4" noValidate>
                    {error && (
                      <div className="px-4 py-3 rounded-xl text-sm text-red-300 font-medium"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        {error}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="code" className="block text-xs font-semibold text-white/55 tracking-wide uppercase">
                        Código de acceso
                      </label>
                      <input
                        id="code"
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        required
                        placeholder="A7K9P2"
                        maxLength={6}
                        className={`${inputCls} text-center text-2xl font-bold tracking-[0.3em]`}
                        style={{ ...inputStyle, letterSpacing: '0.3em' }}
                        autoComplete="one-time-code"
                        autoFocus
                        onFocus={handleFocusOn}
                        onBlur={handleFocusOff}
                      />
                      <p className="text-xs text-white/30 text-center">Revisa tu correo y WhatsApp · Válido por 10 minutos</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || code.length !== 6}
                      className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-[#0b2d6b] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: (loading || code.length !== 6) ? 'rgba(255,255,255,0.6)' : 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
                    >
                      {loading ? (
                        <><span className="w-4 h-4 border-2 border-blue-800/30 border-t-blue-800 rounded-full animate-spin" /><span>Verificando...</span></>
                      ) : (
                        <><CheckCircle className="w-4 h-4" /><span>Ingresar</span></>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="w-full flex items-center justify-center gap-1.5 text-sm text-white/40 hover:text-white/70 font-medium py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
                    </button>

                    <p className="text-xs text-white/25 text-center pt-1">
                      Si no recibes el código, revisa tu carpeta de spam.
                    </p>
                  </form>
                </>
              )}
            </div>

            <div className="lg:hidden mt-12 flex items-center gap-4 text-[11px] text-white/25">
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">movi.digital</a>
              <span className="w-px h-3 bg-white/15" />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">grupojiro.com</a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.06); } }
        @keyframes pulse-slower { 0%, 100% { opacity: 0.18; transform: scale(1); } 50% { opacity: 0.28; transform: scale(1.08); } }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-pulse-slower { animation: pulse-slower 12s ease-in-out infinite; }
      `}</style>
    </>
  );
}
