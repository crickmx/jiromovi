import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogIn } from 'lucide-react';

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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (resetError) {
      setError('Error al enviar el correo de recuperación. Verifica el correo ingresado.');
    } else {
      setSuccess('Se ha enviado un correo con instrucciones para recuperar tu contraseña.');
      setResetEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-3xl shadow-strong p-8 md:p-10 border border-neutral-200">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="https://movi.digital/wp-content/uploads/2023/06/cropped-logonew.png"
                alt="MOVI Digital Logo"
                className="h-16 object-contain"
              />
            </div>
            <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">
              {showForgotPassword ? 'Recuperar Contraseña' : 'Bienvenido'}
            </h1>
            <p className="text-neutral-600">
              {showForgotPassword
                ? 'Ingresa tu correo para recibir instrucciones'
                : 'Ingresa a tu cuenta para continuar'}
            </p>
          </div>

          {!showForgotPassword ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl text-sm animate-slide-down">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 mb-2">
                  E-Mail Laboral
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-neutral-50 hover:bg-white"
                  placeholder="nombre@empresa.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-neutral-700 mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-neutral-50 hover:bg-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-medium hover:shadow-strong hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>

              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors py-2"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              {error && (
                <div className="bg-accent-50 border border-accent-200 text-accent-700 px-4 py-3 rounded-xl text-sm animate-slide-down">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-slide-down">
                  {success}
                </div>
              )}

              <div>
                <label htmlFor="resetEmail" className="block text-sm font-semibold text-neutral-700 mb-2">
                  E-Mail Laboral
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-neutral-50 hover:bg-white"
                  placeholder="nombre@empresa.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-medium hover:shadow-strong hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? 'Enviando...' : 'Enviar Instrucciones'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-neutral-600 hover:text-neutral-800 text-sm font-medium transition-colors py-2"
              >
                Volver al inicio de sesión
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">
          Intranet JIRO by MOVI Digital
        </p>
      </div>
    </div>
  );
}
