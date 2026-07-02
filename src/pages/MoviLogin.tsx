import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ChevronLeft, RotateCcw, CircleCheck as CheckCircle, Lock, Eye, EyeOff, Phone, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

type Step = 'main' | 'express-code';

export default function MoviLogin() {
  useEffect(() => { document.title = 'MOVI Digital'; }, []);

  const navigate = useNavigate();
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
        setError('No encontramos una cuenta activa con este dato en MOVI Digital.');
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
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length < 6) { setError('Ingresa el código completo de 6 caracteres.'); return; }
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
                  'Acceso con contraseña o código express',
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

              {/* ── STEP: MAIN (password or express input) ── */}
              {step === 'main' && (
                <>
                  <div className="mb-7">
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Iniciar sesión</h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {mode === 'password' ? 'Ingresa con tu contraseña' : 'Recibe un código de acceso'}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#fca5a5',
                    }}>
                      {error}
                    </div>
                  )}

                  {noPasswordMsg && (
                    <div className="mb-4 px-4 py-3 rounded-2xl text-sm" style={{
                      background: 'rgba(13,110,253,0.1)',
                      border: '1px solid rgba(13,110,253,0.25)',
                      color: 'rgba(147,197,253,0.9)',
                    }}>
                      <p className="font-medium mb-1">Contraseña no configurada</p>
                      <p className="text-xs" style={{ color: 'rgba(147,197,253,0.7)' }}>
                        Aún no tienes una contraseña. Utiliza Ingreso Express y después podrás crear tu contraseña desde tu perfil.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setMode('express'); setNoPasswordMsg(false); setError(''); }}
                        className="mt-2 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        style={{ color: '#60a5fa' }}
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
                        <label className="block text-xs font-semibold tracking-wide uppercase"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Correo electrónico o celular
                        </label>
                        <div className="relative">
                          {isPhoneInput(identifier)
                            ? <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                            : <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                          }
                          <input
                            type="text"
                            value={identifier}
                            onChange={e => { setIdentifier(e.target.value); setNoPasswordMsg(false); }}
                            placeholder="tu@correo.com o 10 dígitos"
                            className={`${inputCls} pl-10 pr-4`}
                            style={inputBase}
                            onFocus={inputFocusOn}
                            onBlur={inputFocusOff}
                            autoComplete="email"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold tracking-wide uppercase"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                            style={{ color: 'rgba(255,255,255,0.3)' }} />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={e => { setPassword(e.target.value); setNoPasswordMsg(false); }}
                            placeholder="Tu contraseña"
                            className={`${inputCls} pl-10 pr-11`}
                            style={inputBase}
                            onFocus={inputFocusOn}
                            onBlur={inputFocusOff}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                            style={{ color: 'rgba(255,255,255,0.35)' }}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
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
                        <label className="block text-xs font-semibold tracking-wide uppercase"
                          style={{ color: 'rgba(255,255,255,0.4)' }}>
                          Correo electrónico o celular
                        </label>
                        <div className="relative">
                          {isPhoneInput(identifier)
                            ? <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                            : <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
                          }
                          <input
                            type="text"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="tu@correo.com o 10 dígitos"
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
                  )}

                  {/* ── MODE SWITCH SEPARATOR ── */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-xs font-medium" style={{ background: '#050e20', color: 'rgba(255,255,255,0.3)' }}>
                        O bien
                      </span>
                    </div>
                  </div>

                  {/* ── ALTERNATE MODE BUTTON ── */}
                  {mode === 'password' ? (
                    <button
                      type="button"
                      onClick={() => { setMode('express'); setError(''); setNoPasswordMsg(false); }}
                      className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Ingreso Express (código sin contraseña)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setMode('password'); setError(''); setNoPasswordMsg(false); }}
                      className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                    >
                      <Lock className="w-4 h-4" />
                      <span>Iniciar sesión con contraseña</span>
                    </button>
                  )}

                  <p className="mt-5 text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {mode === 'password'
                      ? '¿No tienes contraseña? Usa Ingreso Express.'
                      : 'Recibirás un código de 6 caracteres por correo y WhatsApp'
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
                      className="flex items-center gap-1.5 text-xs font-semibold mb-4 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Volver
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
