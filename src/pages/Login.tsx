import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import MoviPreloader from '../components/MoviPreloader';
import { supabase } from '../lib/supabase';

const REMEMBER_KEY = 'movi-remember-email';

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

  return (
    <>
      <MoviPreloader
        isOpen={showPreloader}
        userName={userName}
        subtitle="Preparando tu experiencia digital..."
        logoIconUrl="/movirecurso_1.png"
        minDurationMs={3000}
      />
      <div className="min-h-screen bg-gradient-to-b from-[#0f1b3d] via-[#162350] to-[#1a2a5e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Logo centered as protagonist */}
        <div className="text-center mb-8 relative z-10">
          <div className="flex justify-center mb-5">
            <img
              src="/movirecurso_1.png"
              alt="MOVI Digital"
              className="h-20 object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">MOVI Digital</h1>
          <p className="text-blue-100/60 text-sm">
            {showForgotPassword ? 'Te ayudaremos a recuperar el acceso' : 'Ingresa a tu cuenta para continuar'}
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-[420px] relative z-10">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10">
            <h2 className="text-xl font-bold text-neutral-900 mb-6">
              {showForgotPassword ? 'Recuperar contrasena' : 'Iniciar sesion'}
            </h2>

            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                    Correo electronico
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="usuario@empresa.com"
                    className="w-full h-12 px-4 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-neutral-400"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                    Contrasena
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Ingresa tu contrasena"
                      className="w-full h-12 px-4 pr-11 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm font-normal text-neutral-600 cursor-pointer select-none"
                    >
                      Recordarme
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Olvide mi contrasena
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Iniciando sesion...
                    </span>
                  ) : (
                    'Ingresar'
                  )}
                </button>

                <div className="pt-4 border-t border-neutral-100 text-center">
                  <span className="text-sm text-neutral-500">No tienes cuenta?{' '}</span>
                  <button
                    type="button"
                    onClick={() => window.location.href = '/registro'}
                    className="text-sm text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors"
                  >
                    Registrate
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                    {success}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="resetEmail" className="block text-sm font-medium text-neutral-700">
                    Correo electronico
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="usuario@empresa.com"
                    className="w-full h-12 px-4 text-sm bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-neutral-400"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Te enviaremos un enlace para restablecer tu contrasena
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#1e3a8a] hover:bg-[#1e40af] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    'Enviar enlace de recuperacion'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full text-sm text-neutral-500 hover:text-neutral-700 font-medium py-2 transition-colors"
                >
                  Volver al inicio de sesion
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 relative z-10">
          <p className="text-sm font-medium text-blue-100/70">MOVI Digital</p>
          <p className="text-xs text-blue-200/40 mt-0.5">Tu plataforma integral de seguros</p>
        </div>
      </div>
    </>
  );
}
