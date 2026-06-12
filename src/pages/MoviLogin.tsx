import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft, RotateCcw, CircleCheck as CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #040c1f 0%, #061428 40%, #081a38 60%, #04101f 100%)',
      }} />
      <div className="absolute -top-56 -right-56 w-[700px] h-[700px] rounded-full" style={{
        background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)',
        opacity: 0.12,
        animation: 'movi-pulse 10s ease-in-out infinite',
      }} />
      <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full" style={{
        background: 'radial-gradient(circle, #0047bb 0%, transparent 65%)',
        opacity: 0.1,
        animation: 'movi-pulse 14s ease-in-out infinite 3s',
      }} />
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
      }} />
    </div>
  );
}

type Step = 'email' | 'code';

export default function MoviLogin() {
  useEffect(() => { document.title = 'MOVI Digital'; }, []);

  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown(seconds = 120) {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Ingresa tu correo electrónico.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: trimmed, platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError('Espera un momento antes de solicitar otro código.');
          return;
        }
        setError(data.error || 'Error al enviar el código.');
        return;
      }
      if (!data.email_sent && !data.whatsapp_sent) {
        setError('No encontramos una cuenta activa con este correo en MOVI Digital.');
        return;
      }
      setMaskedEmail(data.masked_email || trimmed);
      setStep('code');
      startCooldown(120);
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 6) { setError('Ingresa el código completo de 6 caracteres.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: trimmedCode, platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EXPIRED') {
          setError('El código ha expirado. Solicita uno nuevo.');
          setStep('email');
          setCode('');
          return;
        }
        if (data.code === 'MAX_ATTEMPTS') {
          setError('Demasiados intentos. Solicita un nuevo código.');
          setStep('email');
          setCode('');
          return;
        }
        setError(data.error || 'Código incorrecto.');
        return;
      }

      if (!data.hashed_token || !data.email) {
        setError('Error al crear la sesión. Intenta de nuevo.');
        return;
      }

      // Register listener BEFORE verifyOtp so we catch SIGNED_IN reliably
      let navigationDone = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session && !navigationDone) {
          navigationDone = true;
          subscription.unsubscribe();
          navigate('/dashboard', { replace: true });
        }
      });

      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: data.hashed_token,
        type: 'magiclink',
      });
      if (otpErr) {
        subscription.unsubscribe();
        console.error('verifyOtp error:', otpErr.message);
        setError('Error al iniciar sesión. Intenta de nuevo.');
        return;
      }

      // Fallback: if SIGNED_IN never fires, navigate anyway after 3s
      setTimeout(() => {
        if (!navigationDone) {
          navigationDone = true;
          subscription.unsubscribe();
          navigate('/dashboard', { replace: true });
        }
      }, 3000);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
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
      if (!res.ok) {
        if (res.status === 429) {
          setError('Espera un momento antes de solicitar otro código.');
          return;
        }
        setError(data.error || 'Error al reenviar el código.');
        return;
      }
      if (!data.email_sent && !data.whatsapp_sent) {
        setError('No se pudo reenviar el código. Verifica tu correo.');
        return;
      }
      startCooldown(120);
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
  };
  const inputFocusOn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(13,110,253,0.6)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)';
  };
  const inputFocusOff = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = inputBase.border as string;
    e.currentTarget.style.background = inputBase.background as string;
    e.currentTarget.style.boxShadow = 'none';
  };
  const inputCls = 'w-full h-12 rounded-2xl text-sm outline-none transition-all duration-200 placeholder:text-white/20';

  return (
    <>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* LEFT COLUMN */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div>
              <img src="/movirecurso_1.png" alt="MOVI Digital" className="h-10 w-auto" />
            </div>

            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-4"
                style={{ color: 'rgba(13,110,253,0.8)' }}>
                Plataforma de gestión
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                Tu<br />
                <span style={{ background: 'linear-gradient(90deg, #0D6EFD, #00c8e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  oficina virtual
                </span>
              </h1>
              <p className="mt-5 text-base leading-relaxed max-w-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Gestiona pólizas, comisiones, clientes y producción desde un solo lugar.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  'Acceso seguro sin contraseña',
                  'Código por correo y WhatsApp',
                  'CRM y trámites integrados',
                  'Sincronización con SICAS en tiempo real',
                ].map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#0D6EFD' }} />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">grupojiro.com</a>
              <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span>© {new Date().getFullYear()} MOVI Digital</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px self-stretch my-12" style={{
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)',
          }} />

          {/* RIGHT COLUMN */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            {/* Mobile logo */}
            <div className="lg:hidden mb-10 text-center">
              <img src="/movirecurso_1.png" alt="MOVI Digital" className="h-10 w-auto mx-auto mb-2" />
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(13,110,253,0.7)' }}>MOVI Digital</p>
            </div>

            <div className="w-full max-w-[380px]">

              {/* ── STEP: EMAIL ── */}
              {step === 'email' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Iniciar sesión</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Accede a MOVI Digital sin contraseña
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold tracking-wide uppercase"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Correo electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className={`${inputCls} pl-10 pr-4`}
                          style={inputBase}
                          onFocus={inputFocusOn}
                          onBlur={inputFocusOff}
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                      style={{
                        background: loading ? 'rgba(13,110,253,0.5)' : 'linear-gradient(135deg, #0D6EFD, #0047bb)',
                        boxShadow: loading ? 'none' : '0 4px 20px rgba(13,110,253,0.35)',
                      }}
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Enviar código de acceso</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-xs text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    Recibirás un código de 6 caracteres por correo y WhatsApp
                  </p>
                </>
              )}

              {/* ── STEP: CODE ── */}
              {step === 'code' && (
                <>
                  <div className="mb-8">
                    <button
                      onClick={() => { setStep('email'); setError(''); setCode(''); }}
                      className="flex items-center gap-1.5 text-xs font-semibold mb-4 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Cambiar correo
                    </button>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Verifica tu acceso</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Te enviamos un código a tu correo y WhatsApp registrados
                    </p>
                    <p className="mt-0.5 text-sm font-semibold" style={{ color: 'rgba(13,110,253,0.9)' }}>
                      {maskedEmail}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold tracking-wide uppercase"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Código de acceso
                      </label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        placeholder="ABC123"
                        className={`${inputCls} px-4 text-center text-2xl font-bold tracking-[0.35em] font-mono`}
                        style={{ ...inputBase, letterSpacing: '0.35em' }}
                        onFocus={inputFocusOn}
                        onBlur={inputFocusOff}
                        autoComplete="one-time-code"
                        inputMode="text"
                        maxLength={6}
                        autoFocus
                      />
                      <p className="text-xs text-center mt-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        El código vence en 10 minutos
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || code.length < 6}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                      style={{
                        background: (loading || code.length < 6) ? 'rgba(13,110,253,0.4)' : 'linear-gradient(135deg, #0D6EFD, #0047bb)',
                        boxShadow: (loading || code.length < 6) ? 'none' : '0 4px 20px rgba(13,110,253,0.35)',
                      }}
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Ingresar</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || loading}
                        className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ color: resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(13,110,253,0.85)' }}
                        onMouseEnter={e => { if (resendCooldown === 0) e.currentTarget.style.color = '#0D6EFD'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = resendCooldown > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(13,110,253,0.85)'; }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {resendCooldown > 0
                          ? `Enviar nuevo código en ${resendCooldown}s`
                          : 'Reenviar código'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Mobile footer */}
            <div className="lg:hidden mt-12 text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              © {new Date().getFullYear()} MOVI Digital · Grupo JIRO
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes movi-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.2;  transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
