import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

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
        navigate('/');
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-strong">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <img
                src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                alt="MOVI Digital Logo"
                className="h-16 object-contain"
              />
            </div>
            <CardTitle className="text-3xl mb-2">
              {showForgotPassword ? 'Recuperar Contraseña' : 'Bienvenido'}
            </CardTitle>
            <CardDescription>
              {showForgotPassword
                ? 'Ingresa tu correo para recibir instrucciones'
                : 'Ingresa a tu cuenta para continuar'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail Laboral</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="nombre@jiro.mx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForgotPassword(true)}
                  className="w-full"
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-5">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                    {success}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="resetEmail">E-Mail Laboral</Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="nombre@empresa.com"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Enviando...' : 'Enviar Instrucciones'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full"
                >
                  Volver al inicio de sesión
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-neutral-500 mt-6">
          MOVI Digital
        </p>
      </div>
    </div>
  );
}
