import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft, RotateCcw, CircleCheck as CheckCircle, Lock, Eye, EyeOff, Phone, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BetaBanner } from '../components/BetaBanner';
import { isBetaHost } from '../lib/betaAccess';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const PREF_KEY = 'movi_login_preference';

function getLoginPreference(): 'password' | 'express' {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === 'express') return 'express';
  } catch {}
  return 'password';
}

function saveLoginPreference(pref: 'password' | 'express') {
  try { localStorage.setItem(PREF_KEY, pref); } catch {}
}

function isPhoneInput(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && /^\d+$/.test(value.replace(/[\s\-+()]/g, ''));
}

// Mismo lenguaje visual que la landing de movi.digital: fondo claro, halos azules sutiles y retícula.
function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0 bg-[#F8FAFC]" />
      <div className="absolute -top-56 -right-56 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.14)_0%,transparent_65%)]" />
      <div className="absolute bottom-0 -left-40 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(28,55,224,0.10)_0%,transparent_65%)]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
    </div>
  );
}

type Step = 'main' | 'express-code';

export default function MoviLogin() {
  useEffect(() => { document.title = 'MOVI Mi Oficina Virtual'; }, []);

  const navigate = useNavigate();
  const isBeta = isBetaHost();
  const [step, setStep] = useState<Step>('main');
  const [mode, setMode] = useState<'password' | 'express'>(getLoginPreference);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState('');
  const [noPasswordMsg, setNoPasswordMsg] = useState(false);
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

  async function resolveEmail(input: string): Promise<string | null> {
    const trimmed = input.trim();
    if (!isPhoneInput(trimmed)) return trimmed.toLowerCase();

    const digits = trimmed.replace(/\D/g, '');
    let phone10 = digits;
    if (digits.length === 12 && digits.startsWith('52')) phone10 = digits.slice(2);
    else if (digits.length === 13 && digits.startsWith('521')) phone10 = digits.slice(3);
    else if (digits.length > 10) phone10 = digits.slice(-10);

    const { data } = await supabase
      .from('usuarios')
      .select('email_laboral')
      .or(`celular_laboral.ilike.%${phone10}%,celular_personal.ilike.%${phone10}%`)
      .eq('estado', 'activo')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    return data?.email_laboral?.toLowerCase() || null;
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNoPasswordMsg(false);
    const trimmed = identifier.trim();
    if (!trimmed) { setError('Ingresa tu correo electrónico o celular.'); return; }
    if (!password) { setError('Ingresa tu contraseña.'); return; }

    setLoading(true);
    try {
      const email = await resolveEmail(trimmed);
      if (!email) {
        setError('No encontramos una cuenta activa con ese dato.');
        return;
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) {
        if (authErr.message.includes('Invalid login credentials')) {
          const { data: userExists } = await supabase
            .from('usuarios')
            .select('id')
            .eq('email_laboral', email)
            .eq('estado', 'activo')
            .is('deleted_at', null)
            .maybeSingle();

          if (userExists) {
            setNoPasswordMsg(true);
          } else {
            setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
          }
          return;
        }
        setError('Error al iniciar sesión. Intenta de nuevo.');
        return;
      }

      saveLoginPreference('password');
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExpressSend(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNoPasswordMsg(false);
    const trimmed = identifier.trim().toLowerCase();
    if (!trimmed) { setError('Ingresa tu correo electrónico o celular.'); return; }

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
        setError('No encontramos una cuenta activa con este dato en MOVI.');
        return;
      }
      setMaskedEmail(data.masked_email || trimmed);
      setStep('express-code');
      saveLoginPreference('express');
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
    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) { setError('Ingresa el código completo de 6 dígitos.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: identifier.trim().toLowerCase(), code: trimmedCode, platform: 'movi' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EXPIRED') {
          setError('El código ha expirado. Solicita uno nuevo.');
          setStep('main');
          setCode('');
          return;
        }
        if (data.code === 'MAX_ATTEMPTS') {
          setError('Demasiados intentos. Solicita un nuevo código.');
          setStep('main');
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
        setError('Error al iniciar sesión. Intenta de nuevo.');
        return;
      }

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
        body: JSON.stringify({ email: identifier.trim().toLowerCase(), platform: 'movi' }),
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
        setError('No se pudo reenviar el código. Verifica tu dato.');
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

  const inputCls = 'w-full h-12 rounded-xl text-sm outline-none transition-all duration-200 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
  const labelCls = 'block text-xs font-semibold tracking-wide uppercase text-slate-600';
  const iconCls = 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400';
  const btnPrimario = 'w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none mt-1';
  const btnSecundario = 'w-full flex items-center justify-center gap-2 h-12 px-3 rounded-xl text-[13px] sm:text-sm font-semibold whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-[0.98]';
  const avisoError = 'mb-4 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 border border-red-200 text-red-700';

  return (
    <>
      {isBeta && <BetaBanner />}
      <div className={`relative min-h-screen flex flex-col overflow-hidden text-slate-900 ${isBeta ? 'pt-9' : ''}`}>
        <BackgroundLayer />

        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* LEFT COLUMN */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            <div className="flex items-center gap-4">
              <img src="/movirecurso_1.png" alt="movi.digital" className="h-10 w-auto object-contain" />
              <div className="h-8 w-px bg-slate-200" />
              <img src="/logojiro.png" alt="JIRO y Asociados" className="h-10 w-auto object-contain" />
            </div>

            <div className="max-w-md">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-[11px] font-extrabold uppercase tracking-wide">
                Plataforma exclusiva Grupo JIRO
              </span>
              <h1 className="mt-5 font-display text-4xl xl:text-5xl font-semibold text-slate-900 leading-[1.08] tracking-[-0.03em]">
                MOVI<br />
                <span className="bg-gradient-to-r from-[#1C37E0] via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  Mi Oficina Virtual
                </span>
              </h1>
              <p className="mt-5 text-base leading-relaxed max-w-sm text-slate-600">
                Gestiona pólizas, comisiones, clientes y producción desde un solo lugar.
              </p>

              <div className="mt-10 space-y-4">
                {[
                  'Acceso con contraseña o código express',
                  'Código por correo y WhatsApp',
                  'CRM y trámites integrados',
                  'Sincronización con SICAS en tiempo real',
                ].map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 text-[11px] text-slate-500">
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-blue-600 transition-colors">grupojiro.com</a>
              <span className="w-px h-3 bg-slate-300" />
              <span>© {new Date().getFullYear()} MOVI Digital</span>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-12 lg:px-14 xl:px-20">

            {/* Mobile logo */}
            <div className="lg:hidden mb-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <img src="/movirecurso_1.png" alt="movi.digital" className="h-10 w-auto object-contain" />
                <div className="h-7 w-px bg-slate-200" />
                <img src="/logojiro.png" alt="JIRO y Asociados" className="h-9 w-auto object-contain" />
              </div>
              <p className="text-xs font-semibold tracking-widest uppercase text-blue-600">MOVI Mi Oficina Virtual</p>
            </div>

            <div className="w-full max-w-[420px] bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/[0.06] p-6 sm:p-9">

              {/* ── STEP: MAIN (password or express input) ── */}
              {step === 'main' && (
                <>
                  <div className="mb-7">
                    <h2 className="font-display text-2xl font-semibold text-slate-900 tracking-[-0.025em]">Iniciar sesión</h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {mode === 'password' ? 'Ingresa con tu contraseña' : 'Recibe un código de acceso'}
                    </p>
                  </div>

                  {error && <div className={avisoError}>{error}</div>}

                  {noPasswordMsg && (
                    <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-900">
                      <p className="font-medium mb-1">Contraseña no configurada</p>
                      <p className="text-xs text-blue-800/80">
                        Aún no tienes una contraseña. Utiliza Ingreso Express y después podrás crear tu contraseña desde tu perfil.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setMode('express'); setNoPasswordMsg(false); setError(''); }}
                        className="mt-2 text-xs font-semibold flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Ir a Ingreso Express
                      </button>
                    </div>
                  )}

                  {/* ── PASSWORD MODE ── */}
                  {mode === 'password' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Correo electrónico o celular</label>
                        <div className="relative">
                          {isPhoneInput(identifier) ? <Phone className={iconCls} /> : <Mail className={iconCls} />}
                          <input
                            type="text"
                            value={identifier}
                            onChange={e => { setIdentifier(e.target.value); setNoPasswordMsg(false); }}
                            placeholder="tu@correo.com o 10 dígitos"
                            className={`${inputCls} pl-10 pr-4`}
                            autoComplete="email"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelCls}>Contraseña</label>
                        <div className="relative">
                          <Lock className={iconCls} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => { setPassword(e.target.value); setNoPasswordMsg(false); }}
                            placeholder="Tu contraseña"
                            className={`${inputCls} pl-10 pr-11`}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className={btnPrimario}>
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Iniciar sesión</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* ── EXPRESS MODE ── */}
                  {mode === 'express' && (
                    <form onSubmit={handleExpressSend} className="space-y-4" noValidate>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Correo electrónico o celular</label>
                        <div className="relative">
                          {isPhoneInput(identifier) ? <Phone className={iconCls} /> : <Mail className={iconCls} />}
                          <input
                            type="text"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="tu@correo.com o 10 dígitos"
                            className={`${inputCls} pl-10 pr-4`}
                            autoComplete="email"
                            autoFocus
                          />
                        </div>
                      </div>

                      <button type="submit" disabled={loading} className={btnPrimario}>
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
                  )}

                  {/* ── MODE SWITCH SEPARATOR ── */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-xs font-medium bg-white text-slate-400">O bien</span>
                    </div>
                  </div>

                  {/* ── ALTERNATE MODE BUTTON ── */}
                  {mode === 'password' ? (
                    <button
                      type="button"
                      onClick={() => { setMode('express'); setError(''); setNoPasswordMsg(false); }}
                      className={btnSecundario}
                    >
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span>Ingreso Express (código sin contraseña)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMode('password'); setError(''); setNoPasswordMsg(false); }}
                      className={btnSecundario}
                    >
                      <Lock className="w-4 h-4 text-blue-600" />
                      <span>Iniciar sesión con contraseña</span>
                    </button>
                  )}

                  <p className="mt-5 text-xs text-center text-slate-500">
                    {mode === 'password'
                      ? '¿No tienes contraseña? Usa Ingreso Express.'
                      : 'Recibirás un código de 6 dígitos por correo y WhatsApp'
                    }
                  </p>
                </>
              )}

              {/* ── STEP: EXPRESS CODE ── */}
              {step === 'express-code' && (
                <>
                  <div className="mb-8">
                    <button
                      onClick={() => { setStep('main'); setError(''); setCode(''); }}
                      className="flex items-center gap-1.5 text-xs font-semibold mb-4 text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Volver
                    </button>
                    <h2 className="font-display text-2xl font-semibold text-slate-900 tracking-[-0.025em]">Verifica tu acceso</h2>
                    <p className="mt-1.5 text-sm text-slate-500">
                      Te enviamos un código a tu correo y WhatsApp registrados
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-blue-600">
                      {maskedEmail}
                    </p>
                  </div>

                  {error && <div className={avisoError}>{error}</div>}

                  <form onSubmit={handleCodeSubmit} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Código de acceso</label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className={`${inputCls} px-4 text-center text-2xl font-bold tracking-[0.35em] font-mono`}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoFocus
                      />
                      <p className="text-xs text-center mt-1 text-slate-500">
                        El código vence en 10 minutos
                      </p>
                    </div>

                    <button type="submit" disabled={loading || code.length < 6} className={btnPrimario}>
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
                        className="flex items-center gap-1.5 text-xs font-semibold transition-colors text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed"
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
            <div className="lg:hidden mt-10 text-[11px] text-slate-500">
              © {new Date().getFullYear()} MOVI Digital · Grupo JIRO
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
