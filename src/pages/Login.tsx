import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import MoviPreloader from '../components/MoviPreloader';
import { supabase } from '../lib/supabase';

const REMEMBER_KEY = 'movi-remember-email';
const LOGO_URL = 'https://movi.digital/wp-content/uploads/2025/12/moviRecurso-5.png';

export function Login() {
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
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Correo o contrasena incorrectos. Verifica tus datos.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Debes confirmar tu correo electronico antes de iniciar sesion.');
        } else if (signInError.message.includes('Failed to fetch') || signInError.name === 'NetworkError' || signInError.status === 0) {
          setError('Sin conexion. Verifica tu red e intenta de nuevo.');
        } else {
          setError(signInError.message || 'Error al iniciar sesion.');
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
          if (userData?.nombre) setUserName(userData.nombre);
        }

        setShowPreloader(true);
        setTimeout(() => navigate('/'), 3000);
      }
    } catch (err: any) {
      if (err.message?.includes('Failed to fetch')) {
        setError('No se pudo conectar con el servidor. Verifica tu conexion.');
      } else {
        setError('Error inesperado. Por favor intenta de nuevo.');
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
      if (!response.ok || !data.success) throw new Error(data.error || 'Error al enviar correo');

      setSuccess('Revisa tu correo, te enviamos el enlace para restablecer tu contrasena.');
      setResetEmail('');
      setTimeout(() => { setShowForgotPassword(false); setSuccess(''); }, 4000);
    } catch (err: any) {
      setError('Error al enviar el correo de recuperacion. Intenta de nuevo.');
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

      {/* Full-screen app shell */}
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f2044 45%, #0d1c38 100%)' }}>

        {/* Ambient glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #4f8ef7 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 right-[-100px] w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        </div>

        {/* Top status-bar spacer for mobile feel */}
        <div className="h-safe-top" />

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">

          {/* Logo block */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-5 relative">
              {/* Glow ring behind logo */}
              <div className="absolute inset-0 rounded-3xl blur-2xl opacity-30" style={{ background: '#2563eb', transform: 'scale(1.3)' }} />
              <div className="relative w-20 h-20 rounded-[22px] flex items-center justify-center overflow-hidden shadow-2xl" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <img
                  src={LOGO_URL}
                  alt="MOVI Digital"
                  className="w-14 h-14 object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
              </div>
            </div>
            <h1 className="text-[22px] font-extrabold text-white tracking-tight">MOVI Digital</h1>
            <p className="text-sm text-white/40 mt-1">
              {showForgotPassword ? 'Recupera tu acceso' : 'Tu plataforma integral de seguros'}
            </p>
          </div>

          {/* Glass card */}
          <div className="w-full max-w-[400px]">
            <div
              className="rounded-3xl p-7 sm:p-8"
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 32px 64px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              {!showForgotPassword ? (
                <>
                  <h2 className="text-lg font-bold text-white mb-6">Iniciar sesion</h2>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="px-4 py-3 rounded-2xl text-sm font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        {error}
                      </div>
                    )}

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-white/50 tracking-widest uppercase">Correo</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="usuario@empresa.com"
                        autoComplete="email"
                        autoFocus
                        className="w-full h-12 px-4 text-sm text-white placeholder:text-white/25 rounded-2xl focus:outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,155,255,0.50)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                        onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-white/50 tracking-widest uppercase">Contrasena</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="w-full h-12 px-4 pr-11 text-sm text-white placeholder:text-white/25 rounded-2xl focus:outline-none transition-all"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                          onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,155,255,0.50)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                          onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/35 hover:text-white/70 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember + forgot */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={checked => setRememberMe(checked as boolean)}
                          className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                        <Label htmlFor="remember" className="text-sm text-white/50 cursor-pointer select-none font-normal">
                          Recordarme
                        </Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                      >
                        Olvide mi contrasena
                      </button>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 8px 24px rgba(37,99,235,0.40)' }}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Iniciando...
                        </span>
                      ) : 'Ingresar'}
                    </button>
                  </form>

                  {/* Register link */}
                  <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-sm text-white/35">No tienes cuenta?{' '}</span>
                    <button
                      type="button"
                      onClick={() => window.location.href = '/registro'}
                      className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                    >
                      Registrate
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Back button */}
                  <button
                    onClick={() => { setShowForgotPassword(false); setError(''); setSuccess(''); }}
                    className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors mb-5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                  </button>

                  <h2 className="text-lg font-bold text-white mb-1">Recuperar contrasena</h2>
                  <p className="text-sm text-white/40 mb-6">Te enviamos un enlace a tu correo registrado</p>

                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    {error && (
                      <div className="px-4 py-3 rounded-2xl text-sm font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="px-4 py-3 rounded-2xl text-sm font-medium text-emerald-300" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                        {success}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-white/50 tracking-widest uppercase">Correo electronico</label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        required
                        placeholder="usuario@empresa.com"
                        autoFocus
                        className="w-full h-12 px-4 text-sm text-white placeholder:text-white/25 rounded-2xl focus:outline-none transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,155,255,0.50)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
                        onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 8px 24px rgba(37,99,235,0.40)' }}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </span>
                      ) : 'Enviar enlace de recuperacion'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 pb-8 pt-2 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-[11px] text-white/25">
            <a
              href="https://movi.digital"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors font-medium"
            >
              movi.digital
            </a>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <a
              href="https://grupojiro.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/60 transition-colors font-medium"
            >
              grupojiro.com
            </a>
          </div>
          <p className="text-[10px] text-white/15">© {new Date().getFullYear()} Grupo JIRO. Todos los derechos reservados.</p>
        </footer>
      </div>
    </>
  );
}
