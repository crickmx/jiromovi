import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ChevronLeft } from 'lucide-react';
import { seguwalletSignIn } from '../lib/seguwalletAuth';
const logoDark = '/movirecurso_1.png';

// ─── Animated background ──────────────────────────────────────────────────────
function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #050e24 0%, #0a2260 35%, #0d2e80 55%, #091a50 80%, #030810 100%)',
      }} />
      {/* Animated glow orbs */}
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
      {/* Subtle grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(91,120,255,0.4), transparent)',
      }} />
    </div>
  );
}

export function SeguwalletLogin() {
  // ── Auth logic — untouched ──────────────────────────────────────────────────
  useEffect(() => { document.title = 'Seguwallet'; }, []);

  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await seguwalletSignIn(email.trim(), password);
      navigate('/seguwallet/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid')) {
        setError('Correo o contraseña incorrectos.');
      } else if (msg.includes('blocked') || msg.includes('disabled') || msg.includes('banned')) {
        setError('Tu cuenta está inactiva. Contacta a tu agente.');
      } else {
        setError(msg || 'Error al iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setForgotSent(true);
  };
  // ── End of untouched logic ──────────────────────────────────────────────────

  // Shared input style — inline to guarantee rendering
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

        {/* ── Two-column layout ── */}
        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* ── LEFT COLUMN: brand ── */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">

            {/* Logo — free-floating, no container */}
            <img
              src={logoDark}
              alt="Seguwallet"
              className="h-20 xl:h-24 w-auto object-contain"
            />

            {/* Center: copy */}
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
                Consulta, organiza y protege tus pólizas en un solo lugar.
              </p>
            </div>

            {/* Footer links */}
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

          {/* Vertical divider */}
          <div className="hidden lg:block w-px self-stretch my-12" style={{
            background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.09) 20%, rgba(255,255,255,0.09) 80%, transparent)',
          }} />

          {/* ── RIGHT COLUMN: form ── */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            {/* Mobile logo */}
            <div className="lg:hidden mb-10 text-center">
              <img
                src={logoDark}
                alt="Seguwallet"
                className="h-16 w-auto object-contain mx-auto"
              />
            </div>

            <div className="w-full max-w-[380px]">

              {/* Heading */}
              <div className="mb-8">
                {forgotMode ? (
                  <>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                      {forgotSent ? 'Revisa tu correo' : 'Recuperar contraseña'}
                    </h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(148,185,255,0.55)' }}>
                      {forgotSent
                        ? 'Si tu correo está registrado recibirás el enlace.'
                        : 'Te enviaremos un enlace para restablecerla.'}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                      Iniciar sesión
                    </h2>
                    <p className="mt-1.5 text-sm" style={{ color: 'rgba(148,185,255,0.55)' }}>
                      Accede a tu wallet de seguros
                    </p>
                  </>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{
                  background: 'rgba(239,68,68,0.13)',
                  border: '1px solid rgba(239,68,68,0.28)',
                  color: '#fca5a5',
                }}>
                  {error}
                </div>
              )}

              {/* ── FORGOT SENT ── */}
              {forgotMode && forgotSent ? (
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
                    background: 'rgba(34,197,94,0.13)',
                    border: '1px solid rgba(34,197,94,0.28)',
                  }}>
                    <Mail className="w-7 h-7" style={{ color: '#86efac' }} />
                  </div>
                  <button
                    onClick={() => { setForgotMode(false); setForgotSent(false); setError(''); }}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{ color: 'rgba(148,185,255,0.7)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </div>

              ) : forgotMode ? (
                /* ── FORGOT FORM ── */
                <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
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
                    className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: loading ? 'rgba(59,88,240,0.5)' : 'linear-gradient(135deg, #1c37e0 0%, #1e40af 100%)',
                      boxShadow: loading ? 'none' : '0 4px 20px rgba(28,55,224,0.4)',
                    }}
                  >
                    {loading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : 'Enviar enlace'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError(''); }}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{ color: 'rgba(148,185,255,0.6)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </form>

              ) : (
                /* ── LOGIN FORM ── */
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Email */}
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

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold tracking-wide uppercase"
                      style={{ color: 'rgba(148,185,255,0.6)' }}>
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: 'rgba(148,185,255,0.4)' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${inputCls} pl-10 pr-12`}
                        style={inputBase}
                        onFocus={inputFocusOn}
                        onBlur={inputFocusOff}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                        style={{ color: 'rgba(148,185,255,0.45)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.9)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.45)')}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot link */}
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(''); }}
                      className="text-xs font-semibold transition-colors"
                      style={{ color: 'rgba(148,185,255,0.6)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(148,185,255,1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(148,185,255,0.6)')}
                    >
                      Olvidé mi contraseña
                    </button>
                  </div>

                  {/* Submit */}
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
                        <span>Iniciar sesión</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
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

      {/* Keyframe animations */}
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
