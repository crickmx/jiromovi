import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ChevronLeft } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import MoviPreloader from '../components/MoviPreloader';
import { supabase } from '../lib/supabase';

const REMEMBER_KEY = 'movi-remember-email';

// ─── Animated background blobs ────────────────────────────────────────────────
function BackgroundLayer() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #051530 0%, #0b2d6b 35%, #0d3680 55%, #0a2258 80%, #040d1f 100%)',
      }} />
      {/* Animated glow orbs */}
      <div className="absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full opacity-25 animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, #1a56db 0%, transparent 65%)' }} />
      <div className="absolute top-1/3 -right-64 w-[600px] h-[600px] rounded-full opacity-20 animate-pulse-slower"
        style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 65%)' }} />
      <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] rounded-full opacity-15 animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 65%)' }} />
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {/* Top edge light */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-30"
        style={{ background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)' }} />
    </div>
  );
}

export function Login() {
  // ── All state and logic unchanged ──────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPreloader, setShowPreloader] = useState(false);
  const [userName, setUserName] = useState('Usuario');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('Error de autenticación:', signInError);

        if (signInError.message.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas. Por favor, verifica tu e-mail laboral y contraseña.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Debes confirmar tu correo electrónico antes de iniciar sesión.');
        } else if (signInError.message.includes('Failed to fetch') || signInError.name === 'NetworkError' || signInError.status === 0) {
          setError('Error de conexión con el servidor. Verifica tu conexión a internet o contacta al administrador.');
        } else if (signInError.message.includes('network')) {
          setError('Error de conexión. Por favor, verifica tu conexión a internet.');
        } else {
          setError(`Error al iniciar sesión: ${signInError.message}`);
        }
        setLoading(false);
      } else {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('usuarios')
            .select('nombre')
            .eq('id', user.id)
            .maybeSingle();

          if (userData?.nombre) {
            setUserName(userData.nombre);
          }
        }

        setShowPreloader(true);
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error inesperado:', err);

      if (err.message && err.message.includes('Failed to fetch')) {
        setError('No se pudo conectar con el servidor. Verifica tu conexión a internet y vuelve a intentar.');
      } else {
        setError('Error inesperado al iniciar sesión. Por favor, intenta de nuevo.');
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/reset-password-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al enviar el correo');
      }

      setSuccess('Se ha enviado un correo con instrucciones para recuperar tu contraseña.');
      setResetEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Error al solicitar recuperación:', err);
      setError('Error al enviar el correo de recuperación. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };
  // ── End of unchanged logic ──────────────────────────────────────────────────

  // Input style uses inline styles to guarantee rendering regardless of Tailwind purge
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.09)',
    border: '1px solid rgba(255,255,255,0.16)',
    color: 'white',
  };
  const inputCls = [
    'w-full h-12 px-4 text-sm rounded-xl transition-all duration-200 outline-none',
    'placeholder:text-white/40',
  ].join(' ');

  return (
    <>
      <MoviPreloader
        isOpen={showPreloader}
        userName={userName}
        subtitle="Preparando tu experiencia digital..."
        logoIconUrl="/movirecurso_1.png"
        minDurationMs={3000}
      />

      {/* Full-screen wrapper */}
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <BackgroundLayer />

        {/* ── Two-column layout ── */}
        <div className="relative z-10 flex flex-1 min-h-screen">

          {/* ── LEFT COLUMN: brand ── */}
          <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-start justify-between px-16 xl:px-24 py-14">
            {/* Top: logo free-floating, no box */}
            <div>
              <img
                src="https://movi.digital/wp-content/uploads/2025/12/moviRecurso-2.png"
                alt="MOVI Digital"
                className="h-16 xl:h-20 object-contain"
              />
            </div>

            {/* Center: headline */}
            <div className="max-w-md">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-blue-300/70 mb-4">
                Plataforma institucional
              </p>
              <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.12] tracking-tight">
                Tu oficina<br />digital de<br />
                <span style={{ color: '#60a5fa' }}>seguros</span>
              </h1>
              <p className="mt-5 text-base text-white/50 leading-relaxed max-w-sm">
                Tecnología, gestión y crecimiento para agentes de seguros en México.
              </p>

              {/* Feature pills */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                {['CRM Integrado', 'Producción SICAS', 'Comisiones', 'Trámites', 'Cotizador GMM'].map(f => (
                  <span
                    key={f}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-full text-blue-200/80"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom: footer links */}
            <div className="flex items-center gap-5 text-[11px] text-white/30">
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/70 transition-colors">movi.digital</a>
              <span className="w-px h-3 bg-white/15" />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/70 transition-colors">grupojiro.com</a>
              <span className="w-px h-3 bg-white/15" />
              <span>© {new Date().getFullYear()} MOVI Digital</span>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="hidden lg:block w-px self-stretch my-12"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, transparent)' }} />

          {/* ── RIGHT COLUMN: form ── */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-14 xl:px-20">

            {/* Mobile-only logo */}
            <div className="lg:hidden mb-10 text-center">
              <img
                src="https://movi.digital/wp-content/uploads/2025/12/moviRecurso-2.png"
                alt="MOVI Digital"
                className="h-14 object-contain mx-auto"
              />
            </div>

            <div className="w-full max-w-[380px]">

              {/* Heading */}
              <div className="mb-8">
                {showForgotPassword ? (
                  <>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                      Recuperar acceso
                    </h2>
                    <p className="mt-1.5 text-sm text-white/45">
                      Te ayudaremos a restablecer tu contraseña
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">
                      Iniciar sesión
                    </h2>
                    <p className="mt-1.5 text-sm text-white/45">
                      Accede a tu cuenta de MOVI Digital
                    </p>
                  </>
                )}
              </div>

              {/* ── LOGIN FORM ── */}
              {!showForgotPassword ? (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {error && (
                    <div className="px-4 py-3 rounded-xl text-sm text-red-300 font-medium"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {error}
                    </div>
                  )}

                  {/* Email */}
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="usuario@empresa.com"
                        className={`${inputCls} pl-10`}
                        style={inputStyle}
                        autoComplete="email"
                        autoFocus
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(96,165,250,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                        onBlur={e => { e.currentTarget.style.border = inputStyle.border as string; e.currentTarget.style.background = inputStyle.background as string; }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="block text-xs font-semibold text-white/55 tracking-wide uppercase">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Ingresa tu contraseña"
                        className={`${inputCls} pl-10 pr-11`}
                        style={inputStyle}
                        autoComplete="current-password"
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(96,165,250,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                        onBlur={e => { e.currentTarget.style.border = inputStyle.border as string; e.currentTarget.style.background = inputStyle.background as string; }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember + Forgot */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        className="border-white/25 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                      <Label htmlFor="remember" className="text-sm text-white/50 cursor-pointer select-none font-normal">
                        Recordarme
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(true); setError(''); }}
                      className="text-sm text-blue-300/80 hover:text-blue-200 font-medium transition-colors"
                    >
                      Olvidé mi contraseña
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-[#0b2d6b] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    style={{
                      background: loading ? 'rgba(255,255,255,0.7)' : 'white',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-blue-800/30 border-t-blue-800 rounded-full animate-spin" />
                        <span>Iniciando sesión...</span>
                      </>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Register link */}
                  <div className="pt-4 text-center">
                    <span className="text-sm text-white/35">¿No tienes cuenta? </span>
                    <button
                      type="button"
                      onClick={() => window.location.href = '/registro'}
                      className="text-sm text-blue-300/80 hover:text-blue-200 font-semibold transition-colors"
                    >
                      Regístrate
                    </button>
                  </div>
                </form>
              ) : (
                /* ── FORGOT PASSWORD FORM ── */
                <form onSubmit={handlePasswordReset} className="space-y-4" noValidate>
                  {error && (
                    <div className="px-4 py-3 rounded-xl text-sm text-red-300 font-medium"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="px-4 py-3 rounded-xl text-sm text-emerald-300 font-medium"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                      {success}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="resetEmail" className="block text-xs font-semibold text-white/55 tracking-wide uppercase">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                      <input
                        id="resetEmail"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        placeholder="usuario@empresa.com"
                        className={`${inputCls} pl-10`}
                        style={inputStyle}
                        autoFocus
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(96,165,250,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                        onBlur={e => { e.currentTarget.style.border = inputStyle.border as string; e.currentTarget.style.background = inputStyle.background as string; }}
                      />
                    </div>
                    <p className="text-xs text-white/35 mt-1">
                      Te enviaremos un enlace para restablecer tu contraseña
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 flex items-center justify-center gap-2 rounded-xl font-bold text-sm text-[#0b2d6b] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: loading ? 'rgba(255,255,255,0.7)' : 'white',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-blue-800/30 border-t-blue-800 rounded-full animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      'Enviar enlace de recuperación'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setError(''); setSuccess(''); }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-white/40 hover:text-white/70 font-medium py-2 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </div>

            {/* Mobile footer */}
            <div className="lg:hidden mt-12 flex items-center gap-4 text-[11px] text-white/25">
              <a href="https://movi.digital" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">movi.digital</a>
              <span className="w-px h-3 bg-white/15" />
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer"
                className="hover:text-white/60 transition-colors">grupojiro.com</a>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe animations injected once */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.06); }
        }
        @keyframes pulse-slower {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50% { opacity: 0.28; transform: scale(1.08); }
        }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-pulse-slower { animation: pulse-slower 12s ease-in-out infinite; }
      `}</style>
    </>
  );
}
