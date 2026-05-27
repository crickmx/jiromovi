import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft, RotateCcw, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
const SEGUWALLET_LOGO = 'https://app.seguwallet.mx/seguwallet-logo.png';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Animated background ──────────────────────────────────────────────────────
function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #050e24 0%, #0a2260 35%, #0d2e80 55%, #091a50 80%, #030810 100%)',
      }} />
      <div
        className="absolute -top-48 -left-48 w-[650px] h-[650px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #1c37e0 0%, transparent 65%)',
          opacity: 0.22,
          animation: 'sw-pulse-slow 9s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/3 -right-56 w-[550px] h-[550px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #3b58f0 0%, transparent 65%)',
          opacity: 0.17,
          animation: 'sw-pulse-slower 13s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -bottom-40 left-1/3 w-[480px] h-[480px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #1e40af 0%, transparent 65%)',
          opacity: 0.14,
          animation: 'sw-pulse-slow 10s ease-in-out infinite 2s',
        }}
      />
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(91,120,255,0.4), transparent)',
      }} />
    </div>
  );
}

type Step = 'email' | 'code';

export function SeguwalletLogin() {
  useEffect(() => { document.title = 'Seguwallet'; }, []);

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
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
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
        body: JSON.stringify({ email: trimmed, platform: 'seguwallet' }),
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: trimmedCode, platform: 'seguwallet' }),
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
      // Verify the token_hash returned from the edge function to create a session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });
      if (otpError) {
        setError('Error al crear la sesión. Intenta de nuevo.');
        return;
      }
      navigate('/seguwallet/dashboard', { replace: true });
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
        body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'seguwallet' }),
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
      startCooldown(120);
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // Shared input style
  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: 'white',
  };
  const inputFocusOn = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(91,120,255,0.6)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,88,240,0.15)';
  };
  const inputFocusOff = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = inputBase.border as string;
    e.currentTarget.style.background = inputBase.background as string;
    e.currentTarget.style.boxShadow = 'none';
  };
  const inputCls = 'w-full h-12 rounded-2xl text-sm outline-none transition-all duration-200 placeholder:text-[rgba(148,185,255,0.35)]';

  return (
    <>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* LEFT COLUMN */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div className="flex items-center gap-3">
              <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-14 w-auto" />
            </div>

            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ color: 'rgba(91,120,255,0.8)' }}>
                Portal de clientes
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.12] tracking-tight">
                Tu cartera<br />digital de<br />
                <span style={{ color: '#5b78ff' }}>seguros</span>
              </h1>
              <p className="mt-5 text-base leading-relaxed max-w-sm"
                style={{ color: 'rgba(255,255,255,0.45)' }}>
                Consulta, organiza y protege tus polizas en un solo lugar.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  { icon: '🔐', text: 'Acceso seguro sin contraseña' },
                  { icon: '📋', text: 'Todas tus polizas en un lugar' },
                  { icon: '📱', text: 'Codigo por correo y WhatsApp' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/70 transition-colors">movi.digital</a>
              <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/70 transition-colors">grupojiro.com</a>
              <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span>© {new Date().getFullYear()} Seguwallet</span>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px self-stretch my-12" style={{
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.09) 20%, rgba(255,255,255,0.09) 80%, transparent)',
          }} />

          {/* RIGHT COLUMN: form */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            {/* Mobile logo */}
            <div className="lg:hidden mb-10 text-center">
              <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-14 w-auto mx-auto" />
            </div>

            <div className="w-full max-w-[380px]">

              {/* ── STEP: EMAIL ── */}
              {step === 'email' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Ingresar</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(148,185,255,0.55)' }}>
                      Accede a tu wallet de seguros sin contraseña
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                      background: 'rgba(239,68,68,0.13)',
                      border: '1px solid rgba(239,68,68,0.28)',
                      color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold tracking-wide uppercase"
                        style={{ color: 'rgba(148,185,255,0.6)' }}>
                        Correo electrónico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: 'rgba(148,185,255,0.4)' }} />
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
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-[#0a1e5e] transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                      style={{
                        background: loading ? 'rgba(255,255,255,0.65)' : 'white',
                        boxShadow: loading ? 'none' : '0 4px 24px rgba(0,0,0,0.28)',
                      }}
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-blue-900/30 border-t-blue-900 rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Enviar código de acceso</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-xs text-center" style={{ color: 'rgba(148,185,255,0.4)' }}>
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
                      style={{ color: 'rgba(148,185,255,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.6)')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Cambiar correo
                    </button>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Verifica tu acceso</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(148,185,255,0.55)' }}>
                      Ingresa el código enviado a<br />
                      <span className="font-semibold" style={{ color: 'rgba(148,185,255,0.85)' }}>{maskedEmail}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                      background: 'rgba(239,68,68,0.13)',
                      border: '1px solid rgba(239,68,68,0.28)',
                      color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold tracking-wide uppercase"
                        style={{ color: 'rgba(148,185,255,0.6)' }}>
                        Código de acceso
                      </label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        placeholder="ABC123"
                        className={`${inputCls} px-4 text-center text-2xl font-bold tracking-[0.35em] font-mono`}
                        style={{
                          ...inputBase,
                          letterSpacing: '0.35em',
                        }}
                        onFocus={inputFocusOn}
                        onBlur={inputFocusOff}
                        autoComplete="one-time-code"
                        inputMode="text"
                        maxLength={6}
                        autoFocus
                      />
                      <p className="text-xs text-center mt-1" style={{ color: 'rgba(148,185,255,0.4)' }}>
                        Revisa tu correo y WhatsApp — válido 10 minutos
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || code.length < 6}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-[#0a1e5e] transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                      style={{
                        background: (loading || code.length < 6) ? 'rgba(255,255,255,0.5)' : 'white',
                        boxShadow: (loading || code.length < 6) ? 'none' : '0 4px 24px rgba(0,0,0,0.28)',
                      }}
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-blue-900/30 border-t-blue-900 rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Verificar e ingresar</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center pt-1">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || loading}
                        className="flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ color: resendCooldown > 0 ? 'rgba(148,185,255,0.4)' : 'rgba(148,185,255,0.7)' }}
                        onMouseEnter={e => { if (resendCooldown === 0) e.currentTarget.style.color = 'rgba(148,185,255,1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = resendCooldown > 0 ? 'rgba(148,185,255,0.4)' : 'rgba(148,185,255,0.7)'; }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {resendCooldown > 0
                          ? `Reenviar en ${resendCooldown}s`
                          : 'Reenviar código'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Mobile footer */}
            <div className="lg:hidden mt-12 flex items-center gap-4 text-[11px]"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">movi.digital</a>
              <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">grupojiro.com</a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sw-pulse-slow {
          0%, 100% { opacity: 0.22; transform: scale(1); }
          50%       { opacity: 0.32; transform: scale(1.07); }
        }
        @keyframes sw-pulse-slower {
          0%, 100% { opacity: 0.17; transform: scale(1); }
          50%       { opacity: 0.26; transform: scale(1.09); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sw-pulse-slow, .sw-pulse-slower { animation: none !important; }
        }
      `}</style>
    </>
  );
}
