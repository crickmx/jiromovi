import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import MoviPreloader from '../components/MoviPreloader';
import { supabase } from '../lib/supabase';

const REMEMBER_KEY = 'movi-remember-email';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
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
        subtitle="Preparando tu experiencia digital…"
        logoIconUrl="/movirecurso_1.png"
        minDurationMs={3000}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-6 pt-8">
            <div className="flex justify-center mb-6">
              <img
                src="/movirecurso_1.png"
                alt="MOVI Digital"
                className="h-20 object-contain"
              />
            </div>
            <CardTitle className="text-3xl mb-3 font-bold bg-gradient-to-r from-accent to-blue-600 bg-clip-text text-transparent">
              {showForgotPassword ? 'Recuperar Contraseña' : '¡Bienvenido de nuevo!'}
            </CardTitle>
            <CardDescription className="text-base">
              {showForgotPassword
                ? 'Te ayudaremos a recuperar el acceso a tu cuenta'
                : 'Nos alegra verte de nuevo. Ingresa tus credenciales para continuar'}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-8">
            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Ingresa tu contraseña"
                    className="h-11"
                  />
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
                    className="text-sm text-accent hover:text-primary-700 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-base font-medium"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Iniciando sesión...
                    </span>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => window.location.href = '/registro'}
                    className="text-sm text-accent hover:text-primary-700 font-medium hover:underline transition-colors"
                  >
                    Aún no soy usuario
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>{success}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="resetEmail" className="text-sm font-medium">Correo Electrónico</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    className="h-11"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Te enviaremos un enlace para restablecer tu contraseña
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-base font-medium"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    'Enviar Enlace de Recuperación'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full text-sm text-neutral-600 hover:text-neutral-800 font-medium py-2"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-neutral-400 mt-8">
          <span className="font-medium text-neutral-600">MOVI Digital</span>
          <br />
          <span className="text-xs">Tu plataforma integral de seguros</span>
        </p>
        </div>
      </div>
    </>
  );
}
