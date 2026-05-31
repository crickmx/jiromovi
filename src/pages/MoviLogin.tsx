import React, { useState, useRef, useEffect } from 'react';
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
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el codigo');
      setStep('code');
      startCooldown(120);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar el codigo');
    } finally {
      setLoading(false);
    }
  }

  function handleCodeInput(idx: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[idx] = char;
    setCode(next);
    if (char && idx < 5) codeRefs.current[idx + 1]?.focus();
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...code];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setCode(next);
    const focusIdx = Math.min(pasted.length, 5);
    codeRefs.current[focusIdx]?.focus();
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = code.join('');
    if (token.length < 6) { setError('Ingresa el codigo de 6 digitos'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: token, platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Codigo incorrecto o expirado');
      if (data.token_hash) {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
        if (otpError) throw new Error(otpError.message);
      }
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al verificar el codigo');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo reenviar');
      setCode(['', '', '', '', '', '']);
      startCooldown(120);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reenviar');
    } finally {
      setLoading(false);
    }
  }

  const inputBase: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = '1px solid rgba(13,110,253,0.6)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border = inputBase.border as string;
    e.currentTarget.style.background = inputBase.background as string;
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <>
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* LEFT COLUMN */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div className="flex items-center gap-3">
              <img src="/logojiro.png" alt="MOVI Digital" className="h-10 w-auto" />
            </div>

            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-4"
                style={{ color: 'rgba(13,110,253,0.8)' }}>
                Plataforma de gestion
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                El sistema<br />digital para<br />
                <span style={{ background: 'linear-gradient(90deg, #0D6EFD, #00c8e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  agentes de seguros
                </span>
              </h1>
              <p className="mt-5 text-base leading-relaxed max-w-sm"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Gestiona polizas, comisiones, clientes y produccion desde un solo lugar.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  'CRM y tramites integrados',
                  'Sincronizacion con SICAS en tiempo real',
                  'Reportes de produccion y comisiones',
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

            <div className="lg:hidden mb-10 text-center">
              <img src="/logojiro.png" alt="MOVI Digital" className="h-10 w-auto mx-auto mb-2" />
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(13,110,253,0.7)' }}>MOVI Digital</p>
            </div>

            <div className="w-full max-w-[380px]">

              {/* STEP: EMAIL */}
              {step === 'email' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Iniciar sesion</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Te enviaremos un codigo de acceso a tu correo
                    </p>
                  </div>

                  {error && (
                    <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2" style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#fca5a5',
                    }}>
                      <span className="w-4 h-4 flex-shrink-0 text-red-400">!</span>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold tracking-wide uppercase"
                        style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Correo electronico
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                          style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full h-12 rounded-2xl text-sm outline-none transition-all duration-200 pl-11 pr-4 placeholder:text-white/20"
                          style={inputBase}
                          onFocus={onFocus}
                          onBlur={onBlur}
                          autoComplete="email"
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
                      style={{
                        background: (loading || !email.trim()) ? 'rgba(13,110,253,0.5)' : 'linear-gradient(135deg, #0D6EFD, #0047bb)',
                        boxShadow: (loading || !email.trim()) ? 'none' : '0 4px 20px rgba(13,110,253,0.35)',
                      }}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <span>Enviar codigo</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* STEP: CODE */}
              {step === 'code' && (
                <>
                  <div className="mb-8">
                    <button
                      onClick={() => { setStep('email'); setError(null); setCode(['','','','','','']); }}
                      className="flex items-center gap-1.5 text-xs mb-5 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Cambiar correo
                    </button>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Verifica tu identidad</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      Ingresa el codigo de 6 digitos enviado a
                    </p>
                    <p className="mt-0.5 text-sm font-semibold" style={{ color: 'rgba(13,110,253,0.9)' }}>
                      {email}
                    </p>
                  </div>

                  {success ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <CheckCircle className="w-12 h-12" style={{ color: '#22c55e' }} />
                      <p className="text-sm font-semibold text-white">Acceso verificado</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Redirigiendo...</p>
                    </div>
                  ) : (
                    <>
                      {error && (
                        <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2" style={{
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          color: '#fca5a5',
                        }}>
                          <span className="flex-shrink-0">!</span>
                          {error}
                        </div>
                      )}

                      <form onSubmit={handleCodeSubmit} className="space-y-6" noValidate>
                        <div>
                          <label className="block text-xs font-semibold tracking-wide uppercase mb-3"
                            style={{ color: 'rgba(255,255,255,0.4)' }}>
                            Codigo de acceso
                          </label>
                          <div className="flex gap-2" onPaste={handleCodePaste}>
                            {code.map((digit, idx) => (
                              <input
                                key={idx}
                                ref={el => { codeRefs.current[idx] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleCodeInput(idx, e.target.value)}
                                onKeyDown={e => handleCodeKeyDown(idx, e)}
                                className="flex-1 h-14 rounded-2xl text-center text-xl font-bold outline-none transition-all duration-200"
                                style={{
                                  background: digit ? 'rgba(13,110,253,0.18)' : 'rgba(255,255,255,0.07)',
                                  border: digit ? '1px solid rgba(13,110,253,0.5)' : '1px solid rgba(255,255,255,0.12)',
                                  color: 'white',
                                }}
                                onFocus={e => {
                                  e.currentTarget.style.border = '1px solid rgba(13,110,253,0.6)';
                                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,110,253,0.15)';
                                }}
                                onBlur={e => {
                                  if (!digit) {
                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)';
                                  } else {
                                    e.currentTarget.style.border = '1px solid rgba(13,110,253,0.5)';
                                  }
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading || code.join('').length < 6}
                          className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{
                            background: (loading || code.join('').length < 6) ? 'rgba(13,110,253,0.5)' : 'linear-gradient(135deg, #0D6EFD, #0047bb)',
                            boxShadow: (loading || code.join('').length < 6) ? 'none' : '0 4px 20px rgba(13,110,253,0.35)',
                          }}
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Verificando...</span>
                            </>
                          ) : (
                            <>
                              <span>Ingresar</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>

                        <div className="text-center">
                          {cooldown > 0 ? (
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              Reenviar en {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, '0')}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={handleResend}
                              disabled={loading}
                              className="flex items-center gap-1.5 mx-auto text-xs transition-colors disabled:opacity-50"
                              style={{ color: 'rgba(13,110,253,0.8)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#0D6EFD')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(13,110,253,0.8)')}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reenviar codigo
                            </button>
                          )}
                        </div>
                      </form>
                    </>
                  )}
                </>
              )}
            </div>

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
